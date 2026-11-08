-- ─────────────────────────────────────────────
-- 1:1 메시지(DM)와 차단 (소유: 웅싯, 명세 6.3 / 개발계획 2장 #6)
-- 정책
--   - 로그인한 누구에게나 대화를 시작할 수 있다. 자기 자신은 안 된다.
--   - 두 사람 사이 대화방은 1개 (user_a < user_b 정렬 + unique). 동시에 시작해도 같다.
--   - 어느 한쪽이라도 상대를 차단하면 새 대화 생성과 메시지 전송을 막는다.
--     기존 대화 기록은 두 사람 모두 계속 읽을 수 있다.
--   - 차단 목록은 차단한 본인만 본다. 차단당한 쪽에는 "보낼 수 없음"만 알린다.
-- ─────────────────────────────────────────────

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dm_threads_ordered check (user_a < user_b),
  constraint dm_threads_pair_key unique (user_a, user_b)
);

create index dm_threads_user_b_idx on public.dm_threads (user_b);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (
    char_length(body) between 1 and 1000 and btrim(body, E' \t\r\n') <> ''
  ),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  constraint dm_messages_sender_client_key unique (sender_id, client_id)
);

create index dm_messages_thread_created_idx
  on public.dm_messages (thread_id, created_at desc, id desc);

-- 작성 시각은 서버 시각만 쓴다 (group_messages와 같은 함수)
create trigger dm_messages_set_created_at
  before insert on public.dm_messages
  for each row execute function public.set_message_created_at();

-- ── 권한 확인 함수 (security definer: 다른 테이블 RLS를 우회해 판단만 한다) ──

-- 두 사람 사이에 어느 방향이든 차단이 있는가.
-- 호출자 본인이 두 사람 중 하나일 때만 답한다 (제3자가 남들의 차단 관계를 알아내지 못하게).
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) in (p_a, p_b)
    and exists (
      select 1 from public.blocks
      where (blocker_id = p_a and blocked_id = p_b)
         or (blocker_id = p_b and blocked_id = p_a)
    );
$$;

create or replace function public.is_dm_participant(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dm_threads
    where id = p_thread_id and auth.uid() in (user_a, user_b)
  );
$$;

-- 지금 이 대화에 메시지를 보낼 수 있는가 (참여자이고 차단이 없을 때)
create or replace function public.dm_can_send(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dm_threads t
    where t.id = p_thread_id
      and auth.uid() in (t.user_a, t.user_b)
      and not public.is_blocked_between(t.user_a, t.user_b)
  );
$$;

-- 대화 시작: 이미 있으면 그 대화를, 없으면 새로 만든다. created로 신규 여부를 알려 준다.
-- 오류 코드: 22023 자기 자신, P0002 없는 회원, P0001(hint=blocked) 차단
create or replace function public.start_dm(p_other uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  tid uuid;
begin
  if me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if p_other is null or p_other = me then
    raise exception 'cannot start a conversation with yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  a := least(me, p_other);
  b := greatest(me, p_other);

  select id into tid from public.dm_threads where user_a = a and user_b = b;
  if tid is not null then
    return jsonb_build_object('id', tid, 'created', false);
  end if;

  if public.is_blocked_between(me, p_other) then
    raise exception 'blocked' using errcode = 'P0001', hint = 'blocked';
  end if;

  insert into public.dm_threads (user_a, user_b)
  values (a, b)
  on conflict (user_a, user_b) do nothing
  returning id into tid;

  if tid is null then
    -- 상대가 같은 순간에 먼저 만들었다
    select id into tid from public.dm_threads where user_a = a and user_b = b;
    return jsonb_build_object('id', tid, 'created', false);
  end if;
  return jsonb_build_object('id', tid, 'created', true);
end;
$$;

-- DM 목록: 상대 프로필과 마지막 메시지, 최근 대화순. 호출자 권한(RLS)으로 실행한다.
create or replace function public.my_dm_threads()
returns table (
  id uuid,
  other_id uuid,
  other_nickname text,
  other_avatar_url text,
  last_body text,
  last_sender_id uuid,
  last_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    p.id,
    p.nickname,
    p.avatar_url,
    m.body,
    m.sender_id,
    m.created_at,
    t.created_at
  from public.dm_threads t
  join public.profiles p
    on p.id = case when t.user_a = (select auth.uid()) then t.user_b else t.user_a end
  left join lateral (
    select dm.body, dm.sender_id, dm.created_at
    from public.dm_messages dm
    where dm.thread_id = t.id
    order by dm.created_at desc, dm.id desc
    limit 1
  ) m on true
  where (select auth.uid()) in (t.user_a, t.user_b)
  order by coalesce(m.created_at, t.created_at) desc, t.id;
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
revoke execute on function public.is_dm_participant(uuid) from public, anon;
revoke execute on function public.dm_can_send(uuid) from public, anon;
revoke execute on function public.start_dm(uuid) from public, anon;
revoke execute on function public.my_dm_threads() from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
grant execute on function public.is_dm_participant(uuid) to authenticated;
grant execute on function public.dm_can_send(uuid) to authenticated;
grant execute on function public.start_dm(uuid) to authenticated;
grant execute on function public.my_dm_threads() to authenticated;

-- ── RLS ──
alter table public.blocks enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

create policy "본인 차단 목록만 조회" on public.blocks for select
  to authenticated using ((select auth.uid()) = blocker_id);
create policy "본인만 차단" on public.blocks for insert
  to authenticated with check ((select auth.uid()) = blocker_id);
create policy "본인만 차단 해제" on public.blocks for delete
  to authenticated using ((select auth.uid()) = blocker_id);

create policy "참여자만 대화 조회" on public.dm_threads for select
  to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy "본인이 참여하고 차단이 없는 대화만 생성" on public.dm_threads for insert
  to authenticated with check (
    (select auth.uid()) in (user_a, user_b)
    and not public.is_blocked_between(user_a, user_b)
  );

create policy "참여자만 메시지 조회" on public.dm_messages for select
  to authenticated using (public.is_dm_participant(thread_id));
create policy "참여자가 본인 이름으로, 차단이 없을 때만 전송" on public.dm_messages for insert
  to authenticated with check (
    (select auth.uid()) = sender_id and public.dm_can_send(thread_id)
  );

revoke all on table public.blocks, public.dm_threads, public.dm_messages from anon;
revoke update, truncate on table public.blocks from authenticated;
revoke update, delete, truncate on table public.dm_threads, public.dm_messages from authenticated;

alter publication supabase_realtime add table public.dm_messages;
