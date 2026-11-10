-- ─────────────────────────────────────────────
-- 서재 표지·읽은 쪽 직접 수정, 공개 프로필 통계 (소유: 웅싯)
-- ─────────────────────────────────────────────

-- 표지는 도서 검색 서비스의 이미지 주소만 저장한다 (lib/book-search.ts와 같은 기준)
alter table public.books
  add column cover_url text check (
    cover_url ~ '^https://(covers\.openlibrary\.org|[a-z0-9-]+\.(kakaocdn|daumcdn)\.net)/'
    and char_length(cover_url) <= 1000
  ),
  -- 표에서 고친 읽은 쪽 수와 독서록 합계의 차이. 표시값 = 독서록 합계 + 이 값
  add column pages_adjust integer not null default 0
    check (pages_adjust between -1000000 and 1000000);

drop function public.my_books();
create function public.my_books()
returns table (
  id uuid,
  title text,
  author text,
  status text,
  genres text[],
  cover_url text,
  created_at timestamptz,
  updated_at timestamptz,
  log_count integer,
  pages integer,
  last_log_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    b.id, b.title, b.author, b.status, b.genres, b.cover_url, b.created_at, b.updated_at,
    count(r.id)::integer,
    greatest(coalesce(sum(r.pages_read), 0)::integer + b.pages_adjust, 0),
    max(r.created_at)
  from public.books b
  left join public.reading_logs r on r.book_id = b.id
  where b.user_id = (select auth.uid())
  group by b.id
  order by coalesce(max(r.created_at), b.created_at) desc, b.id;
$$;

revoke execute on function public.my_books() from public, anon;
grant execute on function public.my_books() to authenticated;

-- 읽은 쪽 수를 직접 맞춘다. 이후 독서록을 쓰면 그만큼 더해진다.
create or replace function public.set_book_pages(p_book_id uuid, p_total integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_logged integer;
begin
  if p_total is null or p_total < 0 or p_total > 200000 then
    raise exception 'invalid pages' using errcode = '22023';
  end if;
  select coalesce(sum(r.pages_read), 0)::integer into v_logged
  from public.reading_logs r
  where r.book_id = p_book_id;

  update public.books
  set pages_adjust = p_total - v_logged
  where id = p_book_id and user_id = (select auth.uid());
  if not found then
    raise exception 'book not found' using errcode = 'P0002';
  end if;
  return p_total;
end;
$$;

revoke execute on function public.set_book_pages(uuid, integer) from public, anon;
grant execute on function public.set_book_pages(uuid, integer) to authenticated;

-- 통계에도 고친 쪽 수를 반영한다 (월별 그래프는 날짜가 있는 독서록만)
create or replace function public.my_record_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with kst as (
    select date_trunc('month', now() at time zone 'Asia/Seoul') as this_month
  ),
  months as (
    select generate_series(
      k.this_month - interval '5 months', k.this_month, interval '1 month'
    ) as month
    from kst k
  ),
  logs as (
    select
      r.book_id,
      r.pages_read,
      date_trunc('month', r.created_at at time zone 'Asia/Seoul') as month
    from public.reading_logs r
    where r.user_id = (select auth.uid())
  ),
  shelf as (
    select b.id, b.title, b.status, b.genres, b.pages_adjust
    from public.books b
    where b.user_id = (select auth.uid())
  ),
  book_pages as (
    select
      s.title,
      count(l.book_id)::integer as logs,
      greatest(coalesce(sum(l.pages_read), 0)::integer + s.pages_adjust, 0) as pages
    from shelf s
    left join logs l on l.book_id = s.id
    group by s.id, s.title, s.pages_adjust
  ),
  teas as (
    select c.tea_type
    from public.tea_columns c
    where c.user_id = (select auth.uid())
  ),
  -- 다도 시간은 출석과 같이 완료한 타이머만 센다
  sessions as (
    select
      (extract(epoch from t.ended_at - t.started_at) - t.paused_seconds)::integer as seconds,
      date_trunc('month', t.ended_at at time zone 'Asia/Seoul') as month
    from public.timer_sessions t
    where t.user_id = (select auth.uid())
      and t.activity = 'tea'
      and t.status = 'completed'
  )
  select jsonb_build_object(
    'reading', jsonb_build_object(
      'books', (select count(*) from shelf),
      'finished', (select count(*) from shelf where status = 'done'),
      'reading_now', (select count(*) from shelf where status = 'reading'),
      'logs', (select count(*) from logs),
      'pages', (select coalesce(sum(pages), 0) from book_pages),
      'pages_this_month', (
        select coalesce(sum(l.pages_read), 0)
        from logs l, kst k where l.month = k.this_month
      ),
      'by_genre', (
        select coalesce(
          jsonb_agg(jsonb_build_object('genre', g.genre, 'count', g.n)
            order by g.n desc, g.genre),
          '[]'::jsonb
        )
        from (
          select u.genre, count(*)::integer as n
          from shelf s, unnest(s.genres) as u(genre)
          group by u.genre
        ) g
      ),
      'top_books', (
        select coalesce(
          jsonb_agg(jsonb_build_object('title', b.title, 'pages', b.pages, 'logs', b.logs)
            order by b.pages desc, b.title),
          '[]'::jsonb
        )
        from (
          select * from book_pages where pages > 0 order by pages desc, title limit 5
        ) b
      ),
      'monthly', (
        select jsonb_agg(
          jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'value', (
              select coalesce(sum(l.pages_read), 0) from logs l where l.month = m.month
            )
          ) order by m.month
        )
        from months m
      )
    ),
    'tea', jsonb_build_object(
      'columns', (select count(*) from teas),
      'untyped', (select count(*) from teas where tea_type is null),
      'by_type', (
        select coalesce(
          jsonb_agg(jsonb_build_object('type', x.tea_type, 'count', x.n)
            order by x.n desc, x.tea_type),
          '[]'::jsonb
        )
        from (
          select tea_type, count(*)::integer as n
          from teas where tea_type is not null group by tea_type
        ) x
      ),
      'seconds', (select coalesce(sum(seconds), 0) from sessions),
      'sessions', (select count(*) from sessions),
      'seconds_this_month', (
        select coalesce(sum(s.seconds), 0)
        from sessions s, kst k where s.month = k.this_month
      ),
      'monthly', (
        select jsonb_agg(
          jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'value', (
              select coalesce(sum(s.seconds), 0) from sessions s where s.month = m.month
            )
          ) order by m.month
        )
        from months m
      )
    )
  );
