# 단체 채팅 작업 기록 — 2026-11-08

브랜치: `feat/woong-group-chat` (`feat/woong-profile` 위에 쌓음 → 프로필 PR 머지 후 `main` 기준으로 바뀐다)

## 구현

- `/groups/[id]/chat`: 최근 50개 메시지, 위로 스크롤(또는 "이전 메시지 더 보기")하면 50개씩 더 불러온다. 보던 위치를 유지한다. 내 메시지(오른쪽·말차색)와 상대 메시지(왼쪽·아바타·닉네임 → `/u/[id]`) 구분, 날짜 구분선, 5분 안 연속 메시지 묶음.
- 상태: 빈 채팅방, 로딩, 조회 실패(다시 시도), 없는 모임, 비회원("모임에 가입해야 볼 수 있어요" → 모임 상세), 실시간 연결 끊김 안내.
- 전송: 브라우저에서 `client_id`(UUID)를 만들고 바로 "보내는 중"으로 표시 → 저장되면 시간 표시, 실패하면 "다시 보내기"·"삭제". 재시도는 **같은** `client_id`를 보낸다. 이미 저장됐는데 응답만 못 받은 경우 DB unique 위반을 성공으로 처리하고 저장된 메시지를 돌려준다.
- 입력: 데스크톱 Enter 전송·Shift+Enter 줄바꿈, 한글 조합 중 Enter 무시, 터치 기기는 버튼 전송. 1,000자(코드 포인트) 제한, 900자부터 글자 수 표시.
- 실시간: Postgres Changes(`group_id` 필터). 구독이 실제로 걸리기까지 수 초 걸리므로 구독 직후와 3초 뒤에 최근 메시지를 한 번 더 받아 합친다. 재연결 때도 같다. 화면을 떠나면 구독 해제.
- 레이아웃: `.chat-viewport`(100dvh − 상단 내비 − 하단 탭)로 입력창이 화면 아래에 붙고 목록만 스크롤된다. `--app-header-h`, `--app-tabbar-h` 변수를 내비게이션 개편 때 맞춘다.
- `group_message_sent`: 새로 저장된 경우에만 기록(재시도로 이미 있던 메시지는 제외).

## DB (`supabase/migrations/20261109000100_group_messages.sql`)

- `group_messages(id, group_id, sender_id default auth.uid(), body 1~1000자·공백만 금지, client_id, created_at)`
- **`unique(sender_id, client_id)`**: 개발계획의 `client_id unique`를 보낸 사람 범위로 좁혔다. 남이 내 `client_id`를 먼저 써서 내 전송을 막을 수 없게 하기 위해서다.
- `created_at`은 트리거로 서버 시각만 쓴다.
- RLS: 조회·작성 모두 `is_group_member(group_id)`, 작성은 `sender_id = auth.uid()`. 수정·삭제 정책 없음 + 권한 회수. 탈퇴하면 이전 메시지도 볼 수 없다.
- `supabase_realtime` publication에 추가. 구독자별로 select 정책이 적용된다(비회원에게는 전달되지 않음을 테스트로 확인).
- 타임스탬프: 태일의 `20261109000000_space_avatars.sql`보다 뒤에 오도록 `20261109000100`으로 지었다.

## 검증

```bash
npm run test:chat       # 순수 로직 6개 (병합·중복·대기/실패 상태·검증)
npm run test:chat:db    # 로컬 DB 8개 (멤버 권한, 위조, client_id 중복·동시 전송, 수정·삭제 불가, 비회원·비로그인, 실시간 수신 범위, 탈퇴 후 차단, 페이지네이션)
npm run test:chat:e2e   # 프로덕션 빌드 Chromium 데스크톱 1440·모바일 360 각 2개
```

E2E: 두 계정 실시간 송수신, 비회원 안내, 오프라인 전송 실패 → 재시도 → DB 1건, 새로고침 후 중복 없음, 입력창 화면 안·가로 넘침 없음, 탈퇴 후 접근 차단, 없는 모임. `events`에 `group_message_sent`가 desktop/mobile로 쌓이는 것을 확인했다.

## 태일에게

- `tests/rls.db.test.ts`에 넣기로 한 채팅 RLS는 `tests/chat.db.test.ts`에 같은 방식으로 들어 있다. 필요하면 옮기거나 그대로 `npm run test:chat:db`를 같이 돌려 주세요.
- 마이그레이션·RLS 포함 PR이라 확인 후 머지해 주세요.
