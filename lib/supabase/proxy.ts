import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// 매 요청마다 세션을 확인·갱신하고, 갱신된 쿠키를 응답에 실어 보낸다.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다 (세션 갱신이 꼬임).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  // TODO(웅싯, D2): 로그인 필요 경로 보호.
  // userId가 없고 보호 경로면 `/login?next=<원래 경로>`로 리다이렉트한다.
  // 리다이렉트 응답을 만들 때는 위 response의 쿠키를 그대로 복사해야 세션이 유지된다.
  void userId;

  return response;
}
