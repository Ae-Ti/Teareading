import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { deleteAccount } from "@/lib/account";
import { insertMessage } from "@/lib/chat/rooms";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 회원 탈퇴와 아바타 저장 개수 제한. 로컬 Supabase에서만 실행한다.
test("회원 탈퇴는 본인 데이터만 지우고, 아바타는 폴더당 2개까지", async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "로컬 Supabase 연결값이 필요합니다.");
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "로컬 Supabase에서만 실행합니다.",
  );
  const makeClient = () =>
    createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const suffix = randomUUID().slice(0, 8);
  const password = "Account-reader-123!";
  async function signUp(label: string) {
    const c = makeClient();
    const email = `account-${label}-${suffix}@example.com`;
    const { data, error } = await c.auth.signUp({
      email,
      password,
      options: { data: { nickname: `탈퇴${label}${suffix}` } },
    });
    assert.equal(error, null);
    assert.ok(data.user && data.session);
    return { c, id: data.user.id, email };
  }
  const a = await signUp("A");
  const b = await signUp("B");
  const webp = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#b5d99c" },
  })
    .webp()
    .toBuffer();
  const upload = (who: typeof a) =>
    who.c.storage
      .from("avatars")
      .upload(`${who.id}/${randomUUID()}.webp`, webp, {
        contentType: "image/webp",
      });

  await t.test("아바타는 본인 폴더에 2개까지만 올릴 수 있다", async () => {
    const first = await upload(a);
    const second = await upload(a);
    assert.equal(first.error, null);
    assert.equal(second.error, null);
    const third = await upload(a);
    assert.ok(third.error, "세 번째 업로드는 거부");
    // 하나를 지우면 다시 올릴 수 있다
    await a.c.storage.from("avatars").remove([second.data!.path]);
    assert.equal((await upload(a)).error, null);
    // 다른 사람 폴더 개수와는 무관
    assert.equal((await upload(b)).error, null);
  });

  await t.test("비로그인은 탈퇴 함수를 부를 수 없다", async () => {
    const res = await makeClient().rpc("delete_my_account");
    assert.ok(res.error);
  });

  await t.test(
    "탈퇴하면 계정·프로필·이미지·모임·대화가 지워지고 상대는 남는다",
    async () => {
      // A의 모임(B 가입·채팅), A↔B DM
      const group = await a.c
        .from("groups")
        .insert({ name: `탈퇴 모임 ${suffix}` })
        .select("id")
        .single();
      assert.equal(group.error, null);
      const groupId = group.data!.id;
      await b.c
        .from("group_members")
        .insert({ group_id: groupId, user_id: b.id });
      assert.ok(
        (
          await insertMessage(
            b.c,
            { kind: "group", id: groupId },
            b.id,
            randomUUID(),
            "안녕",
          )
        ).ok,
      );
      const dm = await a.c.rpc("start_dm", { p_other: b.id });
      const threadId = (dm.data as { id: string }).id;
      assert.ok(
        (
          await insertMessage(
            a.c,
            { kind: "dm", id: threadId },
            a.id,
            randomUUID(),
            "DM",
          )
        ).ok,
      );

      const files = await a.c.storage.from("avatars").list(a.id);
      assert.ok(files.data!.length > 0);
      const publicUrl = a.c.storage
        .from("avatars")
        .getPublicUrl(`${a.id}/${files.data![0].name}`).data.publicUrl;
      assert.equal((await fetch(publicUrl)).status, 200);

      const result = await deleteAccount(a.c, a.id);
      assert.deepEqual(result, { ok: true });

      // 공개 URL로도 더 이상 이미지가 보이지 않는다
      assert.notEqual((await fetch(publicUrl)).status, 200);
      // 다른 사람 눈에 프로필·모임·대화가 사라진다
      const profile = await b.c.from("profiles").select("id").eq("id", a.id);
      assert.equal(profile.data?.length, 0);
      const groups = await b.c.from("groups").select("id").eq("id", groupId);
      assert.equal(groups.data?.length, 0);
      const threads = await b.c
        .from("dm_threads")
        .select("id")
        .eq("id", threadId);
      assert.equal(threads.data?.length, 0);
      // B는 그대로
      const me = await b.c.from("profiles").select("id").eq("id", b.id);
      assert.equal(me.data?.length, 1);
      // 같은 이메일로 다시 로그인할 수 없다
      const relogin = await makeClient().auth.signInWithPassword({
        email: a.email,
        password,
      });
      assert.ok(relogin.error);
    },
  );

  // 정리: B의 아바타 파일
  const left = await b.c.storage.from("avatars").list(b.id);
  if (left.data?.length)
    await b.c.storage
      .from("avatars")
      .remove(left.data.map((f) => `${b.id}/${f.name}`));
});
