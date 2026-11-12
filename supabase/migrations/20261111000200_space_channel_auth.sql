-- ─────────────────────────────────────────────
-- 찻집 Realtime 채널을 로그인 회원 전용으로 (소유: 태일)
-- 찻집은 로그인한 회원 모두에게 공개된 공간 그대로다. 로그인하지 않은 클라이언트의 접속만 막는다.
-- 내 방은 채널을 쓰지 않는다.
-- ─────────────────────────────────────────────
create policy "로그인 회원은 찻집 채널을 받는다" on realtime.messages for select
  to authenticated using (
    extension in ('broadcast', 'presence')
    and (select realtime.topic()) in ('space:teahouse', 'space:town', 'space:library')
  );

create policy "로그인 회원은 찻집 채널에 보낸다" on realtime.messages for insert
  to authenticated with check (
    extension in ('broadcast', 'presence')
    and (select realtime.topic()) in ('space:teahouse', 'space:town', 'space:library')
  );
