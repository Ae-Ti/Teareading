import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { newUserPage, register } from "./helpers";

// 정상 흐름이 아닌 경우를 찾는 시험. 데이터 준비는 관리자 키로 한다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (
    JSON.parse(
      execSync("npx --no-install supabase status -o json", {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString(),
    ) as { SERVICE_ROLE_KEY: string }
  ).SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const idOf = async (nickname: string) =>
  (await admin.from("profiles").select("id").eq("nickname", nickname).single())
    .data!.id;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function open(page: Page, path: string) {
  // 실시간 연결이 열려 있어 networkidle은 기다리지 않는다
  return page.goto(path);
}
const noOverflow = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
const crashed = (page: Page) =>
  page
    .getByText(/Application error|This page couldn't load|Something went wrong/)
    .count();

function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  return errors;
}

test("이상한 검색어와 쪽 번호에 서버 오류가 없고 결과 화면을 유지한다", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await register(page, "검색");
  const bad: string[] = [];
  const values = [
    '"',
    '")',
    "a,b",
    "a)b(c",
    "%",
    "_",
    "\\",
    "'",
    "*",
    '",id.neq.0,title.ilike."',
    "<script>",
    "🍵",
    "가".repeat(3000),
  ];
  for (const base of ["/board", "/community"]) {
    for (const v of values) {
      const res = await open(page, `${base}?q=${encodeURIComponent(v)}`);
      // 너무 긴 주소는 서버가 431로 거절한다 (정상)
      if (res?.status() === 431) continue;
      const failed =
        (res?.status() ?? 500) >= 500 ||
        (await crashed(page)) > 0 ||
        (await page.getByText(/불러오지 못했어요/).count()) > 0;
      if (failed) bad.push(`${base} q=${v.slice(0, 30)} (${res?.status()})`);
    }
    for (const q of [
      "page=-1",
      "page=abc",
      "page=0",
      "page=99999999999999",
      "page=1.5",
      "category=nope",
      "sort=nope",
      "field=nope&q=a",
    ]) {
      const res = await open(page, `${base}?${q}`);
      if ((res?.status() ?? 500) >= 500 || (await crashed(page)) > 0)
        bad.push(`${base}?${q} (${res?.status()})`);
    }
  }
  expect(bad).toEqual([]);
});

test("잘못된 주소는 서버 오류 없이 안내한다", async ({ page }) => {
  test.setTimeout(150_000);
  const nick = await register(page, "주소");
  const me = await idOf(nick);
  const bad: string[] = [];
  for (const p of [
    "/u/abc",
    `/u/${UNKNOWN}`,
    `/u/${me}/columns/abc`,
    `/u/${me}/columns/${UNKNOWN}`,
    `/u/${me}/reading/abc`,
    "/space/room/abc",
    `/space/room/${UNKNOWN}`,
    `/space/room/${me}`,
    "/board/abc",
    `/board/${UNKNOWN}`,
    "/board/abc/edit",
    `/board/${UNKNOWN}/edit`,
    "/groups/abc",
    `/groups/${UNKNOWN}/chat`,
    "/groups/abc/chat",
    "/dm/abc",
    `/dm/${UNKNOWN}`,
    "/me/books/abc",
    `/me/books/${UNKNOWN}`,
    "/me/columns/abc",
    "/me/columns/abc/edit",
    "/me/reading/abc",
    `/me/reading/${UNKNOWN}/edit`,
    "/me/reading/new?book=abc",
    "/guide/없는글",
    "/guide/..%2F..%2Fpackage",
  ]) {
    const res = await open(page, p);
    if ((res?.status() ?? 500) >= 500 || (await crashed(page)) > 0)
      bad.push(`${p} (${res?.status()})`);
  }
  expect(bad).toEqual([]);
});

test("비로그인은 보호된 화면을 볼 수 없고 외부 주소로 보내지지 않는다", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const page = await browser
    .newContext({ ...info.project.use, baseURL: "http://127.0.0.1:3100" })
    .then((c) => c.newPage());
  const leaked: string[] = [];
  for (const p of [
    "/dashboard",
    "/attendance",
    "/me",
    "/me/reading",
    "/me/columns",
    "/me/stats",
    "/mypage",
    "/mypage/settings",
    "/mypage/edit",
    "/mypage/delete",
    "/board",
    "/board/new",
    "/community",
    "/groups/new",
    "/dm",
    "/space",
    `/space/room/${UNKNOWN}`,
    `/u/${UNKNOWN}`,
  ]) {
    await open(page, p);
    if (!/\/login/.test(new URL(page.url()).pathname)) leaked.push(p);
  }
  expect(leaked).toEqual([]);

  for (const next of [
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "/\t/evil.example.com",
    "javascript:alert(1)",
    "%2F%2Fevil.example.com",
  ]) {
    await open(page, `/signup?next=${encodeURIComponent(next)}`);
    const suffix = randomUUID().slice(0, 8);
    const form = page.locator("form:visible");
    await form
      .getByLabel("이메일", { exact: true })
      .fill(`edge-${suffix}@example.com`);
    await form.getByLabel("닉네임", { exact: true }).fill(`외부${suffix}`);
    await form.getByLabel("비밀번호", { exact: true }).fill("Edge-reader-123!");
    await form
      .getByLabel("비밀번호 확인", { exact: true })
      .fill("Edge-reader-123!");
    await form
      .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
      .check();
    await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
    await form.getByRole("button", { name: "회원가입", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/signup"), {
      timeout: 15_000,
    });
    await page.waitForLoadState();
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
    await page.context().clearCookies();
  }
});

