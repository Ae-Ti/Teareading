-- ─────────────────────────────────────────────
-- 점검에서 나온 문제 수정 (태일, docs/taeil/to-woong.md "태일이 고친다")
-- 시험: tests/edge.db.test.ts, tests/e2e/edge-cases.spec.ts
-- 기존 행은 검사하지 않고(not valid) 새로 쓰는 값부터 막는다.
-- ─────────────────────────────────────────────

-- ── 보이지 않는 글자 ──
-- 점자 빈칸(U+2800)도 보이지 않는 글자로 본다 (20261109000800_board_visible_text.sql 대비 추가)
create or replace function public.has_visible_text(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(p_value, '[\s\u00A0\u00AD\u115F\u1160\u1680\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2800\u3000\u3164\uFEFF\uFFA0]', '', 'g') <> '';
$$;

-- 폭이 0인 문자·채움 문자. 닉네임에 섞으면 다른 사람과 같아 보인다.
create or replace function public.has_hidden_chars(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value ~ '[\u00AD\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]';
$$;

alter table public.profiles
  add constraint profiles_nickname_visible check (
    public.has_visible_text(nickname)
    and not public.has_hidden_chars(nickname)
    and nickname = btrim(nickname, E' \t\r\n\u00A0\u3000')
  ) not valid;
alter table public.groups
  add constraint groups_name_visible check (
    public.has_visible_text(name) and not public.has_hidden_chars(name)
  ) not valid;
alter table public.tea_columns
  add constraint tea_columns_title_visible check (public.has_visible_text(title)) not valid,
  add constraint tea_columns_body_visible check (public.has_visible_text(body)) not valid;
alter table public.reading_logs
  add constraint reading_logs_body_visible check (public.has_visible_text(body)) not valid;
alter table public.books
  add constraint books_title_visible check (public.has_visible_text(title)) not valid;

-- ── 서버가 정하는 값: 이용자가 직접 요청하면 무시한다 ──
-- security definer 함수와 관리자 키(service_role)로 쓰는 값은 그대로 둔다.
create or replace function public.keep_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_at := now();
    else
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_created_at before insert or update on public.profiles
  for each row execute function public.keep_created_at();
create trigger tea_columns_keep_created_at before insert or update on public.tea_columns
  for each row execute function public.keep_created_at();
create trigger reading_logs_keep_created_at before insert or update on public.reading_logs
  for each row execute function public.keep_created_at();
create trigger books_keep_created_at before insert or update on public.books
  for each row execute function public.keep_created_at();
create trigger groups_keep_created_at before insert or update on public.groups
  for each row execute function public.keep_created_at();

-- 찻집에서 맺은 모임 표시는 모임맺기 수락(respond_live_request)으로만 켠다
create or replace function public.keep_group_from_space()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.from_space := case when tg_op = 'UPDATE' then old.from_space else false end;
  end if;
  return new;
end;
$$;
create trigger groups_keep_from_space before insert or update on public.groups
  for each row execute function public.keep_group_from_space();

-- 차 칼럼 수정일은 내용이 바뀔 때만 (공개 전환은 "수정됨"이 아님)
drop trigger tea_columns_set_updated_at on public.tea_columns;
create trigger tea_columns_set_updated_at
  before update on public.tea_columns
  for each row
  when (
    old.title is distinct from new.title
    or old.body is distinct from new.body
    or old.tea_type is distinct from new.tea_type
  )
  execute function public.set_updated_at();

-- 글 내용 블록 크기 (본문 1만 자 + 사진 30장 주소를 넉넉히 담는 크기)
alter table public.posts
  add constraint posts_content_size check (
    content is null or octet_length(content::text) <= 65536
  ) not valid;

-- ── 차단: 친구 관계와 둘 사이의 대기 요청을 지운다 (해제해도 복구하지 않는다) ──
create or replace function public.blocks_cut_ties()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id)
    and user_b = greatest(new.blocker_id, new.blocked_id);
  delete from public.live_requests
  where status = 'pending'
    and ((from_user = new.blocker_id and to_user = new.blocked_id)
      or (from_user = new.blocked_id and to_user = new.blocker_id));
  return null;
end;
$$;
create trigger blocks_cut_ties after insert on public.blocks
  for each row execute function public.blocks_cut_ties();
-- 이미 차단한 관계의 친구는 지금 정리한다
delete from public.friendships f
using public.blocks b
where f.user_a = least(b.blocker_id, b.blocked_id)
  and f.user_b = greatest(b.blocker_id, b.blocked_id);

-- 모임이 사라지면 그 모임 가입 요청도 지운다
create or replace function public.groups_drop_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.live_requests
  where kind = 'group_join' and status = 'pending'
    and payload ->> 'group_id' = old.id::text;
  return null;
end;
$$;
create trigger groups_drop_requests after delete on public.groups
  for each row execute function public.groups_drop_requests();
delete from public.live_requests r
where r.kind = 'group_join' and r.status = 'pending'
  and not exists (select 1 from public.groups g where g.id::text = r.payload ->> 'group_id');

-- ── 실시간 요청 보내기 ──
-- 바뀐 점 (20261110000300_social.sql 대비):
--   두 사람 사이 요청은 한 번에 하나씩 처리한다 (동시에 서로 친구 신청하면 친구가 된다)
--   차단당한 쪽에는 차단 사실을 드러내지 않는다 (hint 'unavailable'), 내가 차단했으면 hint 'blocked'
--   같은 사람에게 같은 종류의 요청이 거절되면 24시간 뒤에 다시 보낼 수 있다 (hint 'cooldown')
--   잘못된 모임 ID는 '모임 없음'으로 답한다
create or replace function public.create_live_request(
  p_kind text,
  p_to uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_to uuid := p_to;
  v_payload jsonb := '{}'::jsonb;
  v_group uuid;
  v_group_text text;
  v_name text;
  v_description text;
  v_id uuid;
  v_status text;
begin
  if me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if p_kind not in ('friend', 'dm', 'group_create', 'group_join') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;

  if p_kind = 'group_join' then
    v_group_text := coalesce(p_payload ->> 'group_id', '');
    if v_group_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'group not found' using errcode = 'P0002';
    end if;
    v_group := v_group_text::uuid;
    select g.owner_id, g.name into v_to, v_name from public.groups g where g.id = v_group;
    if v_to is null then
      raise exception 'group not found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.group_members m where m.group_id = v_group and m.user_id = me) then
      raise exception 'already a member' using errcode = '22023';
    end if;
    if exists (select 1 from public.group_bans b where b.group_id = v_group and b.user_id = me) then
      raise exception 'banned' using errcode = '42501';
    end if;
    v_payload := jsonb_build_object('group_id', v_group, 'name', v_name);
  elsif p_kind = 'group_create' then
    v_name := btrim(coalesce(p_payload ->> 'name', ''));
    v_description := btrim(coalesce(p_payload ->> 'description', ''));
    if char_length(v_name) not between 2 and 40 or char_length(v_description) > 500
       or not public.has_visible_text(v_name) or public.has_hidden_chars(v_name) then
      raise exception 'invalid group' using errcode = '22023';
    end if;
    v_payload := jsonb_build_object('name', v_name, 'description', v_description);
  end if;

  if v_to is null or v_to = me or not exists (select 1 from public.profiles p where p.id = v_to) then
    raise exception 'invalid target' using errcode = '22023';
  end if;

  -- 두 사람 사이 요청은 한 번에 하나씩 처리한다
  perform pg_advisory_xact_lock(
    hashtextextended('live_request:' || least(me, v_to)::text || ':' || greatest(me, v_to)::text, 0)
  );

  if exists (select 1 from public.blocks b where b.blocker_id = me and b.blocked_id = v_to) then
    raise exception 'blocked' using errcode = 'P0001', hint = 'blocked';
  end if;
  if exists (select 1 from public.blocks b where b.blocker_id = v_to and b.blocked_id = me) then
    raise exception 'unavailable' using errcode = 'P0001', hint = 'unavailable';
  end if;
  if exists (
    select 1 from public.live_requests r
    where r.from_user = me and r.to_user = v_to and r.kind = p_kind
      and r.status = 'rejected' and r.responded_at > now() - interval '24 hours'
  ) then
    raise exception 'cooldown' using errcode = 'P0001', hint = 'cooldown';
  end if;

  if p_kind = 'friend' then
    if exists (
      select 1 from public.friendships f
      where f.user_a = least(me, v_to) and f.user_b = greatest(me, v_to)
    ) then
      return jsonb_build_object('status', 'accepted');
    end if;
    -- 상대가 먼저 신청해 둔 상태면 바로 친구가 된다
    update public.live_requests
    set status = 'accepted', responded_at = now()
    where from_user = v_to and to_user = me and kind = 'friend' and status = 'pending'
    returning id into v_id;
    if v_id is not null then
      insert into public.friendships (user_a, user_b)
      values (least(me, v_to), greatest(me, v_to))
      on conflict do nothing;
      return jsonb_build_object('id', v_id, 'status', 'accepted');
    end if;
  end if;

  update public.live_requests
  set status = 'expired'
  where from_user = me and to_user = v_to and kind = p_kind
    and status = 'pending' and expires_at is not null and expires_at <= now();

  insert into public.live_requests (kind, from_user, to_user, payload, expires_at)
  values (
    p_kind, me, v_to, v_payload,
    case when p_kind in ('dm', 'group_create') then now() + interval '5 minutes' end
  )
  on conflict (from_user, to_user, kind) where status = 'pending' do nothing
  returning id, status into v_id, v_status;
  if v_id is null then
    select id, status into v_id, v_status from public.live_requests
    where from_user = me and to_user = v_to and kind = p_kind and status = 'pending';
  end if;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;
