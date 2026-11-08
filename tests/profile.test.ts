import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  avatarObjectPath,
  MAX_AVATAR_BYTES,
  validateProfile,
  type EditableProfile,
} from "@/lib/profile/forms";
import { prepareAvatar } from "@/lib/profile/image";
import { saveProfile } from "@/lib/profile/operations";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const owner = "11111111-1111-4111-8111-111111111111";
const oldPath = `${owner}/22222222-2222-4222-8222-222222222222.webp`;
const original: EditableProfile = {
  id: owner,
  nickname: "차읽는사람",
  bio: "기존 소개",
  avatar_url: `${base}/storage/v1/object/public/avatars/${oldPath}`,
  created_at: "2026-11-01T00:00:00+00:00",
  updated_at: "2026-11-07T00:00:00+00:00",
};

function form(values: Record<string, string> = {}, avatar?: File) {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    nickname: " 새 닉네임 ",
    bio: " 새 소개 ",
    revision: original.updated_at,
    ...values,
  }))
    data.set(name, value);
  if (avatar) data.set("avatar", avatar);
  return data;
}
async function png() {
  const buffer = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#b5d99c" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], "original.png", {
    type: "image/png",
  });
}

function backend(
  options: {
    signedOut?: boolean;
    authOffline?: boolean;
    duplicate?: boolean;
    uploadError?: boolean;
    updateError?: string;
    stale?: boolean;
    raced?: boolean;
    trackingError?: boolean;
  } = {},
) {
  const calls: { name: string; value?: unknown }[] = [];
  const current = {
    ...original,
    updated_at: options.stale
      ? "2026-11-07T01:00:00+00:00"
      : original.updated_at,
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.signedOut ? null : { id: owner } },
        error: options.authOffline
          ? { name: "AuthRetryableFetchError", status: 0 }
          : null,
      }),
      getClaims: async () => ({ data: { claims: { sub: owner } } }),
    },
    rpc: async () => ({ data: !options.duplicate, error: null }),
    from: (table: string) => {
      let updates: Record<string, unknown> | null = null;
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          if (updates) calls.push({ name: `filter:${field}`, value });
          return query;
        },
        update: (value: Record<string, unknown>) => {
          updates = value;
          calls.push({ name: "update", value });
          return query;
        },
        maybeSingle: async () => {
          if (!updates) return { data: { ...current }, error: null };
          if (options.updateError)
            return { data: null, error: { code: options.updateError } };
          if (options.raced) return { data: null, error: null };
          Object.assign(current, updates, {
            updated_at: "2026-11-07T02:00:00+00:00",
          });
          return { data: { ...current }, error: null };
        },
        insert: async (value: unknown) => {
          assert.equal(table, "events");
          calls.push({ name: "event", value });
          if (options.trackingError) throw new Error("offline");
          return { error: null };
        },
      };
      return query;
    },
    storage: {
      from: () => ({
        upload: async (path: string, image: Buffer, settings: unknown) => {
          calls.push({
            name: "upload",
            value: { path, settings, bytes: image.length },
          });
          return {
            error: options.uploadError ? { message: "private error" } : null,
          };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `${base}/storage/v1/object/public/avatars/${path}`,
          },
        }),
        remove: async (paths: string[]) => {
          calls.push({ name: "remove", value: paths });
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient<Database>;
  return { create: async () => client, calls, current };
}

test("프로필 입력은 DB와 같은 유니코드 문자 수로 검증한다", () => {
  const result = validateProfile(
    form({ nickname: " 😀😀 ", bio: "🌿".repeat(100) }),
  );
  assert.deepEqual(result.errors, {});
  assert.equal(result.nickname, "😀😀");
  const invalid = validateProfile(
    form({ nickname: "a", bio: "x".repeat(101) }),
  );
  assert.ok(invalid.errors.nickname && invalid.errors.bio);
});

test("파일 용량·형식과 이미지 삭제 동시 요청을 서버에서 검사", async () => {
  const oversized = new File(
    [new Uint8Array(MAX_AVATAR_BYTES + 1)],
    "large.png",
    { type: "image/png" },
  );
  assert.ok(validateProfile(form({}, oversized)).errors.avatar);
  assert.ok(
    validateProfile(
      form({}, new File(["svg"], "avatar.svg", { type: "image/svg+xml" })),
    ).errors.avatar,
  );
  assert.ok(
    validateProfile(form({ removeAvatar: "on" }, await png())).errors.avatar,
  );
  let called = false;
  const response = await saveProfile(form({}, oversized), async () => {
    called = true;
    throw new Error("must not call");
  });
  assert.equal(response.status, "error");
  assert.equal(called, false);
});

test("실제 이미지를 WebP로 변환하고 위장 파일·손상 파일을 거부", async () => {
  const output = await prepareAvatar(await png());
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width! <= 512 && metadata.height! <= 512);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(
    prepareAvatar(
      new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "fake.png", {
        type: "image/png",
      }),
    ),
  );
  await assert.rejects(
    prepareAvatar(
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0])], "broken.jpg", {
        type: "image/jpeg",
      }),
    ),
  );
  const wrongMime = new File([await (await png()).arrayBuffer()], "fake.webp", {
    type: "image/webp",
  });
  await assert.rejects(prepareAvatar(wrongMime));
});

