import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 친구의 방 구경. 로컬 Supabase에서만 실행한다.
test("친구의 방: 친구만, 개수만", async (t) => {
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
  const suffix = randomUUID().slice(0, 8);
  async function signUp(label: string) {
    const c = createClient<Database>(url!, key!, options);
    const { data, error } = await c.auth.signUp({
      email: `room-${label}-${suffix}@example.com`,
      password: "Room-reader-123!",
      options: { data: { nickname: `방${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const owner = await signUp("a");
  const friend = await signUp("b");
  const stranger = await signUp("c");

  const room = async (u: typeof owner) =>
    u.c.rpc("friend_room", { p_owner: owner.id });

  const save = await owner.c
    .from("space_rooms")
    .insert({ user_id: owner.id, style: { wall: "hanji", floor: "wood" } });
  assert.equal(save.error, null);
  const column = await owner.c
    .from("tea_columns")
    .insert({ title: "방 칼럼", body: "숨은 본문" });
  assert.equal(column.error, null);

  const request = await owner.c.rpc("create_live_request", {
    p_kind: "friend",
    p_to: friend.id,
  });
  assert.equal(request.error, null);
  const requestId = (request.data as { id: string }).id;

  await t.test("친구가 되기 전에는 볼 수 없다", async () => {
    const res = await room(friend);
    assert.equal(res.error, null);
    assert.equal(res.data, null);
  });

  await t.test("친구는 꾸밈과 개수만 받는다", async () => {
    const accept = await friend.c.rpc("respond_live_request", {
      p_id: requestId,
      p_accept: true,
    });
    assert.equal(accept.error, null);
    const res = await room(friend);
    assert.equal(res.error, null);
    assert.deepEqual(res.data, {
      style: { wall: "hanji", floor: "wood" },
      books: 0,
      columns: 1,
      tea_sessions: 0,
      attendance_days: 0,
    });
    assert.ok(!JSON.stringify(res.data).includes("숨은 본문"));
  });

  await t.test("친구가 아니면 볼 수 없다", async () => {
    const res = await room(stranger);
    assert.equal(res.error, null);
    assert.equal(res.data, null);
  });

  await t.test("표를 직접 읽거나 바꿀 수 없다", async () => {
    const read = await friend.c
      .from("space_rooms")
      .select("style")
      .eq("user_id", owner.id);
    assert.deepEqual(read.data, []);
    const write = await friend.c
      .from("space_rooms")
      .update({ style: { wall: "night", floor: "wood" } })
      .eq("user_id", owner.id)
      .select();
    assert.deepEqual(write.data, []);
  });

  await t.test("비로그인은 호출할 수 없다", async () => {
    const anon = createClient<Database>(url, key, options);
    const res = await anon.rpc("friend_room", { p_owner: owner.id });
    assert.ok(res.error);
  });

  await t.test("차단하면 친구여도 볼 수 없다 (양쪽)", async () => {
    const blocked = await owner.c
      .from("blocks")
      .insert({ blocked_id: friend.id });
    assert.equal(blocked.error, null);
    assert.equal((await room(friend)).data, null);
    await owner.c.from("blocks").delete().eq("blocked_id", friend.id);
    const reverse = await friend.c
      .from("blocks")
      .insert({ blocked_id: owner.id });
    assert.equal(reverse.error, null);
    assert.equal((await room(friend)).data, null);
    await friend.c.from("blocks").delete().eq("blocked_id", owner.id);
  });

  await t.test("친구를 끊으면 볼 수 없다", async () => {
    const [low, high] =
      owner.id < friend.id ? [owner.id, friend.id] : [friend.id, owner.id];
    const removed = await friend.c
      .from("friendships")
      .delete()
      .eq("user_a", low)
      .eq("user_b", high);
    assert.equal(removed.error, null);
    assert.equal((await room(friend)).data, null);
  });
});
