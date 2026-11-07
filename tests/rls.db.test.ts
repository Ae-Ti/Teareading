import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 테이블을 돌며 검사하므로 타입이 없는 클라이언트를 쓴다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// D6 RLS 점검: 다른 계정·비로그인으로 남의 데이터를 조회·수정·삭제하려 하면 모두 실패해야 한다.
// 단체 채팅·DM 테이블이 생기면 같은 방식으로 여기에 추가한다.
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
    return { c, id: data.user.id };
  }
  const { c: a, id: idA } = await signUp("A");
  const { c: b, id: idB } = await signUp("B");
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

    await t.test("권한 확인 함수는 비로그인이 호출할 수 없다", async () => {
      const res = await anon.rpc("is_group_member", {
        p_group_id: randomUUID(),
      });
      assert.ok(res.error);
    });
  } finally {
    await Promise.allSettled([
      a.auth.signOut({ scope: "local" }),
      b.auth.signOut({ scope: "local" }),
    ]);
  }
});
