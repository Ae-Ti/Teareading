import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";

// 테이블을 돌며 검사하므로 타입이 없는 클라이언트를 쓴다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// D6 RLS 점검: 다른 계정·비로그인으로 남의 데이터를 조회·수정·삭제하려 하면 모두 실패해야 한다.
test("태일 담당 테이블 RLS 점검", async (t) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "로컬 Supabase 연결값이 필요합니다.");
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname),
    "이 테스트는 로컬 Supabase에서만 실행합니다.",
  );
  const client = () =>
    createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  const suffix = randomUUID().slice(0, 8);
  async function signUp(label: string) {
    const c = client();
    const { data, error } = await c.auth.signUp({
      email: `rls-${label}-${suffix}@example.com`,
      password: "Rls-reader-123!",
      options: { data: { nickname: `Rls${label}${suffix}` } },
    });
    assert.equal(error, null);
    assert.ok(data.user && data.session);
    await c.realtime.setAuth(data.session.access_token);
    return { c, id: data.user.id };
  }
  const { c: a, id: idA } = await signUp("A");
  const { c: b, id: idB } = await signUp("B");
  const { c: third } = await signUp("C");
  const anon = client();

  // 결과가 "오류" 또는 "빈 결과"면 막힌 것으로 본다 (RLS는 보통 조용히 0행을 돌려준다).
  function assertBlocked(
    res: { error: unknown; data: unknown },
    message: string,
  ) {
    const empty =
      res.data === null || (Array.isArray(res.data) && res.data.length === 0);
    assert.ok(res.error || empty, message);
  }

  async function assertNoAnonRead(c: SupabaseClient) {
    for (const table of [
      "profiles",
      "timer_sessions",
      "attendance_days",
      "reading_logs",
      "tea_columns",
      "groups",
      "group_members",
      "space_visits",
      "space_avatars",
      "group_messages",
      "dm_threads",
      "dm_messages",
      "blocks",
      "events",
    ] as const) {
      const res = await c.from(table).select("*").limit(1);
      assertBlocked(res, `비로그인으로 ${table} 조회가 막혀야 함`);
    }
  }

  try {
    await t.test("비로그인은 어떤 테이블도 읽을 수 없다", () =>
      assertNoAnonRead(anon),
    );

    await t.test("타이머: 남의 세션 조회·종료·직접 쓰기 불가", async () => {
      const started = await a.rpc("start_timer", {
        p_activity: "tea",
        p_target_seconds: 600,
      });
      assert.equal(started.error, null);
      const timerId = (started.data as { id: string }).id;

      assertBlocked(
        await b.from("timer_sessions").select("id").eq("id", timerId),
        "B가 A의 타이머를 조회",
      );
      const foreignFinish = await b.rpc("finish_timer", {
        p_id: timerId,
        p_status: "completed",
      });
      assert.ok(foreignFinish.error, "B가 A의 타이머를 종료");

      const insert = await a.from("timer_sessions").insert({
        user_id: idA,
        activity: "tea",
        target_seconds: 600,
      });
      assert.ok(insert.error, "타이머 직접 insert");
      assertBlocked(
        await a
          .from("timer_sessions")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("id", timerId)
          .select("id"),
        "타이머 직접 update(완료 위조)",
      );

      const anonStart = await anon.rpc("start_timer", {
        p_activity: "tea",
        p_target_seconds: 600,
      });
      assert.ok(anonStart.error, "비로그인 start_timer");

      const stopped = await a.rpc("finish_timer", {
        p_id: timerId,
        p_status: "stopped",
      });
      assert.equal(stopped.error, null);
      assertBlocked(
        await b.from("attendance_days").select("*").eq("user_id", idA),
        "B가 A의 출석 조회",
      );
    });

    for (const table of ["reading_logs", "tea_columns"] as const) {
      await t.test(
        `${table}: 남의 글 조회·수정·삭제·대리 작성 불가`,
        async () => {
          const row: Record<string, string> =
            table === "reading_logs"
              ? { user_id: idA, book_title: "A의 책", body: "비밀 기록" }
              : { user_id: idA, title: "A의 칼럼", body: "비밀 칼럼" };
          const own = await a.from(table).insert(row).select("id").single();
          assert.equal(own.error, null);
          const id = own.data!.id;

          assertBlocked(
            await b.from(table).select("id").eq("id", id),
            "B가 A의 글 조회",
          );
          assertBlocked(
            await b
              .from(table)
              .update({ body: "변조" })
              .eq("id", id)
              .select("id"),
            "B가 A의 글 수정",
          );
          assertBlocked(
            await b.from(table).delete().eq("id", id).select("id"),
            "B가 A의 글 삭제",
          );
          const forged = await b.from(table).insert(row);
          assert.ok(forged.error, "B가 A 이름으로 작성");
          assertBlocked(
            await a
              .from(table)
              .update({ user_id: idB })
              .eq("id", id)
              .select("id"),
            "A가 자기 글의 주인을 B로 바꿈",
          );

          const still = await a
            .from(table)
            .select("body")
            .eq("id", id)
            .single();
          assert.equal(still.data?.body, row.body);
        },
      );
    }

    await t.test(
      "모임: 모임장 위조·남의 모임 수정·강제 가입 불가",
      async () => {
        const group = await a
          .from("groups")
          .insert({ name: `RLS 모임 ${suffix}`, owner_id: idA })
          .select("id")
          .single();
        assert.equal(group.error, null);
        const groupId = group.data!.id;

        const forgedOwner = await b
          .from("groups")
          .insert({ name: `가짜 모임 ${suffix}`, owner_id: idA });
        assert.ok(forgedOwner.error, "B가 A를 모임장으로 모임 생성");
        assertBlocked(
          await b
            .from("groups")
            .update({ name: "탈취" })
            .eq("id", groupId)
            .select("id"),
          "비모임장 모임 수정",
        );
        assertBlocked(
          await a
            .from("groups")
            .update({ owner_id: idB })
            .eq("id", groupId)
            .select("id"),
          "모임장 넘기기(정책상 미지원)",
        );
        assertBlocked(
          await b.from("groups").delete().eq("id", groupId).select("id"),
          "비모임장 모임 삭제",
        );

        const selfOwner = await b
          .from("group_members")
          .insert({ group_id: groupId, user_id: idB, role: "owner" });
        assert.ok(selfOwner.error, "B가 모임장 역할로 가입");
        const addOther = await a
          .from("group_members")
          .insert({ group_id: groupId, user_id: idB, role: "member" });
        assert.ok(addOther.error, "A가 B를 강제로 가입시킴");

        const join = await b
          .from("group_members")
          .insert({ group_id: groupId, user_id: idB, role: "member" });
        assert.equal(join.error, null);
        assertBlocked(
          await b
            .from("group_members")
            .update({ role: "owner" })
            .eq("group_id", groupId)
            .eq("user_id", idB)
            .select("user_id"),
          "멤버가 자기 역할을 모임장으로 승격",
        );
        assertBlocked(
          await b
            .from("group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", idA)
            .select("user_id"),
          "멤버가 모임장을 내보냄",
        );
        assertBlocked(
          await a
            .from("group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", idA)
            .select("user_id"),
          "모임장 본인 탈퇴",
        );
        const kick = await a
          .from("group_members")
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", idB)
          .select("user_id");
        assert.equal(kick.data?.length, 1, "모임장의 내보내기는 허용");
      },
    );

    await t.test(
      "찻집 체류 기록: 남의 기록 조회·수정·대리 작성 불가",
      async () => {
        const visit = await a
          .from("space_visits")
          .insert({ user_id: idA, space_id: "teahouse" })
          .select("id")
          .single();
        assert.equal(visit.error, null);
        assertBlocked(
          await b.from("space_visits").select("id").eq("id", visit.data!.id),
          "B가 A의 체류 기록 조회",
        );
        assertBlocked(
          await b
            .from("space_visits")
            .update({ left_at: new Date().toISOString() })
            .eq("id", visit.data!.id)
            .select("id"),
          "B가 A의 체류 기록 수정",
        );
        const forged = await b
          .from("space_visits")
          .insert({ user_id: idA, space_id: "teahouse" });
        assert.ok(forged.error, "B가 A 이름으로 체류 기록");
      },
    );

    await t.test("프로필: 남의 닉네임 변경·비로그인 조회 불가", async () => {
      assertBlocked(
        await b
          .from("profiles")
          .update({ nickname: `탈취${suffix}` })
          .eq("id", idA)
          .select("id"),
        "B가 A의 닉네임 변경",
      );
      const del = await a.from("profiles").delete().eq("id", idA).select("id");
      assertBlocked(del, "본인 프로필 삭제(정책 없음)");
    });

    await t.test(
      "찻집 캐릭터: 남의 캐릭터 조회·수정·대리 저장 불가",
      async () => {
        const look = {
          skin: 0,
          hairStyle: "short",
          hairColor: 0,
          top: 0,
          bottom: 0,
          hat: "none",
        };
        const own = await a
          .from("space_avatars")
          .upsert({ user_id: idA, look });
        assert.equal(own.error, null);
        assertBlocked(
          await b.from("space_avatars").select("look").eq("user_id", idA),
          "B가 A의 캐릭터 조회",
        );
        assertBlocked(
          await b
            .from("space_avatars")
            .update({ look: { ...look, hat: "cap" } })
            .eq("user_id", idA)
            .select("user_id"),
          "B가 A의 캐릭터 수정",
        );
        const forged = await b
          .from("space_avatars")
          .insert({ user_id: idA, look });
        assert.ok(forged.error, "B가 A 이름으로 캐릭터 저장");
        const huge = await b
          .from("space_avatars")
          .upsert({ user_id: idB, look: { pad: "x".repeat(600) } });
        assert.ok(huge.error, "512바이트 넘는 값 저장");
      },
    );

    async function makeGroup(name: string) {
      const group = await a
        .from("groups")
        .insert({ name: `${name} ${suffix}`, owner_id: idA })
        .select("id")
        .single();
      assert.equal(group.error, null);
      const groupId = group.data!.id as string;
      const join = await b
        .from("group_members")
        .insert({ group_id: groupId, user_id: idB, role: "member" });
      assert.equal(join.error, null);
      return groupId;
    }

    await t.test(
      "단체 채팅: 비멤버 조회·전송, 위조, 수정·삭제 불가, 탈퇴하면 차단",
      async () => {
        const groupId = await makeGroup("채팅 점검");
        const clientId = randomUUID();
        const sent = await a
          .from("group_messages")
          .insert({
            group_id: groupId,
            client_id: clientId,
            body: "모임 안의 말",
            created_at: "2000-01-01T00:00:00Z",
          })
          .select("id,created_at")
          .single();
        assert.equal(sent.error, null);
        const messageId = sent.data!.id as string;
        assert.notEqual(
          new Date(sent.data!.created_at as string).getUTCFullYear(),
          2000,
          "작성 시각 위조는 무시되어야 함",
        );

        const member = await b
          .from("group_messages")
          .select("id")
          .eq("group_id", groupId);
        assert.equal(member.data?.length, 1, "멤버는 읽을 수 있어야 함");
        assertBlocked(
          await third
            .from("group_messages")
            .select("id")
            .eq("group_id", groupId),
          "비멤버가 채팅 조회",
        );
        const outsider = await third.from("group_messages").insert({
          group_id: groupId,
          client_id: randomUUID(),
          body: "끼어들기",
        });
        assert.ok(outsider.error, "비멤버가 채팅 전송");
        const spoof = await b.from("group_messages").insert({
          group_id: groupId,
          sender_id: idA,
          client_id: randomUUID(),
          body: "A인 척",
        });
        assert.ok(spoof.error, "다른 사람 이름으로 전송");
        assertBlocked(
          await a
            .from("group_messages")
            .update({ body: "고침" })
            .eq("id", messageId)
            .select("id"),
          "메시지 수정",
        );
        assertBlocked(
          await a
            .from("group_messages")
            .delete()
            .eq("id", messageId)
            .select("id"),
          "메시지 삭제",
        );

        const retry = await a.from("group_messages").insert({
          group_id: groupId,
          client_id: clientId,
          body: "모임 안의 말",
        });
        assert.equal(retry.error?.code, "23505", "재전송은 중복으로 막혀야 함");
        const sameClientOther = await b.from("group_messages").insert({
          group_id: groupId,
          client_id: clientId,
          body: "같은 client_id",
        });
        assert.equal(
          sameClientOther.error,
          null,
          "남의 client_id로 내 전송이 막히면 안 됨",
        );

        const left = await b
          .from("group_members")
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", idB)
          .select("user_id");
        assert.equal(left.data?.length, 1);
        assertBlocked(
          await b.from("group_messages").select("id").eq("group_id", groupId),
          "탈퇴 후 채팅 조회",
        );
        const afterLeave = await b.from("group_messages").insert({
          group_id: groupId,
          client_id: randomUUID(),
          body: "탈퇴 후 전송",
        });
        assert.ok(afterLeave.error, "탈퇴 후 채팅 전송");
      },
    );

    await t.test(
      "실시간 수신: 비멤버와 탈퇴자에게는 채팅이 전달되지 않는다",
      async () => {
        const groupId = await makeGroup("실시간 점검");
        const received = { member: 0, outsider: 0 };
        const listen = (c: SupabaseClient, who: keyof typeof received) =>
          new Promise<RealtimeChannel>((resolve, reject) => {
            const channel = c
              .channel(`rls-${who}-${suffix}`)
              .on(
                "postgres_changes",
                {
                  event: "INSERT",
                  schema: "public",
                  table: "group_messages",
                  filter: `group_id=eq.${groupId}`,
                },
                () => {
                  received[who]++;
                },
              )
              .subscribe((status) => {
                if (status === "SUBSCRIBED") resolve(channel);
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
                  reject(new Error(`${who} 구독 실패: ${status}`));
              });
          });
        const channels = await Promise.all([
          listen(b, "member"),
          listen(third, "outsider"),
        ]);
        const sleep = (ms: number) =>
          new Promise((resolve) => setTimeout(resolve, ms));
        const send = (body: string) =>
          a.from("group_messages").insert({
            group_id: groupId,
            client_id: randomUUID(),
            body,
          });

        try {
          // 구독이 서버에 자리 잡을 때까지 멤버가 받을 때까지 다시 보낸다
          for (let i = 0; i < 20 && received.member === 0; i++) {
            assert.equal((await send(`확인 ${i}`)).error, null);
            await sleep(500);
          }
          assert.ok(received.member > 0, "멤버는 실시간으로 받아야 함");
          await sleep(1000);
          assert.equal(received.outsider, 0, "비멤버에게 전달됨");

          await b
            .from("group_members")
            .delete()
            .eq("group_id", groupId)
            .eq("user_id", idB);
          await sleep(500);
          const before = received.member;
          assert.equal((await send("탈퇴 후 메시지")).error, null);
          await sleep(2000);
          assert.equal(received.member, before, "탈퇴자에게 전달됨");
        } finally {
          await Promise.allSettled([
            b.removeChannel(channels[0]),
            third.removeChannel(channels[1]),
          ]);
        }
      },
    );

    await t.test(
      "DM·차단: 제3자 조회·전송, 위조 불가, 차단하면 양쪽 전송 불가",
      async () => {
        const started = await a.rpc("start_dm", { p_other: idB });
        assert.equal(started.error, null);
        const threadId = (started.data as { id: string }).id;
        const again = await b.rpc("start_dm", { p_other: idA });
        assert.deepEqual(again.data, { id: threadId, created: false });
        assert.ok((await a.rpc("start_dm", { p_other: idA })).error, "나와 DM");

        const send = (c: SupabaseClient, body: string) =>
          c.from("dm_messages").insert({
            thread_id: threadId,
            client_id: randomUUID(),
            body,
          });
        assert.equal((await send(a, "둘만의 말")).error, null);

        assertBlocked(
          await third.from("dm_threads").select("id").eq("id", threadId),
          "제3자가 대화방 조회",
        );
        assertBlocked(
          await third
            .from("dm_messages")
            .select("id")
            .eq("thread_id", threadId),
          "제3자가 메시지 조회",
        );
        assert.deepEqual(
          (await third.rpc("my_dm_threads")).data,
          [],
          "제3자 목록에 남의 대화가 보임",
        );
        assert.ok((await send(third, "끼어들기")).error, "제3자가 전송");
        const [low, high] = [idA, idB].sort();
        const forgedThread = await third
          .from("dm_threads")
          .insert({ user_a: low, user_b: high });
        assert.ok(forgedThread.error, "제3자가 남들의 대화방 생성");
        const spoof = await b.from("dm_messages").insert({
          thread_id: threadId,
          sender_id: idA,
          client_id: randomUUID(),
          body: "A인 척",
        });
        assert.ok(spoof.error, "다른 사람 이름으로 DM 전송");
        assertBlocked(
          await a
            .from("dm_messages")
            .update({ body: "고침" })
            .eq("thread_id", threadId)
            .select("id"),
          "DM 수정",
        );
        assertBlocked(
          await a
            .from("dm_messages")
            .delete()
            .eq("thread_id", threadId)
            .select("id"),
          "DM 삭제",
        );

        const forgedBlock = await third
          .from("blocks")
          .insert({ blocker_id: idA, blocked_id: idB });
        assert.ok(forgedBlock.error, "남의 이름으로 차단");
        assert.equal(
          (await b.from("blocks").insert({ blocked_id: idA })).error,
          null,
        );
        try {
          assert.ok((await send(a, "차단당한 쪽")).error, "차단당한 쪽 전송");
          assert.ok((await send(b, "차단한 쪽")).error, "차단한 쪽 전송");
          assertBlocked(
            await a.from("blocks").select("blocker_id"),
            "차단당한 쪽이 차단 목록 조회",
          );
          const leak = await third.rpc("is_blocked_between", {
            p_a: idA,
            p_b: idB,
          });
          assert.equal(leak.data, false, "제3자가 남의 차단 관계를 알아냄");
          const history = await a
            .from("dm_messages")
            .select("id")
            .eq("thread_id", threadId);
          assert.equal(
            history.data?.length,
            1,
            "지난 대화는 계속 읽을 수 있음",
          );
        } finally {
          await b.from("blocks").delete().eq("blocked_id", idA);
        }
        assert.equal((await send(a, "차단 해제 뒤")).error, null);
      },
    );

    await t.test(
      "프로필 이미지: 남의 폴더 업로드·삭제, 형식 위반, 개수 초과 불가",
      async () => {
        const avatars = (c: SupabaseClient) => c.storage.from("avatars");
        const webp = new Blob([new Uint8Array(32)], { type: "image/webp" });
        const name = () => `${randomUUID()}.webp`;
        const first = `${idA}/${name()}`;
        const second = `${idA}/${name()}`;
        assert.equal((await avatars(a).upload(first, webp)).error, null);
        try {
          assert.ok(
            (await avatars(b).upload(`${idA}/${name()}`, webp)).error,
            "남의 폴더에 업로드",
          );
          assertBlocked(await avatars(b).remove([first]), "남의 파일 삭제");
          assert.equal(
            (await avatars(a).list(idA)).data?.length,
            1,
            "삭제 시도 후에도 파일이 남아 있어야 함",
          );
          assert.ok(
            (
              await avatars(b).upload(
                `${idB}/${name()}`,
                new Blob([new Uint8Array(32)], { type: "image/png" }),
              )
            ).error,
            "webp가 아닌 파일 업로드",
          );
          assert.equal((await avatars(a).upload(second, webp)).error, null);
          assert.ok(
            (await avatars(a).upload(`${idA}/${name()}`, webp)).error,
            "세 번째 파일 업로드",
          );
        } finally {
          await avatars(a).remove([first, second]);
        }
      },
    );

    await t.test("권한 확인 함수는 비로그인이 호출할 수 없다", async () => {
      const res = await anon.rpc("is_group_member", {
        p_group_id: randomUUID(),
      });
      assert.ok(res.error);
      assert.ok((await anon.rpc("delete_my_account")).error);
      assert.ok((await anon.rpc("start_dm", { p_other: idA })).error);
    });
  } finally {
    await Promise.allSettled([
      a.auth.signOut({ scope: "local" }),
      b.auth.signOut({ scope: "local" }),
      third.auth.signOut({ scope: "local" }),
    ]);
  }
});
