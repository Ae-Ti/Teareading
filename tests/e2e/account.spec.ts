import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("마이페이지에서 회원 탈퇴 → 완료 화면 → 다시 로그인 불가", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const email = `ui-delete-${suffix}@example.com`;
  const password = "Delete-reader-123!";
  await page.goto("/signup?next=/mypage");
  const form = page.locator("form:visible");
  await form.getByLabel("이메일", { exact: true }).fill(email);
  await form.getByLabel("닉네임", { exact: true }).fill(`탈퇴${suffix}`);
  await form.getByLabel("비밀번호", { exact: true }).fill(password);
  await form.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/mypage");

  // 모임장 모임이 있으면 함께 지워진다고 미리 알린다
  await page.goto("/groups/new");
  await page.getByLabel("모임 이름").fill(`탈퇴 전 모임 ${suffix}`);
  await page.getByRole("button", { name: "모임 만들기" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  await page.goto("/mypage");
  await page.getByRole("link", { name: "회원 탈퇴" }).click();
  await expect(page).toHaveURL("/mypage/delete");
  await expect(
    page.getByText("내가 모임장인 모임 1개도 함께 삭제돼요."),
  ).toBeVisible();

  const submit = page.getByRole("button", { name: "회원 탈퇴" });
  await expect(submit).toBeDisabled();
  const confirm = page.getByLabel(/확인을 위해/);
  await confirm.fill("탈퇴");
  await expect(submit).toBeDisabled();
  await confirm.fill("탈퇴합니다");
  await submit.click();

  await expect(page).toHaveURL("/goodbye");
  await expect(
    page.getByRole("heading", { name: "탈퇴가 완료됐어요" }),
  ).toBeVisible();

  // 로그아웃 상태: 보호 화면은 로그인으로, 같은 계정으로는 로그인 실패
  await page.goto("/mypage");
  await expect(page).toHaveURL(/\/login/);
  const login = page.locator("form:visible");
  await login.getByLabel("이메일", { exact: true }).fill(email);
  await login.getByLabel("비밀번호", { exact: true }).fill(password);
  await login.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "확인해 주세요" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
