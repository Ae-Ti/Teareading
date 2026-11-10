import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 공개 프로필의 완독 책·차 칼럼. 로컬 Supabase에서만 실행한다.
test("공개 프로필에 나가는 기록의 범위", async (t) => {
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
  const suffix = randomUUID().slice(0, 8);
  async function signUp(label: string) {
    const c = makeClient();
    const { data, error } = await c.auth.signUp({
      email: `public-${label}-${suffix}@example.com`,
      password: "Public-reader-123!",
      options: { data: { nickname: `공개${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const owner = await signUp("a");
  const visitor = await signUp("b");

  await owner.c.from("books").insert([
    { title: "다 읽은 책", status: "done" },
    { title: "읽는 중인 책", status: "reading" },
    { title: "보류한 책", status: "paused" },
  ]);
  await owner.c
    .from("reading_logs")
    .insert({ book_title: "다 읽은 책", body: "비공개 독서기록" });
  const publicLog = await owner.c
    .from("reading_logs")
    .insert({
      book_title: "공개한 기록",
      body: "공개 독서기록",
      is_public: true,
    })
    .select("id")
    .single();
  const privateColumn = await owner.c
    .from("tea_columns")
    .insert({ title: "비공개 칼럼", body: "나만 보는 글" })
    .select("id")
    .single();
  const column = await owner.c
    .from("tea_columns")
    .insert({
      title: "우전 녹차",
      body: "가".repeat(300),
      tea_type: "green",
      is_public: true,
    })
    .select("id")
    .single();
  assert.equal(column.error, null);

  await t.test("완독한 책만 보인다", async () => {
    const { data, error } = await visitor.c.rpc("public_finished_books", {
      p_user_id: owner.id,
    });
    assert.equal(error, null);
    assert.deepEqual(
      data!.map((b) => b.title),
      ["다 읽은 책"],
    );
  });

  await t.test("칼럼 목록은 앞부분만, 상세는 전문", async () => {
    const list = await visitor.c.rpc("public_tea_columns", {
      p_user_id: owner.id,
    });
    assert.equal(list.error, null);
    assert.equal(list.data!.length, 1);
    assert.equal(list.data![0].excerpt.length, 120);
    const one = await visitor.c.rpc("public_tea_column", {
      p_id: column.data!.id,
    });
    assert.equal(one.data![0].body.length, 300);
    assert.equal(one.data![0].user_id, owner.id);
  });

  await t.test("표를 직접 읽거나 고칠 수는 없다", async () => {
    const raw = await visitor.c
      .from("tea_columns")
      .select("id")
      .eq("user_id", owner.id);
    assert.equal(raw.data?.length ?? 0, 0);
    const books = await visitor.c
      .from("books")
      .select("id")
      .eq("user_id", owner.id);
    assert.equal(books.data?.length ?? 0, 0);
    const logs = await visitor.c
      .from("reading_logs")
      .select("id")
      .eq("user_id", owner.id);
    assert.equal(logs.data?.length ?? 0, 0);
    const edited = await visitor.c
      .from("tea_columns")
      .update({ title: "바꿈" })
      .eq("id", column.data!.id)
      .select("id");
    assert.equal(edited.data?.length ?? 0, 0);
  });

  await t.test("글은 공개로 지정한 것만 나간다", async () => {
    const columns = await visitor.c.rpc("public_tea_columns", {
      p_user_id: owner.id,
    });
    assert.deepEqual(
      columns.data!.map((c) => c.title),
      ["우전 녹차"],
    );
    const hidden = await visitor.c.rpc("public_tea_column", {
      p_id: privateColumn.data!.id,
    });
    assert.equal(hidden.data!.length, 0);
    const logs = await visitor.c.rpc("public_reading_logs", {
      p_user_id: owner.id,
    });
    assert.deepEqual(
      logs.data!.map((l) => l.title),
      ["공개한 기록"],
    );
    const log = await visitor.c.rpc("public_reading_log", {
      p_id: publicLog.data!.id,
    });
    assert.equal(log.data![0].body, "공개 독서기록");
  });

  await t.test("프로필을 비공개로 바꾸면 전부 막히고 본인만 본다", async () => {
    const off = await owner.c
      .from("profiles")
      .update({ is_public: false })
      .eq("id", owner.id)
      .select("id");
    assert.equal(off.data?.length, 1);
    const p_user_id = owner.id;
    const stats = await visitor.c.rpc("public_profile_stats", { p_user_id });
    assert.equal(stats.data, null);
    const books = await visitor.c.rpc("public_finished_books", { p_user_id });
    assert.equal(books.data!.length, 0);
    const columns = await visitor.c.rpc("public_tea_columns", { p_user_id });
    assert.equal(columns.data!.length, 0);
    const logs = await visitor.c.rpc("public_reading_logs", { p_user_id });
    assert.equal(logs.data!.length, 0);
    const one = await visitor.c.rpc("public_tea_column", {
      p_id: column.data!.id,
    });
    assert.equal(one.data!.length, 0);
    const friends = await visitor.c.rpc("friends_of", { p_user_id });
    assert.deepEqual(friends.data, []);
    const mine = await owner.c.rpc("public_profile_stats", { p_user_id });
    assert.ok(mine.data);
    await owner.c
      .from("profiles")
      .update({ is_public: true })
      .eq("id", owner.id);
  });

  await t.test("다른 회원의 공개 설정은 바꿀 수 없다", async () => {
    const res = await visitor.c
      .from("profiles")
      .update({ is_public: false })
      .eq("id", owner.id)
      .select("id");
    assert.equal(res.data?.length ?? 0, 0);
    const col = await visitor.c
      .from("tea_columns")
      .update({ is_public: false })
      .eq("id", column.data!.id)
      .select("id");
    assert.equal(col.data?.length ?? 0, 0);
  });

  await t.test("친구 관계 표는 당사자만 읽는다", async () => {
    const raw = await visitor.c
      .from("friendships")
      .select("user_a")
      .or(`user_a.eq.${owner.id},user_b.eq.${owner.id}`);
    assert.equal(raw.data?.length ?? 0, 0);
  });

  await t.test("로그인하지 않으면 볼 수 없다", async () => {
    const { error } = await makeClient().rpc("public_tea_columns", {
      p_user_id: owner.id,
    });
    assert.ok(error);
  });
});
