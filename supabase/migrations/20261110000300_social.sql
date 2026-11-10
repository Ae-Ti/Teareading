-- ─────────────────────────────────────────────
-- 댓글 추천·대댓글, 블록형 글, 친구, 접속 중 표시, 실시간 요청(수락/거절) (소유: 웅싯)
-- ─────────────────────────────────────────────

-- ── 댓글: 대댓글(1단계까지)과 추천 ──
alter table public.post_comments
  add column parent_id uuid references public.post_comments (id) on delete cascade,
  add column like_count integer not null default 0 check (like_count >= 0);
create index post_comments_parent_idx on public.post_comments (parent_id);

create or replace function public.post_comments_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_post uuid;
  v_parent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select post_id, parent_id into v_post, v_parent
  from public.post_comments where id = new.parent_id;
  if v_post is null then
    raise exception 'parent not found' using errcode = '23503';
  end if;
  if v_parent is not null or v_post <> new.post_id then
    raise exception 'replies can only go one level deep' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger post_comments_check_parent
  before insert on public.post_comments
  for each row execute function public.post_comments_check_parent();

-- 수정일은 본문이 바뀔 때만 (추천 수 변화는 "수정됨"이 아님)
drop trigger post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row
  when (old.body is distinct from new.body)
  execute function public.set_updated_at();

grant insert (parent_id) on table public.post_comments to authenticated;

create table public.comment_likes (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on public.comment_likes (user_id);

create or replace function public.comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.post_comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.post_comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_count
  after insert or delete on public.comment_likes
  for each row execute function public.comment_likes_count();

alter table public.comment_likes enable row level security;
create policy "내 댓글 추천 여부만 본다" on public.comment_likes for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "남의 댓글을 본인 이름으로 추천" on public.comment_likes for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.post_comments c
      where c.id = comment_id and c.author_id = (select auth.uid())
    )
  );
create policy "본인 댓글 추천만 취소" on public.comment_likes for delete
  to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.comment_likes from anon;
revoke update on table public.comment_likes from authenticated;

-- ── 블록형 글: [{type:"text",text}, {type:"image",url}] ──
alter table public.posts
  add column content jsonb check (content is null or jsonb_typeof(content) = 'array');
grant insert (content), update (content) on table public.posts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/webp']);

create or replace function public.my_post_image_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects
  where bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text;
$$;
revoke execute on function public.my_post_image_count() from public, anon;
grant execute on function public.my_post_image_count() to authenticated;

create policy "본인 글 이미지 조회" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "본인 글 이미지 업로드" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
    and public.my_post_image_count() < 500
  );
create policy "본인 글 이미지 삭제" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 찻집에서 맺은 모임: 캐릭터 아래에 이름을 보여 준다 ──
alter table public.groups add column from_space boolean not null default false;

-- ── 친구 ──
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_ordered check (user_a < user_b)
);
create index friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;
-- 친구 목록은 공개 프로필에 보인다
create policy "로그인 이용자는 친구 관계를 본다" on public.friendships for select
  to authenticated using (true);
create policy "당사자만 친구를 끊는다" on public.friendships for delete
  to authenticated using ((select auth.uid()) in (user_a, user_b));
revoke all on table public.friendships from anon;
revoke insert, update, truncate on table public.friendships from authenticated;

create or replace function public.friends_of(p_user_id uuid)
returns table (id uuid, nickname text, avatar_url text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.nickname, p.avatar_url
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = p_user_id then f.user_b else f.user_a end
  where p_user_id in (f.user_a, f.user_b)
  order by p.nickname;
$$;
revoke execute on function public.friends_of(uuid) from public, anon;
grant execute on function public.friends_of(uuid) to authenticated;

-- ── 접속 중 표시: 친구에게만 보이도록 함수로만 읽는다 ──
create table public.user_heartbeats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.user_heartbeats enable row level security;
revoke all on table public.user_heartbeats from anon, authenticated;

create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_heartbeats (user_id, last_seen_at)
  select auth.uid(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_seen_at = now();
$$;

-- 지금 접속 중인 친구와 오늘의 독서·다도 시간 (진행 중인 타이머 포함)
create or replace function public.my_online_friends()
returns table (
  id uuid,
  nickname text,
  avatar_url text,
  reading_seconds integer,
  tea_seconds integer,
  activity text
)
language sql
stable
security definer
set search_path = ''
as $$
  with friends as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as id
    from public.friendships f
    where auth.uid() in (f.user_a, f.user_b)
  ),
  sessions as (
    select
      t.user_id,
      t.activity,
      t.status,
      t.paused_at,
      greatest(
        extract(epoch from coalesce(t.ended_at, t.paused_at, now()) - t.started_at) - t.paused_seconds,
        0
      )::integer as seconds
    from public.timer_sessions t
    join friends f on f.id = t.user_id
    where t.status = 'running'
       or (t.status = 'completed'
           and (t.ended_at at time zone 'Asia/Seoul')::date
               = (now() at time zone 'Asia/Seoul')::date)
  )
  select
    p.id,
    p.nickname,
    p.avatar_url,
    coalesce((select sum(s.seconds) from sessions s where s.user_id = p.id and s.activity = 'reading'), 0)::integer,
    coalesce((select sum(s.seconds) from sessions s where s.user_id = p.id and s.activity = 'tea'), 0)::integer,
    (select s.activity from sessions s
     where s.user_id = p.id and s.status = 'running' and s.paused_at is null limit 1)
  from friends f
  join public.user_heartbeats h on h.user_id = f.id and h.last_seen_at > now() - interval '90 seconds'
  join public.profiles p on p.id = f.id
  order by p.nickname;
$$;

revoke execute on function public.touch_presence() from public, anon;
revoke execute on function public.my_online_friends() from public, anon;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.my_online_friends() to authenticated;

-- ── 실시간 요청: 상대가 수락/거절하는 요청 ──
-- dm(1:1 대화), group_create(찻집 모임맺기)는 상대가 지금 있어야 해서 5분 뒤 만료된다.
-- friend(친구), group_join(모임 들어가기)은 상대가 나중에 접속해도 볼 수 있게 만료가 없다.
create table public.live_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('friend', 'dm', 'group_create', 'group_join')),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'expired')),
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  constraint live_requests_not_self check (from_user <> to_user)
);
create unique index live_requests_one_pending
  on public.live_requests (from_user, to_user, kind) where status = 'pending';
