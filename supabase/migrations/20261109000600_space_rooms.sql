-- ─────────────────────────────────────────────
-- 내 방 꾸미기 값 (소유: 태일, docs/taeil/space-pixel-prd.md 13장)
-- 허용 값과 잠금 해제 확인은 서버(lib/space/room.ts, app/space/actions.ts)에서 한다.
-- 내 방은 나만 들어오는 공간이다. 방문 기능을 만들 때 잠금/공개 값을 추가하고 기본값은 잠금으로 둔다.
-- ─────────────────────────────────────────────
create table public.space_rooms (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  style jsonb not null check (jsonb_typeof(style) = 'object' and octet_length(style::text) <= 128),
  updated_at timestamptz not null default now()
);

create trigger space_rooms_updated_at before update on public.space_rooms
  for each row execute function public.set_updated_at();

alter table public.space_rooms enable row level security;

create policy "본인 방만 조회" on public.space_rooms for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "본인 방만 저장" on public.space_rooms for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 방만 수정" on public.space_rooms for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
