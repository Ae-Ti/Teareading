import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 타이머 일시정지. 로컬 Supabase에서만 실행한다.
test("타이머 일시정지: 서버 시각·권한·중복 요청·몰입 시간", async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "로컬 Supabase에서만 실행합니다.",
  );
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  const status = JSON.parse(
    execSync("npx --no-install supabase status -o json", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString(),
  ) as { SERVICE_ROLE_KEY: string };
  // 시간이 지난 상황은 관리자 키로 시각을 앞당겨 만든다
  const admin = createClient<Database>(url, status.SERVICE_ROLE_KEY, options);

  const suffix = randomUUID().slice(0, 8);
  async function signUp(label: string) {
    const c = createClient<Database>(url!, key!, options);
    const { data, error } = await c.auth.signUp({
      email: `timer-${label}-${suffix}@example.com`,
      password: "Timer-reader-123!",
      options: { data: { nickname: `타이머${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("a");
  const b = await signUp("b");

  const ago = (seconds: number) =>
    new Date(Date.now() - seconds * 1000).toISOString();
  const start = async (seconds = 900) => {
    const res = await a.c.rpc("start_timer", {
      p_activity: "tea",
      p_target_seconds: seconds,
    });
    assert.equal(res.error, null);
    return res.data!;
  };
  const pause = async (id: string) => {
    const res = await a.c.rpc("pause_timer", { p_id: id });
    assert.equal(res.error, null);
    return res.data!;
  };
  const resume = async (id: string) => {
    const res = await a.c.rpc("resume_timer", { p_id: id });
    assert.equal(res.error, null);
    return res.data!;
  };
  const finish = async (id: string, s: string) => {
    const res = await a.c.rpc("finish_timer", { p_id: id, p_status: s });
    assert.equal(res.error, null);
    return res.data!;
  };
  const shift = async (
    id: string,
    values: Database["public"]["Tables"]["timer_sessions"]["Update"],
  ) => {
    const res = await admin.from("timer_sessions").update(values).eq("id", id);
    assert.equal(res.error, null);
  };
  const clear = async () => {
    await admin.from("timer_sessions").delete().eq("user_id", a.id);
  };

  await t.test("멈춤·이어서 하기는 연타해도 한 번만 반영된다", async () => {
    const s = await start();
    const first = await pause(s.id);
    assert.ok(first.paused_at);
    const second = await pause(s.id);
    assert.equal(second.paused_at, first.paused_at);

    await shift(s.id, { started_at: ago(200), paused_at: ago(120) });
    const resumed = await resume(s.id);
    assert.equal(resumed.paused_at, null);
    assert.ok(Math.abs(resumed.paused_seconds - 120) <= 2);
    const again = await resume(s.id);
    assert.equal(again.paused_seconds, resumed.paused_seconds);
    await clear();
  });

  await t.test("멈춘 동안에는 새 타이머를 시작할 수 없다", async () => {
    const s = await start();
    await pause(s.id);
    const res = await a.c.rpc("start_timer", {
      p_activity: "reading",
      p_target_seconds: 600,
    });
    assert.match(res.error?.message ?? "", /timer_already_running/);
    await clear();
  });

  await t.test("다른 사용자·비로그인은 조작할 수 없다", async () => {
    const s = await start();
    for (const rpc of ["pause_timer", "resume_timer"] as const) {
      const res = await b.c.rpc(rpc, { p_id: s.id });
      assert.match(res.error?.message ?? "", /timer_not_found/);
    }
    const finished = await b.c.rpc("finish_timer", {
      p_id: s.id,
      p_status: "stopped",
    });
    assert.match(finished.error?.message ?? "", /timer_not_found/);
    const anon = createClient<Database>(url, key, options);
    const res = await anon.rpc("pause_timer", { p_id: s.id });
    assert.ok(res.error);

    const direct = await a.c
      .from("timer_sessions")
      .update({ paused_seconds: 9999 })
      .eq("id", s.id)
      .select("id");
    assert.ok(direct.error || direct.data?.length === 0);
    const row = await admin
      .from("timer_sessions")
      .select("paused_at, paused_seconds")
      .eq("id", s.id)
      .single();
    assert.deepEqual(row.data, { paused_at: null, paused_seconds: 0 });
    await clear();
  });

  await t.test("멈춘 시간만큼 목표 시각이 늦춰진다", async () => {
    const s = await start(600);
    // 11분 전 시작, 지금까지 5분 멈춤: 몰입 6분이라 아직 안 끝났다
    await shift(s.id, { started_at: ago(660), paused_seconds: 300 });
    const early = await finish(s.id, "expired");
    assert.equal(early.status, "running");

    // 멈춘 시간을 줄여 몰입이 목표를 넘게 하면 목표 시각에 끝난 것으로 기록된다
    await shift(s.id, { started_at: ago(700), paused_seconds: 90 });
    const done = await finish(s.id, "expired");
    assert.equal(done.status, "completed");
    assert.equal(
      new Date(done.ended_at!).getTime() - new Date(done.started_at).getTime(),
      690_000,
    );
    await clear();
  });

  await t.test(
    "다른 탭에서 멈췄으면 자동 완료 요청은 끝내지 않는다",
    async () => {
      const s = await start(600);
      await shift(s.id, { started_at: ago(590) });
      await pause(s.id);
      await shift(s.id, { started_at: ago(5000), paused_seconds: 4400 });
      const res = await finish(s.id, "expired");
      assert.equal(res.status, "running");
      assert.ok(res.paused_at);
      await clear();
    },
  );

  await t.test("멈춘 채 끝내면 멈춘 시각이 종료 시각이다", async () => {
    const s = await start(900);
    await pause(s.id);
    const pausedAt = ago(3600);
    await shift(s.id, { started_at: ago(3900), paused_at: pausedAt });
    const done = await finish(s.id, "completed");
    assert.equal(done.status, "completed");
    assert.equal(done.paused_at, null);
    assert.equal(
      new Date(done.ended_at!).getTime(),
      new Date(pausedAt).getTime(),
    );
    await clear();
  });

  await t.test("1분 판단은 멈춘 시간을 뺀 몰입 시간으로 한다", async () => {
    const s = await start(900);
    // 10분 전 시작했지만 9분 50초를 멈춰서 몰입은 10초
    await shift(s.id, { started_at: ago(600), paused_seconds: 590 });
    const done = await finish(s.id, "completed");
    assert.equal(done.status, "stopped");
    await clear();
  });

  await t.test("끝난 타이머와 목표가 지난 타이머는 멈추지 않는다", async () => {
    const s = await start(600);
    await shift(s.id, { started_at: ago(700) });
    const late = await pause(s.id);
    assert.equal(late.paused_at, null);
    const done = await finish(s.id, "stopped");
    assert.equal(done.status, "completed");
    const after = await pause(s.id);
    assert.equal(after.status, "completed");
    assert.equal(after.paused_at, null);
    await clear();
  });

  await t.test("출석 몰입 시간과 통계에서 멈춘 시간이 빠진다", async () => {
    const s = await start(600);
    await shift(s.id, { started_at: ago(1000), paused_seconds: 400 });
    const done = await finish(s.id, "expired");
    assert.equal(done.status, "completed");

    const days = await a.c.from("attendance_days").select("focus_seconds");
    assert.equal(days.error, null);
    assert.deepEqual(
      days.data?.map((d) => d.focus_seconds),
      [600],
    );
    const stats = await a.c.rpc("my_record_stats");
    assert.equal(stats.error, null);
    assert.equal((stats.data as { tea: { seconds: number } }).tea.seconds, 600);
  });

  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
});
