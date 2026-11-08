import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("비로그인 랜딩·약관·개인정보처리방침과 가입 화면 연결", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "차 한 잔",
  );
  await noHorizontalOverflow(page);

  // 공개 문서는 로그인 없이 직접 열린다. 시행일·목차·문의처 항목이 있다
  for (const [path, title] of [
    ["/terms", "이용약관"],
    ["/privacy", "개인정보처리방침"],
  ] as const) {
    const res = await page.goto(path);
    expect(res!.status()).toBe(200);
    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(page.getByText(/시행일:/)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "목차" })).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await expect(page.getByText("이메일, 비밀번호, 닉네임")).toBeVisible();

  // 푸터에서 문서로 이동
  await page.goto("/guide");
  await page.locator("footer").getByRole("link", { name: "이용약관" }).click();
  await expect(page).toHaveURL("/terms");

  // 랜딩 → 가입, 가입 화면의 문서 링크는 새 창이라 입력이 유지된다
  await page.goto("/");
  await page.getByRole("link", { name: "무료로 시작하기" }).first().click();
  await expect(page).toHaveURL(/\/signup/);
  const form = page.locator("form:visible");
  await form.getByLabel("이메일", { exact: true }).fill("keep@example.com");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    form.getByRole("link", { name: /개인정보처리방침/ }).click(),
  ]);
  await expect(popup).toHaveURL(/\/privacy$/);
  await popup.close();
  await expect(form.getByLabel("이메일", { exact: true })).toHaveValue(
    "keep@example.com",
  );

  await page.goto("/");
  await page.getByRole("link", { name: "로그인" }).first().click();
  await expect(page).toHaveURL(/\/login/);
});

test("로그인 상태로 랜딩에 오면 대시보드로 간다", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  await page.goto("/signup?next=/mypage");
  const form = page.locator("form:visible");
  await form
    .getByLabel("이메일", { exact: true })
    .fill(`ui-landing-${suffix}@example.com`);
  await form.getByLabel("닉네임", { exact: true }).fill(`랜딩${suffix}`);
  await form
    .getByLabel("비밀번호", { exact: true })
    .fill("Landing-reader-123!");
  await form
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("Landing-reader-123!");
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/mypage");

  const res = await page.goto("/");
  await expect(page).toHaveURL("/dashboard");
  // 서버에서 바로 이동하므로 랜딩 화면이 그려지지 않는다
  expect(res!.request().redirectedFrom()?.url()).toMatch(/\/$/);
  // 로그인 상태에서도 공개 문서는 열린다
  await page.goto("/privacy");
  await expect(page).toHaveURL("/privacy");
});
