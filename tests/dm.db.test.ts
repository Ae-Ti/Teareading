import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchMessages, insertMessage } from "@/lib/chat/rooms";
import { getThread, listThreads } from "@/lib/dm";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// DM·차단 DB 검증. 로컬 Supabase에서만 실행한다.
test("DM 대화방 1개·참여자 권한·차단·목록", async (t) => {
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
  async function signUp(label: string) {
    const c = makeClient();
    const { data, error } = await c.auth.signUp({
      email: `dm-${label.toLowerCase()}-${suffix}@example.com`,
      password: "Dm-reader-123!",
      options: { data: { nickname: `디엠${label}${suffix}` } },
    });
    assert.equal(error, null);
    assert.ok(data.user && data.session);
    return { c, id: data.user.id };
  }
  const a = await signUp("A");
  const b = await signUp("B");
  const third = await signUp("C");
  const anon = makeClient();
  const start = (c: SupabaseClient<Database>, other: string) =>
    c.rpc("start_dm", { p_other: other });

  let threadId = "";
  const room = () => ({ kind: "dm", id: threadId }) as const;

  await t.test(
    "동시에·여러 번 시작해도 대화방은 1개, 신규는 한 번만",
    async () => {
      const results = await Promise.all([
        start(a.c, b.id),
        start(b.c, a.id),
        start(a.c, b.id),
        start(b.c, a.id),
      ]);
      for (const r of results) assert.equal(r.error, null);
      const values = results.map(
        (r) => r.data as { id: string; created: boolean },
      );
      assert.equal(new Set(values.map((v) => v.id)).size, 1);
      assert.equal(values.filter((v) => v.created).length, 1);
      threadId = values[0].id;

      const again = await start(a.c, b.id);
      assert.deepEqual(again.data, { id: threadId, created: false });
    },
  );

  await t.test("자기 자신·없는 회원·비로그인은 시작할 수 없다", async () => {
    assert.equal((await start(a.c, a.id)).error?.code, "22023");
    assert.equal((await start(a.c, randomUUID())).error?.code, "P0002");
    assert.ok((await start(anon, a.id)).error);
    // 남 둘 사이의 대화방을 직접 만들 수 없다
    const [x, y] = [b.id, third.id].sort();
    const forged = await a.c
      .from("dm_threads")
      .insert({ user_a: x, user_b: y });
    assert.ok(forged.error);
    // 정렬되지 않은 쌍도 거부
    const [lo, hi] = [a.id, third.id].sort();
    const unordered = await a.c
      .from("dm_threads")
      .insert({ user_a: hi, user_b: lo });
    assert.ok(unordered.error);
  });

  await t.test("참여자만 주고받고, 같은 client_id는 1건", async () => {
    const clientId = randomUUID();
    const sent = await Promise.all([
      insertMessage(a.c, room(), a.id, clientId, "안녕하세요"),
      insertMessage(a.c, room(), a.id, clientId, "안녕하세요"),
    ]);
    assert.ok(sent.every((r) => r.ok));
    assert.equal(sent.filter((r) => r.ok && !r.duplicate).length, 1);
    const reply = await insertMessage(
      b.c,
      room(),
      b.id,
      randomUUID(),
      "반가워요",
    );
    assert.ok(reply.ok);

    const list = await fetchMessages(b.c, room());
    assert.deepEqual(
      list.messages.map((m) => m.body),
      ["안녕하세요", "반가워요"],
    );

    // 제3자·비로그인
    const peek = await fetchMessages(third.c, room());
    assert.equal(peek.messages.length, 0);
    assert.equal((await getThread(third.c, threadId, third.id)).thread, null);
    const intrude = await insertMessage(
      third.c,
      room(),
      third.id,
      randomUUID(),
      "끼어들기",
    );
    assert.equal(!intrude.ok && intrude.reason, "denied");
    const anonRead = await anon.from("dm_messages").select("id").limit(1);
    assert.ok(anonRead.error || anonRead.data?.length === 0);

    // 보낸 사람 위조
    const spoof = await (a.c as unknown as SupabaseClient)
      .from("dm_messages")
      .insert({
        thread_id: threadId,
        client_id: randomUUID(),
        body: "B인 척",
        sender_id: b.id,
      });
    assert.ok(spoof.error);
  });

  await t.test("목록: 상대·마지막 메시지·내가 보냈는지", async () => {
    const listA = await listThreads(a.c, a.id);
    assert.equal(listA.error, null);
    const row = listA.threads!.find((x) => x.id === threadId)!;
    assert.equal(row.otherId, b.id);
    assert.equal(row.otherNickname, `디엠B${suffix}`);
    assert.equal(row.lastBody, "반가워요");
    assert.equal(row.lastMine, false);
    assert.equal(row.blockedByMe, false);
    const listC = await listThreads(third.c, third.id);
    assert.equal(
      listC.threads!.some((x) => x.id === threadId),
      false,
    );
  });

  await t.test(
    "차단하면 양쪽 모두 전송·새 대화가 막히고 기록은 남는다",
    async () => {
      assert.equal(
        (
          await a.c
            .from("blocks")
            .insert({ blocker_id: a.id, blocked_id: b.id })
        ).error,
        null,
      );
      // 남의 이름으로 차단·자기 자신 차단 불가
      assert.ok(
        (
          await a.c
            .from("blocks")
            .insert({ blocker_id: b.id, blocked_id: third.id })
        ).error,
      );
      assert.ok(
        (
          await a.c
            .from("blocks")
            .insert({ blocker_id: a.id, blocked_id: a.id })
        ).error,
      );

      // 차단 목록은 차단한 본인만 본다
      const seenByB = await b.c.from("blocks").select("*");
      assert.equal(seenByB.data?.length, 0);

      for (const [who, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const r = await insertMessage(
          who.c,
          room(),
          who.id,
          randomUUID(),
          "차단 후",
        );
        assert.equal(!r.ok && r.reason, "denied");
        const view = await getThread(who.c, threadId, who.id);
        assert.equal(view.thread?.canSend, false);
        assert.equal(view.thread?.blockedByMe, who.id === a.id);
        // 기존 대화로는 들어갈 수 있다
        assert.deepEqual((await start(who.c, other.id)).data, {
          id: threadId,
          created: false,
        });
      }
      const history = await fetchMessages(b.c, room());
      assert.equal(history.messages.length, 2);

      // 차단 상태에서는 새 대화도 못 만든다 (A가 C를 차단 → C가 시작 시도)
      await a.c
        .from("blocks")
        .insert({ blocker_id: a.id, blocked_id: third.id });
      const blockedStart = await start(third.c, a.id);
      assert.equal(blockedStart.error?.hint, "blocked");
      const direct = await third.c
        .from("dm_threads")
        .insert({
          user_a: [a.id, third.id].sort()[0],
          user_b: [a.id, third.id].sort()[1],
        });
      assert.ok(direct.error);

      // B는 A의 차단을 풀 수 없다
      const foreignUnblock = await b.c
        .from("blocks")
        .delete()
        .eq("blocker_id", a.id)
        .select("blocked_id");
      assert.equal(foreignUnblock.data?.length ?? 0, 0);

      // 해제하면 다시 보낼 수 있다
      await a.c
        .from("blocks")
        .delete()
        .eq("blocker_id", a.id)
        .eq("blocked_id", b.id);
      const after = await insertMessage(
        b.c,
        room(),
        b.id,
        randomUUID(),
        "다시 연결",
      );
      assert.ok(after.ok);
    },
  );

  await t.test("대화·메시지는 수정·삭제할 수 없다", async () => {
    const raw = a.c as unknown as SupabaseClient;
    const upd = await raw
      .from("dm_messages")
      .update({ body: "x" })
      .eq("thread_id", threadId)
      .select("id");
    assert.ok(upd.error || upd.data?.length === 0);
    const del = await raw
      .from("dm_threads")
      .delete()
      .eq("id", threadId)
      .select("id");
    assert.ok(del.error || del.data?.length === 0);
  });
});
