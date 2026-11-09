import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { register } from "./helpers";

async function addBook(page: Page, title: string) {
  await page.goto("/me/reading");
  await page
    .getByRole("button", { name: /도서 추가|첫 책 추가하기/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "도서 추가" });
  await dialog.getByLabel("책 제목").fill(title);
  await dialog.getByRole("button", { name: "도서 추가" }).click();
  await expect(dialog).toBeHidden();
}

test("통계 탭: 독서 페이지·완독, 차 종류가 반영된다", async ({ page }) => {
  await register(page, "통계");

  // 통계는 별도 탭이고 서재 화면에는 없다
  await page.goto("/me");
  await expect(page.locator('[data-stats="reading"]')).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "내 기록" })
    .getByRole("link", { name: "통계" })
    .click();
  await expect(page).toHaveURL("/me/stats");
  await expect(page.locator('[data-stats="reading"]')).toContainText(
    "독서기록에 페이지 수를 적으면",
  );

  const book = `데미안 ${randomUUID().slice(0, 4)}`;
  await addBook(page, book);
  const write = async (pages: string, body: string) => {
    await page.goto("/me/reading");
    await page
      .locator(`li[data-book="${book}"]`)
      .getByRole("link", { name: "독서록 작성" })
      .click();
    await page.getByLabel("읽은 페이지 수 (선택)").fill(pages);
    await page.getByLabel("기록", { exact: true }).fill(body);
    await page.getByRole("button", { name: "저장" }).click();
  };

  // 잘못된 페이지 수
  await write("0", "첫 기록");
  await expect(page.getByText("사이의 숫자로 입력해 주세요")).toBeVisible();
  await page.getByLabel("읽은 페이지 수 (선택)").fill("120");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/reading\/[0-9a-f-]{36}$/);
  await expect(page.getByText("120쪽 읽음")).toBeVisible();

  await write("30", "둘째 기록");
  await expect(page).toHaveURL(/\/me\/reading\/[0-9a-f-]{36}$/);

  // 수정 화면: 책은 그대로, 페이지 값 유지
  await page.getByRole("link", { name: "수정" }).click();
  await expect(
    page.getByLabel("읽은 페이지 수 (선택)").locator("visible=true"),
  ).toHaveValue("30");
  await expect(page.getByLabel("책 제목")).toHaveCount(0);

  // 차 칼럼: 종류 선택
  await page.goto("/me/columns/new");
  await page.getByLabel("제목").fill("첫물 우전");
  await page.locator("label", { hasText: "녹차" }).click();
  await page.getByLabel("본문").fill("향이 좋았다");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/columns\/[0-9a-f-]{36}$/);

  // 완독으로 바꾸면 통계에 반영
  await page.goto("/me/reading");
  await page.getByLabel(`${book} 읽기 상태`).selectOption("done");
  await expect(page.getByRole("link", { name: /완독 1/ })).toBeVisible();

  await page.goto("/me/stats");
  const r = page.locator('[data-stats="reading"]');
  const t = page.locator('[data-stats="tea"]');
  await expect(r.locator("dl")).toContainText("완독1권");
  await expect(r.locator("dl")).toContainText("150쪽");
  await expect(r.getByRole("listitem").filter({ hasText: book })).toContainText(
    "150쪽",
  );
  await expect(
    t.getByRole("listitem").filter({ hasText: "녹차" }),
  ).toContainText("1번");
});
