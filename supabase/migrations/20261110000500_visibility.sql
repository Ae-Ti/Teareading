-- ─────────────────────────────────────────────
-- 프로필 공개/비공개, 차 칼럼·독서기록 글별 공개/비공개 (소유: 웅싯)
-- 프로필은 지금까지처럼 공개가 기본이다. 글은 비공개가 기본이다
-- (이미 쓴 글은 "다른 사람에게 공개되지 않는다"는 안내를 보고 쓴 글이다).
-- ─────────────────────────────────────────────

alter table public.profiles add column is_public boolean not null default true;
alter table public.tea_columns add column is_public boolean not null default false;
alter table public.reading_logs add column is_public boolean not null default false;

-- 지금 로그인한 사람이 이 회원의 공개 프로필 내용을 볼 수 있는가 (본인은 항상)
create or replace function public.profile_visible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    p_user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = p_user_id and p.is_public)
  );
$$;
revoke execute on function public.profile_visible(uuid) from public, anon;
grant execute on function public.profile_visible(uuid) to authenticated;

-- ── 친구 관계: 당사자만 표를 읽고, 다른 사람의 친구 목록은 함수로만 본다 ──
drop policy "로그인 이용자는 친구 관계를 본다" on public.friendships;
create policy "당사자만 친구 관계를 본다" on public.friendships for select
  to authenticated using ((select auth.uid()) in (user_a, user_b));

create or replace function public.friends_of(p_user_id uuid)
returns table (id uuid, nickname text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.avatar_url
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = p_user_id then f.user_b else f.user_a end
  where p_user_id in (f.user_a, f.user_b)
    and public.profile_visible(p_user_id)
  order by p.nickname;
$$;

-- ── 활동 통계: 비공개 프로필이면 null ──
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
  select case when not public.profile_visible(p_user_id) then null else jsonb_build_object(
    'streak', (select count(*) from ordered o, anchor a where o.day = a.day - o.n),
    'attendance_days', (select count(*) from days),
    'finished', (select count(*) from shelf where status = 'done'),
    'pages', (select coalesce(sum(pages), 0) from shelf_pages),
    'reading_seconds', (select coalesce(sum(seconds), 0) from sessions where activity = 'reading'),
    'tea_seconds', (select coalesce(sum(seconds), 0) from sessions where activity = 'tea'),
    'tea_sessions', (select count(*) from sessions where activity = 'tea')
  ) end;
$$;

-- ── 공개 프로필의 책·글: 프로필이 공개이고, 글은 공개로 지정한 것만 ──
create or replace function public.public_finished_books(p_user_id uuid)
returns table (id uuid, title text, author text, cover_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.title, b.author, b.cover_url
  from public.books b
  where b.user_id = p_user_id and b.status = 'done'
    and public.profile_visible(p_user_id)
  order by b.updated_at desc, b.id
  limit 50;
$$;

create or replace function public.public_tea_columns(p_user_id uuid)
returns table (
  id uuid,
  title text,
  excerpt text,
  tea_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.title, left(c.body, 120), c.tea_type, c.created_at
  from public.tea_columns c
  where c.user_id = p_user_id and c.is_public
    and public.profile_visible(p_user_id)
  order by c.created_at desc, c.id
  limit 50;
$$;

create or replace function public.public_tea_column(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  body text,
  tea_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.user_id, c.title, c.body, c.tea_type, c.created_at
  from public.tea_columns c
  where c.id = p_id and c.is_public
    and public.profile_visible(c.user_id);
$$;

create or replace function public.public_reading_logs(p_user_id uuid)
returns table (
  id uuid,
  title text,
  excerpt text,
  pages_read integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.book_title, left(r.body, 120), r.pages_read, r.created_at
  from public.reading_logs r
  where r.user_id = p_user_id and r.is_public
    and public.profile_visible(p_user_id)
  order by r.created_at desc, r.id
  limit 50;
$$;

create or replace function public.public_reading_log(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  body text,
  pages_read integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.user_id, r.book_title, r.body, r.pages_read, r.created_at
  from public.reading_logs r
  where r.id = p_id and r.is_public
    and public.profile_visible(r.user_id);
$$;

revoke execute on function public.public_reading_logs(uuid) from public, anon;
revoke execute on function public.public_reading_log(uuid) from public, anon;
grant execute on function public.public_reading_logs(uuid) to authenticated;
grant execute on function public.public_reading_log(uuid) to authenticated;
