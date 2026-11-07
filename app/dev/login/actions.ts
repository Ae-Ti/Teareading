"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 개발 전용 임시 로그인. 웅싯의 /login 이 생기면 이 폴더째 삭제한다.
export async function devLogin(_prev: string | null, formData: FormData) {
  if (process.env.NODE_ENV !== "development")
    return "개발 환경에서만 쓸 수 있어요.";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    if (nickname) {
      const { data: available } = await supabase.rpc("is_nickname_available", {
        p_nickname: nickname,
      });
      if (!available)
        return "이미 쓰는 닉네임이에요. 다른 닉네임을 입력해 주세요.";
    }
    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: { data: nickname ? { nickname } : {} },
    });
    if (signUp.error) return signUp.error.message;
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function devLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/dev/login");
}
