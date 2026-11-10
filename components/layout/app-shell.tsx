import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { RequestCenter } from "@/components/social/request-center";
import { getUser } from "@/lib/supabase/user";
import { NavDesktop, NavMobile, NavTabs } from "./app-nav";

// 로그인 상태에서만 로그아웃 버튼을 보여 준다. 세션을 읽으므로 Suspense 안에서 렌더한다.
async function NavLogout() {
  const { userId } = await getUser();
  return userId ? <LogoutButton variant="nav" /> : null;
}

// 로그인 상태면 어느 화면에서든 수락/거절 창을 받는다
async function SocialLayer() {
  const { userId } = await getUser();
  return userId ? <RequestCenter userId={userId} /> : null;
}

// 전역 레이아웃: 상단 바(데스크톱은 전체 메뉴, 모바일은 로고·가이드·내 프로필) + 모바일 하단 탭 + 푸터
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame flex min-h-dvh flex-col">
      <header className="app-header sticky top-0 z-30 border-b-2 border-ink bg-surface">
        <nav
          aria-label="전체 메뉴"
          className="mx-auto flex h-full max-w-5xl items-center gap-1 px-4 text-sm"
        >
          <Link
            href="/"
            className="mr-3 font-mono text-base font-extrabold whitespace-nowrap"
          >
            티어리딩
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Suspense fallback={<NavDesktop fallback />}>
              <NavDesktop />
            </Suspense>
          </div>
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <Suspense fallback={<NavMobile fallback />}>
              <NavMobile />
            </Suspense>
          </div>
          <div className="md:ml-auto">
            <Suspense fallback={null}>
              <NavLogout />
            </Suspense>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">{children}</main>
      <footer className="site-footer border-t-2 border-ink bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-5 text-sm text-ink-muted">
          <span className="font-mono font-extrabold text-ink">티어리딩</span>
          <Link href="/guide" className="hover:text-ink">
            다도 입문 가이드
          </Link>
          <Link href="/terms" className="hover:text-ink">
            이용약관
          </Link>
          <Link href="/privacy" className="font-bold text-ink hover:underline">
            개인정보처리방침
          </Link>
        </div>
      </footer>
      <Suspense fallback={<NavTabs fallback />}>
        <NavTabs />
      </Suspense>
      <Suspense fallback={null}>
        <SocialLayer />
      </Suspense>
    </div>
  );
}