test("악성 문자열은 글자로만 보이고 실행되지 않는다", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const attack = `<img src=x onerror="window.__xss=1">`;
  const nick = await register(page, "악성");
  const me = await idOf(nick);
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await admin.from("profiles").update({ bio: attack }).eq("id", me);
  await admin
    .from("tea_columns")
    .insert({ user_id: me, title: attack, body: attack, is_public: true });
  const post = await admin
    .from("posts")
    .insert({ author_id: me, title: attack, body: attack })
    .select("id")
    .single();
  await admin
    .from("post_comments")
    .insert({ post_id: post.data!.id, author_id: me, body: attack });
  const group = await admin
    .from("groups")
    .insert({ name: attack.slice(0, 40), description: attack, owner_id: me })
    .select("id")
    .single();
  const viewer = await newUserPage(browser, info);
  await register(viewer, "관람");
  for (const p of [
    `/u/${me}`,
    "/board",
    `/board/${post.data!.id}`,
    "/community",
    `/groups/${group.data!.id}`,
    "/dashboard",
  ]) {
    await open(viewer, p);
    expect(await viewer.evaluate(() => "__xss" in window), p).toBe(false);
    expect(await viewer.locator('img[src="x"]').count(), p).toBe(0);
  }
  expect(dialogs).toEqual([]);
});

test("긴 글자도 화면을 넘치지 않는다", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const nick = await register(page, "긴글");
  const me = await idOf(nick);
  const long = "가나다라마바사아자차카타파하".repeat(6);
  const word = "x".repeat(99);
  const longNick = "W".repeat(20);
  await admin
    .from("profiles")
    .update({ nickname: longNick, bio: word, is_public: true })
    .eq("id", me);
  await admin.from("tea_columns").insert({
    user_id: me,
    title: word,
    body: word.repeat(10),
    is_public: true,
  });
  const post = await admin
    .from("posts")
    .insert({ author_id: me, title: word, body: word.repeat(10) })
    .select("id")
    .single();
  await admin
    .from("post_comments")
    .insert({ post_id: post.data!.id, author_id: me, body: word.repeat(9) });
  await admin
    .from("posts")
    .update({ like_count: 999999, view_count: 9999999 })
    .eq("id", post.data!.id);
  const group = await admin
    .from("groups")
    .insert({ name: "G".repeat(40), description: long, owner_id: me })
    .select("id")
    .single();
  const book = await admin
    .from("books")
    .insert({
      user_id: me,
      title: word,
      author: "A".repeat(100),
      status: "done",
    })
    .select("id")
    .single();
  const viewer = await newUserPage(browser, info);
  const viewerNick = await register(viewer, "보는이");
  const viewerId = await idOf(viewerNick);
  const [low, high] = me < viewerId ? [me, viewerId] : [viewerId, me];
  await admin.from("friendships").insert({ user_a: low, user_b: high });
  const bad: string[] = [];
  for (const p of [
    `/u/${me}`,
    `/space/room/${me}`,
    "/board",
    `/board/${post.data!.id}`,
    "/community",
    `/groups/${group.data!.id}`,
    "/dashboard",
  ]) {
    await open(viewer, p);
    if (!(await noOverflow(viewer))) bad.push(`viewer ${p}`);
  }
  for (const p of [
    "/me/reading",
    `/me/books/${book.data!.id}`,
    "/mypage",
    "/me/stats",
  ]) {
    await open(page, p);
    if (!(await noOverflow(page))) bad.push(`owner ${p}`);
  }
  // 요청 팝업의 긴 닉네임
  await admin
    .from("live_requests")
    .insert({ kind: "friend", from_user: me, to_user: viewerId });
  await open(viewer, "/dashboard");
  await expect(viewer.getByRole("dialog", { name: "친구 요청" })).toBeVisible({
    timeout: 15_000,
  });
  if (!(await noOverflow(viewer))) bad.push("viewer 요청 팝업");
  expect(bad).toEqual([]);
});

