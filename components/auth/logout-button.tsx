"use client";

import { useActionState } from "react";
import { unstable_rethrow } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { INITIAL_AUTH_STATE, SERVICE_ERROR } from "@/lib/auth/forms";

// 디자인 셸/마이페이지에서 이 컴포넌트를 가져다 사용할 수 있다.
export function LogoutButton() {
  const [state, action, pending] = useActionState(async () => {
    try {
      return await logout();
    } catch (error) {
      unstable_rethrow(error);
      return { status: "error" as const, message: SERVICE_ERROR };
    }
  }, INITIAL_AUTH_STATE);

  return (
    <form action={action} aria-busy={pending} className="my-6">
      <button
        type="submit"
        disabled={pending || state.status === "success"}
        className="inline-flex min-h-11 items-center rounded-md border-2 border-ink bg-surface px-4 text-sm font-bold shadow-hard transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px disabled:opacity-60 disabled:shadow-none"
      >
        {pending ? "로그아웃하는 중…" : "로그아웃"}
      </button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="mt-3 text-sm"
        >
          {state.message}
        </p>
      )}
      {state.redirectTo && (
        <a href={state.redirectTo} className="mt-3 inline-block underline">
          로그인 화면으로
        </a>
      )}
    </form>
  );
}
