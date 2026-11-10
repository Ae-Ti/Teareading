# 태일에게 남기는 요청

웅싯이 태일 담당 기능에 대해 남기는 수정 요청. 처리하면 체크하고 PR 번호를 적어 주세요.

## [x] 타이머 일시정지 (2026-11-09, 웅싯) — 처리: `feat/taeil-timer-pause`

> **태일 처리 (2026-11-10):** 제안대로 `running` + `paused_at`, `paused_seconds`로 구현했다 (`20261110000100_timer_pause.sql`).
> - 멈춘 타이머는 자동 중단하지 않는다. 돌아오면 `이어서 하기`나 `중단`을 누르면 되고, 멈춘 시간은 몰입 시간에 들어가지 않는다.
> - 일시정지 횟수는 제한하지 않는다. 이벤트(`timer_paused` 등)는 추가하지 않았다.
> - 찻집에서는 멈춘 동안 타이머 표시를 뺀다. "N분"은 지난 멈춤 시간을 뺀 값이다.
> - `finish_timer`에 `expired`를 추가했다. 화면의 자동 완료는 이 값으로 요청하고, 다른 탭에서 멈췄거나 목표 시각이 늦춰졌으면 서버가 끝내지 않고 현재 상태를 돌려준다.
> - **웅싯 확인 필요:** 마이그레이션이 있고 `my_record_stats`(웅싯 정의)의 `sessions`를 고쳤다.

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
| `my_record_stats` (통계 탭의 다도 시간) | `sessions` CTE가 `ended_at - started_at`이라 `paused_seconds`를 빼야 한다 (최신 정의: `20261109001100_books.sql`) |
| `lib/track.ts`, 개발계획 3.4 | 이벤트가 필요하면 `timer_paused`, `timer_resumed`를 문서에 먼저 추가 |

### 정해야 할 것

- 멈춘 채로 오래 두면 어떻게 할지 (예: 일정 시간 뒤 자동 중단). 멈춘 동안에는 새 타이머를 시작할 수 없으므로 정해 두는 편이 좋다.
- 일시정지 횟수 제한 여부. 출석은 `completed` 1건 이상이면 인정되므로 지금 규칙에는 영향이 없다.

### 확인 방법

`시작 → 일시정지 → 새로고침 → 남은 시간 그대로 → 다른 기기에서 열어도 멈춤 → 이어서 하기 → 남은 시간부터 진행 → 목표 도달 시 자동 완료 → 출석·몰입 시간에 멈춘 시간 미포함`, 일시정지·이어서 하기 연타, 멈춘 동안 다른 탭에서 시작 시도.

## [x] 서재 PR 리뷰 (`feat/woong-library`, 2026-11-09, 웅싯)

> **태일 확인 (2026-11-10):** #23은 리뷰 없이 머지됐지만 이후 마이그레이션과 태일 담당 파일 변경을 읽고 테스트를 돌렸으며 결함은 찾지 못했다. 책 삭제 시 독서록 함께 삭제(개수 경고 있음)와 저자가 다른 동명 책 불가는 현재 동작을 유지한다. 앞으로 태일 담당 테이블을 고치는 PR은 확인을 받고 머지하자.

독서기록을 책 중심 표로 바꿨다. 태일 담당인 `reading_logs`와 화면을 고쳤고 DB 변경이 있어 **태일 확인 전에는 main에 합치지 않는다.**

### 봐 줬으면 하는 DB 변경 (`20261109001100_books.sql`)

| 변경 | 확인할 점 |
|---|---|
| `books` 새 테이블 (제목·저자·상태·장르, 본인만 접근) | 사용자별 같은 제목 1권만 허용 (`book_key`: 띄어쓰기·대소문자 무시). 저자가 다른 동명의 책은 넣을 수 없다 |
| `reading_logs.book_id` 추가, 기존 기록 자동 연결 | 같은 제목끼리 책 1권으로 묶고 상태는 `reading`. 책을 지우면 독서록도 cascade로 지워진다 |
| 트리거 `reading_logs_link_book` | 저장할 때 `book_id`를 채우고 제목을 책 제목으로 맞춘다. `book_id` 없이 넣으면 제목으로 책을 찾거나 만든다. 그래서 컬럼은 nullable이지만 항상 값이 있다 |
| `reading_logs_set_updated_at` 트리거에 조건 추가 | **기존 트리거를 교체했다.** 본문·페이지 수가 바뀔 때만 수정일이 바뀐다 (책 제목을 고쳐도 "수정됨"이 되지 않게) |
| `my_record_stats` 재정의, `my_books` 추가 | 완독·읽는 중·장르별 집계 추가 |

### 태일 담당 파일을 고친 곳

- `components/timer/timer-panel.tsx`, `app/dashboard/page.tsx`: 독서기록 링크를 `/me/reading/new`에서 `/me/reading`으로 변경 (독서록은 이제 책을 골라야 쓸 수 있다)
- `components/records/*`, `app/me/actions.ts`, `lib/records.ts`: 책 연결, 통계 탭 분리

