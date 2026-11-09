-- ─────────────────────────────────────────────
-- 메시지 탭: 채팅방별 상단 고정·알림 끄기·나가기·안 읽은 개수 (소유: 웅싯)
-- 단체 채팅과 1:1 대화를 kind + room_id로 함께 다룬다.
--
-- 알림 끄기: 내비게이션의 빨간 개수에서 뺀다 (안 읽은 개수는 목록에 계속 보인다).
-- 1:1 나가기: 내 목록에서만 사라진다. 상대가 새 메시지를 보내거나 내가 대화를 다시 열면 돌아온다.
-- 단체 채팅 나가기: 모임 탈퇴와 같다 (앱에서 group_members 삭제).
-- ─────────────────────────────────────────────
create table public.chat_room_prefs (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('group', 'dm')),
  room_id uuid not null,
  pinned_at timestamptz,
  muted boolean not null default false,
  last_read_at timestamptz,
  left_at timestamptz,
  primary key (user_id, kind, room_id)
);

create index chat_room_prefs_room_idx on public.chat_room_prefs (kind, room_id);

alter table public.chat_room_prefs enable row level security;
create policy "본인 채팅방 설정만 조회" on public.chat_room_prefs for select
  to authenticated using ((select auth.uid()) = user_id);
-- 쓰기는 참여 여부를 확인하는 아래 함수로만 한다
revoke all on table public.chat_room_prefs from anon;
revoke insert, update, delete, truncate on table public.chat_room_prefs from authenticated;

create or replace function public.can_access_chat(p_kind text, p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'group' then public.is_group_member(p_room_id)
    when 'dm' then public.is_dm_participant(p_room_id)
    else false
  end;
$$;

-- 넘기지 않은(null) 값은 그대로 둔다
create or replace function public.set_chat_pref(
  p_kind text,
  p_room_id uuid,
  p_pinned boolean default null,
  p_muted boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_chat(p_kind, p_room_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  insert into public.chat_room_prefs as p (user_id, kind, room_id, pinned_at, muted)
  values (
    auth.uid(), p_kind, p_room_id,
    case when p_pinned then now() end,
    coalesce(p_muted, false)
  )
  on conflict (user_id, kind, room_id) do update set
    pinned_at = case
      when p_pinned is null then p.pinned_at
      when p_pinned then coalesce(p.pinned_at, now())
      else null
    end,
    muted = coalesce(p_muted, p.muted);
end;
$$;

-- 채팅방을 열어 읽음. 나갔던 1:1 대화도 다시 열면 목록에 돌아온다.
create or replace function public.mark_chat_read(p_kind text, p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_chat(p_kind, p_room_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  insert into public.chat_room_prefs as p (user_id, kind, room_id, last_read_at)
  values (auth.uid(), p_kind, p_room_id, now())
  on conflict (user_id, kind, room_id) do update set
    last_read_at = now(),
    left_at = null;
end;
$$;

-- 1:1 대화 나가기 (내 목록에서만 사라진다)
create or replace function public.leave_dm(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_chat('dm', p_thread_id) then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  insert into public.chat_room_prefs as p (user_id, kind, room_id, last_read_at, left_at)
  values (auth.uid(), 'dm', p_thread_id, now(), now())
  on conflict (user_id, kind, room_id) do update set
    last_read_at = now(),
    left_at = now(),
    pinned_at = null;
end;
$$;

-- 내 채팅방별 상태. 남이 보낸, 지워지지 않은, 읽은 시점(모임은 가입 시점) 이후 메시지를 센다.
-- 호출자 권한(RLS)으로 실행한다.
create or replace function public.my_chat_states()
returns table (
  kind text,
  room_id uuid,
  pinned_at timestamptz,
  muted boolean,
  unread integer,
  hidden boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with rooms as (
    select 'group'::text as kind, gm.group_id as room_id, gm.joined_at as base
    from public.group_members gm
    where gm.user_id = (select auth.uid())
    union all
    select 'dm'::text, t.id, null::timestamptz
    from public.dm_threads t
    where (select auth.uid()) in (t.user_a, t.user_b)
  ),
  state as (
    select r.kind, r.room_id, p.pinned_at, coalesce(p.muted, false) as muted, p.left_at,
      greatest(p.last_read_at, r.base) as since
    from rooms r
    left join public.chat_room_prefs p
      on p.user_id = (select auth.uid()) and p.kind = r.kind and p.room_id = r.room_id
  )
  select
    s.kind,
    s.room_id,
    s.pinned_at,
    s.muted,
    case s.kind
      when 'group' then (
        select count(*)::integer from public.group_messages m
        where m.group_id = s.room_id
          and m.sender_id <> (select auth.uid())
          and m.deleted_at is null
          and (s.since is null or m.created_at > s.since)
      )
      else (
        select count(*)::integer from public.dm_messages m
        where m.thread_id = s.room_id
          and m.sender_id <> (select auth.uid())
          and (s.since is null or m.created_at > s.since)
      )
    end,
    s.kind = 'dm' and s.left_at is not null and not exists (
      select 1 from public.dm_messages m
      where m.thread_id = s.room_id and m.created_at > s.left_at
    )
  from state s;
$$;

-- 내비게이션 빨간 개수: 알림을 끈 방과 목록에서 숨긴 방은 뺀다
create or replace function public.my_unread_total()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(s.unread), 0)::integer
  from public.my_chat_states() s
  where not s.muted and not s.hidden;
$$;

-- 방이 사라지거나 모임을 나가면 설정도 지운다 (다시 가입하면 새로 시작)
create or replace function public.cleanup_chat_prefs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'groups' then
    delete from public.chat_room_prefs where kind = 'group' and room_id = old.id;
  elsif tg_table_name = 'dm_threads' then
    delete from public.chat_room_prefs where kind = 'dm' and room_id = old.id;
  else
    delete from public.chat_room_prefs
    where kind = 'group' and room_id = old.group_id and user_id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger groups_cleanup_chat_prefs
  after delete on public.groups
  for each row execute function public.cleanup_chat_prefs();
create trigger dm_threads_cleanup_chat_prefs
  after delete on public.dm_threads
  for each row execute function public.cleanup_chat_prefs();
create trigger group_members_cleanup_chat_prefs
  after delete on public.group_members
  for each row execute function public.cleanup_chat_prefs();

revoke execute on function public.can_access_chat(text, uuid) from public, anon;
revoke execute on function public.set_chat_pref(text, uuid, boolean, boolean) from public, anon;
revoke execute on function public.mark_chat_read(text, uuid) from public, anon;
revoke execute on function public.leave_dm(uuid) from public, anon;
revoke execute on function public.my_chat_states() from public, anon;
revoke execute on function public.my_unread_total() from public, anon;
grant execute on function public.can_access_chat(text, uuid) to authenticated;
grant execute on function public.set_chat_pref(text, uuid, boolean, boolean) to authenticated;
grant execute on function public.mark_chat_read(text, uuid) to authenticated;
grant execute on function public.leave_dm(uuid) to authenticated;
grant execute on function public.my_chat_states() to authenticated;
grant execute on function public.my_unread_total() to authenticated;
