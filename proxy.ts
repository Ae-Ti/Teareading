import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 실제 프레임워크 정적 경로만 제외한다. /groups/foo.png 같은 보호 경로도 검사한다.
    "/((?!_next/|favicon.ico$).*)",
  ],
};
