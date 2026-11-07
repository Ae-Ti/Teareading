# D6 품질 점검 (태일) — 2026-11-08

개발계획 4.2 태일 D6 항목과 4.3 공동 작업 중 지금 할 수 있는 것을 점검한 기록이다.
로컬 Supabase 기준. 웅싯 담당 기능 중 아직 없는 화면(프로필, 단체 채팅, DM, 랜딩·약관)은 머지되면 같은 방식으로 다시 점검한다.

## 1. 분석 이벤트 점검 (3.4 목록)

로컬에서 실제 흐름을 돌린 뒤 `events` 테이블을 확인했다.

| 이벤트 | 기록 위치 | 확인 |
|---|---|---|
| `signup_completed`, `login_completed` | `lib/auth/operations.ts` | ✅ 데스크톱·모바일 모두 |
| `timer_started`, `timer_completed`, `timer_stopped` | `app/dashboard/actions.ts` | ✅ |
| `attendance_viewed` | `app/attendance/page.tsx` | ✅ |
| `reading_log_created`, `tea_column_created` | `lib/records.ts` | ✅ |
| `guide_viewed` | `app/guide/[slug]/page.tsx` | ✅ 비로그인은 `user_id` 없이 기록 |
| `space_entered`, `space_left` | `app/space/actions.ts` | ✅ |
| `group_viewed`, `group_joined` | `app/groups/` | ✅ |
| `profile_updated` | — | ⏳ 프로필 수정 화면 없음 (웅싯 D3) |
| `group_message_sent` | — | ⏳ 단체 채팅 없음 (웅싯 D4) |
| `dm_started`, `dm_message_sent` | — | ⏳ DM 없음 (웅싯 D5) |

- 17개 중 13개 기록 확인. 남은 4개는 해당 기능이 생기면 `track()`만 부르면 된다.
- `device`가 비어 있는 `signup_completed`는 DB 테스트(`tests/auth.db.test.ts`)가 직접 넣은 행이다. 실제 화면 경로는 모두 `device`가 채워진다.

## 2. 지표 목표치 초안 (PRD 핵심 지표) — 웅싯 확인 필요

측정 기간: **출시 후 2주 (2026-11-09 ~ 11-22, KST)**. 집계 쿼리는 [`metrics.sql`](metrics.sql).

| 지표 | 정의 | 목표(초안) |
|---|---|---|
| 회원가입 완료율 | `/signup` 방문자 대비 `signup_completed` | 50% |
| 첫 타이머 사용률 | 가입자 중 24시간 안에 `timer_started` | 60% |
| 타이머 재사용률 | 타이머를 완료한 사용자 중 7일 안에 2회 이상 완료 | 40% |
| 주간 재방문 | 한 주에 활동한 사용자 중 다음 주에도 이벤트가 있는 비율 | 25% |
| 기록 작성 비율 | 타이머 완료 사용자 중 독서기록·차 칼럼 작성 | 30% |
| 메타버스 참여 | 활동 사용자 중 `space_entered` | 20% |
| 모임·채팅 참여 | 활동 사용자 중 `group_joined` 또는 `group_message_sent` | 15% |
| 기기별 흐름 완료율 | 기기별 `timer_started` 대비 `timer_completed` | 데스크톱·모바일 차이 10%p 이내 |

- **회원가입 완료율의 분모(`/signup` 방문)는 지금 기록하지 않는다.** Vercel Web Analytics(무료)의 `/signup` 페이지뷰를 쓰는 것을 제안한다. 새 이벤트를 만들지 않아도 된다.
- 수치는 첫 출시 기준의 출발점이다. 2주 뒤 실제 값을 보고 다시 정한다.

## 3. RLS 점검

`npm run test:rls` (`tests/rls.db.test.ts`) — **9개 통과**. 두 계정(A, B)과 비로그인으로 시도했다.

- 비로그인: 모든 테이블·뷰 조회 불가, `start_timer`·`is_group_member` 호출 불가
- 타이머: B가 A의 세션 조회·종료 불가, 본인도 직접 insert/update로 완료 위조 불가(RPC만 가능), 남의 출석 조회 불가
- 독서기록·차 칼럼: 남의 글 조회·수정·삭제·대리 작성 불가, 자기 글 주인을 남으로 바꾸기 불가
- 모임: 남을 모임장으로 생성, 비모임장 수정·삭제, 모임장 넘기기, 모임장 역할로 가입, 남을 강제 가입, 멤버의 역할 승격, 멤버가 모임장 내보내기, 모임장 본인 탈퇴 모두 불가. 모임장의 내보내기는 허용
- 찻집 체류 기록: 남의 기록 조회·수정·대리 작성 불가
- 프로필: 남의 닉네임 변경, 프로필 삭제 불가
- Realtime: DB 테이블을 publication에 올리지 않았다. 찻집은 Presence만 쓴다
- **채팅·DM은 테이블이 생기면 이 파일에 같은 방식으로 추가한다.** 단체 채팅은 `is_group_member()`로 조회·작성을 막고, 탈퇴 후 접근이 막히는지 확인한다

## 4. 웅싯 담당 기능 교차 테스트 (인증)

5.5 체크리스트 첫 줄 기준. 결함은 없었다.

