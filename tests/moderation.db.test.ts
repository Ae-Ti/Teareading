import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { insertMessage } from "@/lib/chat/rooms";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 모임 운영 권한: 모임장·부모임장·멤버·비회원. 로컬 Supabase에서만 실행한다.
test("부모임장 지정·강제 퇴장·메시지 차단·메시지 삭제·모임 채팅 목록", async (t) => {
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
      email: `mod-${label.toLowerCase()}-${suffix}@example.com`,
      password: "Mod-reader-123!",
      options: { data: { nickname: `운영${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const owner = await signUp("O");
  const manager = await signUp("M");
  const member = await signUp("A");
  const member2 = await signUp("B");
  const outsider = await signUp("X");

  const created = await owner.c
    .from("groups")
    .insert({ name: `운영 모임 ${suffix}` })
    .select("id")
    .single();
  const groupId = created.data!.id;
  const room = { kind: "group", id: groupId } as const;
  for (const u of [manager, member, member2])
    assert.equal(
      (
        await u.c
          .from("group_members")
          .insert({ group_id: groupId, user_id: u.id })
      ).error,
      null,
    );
  const role = async (id: string) =>
    (
      await owner.c
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", id)
        .maybeSingle()
    ).data?.role;
  const setManager = (c: SupabaseClient<Database>, id: string, on: boolean) =>
    c.rpc("set_group_manager", {
      p_group_id: groupId,
      p_user_id: id,
      p_manager: on,
    });
  const setMute = (c: SupabaseClient<Database>, id: string, on: boolean) =>
    c.rpc("set_group_mute", {
      p_group_id: groupId,
      p_user_id: id,
      p_muted: on,
    });

  try {
    await t.test("모임장만 부모임장을 지정하고, 모임당 1명이다", async () => {
      assert.ok(
        (await setManager(member.c, member.id, true)).error,
        "멤버는 지정 불가",
      );
      assert.equal((await setManager(owner.c, manager.id, true)).error, null);
      assert.equal(await role(manager.id), "manager");
      assert.ok(
        (await setManager(manager.c, member.id, true)).error,
        "부모임장도 지정 불가",
      );
      assert.ok(
        (await setManager(owner.c, owner.id, true)).error,
        "모임장 역할 변경 불가",
      );
      // 다른 사람을 지정하면 기존 부모임장은 일반 멤버로
      assert.equal((await setManager(owner.c, member2.id, true)).error, null);
      assert.equal(await role(member2.id), "manager");
      assert.equal(await role(manager.id), "member");
      // 원래대로
      assert.equal((await setManager(owner.c, manager.id, true)).error, null);
      assert.equal(await role(member2.id), "member");
      // 직접 역할을 바꾸는 것은 불가
      const direct = await (manager.c as unknown as SupabaseClient)
        .from("group_members")
        .update({ role: "owner" })
        .eq("group_id", groupId)
        .eq("user_id", manager.id)
        .select("role");
      assert.ok(direct.error || direct.data?.length === 0);
    });

    await t.test("메시지 차단: 모임장·부모임장 권한 범위", async () => {
      assert.ok(
        (await setMute(member.c, member2.id, true)).error,
        "멤버는 차단 불가",
      );
      assert.ok(
        (await setMute(manager.c, owner.id, true)).error,
        "모임장 차단 불가",
      );
      assert.ok(
        (await setMute(owner.c, owner.id, true)).error,
        "자기 자신 차단 불가",
      );
      assert.ok(
        (await setMute(manager.c, outsider.id, true)).error,
        "비회원 대상 불가",
      );
      assert.equal((await setMute(manager.c, member.id, true)).error, null);

      const blocked = await insertMessage(
        member.c,
        room,
        member.id,
        randomUUID(),
        "막힘",
      );
      assert.equal(!blocked.ok && blocked.reason, "denied");
      // 나갔다 들어와도 유지
      await member.c
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", member.id);
      await member.c
        .from("group_members")
        .insert({ group_id: groupId, user_id: member.id });
      const still = await insertMessage(
        member.c,
        room,
        member.id,
        randomUUID(),
        "그래도 막힘",
      );
      assert.equal(still.ok, false);
      // 목록은 모임 멤버가 볼 수 있고 비회원은 못 본다
      const seen = await member2.c
        .from("group_mutes")
        .select("user_id")
        .eq("group_id", groupId);
      assert.deepEqual(
        seen.data?.map((m) => m.user_id),
        [member.id],
      );
      const hidden = await outsider.c
        .from("group_mutes")
        .select("user_id")
        .eq("group_id", groupId);
      assert.equal(hidden.data?.length, 0);
      // 직접 쓰기 불가
      const direct = await (member.c as unknown as SupabaseClient)
        .from("group_mutes")
        .delete()
        .eq("group_id", groupId)
        .select("user_id");
      assert.ok(direct.error || direct.data?.length === 0);

      // 부모임장 차단은 모임장만
      assert.equal((await setMute(owner.c, manager.id, true)).error, null);
      assert.equal((await setMute(owner.c, manager.id, false)).error, null);
      assert.equal((await setMute(manager.c, member.id, false)).error, null);
      const ok = await insertMessage(
        member.c,
        room,
        member.id,
        randomUUID(),
        "풀림",
      );
      assert.ok(ok.ok);
    });

    await t.test(
      "메시지 삭제: 모임장·부모임장만, 내용은 비워진다",
      async () => {
        const sent = await insertMessage(
          member2.c,
          room,
          member2.id,
          randomUUID(),
          "지울 메시지",
        );
        assert.ok(sent.ok);
        const id = sent.message.id;
        for (const u of [member, member2, outsider]) {
          const res = await u.c.rpc("delete_group_message", {
            p_message_id: id,
          });
          assert.ok(res.error, "권한 없음");
        }
        const del = await manager.c.rpc("delete_group_message", {
          p_message_id: id,
        });
        assert.equal(del.error, null);
        const row = await member.c
          .from("group_messages")
          .select("body, deleted_at, deleted_by")
          .eq("id", id)
          .single();
        assert.equal(row.data?.body, "");
        assert.ok(row.data?.deleted_at);
        assert.equal(row.data?.deleted_by, manager.id);
        assert.equal(
          (await owner.c.rpc("delete_group_message", { p_message_id: id }))
            .error,
          null,
          "모임장도 가능(이미 삭제된 것도 오류 없음)",
        );
        // 삭제 상태로 직접 보내기 불가
        const ghost = await (member.c as unknown as SupabaseClient)
          .from("group_messages")
          .insert({
            group_id: groupId,
            client_id: randomUUID(),
            body: "",
            deleted_at: new Date().toISOString(),
          });
        assert.ok(ghost.error);
      },
    );

    await t.test("강제 퇴장: 모임장만, 부모임장도 내보낼 수 있다", async () => {
      const byManager = await manager.c
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", member2.id)
        .select("user_id");
      assert.equal(byManager.data?.length ?? 0, 0, "부모임장은 내보내기 불가");
      const kickManager = await owner.c
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", manager.id)
        .select("user_id");
      assert.equal(kickManager.data?.length, 1);
      const kickOwner = await owner.c
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", owner.id)
        .select("user_id");
      assert.equal(kickOwner.data?.length ?? 0, 0, "모임장은 나갈 수 없음");
      // 내보내진 사람은 다시 가입할 수 없고, 본인 기록만 볼 수 있다
      const rejoin = await manager.c
        .from("group_members")
        .insert({ group_id: groupId, user_id: manager.id });
      assert.equal(rejoin.error?.code, "42501", "강제 퇴장 후 재가입 불가");
      const mine = await manager.c.from("group_bans").select("user_id");
      assert.deepEqual(
        mine.data?.map((b) => b.user_id),
        [manager.id],
      );
      const others = await member.c
        .from("group_bans")
        .select("user_id")
        .eq("group_id", groupId);
      assert.equal(others.data?.length, 0, "다른 멤버에게는 안 보임");
      // 모임장이 아니면 재가입을 허용할 수 없고, 기록을 직접 쓸 수도 없다
      const self = await manager.c
        .from("group_bans")
        .delete()
        .eq("group_id", groupId)
        .select("user_id");
      assert.equal(self.data?.length ?? 0, 0, "본인이 기록을 지울 수 없음");
      const forged = await member.c
        .from("group_bans")
        .insert({ group_id: groupId, user_id: member2.id });
      assert.ok(forged.error, "퇴장 기록 위조 불가");

      // 모임장이 허용하면 다시 가입할 수 있다
      assert.equal(
        (
          await owner.c
            .from("group_bans")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", manager.id)
        ).error,
        null,
      );
      assert.equal(
        (
          await manager.c
            .from("group_members")
            .insert({ group_id: groupId, user_id: manager.id })
        ).error,
        null,
      );
      // 스스로 나간 사람은 기록이 남지 않아 자유롭게 돌아올 수 있다
      await manager.c
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", manager.id);
      assert.equal(
        (
          await owner.c
            .from("group_bans")
            .select("user_id")
            .eq("group_id", groupId)
        ).data?.length,
        0,
      );

      // 내보내진 부모임장은 메시지를 볼 수 없다
      const read = await manager.c
        .from("group_messages")
        .select("id")
        .eq("group_id", groupId);
      assert.equal(read.data?.length, 0);
    });

    await t.test(
      "메시지 탭: 내가 참여한 모임 채팅만, 마지막 메시지와 함께",
      async () => {
        const mine = await member.c.rpc("my_group_chats");
        assert.equal(mine.error, null);
        const row = mine.data!.find((g) => g.group_id === groupId)!;
        assert.equal(row.name, `운영 모임 ${suffix}`);
        assert.equal(row.member_count, 3);
        assert.equal(row.last_deleted, true);
        assert.equal(row.last_body, "");
        const other = await outsider.c.rpc("my_group_chats");
        assert.equal(
          other.data!.some((g) => g.group_id === groupId),
          false,
        );
      },
    );
  } finally {
    await owner.c.from("groups").delete().eq("id", groupId);
  }
});
