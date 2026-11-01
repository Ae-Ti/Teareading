import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// 클라이언트 컴포넌트용. 브라우저에서 호출할 때마다 같은 인스턴스를 재사용한다.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
