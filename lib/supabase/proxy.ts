import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isAuthConfigured } from "@/lib/auth/config";
import { isAuthPath, isProtectedPath, safeNextPath } from "@/lib/auth/paths";

function loginResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(url, 303);
}

function preserveSession(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) target.headers.set(name, value);
  }
  target.headers.set("Cache-Control", "private, no-store");
  return target;
}

// 매 요청마다 세션을 확인·갱신하고, 갱신된 쿠키를 응답에 실어 보낸다.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isAuthConfigured()) {
    // 환경변수가 없어도 공개 페이지는 표시하고, 보호 페이지는 로그인으로 보낸다.
    return isProtectedPath(request.nextUrl.pathname)
      ? preserveSession(response, loginResponse(request))
      : response;
  }

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
  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error) userId = data?.claims?.sub ?? null;
  } catch {
    // 인증 서버 연결 실패 시에도 보호 페이지를 통과시키지 않는다.
  }

  const pathname = request.nextUrl.pathname;
  // 서버 함수 요청(저장 등)은 함수 안의 requireUser가 로그인으로 보낸다.
  // 여기서 로그인 화면 HTML을 돌려주면 화면이 오류로 바뀐다.
  const isServerAction =
    request.method === "POST" && request.headers.has("next-action");
  if (!userId && isProtectedPath(pathname) && !isServerAction) {
    return preserveSession(response, loginResponse(request));
  }
  if (
    userId &&
    isAuthPath(pathname) &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    const url = request.nextUrl.clone();
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return preserveSession(
      response,
      NextResponse.redirect(new URL(next, url.origin)),
    );
  }
  // 랜딩(웅싯): 로그인 상태로 `/`에 오면 화면을 그리기 전에 대시보드로 보낸다 (깜박임·반복 이동 없음)
  if (
    userId &&
    pathname === "/" &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    return preserveSession(
      response,
      NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin)),
    );
  }
  if (isProtectedPath(pathname) || isAuthPath(pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}
