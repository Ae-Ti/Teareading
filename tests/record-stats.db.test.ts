import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRecordStats } from "@/lib/record-stats";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 내 기록 통계. 로컬 Supabase에서만 실행한다.
test("내 기록 통계: 권수·페이지·차 종류·다도 시간", async (t) => {
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
  // 완료 타이머는 1분 이상 지나야 만들 수 있어, 테스트에서만 관리자 키로 직접 넣는다
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
      email: `stats-${label}-${suffix}@example.com`,
      password: "Stats-reader-123!",
      options: { data: { nickname: `통계${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("a");
  const b = await signUp("b");
  const stats = async (c: SupabaseClient<Database>) => {
    const res = await getRecordStats(c);
    assert.equal(res.error, null);
    return res.stats!;
  };

  await t.test("기록이 없으면 0이고 최근 6개월이 비어 있다", async () => {
    const s = await stats(a.c);
    assert.deepEqual(
      [s.reading.books, s.reading.pages, s.tea.columns, s.tea.seconds],
      [0, 0, 0, 0],
    );
    assert.equal(s.reading.monthly.length, 6);
    assert.equal(s.tea.monthly.length, 6);
    assert.ok(s.reading.monthly.every((m) => m.value === 0));
    assert.deepEqual(s.reading.top_books, []);
  });

  await t.test("권수는 같은 책을 한 번만, 페이지는 합산한다", async () => {
    const res = await a.c.from("reading_logs").insert([
      { book_title: "데미안", body: "1", pages_read: 120 },
      { book_title: " 데미안 ", body: "2", pages_read: 80 },
      { book_title: "Harry  Potter", body: "3", pages_read: 50 },
      { book_title: "harry potter", body: "4", pages_read: 25 },
      { book_title: "페이지 안 적은 책", body: "5" },
    ]);
    assert.equal(res.error, null);
    const s = await stats(a.c);
    assert.equal(s.reading.books, 3);
    assert.equal(s.reading.logs, 5);
    assert.equal(s.reading.pages, 275);
    assert.equal(s.reading.pages_this_month, 275);
    assert.equal(s.reading.monthly.at(-1)!.value, 275);
    assert.deepEqual(
      s.reading.top_books.map((x) => [x.pages, x.logs]),
      [
        [200, 2],
        [75, 2],
      ],
    );
  });

  await t.test(
    "차 종류별 횟수, 종류를 고르지 않은 칼럼도 구분한다",
    async () => {
      const res = await a.c.from("tea_columns").insert([
        { title: "우전", body: "1", tea_type: "green" },
        { title: "세작", body: "2", tea_type: "green" },
        { title: "철관음", body: "3", tea_type: "oolong" },
        { title: "그냥 차", body: "4" },
      ]);
      assert.equal(res.error, null);
      const s = await stats(a.c);
      assert.equal(s.tea.columns, 4);
      assert.equal(s.tea.untyped, 1);
      assert.deepEqual(s.tea.by_type, [
        { type: "green", count: 2 },
        { type: "oolong", count: 1 },
      ]);
    },
  );

  await t.test("다도 시간은 완료한 다도 타이머만 더한다", async () => {
    const at = (minutesAgo: number) =>
      new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const res = await admin.from("timer_sessions").insert([
      {
        user_id: a.id,
        activity: "tea",
        target_seconds: 1500,
        started_at: at(100),
        ended_at: at(75),
        status: "completed",
      },
      {
        user_id: a.id,
        activity: "tea",
        target_seconds: 900,
        started_at: at(60),
        ended_at: at(45),
        status: "completed",
      },
      {
        user_id: a.id,
        activity: "tea",
        target_seconds: 900,
        started_at: at(40),
        ended_at: at(35),
        status: "stopped",
      },
      {
        user_id: a.id,
        activity: "reading",
        target_seconds: 900,
        started_at: at(30),
        ended_at: at(15),
        status: "completed",
      },
    ]);
    assert.equal(res.error, null);
    const s = await stats(a.c);
    assert.equal(s.tea.sessions, 2);
    assert.equal(s.tea.seconds, 40 * 60);
    assert.equal(s.tea.monthly.at(-1)!.value, s.tea.seconds_this_month);
  });

  await t.test("다른 사람의 통계에는 섞이지 않는다", async () => {
    const s = await stats(b.c);
    assert.deepEqual(
      [s.reading.books, s.reading.pages, s.tea.columns, s.tea.sessions],
      [0, 0, 0, 0],
    );
    assert.ok((await makeClient().rpc("my_record_stats")).error);
  });

  await t.test("잘못된 페이지 수·차 종류는 저장되지 않는다", async () => {
    const raw = a.c as unknown as SupabaseClient;
    for (const pages_read of [0, -1, 20001]) {
      const res = await raw
        .from("reading_logs")
        .insert({ book_title: "x", body: "x", pages_read });
      assert.ok(res.error, `pages_read ${pages_read}`);
    }
    const tea = await raw
      .from("tea_columns")
      .insert({ title: "x", body: "x", tea_type: "coffee" });
    assert.ok(tea.error);
  });
});