확인: 단위·DB·권한 테스트 전부, E2E 40개, lint, typecheck 통과. 그 뒤 서재 표의 버튼 정렬(CSS 한 줄)만 고쳤다.

## [x] 웅싯이 먼저 정한 정책 — 다른 의견 있으면 알려 주세요

> **태일 확인 (2026-11-10):** 아래 정책은 현재 동작 그대로 유지한다.

이미 main에 들어간 PR에 포함돼 있다. 일정상 웅싯이 기본값을 정해 진행했다.

| 항목 | 현재 동작 |
|---|---|
| 부모임장 | 모임당 1명. 새로 지정하면 기존 부모임장은 일반 멤버가 된다 |
| 강제 퇴장 | 모임장이 "재가입 허용"을 누르기 전까지 다시 가입할 수 없다 (10장 4번 해결) |
| 메시지 차단 | 모임을 나갔다 들어와도 유지된다 |
| DM 차단 | 어느 한쪽이 차단하면 양쪽 모두 새 대화·전송 불가. 지난 대화는 둘 다 볼 수 있다. 차단당한 쪽에는 차단 사실을 드러내지 않는다 |
| 단체 채팅방 나가기 | 모임 탈퇴와 같다. 모임장은 나갈 수 없다 |
| 1:1 나가기 | 내 목록에서만 사라지고 상대가 새 메시지를 보내면 돌아온다. 지난 대화는 지워지지 않는다 |
| 채팅방 알람 끄기 | 내비게이션 빨간 개수에서만 뺀다 (푸시·소리 알림은 없다) |
| 통계 | 다도 시간은 완료한 타이머만. 차 종류별 횟수는 차 칼럼에서 고른 종류의 개수 (타이머에는 차 종류가 없다) |

## [ ] 같이 정하거나 확인할 것

- [x] `/groups/[id]/manage` 페이지: 삭제했다. 이 페이지만 쓰던 `updateGroup`, `removeMember`, `RemoveMemberButton`도 함께 지웠다 (`feat/taeil-timer-pause`)
- [x] 개인정보처리방침의 서버 지역: 서울(`ap-northeast-2`)로 정해 `lib/legal.ts`에 넣었다. 프로덕션 Supabase 프로젝트를 이 리전으로 만들어야 한다
- [x] 지표 목표치 확정 (D6 점검 2장, 측정은 출시일부터 2주)
- [ ] 실기기(iOS Safari, Android Chrome)에서 채팅 키보드가 입력창을 가리는지 (태일이 나중에 확인)
- [ ] `profile.spec.ts`의 프로필 수정 테스트가 한 번 실패했다. 저장한 소개 글이 이전 글과 붙어 나왔고, 다시 돌리니 3번 모두 통과했다. 원인은 찾지 못했다

로컬 DB를 맞출 때: `npx supabase migration up --local` (필요하면 `--include-all`, D6 점검 9장).

## [ ] 찻집 변경 확인 (`feat/woong-space-profile`, 2026-11-10, 웅싯)

태일 담당인 찻집 코드를 고쳤다. 웅싯 판단으로 먼저 올렸으니, **마음에 안 들면 태일이 원래대로 되돌려도 된다.**

| 변경 | 위치 |
|---|---|
| 앉아 있을 때 상태 메시지 (저장 안 함, 일어나면 사라짐) | `components/space/teahouse-room.tsx`, `pixel/scene.ts`, `presence.ts` |
| 다른 화면에 갔다 와도 위치·자리·메시지 유지 (이 탭의 sessionStorage, `나가기`를 누르면 지움) | `lib/space/resume.ts`, `teahouse-room.tsx` |
| **버그 수정: Presence 전송 제한** | `teahouse-room.tsx`의 `pushState` |

버그 내용: Realtime Presence는 연결당 30초에 5번까지만 받는다(`ClientPresenceRateLimitReached`). 걸을 때마다 `track`해서 많이 걸으면 다른 사람 화면에서 캐릭터가 사라졌다. 위치·자리·메시지는 Broadcast(`STATE_EVENT`)로 바로 보내고, `track`은 늦게 들어온 사람을 위해 7초에 한 번만 보낸다.

되돌리는 방법: 이 브랜치의 커밋을 `git revert` 하면 된다. 상태 메시지와 복원만 빼고 싶으면 `lib/space/resume.ts`와 `teahouse-room.tsx`의 복원 effect만 지우면 되고, Presence 제한 수정은 남겨 두는 편이 좋다.

같은 브랜치의 DB 변경(`20261110000200_library_profile.sql`): 책 표지·읽은 쪽 수정, 공개 프로필 합계 통계(`public_profile_stats`). 태일이 정의한 `my_record_stats`를 이 파일에서 다시 정의했다.