| 항목 | 결과 |
|---|---|
| 비로그인으로 보호 경로 9곳 접근 | ✅ 모두 `/login?next=…`로 이동 |
| `next=//evil.example` (외부 주소로 보내기) | ✅ `/dashboard`로 바뀜 |
| 가입 → 대시보드 진입 | ✅ |
| 로그인 상태로 `/login` 접근 | ✅ `/dashboard`로 이동 |
| 로그아웃 → 보호 경로 접근 | ✅ 로그인 유도 |
| 중복 이메일 / 중복 닉네임 | ✅ 가입 막힘, 닉네임은 칸 아래 안내 |
| 로그인 실패 / 성공 후 `next` 복귀 | ✅ "이메일 또는 비밀번호를 확인해 주세요" / `/me`로 복귀 |
| 웅싯 테스트 `test:auth`(12), `test:auth:db`(5), `test:auth:e2e`(6) | ✅ 모두 통과 |

## 5. 반응형 QA (360px · 1440px)

화면 16개를 두 크기로 캡처하고 가로 넘침을 자동 확인했다. 가로 넘침은 없었다. 아래를 고쳤다.

- 커뮤니티·내 기록: 모바일에서 제목 옆 버튼 글자가 두 줄로 꺾임 → 버튼이 줄어들지 않게 함
- 가이드 표: 모바일에서 마지막 열이 잘리고, 데스크톱에서 표가 틀보다 좁음 → 표를 틀 너비에 맞추고, 첫 열만 빼고 줄바꿈 허용
- 대시보드 주간 출석: 몰입 기록이 없는 주에 빈 막대 영역이 깨진 것처럼 보임 → 기록이 있을 때만 막대를 보여 줌

남은 것 (웅싯 담당 영역이라 손대지 않음):

- 전역 내비게이션: 모바일에서 상단 메뉴 7개가 꽉 참. 계획상 모바일 하단 탭으로 교체 예정
- 로그인·회원가입 폼이 공통 UI가 아닌 기본 모양
- 화면 오른쪽 아래 `N` 버튼은 Next.js 개발 모드 표시라 프로덕션에는 나오지 않음

## 6. 정리

- 개발용 임시 로그인(`/dev/login`)을 지웠다. 이제 개발 중에도 `/login`, `/signup`을 쓴다.

## 7. 막힌 것

웅싯 담당 기능은 웅싯이 진행한다. 태일은 대신 만들지 않고, 머지되면 바로 점검한다.

| 막힌 것 | 이유 | 풀리는 조건 |
|---|---|---|
| 채팅·DM RLS 점검 | `group_messages`, `dm_threads`, `dm_messages` 테이블 없음 | 웅싯 D4·D5 머지 → `tests/rls.db.test.ts`에 추가 |
| 프로필·채팅·DM 교차 테스트 | 화면 없음 | 웅싯 D3~D5 머지 |
| 이벤트 4개 확인 (`profile_updated`, `group_message_sent`, `dm_started`, `dm_message_sent`) | 기록할 화면 없음 | 위와 같음 |
| 웅싯 화면 반응형 점검 | 화면 없음 | 위와 같음 |
| 약관·개인정보처리방침 (Go/No-go 조건) | 문서 없음. 가입 폼 동의 링크가 비어 있음 | 웅싯 D6 |
| 지표 목표치 확정 | 초안만 있음 (2장) | 웅싯 확인 |
| 프로덕션 Supabase 설정 | 프로덕션 프로젝트 없음 | D7 배포 시작 (8장 체크리스트) |

## 8. 프로덕션 Supabase 설정 (배포 때 확인)

프로덕션 프로젝트를 아직 만들지 않아 확인하지 못했다. D7 배포 때 아래를 순서대로 맞춘다.

- [ ] Authentication > Sign In / Providers > Email: **Confirm email 끄기** (결정 #8, 기본 메일 발송 한도 때문). 로컬 `config.toml`의 `enable_confirmations = false`와 같게
- [ ] 비밀번호 최소 길이 6 (가입 폼 검증과 같게)
- [ ] Authentication > URL Configuration: Site URL = 프로덕션 주소, Redirect URLs = 프로덕션, `https://*-<팀>.vercel.app/**`(프리뷰), `http://localhost:3000/**`
- [ ] `npx supabase link` 후 `npx supabase db push`로 마이그레이션 반영, `npm run test:rls`와 같은 확인을 원격에서 두 계정으로 한 번 더
- [ ] Storage: 아바타 버킷이 생기면 `avatars/{user_id}/...` 경로만 쓰기 허용, 이미지 형식·용량 제한 (6.4)
- [ ] Vercel 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 Production·Preview 둘 다
- [ ] 무료 플랜 일시 정지 모니터링 담당 정하기

## 데일리 로그

```
[D6 / 태일 / 11-08 새벽]
✅ 한 일: 분석 이벤트 점검(13/17), 지표 목표치 초안, RLS 점검 테스트(npm run test:rls, 9개 통과),
   인증 교차 테스트(결함 없음), 360·1440 반응형 점검 및 수정 3건, /dev/login 제거
➡️ 다음에 할 일: 웅싯 기능 머지되는 대로 채팅·DM RLS·교차 테스트, D7 배포·프로덕션 설정
⛔ 막힌 것: 7장 표 (모두 웅싯 기능 머지 또는 배포 시작 대기)
🙋 상대에게 필요한 것:
   1) 지표 목표치 초안(2장) 확인
   2) 태일 기능 교차 테스트 (5.5: 타이머·출석·기록·모임·찻집·가이드)
   3) 가이드 원고 검수 (content/guide/)
   4) 약관·개인정보처리방침 — D7 출시 조건
   5) 채팅·DM 머지 시 알려 주기 → 바로 RLS 점검
```
