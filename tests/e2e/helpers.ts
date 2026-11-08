import { randomUUID } from "node:crypto";
import {
  expect,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";

export async function register(page: Page, label: string, next = "/mypage") {
  const suffix = randomUUID().slice(0, 8);
  const nickname = `${label}${suffix}`;
  await page.goto(`/signup?next=${encodeURIComponent(next)}`);
  const form = page.locator("form:visible");
  await form
    .getByLabel("이메일", { exact: true })
    .fill(`ui-${suffix}@example.com`);
  await form.getByLabel("닉네임", { exact: true }).fill(nickname);
  await form.getByLabel("비밀번호", { exact: true }).fill("Reader-test-123!");
  await form
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("Reader-test-123!");
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(next);
  return nickname;
}

export async function newUserPage(browser: Browser, info: TestInfo) {
  const context = await browser.newContext({
    ...info.project.use,
    baseURL: "http://127.0.0.1:3100",
  });
  const page = await context.newPage();
  page.on("dialog", (d) => void d.accept());
  return page;
}
