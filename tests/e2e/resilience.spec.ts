import { expect, test, type Page } from "@playwright/test";
import { newUserPage } from "./helpers";
import { admin, collect, login, makeUser } from "./seed";

// 고도화 시험 2: 망이 끊기거나 느리거나, 같은 사람이 여러 탭을 쓸 때.

const crashed = (page: Page) =>
  page
    .getByText(/Application error|This page couldn.t load|Something went wrong/)
    .count();

async function pickReading(page: Page) {
  const reading = page.getByRole("radio", { name: /독서/ });
  await expect(async () => {
    await reading.click();
    await expect(reading).toBeChecked({ timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: "15분" }).click();
}

test("두 탭에서 동시에 타이머를 시작해도 하나만 돈다", async ({
  page,
  context,
}) => {
  const me = await makeUser("경합");
  await login(page, me);
  const other = await context.newPage();
  await other.goto("/dashboard");
  await pickReading(page);
  await pickReading(other);
  await Promise.all([
    page.getByRole("button", { name: "독서 15분 시작" }).click(),
    other.getByRole("button", { name: "독서 15분 시작" }).click(),
  ]);
  await expect(page.getByRole("button", { name: "완료" })).toBeVisible();
  await expect(other.getByRole("button", { name: "완료" })).toBeVisible();
  const { data } = await admin
    .from("timer_sessions")
    .select("id")
    .eq("user_id", me.id)
    .eq("status", "running");
  expect(data).toHaveLength(1);
  expect(await crashed(page)).toBe(0);
  expect(await crashed(other)).toBe(0);
});

test("망이 끊긴 채 글을 올리면 쓰던 내용을 지키고, 다시 연결되면 한 번만 올라간다", async ({
  page,
  context,
}) => {
  const me = await makeUser("오프");
  await login(page, me, "/board/new");
  const { issues, state } = collect(page);
  state.path = "/board/new";
  const title = `끊김 시험 ${Date.now()}`;
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("내용").fill("망이 끊겨도 남아 있어야 하는 글");

  await context.setOffline(true);
  await page.getByRole("button", { name: "등록" }).click();
  await page.waitForTimeout(2_000);
  const findings: string[] = [];
  if (await crashed(page)) findings.push("끊긴 채 등록 → 오류 화면");
  if (!(await page.getByLabel("제목").count()))
    findings.push("끊긴 채 등록 → 글쓰기 화면이 사라짐");
  else if ((await page.getByLabel("제목").inputValue()) !== title)
    findings.push("끊긴 채 등록 → 제목이 지워짐");
  // 끊긴 동안에는 오류로 버리지 않고 기다리며, 끊겼다고 알려야 한다
  const told = await page
    .getByRole("status")
    .filter({ hasText: "연결이 끊겼어요" })
    .count();
  if (!told) findings.push("끊긴 채 등록 → 끊김 안내가 없음");

  await context.setOffline(false);
  if (!findings.length) {
    // 다시 연결되면 다시 누르지 않아도 기다리던 저장이 이어서 끝난다
    await expect(page).toHaveURL(/\/board\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("status").filter({ hasText: "연결이 끊겼어요" }),
    ).toHaveCount(0);
  }
  const { data } = await admin
    .from("posts")
    .select("id")
    .eq("author_id", me.id)
    .eq("title", title);
  if ((data?.length ?? 0) > 1)
    findings.push(`같은 글이 ${data!.length}번 저장됨`);
  console.log(
    `\n[끊김 글쓰기] ${findings.length ? findings.join(" / ") : "문제 없음"}`,
    issues.length ? issues : "",
  );
  expect(findings).toEqual([]);
});

test("망이 끊긴 사이 보낸 단체 채팅은 다시 연결되면 상대에게 한 번만 보인다", async ({
  page,
  browser,
  context,
}, info) => {
  test.setTimeout(90_000);
  const [a, b] = await Promise.all([makeUser("끊A"), makeUser("끊B")]);
  const { data: g } = await admin
    .from("groups")
    .insert({ name: "끊김 모임", owner_id: a.id })
    .select("id")
    .single();
  await admin.from("group_members").upsert([
    { group_id: g!.id, user_id: a.id, role: "owner" },
    { group_id: g!.id, user_id: b.id, role: "member" },
  ]);
  await login(page, a, `/groups/${g!.id}/chat`);
  const pb = await newUserPage(browser, info);
  await login(pb, b, `/groups/${g!.id}/chat`);
  const log = (p: Page) => p.getByRole("log", { name: "메시지 목록" });

  await context.setOffline(true);
  await page.getByLabel("메시지 입력").fill("끊긴 사이 보낸 말");
  await page.getByRole("button", { name: "보내기" }).click();
  await page.waitForTimeout(1_500);
  expect(await crashed(page)).toBe(0);
  await context.setOffline(false);

  // 실패로 표시됐다면 다시 보내기, 아니면 저절로 다시 보내지는지 본다
  const retry = page.getByRole("button", { name: /다시 보내기|재시도/ });
  if (await retry.count()) await retry.first().click();
  await expect(log(pb).getByText("끊긴 사이 보낸 말")).toHaveCount(1, {
    timeout: 20_000,
  });
  await pb.reload();
  await expect(log(pb).getByText("끊긴 사이 보낸 말")).toHaveCount(1);
  const { data } = await admin
    .from("group_messages")
    .select("id")
    .eq("group_id", g!.id)
    .eq("body", "끊긴 사이 보낸 말");
  expect(data).toHaveLength(1);
  await pb.context().close();
});

test("다른 탭에서 로그아웃하면 남은 탭의 저장은 로그인으로 안내되고 저장되지 않는다", async ({
  page,
  context,
}) => {
  const me = await makeUser("두탭");
  await login(page, me, "/me/columns/new");
  const other = await context.newPage();
  await other.goto("/mypage");
  await other
    .getByRole("main")
    .getByRole("button", { name: "로그아웃" })
    .click();
  await expect(other).toHaveURL(/\/login/);

  const title = `로그아웃 뒤 저장 ${Date.now()}`;
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByLabel("본문", { exact: true }).fill("저장되면 안 된다");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  expect(await crashed(page)).toBe(0);
  const { data } = await admin
    .from("tea_columns")
    .select("id")
    .eq("user_id", me.id)
    .eq("title", title);
  expect(data).toHaveLength(0);
});

test("느린 망(지연 400ms·초당 50KB)에서도 로그인·타이머·글쓰기가 끝나고 연타는 한 번만 처리된다", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP 전용");
  test.setTimeout(180_000);
  const me = await makeUser("느림");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 20 * 1024,
  });
  const t0 = Date.now();
  await login(page, me);
  const loginMs = Date.now() - t0;

  await pickReading(page);
  const start = page.getByRole("button", { name: "독서 15분 시작" });
  await start.click();
  await start.click({ timeout: 1_000 }).catch(() => {});
  await expect(page.getByRole("button", { name: "완료" })).toBeVisible({
    timeout: 30_000,
  });
  const { data: timers } = await admin
    .from("timer_sessions")
    .select("id")
    .eq("user_id", me.id);
  expect(timers).toHaveLength(1);

  await page.goto("/board/new");
  const title = `느린 망 ${Date.now()}`;
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("내용").fill("느린 망에서 쓴 글");
  const submit = page.getByRole("button", { name: "등록" });
  await submit.click();
  await submit.click({ timeout: 1_000 }).catch(() => {});
  await submit.click({ timeout: 1_000 }).catch(() => {});
  await expect(page).toHaveURL(/\/board\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const { data: posts } = await admin
    .from("posts")
    .select("id")
    .eq("author_id", me.id)
    .eq("title", title);
  expect(posts).toHaveLength(1);
  console.log(`\n[느린 망] 로그인 ${(loginMs / 1000).toFixed(1)}초`);
});

test("뒤로·앞으로를 빠르게 오가도 오류가 없다", async ({ page }) => {
  const me = await makeUser("역사");
  await login(page, me);
  const { issues, state } = collect(page);
  state.path = "history";
  for (const p of [
    "/board",
    "/community",
    "/me",
    "/mypage",
    "/space",
    "/guide",
  ])
    await page.goto(p);
  for (let i = 0; i < 5; i++) {
    await page.goBack().catch(() => {});
    await page.goBack().catch(() => {});
    await page.goForward().catch(() => {});
  }
  await page.waitForTimeout(1_000);
  expect(await crashed(page)).toBe(0);
  expect(issues.filter((i) => i.kind !== "console")).toEqual([]);
});
