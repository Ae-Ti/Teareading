import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { endSession } from "@/lib/auth/operations";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

test("실제 로컬 Supabase의 계정·프로필·이벤트 권한과 세션 종료", async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "로컬 Supabase 연결값이 필요합니다.");
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "이 테스트는 로컬 Supabase에서만 실행합니다.",
  );
  const client = () =>
    createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  const a = client();
  const b = client();
  const anonymous = client();
  const suffix = randomUUID().slice(0, 8);
  const nicknameA = `ReviewA${suffix}`;
  const signupA = await a.auth.signUp({
    email: `review-a-${suffix}@example.com`,
    password: "Review-reader-123!",
    options: { data: { nickname: nicknameA } },
  });
  const signupB = await b.auth.signUp({
    email: `review-b-${suffix}@example.com`,
    password: "Review-reader-123!",
    options: { data: { nickname: `ReviewB${suffix}` } },
  });
  assert.equal(signupA.error, null);
  assert.equal(signupB.error, null);
  assert.ok(signupA.data.user && signupA.data.session);
  assert.ok(signupB.data.user && signupB.data.session);
  const idA = signupA.data.user.id;
  const idB = signupB.data.user.id;

  try {
    await t.test(
      "프로필 생성 트리거와 대소문자 무시 닉네임 중복 확인",
      async () => {
        const profile = await a
          .from("profiles")
          .select("id,nickname")
          .eq("id", idA)
          .single();
        assert.equal(profile.error, null);
        assert.equal(profile.data?.nickname, nicknameA);
        const available = await anonymous.rpc("is_nickname_available", {
          p_nickname: nicknameA.toUpperCase(),
        });
        assert.equal(available.error, null);
        assert.equal(available.data, false);
      },
    );

    await t.test(
      "본인 프로필만 수정 가능하고 비로그인 조회는 거부",
      async () => {
        const own = await a
          .from("profiles")
          .update({ bio: "본인 수정 확인" })
          .eq("id", idA)
          .select("id,bio")
          .single();
        assert.equal(own.error, null);
        assert.equal(own.data?.bio, "본인 수정 확인");
        const intrusion = await b
          .from("profiles")
          .update({ bio: "다른 계정의 수정 시도" })
          .eq("id", idA)
          .select("id");
        assert.equal(intrusion.error, null);
        assert.deepEqual(intrusion.data, []);
        const unchanged = await a
          .from("profiles")
          .select("bio")
          .eq("id", idA)
          .single();
        assert.equal(unchanged.data?.bio, "본인 수정 확인");
        const publicRead = await anonymous
          .from("profiles")
          .select("id")
          .eq("id", idA);
        assert.equal(publicRead.error, null);
        assert.deepEqual(publicRead.data, []);
      },
    );

    await t.test(
      "이벤트 작성자 위조와 이용자 측 이벤트 조회를 거부",
      async () => {
        const spoofed = await b
          .from("events")
          .insert({ user_id: idA, name: "signup_completed" });
        assert.equal(spoofed.error?.code, "42501");
        const unauthenticated = await anonymous
          .from("events")
          .insert({ user_id: idB, name: "signup_completed" });
        assert.equal(unauthenticated.error?.code, "42501");
        const own = await b
          .from("events")
          .insert({ user_id: idB, name: "signup_completed" });
        assert.equal(own.error, null);
        const read = await b.from("events").select("id");
        assert.equal(read.error, null);
        assert.deepEqual(read.data, []);
      },
    );

    await t.test(
      "로그아웃한 세션은 갱신할 수 없고 다른 계정 세션은 유지",
      async () => {
        const result = await endSession(async () => b);
        assert.equal(result.status, "success");
        const refresh = await client().auth.refreshSession({
          refresh_token: signupB.data.session!.refresh_token,
        });
        assert.ok(refresh.error);
        assert.equal(refresh.data.session, null);
        const unaffected = await a.auth.getUser();
        assert.equal(unaffected.error, null);
        assert.equal(unaffected.data.user?.id, idA);
      },
    );
  } finally {
    await Promise.allSettled([
      a.auth.signOut({ scope: "local" }),
      b.auth.signOut({ scope: "local" }),
    ]);
  }
});
