import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "@/types/database";
import { MAX_AVATAR_BYTES, PUBLIC_PROFILE_FIELDS } from "@/lib/profile/forms";
import { getPublicProfile, getProfileGroups } from "@/lib/profile/data";
import { saveProfile } from "@/lib/profile/operations";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

test("실제 프로필·아바타 저장과 계정별 권한·공개 범위", async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "로컬 Supabase에서만 실행합니다.",
  );
  const makeClient = () =>
    createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const a = makeClient();
  const b = makeClient();
  const anonymous = makeClient();
  const suffix = randomUUID().slice(0, 8);
  const signupA = await a.auth.signUp({
    email: `profile-a-${suffix}@example.com`,
    password: "Profile-reader-123!",
    options: { data: { nickname: `프로필A${suffix}` } },
  });
  const signupB = await b.auth.signUp({
    email: `profile-b-${suffix}@example.com`,
    password: "Profile-reader-123!",
    options: { data: { nickname: `프로필B${suffix}` } },
  });
  assert.equal(signupA.error, null);
  assert.equal(signupB.error, null);
  const idA = signupA.data.user!.id;
  const idB = signupB.data.user!.id;
  const png = await sharp({
    create: { width: 48, height: 48, channels: 3, background: "#b5d99c" },
  })
    .png()
    .toBuffer();
  const webp = await sharp(png).webp().toBuffer();
  const pathA = `${idA}/${randomUUID()}.webp`;
  let groupId: string | undefined;

  try {
    await t.test(
      "본인 UUID 파일만 업로드하고 남의 파일 쓰기·덮어쓰기·삭제를 거부",
      async () => {
        assert.equal(
          (
            await a.storage
              .from("avatars")
              .upload(pathA, webp, { contentType: "image/webp" })
          ).error,
          null,
        );
        assert.ok(
          (
            await b.storage
              .from("avatars")
              .upload(`${idA}/${randomUUID()}.webp`, webp, {
                contentType: "image/webp",
              })
          ).error,
        );
        assert.ok(
          (
            await anonymous.storage
              .from("avatars")
              .upload(`${idA}/${randomUUID()}.webp`, webp, {
                contentType: "image/webp",
              })
          ).error,
        );
        assert.ok(
          (
            await a.storage
              .from("avatars")
              .upload(`${idA}/not-a-uuid.webp`, webp, {
                contentType: "image/webp",
              })
          ).error,
        );
        assert.ok(
          (
            await b.storage
              .from("avatars")
              .update(pathA, webp, { contentType: "image/webp" })
          ).error,
        );
        await b.storage.from("avatars").remove([pathA]);
        const read = await a.storage.from("avatars").list(idA);
        assert.ok(read.data?.some((item) => item.name === pathA.split("/")[1]));
        const hidden = await b.storage.from("avatars").list(idA);
        assert.deepEqual(hidden.data, []);
      },
    );

    await t.test(
      "버킷이 용량·MIME 제한을 적용하고 개별 아바타는 공개",
      async () => {
        assert.ok(
          (
            await a.storage
              .from("avatars")
              .upload(`${idA}/${randomUUID()}.webp`, png, {
                contentType: "image/png",
              })
          ).error,
        );
        assert.ok(
          (
            await a.storage
              .from("avatars")
              .upload(
                `${idA}/${randomUUID()}.webp`,
                Buffer.alloc(MAX_AVATAR_BYTES + 1),
                { contentType: "image/webp" },
              )
          ).error,
        );
        const publicUrl = a.storage.from("avatars").getPublicUrl(pathA)
          .data.publicUrl;
        const response = await fetch(publicUrl);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /image\/webp/);
      },
    );

    await t.test(
      "프로필 저장은 세션 소유자만 수정하고 중복·오래된 수정은 거부",
      async () => {
        const original = await a
          .from("profiles")
          .select(`${PUBLIC_PROFILE_FIELDS},updated_at`)
          .eq("id", idA)
          .single();
        assert.ok(original.data);
        const form = new FormData();
        form.set("nickname", `수정${suffix}`);
        form.set("bio", "차와 책을 함께 즐겨요.");
        form.set("revision", original.data.updated_at);
        form.set("userId", idB);
        form.set("avatar_url", "https://external.example/attack.webp");
        form.set(
          "avatar",
          new File([new Uint8Array(png)], "photo.png", { type: "image/png" }),
        );
        const saved = await saveProfile(form, async () => a);
        assert.equal(saved.status, "success");
        assert.equal(saved.profile?.id, idA);
        assert.ok(saved.profile?.avatar_url?.includes(`/avatars/${idA}/`));
        const stale = await saveProfile(form, async () => a);
        assert.equal(stale.status, "error");
        assert.match(stale.message ?? "", /다른 화면/);
        const attack = await b
          .from("profiles")
          .update({ bio: "남의 프로필 수정" })
          .eq("id", idA)
          .select("id");
        assert.deepEqual(attack.data, []);
        form.delete("avatar");
        form.set("revision", saved.profile!.updated_at);
        form.set("nickname", signupB.data.user!.user_metadata.nickname);
        const duplicate = await saveProfile(form, async () => a);
        assert.equal(duplicate.status, "error");
        assert.ok(duplicate.errors?.nickname);
      },
    );

    await t.test(
      "공개 프로필은 공개 필드·모임만 반환하며 기록 원문은 타인에게 비공개",
      async () => {
        const privateBody = `비공개 본문 ${suffix}`;
        assert.equal(
          (
            await a
              .from("reading_logs")
              .insert({ book_title: "비공개 책", body: privateBody })
          ).error,
          null,
        );
        assert.equal(
          (
            await a
              .from("tea_columns")
              .insert({ title: "비공개 칼럼", body: privateBody })
          ).error,
          null,
        );
        const group = await a
          .from("groups")
          .insert({
            name: `프로필 검수 ${suffix}`,
            description: "공개 참여 모임",
          })
          .select("id")
          .single();
        assert.equal(group.error, null);
        groupId = group.data!.id;
        const profile = await getPublicProfile(b, idA);
        assert.ok(profile.data);
        assert.deepEqual(
          Object.keys(profile.data).sort(),
          [
            "id",
            "nickname",
            "bio",
            "avatar_url",
            "created_at",
            "is_public",
          ].sort(),
        );
        assert.equal(JSON.stringify(profile.data).includes(privateBody), false);
        const groups = await getProfileGroups(b, idA);
        assert.ok(groups.groups.some((item) => item.id === groupId));
        assert.deepEqual(
          (await b.from("reading_logs").select("body").eq("user_id", idA)).data,
          [],
        );
        assert.deepEqual(
          (await b.from("tea_columns").select("body").eq("user_id", idA)).data,
          [],
        );
        assert.equal((await getPublicProfile(b, "not-a-uuid")).data, null);
        assert.equal((await getPublicProfile(b, randomUUID())).data, null);
      },
    );
  } finally {
    const objects = await a.storage.from("avatars").list(idA);
    if (objects.data?.length)
      await a.storage
        .from("avatars")
        .remove(objects.data.map((item) => `${idA}/${item.name}`));
    if (groupId) await a.from("groups").delete().eq("id", groupId);
    await Promise.allSettled([
      a.auth.signOut({ scope: "local" }),
      b.auth.signOut({ scope: "local" }),
    ]);
  }
});
