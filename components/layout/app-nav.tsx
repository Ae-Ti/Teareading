"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { UnreadBadge } from "./unread-badge";

type Item = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  // 이 경로들 아래에 있으면 활성 표시
  match?: string[];
  // 안 읽은 메시지 개수를 표시
  unread?: boolean;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden {...stroke}>
      {children}
    </svg>
  );
}

// 모바일 하단 탭: 매일 쓰는 여섯 곳
const TABS: Item[] = [
  {
    href: "/dashboard",
    label: "타이머",
    match: ["/dashboard", "/attendance"],
    icon: (
      <Icon>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 13V9M10 2h4" />
      </Icon>
    ),
  },
  {
    href: "/space",
    label: "찻집",
    icon: (
      <Icon>
        <path d="M4 10h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
        <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" />
      </Icon>
    ),
  },
  {
    href: "/me",
    label: "내 기록",
    icon: (
      <Icon>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <path d="M9 9h6M9 13h4" />
      </Icon>
    ),
  },
  {
    href: "/community",
    label: "커뮤니티",
    match: ["/community", "/groups"],
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.6a5 5 0 0 1 5 5.4" />
      </Icon>
    ),
  },
  {
    href: "/board",
    label: "게시판",
    icon: (
      <Icon>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </Icon>
    ),
  },
  {
    href: "/dm",
    label: "메시지",
    unread: true,
    icon: (
      <Icon>
        <path d="M4 5h16v11H10l-6 4z" />
      </Icon>
    ),
  },
];

const EXTRA: Item[] = [
  { href: "/guide", label: "가이드" },
  { href: "/mypage", label: "내 프로필", match: ["/mypage", "/u"] },
];

// 로그인 전 화면에서는 하단 탭을 숨긴다
const NO_TABS = ["/", "/login", "/signup"];

function isActive(item: Item, pathname: string | null) {
  if (!pathname) return false;
  return (item.match ?? [item.href]).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function DesktopLinks({ pathname }: { pathname: string | null }) {
  return (
    <>
      {[...TABS, ...EXTRA].map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md border-2 px-2.5 py-1 whitespace-nowrap transition",
              active
                ? "border-ink bg-matcha font-bold"
                : "border-transparent hover:bg-sunken",
            )}
          >
            {item.label}
            {item.unread && (
              <UnreadBadge pathname={pathname} className="-top-2.5 -right-2" />
            )}
          </Link>
        );
      })}
    </>
  );
}

function MobileLinks({ pathname }: { pathname: string | null }) {
  return (
    <>
      {EXTRA.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-1 whitespace-nowrap",
              active ? "bg-matcha font-bold" : "text-ink-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function Tabs({ pathname }: { pathname: string | null }) {
  if (pathname && NO_TABS.includes(pathname)) return null;
  return (
    <nav
      aria-label="주요 메뉴"
      className="app-tabbar fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-6">
        {TABS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative m-0.5 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] whitespace-nowrap",
                  active ? "bg-matcha font-bold" : "text-ink-muted",
                )}
              >
                {item.icon}
                {item.label}
                {item.unread && (
                  <UnreadBadge
                    pathname={pathname}
                    className="top-0.5 right-[calc(50%-1.5rem)]"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// usePathname은 동적 경로에서 잠시 멈출 수 있어(Cache Components), 활성 표시 없는 같은 모양을 대체 화면으로 쓴다.
function WithPathname({
  render,
}: {
  render: (pathname: string | null) => React.ReactNode;
}) {
  return render(usePathname());
}

export function NavDesktop({ fallback = false }: { fallback?: boolean }) {
  if (fallback) return <DesktopLinks pathname={null} />;
  return <WithPathname render={(p) => <DesktopLinks pathname={p} />} />;
}

export function NavMobile({ fallback = false }: { fallback?: boolean }) {
  if (fallback) return <MobileLinks pathname={null} />;
  return <WithPathname render={(p) => <MobileLinks pathname={p} />} />;
}

export function NavTabs({ fallback = false }: { fallback?: boolean }) {
  if (fallback) return <Tabs pathname={null} />;
  return <WithPathname render={(p) => <Tabs pathname={p} />} />;
}
