import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { register } from "./helpers";

test("내 기록: 통계가 목록 위에 있고, 페이지 수·차 종류가 반영된다", async ({
  page,
}) => {
  await register(page, "통계");
  await page.goto("/me");

  // 빈 상태
  const reading = page.locator('[data-stats="reading"]');
  const tea = page.locator('[data-stats="tea"]');
  await expect(reading).toContainText("독서기록에 페이지 수를 적으면");
  await expect(tea).toContainText("다도 타이머를 완료하면");

  // 통계가 독서기록·차 칼럼 탭보다 위에 있다
  const statsY = (await page
    .getByRole("heading", { name: "통계" })
    .boundingBox())!.y;
  const tabsY = (await page
    .getByRole("navigation", { name: "내 기록" })
    .boundingBox())!.y;
  expect(statsY).toBeLessThan(tabsY);

  // 잘못된 페이지 수
  await page.goto("/me/reading/new");
  const book = `데미안 ${randomUUID().slice(0, 4)}`;
  await page.getByLabel("책 제목").fill(book);
  await page.getByLabel("읽은 페이지 수 (선택)").fill("0");
  await page.getByLabel("기록", { exact: true }).fill("첫 기록");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("사이의 숫자로 입력해 주세요")).toBeVisible();

  await page.getByLabel("읽은 페이지 수 (선택)").fill("120");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/reading\/[0-9a-f-]{36}$/);
  await expect(page.getByText("120쪽 읽음")).toBeVisible();

  // 같은 책을 또 기록: 권수는 그대로, 페이지는 합산
  await page.goto("/me/reading/new");
  await page.getByLabel("책 제목").fill(book);
  await page.getByLabel("읽은 페이지 수 (선택)").fill("30");
  await page.getByLabel("기록", { exact: true }).fill("둘째 기록");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/reading\/[0-9a-f-]{36}$/);

  // 차 칼럼: 종류 선택
  await page.goto("/me/columns/new");
  await page.getByLabel("제목").fill("첫물 우전");
  await page.locator("label", { hasText: "녹차" }).click();
  await page.getByLabel("본문").fill("향이 좋았다");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/columns\/[0-9a-f-]{36}$/);
  await expect(
    page
      .getByRole("main")
      .getByText("녹차", { exact: true })
      .locator("visible=true"),
  ).toBeVisible();

  // 수정 화면에 값이 남아 있다
  await page.goto("/me/reading");
  await page
    .getByRole("link", { name: new RegExp(book) })
    .first()
    .click();
  await page.getByRole("link", { name: "수정" }).click();
  await expect(page.getByLabel("읽은 페이지 수 (선택)")).toHaveValue("30");

  // 통계 반영 (차 칼럼 탭에서도 같은 통계)
  await page.goto("/me/columns");
  const r = page.locator('[data-stats="reading"]');
  const t = page.locator('[data-stats="tea"]');
  await expect(r.locator("dl")).toContainText("1권");
  await expect(r.locator("dl")).toContainText("150쪽");
  await expect(r.getByRole("listitem").filter({ hasText: book })).toContainText(
    "150쪽",
  );
  await expect(
    t.getByRole("listitem").filter({ hasText: "녹차" }),
  ).toContainText("1번");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
