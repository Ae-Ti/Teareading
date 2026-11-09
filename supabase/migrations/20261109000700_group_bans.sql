-- ─────────────────────────────────────────────
-- 강제 퇴장 기록 (소유: 웅싯, 태일 D6 점검 10장 4번)
-- 모임장이 내보낸 사람은 모임장이 허용하기 전까지 다시 가입할 수 없다.
-- 스스로 나간 사람은 자유롭게 다시 가입할 수 있다.
-- ─────────────────────────────────────────────
create table public.group_bans (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  banned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_bans enable row level security;

-- 모임장은 목록을 보고, 내보내진 본인은 자기 기록만 본다 (가입 버튼 대신 안내를 보여 주기 위해)
create policy "모임장과 본인만 퇴장 기록 조회" on public.group_bans for select
  to authenticated using (
    public.is_group_owner(group_id) or (select auth.uid()) = user_id
  );
-- 재가입 허용 = 기록 삭제 (모임장만)
create policy "모임장만 재가입 허용" on public.group_bans for delete
  to authenticated using (public.is_group_owner(group_id));

revoke all on table public.group_bans from anon;
revoke insert, update, truncate on table public.group_bans from authenticated;

create or replace function public.is_group_banned(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_bans
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_group_banned(uuid) from public, anon;
grant execute on function public.is_group_banned(uuid) to authenticated;

-- 남이 멤버를 지웠을 때(= 강제 퇴장)만 기록한다. 내보내는 경로가 여러 곳이어도 빠지지 않게 트리거로 둔다.
-- 제외: 본인 탈퇴, 로그인 없는 운영 작업, 모임 자체가 지워지면서 멤버가 함께 지워지는 경우
create or replace function public.record_group_kick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id then
    return null;
  end if;
  if not exists (select 1 from public.groups where id = old.group_id) then
    return null;
  end if;
  insert into public.group_bans (group_id, user_id, banned_by)
  values (old.group_id, old.user_id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return null;
end;
$$;

create trigger group_members_record_kick
  after delete on public.group_members
  for each row execute function public.record_group_kick();

drop policy "본인만 일반 멤버로 가입할 수 있다" on public.group_members;
create policy "본인만 일반 멤버로 가입할 수 있다" on public.group_members for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and role = 'member'
    and not public.is_group_banned(group_id)
  );
