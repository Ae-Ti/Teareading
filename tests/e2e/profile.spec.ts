import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function register(page: Page) {
  const suffix = randomUUID().slice(0, 8);
  const email = `ui-profile-${suffix}@example.com`;
  const nickname = `프로필${suffix}`;
  await page.goto("/signup?next=/mypage");
  const form = page.locator("form:visible");
  await form.getByLabel("이메일", { exact: true }).fill(email);
  await form.getByLabel("닉네임", { exact: true }).fill(nickname);
  await form
    .getByLabel("비밀번호", { exact: true })
    .fill("Profile-reader-123!");
  await form
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("Profile-reader-123!");
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/mypage");
  await expect(
    page.getByRole("heading", { name: nickname, exact: true }),
  ).toBeVisible();
  return { email, nickname };
}

async function sessionClient(context: BrowserContext) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(url).hostname);
  const cookie = (await context.cookies()).find((value) =>
    /auth-token$/.test(value.name),
  )!;
  const session = JSON.parse(
    Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString(),
  );
  const client = createClient<Database>(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const result = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  expect(result.error).toBeNull();
  return { client, id: session.user.id as string };
}

test("프로필 수정·2MB 이하 이미지·삭제·중복 제출 방지·오래된 화면 충돌", async ({
  page,
  context,
}, info) => {
  const account = await register(page);
  await expect(page.getByText(account.email, { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "프로필 수정", exact: true }).click();
  const form = page.locator("form:visible");
  const nextNickname = `수정${randomUUID().slice(0, 8)}`;
  await form.getByLabel("닉네임", { exact: true }).fill(nextNickname);
  await form
    .getByLabel("한 줄 소개", { exact: true })
    .fill("말차와 책을 좋아해요.");
  await form.getByLabel("새 이미지 선택", { exact: true }).setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    form.getByRole("button", { name: "프로필 저장", exact: true }),
  ).toBeDisabled();

  // 기본 Server Action 제한(1MB)을 넘는 정상 이미지도 2MB 범위에서 저장돼야 한다.
  const image = await sharp(randomBytes(640 * 640 * 3), {
    raw: { width: 640, height: 640, channels: 3 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  expect(image.length).toBeGreaterThan(1024 * 1024);
  expect(image.length).toBeLessThan(2 * 1024 * 1024);
  await form
    .getByLabel("새 이미지 선택", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: image });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/mypage/edit", async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  await form.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "프로필 저장", exact: true }),
  ).toBeDisabled();
  release();
  await expect(form.getByRole("status")).toContainText("프로필을 저장했어요.");
  await page.unrouteAll();
  await page.goto("/mypage");
  await expect(
    page.getByRole("heading", { name: nextNickname, exact: true }),
  ).toBeVisible();
  const avatar = page.locator('img[src*="/storage/v1/object/public/avatars/"]');
  await expect(avatar).toHaveCount(1);
  await expect
    .poll(() =>
      avatar.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(
    page.getByText("말차와 책을 좋아해요.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath("mypage.png"),
    fullPage: true,
  });

  await page.goto("/mypage/edit");
  const stalePage = await context.newPage();
  await stalePage.goto("/mypage/edit");
  await expect(stalePage.getByLabel("한 줄 소개", { exact: true })).toHaveValue(
    "말차와 책을 좋아해요.",
  );
  await page.getByLabel("한 줄 소개", { exact: true }).fill("새로 저장한 소개");
  await page.getByLabel("현재 이미지 삭제", { exact: true }).check();
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(page.locator("form:visible").getByRole("status")).toContainText(
    "프로필을 저장했어요.",
  );
  await stalePage
    .getByLabel("한 줄 소개", { exact: true })
    .fill("오래된 화면의 소개");
  await stalePage
    .getByRole("button", { name: "프로필 저장", exact: true })
    .click();
  await expect(
    stalePage.locator("form:visible").getByRole("alert"),
  ).toContainText("다른 화면에서 프로필이 변경됐어요");
  await stalePage.close();
  await page.goto("/mypage");
  await expect(
    page.locator('img[src*="/storage/v1/object/public/avatars/"]'),
  ).toHaveCount(0);
  await expect(
    page.getByText("새로 저장한 소개", { exact: true }),
  ).toBeVisible();
});

test("공개 프로필은 참여 모임만 표시하고 이메일·개인 기록을 응답에 포함하지 않는다", async ({
  page,
  context,
  browser,
}) => {
  const account = await register(page);
  const { client, id } = await sessionClient(context);
  const secret = `private-${randomUUID()}`;
  expect(
    (
      await client
        .from("reading_logs")
        .insert({ user_id: id, book_title: "비공개 독서", body: secret })
    ).error,
  ).toBeNull();
  expect(
    (
      await client
        .from("tea_columns")
        .insert({ user_id: id, title: "비공개 차 칼럼", body: secret })
    ).error,
  ).toBeNull();
  const groupName = `함께 읽기 ${randomUUID().slice(0, 8)}`;
  const group = await client
    .from("groups")
    .insert({ name: groupName, description: "프로필에서 연결되는 모임" })
    .select("id")
    .single();
  expect(group.error).toBeNull();

  const other = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const visitor = await other.newPage();
    await register(visitor);
    const response = await visitor.goto(`/u/${id}`);
    await expect(
      visitor.getByRole("heading", { name: account.nickname, exact: true }),
    ).toBeVisible();
    await expect(
      visitor.getByRole("heading", { name: groupName, exact: true }),
    ).toBeVisible();
    await expect(
      visitor.getByText(account.email, { exact: false }),
    ).toHaveCount(0);
    await expect(visitor.getByText(secret, { exact: false })).toHaveCount(0);
    const body = await response!.text();
    expect(body).not.toContain(account.email);
    expect(body).not.toContain(secret);
    // 다른 회원의 프로필에는 DM 시작 버튼이 있다 (DM 흐름은 dm.spec.ts에서 검증)
    await expect(
      visitor.getByRole("button", { name: "메시지 보내기", exact: true }),
    ).toBeVisible();
    await visitor.getByRole("link", { name: "모임 보기", exact: true }).click();
    await expect(visitor).toHaveURL(`/groups/${group.data!.id}`);
    for (const invalid of ["not-a-uuid", randomUUID()]) {
      await visitor.goto(`/u/${invalid}`);
      await expect(
        visitor.getByText("프로필을 찾을 수 없어요", { exact: true }),
      ).toBeVisible();
    }
    await visitor.goto("/mypage");
    await visitor
      .getByRole("button", { name: "로그아웃", exact: true })
      .click();
    await expect(visitor).toHaveURL("/login?loggedOut=1");
    await visitor.goto(`/u/${id}`);
    await expect(visitor).toHaveURL(/\/login\?next=/);
  } finally {
    await other.close();
    await client.from("groups").delete().eq("id", group.data!.id);
  }
});