test("연타해도 한 번만 저장된다", async ({ page }) => {
  test.setTimeout(120_000);
  const nick = await register(page, "연타");
  const me = await idOf(nick);
  const title = `연타글${randomUUID().slice(0, 6)}`;
  await open(page, "/board/new");
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("내용", { exact: true }).fill("연타 본문");
  await page.getByRole("button", { name: /등록|저장/ }).dblclick();
  await page.waitForURL(/\/board\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const posts = await admin.from("posts").select("id").eq("title", title);
  expect(posts.data?.length).toBe(1);

  const body = page.getByRole("textbox").first();
  await body.fill("연타 댓글");
  await page
    .getByRole("button", { name: /댓글.*(등록|달기|쓰기)|^등록$/ })
    .first()
    .dblclick();
  await page.waitForTimeout(1500);
  const comments = await admin
    .from("post_comments")
    .select("id")
    .eq("post_id", posts.data![0].id)
    .eq("author_id", me);
  expect(comments.data?.length).toBe(1);

  const name = `연타모임${randomUUID().slice(0, 4)}`;
  await open(page, "/groups/new");
  await page
    .getByLabel(/모임 이름|이름/)
    .first()
    .fill(name);
  await page.getByRole("button", { name: /만들기|등록/ }).dblclick();
  await page.waitForURL(/\/groups\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const groups = await admin.from("groups").select("id").eq("name", name);
  expect(groups.data?.length).toBe(1);
});

test("탈퇴한 회원의 흔적이 있어도 화면이 깨지지 않는다", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const errors = watch(page);
  const stay = await idOf(await register(page, "남은이"));
  const other = await newUserPage(browser, info);
  const goneNick = await register(other, "떠난이");
  const gone = await idOf(goneNick);
  const post = await admin
    .from("posts")
    .insert({ title: "남은 글", body: "본문", author_id: stay })
    .select("id")
    .single();
  await admin.from("post_comments").insert({
    post_id: post.data!.id,
    author_id: gone,
    body: "떠난 사람 댓글",
  });
  await other.close();
  await admin.auth.admin.deleteUser(gone);
  for (const p of [
    `/board/${post.data!.id}`,
    "/board",
    `/u/${gone}`,
    "/dashboard",
    "/dm",
    `/space/room/${gone}`,
  ]) {
    const res = await open(page, p);
    expect((res?.status() ?? 500) < 500, p).toBeTruthy();
    expect(await crashed(page), p).toBe(0);
  }
  expect(errors).toEqual([]);
});

test("세션이 끊긴 뒤 저장하면 로그인으로 안내하고 다시 들어오지 못한다", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watch(page);
  await register(page, "세션");
  await open(page, "/board/new");
  await page.getByLabel("제목").fill("세션 끊김 글");
  await page.getByLabel("내용", { exact: true }).fill("본문");
  await page.context().clearCookies();
  await page.getByRole("button", { name: /등록|저장/ }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  expect(errors).toEqual([]);
  await open(page, "/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("로그아웃 후 뒤로 가기로 개인 화면이 보이지 않는다", async ({ page }) => {
  const nick = await register(page, "뒤로", "/dashboard");
  await open(page, "/mypage");
  await expect(page.getByText(nick).first()).toBeVisible();
  await page.getByRole("button", { name: "로그아웃" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/mypage"), {
    timeout: 15_000,
  });
  await page.goBack();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  expect(await page.getByText(nick).count()).toBe(0);
});

test("기기 시계가 바뀌어도 타이머가 일찍 끝나지 않는다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.install();
  const nick = await register(page, "시계", "/dashboard");
  const me = await idOf(nick);
  await expect(page.getByRole("button", { name: /25분 시작$/ })).toBeEnabled();
  await page.getByRole("button", { name: /25분 시작$/ }).click();
  await expect(page.getByRole("button", { name: "일시정지" })).toBeVisible();
  await page.clock.fastForward(26 * 60 * 1000);
  await page.clock.runFor(4000);
  await page.waitForTimeout(1500);
  const row = await admin
    .from("timer_sessions")
    .select("status")
    .eq("user_id", me)
    .single();
  expect(row.data?.status).toBe("running");
});

test("찻집: 잠깐 끊겼다가 다시 연결되면 서로 보인다", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const errors = watch(page);
  const nickA = await register(page, "끊김A");
  const b = await newUserPage(browser, info);
  const nickB = await register(b, "끊김B");
  for (const p of [page, b]) {
    await p.goto("/space");
    await p.getByRole("button", { name: "찻집 입장" }).click();
    await expect(p.getByRole("button", { name: "나가기" })).toBeVisible({
      timeout: 15_000,
    });
  }
  await expect(page.locator(".space-label", { hasText: nickB })).toBeVisible({
    timeout: 15_000,
  });
  await page.context().setOffline(true);
  await b.waitForTimeout(8000);
  await page.context().setOffline(false);
  await expect(page.locator(".space-label", { hasText: nickB })).toBeVisible({
    timeout: 30_000,
  });
  await expect(b.locator(".space-label", { hasText: nickA })).toBeVisible({
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

test("사진·파일 입력의 경계", async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, "파일");
  await open(page, "/board/new");
  const input = page.locator('input[type="file"]').first();
  // 화면이 준비되기 전에 넣은 파일은 무시될 수 있어 안내가 보일 때까지 다시 넣는다
  await expect(async () => {
    await input.setInputFiles({
      name: "big.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(6 * 1024 * 1024, 1),
    });
    await expect(page.getByText(/5MB 이하/).first()).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 20_000 });
  await input.setInputFiles({
    name: "fake.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("this is not an image"),
  });
  await expect(page.getByText(/사진은|올리지 못/).first()).toBeVisible({
    timeout: 15_000,
  });
  expect(await page.locator('img[alt="글에 넣은 사진"]').count()).toBe(0);
});
