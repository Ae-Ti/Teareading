-- ─────────────────────────────────────────────
-- 모임 단체 채팅 (소유: 웅싯, 명세 6.2)
-- 멤버만 조회·작성. 수정·삭제 없음.
-- client_id: 브라우저가 메시지마다 한 번 만드는 UUID. 재시도할 때 같은 값을 보내 중복 저장을 막는다.
--   보낸 사람 기준으로 유일하게 둔다 → 남이 내 client_id를 먼저 써서 내 전송을 막을 수 없다.
-- ─────────────────────────────────────────────
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (
    char_length(body) between 1 and 1000 and btrim(body, E' \t\r\n') <> ''
  ),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  constraint group_messages_sender_client_key unique (sender_id, client_id)
);

create index group_messages_group_created_idx
  on public.group_messages (group_id, created_at desc, id desc);

-- 작성 시각은 서버 시각만 쓴다 (클라이언트가 보낸 값을 무시)
create or replace function public.set_message_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

create trigger group_messages_set_created_at
  before insert on public.group_messages
  for each row execute function public.set_message_created_at();

alter table public.group_messages enable row level security;

create policy "모임 멤버만 메시지를 조회할 수 있다" on public.group_messages for select
  to authenticated using (public.is_group_member(group_id));

create policy "모임 멤버만 본인 이름으로 메시지를 보낼 수 있다" on public.group_messages for insert
  to authenticated with check (
    (select auth.uid()) = sender_id and public.is_group_member(group_id)
  );

-- 수정·삭제 정책이 없으므로 RLS가 막지만, 권한 자체도 걷어 둔다
revoke all on table public.group_messages from anon;
revoke update, delete, truncate on table public.group_messages from authenticated;

-- 새 메시지 실시간 수신 (Postgres Changes). 구독자마다 위 select 정책을 적용한다.
alter publication supabase_realtime add table public.group_messages;
