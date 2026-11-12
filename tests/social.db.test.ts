import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

type Res = { id?: string; status: string; result?: Record<string, string> };

// 댓글 추천·대댓글, 친구, 접속 중 표시, 수락/거절 요청. 로컬 Supabase에서만 실행한다.
test("소셜 기능 권한과 동작", async (t) => {
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
      email: `social-${label}-${suffix}@example.com`,
      password: "Social-reader-123!",
      options: { data: { nickname: `소셜${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("a");
  const b = await signUp("b");
  const c = await signUp("c");
  type U = typeof a;
  const send = async (u: U, kind: string, to: string, payload: Json = {}) =>
    u.c.rpc("create_live_request", {
      p_kind: kind,
      p_to: to,
      p_payload: payload,
    });
  const answer = async (u: U, id: string, accept: boolean) =>
    u.c.rpc("respond_live_request", { p_id: id, p_accept: accept });
  const idOf = (r: { data: unknown }) => (r.data as Res).id!;

  const post = await a.c
    .from("posts")
    .insert({ title: "대댓글 시험", body: "본문" })
    .select("id")
    .single();
  const postId = post.data!.id;
  const addComment = (u: U, body: string, parent_id?: string) =>
    u.c
      .from("post_comments")
      .insert({ post_id: postId, body, parent_id })
      .select("id, like_count")
      .single();

  await t.test("대댓글은 한 단계까지만", async () => {
    const top = await addComment(a, "댓글");
    const reply = await addComment(b, "대댓글", top.data!.id);
    assert.equal(reply.error, null);
    const deep = await addComment(c, "대대댓글", reply.data!.id);
    assert.equal(deep.error?.code, "22023");
    const other = await a.c
      .from("posts")
      .insert({ title: "다른 글", body: "본문" })
      .select("id")
      .single();
    const cross = await a.c
      .from("post_comments")
      .insert({ post_id: other.data!.id, body: "x", parent_id: top.data!.id });
    assert.equal(cross.error?.code, "22023", "다른 글의 댓글에는 달 수 없다");
    const count = await a.c
      .from("posts")
      .select("comment_count")
      .eq("id", postId)
      .single();
    assert.equal(count.data!.comment_count, 2);
  });

  await t.test(
    "댓글 추천: 한 번만, 자기 댓글 불가, 수정됨 표시 안 됨",
    async () => {
      const top = await addComment(a, "추천받을 댓글");
      const id = top.data!.id;
      assert.ok(
        (await a.c.from("comment_likes").insert({ comment_id: id })).error,
        "자기 댓글 추천 불가",
      );
      assert.equal(
        (await b.c.from("comment_likes").insert({ comment_id: id })).error,
        null,
      );
      assert.equal(
        (await b.c.from("comment_likes").insert({ comment_id: id })).error
          ?.code,
        "23505",
      );
      const row = await a.c
        .from("post_comments")
        .select("like_count, created_at, updated_at")
        .eq("id", id)
        .single();
      assert.equal(row.data!.like_count, 1);
      assert.equal(row.data!.updated_at, row.data!.created_at);
      await b.c.from("comment_likes").delete().eq("comment_id", id);
      const after = await a.c
        .from("post_comments")
        .select("like_count")
        .eq("id", id)
        .single();
      assert.equal(after.data!.like_count, 0);
      const forged = await (a.c as unknown as SupabaseClient)
        .from("post_comments")
        .update({ like_count: 99 })
        .eq("id", id);
      assert.ok(forged.error, "추천 수 직접 수정 불가");
    },
  );

  await t.test("글 내용 블록은 배열만 저장된다", async () => {
    const ok = await a.c
      .from("posts")
      .update({ content: [{ type: "text", text: "안녕" }] })
      .eq("id", postId);
    assert.equal(ok.error, null);
    const bad = await (a.c as unknown as SupabaseClient)
      .from("posts")
      .update({ content: { type: "text" } })
      .eq("id", postId);
    assert.ok(bad.error);
  });

  await t.test("친구: 신청 → 수락, 목록은 양쪽에, 끊기", async () => {
    const req = await send(a, "friend", b.id);
    assert.equal(req.error, null);
    // 중복 신청은 같은 요청
    assert.equal(idOf(await send(a, "friend", b.id)), idOf(req));
    // 받은 쪽만 보인다
    const pending = await b.c.rpc("my_pending_requests");
    assert.equal(pending.data!.length, 1);
    assert.equal(pending.data![0].from_nickname, `소셜a${suffix}`);
    assert.equal((await a.c.rpc("my_pending_requests")).data!.length, 0);
    // 보낸 사람·제3자는 답할 수 없다
    assert.equal((await answer(a, idOf(req), true)).error?.code, "P0002");
    assert.equal((await answer(c, idOf(req), true)).error?.code, "P0002");

    assert.equal(
      ((await answer(b, idOf(req), true)).data as unknown as Res).status,
      "accepted",
    );
    const friends = await c.c.rpc("friends_of", { p_user_id: a.id });
    assert.deepEqual(
      friends.data!.map((f) => f.id),
      [b.id],
    );

    // 맞신청이면 바로 친구
    const first = await send(c, "friend", a.id);
    assert.equal((first.data as unknown as Res).status, "pending");
    const back = await send(a, "friend", c.id);
    assert.equal((back.data as unknown as Res).status, "accepted");
    assert.equal(
      (await a.c.rpc("friends_of", { p_user_id: a.id })).data!.length,
      2,
    );

    const raw = c.c as unknown as SupabaseClient;
    assert.ok(
      (await raw.from("friendships").insert({ user_a: a.id, user_b: b.id }))
        .error,
      "직접 친구 추가 불가",
    );
    const cut = await c.c
      .from("friendships")
      .delete()
      .eq("user_a", [a.id, c.id].sort()[0])
      .eq("user_b", [a.id, c.id].sort()[1])
      .select("user_a");
    assert.equal(cut.data?.length, 1);
    const foreign = await c.c
      .from("friendships")
      .delete()
      .eq("user_a", [a.id, b.id].sort()[0])
      .select("user_a");
    assert.equal(foreign.data?.length ?? 0, 0, "남의 친구 관계는 끊을 수 없다");
  });

  await t.test("접속 중인 친구만, 오늘의 시간과 함께 보인다", async () => {
    assert.equal((await a.c.rpc("my_online_friends")).data!.length, 0);
    await b.c.rpc("touch_presence");
    await c.c.rpc("touch_presence");
    const now = Date.now();
    await admin.from("timer_sessions").insert({
      user_id: b.id,
      activity: "tea",
      target_seconds: 3000,
      started_at: new Date(now - 700_000).toISOString(),
      ended_at: new Date(now - 100_000).toISOString(),
      status: "completed",
    });
    await admin.from("timer_sessions").insert({
      user_id: b.id,
      activity: "reading",
      target_seconds: 3000,
      started_at: new Date(now - 300_000).toISOString(),
      status: "running",
    });
    const online = await a.c.rpc("my_online_friends");
    assert.equal(online.error, null);
    assert.deepEqual(
      online.data!.map((f) => f.id),
      [b.id],
      "친구가 아닌 사람은 안 보인다",
    );
    assert.equal(online.data![0].tea_seconds, 600);
    assert.ok(online.data![0].reading_seconds >= 299);
    assert.equal(online.data![0].activity, "reading");
    // 오래 전 접속은 안 보인다
    await admin
      .from("user_heartbeats")
      .update({ last_seen_at: new Date(now - 300_000).toISOString() })
      .eq("user_id", b.id);
    assert.equal((await a.c.rpc("my_online_friends")).data!.length, 0);
    const raw = a.c as unknown as SupabaseClient;
    const peek = await raw.from("user_heartbeats").select("*");
    assert.ok(
      peek.error || peek.data?.length === 0,
      "접속 기록을 직접 볼 수 없다",
    );
  });

  await t.test("1:1 요청: 수락하면 대화방, 거절·만료", async () => {
    const req = await send(a, "dm", c.id);
    const res = await answer(c, idOf(req), true);
    const threadId = (res.data as unknown as Res).result!.thread_id;
    assert.ok(threadId);
    const seen = await a.c
      .from("live_requests")
      .select("status, result")
      .eq("id", idOf(req))
      .single();
    assert.equal(seen.data!.status, "accepted");
    assert.deepEqual(seen.data!.result, { thread_id: threadId });

    const reject = await send(a, "dm", c.id);
    assert.equal(
      ((await answer(c, idOf(reject), false)).data as unknown as Res).status,
      "rejected",
    );

    // 거절된 요청은 24시간 동안 다시 보낼 수 없다
    const again = await send(a, "dm", c.id);
    assert.equal(again.error?.hint, "cooldown");
    await admin
      .from("live_requests")
      .update({
        responded_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
      })
      .eq("id", idOf(reject));

    const old = await send(a, "dm", c.id);
    await admin
      .from("live_requests")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", idOf(old));
    assert.equal(
      ((await answer(c, idOf(old), true)).data as unknown as Res).status,
      "expired",
    );
    assert.equal((await c.c.rpc("my_pending_requests")).data!.length, 0);
    // 만료된 뒤에는 다시 보낼 수 있다
    assert.equal(
      ((await send(a, "dm", c.id)).data as unknown as Res).status,
      "pending",
    );
  });

  await t.test("찻집 모임맺기: 수락하면 모임이 생기고 둘이 멤버", async () => {
    const bad = await send(a, "group_create", b.id, { name: "x" });
    assert.equal(bad.error?.code, "22023");
    const req = await send(a, "group_create", b.id, {
      name: `찻집 모임 ${suffix}`,
      description: "소개",
    });
    const res = await answer(b, idOf(req), true);
    const groupId = (res.data as unknown as Res).result!.group_id;
    const group = await a.c
      .from("groups")
      .select("owner_id, from_space")
      .eq("id", groupId)
      .single();
    assert.equal(group.data!.owner_id, a.id);
    assert.equal(group.data!.from_space, true);
    const members = await a.c
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    assert.equal(members.data!.length, 2);

    // 모임 들어가기: 모임장에게 간다
    const join = await send(c, "group_join", b.id, { group_id: groupId });
    assert.equal(join.error, null);
    const toOwner = await a.c.rpc("my_pending_requests");
    assert.ok(
      toOwner.data!.some(
        (r) => r.kind === "group_join" && r.from_user === c.id,
      ),
    );
    assert.equal(
      (await answer(b, idOf(join), true)).error?.code,
      "P0002",
      "모임장만 답한다",
    );
    assert.equal(
      ((await answer(a, idOf(join), true)).data as unknown as Res).status,
      "accepted",
    );
    const inGroup = await c.c
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", c.id)
      .single();
    assert.equal(inGroup.data!.role, "member");
    // 이미 멤버면 다시 신청 불가
    assert.equal(
      (await send(c, "group_join", a.id, { group_id: groupId })).error?.code,
      "22023",
    );
    // 강제 퇴장당한 사람은 신청 불가
    await a.c
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", c.id);
    assert.equal(
      (await send(c, "group_join", a.id, { group_id: groupId })).error?.code,
      "42501",
    );
  });

  await t.test("차단 상태·자기 자신·비로그인·직접 쓰기는 막힌다", async () => {
    assert.equal((await send(a, "dm", a.id)).error?.code, "22023");
    await a.c.from("blocks").insert({ blocker_id: a.id, blocked_id: b.id });
    const blocked = await send(b, "dm", a.id);
    // 차단당한 쪽에는 차단 사실을 드러내지 않는다
    assert.equal(blocked.error?.hint, "unavailable");
    const mine = await send(a, "dm", b.id);
    assert.equal(mine.error?.hint, "blocked");
    await a.c
      .from("blocks")
      .delete()
      .eq("blocker_id", a.id)
      .eq("blocked_id", b.id);
    assert.ok(
      (
        await makeClient().rpc("create_live_request", {
          p_kind: "dm",
          p_to: a.id,
        })
      ).error,
    );
    const raw = a.c as unknown as SupabaseClient;
    assert.ok(
      (
        await raw
          .from("live_requests")
          .insert({ kind: "dm", from_user: b.id, to_user: a.id })
      ).error,
    );
    assert.equal(
      (
        await c.c
          .from("live_requests")
          .select("id")
          .eq("from_user", a.id)
          .eq("to_user", b.id)
      ).data?.length,
      0,
      "남의 요청은 안 보인다",
    );
  });
});
