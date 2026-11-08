# DM·차단 작업 기록 — 2026-11-08

브랜치: `feat/woong-dm` (`feat/woong-group-chat` 위에 쌓음. 채팅 컴포넌트·공개 프로필을 재사용한다)

## 차단 정책 (태일 확인 필요)

| 상황 | 동작 |
|---|---|
| A가 B를 차단 | A·B 모두 새 대화 생성·메시지 전송 불가 (DB 정책) |
| 기존 대화 기록 | 두 사람 모두 계속 읽을 수 있음. 대화 목록에도 남음 |
| 차단한 쪽(A) 화면 | 목록에 `차단함`, 입력창에 "차단한 회원이에요. 차단을 해제하면…", 프로필·대화 화면에 `차단 해제` |
| 차단당한 쪽(B) 화면 | 차단 사실을 드러내지 않고 "지금은 이 회원에게 메시지를 보낼 수 없어요"만 표시 |
| 차단 목록 조회 | 차단한 본인만 (`blocks` select RLS) |

## 구현

- `/u/[id]`: 다른 회원이면 `메시지 보내기`(기존 대화가 있으면 그 대화로, 없으면 생성 후 이동)와 `차단`(한 번 더 확인)·`차단 해제`. 자기 프로필에는 없다.
- `/dm`: 상대 아바타·닉네임·마지막 메시지(내가 보냈으면 `나:`)·시간(오늘은 시각, 그 외 날짜), 최근 대화순. 빈 목록·조회 실패 상태.
- `/dm/[threadId]`: 단체 채팅의 `ChatRoom`을 그대로 쓴다(전송 상태·재시도·`client_id`·이전 메시지·실시간·구독 해제). 대화별로 구독을 분리한다. 없는 대화와 남의 대화는 같은 "대화를 찾을 수 없어요"로 보여 존재 여부를 드러내지 않는다.
- 이벤트: `dm_started`는 **새로 만든 대화만**(기존 대화 재진입 제외), `dm_message_sent`는 새로 저장된 메시지만.

## DB (`supabase/migrations/20261109000200_dm_and_blocks.sql`)

- `dm_threads(user_a < user_b, unique(user_a, user_b))`, `dm_messages`(채팅과 같은 본문 검사·`unique(sender_id, client_id)`·서버 시각), `blocks(blocker_id, blocked_id)` PK·자기 차단 금지.
- `start_dm(p_other)`: 기존 대화 조회 → 차단 확인 → `insert … on conflict do nothing` → 경쟁 시 재조회. `{id, created}` 반환. 자기 자신 `22023`, 없는 회원 `P0002`, 차단 `P0001`(hint `blocked`).
- `my_dm_threads()`: 상대 프로필·마지막 메시지를 한 번에(호출자 RLS로 실행).
- 판단 함수(security definer): `is_blocked_between`, `is_dm_participant`, `dm_can_send`. 비로그인 실행 권한 회수.
- RLS: 대화·메시지는 참여자만 조회, 전송은 `sender_id = auth.uid()` + `dm_can_send`. 대화 직접 생성도 참여자·차단 없음 조건. 수정·삭제 불가.
- `dm_messages`를 `supabase_realtime` publication에 추가.

## 검증

```bash
npm run test:dm:db    # 6개: 동시·반복 시작 시 1개/신규 1회, 자기·없는 회원·비로그인·남의 쌍·정렬 위반 거부,
                      # 참여자 송수신·client_id 1건·제3자·위조 거부, 목록, 양방향 차단·기록 유지·해제, 수정·삭제 불가
npm run test:dm:e2e   # 데스크톱 1440·모바일 360: 프로필→대화 시작, 목록, 실시간 답장, 양쪽 재시작 시 같은 대화,
                      # 제3자 URL 접근(HTML에도 내용 없음), 차단→열린 화면 전송 거부 안내→새로고침 시 입력 막힘(중립 문구)→해제 후 전송
```

전체 E2E 16개(인증·프로필·채팅·DM) 통과. `dm_started`·`dm_message_sent`가 desktop/mobile로 기록되는 것을 확인했다.
