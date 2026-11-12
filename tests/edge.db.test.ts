import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 정상 흐름이 아닌 경우를 찾는 시험: 동시 요청, 상태 변화, 값 위조, 경계값. 로컬 Supabase 전용.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
  "로컬 Supabase에서만 실행합니다.",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const status = JSON.parse(
  execSync("npx --no-install supabase status -o json", {
    stdio: ["ignore", "pipe", "ignore"],
  }).toString(),
) as { SERVICE_ROLE_KEY: string };
const admin = createClient<Database>(url, status.SERVICE_ROLE_KEY, options);

async function user(label: string) {
  const c = createClient<Database>(url, key, options);
  const s = randomUUID().slice(0, 8);
  const { data, error } = await c.auth.signUp({
    email: `edge-${label}-${s}@example.com`,
    password: "Edge-reader-123!",
    options: { data: { nickname: `경계${label}${s}` } },
  });
  assert.equal(error, null);
  return { c, id: data.user!.id };
}
type U = Awaited<ReturnType<typeof user>>;
const send = (u: U, kind: string, to: string, payload = {}) =>
  u.c.rpc("create_live_request", {
    p_kind: kind,
    p_to: to,
    p_payload: payload,
  }) as unknown as Promise<{
    data: { id?: string; status: string } | null;
    error: { message: string } | null;
  }>;
const answer = (u: U, id: string, accept = true) =>
  u.c.rpc("respond_live_request", {
    p_id: id,
    p_accept: accept,
  }) as unknown as Promise<{
    data: { status: string; result?: { group_id?: string } } | null;
    error: { message: string; code?: string } | null;
  }>;
const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

test("동시 요청", async (t) => {
  await t.test(
    "같은 친구 요청을 동시에 5번 보내면 대기 요청은 1건",
    async () => {
      const [a, b] = [await user("a"), await user("b")];
      const res = await Promise.all(
        Array.from({ length: 5 }, () => send(a, "friend", b.id)),
      );
      assert.deepEqual(
        res.filter((r) => r.error).map((r) => r.error!.message),
        [],
      );
      const rows = await admin
        .from("live_requests")
        .select("id")
        .eq("from_user", a.id)
        .eq("status", "pending");
      assert.equal(rows.data?.length, 1);
    },
  );

  await t.test(
    "서로 동시에 친구 신청해도 대기가 엇갈려 남지 않는다",
    async () => {
      for (let i = 0; i < 5; i++) {
        const [a, b] = [await user("x"), await user("y")];
        const res = await Promise.all([
          send(a, "friend", b.id),
          send(b, "friend", a.id),
        ]);
        assert.deepEqual(
          res.filter((r) => r.error).map((r) => r.error!.message),
          [],
        );
        const pending = await admin
          .from("live_requests")
          .select("id")
          .in("from_user", [a.id, b.id])
          .eq("status", "pending");
        const [low, high] = pair(a.id, b.id);
        const friend = await admin
          .from("friendships")
          .select("user_a")
          .eq("user_a", low)
          .eq("user_b", high);
        assert.ok(
          (pending.data?.length ?? 0) <= 1,
          `대기 ${pending.data?.length}건, 친구 ${friend.data?.length}건`,
        );
      }
    },
  );

  await t.test("모임맺기 수락을 동시에 5번 눌러도 모임은 1개", async () => {
    const [a, b] = [await user("a"), await user("b")];
    const name = `동시모임${randomUUID().slice(0, 6)}`;
    const req = await send(a, "group_create", b.id, { name, description: "" });
    assert.equal(req.error, null);
    await Promise.all(
      Array.from({ length: 5 }, () => answer(b, req.data!.id!)),
    );
    const groups = await admin.from("groups").select("id").eq("name", name);
    assert.equal(groups.data?.length, 1);
  });

  await t.test("타이머 시작을 동시에 5번 해도 1개", async () => {
    const a = await user("a");
    const res = await Promise.all(
      Array.from({ length: 5 }, () =>
        a.c.rpc("start_timer", { p_activity: "tea", p_target_seconds: 600 }),
      ),
    );
    assert.equal(res.filter((r) => !r.error).length, 1);
  });

  await t.test("멈춤·이어서·종료가 겹쳐도 상태가 일관된다", async () => {
    const a = await user("a");
    for (let i = 0; i < 8; i++) {
      const s = await a.c.rpc("start_timer", {
        p_activity: "tea",
        p_target_seconds: 600,
      });
      assert.equal(s.error, null);
      const id = s.data!.id;
      const res = await Promise.all([
        a.c.rpc("pause_timer", { p_id: id }),
        a.c.rpc("resume_timer", { p_id: id }),
        a.c.rpc("finish_timer", { p_id: id, p_status: "stopped" }),
        a.c.rpc("pause_timer", { p_id: id }),
      ]);
      assert.deepEqual(
        res.filter((r) => r.error).map((r) => r.error!.message),
        [],
      );
      const row = await admin
        .from("timer_sessions")
        .select("status, paused_at, ended_at, paused_seconds")
        .eq("id", id)
        .single();
      assert.equal(row.data?.status, "stopped");
      assert.equal(row.data?.paused_at, null);
      assert.ok(row.data?.ended_at);
    }
  });

  await t.test("댓글 추천 동시 요청에도 수가 맞는다", async () => {
    const owner = await user("o");
    const post = await owner.c
      .from("posts")
      .insert({ title: "동시 추천", body: "본문" })
      .select("id")
      .single();
    const comment = await owner.c
      .from("post_comments")
      .insert({ post_id: post.data!.id, body: "댓글" })
      .select("id")
      .single();
    const likers = await Promise.all([1, 2, 3, 4, 5].map(() => user("l")));
    await Promise.all(
      likers.map((u) =>
        u.c.from("comment_likes").insert({ comment_id: comment.data!.id }),
      ),
    );
    const row = await admin
      .from("post_comments")
      .select("like_count")
      .eq("id", comment.data!.id)
      .single();
    assert.equal(row.data?.like_count, 5);
  });
});

