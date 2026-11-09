import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 서재(책)와 독서록 연결. 로컬 Supabase에서만 실행한다.
test("서재: 책 권한·독서록 연결·표 집계", async (t) => {
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
      email: `books-${label}-${suffix}@example.com`,
      password: "Books-reader-123!",
      options: { data: { nickname: `서재${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("a");
  const b = await signUp("b");
  const addBook = async (title: string, extra: object = {}) => {
    const res = await a.c
      .from("books")
      .insert({ title, ...extra })
      .select("id, status")
      .single();
    assert.equal(res.error, null);
    return res.data!;
  };
  let bookId = "";

  await t.test("책 추가: 기본 상태, 같은 제목 중복 불가", async () => {
    const book = await addBook("데미안", {
      author: "헤세",
      genres: ["novel", "philosophy"],
    });
    assert.equal(book.status, "reading");
    bookId = book.id;
    const dup = await a.c.from("books").insert({ title: "  데미안 " });
    assert.equal(dup.error?.code, "23505");
    // 다른 사람은 같은 제목을 추가할 수 있다
    assert.equal(
      (await b.c.from("books").insert({ title: "데미안" })).error,
      null,
    );
  });

  await t.test("잘못된 상태·장르·개수는 거부한다", async () => {
    const raw = a.c as unknown as SupabaseClient;
    const bads: Record<string, unknown>[] = [
      { title: "x1", status: "lost" },
      { title: "x2", genres: ["cooking"] },
      {
        title: "x3",
        genres: ["novel", "essay", "poetry", "art", "comic", "other"],
      },
      { title: "   " },
    ];
    for (const bad of bads) {
      const res = await raw.from("books").insert(bad);
      assert.ok(res.error, JSON.stringify(bad));
    }
  });

  await t.test(
    "남의 책은 보지도 고치지도 못하고, 독서록을 붙일 수 없다",
    async () => {
      const seen = await b.c.from("books").select("id").eq("id", bookId);
      assert.equal(seen.data?.length, 0);
      const edit = await b.c
        .from("books")
        .update({ status: "done" })
        .eq("id", bookId)
        .select("id");
      assert.equal(edit.data?.length ?? 0, 0);
      const del = await b.c
        .from("books")
        .delete()
        .eq("id", bookId)
        .select("id");
      assert.equal(del.data?.length ?? 0, 0);
      const log = await b.c
        .from("reading_logs")
        .insert({ book_title: "가로채기", body: "x", book_id: bookId });
      assert.equal(log.error?.code, "42501");
      const forged = await b.c
        .from("books")
        .insert({ title: "대리 추가", user_id: a.id });
      assert.ok(forged.error);
      assert.ok(
        (await makeClient().from("books").select("id")).data?.length !== 1,
      );
    },
  );

  await t.test("독서록은 책에 연결되고, 제목은 책 제목을 따른다", async () => {
    const res = await a.c
      .from("reading_logs")
      .insert({
        book_title: "아무 제목",
        body: "첫 기록",
        book_id: bookId,
        pages_read: 40,
      })
      .select("book_title, book_id")
      .single();
    assert.equal(res.error, null);
    assert.equal(res.data!.book_title, "데미안");
    // 책을 지정하지 않으면 같은 제목의 책에 붙는다
    const auto = await a.c
      .from("reading_logs")
      .insert({ book_title: " 데미안", body: "둘째", pages_read: 10 })
      .select("book_id")
      .single();
    assert.equal(auto.data!.book_id, bookId);
    // 없는 제목이면 책이 새로 생긴다
    const fresh = await a.c
      .from("reading_logs")
      .insert({ book_title: "새로운 책", body: "셋째" })
      .select("book_id")
      .single();
    assert.ok(fresh.data!.book_id);
    assert.notEqual(fresh.data!.book_id, bookId);
  });

  await t.test("서재 표: 독서록 수와 쪽수 합계", async () => {
    const list = await a.c.rpc("my_books");
    assert.equal(list.error, null);
    const row = list.data!.find((x) => x.id === bookId)!;
    assert.deepEqual([row.log_count, row.pages], [2, 50]);
    assert.deepEqual(row.genres, ["novel", "philosophy"]);
    assert.equal(list.data!.length, 2);
  });

  await t.test(
    "책 제목을 고치면 독서록 제목도 바뀌고 수정일은 그대로다",
    async () => {
      const before = await a.c
        .from("reading_logs")
        .select("updated_at")
        .eq("book_id", bookId)
        .order("created_at")
        .limit(1)
        .single();
      await new Promise((r) => setTimeout(r, 20));
      await a.c
        .from("books")
        .update({ title: "데미안 (개정판)" })
        .eq("id", bookId);
      const after = await a.c
        .from("reading_logs")
        .select("book_title, updated_at")
        .eq("book_id", bookId)
        .order("created_at")
        .limit(1)
        .single();
      assert.equal(after.data!.book_title, "데미안 (개정판)");
      assert.equal(after.data!.updated_at, before.data!.updated_at);
    },
  );

  await t.test("통계: 완독·읽는 중·장르", async () => {
    await a.c.from("books").update({ status: "done" }).eq("id", bookId);
    const { data } = await a.c.rpc("my_record_stats");
    const reading = (data as { reading: Record<string, unknown> }).reading;
    assert.equal(reading.books, 2);
    assert.equal(reading.finished, 1);
    assert.equal(reading.reading_now, 1);
    assert.deepEqual(reading.by_genre, [
      { genre: "novel", count: 1 },
      { genre: "philosophy", count: 1 },
    ]);
  });

  await t.test("책을 지우면 독서록도 함께 지워진다", async () => {
    await a.c.from("books").delete().eq("id", bookId);
    const left = await a.c
      .from("reading_logs")
      .select("id")
      .eq("book_id", bookId);
    assert.equal(left.data?.length, 0);
  });
});
