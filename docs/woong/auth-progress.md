# 인증 작업 기록 — 2026-11-07

브랜치: `feat/woong-auth`. `main`의 `21ef426`을 반영하고 로컬에서 구현했다. PR·원격 배포 전 상태다. 디자인 작업은 친구가 별도로 진행 중이라는 요청에 따라 공통 토큰, `components/ui/`, 전역 셸·레이아웃을 수정하지 않았다.

## 구현 범위

- `/signup`: 이메일·닉네임·비밀번호·비밀번호 확인, 개인정보 동의, 만 14세 이상 확인. 닉네임은 앞뒤 공백 제거 후 2~20자로 검사하고 기존 RPC로 중복을 확인한다. `signUp` metadata의 `nickname`을 기존 프로필 생성 트리거에 전달한다.
- `/login`: 이메일·비밀번호 로그인. 보호 경로에서 왔다면 내부 경로와 쿼리를 보존해 복귀하고, 기본 진입은 `/dashboard`로 간다. 외부 URL·프로토콜 상대 URL·역슬래시·제어 문자·인증 페이지 순환 복귀는 거부한다.
- `/mypage`: 기존 준비 중 화면에 재사용 가능한 `LogoutButton`을 추가했다. 로그아웃은 현재 기기의 세션만 종료한다.
- 인증 작업은 Server Actions에서 처리한다. 필수값과 동의는 서버에서도 검증한다. 비밀번호를 Action 응답·분석 이벤트·브라우저 저장소에 넣지 않는다. 실패한 입력은 브라우저 메모리에 유지해 수정·재시도할 수 있다.
- 중복 이메일·닉네임, 잘못된 인증 정보, 비밀번호 확인 불일치, 요청 제한, 연결 오류를 안내한다. 제출 중에는 폼을 잠근다. 이메일 인증이 켜져 세션이 반환되지 않으면 확인 메일 안내 후 수동 로그인으로 이어진다.
- `signup_completed`, `login_completed`는 해당 성공 응답 뒤에 기록한다. 중복 닉네임·실패한 로그인·기존 계정에 대한 난독화 응답은 성공 이벤트로 기록하지 않는다. 분석 연결 실패는 완료된 인증을 실패로 바꾸지 않는다.

## 공유 파일 변경과 디자인 연결

태일 소유인 `lib/supabase/proxy.ts`를 인증 경로 보호 목적으로 수정했다. 기존 세션 갱신을 유지하고 `getClaims()`의 검증 결과로 접근을 판단한다. 로그인 리다이렉트에도 갱신된 쿠키를 복사하고 인증 관련 응답에는 `private, no-store`를 적용한다. 이 교차 수정 내용을 PR 설명에 포함해야 한다.

루트 `proxy.ts`의 matcher는 `_next/`와 favicon만 제외하도록 좁혔다. `/groups/private.png`처럼 확장자가 있는 보호 URL이 이미지 제외 규칙으로 검사를 건너뛰지 않게 한다. 공개 이미지·문서는 로그인 요구 없이 통과한다.

스타일은 `components/auth/auth-form.tsx`, `components/auth/logout-button.tsx`의 기본 폼에만 있다. 친구의 디자인 구현을 합친 뒤 이 파일의 요소를 공통 UI로 교체하면 된다. 필드 `name`, Server Action, 접근성 label·오류 연결, disabled·pending 상태는 유지한다. 전역 셸에서 로그아웃이 필요하면 아래 컴포넌트를 사용할 수 있다.

```tsx
import { LogoutButton } from "@/components/auth/logout-button";

<LogoutButton />;
```

로그인·가입 페이지의 `searchParams` 읽기는 Cache Components 설정에 맞춰 `Suspense` 안에 두었다. 정책 문서 링크는 새 창으로 열어 가입 입력값을 유지한다.

## 로컬 실행과 검증

Docker와 로컬 Supabase를 시작했고, 로컬 프로젝트의 URL과 Publishable key만 `.env.local`에 저장했다. 이 파일은 Git에서 제외된다. 원격 프로젝트와 DB 스키마는 변경하지 않았다.

```bash
npx --no-install supabase start
npm run dev
# http://localhost:3000/login 또는 /signup

npm run test:auth
npm run test:auth:db
npm run lint
npm run typecheck
npm run build

# 최초 브라우저 설치 후 로컬 Supabase 연결값으로 실행
npx --no-install playwright install chromium
npm run test:auth:e2e
```

브라우저 테스트는 앱을 새로 빌드한 뒤 3100 포트에서 프로덕션 서버를 시작하고 로컬 DB에 매번 다른 테스트 계정을 만든다. 개발용 로컬 Supabase에서만 실행한다. 테스트 산출물은 `test-results/`에 저장되고 Git에서 제외된다.

인증 로직 테스트 12개는 입력 검증, 동의 누락, 닉네임 중복과 선점 경쟁, 복귀 URL, 이메일 인증 대기, 성공 이벤트, 연결 실패, 로그아웃, 보호 경로를 검사한다. 실제 브라우저에서는 360px·1440px에서 가입→복귀→새로고침, 만료 쿠키 갱신과 리다이렉트, 로그아웃, 잘못된 비밀번호 후 재시도, 중복 이메일·닉네임, 공개 경로, 연결 실패, 키보드 이동, 위조 쿠키 거부를 검사한다.

로컬 DB 조회로 브라우저 계정마다 `signup_completed`와 `login_completed`가 각 1건씩 기록된 것을 확인했다. 프리뷰·실제 모바일 Safari/Chrome 검수는 아직 하지 않았다.

최종 결과: 인증 로직 테스트 12개, Chromium 브라우저 테스트 6개(데스크톱 3개·모바일 3개), lint·typecheck·프로덕션 build 모두 통과했다. 화면 캡처도 확인했으며, 오류 후 동의 체크가 초기화되던 문제를 수정하고 재검증했다.

추가 검수에서는 실제 로컬 계정 두 개로 프로필 생성·대소문자 무시 닉네임 검사, 본인 프로필 수정·다른 계정 수정 거부, 비로그인 조회 거부, 이벤트 작성자 위조·조회 거부를 확인했다. 로그아웃 후 해당 refresh token으로 세션을 재발급할 수 없고 다른 계정의 세션은 유지되는 것도 확인했다. `test:auth:db`는 상위 테스트와 하위 검증 4개를 포함해 총 5개가 통과했다. 현재 `.env.local`의 Supabase URL은 루프백 주소이며 원격 프로젝트 연결 설정은 없다.

## 남은 작업

- 친구의 공통 UI·디자인 적용 후 인증 화면 연결 및 재검수.
- `/terms`, `/privacy` 본문은 아직 준비 중이다. 실제 정책 본문과 운영 정보가 확정돼야 가입 동의 흐름을 출시할 수 있다.
- 공용 개발 Supabase의 환경변수, 적용된 초기 마이그레이션, 이메일 인증 설정과 비밀번호 정책을 확인하고 프리뷰에서 재검수.
- PR 설명에 `lib/supabase/proxy.ts` 교차 수정, 검증 결과와 프리뷰 URL을 포함하고 인증 변경에 대한 태일 리뷰 후 머지.

참고한 문서: 설치된 Next.js의 `node_modules/next/dist/docs/01-app/02-guides/{forms,authentication,authentication-with-cache-components}.md`, `proxy`, `cookies`, `redirect`, `page` API 문서. Supabase의 [SSR 클라이언트](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [회원가입](https://supabase.com/docs/reference/javascript/auth-signup), [비밀번호 인증](https://supabase.com/docs/guides/auth/passwords) 문서도 확인했다.
