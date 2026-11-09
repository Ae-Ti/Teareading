# 태일에게 남기는 요청

웅싯이 태일 담당 기능에 대해 남기는 수정 요청. 처리하면 체크하고 PR 번호를 적어 주세요.

## [ ] 타이머 일시정지 (2026-11-09, 웅싯)

**지금 동작:** 타이머를 시작하고 `중단`을 누르면 그 세션이 끝난다(`status = 'stopped'`). 다시 시작하면 새 세션이라 시간이 처음부터 다시 간다.

**원하는 동작:** `일시정지`를 누르면 잠깐 멈추고, `이어서 하기`를 누르면 **남은 시간부터** 계속된다. 새로고침이나 다른 기기에서 열어도 멈춘 상태와 남은 시간이 그대로여야 한다 (개발계획 6.2-1, 시간은 서버 기준).

**버튼 구성 제안 (태일 판단):** 진행 중에는 `일시정지`·`완료`·`중단`, 멈춘 동안에는 `이어서 하기`·`완료`·`중단`. 기존 `중단`은 "이번 타이머를 끝내기"로 그대로 둔다.

### 바뀌어야 하는 곳

타이머는 `started_at`부터 지금까지를 전부 경과 시간으로 계산하고 있어서, 멈춘 시간을 빼 주는 처리가 곳곳에 필요하다.

| 위치 | 내용 |
|---|---|
| `timer_sessions` (새 마이그레이션) | `paused_at timestamptz`(멈춘 시각, 진행 중이면 null), `paused_seconds integer default 0`(지금까지 멈춘 총 시간) 추가 안 |
| `status` 체크와 유니크 인덱스 | 상태를 추가하지 않고 `running` + `paused_at`으로 표현하면 `timer_sessions_one_running_per_user`와 `(status = 'running') = (ended_at is null)` 체크를 그대로 쓸 수 있다. `paused` 상태를 새로 만들면 둘 다 고쳐야 하고, 안 고치면 멈춘 동안 타이머를 또 시작할 수 있다 |
| 새 RPC | `pause_timer(id)`, `resume_timer(id)` (서버 시각 기준, 본인 것만, 연타해도 한 번만 반영) |
| `finish_timer` | 목표 시각 계산을 `started_at + target_seconds + paused_seconds`로. 멈춘 상태에서 끝내면 `ended_at`은 멈춘 시각 기준. "1분 안에 완료 = 중단" 판단도 멈춘 시간을 뺀 값으로 |
| `attendance_days` 뷰 | `focus_seconds`가 `ended_at - started_at`이라 멈춘 시간이 몰입 시간에 포함된다. `paused_seconds`를 빼야 한다 |
| `components/timer/timer-panel.tsx` | 남은 시간 계산에서 멈춘 시간 제외, 멈춘 동안 카운트와 자동 완료 정지, 버튼·결과 문구 |
| `app/dashboard/actions.ts`, `app/dashboard/page.tsx` | 일시정지·재개 서버 함수, 진행 중 세션 조회 열 추가 |
| `app/space/page.tsx`, `components/space/teahouse-room.tsx` (`timerStatus`) | 찻집의 "☕ N분" 표시가 `started_at` 기준이라 멈춘 시간까지 늘어난다. 멈춘 동안 표시도 정해야 한다 |
| `lib/track.ts`, 개발계획 3.4 | 이벤트가 필요하면 `timer_paused`, `timer_resumed`를 문서에 먼저 추가 |

### 정해야 할 것

- 멈춘 채로 오래 두면 어떻게 할지 (예: 일정 시간 뒤 자동 중단). 멈춘 동안에는 새 타이머를 시작할 수 없으므로 정해 두는 편이 좋다.
- 일시정지 횟수 제한 여부. 출석은 `completed` 1건 이상이면 인정되므로 지금 규칙에는 영향이 없다.

### 확인 방법

`시작 → 일시정지 → 새로고침 → 남은 시간 그대로 → 다른 기기에서 열어도 멈춤 → 이어서 하기 → 남은 시간부터 진행 → 목표 도달 시 자동 완료 → 출석·몰입 시간에 멈춘 시간 미포함`, 일시정지·이어서 하기 연타, 멈춘 동안 다른 탭에서 시작 시도.
