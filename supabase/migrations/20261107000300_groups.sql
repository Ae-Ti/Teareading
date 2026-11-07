-- ─────────────────────────────────────────────
-- 커뮤니티 모임 (소유: 태일, 명세 6.1)
-- 정책(개발계획 2장 #5): 로그인한 누구나 생성, 생성자 = 모임장, 승인 없이 가입, 모임장만 수정
-- ─────────────────────────────────────────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 40),
  description text not null default '' check (char_length(description) <= 500),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);
create index groups_created_idx on public.groups (created_at desc);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- 모임을 만들면 모임장을 멤버로 자동 등록
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- RLS에서 쓰는 권한 확인 함수 (security definer라 group_members RLS 재귀를 피한다)
-- 웅싯의 group_messages RLS에서도 is_group_member를 쓰면 된다.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  );
$$;

revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "로그인 사용자는 모임을 조회할 수 있다" on public.groups for select
  to authenticated using (true);
create policy "본인을 모임장으로 모임을 만들 수 있다" on public.groups for insert
  to authenticated with check ((select auth.uid()) = owner_id);
create policy "모임장만 모임을 수정할 수 있다" on public.groups for update
  to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "모임장만 모임을 삭제할 수 있다" on public.groups for delete
  to authenticated using ((select auth.uid()) = owner_id);

create policy "로그인 사용자는 모임 멤버를 조회할 수 있다" on public.group_members for select
  to authenticated using (true);
-- 가입: 본인을 일반 멤버로만 추가할 수 있다 (모임장 등록은 트리거가 한다)
create policy "본인만 일반 멤버로 가입할 수 있다" on public.group_members for insert
  to authenticated with check ((select auth.uid()) = user_id and role = 'member');
-- 탈퇴는 본인이, 내보내기는 모임장이. 모임장 자신은 빠질 수 없다.
create policy "탈퇴 또는 모임장의 내보내기" on public.group_members for delete
  to authenticated using (
    role = 'member'
    and ((select auth.uid()) = user_id or public.is_group_owner(group_id))
  );