test("상태 변화", async (t) => {
  await t.test(
    "모임이 사라진 가입 요청은 대기 목록에 남지 않는다",
    async () => {
      const [owner, joiner] = [await user("o"), await user("j")];
      const g = await owner.c
        .from("groups")
        .insert({
          name: `사라질모임${randomUUID().slice(0, 4)}`,
          owner_id: owner.id,
        })
        .select("id")
        .single();
      assert.equal(g.error, null);
      const req = await send(joiner, "group_join", owner.id, {
        group_id: g.data!.id,
      });
      assert.equal(req.error, null);
      await owner.c.from("groups").delete().eq("id", g.data!.id);
      const pending = await owner.c.rpc("my_pending_requests");
      assert.equal(
        pending.data?.length,
        0,
        "삭제된 모임 요청이 팝업으로 남는다",
      );
    },
  );

  await t.test("상대가 탈퇴하면 요청과 친구 관계가 지워진다", async () => {
    const [a, b] = [await user("a"), await user("b")];
    await send(a, "friend", b.id);
    await admin.auth.admin.deleteUser(a.id);
    const pending = await b.c.rpc("my_pending_requests");
    assert.equal(pending.data?.length, 0);
  });

  await t.test(
    "이미 가입했는데 남은 가입 요청을 수락해도 오류가 없다",
    async () => {
      const [owner, joiner] = [await user("o"), await user("j")];
      const g = await owner.c
        .from("groups")
        .insert({
          name: `중복가입${randomUUID().slice(0, 4)}`,
          owner_id: owner.id,
        })
        .select("id")
        .single();
      const req = await send(joiner, "group_join", owner.id, {
        group_id: g.data!.id,
      });
      const join = await joiner.c
        .from("group_members")
        .insert({ group_id: g.data!.id, user_id: joiner.id });
      assert.equal(join.error, null);
      const res = await answer(owner, req.data!.id!);
      assert.equal(res.error, null);
    },
  );

  await t.test(
    "모임장이 바뀌면 이전 모임장은 가입 요청을 수락할 수 없다",
    async () => {
      const [owner, joiner, next] = [
        await user("o"),
        await user("j"),
        await user("n"),
      ];
      const g = await owner.c
        .from("groups")
        .insert({
          name: `모임장변경${randomUUID().slice(0, 4)}`,
          owner_id: owner.id,
        })
        .select("id")
        .single();
      const req = await send(joiner, "group_join", owner.id, {
        group_id: g.data!.id,
      });
      await admin
        .from("groups")
        .update({ owner_id: next.id })
        .eq("id", g.data!.id);
      const res = await answer(owner, req.data!.id!);
      assert.ok(res.error);
    },
  );

  await t.test("만료된 요청은 수락되지 않는다", async () => {
    const [a, b] = [await user("a"), await user("b")];
    const req = await send(a, "dm", b.id);
    await admin
      .from("live_requests")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", req.data!.id!);
    const res = await answer(b, req.data!.id!);
    assert.equal(res.data?.status, "expired");
  });
});

