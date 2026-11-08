import Link from "next/link";

// D1 임시 셸. 웅싯이 D2에 디자인 시스템 기반 내비게이션(모바일 하단 탭 / 데스크톱 사이드바)으로 교체한다.
const NAV_ITEMS = [
  { href: "/dashboard", label: "타이머" },
  { href: "/space", label: "찻집" },
  { href: "/me", label: "내 기록" },
  { href: "/community", label: "커뮤니티" },
  { href: "/dm", label: "메시지" },
  { href: "/guide", label: "가이드" },
  { href: "/mypage", label: "마이페이지" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-2 border-ink bg-surface">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-3 text-sm">
          <Link href="/" className="font-mono font-extrabold whitespace-nowrap">
            티어리딩
          </Link>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
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
    </div>
  );
}
