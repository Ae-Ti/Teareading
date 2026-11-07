-- ─────────────────────────────────────────────
-- 개인 독서기록·차 칼럼 (소유: 태일, 명세 3.1·3.2)
-- 작성자 본인만 조회·작성·수정·삭제. 공개 프로필에는 노출하지 않는다.
-- ─────────────────────────────────────────────
create table public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  book_title text not null check (char_length(trim(book_title)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tea_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reading_logs_user_created_idx on public.reading_logs (user_id, created_at desc);
create index tea_columns_user_created_idx on public.tea_columns (user_id, created_at desc);

create trigger reading_logs_set_updated_at
  before update on public.reading_logs
  for each row execute function public.set_updated_at();

create trigger tea_columns_set_updated_at
  before update on public.tea_columns
  for each row execute function public.set_updated_at();

alter table public.reading_logs enable row level security;
alter table public.tea_columns enable row level security;

create policy "본인 독서기록만 조회" on public.reading_logs for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "본인 독서기록만 작성" on public.reading_logs for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 독서기록만 수정" on public.reading_logs for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 독서기록만 삭제" on public.reading_logs for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "본인 차 칼럼만 조회" on public.tea_columns for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "본인 차 칼럼만 작성" on public.tea_columns for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 차 칼럼만 수정" on public.tea_columns for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 차 칼럼만 삭제" on public.tea_columns for delete
  to authenticated using ((select auth.uid()) = user_id);
