import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { authenticate, endSession } from "@/lib/auth/operations";
import { SERVICE_ERROR, validateAuthForm } from "@/lib/auth/forms";
import { isProtectedPath, safeNextPath } from "@/lib/auth/paths";
import { updateSession } from "@/lib/supabase/proxy";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: " reader@example.com ",
    password: " pass word ",
    passwordConfirmation: " pass word ",
    nickname: " 차읽는사람 ",
    privacyConsent: "on",
    ageConfirmed: "on",
    next: "/me/reading?sort=recent",
    device: "mobile",
    ...overrides,
  })) {
    data.set(key, value);
  }
  return data;
}

function backend(
  options: {
    available?: boolean;
    racedNickname?: boolean;
    rpcError?: boolean;
    authError?: string;
    confirmation?: boolean;
    obfuscated?: boolean;
    offline?: boolean;
    trackingOffline?: boolean;
    logoutError?: boolean;
  } = {},
) {
  const calls: { name: string; input?: unknown }[] = [];
  let rpcCount = 0;
  const authResult = async (input: unknown) => {
    calls.push({ name: "auth", input });
    if (options.offline) throw new Error("private infrastructure error");
    return {
      data: {
        user: { id: "user-1", identities: options.obfuscated ? [] : [{}] },
        session: options.confirmation ? null : { access_token: "test" },
      },
      error: options.authError ? { code: options.authError } : null,
    };
  };
  const client = {
    rpc: async () => {
      rpcCount++;
      calls.push({ name: "nickname" });
      return {
        data:
          options.available !== false &&
          !(options.racedNickname && rpcCount > 1),
        error: options.rpcError ? { message: "private SQL error" } : null,
      };
    },
    auth: {
      signUp: authResult,
      signInWithPassword: authResult,
      getClaims: async () => ({
        data: { claims: { sub: options.confirmation ? null : "user-1" } },
      }),
      signOut: async (input: unknown) => {
        calls.push({ name: "logout", input });
        if (options.offline) throw new Error("offline");
        return { error: options.logoutError ? { message: "offline" } : null };
      },
    },
    from: () => ({
      insert: async (input: unknown) => {
        calls.push({ name: "event", input });
        if (options.trackingOffline) throw new Error("analytics offline");
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient<Database>;
  return { calls, create: async () => client };
}

test("복귀 경로는 내부 URL만 허용하며 쿼리를 보존한다", () => {
  assert.equal(
    safeNextPath("/me/reading?tag=tea#recent"),
    "/me/reading?tag=tea#recent",
  );
  for (const value of [
    undefined,
    ["/me", "//evil.example"],
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/%2fevil.example",
    "/hello/..//evil.example",
    "/\nevil.example",
    "/me%0d%0aLocation:evil",
    "javascript:alert(1)",
    "/%",
    "/login?next=/login",
    "/signup/",
    "/me/../login",
  ]) {
    assert.equal(safeNextPath(value), "/dashboard", String(value));
  }
});

test("보호 경로는 하위 경로·파일 확장자까지 포함하고 비슷한 접두사는 제외한다", () => {
  for (const path of [
    "/dashboard",
    "/me/reading",
    "/groups/foo.png",
    "/u/id",
    "/dm/id",
  ]) {
    assert.equal(isProtectedPath(path), true);
  }
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/guide",
    "/terms",
    "/privacy",
    "/membership",
  ]) {
    assert.equal(isProtectedPath(path), false);
  }
});

test("가입 입력은 서버에서 검증하고 비밀번호 공백은 보존한다", () => {
  const result = validateAuthForm("signup", form());
  assert.equal(result.valid, true);
  assert.equal(result.password, " pass word ");
  assert.equal(result.values.email, "reader@example.com");
  assert.equal(result.values.nickname, "차읽는사람");
  assert.equal(
    validateAuthForm("signup", form({ nickname: "😀😀" })).valid,
    true,
  );
});

test("잘못된 가입 요청은 인증 서버 호출 전에 차단하고 비밀번호를 응답에 넣지 않는다", async () => {
  let calls = 0;
  const result = await authenticate(
    "signup",
    form({
      email: "bad",
      nickname: "a",
      password: "123",
      passwordConfirmation: "456",
      privacyConsent: "",
      ageConfirmed: "",
    }),
    async () => {
      calls++;
      throw new Error("must not run");
    },
  );
  assert.equal(calls, 0);
  assert.equal(Object.keys(result.errors ?? {}).length, 6);
  assert.equal(JSON.stringify(result).includes('"password":"123"'), false);
});

test("중복 닉네임과 RPC 오류는 가입·성공 이벤트를 만들지 않는다", async () => {
  for (const options of [{ available: false }, { rpcError: true }]) {
    const fake = backend(options);
    const result = await authenticate("signup", form(), fake.create);
    assert.equal(result.status, "error");
    assert.deepEqual(
      fake.calls.map((call) => call.name),
      ["nickname"],
    );
  }
});

test("가입은 닉네임을 metadata로 전달하고 성공 이벤트를 한 번 기록한다", async () => {
  const fake = backend();
  const result = await authenticate("signup", form(), fake.create);
  assert.equal(result.status, "success");
  assert.equal(result.redirectTo, "/me/reading?sort=recent");
  assert.deepEqual(fake.calls.find((call) => call.name === "auth")?.input, {
    email: "reader@example.com",
    password: " pass word ",
    options: { data: { nickname: "차읽는사람" } },
  });
  assert.deepEqual(
    fake.calls.filter((call) => call.name === "event"),
    [
      {
        name: "event",
        input: {
          user_id: "user-1",
          name: "signup_completed",
          props: {},
          device: "mobile",
        },
      },
    ],
  );
});

test("로그인 성공·실패와 외부 복귀 URL을 처리한다", async () => {
  const fake = backend();
  const result = await authenticate(
    "login",
    form({ next: "//evil.example" }),
    fake.create,
  );
  assert.equal(result.redirectTo, "/dashboard");
  assert.deepEqual(
    fake.calls.map((call) => call.name),
    ["auth", "event"],
  );
  const failed = backend({ authError: "invalid_credentials" });
  const failure = await authenticate("login", form(), failed.create);
  assert.match(failure.message ?? "", /이메일 또는 비밀번호/);
  assert.equal(
    failed.calls.some((call) => call.name === "event"),
    false,
  );
});

test("이메일 중복·인증 대기·난독화 응답을 실제 로그인 성공과 구별한다", async () => {
  const duplicate = backend({ authError: "user_already_exists" });
  const error = await authenticate("signup", form(), duplicate.create);
  assert.match(error.message ?? "", /이미 가입된 이메일/);
  assert.equal(
    duplicate.calls.some((call) => call.name === "event"),
    false,
  );
  const confirmation = backend({ confirmation: true });
  const pending = await authenticate("signup", form(), confirmation.create);
  assert.equal(pending.status, "confirm-email");
  assert.equal(pending.redirectTo, undefined);
  const existing = backend({ confirmation: true, obfuscated: true });
  assert.equal(
    (await authenticate("signup", form(), existing.create)).status,
    "error",
  );
  assert.equal(
    existing.calls.some((call) => call.name === "event"),
    false,
  );
});

test("사전 중복 검사 뒤 닉네임 선점 경쟁도 오류로 처리한다", async () => {
  const fake = backend({
    authError: "unexpected_failure",
    racedNickname: true,
  });
  const result = await authenticate("signup", form(), fake.create);
  assert.match(result.errors?.nickname ?? "", /사용 중/);
  assert.equal(
    fake.calls.some((call) => call.name === "event"),
    false,
  );
});

test("연결 실패는 일반 안내로 반환하고 분석 실패는 인증 성공을 막지 않는다", async () => {
  const offline = backend({ offline: true });
  const failed = await authenticate("login", form(), offline.create);
  assert.equal(failed.message, SERVICE_ERROR);
  assert.equal(
    JSON.stringify(failed).includes("private infrastructure"),
    false,
  );
  const tracking = backend({ trackingOffline: true });
  assert.equal(
    (await authenticate("login", form(), tracking.create)).status,
    "success",
  );
});

test("로그아웃은 현재 기기 세션을 종료하고 실패 시 성공으로 안내하지 않는다", async () => {
  const fake = backend();
  assert.equal(
    (await endSession(fake.create)).redirectTo,
    "/login?loggedOut=1",
  );
  assert.deepEqual(fake.calls, [{ name: "logout", input: { scope: "local" } }]);
  const failed = backend({ logoutError: true });
  assert.equal((await endSession(failed.create)).status, "error");
});

test("비로그인 직접 접근은 로그인으로 보내고 원래 쿼리와 no-store를 유지한다", async () => {
  const response = await updateSession(
    new NextRequest("http://localhost:3000/groups/123/chat?from=invite"),
  );
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.pathname, "/login");
  assert.equal(
    location.searchParams.get("next"),
    "/groups/123/chat?from=invite",
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const publicResponse = await updateSession(
    new NextRequest("http://localhost:3000/privacy"),
  );
  assert.equal(publicResponse.headers.get("location"), null);
});
