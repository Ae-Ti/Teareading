-- 공용: updated_at 자동 갱신 트리거 함수 (다른 테이블에서도 재사용)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- profiles: 회원 계정과 1:1 공개 프로필 (소유: 웅싯)
-- 개인 독서기록·차 칼럼 원문은 여기에 두지 않는다 (명세 1.2)
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  avatar_url text,
  bio text check (char_length(bio) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 닉네임은 대소문자 구분 없이 중복 불가
create unique index profiles_nickname_lower_key on public.profiles (lower(nickname));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "로그인 사용자는 프로필을 조회할 수 있다"
  on public.profiles for select
  to authenticated
  using (true);

create policy "본인 프로필만 수정할 수 있다"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- insert/delete 정책 없음: 생성은 아래 트리거가, 삭제는 auth.users cascade가 맡는다.

-- 가입 시 프로필 자동 생성.
-- 회원가입 시 options.data.nickname 으로 닉네임을 넘긴다. 없으면 임시 닉네임을 쓴다.
-- 닉네임이 중복이면 가입 자체가 실패하므로, 가입 화면에서 먼저 중복 확인을 한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 닉네임 사용 가능 여부 (가입 전, 비로그인 상태에서도 호출)
create or replace function public.is_nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(nickname) = lower(trim(p_nickname))
  );
$$;

grant execute on function public.is_nickname_available(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- events: 분석 이벤트 (소유: 태일). 이름 목록은 개발계획 문서 3.4
-- 앱에서는 기록만 하고, 조회는 Supabase 대시보드에서 한다.
-- ─────────────────────────────────────────────
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  device text check (device in ('desktop', 'mobile')),
  created_at timestamptz not null default now()
);

create index events_name_created_at_idx on public.events (name, created_at);
create index events_user_id_idx on public.events (user_id);

alter table public.events enable row level security;

-- 비로그인 이용자는 user_id 없이만, 로그인 이용자는 본인 user_id로만 기록할 수 있다.
create policy "비로그인 이벤트 기록"
  on public.events for insert
  to anon
  with check (user_id is null);

create policy "로그인 이벤트 기록"
  on public.events for insert
  to authenticated
  with check (user_id is null or user_id = (select auth.uid()));
