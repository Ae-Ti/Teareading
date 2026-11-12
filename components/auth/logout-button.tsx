"use client";

import { useState } from "react";

// 로그아웃은 페이지 이동으로 보낸다 (app/auth/logout/route.ts).
// 브라우저가 화면을 새로 불러와 이전 사용자의 화면 캐시가 남지 않는다.
export function LogoutButton({
  variant = "page",
}: {
  variant?: "page" | "nav";
}) {
  const [pending, setPending] = useState(false);
  const nav = variant === "nav";

  return (
    <form
      method="post"
      action="/auth/logout"
      onSubmit={() => setPending(true)}
      aria-busy={pending}
      className={nav ? "relative" : "my-6"}
    >
      <button
        type="submit"
        disabled={pending}
        className={
          nav
            ? "rounded-md border-2 border-transparent px-2 py-1 whitespace-nowrap text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-60 md:px-2.5 md:text-ink"
            : "inline-flex min-h-11 items-center rounded-md border-2 border-ink bg-surface px-4 text-sm font-bold shadow-hard transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px disabled:opacity-60 disabled:shadow-none"
        }
      >
        {pending && !nav ? "로그아웃하는 중…" : "로그아웃"}
      </button>
    </form>
  );
}
