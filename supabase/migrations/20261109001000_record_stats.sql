-- ─────────────────────────────────────────────
-- 내 기록 통계 (소유: 웅싯, 태일의 reading_logs·tea_columns 확장)
-- 독서기록: 이번에 읽은 페이지 수 / 차 칼럼: 마신 차 종류. 둘 다 선택 입력이다.
-- 통계는 본인 기록만 집계한다 (호출자 권한으로 실행, RLS 적용).
-- ─────────────────────────────────────────────
alter table public.reading_logs
  add column pages_read integer check (pages_read between 1 and 20000);

alter table public.tea_columns
  add column tea_type text check (
    tea_type in ('green', 'white', 'oolong', 'black', 'puer', 'other')
  );

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
      -- 띄어쓰기·대소문자만 다른 제목은 같은 책으로 센다
      lower(regexp_replace(btrim(r.book_title), '\s+', ' ', 'g')) as book_key,
      btrim(r.book_title) as title,
      r.pages_read,
      r.created_at,
      date_trunc('month', r.created_at at time zone 'Asia/Seoul') as month
    from public.reading_logs r
    where r.user_id = (select auth.uid())
  ),
  books as (
    select
      l.book_key,
      (array_agg(l.title order by l.created_at desc))[1] as title,
      count(*)::integer as logs,
      coalesce(sum(l.pages_read), 0)::integer as pages
    from logs l
    group by l.book_key
  ),
  teas as (
    select c.tea_type
    from public.tea_columns c
    where c.user_id = (select auth.uid())
  ),
  -- 다도 시간은 출석과 같이 완료한 타이머만 센다
  sessions as (
    select
      extract(epoch from t.ended_at - t.started_at)::integer as seconds,
      date_trunc('month', t.ended_at at time zone 'Asia/Seoul') as month
    from public.timer_sessions t
    where t.user_id = (select auth.uid())
      and t.activity = 'tea'
      and t.status = 'completed'
  )
  select jsonb_build_object(
    'reading', jsonb_build_object(
      'books', (select count(*) from books),
      'logs', (select count(*) from logs),
      'pages', (select coalesce(sum(pages_read), 0) from logs),
      'pages_this_month', (
        select coalesce(sum(l.pages_read), 0)
        from logs l, kst k where l.month = k.this_month
      ),
      'top_books', (
        select coalesce(
          jsonb_agg(jsonb_build_object('title', b.title, 'pages', b.pages, 'logs', b.logs)
            order by b.pages desc, b.title),
          '[]'::jsonb
        )
        from (
          select * from books where pages > 0 order by pages desc, title limit 5
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

revoke execute on function public.my_record_stats() from public, anon;
grant execute on function public.my_record_stats() to authenticated;
