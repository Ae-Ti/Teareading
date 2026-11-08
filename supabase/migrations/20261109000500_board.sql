-- ─────────────────────────────────────────────
-- 게시판 (소유: 웅싯)
-- 글: 말머리·제목·본문·작성자·등록일·수정일·조회수·추천수·댓글수
-- 로그인한 이용자는 모두 읽을 수 있고, 글·댓글은 작성자만 수정·삭제한다.
-- 조회·추천·댓글 수는 트리거와 함수만 바꾼다 (이용자가 직접 숫자를 바꿀 수 없음).
-- ─────────────────────────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null default 'free' check (category in ('free', 'question', 'book', 'tea')),
  title text not null check (char_length(btrim(title)) between 2 and 100),
  body text not null check (
    char_length(body) between 1 and 10000 and btrim(body, E' \t\r\n') <> ''
  ),
  view_count integer not null default 0 check (view_count >= 0),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_created_idx on public.posts (created_at desc, id desc);
create index posts_category_created_idx on public.posts (category, created_at desc);
create index posts_likes_idx on public.posts (like_count desc, created_at desc);
create index posts_views_idx on public.posts (view_count desc, created_at desc);
create index posts_author_idx on public.posts (author_id);

-- 수정일은 말머리·제목·본문이 바뀔 때만 갱신한다 (조회·추천·댓글 수 변화는 "수정됨"이 아님)
create or replace function public.posts_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.category is distinct from old.category then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.posts_touch_updated_at();

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (
    char_length(body) between 1 and 1000 and btrim(body, E' \t\r\n') <> ''
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);

create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row execute function public.set_updated_at();

-- 조회 기록: 같은 사람이 같은 날(KST) 여러 번 열어도 1번만 센다
create table public.post_views (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (post_id, user_id, day)
);

-- ── 숫자 갱신 (security definer: 이용자에게는 숫자 열 수정 권한이 없다) ──
create or replace function public.post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.post_likes_count();

create or replace function public.post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_comments_count
  after insert or delete on public.post_comments
  for each row execute function public.post_comments_count();

-- 조회수 1 올리기 (하루 1번). 새로 센 경우 true
create or replace function public.record_post_view(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  insert into public.post_views (post_id, user_id, day)
  select p.id, auth.uid(), (now() at time zone 'Asia/Seoul')::date
  from public.posts p where p.id = p_post_id
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.posts set view_count = view_count + 1 where id = p_post_id;
  end if;
  return inserted > 0;
end;
$$;

revoke execute on function public.record_post_view(uuid) from public, anon;
grant execute on function public.record_post_view(uuid) to authenticated;

-- ── RLS ──
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_views enable row level security;

create policy "로그인 이용자는 글을 읽는다" on public.posts for select
  to authenticated using (true);
create policy "본인 이름으로 글을 쓴다" on public.posts for insert
  to authenticated with check ((select auth.uid()) = author_id);
create policy "작성자만 글을 고친다" on public.posts for update
  to authenticated using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
create policy "작성자만 글을 지운다" on public.posts for delete
  to authenticated using ((select auth.uid()) = author_id);

-- 쓰기·고치기는 말머리·제목·본문만 (작성자·숫자·날짜는 서버가 정한다)
revoke insert, update on table public.posts from authenticated;
grant insert (category, title, body) on table public.posts to authenticated;
grant update (category, title, body) on table public.posts to authenticated;

create policy "내 추천 여부만 본다" on public.post_likes for select
  to authenticated using ((select auth.uid()) = user_id);
-- 자기 글은 추천할 수 없다
create policy "남의 글을 본인 이름으로 추천" on public.post_likes for insert
  to authenticated with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid())
    )
  );
create policy "본인 추천만 취소" on public.post_likes for delete
  to authenticated using ((select auth.uid()) = user_id);
revoke update on table public.post_likes from authenticated;

create policy "로그인 이용자는 댓글을 읽는다" on public.post_comments for select
  to authenticated using (true);
create policy "본인 이름으로 댓글을 쓴다" on public.post_comments for insert
  to authenticated with check ((select auth.uid()) = author_id);
create policy "작성자만 댓글을 고친다" on public.post_comments for update
  to authenticated using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
create policy "작성자만 댓글을 지운다" on public.post_comments for delete
  to authenticated using ((select auth.uid()) = author_id);
revoke insert, update on table public.post_comments from authenticated;
grant insert (post_id, body) on table public.post_comments to authenticated;
grant update (body) on table public.post_comments to authenticated;

-- 조회 기록은 함수로만 쓴다 (정책 없음 = 직접 읽기·쓰기 불가)
revoke all on table public.post_views from authenticated;

revoke all on table public.posts, public.post_likes, public.post_comments, public.post_views from anon;
