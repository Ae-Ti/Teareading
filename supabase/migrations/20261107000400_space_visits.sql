-- ─────────────────────────────────────────────
-- 메타버스 공간 체류 기록 (소유: 태일, 명세 5.1)
-- "지금 누가 있나"는 Realtime Presence로 판단하고, 이 테이블은 체류 이력·분석용이다.
-- ─────────────────────────────────────────────
create table public.space_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  space_id text not null default 'teahouse',
  entered_at timestamptz not null default now(),
  left_at timestamptz,
  check (left_at is null or left_at >= entered_at)
);

create index space_visits_user_idx on public.space_visits (user_id, entered_at desc);

alter table public.space_visits enable row level security;

create policy "본인 체류 기록 조회" on public.space_visits for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "본인 체류 기록 작성" on public.space_visits for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 체류 기록 퇴장 처리" on public.space_visits for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
