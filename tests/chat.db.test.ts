import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchMessages, fetchNewer, insertMessage } from "@/lib/chat/rooms";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 단체 채팅 DB 검증: 멤버만 읽고 쓰기, 보낸 사람 위조 불가, client_id 중복 저장 방지,
// 탈퇴 후 차단, 실시간 수신 범위. 로컬 Supabase에서만 실행한다.
test("단체 채팅 권한·중복 방지·실시간 수신", async (t) => {
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
      email: `chat-${label}-${suffix}@example.com`,
      password: "Chat-reader-123!",
      options: { data: { nickname: `채팅${label}${suffix}` } },
    });
    assert.equal(error, null);
    assert.ok(data.user && data.session);
    return { c, id: data.user.id };
  }
  const owner = await signUp("A");
  const member = await signUp("B");
  const outsider = await signUp("C");
  const anon = makeClient();

  const created = await owner.c
    .from("groups")
    .insert({ name: `채팅 검증 ${suffix}` })
    .select("id")
    .single();
  assert.equal(created.error, null);
  const groupId = created.data!.id;
  const room = { kind: "group", id: groupId } as const;
  assert.equal(
    (
      await member.c
        .from("group_members")
        .insert({ group_id: groupId, user_id: member.id })
    ).error,
    null,
  );

  try {
    await t.test(
      "멤버는 보내고 읽는다. 작성 시각은 서버 시각이다",
      async () => {
        const sent = await insertMessage(
          owner.c,
          room,
          owner.id,
          randomUUID(),
          "첫 인사",
        );
        assert.ok(sent.ok);
        assert.equal(sent.message.sender_id, owner.id);
        assert.equal(sent.profile?.nickname, `채팅A${suffix}`);

        const forged = await (owner.c as unknown as SupabaseClient)
          .from("group_messages")
          .insert({
            group_id: groupId,
            client_id: randomUUID(),
            body: "과거로",
            created_at: "2000-01-01T00:00:00Z",
          })
          .select("created_at")
          .single();
        assert.equal(forged.error, null);
        assert.ok(
          Date.now() - Date.parse(forged.data!.created_at) < 60_000,
          "클라이언트가 보낸 작성 시각은 무시된다",
        );

        const list = await fetchMessages(member.c, room);
        assert.equal(list.error, null);
        assert.deepEqual(
          list.messages.map((m) => m.body),
          ["첫 인사", "과거로"],
        );
      },
    );

    await t.test(
      "같은 client_id 재시도·동시 전송은 1건만 저장된다",
      async () => {
        const clientId = randomUUID();
        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            insertMessage(member.c, room, member.id, clientId, "한 번만"),
          ),
        );
        assert.ok(results.every((r) => r.ok));
        const ids = new Set(results.map((r) => (r.ok ? r.message.id : "")));
        assert.equal(ids.size, 1);
        assert.equal(results.filter((r) => r.ok && !r.duplicate).length, 1);

        const { count } = await member.c
          .from("group_messages")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId);
        assert.equal(count, 1);

        // 다른 사람이 같은 client_id를 써도 내 메시지를 가로채지 못한다
        const other = await insertMessage(
          owner.c,
          room,
          owner.id,
          clientId,
          "다른 사람",
        );
        assert.ok(other.ok && !other.duplicate);
        assert.equal(other.message.sender_id, owner.id);
      },
    );

    await t.test("빈 본문·길이 초과·보낸 사람 위조를 거부한다", async () => {
      const raw = member.c as unknown as SupabaseClient;
      for (const body of ["", "   \n", "가".repeat(1001)]) {
        const res = await raw
          .from("group_messages")
          .insert({ group_id: groupId, client_id: randomUUID(), body });
        assert.ok(res.error, `본문 ${JSON.stringify(body.slice(0, 5))} 거부`);
      }
      const spoof = await raw.from("group_messages").insert({
        group_id: groupId,
        client_id: randomUUID(),
        body: "모임장인 척",
        sender_id: owner.id,
      });
      assert.ok(spoof.error, "남의 이름으로 보내기 거부");
    });

    await t.test("수정·삭제는 아무도 못 한다", async () => {
      const { data } = await owner.c
        .from("group_messages")
        .select("id")
        .eq("group_id", groupId)
        .limit(1)
        .single();
      const raw = owner.c as unknown as SupabaseClient;
      const upd = await raw
        .from("group_messages")
        .update({ body: "수정" })
        .eq("id", data!.id)
        .select("id");
      assert.ok(upd.error || upd.data?.length === 0, "수정 거부");
      const del = await raw
        .from("group_messages")
        .delete()
        .eq("id", data!.id)
        .select("id");
      assert.ok(del.error || del.data?.length === 0, "삭제 거부");
    });

    await t.test("비회원·비로그인은 읽지도 쓰지도 못한다", async () => {
      const read = await outsider.c
        .from("group_messages")
        .select("id")
        .eq("group_id", groupId);
      assert.equal(read.error, null);
      assert.equal(read.data?.length, 0);
      const send = await insertMessage(
        outsider.c,
        room,
        outsider.id,
        randomUUID(),
        "몰래",
      );
      assert.equal(send.ok, false);
      assert.equal(!send.ok && send.reason, "denied");

      const anonRead = await anon.from("group_messages").select("id").limit(1);
      assert.ok(anonRead.error || anonRead.data?.length === 0);
      const anonSend = await (anon as unknown as SupabaseClient)
        .from("group_messages")
        .insert({ group_id: groupId, client_id: randomUUID(), body: "익명" });
      assert.ok(anonSend.error);
    });

    await t.test("멤버만 실시간으로 받는다", async () => {
      const received = { member: [] as string[], outsider: [] as string[] };
      const subscribe = (
        c: SupabaseClient<Database>,
        who: keyof typeof received,
      ) =>
        new Promise<ReturnType<typeof c.channel>>((resolve, reject) => {
          const channel = c
            .channel(`test:${who}:${suffix}`)
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "group_messages",
                filter: `group_id=eq.${groupId}`,
              },
              (payload) =>
                received[who].push((payload.new as { body: string }).body),
            )
            .subscribe((status, err) => {
              if (status === "SUBSCRIBED") resolve(channel);
              if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
                reject(err ?? new Error(status));
            });
        });
      const channels = [
        [member.c, await subscribe(member.c, "member")],
        [outsider.c, await subscribe(outsider.c, "outsider")],
      ] as const;
      try {
        // 구독이 서버에 등록될 시간을 준다
        await new Promise((r) => setTimeout(r, 3000));
        const sent = await insertMessage(
          owner.c,
          room,
          owner.id,
          randomUUID(),
          "실시간",
        );
        assert.ok(sent.ok);
        // 구독 직전에 저장된 메시지가 늦게 함께 올 수 있다(Realtime 특성). 화면은 mergeMessages로 중복을 없앤다.
        for (let i = 0; i < 80 && !received.member.includes("실시간"); i++)
          await new Promise((r) => setTimeout(r, 100));
        assert.ok(
          received.member.includes("실시간"),
          "멤버는 새 메시지를 받는다",
        );
        await new Promise((r) => setTimeout(r, 500));
        assert.deepEqual(received.outsider, [], "비회원에게는 전달되지 않는다");
      } finally {
        for (const [c, ch] of channels) await c.removeChannel(ch);
      }
    });

    await t.test(
      "탈퇴하면 기존 메시지도 읽지 못하고 보낼 수 없다",
      async () => {
        assert.equal(
          (
            await member.c
              .from("group_members")
              .delete()
              .eq("group_id", groupId)
              .eq("user_id", member.id)
          ).error,
          null,
        );
        const list = await fetchMessages(member.c, room);
        assert.equal(list.error, null);
        assert.equal(list.messages.length, 0);
        const send = await insertMessage(
          member.c,
          room,
          member.id,
          randomUUID(),
          "탈퇴 후",
        );
        assert.equal(!send.ok && send.reason, "denied");
      },
    );

    await t.test("이전 메시지 페이지를 중복 없이 이어 붙인다", async () => {
      const bodies = Array.from({ length: 55 }, (_, i) => `p${i}`);
      for (const body of bodies) {
        const r = await insertMessage(
          owner.c,
          room,
          owner.id,
          randomUUID(),
          body,
        );
        assert.ok(r.ok);
      }
      const first = await fetchMessages(owner.c, room);
      assert.equal(first.messages.length, 50);
      assert.equal(first.hasMore, true);
      const second = await fetchMessages(
        owner.c,
        room,
        first.messages[0].created_at,
      );
      assert.equal(second.error, null);
      const all = [...second.messages, ...first.messages];
      assert.equal(new Set(all.map((m) => m.id)).size, all.length);
      assert.deepEqual(
        all.slice(-55).map((m) => m.body),
        bodies,
      );
      // 오래 끊겼다가 돌아온 경우: 화면의 가장 최근 메시지 이후를 페이지 단위로 빠짐없이 받는다
      const anchor = all[all.length - 56];
      const gap: string[] = [];
      let after = anchor.created_at;
      for (;;) {
        const page = await fetchNewer(owner.c, room, after);
        assert.equal(page.error, null);
        gap.push(...page.messages.map((m) => m.body));
        if (!page.hasMore) break;
        after = page.messages[page.messages.length - 1].created_at;
      }
      assert.deepEqual(gap, bodies);
      const times = all.map((m) => Date.parse(m.created_at));
      assert.deepEqual(
        times,
        [...times].sort((x, y) => x - y),
      );
    });
  } finally {
    await owner.c.from("groups").delete().eq("id", groupId);
    await Promise.all(
      [owner.c, member.c, outsider.c].map((c) => c.removeAllChannels()),
    );
  }
});
