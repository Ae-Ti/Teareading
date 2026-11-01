import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// 서버 컴포넌트, 서버 함수, 라우트 핸들러용. 요청마다 새로 만든다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없다.
            // 세션 갱신은 proxy.ts가 맡으므로 무시해도 된다.
          }
        },
      },
    },
  );
}
