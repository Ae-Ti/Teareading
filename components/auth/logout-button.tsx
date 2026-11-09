"use client";

import { useActionState } from "react";
import { unstable_rethrow } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { INITIAL_AUTH_STATE, SERVICE_ERROR } from "@/lib/auth/forms";

// 디자인 셸/마이페이지에서 이 컴포넌트를 가져다 사용할 수 있다.
export function LogoutButton({
  variant = "page",
}: {
  variant?: "page" | "nav";
}) {
  const [state, action, pending] = useActionState(async () => {
    try {
      return await logout();
    } catch (error) {
      unstable_rethrow(error);
      return { status: "error" as const, message: SERVICE_ERROR };
    }
  }, INITIAL_AUTH_STATE);

  const nav = variant === "nav";

  return (
    <form
      action={action}
      aria-busy={pending}
      className={nav ? "relative" : "my-6"}
    >
      <button
        type="submit"
        disabled={pending || state.status === "success"}
        className={
          nav
            ? "rounded-md border-2 border-transparent px-2 py-1 whitespace-nowrap text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-60 md:px-2.5 md:text-ink"
            : "inline-flex min-h-11 items-center rounded-md border-2 border-ink bg-surface px-4 text-sm font-bold shadow-hard transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px disabled:opacity-60 disabled:shadow-none"
        }
      >
        {pending && !nav ? "로그아웃하는 중…" : "로그아웃"}
      </button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            nav
              ? "absolute top-full right-0 z-40 mt-2 w-56 rounded-md border-2 border-ink bg-surface p-2 text-xs shadow-hard-sm"
              : "mt-3 text-sm"
          }
        >
          {state.message}
        </p>
      )}
      {state.redirectTo && (
        <a
          href={state.redirectTo}
          className={nav ? "sr-only" : "mt-3 inline-block underline"}
        >
          로그인 화면으로
        </a>
      )}
    </form>
  );
}
