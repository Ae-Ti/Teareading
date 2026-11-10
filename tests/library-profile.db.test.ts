import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

type Stats = Record<string, number>;

// 표지·읽은 쪽 수정, 공개 프로필 통계. 로컬 Supabase에서만 실행한다.
test("서재 표지·읽은 쪽 수정과 공개 프로필 통계", async (t) => {
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
  const status = JSON.parse(
    execSync("npx --no-install supabase status -o json", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString(),
  ) as { SERVICE_ROLE_KEY: string };
  const admin = createClient<Database>(url, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomUUID().slice(0, 8);
  async function signUp(label: string) {
    const c = makeClient();
    const { data, error } = await c.auth.signUp({
      email: `libpro-${label}-${suffix}@example.com`,
      password: "Library-reader-123!",
      options: { data: { nickname: `공개${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("a");
  const b = await signUp("b");
  const row = async (id: string) =>
    (await a.c.rpc("my_books")).data!.find((x) => x.id === id)!;

  const created = await a.c
    .from("books")
    .insert({ title: "데미안", status: "done" })
    .select("id")
    .single();
  const bookId = created.data!.id;
  await a.c.from("reading_logs").insert({
    book_id: bookId,
    book_title: "데미안",
    body: "1",
    pages_read: 40,
  });

  await t.test("표지는 허용된 주소만 저장된다", async () => {
    for (const cover_url of [
      "https://covers.openlibrary.org/b/id/1-M.jpg",
      "https://search1.kakaocdn.net/thumb/R120x174/?fname=x",
    ]) {
      const res = await a.c
        .from("books")
        .update({ cover_url })
        .eq("id", bookId);
      assert.equal(res.error, null, cover_url);
    }
    for (const cover_url of [
      "http://covers.openlibrary.org/b/id/1-M.jpg",
      "https://evil.example/cover.jpg",
      "javascript:alert(1)",
      "https://kakaocdn.net.evil.example/x.jpg",
    ]) {
      const res = await a.c
        .from("books")
        .update({ cover_url })
        .eq("id", bookId);
      assert.ok(res.error, cover_url);
    }
    assert.ok((await row(bookId)).cover_url?.includes("kakaocdn"));
  });

  await t.test(
    "읽은 쪽 수를 고치면 표시값이 바뀌고, 이후 독서록은 더해진다",
    async () => {
      assert.equal((await row(bookId)).pages, 40);
      const set = await a.c.rpc("set_book_pages", {
        p_book_id: bookId,
        p_total: 120,
      });
      assert.equal(set.error, null);
      assert.equal((await row(bookId)).pages, 120);
      await a.c.from("reading_logs").insert({
        book_id: bookId,
        book_title: "데미안",
        body: "2",
        pages_read: 10,
      });
      assert.equal((await row(bookId)).pages, 130);
      // 줄일 수도 있다
      await a.c.rpc("set_book_pages", { p_book_id: bookId, p_total: 5 });
      assert.equal((await row(bookId)).pages, 5);
      await a.c.rpc("set_book_pages", { p_book_id: bookId, p_total: 200 });

      const { data } = await a.c.rpc("my_record_stats");
      const reading = (
        data as { reading: { pages: number; top_books: { pages: number }[] } }
      ).reading;
      assert.equal(reading.pages, 200);
      assert.equal(reading.top_books[0].pages, 200);
    },
  );

  await t.test("남의 책·잘못된 값은 고칠 수 없다", async () => {
    const other = await b.c.rpc("set_book_pages", {
      p_book_id: bookId,
      p_total: 1,
    });
    assert.equal(other.error?.code, "P0002");
    assert.equal((await row(bookId)).pages, 200);
    for (const p_total of [-1, 200001]) {
      const res = await a.c.rpc("set_book_pages", {
        p_book_id: bookId,
        p_total,
      });
      assert.equal(res.error?.code, "22023");
    }
    const anon = await makeClient().rpc("set_book_pages", {
      p_book_id: bookId,
      p_total: 1,
    });
    assert.ok(anon.error);
  });

  const stats = async (c: SupabaseClient<Database>, id: string) => {
    const res = await c.rpc("public_profile_stats", { p_user_id: id });
    assert.equal(res.error, null);
    return res.data as unknown as Stats;
  };

  await t.test("다른 사람의 통계를 합계로만 본다", async () => {
    const day = 86_400_000;
    const session = (
      daysAgo: number,
      activity: "tea" | "reading",
      seconds: number,
      paused = 0,
    ) => {
      const end = Date.now() - daysAgo * day;
      return {
        user_id: a.id,
        activity,
        target_seconds: 3000,
        started_at: new Date(end - (seconds + paused) * 1000).toISOString(),
        ended_at: new Date(end).toISOString(),
        paused_seconds: paused,
        status: "completed",
      };
    };
    const res = await admin.from("timer_sessions").insert([
      session(0, "tea", 1500, 300),
      session(1, "reading", 900),
      session(2, "tea", 600),
      session(5, "tea", 600), // 끊긴 날
    ]);
    assert.equal(res.error, null);

    const s = await stats(b.c, a.id);
    assert.equal(s.streak, 3);
    assert.equal(s.attendance_days, 4);
    assert.equal(s.finished, 1);
    assert.equal(s.pages, 200);
    assert.equal(s.tea_seconds, 2700, "멈춘 시간은 빠진다");
    assert.equal(s.tea_sessions, 3);
    assert.equal(s.reading_seconds, 900);
    assert.deepEqual(Object.keys(s).sort(), [
      "attendance_days",
      "finished",
      "pages",
      "reading_seconds",
      "streak",
      "tea_seconds",
      "tea_sessions",
    ]);
  });

  await t.test("기록이 없으면 0, 비로그인은 볼 수 없다", async () => {
    const s = await stats(a.c, b.id);
    assert.deepEqual(
      [s.streak, s.finished, s.pages, s.tea_sessions],
      [0, 0, 0, 0],
    );
    assert.ok(
      (await makeClient().rpc("public_profile_stats", { p_user_id: a.id }))
        .error,
    );
  });
});