$$;

-- 공개 프로필 통계: 합계만 돌려준다. 책 제목·기록 내용·타이머 내역은 포함하지 않는다.
-- 다른 사람의 기록을 합산해야 하므로 security definer. 로그인한 사용자만 부를 수 있다.
create or replace function public.public_profile_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Asia/Seoul')::date as day
  ),
  days as (
    select a.day from public.attendance_days a where a.user_id = p_user_id
  ),
  -- 오늘 아직 출석 전이면 어제까지 이어진 기록을 센다 (lib/time.ts의 streak와 같은 기준)
  anchor as (
    select case when exists (select 1 from days d, today t where d.day = t.day)
      then t.day else t.day - 1 end as day
    from today t
  ),
  ordered as (
    select d.day, row_number() over (order by d.day desc)::integer - 1 as n
    from days d, anchor a
    where d.day <= a.day
  ),
  sessions as (
    select t.activity,
      (extract(epoch from t.ended_at - t.started_at) - t.paused_seconds)::integer as seconds
    from public.timer_sessions t
    where t.user_id = p_user_id and t.status = 'completed'
  ),
  shelf as (
    select b.id, b.status, b.pages_adjust from public.books b where b.user_id = p_user_id
  ),
  shelf_pages as (
    select greatest(coalesce(sum(r.pages_read), 0)::integer + s.pages_adjust, 0) as pages
    from shelf s
    left join public.reading_logs r on r.book_id = s.id
    group by s.id, s.pages_adjust
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'streak', (select count(*) from ordered o, anchor a where o.day = a.day - o.n),
    'attendance_days', (select count(*) from days),
    'finished', (select count(*) from shelf where status = 'done'),
    'pages', (select coalesce(sum(pages), 0) from shelf_pages),
    'reading_seconds', (select coalesce(sum(seconds), 0) from sessions where activity = 'reading'),
    'tea_seconds', (select coalesce(sum(seconds), 0) from sessions where activity = 'tea'),
    'tea_sessions', (select count(*) from sessions where activity = 'tea')
  ) end;
$$;

revoke execute on function public.public_profile_stats(uuid) from public, anon;
grant execute on function public.public_profile_stats(uuid) to authenticated;
