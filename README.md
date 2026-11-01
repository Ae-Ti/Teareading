# 티어리딩 (teareading)

차를 마시고 책을 읽는 시간을 위한 다도 독서 타이머·커뮤니티 웹앱.
기획 문서와 1주 개발 계획은 [`docs/`](docs/)에 있다. **작업 전에 개발계획 문서의 자기 날짜 칸과 상대의 마지막 데일리 로그를 먼저 읽는다.**

## 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres, Realtime, Storage) · Vercel

> Next.js 16은 이전 버전과 다른 점이 있다. 예: `middleware.ts` → `proxy.ts`, `cookies()`·`params`는 비동기.
> 모르는 API는 `node_modules/next/dist/docs/`를 먼저 확인한다.

## 로컬 실행

필요: Node 22+, Docker Desktop(로컬 Supabase용)

```bash
npm install
npx supabase start          # 로컬 Supabase 실행 (처음엔 이미지 다운로드로 몇 분 걸림)
npx supabase status         # API URL과 Publishable key 확인
cp .env.example .env.local  # 위 값을 채워 넣는다
npm run dev                 # http://localhost:3000
```

- 로컬 Supabase Studio: http://127.0.0.1:54323
- 로컬에서 보낸 인증 메일 확인(Mailpit): http://127.0.0.1:54324
- 원격(공용 개발) Supabase를 쓰려면 `.env.local`에 원격 프로젝트 값을 넣으면 된다.

## 환경변수

| 이름 | 위치 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트·서버 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 클라이언트·서버 | Publishable key (예전 이름: anon key) |

`service_role`/secret 키는 **절대 `NEXT_PUBLIC_` 변수에 넣지 않는다.** 현재는 쓰지 않는다.
Vercel에는 Production·Preview 환경 모두에 같은 이름으로 등록한다.

## 폴더 구조

```
app/                  라우트 (개발계획 3.2 표 기준). 아직 안 만든 화면은 ComingSoon 표시
components/ui/        웅싯 소유: 디자인 시스템 컴포넌트
components/layout/    전역 셸·내비게이션 (웅싯이 D2에 교체)
components/<기능>/    기능별 컴포넌트
lib/supabase/         태일 소유: client.ts(브라우저), server.ts(서버), proxy.ts(세션 갱신)
lib/track.ts          분석 이벤트 기록 헬퍼
proxy.ts              매 요청 세션 갱신 (+ D2에 로그인 보호 경로 추가)
types/database.ts     자동 생성 타입. 손으로 고치지 않는다
supabase/migrations/  DB 마이그레이션
content/guide/        가이드 마크다운 (D5)
```

## Supabase 클라이언트 쓰는 법

```ts
// 서버 컴포넌트 / 서버 함수
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// 클라이언트 컴포넌트
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// 현재 사용자 확인은 getSession() 말고 getClaims() 또는 getUser()
const { data } = await supabase.auth.getClaims();
const userId = data?.claims?.sub;
```

분석 이벤트: `await track(supabase, "timer_started", { activity: "tea" })`.
이벤트 이름은 `lib/track.ts`의 `EventName`에 있는 것만 쓴다 (개발계획 3.4와 동일).

## 마이그레이션 규칙

1. 만들기 전에 `git pull origin main`
2. `npx supabase migration new <설명>` 으로 파일 생성 → SQL 작성
3. 로컬 적용: `npx supabase db reset` (로컬 DB를 지우고 전체 마이그레이션 재실행)
4. 타입 재생성: `npm run db:types` → `types/database.ts`를 **같은 PR에 포함**
5. **이미 `main`에 머지된 마이그레이션 파일은 수정하지 않는다.** 고칠 게 있으면 새 파일로
6. 새 테이블은 **반드시 RLS를 켜고 정책을 같이 작성**한다
7. 마이그레이션·RLS·인증이 들어간 PR은 상대 확인 후 머지
8. 원격 반영: `npx supabase link --project-ref <ref>` (최초 1회) 후 `npx supabase db push`

## 현재 스키마

| 테이블/함수 | 내용 |
|---|---|
| `profiles` | 가입 시 트리거로 자동 생성. 닉네임 2~20자, 대소문자 무시 중복 불가. 조회는 로그인 사용자 전체, 수정은 본인만 |
| `is_nickname_available(text)` | 가입 전 닉네임 중복 확인 RPC (비로그인 호출 가능) |
| `events` | 분석 이벤트. insert만 허용 |
| `set_updated_at()` | `updated_at` 자동 갱신 트리거 함수. 새 테이블에서 재사용 |

회원가입 시 닉네임은 `supabase.auth.signUp({ email, password, options: { data: { nickname } } })`로 넘긴다.

## Git 규칙

- 브랜치: `feat/<이름>-<기능>` (예: `feat/taeil-timer`, `feat/woong-chat`). `main` 직접 푸시 금지
- PR은 작게, 설명에 프리뷰 URL과 확인 방법
- 리뷰는 12시간 안에. 넘기면 빌드·린트 통과 시 작성자가 머지 가능 (마이그레이션·RLS·인증 PR 제외)

## 운영 메모

- 문제 계정 정지: Supabase 대시보드 > Authentication > Users > 해당 사용자 > Ban user
- 무료 플랜 프로젝트는 일정 기간 미사용 시 일시 정지되므로 출시 후 주기적으로 확인
