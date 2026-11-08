-- ─────────────────────────────────────────────
-- 찻집 캐릭터 꾸미기 (소유: 태일, docs/taeil/space-pixel-prd.md 7·9장)
-- 허용 값 검사는 서버(lib/space/look.ts parseLook)에서 하고, DB는 모양과 크기만 막는다.
-- 다른 사람 캐릭터는 Realtime Presence로 받으므로 조회는 본인만 허용한다.
-- ─────────────────────────────────────────────
create table public.space_avatars (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  look jsonb not null check (jsonb_typeof(look) = 'object' and octet_length(look::text) <= 512),
  updated_at timestamptz not null default now()
);

create trigger space_avatars_updated_at before update on public.space_avatars
  for each row execute function public.set_updated_at();

alter table public.space_avatars enable row level security;

create policy "본인 캐릭터 조회" on public.space_avatars for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "본인 캐릭터 저장" on public.space_avatars for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 캐릭터 수정" on public.space_avatars for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
