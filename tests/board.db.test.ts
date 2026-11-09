import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { listPosts } from "@/lib/board";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// 게시판 권한과 숫자(조회·추천·댓글). 로컬 Supabase에서만 실행한다.
test("게시판: 작성자 권한·추천·댓글·조회수", async (t) => {
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
      email: `board-${label.toLowerCase()}-${suffix}@example.com`,
      password: "Board-reader-123!",
      options: { data: { nickname: `게시${label}${suffix}` } },
    });
    assert.equal(error, null);
    return { c, id: data.user!.id };
  }
  const a = await signUp("A");
  const b = await signUp("B");
  const anon = makeClient();
  const raw = (c: SupabaseClient<Database>) => c as unknown as SupabaseClient;
  const counts = async (id: string) =>
    (
      await b.c
        .from("posts")
        .select("view_count, like_count, comment_count, updated_at, created_at")
        .eq("id", id)
        .single()
    ).data!;

  let postId = "";

  await t.test(
    "글쓰기: 작성자는 서버가 정하고 숫자·날짜는 못 바꾼다",
    async () => {
      const created = await a.c
        .from("posts")
        .insert({
          category: "book",
          title: "데미안 같이 읽어요",
          body: "3장까지 읽었어요.",
        })
        .select("id, author_id, view_count")
        .single();
      assert.equal(created.error, null);
      assert.equal(created.data!.author_id, a.id);
      postId = created.data!.id;

      const forged = await raw(a.c)
        .from("posts")
        .insert({ title: "남의 이름", body: "x", author_id: b.id });
      assert.ok(forged.error, "작성자 위조 불가");
      const inflated = await raw(a.c)
        .from("posts")
        .insert({ title: "숫자 조작", body: "x", like_count: 999 });
      assert.ok(inflated.error, "추천 수 직접 입력 불가");
      const bads: { title: string; body: string; category?: string }[] = [
        { title: "a", body: "본문" },
        { title: "제목", body: "   " },
        { title: "제목", body: "x", category: "notice" },
        { title: "제목", body: "\u3000\u3000" }, // 전각 공백
        { title: "제목", body: "\u3164\u200B" }, // 한글 채움 문자·폭 없는 문자
        { title: "\u3000\u3000\u3000", body: "본문" },
      ];
      for (const bad of bads) {
        const res = await a.c.from("posts").insert(bad);
        assert.ok(res.error, `잘못된 값 거부: ${JSON.stringify(bad)}`);
      }
      assert.ok(
        (await raw(anon).from("posts").insert({ title: "익명", body: "x" }))
          .error,
      );
      assert.ok(
        (await anon.from("posts").select("id").limit(1)).data?.length !== 1,
        "비로그인은 읽을 수 없다",
      );
    },
  );

  await t.test("수정·삭제는 작성자만, 숫자 열은 고칠 수 없다", async () => {
    const byOther = await b.c
      .from("posts")
      .update({ title: "가로채기" })
      .eq("id", postId)
      .select("id");
    assert.equal(byOther.data?.length ?? 0, 0);
    const counter = await raw(a.c)
      .from("posts")
      .update({ view_count: 1000 })
      .eq("id", postId);
    assert.ok(counter.error, "조회수 직접 수정 불가");
    const before = await counts(postId);
    const edit = await a.c
      .from("posts")
      .update({ title: "데미안 같이 읽어요 (수정)" })
      .eq("id", postId)
      .select("title")
      .single();
    assert.equal(edit.data?.title, "데미안 같이 읽어요 (수정)");
    const after = await counts(postId);
    assert.ok(Date.parse(after.updated_at) > Date.parse(before.updated_at));
    const delByOther = await b.c
      .from("posts")
      .delete()
      .eq("id", postId)
      .select("id");
    assert.equal(delByOther.data?.length ?? 0, 0);
  });

  await t.test("추천: 한 번만, 자기 글은 불가, 취소하면 줄어든다", async () => {
    assert.ok(
      (await a.c.from("post_likes").insert({ post_id: postId })).error,
      "자기 글 추천 불가",
    );
    const before = await counts(postId);
    assert.equal(
      (await b.c.from("post_likes").insert({ post_id: postId })).error,
      null,
    );
    const dup = await b.c.from("post_likes").insert({ post_id: postId });
    assert.equal(dup.error?.code, "23505", "중복 추천 불가");
    const liked = await counts(postId);
    assert.equal(liked.like_count, 1);
    // 숫자 변화는 "수정됨"이 아니다
    assert.equal(liked.updated_at, before.updated_at);
    // 남의 추천은 보이지도 않는다
    assert.equal(
      (await a.c.from("post_likes").select("user_id").eq("post_id", postId))
        .data?.length,
      0,
    );
    await b.c.from("post_likes").delete().eq("post_id", postId);
    assert.equal((await counts(postId)).like_count, 0);
    await b.c.from("post_likes").insert({ post_id: postId });
  });

  await t.test("댓글: 수가 맞고, 작성자만 수정·삭제", async () => {
    assert.ok(
      (
        await b.c
          .from("post_comments")
          .insert({ post_id: postId, body: "\u3000" })
      ).error,
      "보이지 않는 문자만 있는 댓글 거부",
    );
    const c1 = await b.c
      .from("post_comments")
      .insert({ post_id: postId, body: "저도 같이 읽을래요" })
      .select("id, author_id")
      .single();
    assert.equal(c1.data?.author_id, b.id);
    await a.c
      .from("post_comments")
      .insert({ post_id: postId, body: "환영해요" });
    assert.equal((await counts(postId)).comment_count, 2);
    const hijack = await a.c
      .from("post_comments")
      .update({ body: "바꿈" })
      .eq("id", c1.data!.id)
      .select("id");
    assert.equal(hijack.data?.length ?? 0, 0);
    const forged = await raw(a.c)
      .from("post_comments")
      .insert({ post_id: postId, body: "B인 척", author_id: b.id });
    assert.ok(forged.error);
    await b.c.from("post_comments").delete().eq("id", c1.data!.id);
    assert.equal((await counts(postId)).comment_count, 1);
  });

  await t.test("조회수: 같은 사람은 하루 1번", async () => {
    const first = await b.c.rpc("record_post_view", { p_post_id: postId });
    const second = await b.c.rpc("record_post_view", { p_post_id: postId });
    await a.c.rpc("record_post_view", { p_post_id: postId });
    assert.equal(first.data, true);
    assert.equal(second.data, false);
    assert.equal((await counts(postId)).view_count, 2);
    assert.ok(
      (await anon.rpc("record_post_view", { p_post_id: postId })).error,
    );
    const direct = await raw(b.c).from("post_views").select("*");
    assert.ok(direct.error || direct.data?.length === 0);
  });

  await t.test("글 수를 넘는 페이지는 마지막 페이지를 보여 준다", async () => {
    const res = await listPosts(b.c, {
      category: null,
      sort: "latest",
      field: "title_body",
      q: "",
      page: 100000,
    });
    assert.equal(res.error, null);
    assert.ok(res.total > 0);
    assert.ok(res.posts.length > 0);
    const none = await listPosts(b.c, {
      category: null,
      sort: "latest",
      field: "title",
      q: `없는글${suffix}`,
      page: 5,
    });
    assert.equal(none.error, null);
    assert.deepEqual([none.total, none.posts.length], [0, 0]);
  });

  await t.test("글을 지우면 추천·댓글·조회 기록도 함께 지워진다", async () => {
    const del = await a.c.from("posts").delete().eq("id", postId).select("id");
    assert.equal(del.data?.length, 1);
    const left = await b.c
      .from("post_comments")
      .select("id")
      .eq("post_id", postId);
    assert.equal(left.data?.length, 0);
  });
});
