import type { NextRequest } from "next/server";
import { endSession } from "@/lib/auth/operations";
import { createClient } from "@/lib/supabase/server";

// 로그아웃. 폼을 페이지 이동으로 보내 브라우저가 화면을 새로 불러오게 한다.
// 화면 내 이동(서버 함수)으로 처리하면 뒤로 가기 때 이전 사용자의 상단 바가 남는다.
export async function POST(request: NextRequest) {
  // 다른 사이트에서 보낸 로그아웃 요청은 받지 않는다
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new Response(null, { status: 403 });
  }
  const result = await endSession(createClient);
  const to =
    result.status === "success"
      ? (result.redirectTo ?? "/login?loggedOut=1")
      : "/mypage?logoutError=1";
  return new Response(null, {
    status: 303,
    headers: { Location: to, "Cache-Control": "private, no-store" },
  });
}
