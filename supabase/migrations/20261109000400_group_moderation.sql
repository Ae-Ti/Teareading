-- ─────────────────────────────────────────────
-- 모임 운영: 부모임장, 메시지 차단(전송 제한), 메시지 삭제, 메시지 탭의 모임 채팅 목록 (소유: 웅싯)
-- 태일의 groups·group_members를 확장한다 (교차 수정).
--
-- 권한
--   모임장  : 부모임장 지정·해제, 강제 퇴장, 메시지 삭제, 메시지 차단·해제
--   부모임장: 메시지 삭제, 일반 멤버 메시지 차단·해제
--   부모임장은 모임당 1명. 새로 지정하면 기존 부모임장은 일반 멤버가 된다.
-- ─────────────────────────────────────────────

-- 역할에 부모임장(manager) 추가
alter table public.group_members drop constraint group_members_role_check;
alter table public.group_members
  add constraint group_members_role_check check (role in ('owner', 'manager', 'member'));
create unique index group_members_one_manager
  on public.group_members (group_id) where role = 'manager';

-- 호출자의 모임 내 역할 (없으면 null)
create or replace function public.my_group_role(p_group_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.group_members
  where group_id = p_group_id and user_id = auth.uid();
$$;

create or replace function public.is_group_moderator(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_group_role(p_group_id) in ('owner', 'manager'), false);
$$;

-- 탈퇴·강제 퇴장: 모임장이 아닌 사람은 스스로 나갈 수 있고, 모임장은 부모임장·멤버를 내보낼 수 있다
drop policy "탈퇴 또는 모임장의 내보내기" on public.group_members;
create policy "탈퇴 또는 모임장의 내보내기" on public.group_members for delete
  to authenticated using (
    role <> 'owner'
    and ((select auth.uid()) = user_id or public.is_group_owner(group_id))
  );

-- 부모임장 지정·해제 (모임장만)
create or replace function public.set_group_manager(
  p_group_id uuid,
  p_user_id uuid,
  p_manager boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  select role into target_role from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
  if target_role is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'owner role cannot change' using errcode = '22023';
  end if;

  if p_manager then
    update public.group_members set role = 'member'
    where group_id = p_group_id and role = 'manager' and user_id <> p_user_id;
    update public.group_members set role = 'manager'
    where group_id = p_group_id and user_id = p_user_id;
  else
    update public.group_members set role = 'member'
    where group_id = p_group_id and user_id = p_user_id and role = 'manager';
  end if;
end;
$$;

-- ── 메시지 차단(전송 제한) ──
-- 나갔다 다시 들어와도 유지된다. 회원이 지워지면 함께 지워진다.
create table public.group_mutes (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_mutes enable row level security;
-- 모임 멤버는 누가 제한됐는지 볼 수 있다 (본인 입력창 안내, 관리 화면 표시)
create policy "모임 멤버만 전송 제한 목록 조회" on public.group_mutes for select
  to authenticated using (public.is_group_member(group_id));
revoke all on table public.group_mutes from anon;
revoke insert, update, delete, truncate on table public.group_mutes from authenticated;

create or replace function public.is_group_muted(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_mutes
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

-- 모임장은 부모임장·멤버를, 부모임장은 일반 멤버만 제한할 수 있다. 모임장과 자기 자신은 제한할 수 없다.
create or replace function public.set_group_mute(
  p_group_id uuid,
  p_user_id uuid,
  p_muted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_role text := public.my_group_role(p_group_id);
  target_role text;
begin
  if my_role is null or my_role not in ('owner', 'manager') then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  select role into target_role from public.group_members
  where group_id = p_group_id and user_id = p_user_id;
  if target_role is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if p_user_id = auth.uid() or target_role = 'owner'
     or (my_role = 'manager' and target_role <> 'member') then
    raise exception 'cannot mute this member' using errcode = '22023';
  end if;

  if p_muted then
    insert into public.group_mutes (group_id, user_id, muted_by)
    values (p_group_id, p_user_id, auth.uid())
    on conflict (group_id, user_id) do nothing;
  else
    delete from public.group_mutes
    where group_id = p_group_id and user_id = p_user_id;
  end if;
end;
$$;

-- ── 메시지 삭제 (모임장·부모임장) ──
-- 내용을 지우고 "삭제된 메시지"로 남긴다. 실시간 UPDATE로 다른 사람 화면에서도 바로 바뀐다.
alter table public.group_messages
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

alter table public.group_messages drop constraint group_messages_body_check;
alter table public.group_messages add constraint group_messages_body_check check (
  char_length(body) <= 1000
  and (deleted_at is not null or (char_length(body) >= 1 and btrim(body, E' \t\r\n') <> ''))
);

-- 전송: 멤버 + 본인 이름 + 전송 제한 아님 + 삭제 상태로 보낼 수 없음
drop policy "모임 멤버만 본인 이름으로 메시지를 보낼 수 있다" on public.group_messages;
create policy "모임 멤버만 본인 이름으로 메시지를 보낼 수 있다" on public.group_messages for insert
  to authenticated with check (
    (select auth.uid()) = sender_id
    and public.is_group_member(group_id)
    and not public.is_group_muted(group_id)
    and deleted_at is null
    and deleted_by is null
  );

create or replace function public.delete_group_message(p_message_id uuid)
returns public.group_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_row public.group_messages;
begin
  select group_id into v_group from public.group_messages where id = p_message_id;
  if v_group is null then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  if not public.is_group_moderator(v_group) then
    raise exception 'moderator only' using errcode = '42501';
  end if;
  update public.group_messages
  set body = '',
      deleted_at = coalesce(deleted_at, now()),
      deleted_by = coalesce(deleted_by, auth.uid())
  where id = p_message_id
  returning * into v_row;
  return v_row;
end;
$$;

-- ── 메시지 탭: 내가 참여한 모임의 단체 채팅방 (마지막 메시지 순) ──
create or replace function public.my_group_chats()
returns table (
  group_id uuid,
  name text,
  member_count integer,
  last_body text,
  last_deleted boolean,
  last_sender_id uuid,
  last_sender_nickname text,
  last_at timestamptz,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    g.name,
    (select count(*)::integer from public.group_members c where c.group_id = g.id),
    last.body,
    last.deleted_at is not null,
    last.sender_id,
    last.nickname,
    last.created_at,
    gm.joined_at
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  left join lateral (
    select m.body, m.deleted_at, m.sender_id, p.nickname, m.created_at
    from public.group_messages m
    join public.profiles p on p.id = m.sender_id
    where m.group_id = g.id
    order by m.created_at desc, m.id desc
    limit 1
  ) last on true
  where gm.user_id = (select auth.uid())
  order by coalesce(last.created_at, gm.joined_at) desc, g.id;
$$;

revoke execute on function public.my_group_role(uuid) from public, anon;
revoke execute on function public.is_group_moderator(uuid) from public, anon;
revoke execute on function public.set_group_manager(uuid, uuid, boolean) from public, anon;
revoke execute on function public.is_group_muted(uuid) from public, anon;
revoke execute on function public.set_group_mute(uuid, uuid, boolean) from public, anon;
revoke execute on function public.delete_group_message(uuid) from public, anon;
revoke execute on function public.my_group_chats() from public, anon;
grant execute on function public.my_group_role(uuid) to authenticated;
grant execute on function public.is_group_moderator(uuid) to authenticated;
grant execute on function public.set_group_manager(uuid, uuid, boolean) to authenticated;
grant execute on function public.is_group_muted(uuid) to authenticated;
grant execute on function public.set_group_mute(uuid, uuid, boolean) to authenticated;
grant execute on function public.delete_group_message(uuid) to authenticated;
grant execute on function public.my_group_chats() to authenticated;