test("값 위조 (본인 행이라도 서버가 정하는 값)", async (t) => {
  const a = await user("a");
  const b = await user("b");
  const old = "2020-01-01T00:00:00+00:00";
  const unchanged = async (
    table: "profiles" | "reading_logs" | "tea_columns" | "books",
    id: string,
    patch: Record<string, unknown>,
    column: string,
  ) => {
    const before = await admin.from(table).select(column).eq("id", id).single();
    await (
      a.c.from(table) as unknown as {
        update: (v: unknown) => {
          eq: (c: string, v: string) => Promise<unknown>;
        };
      }
    )
      .update(patch)
      .eq("id", id);
    const after = await admin.from(table).select(column).eq("id", id).single();
    assert.deepEqual(after.data, before.data);
  };

  await t.test("가입일을 바꿀 수 없다", () =>
    unchanged("profiles", a.id, { created_at: old }, "created_at"),
  );
  await t.test("차 칼럼 작성일을 바꿀 수 없다", async () => {
    const r = await a.c
      .from("tea_columns")
      .insert({ title: "날짜", body: "본문" })
      .select("id")
      .single();
    await unchanged(
      "tea_columns",
      r.data!.id,
      { created_at: old },
      "created_at",
    );
  });
  await t.test("차 칼럼을 과거 날짜로 새로 쓸 수 없다", async () => {
    const r = await a.c
      .from("tea_columns")
      .insert({ title: "날짜", body: "본문", created_at: old })
      .select("created_at")
      .single();
    assert.ok(r.error || new Date(r.data!.created_at).getFullYear() > 2020);
  });
  await t.test("독서록 작성일을 바꿀 수 없다", async () => {
    const book = await a.c
      .from("books")
      .insert({ title: `날짜책${randomUUID().slice(0, 4)}` })
      .select("id, title")
      .single();
    const r = await a.c
      .from("reading_logs")
      .insert({
        book_id: book.data!.id,
        book_title: book.data!.title,
        body: "본문",
      })
      .select("id")
      .single();
    await unchanged(
      "reading_logs",
      r.data!.id,
      { created_at: old },
      "created_at",
    );
  });
  await t.test("다른 사람 이름으로 이벤트를 남길 수 없다", async () => {
    const r = await a.c
      .from("events")
      .insert({ user_id: b.id, name: "timer_completed" } as never);
    assert.ok(r.error);
  });
  await t.test("모임 채팅 시각·보낸 사람을 위조할 수 없다", async () => {
    const g = await a.c
      .from("groups")
      .insert({ name: `위조모임${randomUUID().slice(0, 4)}`, owner_id: a.id })
      .select("id")
      .single();
    const r = await a.c.from("group_messages").insert({
      group_id: g.data!.id,
      body: "위조",
      sender_id: b.id,
    } as never);
    assert.ok(r.error);
  });
  await t.test("글의 조회·추천 수를 직접 바꿀 수 없다", async () => {
    const p = await a.c
      .from("posts")
      .insert({ title: "수치 위조", body: "본문" })
      .select("id")
      .single();
    const r = await a.c
      .from("posts")
      .update({ like_count: 999 } as never)
      .eq("id", p.data!.id);
    assert.ok(r.error);
  });
});

