-- ─────────────────────────────────────────────
-- 찻집 위조 막기: 사람마다 자기 채널로만 보낸다 (소유: 태일)
--
-- Realtime 권한은 채널에 들어올 때 한 번만 검사하고 메시지 내용은 보지 않는다.
-- 그래서 공용 채널(space:teahouse)에 보낼 수 있으면 남의 user_id를 넣어 위치·상태 메시지를 꾸밀 수 있었다.
--
-- 바꾼 방식
-- - 공용 채널 space:{공간}: 누가 있는지 알리는 Presence만. Broadcast는 보낼 수 없다.
-- - 개인 채널 space:{공간}:u:{user_id}: 받기는 로그인 회원 누구나, 보내기(Broadcast·Presence)는 그 user_id 본인만.
--   받는 쪽은 메시지 안의 user_id 대신 채널 이름으로 보낸 사람을 정하고, 닉네임은 DB에서 읽는다.
-- 공용 채널 Presence를 꾸며도 "그 사람 개인 채널을 들어 보라"는 힌트일 뿐이라, 본인이 아니면 캐릭터가 생기지 않는다.
-- ─────────────────────────────────────────────
drop policy if exists "로그인 회원은 찻집 채널을 받는다" on realtime.messages;
drop policy if exists "로그인 회원은 찻집 채널에 보낸다" on realtime.messages;

create policy "로그인 회원은 찻집 채널을 받는다" on realtime.messages for select
  to authenticated using (
    extension in ('broadcast', 'presence')
    and (
      (select realtime.topic()) in ('space:teahouse', 'space:town', 'space:library')
      or (select realtime.topic()) ~ '^space:(teahouse|town|library):u:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  );

create policy "공용 채널에는 누가 있는지만 알린다" on realtime.messages for insert
  to authenticated with check (
    extension = 'presence'
    and (select realtime.topic()) in ('space:teahouse', 'space:town', 'space:library')
  );

create policy "개인 채널에는 본인만 보낸다" on realtime.messages for insert
  to authenticated with check (
    extension in ('broadcast', 'presence')
    and (select realtime.topic()) in (
      'space:teahouse:u:' || (select auth.uid())::text,
      'space:town:u:' || (select auth.uid())::text,
      'space:library:u:' || (select auth.uid())::text
    )
  );