create index live_requests_to_idx on public.live_requests (to_user, status);

alter table public.live_requests enable row level security;
create policy "당사자만 요청을 본다" on public.live_requests for select
  to authenticated using ((select auth.uid()) in (from_user, to_user));
revoke all on table public.live_requests from anon;
revoke insert, update, delete, truncate on table public.live_requests from authenticated;
alter publication supabase_realtime add table public.live_requests;

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
    v_group := (p_payload ->> 'group_id')::uuid;
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
    if char_length(v_name) not between 2 and 40 or char_length(v_description) > 500 then
      raise exception 'invalid group' using errcode = '22023';
    end if;
    v_payload := jsonb_build_object('name', v_name, 'description', v_description);
  end if;

  if v_to is null or v_to = me or not exists (select 1 from public.profiles p where p.id = v_to) then
    raise exception 'invalid target' using errcode = '22023';
  end if;
  if public.is_blocked_between(me, v_to) then
    raise exception 'blocked' using errcode = 'P0001', hint = 'blocked';
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

create or replace function public.respond_live_request(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.live_requests;
  v_result jsonb := '{}'::jsonb;
  v_group uuid;
begin
  select * into r from public.live_requests where id = p_id and to_user = me for update;
  if r.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    return jsonb_build_object('status', r.status, 'result', r.result);
  end if;
  if r.expires_at is not null and r.expires_at <= now() then
    update public.live_requests set status = 'expired', responded_at = now() where id = p_id;
    return jsonb_build_object('status', 'expired');
  end if;
  if not p_accept then
    update public.live_requests set status = 'rejected', responded_at = now() where id = p_id;
    return jsonb_build_object('status', 'rejected');
  end if;
  if public.is_blocked_between(me, r.from_user) then
    raise exception 'blocked' using errcode = 'P0001', hint = 'blocked';
  end if;

  if r.kind = 'friend' then
    insert into public.friendships (user_a, user_b)
    values (least(me, r.from_user), greatest(me, r.from_user))
    on conflict do nothing;
  elsif r.kind = 'dm' then
    v_result := jsonb_build_object('thread_id', public.start_dm(r.from_user) ->> 'id');
  elsif r.kind = 'group_create' then
    insert into public.groups (name, description, owner_id, from_space)
    values (r.payload ->> 'name', coalesce(r.payload ->> 'description', ''), r.from_user, true)
    returning id into v_group;
    insert into public.group_members (group_id, user_id) values (v_group, me);
    v_result := jsonb_build_object('group_id', v_group, 'name', r.payload ->> 'name');
  else
    v_group := (r.payload ->> 'group_id')::uuid;
    if not exists (select 1 from public.groups g where g.id = v_group and g.owner_id = me) then
      raise exception 'owner only' using errcode = '42501';
    end if;
    if exists (select 1 from public.group_bans b where b.group_id = v_group and b.user_id = r.from_user) then
      raise exception 'banned' using errcode = '42501';
    end if;
    insert into public.group_members (group_id, user_id)
    values (v_group, r.from_user)
    on conflict do nothing;
    v_result := jsonb_build_object('group_id', v_group, 'name', r.payload ->> 'name');
  end if;

  update public.live_requests
  set status = 'accepted', result = v_result, responded_at = now()
  where id = p_id;
  return jsonb_build_object('status', 'accepted', 'result', v_result);
end;
$$;

-- 나에게 온, 아직 답하지 않은 요청
create or replace function public.my_pending_requests()
returns table (
  id uuid,
  kind text,
  from_user uuid,
  from_nickname text,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.kind, r.from_user, p.nickname, r.payload, r.created_at
  from public.live_requests r
  join public.profiles p on p.id = r.from_user
  where r.to_user = (select auth.uid())
    and r.status = 'pending'
    and (r.expires_at is null or r.expires_at > now())
  order by r.created_at;
$$;

revoke execute on function public.create_live_request(text, uuid, jsonb) from public, anon;
revoke execute on function public.respond_live_request(uuid, boolean) from public, anon;
revoke execute on function public.my_pending_requests() from public, anon;
grant execute on function public.create_live_request(text, uuid, jsonb) to authenticated;
grant execute on function public.respond_live_request(uuid, boolean) to authenticated;
grant execute on function public.my_pending_requests() to authenticated;
