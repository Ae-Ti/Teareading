"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/profile/avatar";

const ITEMS = [
  { href: "/mypage", label: "프로필 정보" },
  { href: "/mypage/settings", label: "개인 설정" },
  { href: "/me/reading", label: "내 서재" },
  { href: "/me/columns", label: "내 차칼럼" },
];

// 상단 바 오른쪽: 프로필 사진과 닉네임 버튼. 누르면 내 메뉴가 열린다.
export function ProfileMenu({
  nickname,
  avatarUrl,
}: {
  nickname: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${nickname} 메뉴`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border-2 border-transparent px-1.5 py-0.5 font-bold hover:bg-sunken aria-expanded:border-ink aria-expanded:bg-matcha"
      >
        <ProfileAvatar nickname={nickname} src={avatarUrl} size="xs" />
        <span className="max-w-20 truncate md:max-w-32">{nickname}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="내 메뉴"
          className="absolute top-full right-0 z-40 mt-1 w-36 rounded-md border-2 border-ink bg-surface p-1 shadow-hard"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-sm px-2.5 py-1.5 font-bold whitespace-nowrap hover:bg-sunken"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