test("표시·삭제할 아바타는 프로젝트 URL과 본인 폴더만 신뢰", () => {
  assert.equal(avatarObjectPath(original.avatar_url, owner), oldPath);
  assert.equal(avatarObjectPath(original.avatar_url, "other"), null);
  for (const value of [
    "https://external.example/avatar.webp",
    `${original.avatar_url}?tracking=1`,
    `${base}/storage/v1/object/public/avatars/${owner}/../secret.webp`,
    "javascript:alert(1)",
  ])
    assert.equal(avatarObjectPath(value), null);
});

test("인증·닉네임 중복·수정 버전을 확인하고 기존 프로필 유지", async () => {
  for (const options of [
    { signedOut: true },
    { duplicate: true },
    { stale: true },
  ]) {
    const fake = backend(options);
    assert.equal((await saveProfile(form(), fake.create)).status, "error");
    assert.equal(
      fake.calls.some(
        (call) => call.name === "update" || call.name === "event",
      ),
      false,
    );
    assert.equal(fake.current.bio, original.bio);
  }
});

test("인증 서버 연결 실패는 입력값을 유지하며 재시도하고 강제 로그아웃하지 않는다", async () => {
  const fake = backend({ authOffline: true });
  const result = await saveProfile(form(), fake.create);
  assert.equal(result.status, "error");
  assert.equal(result.redirectTo, undefined);
  assert.equal(
    fake.calls.some((call) => call.name === "update"),
    false,
  );
});

test("본인 ID로만 수정하고 프로필 저장 성공 후 이벤트 한 번 기록", async () => {
  const fake = backend();
  const response = await saveProfile(
    form({
      userId: "other-user",
      avatar_url: "https://external.example/attack",
    }),
    fake.create,
  );
  assert.equal(response.status, "success");
  assert.equal(response.profile?.nickname, "새 닉네임");
  assert.equal(response.profile?.avatar_url, original.avatar_url);
  assert.ok(
    fake.calls.some(
      (call) => call.name === "filter:id" && call.value === owner,
    ),
  );
  assert.ok(
    fake.calls.some(
      (call) =>
        call.name === "filter:updated_at" && call.value === original.updated_at,
    ),
  );
  assert.equal(fake.calls.filter((call) => call.name === "event").length, 1);
});

test("업로드 실패 시 프로필과 기존 아바타를 바꾸지 않는다", async () => {
  const fake = backend({ uploadError: true });
  assert.equal(
    (await saveProfile(form({}, await png()), fake.create)).status,
    "error",
  );
  assert.equal(
    fake.calls.some(
      (call) =>
        call.name === "update" ||
        call.name === "remove" ||
        call.name === "event",
    ),
    false,
  );
  assert.equal(fake.current.avatar_url, original.avatar_url);
});

test("업로드 뒤 DB 실패·중복 닉네임·동시 수정이면 새 파일만 롤백", async () => {
  for (const options of [
    { updateError: "connection_error" },
    { updateError: "23505" },
    { raced: true },
  ]) {
    const fake = backend(options);
    const result = await saveProfile(form({}, await png()), fake.create);
    assert.equal(result.status, "error");
    const removed = fake.calls.filter((call) => call.name === "remove");
    assert.equal(removed.length, 1);
    assert.notDeepEqual(removed[0].value, [oldPath]);
    assert.equal(fake.current.avatar_url, original.avatar_url);
    assert.equal(
      fake.calls.some((call) => call.name === "event"),
      false,
    );
  }
});

test("교체·삭제는 DB 성공 뒤 이전 파일을 정리하고 분석 오류는 저장 성공 유지", async () => {
  const replacement = backend({ trackingError: true });
  assert.equal(
    (await saveProfile(form({}, await png()), replacement.create)).status,
    "success",
  );
  assert.deepEqual(
    replacement.calls.find((call) => call.name === "remove")?.value,
    [oldPath],
  );
  const removal = backend();
  const result = await saveProfile(
    form({ removeAvatar: "on" }),
    removal.create,
  );
  assert.equal(result.profile?.avatar_url, null);
  assert.deepEqual(
    removal.calls.find((call) => call.name === "remove")?.value,
    [oldPath],
  );
});
