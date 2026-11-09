-- ─────────────────────────────────────────────
-- 서재: 책(상태·장르) → 독서록 (소유: 웅싯, 태일의 reading_logs 확장)
-- 책을 먼저 추가하고, 책마다 독서록을 쓴다. 본인만 보고 고칠 수 있다.
-- 이미 있는 독서기록은 같은 제목끼리 책 한 권으로 묶는다.
-- ─────────────────────────────────────────────

-- 띄어쓰기·대소문자만 다른 제목은 같은 책으로 본다
create or replace function public.book_key(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p_title), '\s+', ' ', 'g'));
$$;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  author text check (char_length(author) <= 100),
  status text not null default 'reading' check (status in ('want', 'reading', 'done', 'paused')),
  genres text[] not null default '{}' check (
    cardinality(genres) <= 5
    and genres <@ array[
      'novel', 'essay', 'poetry', 'humanities', 'history', 'science', 'society',
      'economy', 'selfhelp', 'art', 'philosophy', 'comic', 'other'
    ]::text[]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index books_user_title_key on public.books (user_id, public.book_key(title));
create index books_user_status_idx on public.books (user_id, status);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

alter table public.books enable row level security;
create policy "본인 책만 조회" on public.books for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "본인 이름으로 책 추가" on public.books for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 책만 수정" on public.books for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "본인 책만 삭제" on public.books for delete
  to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.books from anon;

-- 책을 지우면 그 책의 독서록도 함께 지워진다
alter table public.reading_logs
  add column book_id uuid references public.books (id) on delete cascade;

-- 기존 기록을 책으로 묶는다. 작성일·수정일은 그대로 둔다.
insert into public.books (user_id, title, created_at, updated_at)
select distinct on (r.user_id, public.book_key(r.book_title))
  r.user_id, btrim(r.book_title), first_value(r.created_at) over w, first_value(r.created_at) over w
from public.reading_logs r
window w as (partition by r.user_id, public.book_key(r.book_title) order by r.created_at)
order by r.user_id, public.book_key(r.book_title), r.created_at;

alter table public.reading_logs disable trigger reading_logs_set_updated_at;
update public.reading_logs r
set book_id = b.id
from public.books b
where b.user_id = r.user_id and public.book_key(b.title) = public.book_key(r.book_title);
alter table public.reading_logs enable trigger reading_logs_set_updated_at;

-- 수정일은 내용이 바뀔 때만 갱신한다 (책 제목을 고쳐도 독서록이 "수정됨"이 되지 않게)
drop trigger reading_logs_set_updated_at on public.reading_logs;
create trigger reading_logs_set_updated_at
  before update on public.reading_logs
  for each row
  when (old.body is distinct from new.body or old.pages_read is distinct from new.pages_read)
  execute function public.set_updated_at();

create index reading_logs_book_idx on public.reading_logs (book_id, created_at desc);

-- 독서록은 항상 내 책 하나에 연결되고, 책 제목은 책에서 가져온다.
-- 책을 지정하지 않으면 제목으로 찾거나 새로 추가한다.
create or replace function public.reading_logs_link_book()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text;
  v_id uuid;
begin
  if new.book_id is not null then
    select title into v_title from public.books
    where id = new.book_id and user_id = new.user_id;
    if v_title is null then
      raise exception 'book not found' using errcode = '42501';
    end if;
    new.book_title := v_title;
    return new;
  end if;

  select id, title into v_id, v_title from public.books
  where user_id = new.user_id and public.book_key(title) = public.book_key(new.book_title);
  if v_id is null then
    insert into public.books (user_id, title)
    values (new.user_id, btrim(new.book_title))
    on conflict (user_id, public.book_key(title)) do nothing
    returning id, title into v_id, v_title;
    if v_id is null then
      select id, title into v_id, v_title from public.books
      where user_id = new.user_id and public.book_key(title) = public.book_key(new.book_title);
    end if;
  end if;
  new.book_id := v_id;
  new.book_title := v_title;
  return new;
end;
$$;

create trigger reading_logs_link_book
  before insert or update on public.reading_logs
  for each row execute function public.reading_logs_link_book();

-- 책 제목을 고치면 독서록의 제목도 맞춘다
create or replace function public.books_sync_log_titles()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.title is distinct from old.title then
    update public.reading_logs
    set book_title = new.title
    where book_id = new.id;
  end if;
  return null;
end;
$$;

create trigger books_sync_log_titles
  after update on public.books
  for each row execute function public.books_sync_log_titles();

-- 서재 표: 책별 독서록 수와 읽은 쪽수
create or replace function public.my_books()
returns table (
  id uuid,
  title text,
  author text,
  status text,
  genres text[],
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
    b.id, b.title, b.author, b.status, b.genres, b.created_at, b.updated_at,
    count(r.id)::integer,
    coalesce(sum(r.pages_read), 0)::integer,
    max(r.created_at)
  from public.books b
  left join public.reading_logs r on r.book_id = b.id
  where b.user_id = (select auth.uid())
  group by b.id
  order by coalesce(max(r.created_at), b.created_at) desc, b.id;
$$;

revoke execute on function public.my_books() from public, anon;
grant execute on function public.my_books() to authenticated;

-- 통계: 권수는 서재 기준, 완독·읽는 중·장르별 추가
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
    select b.id, b.title, b.status, b.genres
    from public.books b
    where b.user_id = (select auth.uid())
  ),
  book_pages as (
    select s.title, count(l.book_id)::integer as logs, coalesce(sum(l.pages_read), 0)::integer as pages
    from shelf s
    left join logs l on l.book_id = s.id
    group by s.id, s.title
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
      'books', (select count(*) from shelf),
      'finished', (select count(*) from shelf where status = 'done'),
      'reading_now', (select count(*) from shelf where status = 'reading'),
      'logs', (select count(*) from logs),
      'pages', (select coalesce(sum(pages_read), 0) from logs),
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
