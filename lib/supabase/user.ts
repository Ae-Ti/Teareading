import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "./server";

// TODO(웅싯): /login 화면이 생기면 개발용 로그인 분기를 지운다.
const LOGIN_PATH =
  process.env.NODE_ENV === "development" ? "/dev/login" : "/login";

// 로그인 사용자 확인. 서버 컴포넌트와 서버 함수에서 쓴다.
export async function getUser() {
  // 세션 확인(getClaims)은 내부에서 현재 시각을 쓰므로 요청 시점에 실행되게 한다 (Cache Components 규칙)
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

// 로그인이 필요한 화면·서버 함수용. 비로그인이면 로그인 화면으로 보내고, 로그인 후 next로 돌아온다.
export async function requireUser(next: string) {
  const { supabase, userId } = await getUser();
  if (!userId) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}