## [ ] 소셜 기능 확인 (`feat/woong-social`, 2026-11-10, 웅싯)

**마이그레이션 확인 필요:** `20261110000300_social.sql` (RLS, RPC, 새 버킷 `post-images`, `live_requests` Realtime 추가)

| 기능 | 내용 |
|---|---|
| 댓글 | `post_comments.parent_id`, `like_count`, `comment_likes`. 답글의 답글은 트리거가 막는다 |
| 사진 글쓰기 | `posts.content`(글·사진 블록). `body`에는 검색용 글만 들어간다. 사진은 서버에서 다시 인코딩하고, `next.config.ts`의 `bodySizeLimit`을 6mb로 올렸다 |
| 친구 | `friendships`. 신청과 수락은 `live_requests`를 쓴다 |
| 접속 중 표시 | `user_heartbeats`. 45초마다 기록하고 90초 안에 기록이 있으면 접속 중으로 본다. `my_online_friends`로만 읽는다 |
| 수락/거절 팝업 | `live_requests`, `create_live_request`, `respond_live_request`. 전역 `RequestCenter`가 앱 어디서든 받는다 |

태일 담당인 찻집 코드도 고쳤다 (`teahouse-room.tsx`, `pixel/scene.ts`, 새 파일 `player-menu.tsx`). 다른 사람 캐릭터를 누르면 메뉴가 뜨고, 찻집에서 맺은 모임 이름이 캐릭터 아래에 보인다. 대시보드의 `오늘의 다도 가이드`는 `오늘의 핫게시물`로 바꿨다. **마음에 안 들면 태일이 원래대로 되돌려도 된다.**

알아 둘 점:

- 글을 쓰다 올린 사진을 글에 넣지 않고 나가면 파일이 남는다. 회원 탈퇴 때 지워지고, 한 사람당 500장으로 막아 두었다
- 프로덕션에 올릴 때 마이그레이션을 먼저 적용해야 한다 (`post-images` 버킷도 이때 만들어진다)
- 개인정보처리방침에 친구 목록 공개, 접속 정보, 글 사진을 추가했다. 이 내용이 맞는지 같이 봐 주면 좋겠다

## [ ] 공개 프로필의 읽은 책·차 칼럼 (`feat/woong-public-records`, 2026-11-10, 웅싯)

**마이그레이션 확인 필요:** `20261110000400_public_records.sql`

다른 회원의 공개 프로필 활동 통계 아래에 완독한 책과 차 칼럼이 나온다. 칼럼은 본문까지 읽을 수 있다 (`/u/[id]/columns/[columnId]`).

- 표의 RLS는 "본인만"으로 그대로 두었다. `recentRecords` 등 내 기록 목록이 RLS에 기대고 있어서, 보여 줄 값만 security definer 함수 3개로 내보낸다
- 독서기록 원문과 읽는 중·보류 책은 공개하지 않는다
- 개인정보처리방침의 "차 칼럼 원문은 공개되지 않습니다"를 고쳤고, 칼럼 작성 화면에 공개된다는 안내를 넣었다. 칼럼별 비공개 설정은 없다

**이후 변경 (`20261110000500_visibility.sql`):** 프로필 공개/비공개(`profiles.is_public`, 기본 공개)와 글별 공개/비공개(`tea_columns`·`reading_logs`의 `is_public`, 기본 비공개)를 추가했다. 위의 "칼럼별 비공개 설정은 없다"는 더 이상 맞지 않는다. 독서기록도 공개로 지정하면 공개 프로필에 나온다. `friendships`의 조회 권한을 당사자만으로 좁혔고, `public_profile_stats`를 다시 정의했다.

남은 한계: `profiles`의 `bio`와 `group_members`는 로그인 회원이 직접 조회할 수 있다. 비공개 프로필에서 소개와 참여 모임은 화면에서만 가린다. 완전히 막으려면 `profiles`의 컬럼 권한을 나눠야 한다.

## [ ] 상단 메뉴·대시보드 변경 (`feat/woong-nav-dashboard`, 2026-11-10, 웅싯)

상단의 `가이드`를 없앴고(푸터에는 남아 있다), `내 프로필`을 사진·닉네임 버튼과 메뉴로 바꿨다. 공개 설정은 `/mypage/settings`로 옮겼다. 대시보드는 `이번 주 출석`을 타이머 아래로 옮기고, 컴퓨터 화면(`lg` 이상)에서 그 자리에 찻집 캐릭터와 프로필을 넣었다. 데이터베이스 변경은 없다.

`profile.spec.ts`의 프로필 수정 시험은 지금도 가끔 실패한다 (같은 날 데스크톱에서 여러 번 재현). 저장값이 항상 `새 글 + 이전 글` 순서라, Playwright의 `fill`이 화면 준비(하이드레이션)와 겹친 것으로 추정하지만 확인하지는 못했다.