test("경계값", async (t) => {
  const a = await user("a");
  const blank = ["　　", "​​", "  ", "⠀⠀"];

  await t.test("보이지 않는 글자만 있는 닉네임은 저장되지 않는다", async () => {
    const saved: string[] = [];
    for (const nickname of blank) {
      const r = await a.c.from("profiles").update({ nickname }).eq("id", a.id);
      if (!r.error) saved.push(JSON.stringify(nickname));
    }
    assert.deepEqual(saved, []);
  });
  await t.test("보이지 않는 글자로 같은 닉네임을 흉내 낼 수 없다", async () => {
    const b = await user("b");
    const taken = await admin
      .from("profiles")
      .select("nickname")
      .eq("id", b.id)
      .single();
    const r = await a.c
      .from("profiles")
      .update({ nickname: `${taken.data!.nickname}​` })
      .eq("id", a.id);
    assert.ok(r.error, "제로폭 문자를 붙인 닉네임이 저장됐다");
  });
  await t.test(
    "보이지 않는 글자만 있는 글·댓글·채팅·모임은 저장되지 않는다",
    async () => {
      const g = await a.c
        .from("groups")
        .insert({ name: `경계모임${randomUUID().slice(0, 4)}`, owner_id: a.id })
        .select("id")
        .single();
      const p = await a.c
        .from("posts")
        .insert({ title: "경계 글", body: "본문" })
        .select("id")
        .single();
      const saved: string[] = [];
      for (const v of blank) {
        const results = {
          title: await a.c
            .from("posts")
            .insert({ title: `${v}${v}`, body: "본문" }),
          comment: await a.c
            .from("post_comments")
            .insert({ post_id: p.data!.id, body: v }),
          chat: await a.c
            .from("group_messages")
            .insert({ group_id: g.data!.id, body: v } as never),
          group: await a.c
            .from("groups")
            .insert({ name: `${v}${v}`, owner_id: a.id }),
          column: await a.c.from("tea_columns").insert({ title: v, body: v }),
        };
        for (const [name, r] of Object.entries(results))
          if (!r.error) saved.push(`${name} ${JSON.stringify(v)}`);
      }
      assert.deepEqual(saved, []);
    },
  );
  await t.test("읽은 쪽 수는 음수·초과를 받지 않는다", async () => {
    const book = await a.c
      .from("books")
      .insert({ title: `쪽수책${randomUUID().slice(0, 4)}` })
      .select("id, title")
      .single();
    for (const pages of [-1, 2147483647]) {
      const r = await a.c.from("reading_logs").insert({
        book_id: book.data!.id,
        book_title: book.data!.title,
        body: "본문",
        pages_read: pages,
      });
      assert.ok(r.error, String(pages));
    }
    for (const total of [-1, 200001]) {
      const r = await a.c.rpc("set_book_pages", {
        p_book_id: book.data!.id,
        p_total: total,
      });
      assert.ok(r.error, String(total));
    }
  });
  await t.test("요청 내용의 잘못된 모임 ID는 서버 오류가 아니다", async () => {
    const b = await user("b");
    const r = await send(a, "group_join", b.id, { group_id: "not-a-uuid" });
    assert.ok(r.error);
    assert.ok(
      !/invalid input syntax/.test(r.error!.message),
      `내부 오류 문구 노출: ${r.error!.message}`,
    );
  });
});
