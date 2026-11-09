import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { insertMessage } from "@/lib/chat/rooms";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 메시지 탭: 고정·알림 끄기·나가기·안 읽은 개수. 로컬 Supabase에서만 실행한다.
test("채팅방 설정과 안 읽은 개수", async (t) => {
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
      email: `prefs-${label.toLowerCase()}-${suffix}@example.com`,
      password: "Prefs-reader-123!",
      options: { data: { nickname: `설정${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("A");
  const b = await signUp("B");
  const outsider = await signUp("X");
  type U = typeof a;

  const group = await a.c
    .from("groups")
    .insert({ name: `설정 모임 ${suffix}` })
    .select("id")
    .single();
  const groupId = group.data!.id;
  await b.c.from("group_members").insert({ group_id: groupId, user_id: b.id });
  const dm = await a.c.rpc("start_dm", { p_other: b.id });
  const threadId = (dm.data as { id: string }).id;
  const groupRoom = { kind: "group", id: groupId } as const;
  const dmRoom = { kind: "dm", id: threadId } as const;

  const total = async (u: U) => (await u.c.rpc("my_unread_total")).data;
  const state = async (u: U, kind: string, id: string) =>
    (await u.c.rpc("my_chat_states")).data!.find(
      (s) => s.kind === kind && s.room_id === id,
    );
  const say = (u: U, room: typeof groupRoom | typeof dmRoom, body: string) =>
    insertMessage(u.c, room, u.id, randomUUID(), body);

  try {
    await t.test("남이 보낸 메시지만 세고, 읽으면 0이 된다", async () => {
      assert.equal(await total(b), 0);
      await say(a, groupRoom, "하나");
      await say(a, groupRoom, "둘");
      await say(a, dmRoom, "셋");
      assert.equal(await total(b), 3);
      assert.equal(await total(a), 0, "내가 보낸 메시지는 세지 않는다");
      assert.equal((await state(b, "group", groupId))?.unread, 2);

      await b.c.rpc("mark_chat_read", { p_kind: "group", p_room_id: groupId });
      assert.equal(await total(b), 1);
      await b.c.rpc("mark_chat_read", { p_kind: "dm", p_room_id: threadId });
      assert.equal(await total(b), 0);
    });

    await t.test("관리자가 지운 메시지는 세지 않는다", async () => {
      const sent = await say(a, groupRoom, "지울 것");
      assert.ok(sent.ok);
      assert.equal(await total(b), 1);
      await a.c.rpc("delete_group_message", { p_message_id: sent.message.id });
      assert.equal(await total(b), 0);
    });

    await t.test(
      "알림을 끄면 합계에서 빠지지만 방별 개수는 남는다",
      async () => {
        await b.c.rpc("set_chat_pref", {
          p_kind: "group",
          p_room_id: groupId,
          p_muted: true,
        });
        await say(a, groupRoom, "조용히");
        assert.equal(await total(b), 0);
        const s = await state(b, "group", groupId);
        assert.equal(s?.muted, true);
        assert.equal(s?.unread, 1);
        await b.c.rpc("set_chat_pref", {
          p_kind: "group",
          p_room_id: groupId,
          p_muted: false,
        });
        assert.equal(await total(b), 1);
        await b.c.rpc("mark_chat_read", {
          p_kind: "group",
          p_room_id: groupId,
        });
      },
    );

    await t.test("상단 고정·해제, 다른 설정은 유지", async () => {
      await b.c.rpc("set_chat_pref", {
        p_kind: "dm",
        p_room_id: threadId,
        p_muted: true,
      });
      await b.c.rpc("set_chat_pref", {
        p_kind: "dm",
        p_room_id: threadId,
        p_pinned: true,
      });
      let s = await state(b, "dm", threadId);
      assert.ok(s?.pinned_at);
      assert.equal(s?.muted, true);
      await b.c.rpc("set_chat_pref", {
        p_kind: "dm",
        p_room_id: threadId,
        p_pinned: false,
        p_muted: false,
      });
      s = await state(b, "dm", threadId);
      assert.equal(s?.pinned_at, null);
      assert.equal(s?.muted, false);
    });

    await t.test(
      "1:1 나가기: 내 목록에서만 사라지고 새 메시지가 오면 돌아온다",
      async () => {
        await b.c.rpc("leave_dm", { p_thread_id: threadId });
        assert.equal((await state(b, "dm", threadId))?.hidden, true);
        assert.equal(
          (await state(a, "dm", threadId))?.hidden,
          false,
          "상대 목록은 그대로",
        );
        assert.equal(await total(b), 0);

        await say(a, dmRoom, "돌아와요");
        const back = await state(b, "dm", threadId);
        assert.equal(back?.hidden, false);
        assert.equal(back?.unread, 1, "나간 뒤 온 메시지만 센다");

        // 다시 나갔다가 직접 대화를 열어도 돌아온다
        await b.c.rpc("leave_dm", { p_thread_id: threadId });
        await b.c.rpc("mark_chat_read", { p_kind: "dm", p_room_id: threadId });
        assert.equal((await state(b, "dm", threadId))?.hidden, false);
      },
    );

    await t.test(
      "참여하지 않은 방은 설정할 수 없고, 남의 설정은 볼 수 없다",
      async () => {
        for (const res of [
          await outsider.c.rpc("set_chat_pref", {
            p_kind: "group",
            p_room_id: groupId,
            p_pinned: true,
          }),
          await outsider.c.rpc("mark_chat_read", {
            p_kind: "dm",
            p_room_id: threadId,
          }),
          await outsider.c.rpc("leave_dm", { p_thread_id: threadId }),
        ])
          assert.equal(res.error?.code, "42501");

        const raw = b.c as unknown as SupabaseClient;
        const write = await raw.from("chat_room_prefs").insert({
          kind: "group",
          room_id: groupId,
          muted: true,
        });
        assert.ok(write.error, "직접 쓰기 불가");
        const seen = await a.c
          .from("chat_room_prefs")
          .select("user_id")
          .eq("user_id", b.id);
        assert.equal(seen.data?.length, 0);
        assert.ok((await makeClient().rpc("my_unread_total")).error);
      },
    );

    await t.test(
      "모임에 새로 가입하면 가입 전 메시지는 세지 않고, 나가면 설정이 지워진다",
      async () => {
        await outsider.c
          .from("group_members")
          .insert({ group_id: groupId, user_id: outsider.id });
        assert.equal(await total(outsider), 0);
        await say(a, groupRoom, "환영");
        assert.equal(await total(outsider), 1);

        await outsider.c.rpc("set_chat_pref", {
          p_kind: "group",
          p_room_id: groupId,
          p_pinned: true,
        });
        await outsider.c
          .from("group_members")
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", outsider.id);
        const left = await outsider.c
          .from("chat_room_prefs")
          .select("room_id")
          .eq("room_id", groupId);
        assert.equal(left.data?.length, 0);
        assert.equal(await total(outsider), 0);
      },
    );
  } finally {
    await a.c.from("groups").delete().eq("id", groupId);
  }

  await t.test("모임이 지워지면 설정도 함께 지워진다", async () => {
    const left = await b.c
      .from("chat_room_prefs")
      .select("room_id")
      .eq("room_id", groupId);
    assert.equal(left.data?.length, 0);
  });
});
