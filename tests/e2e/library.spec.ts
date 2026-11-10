import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("서재: 도서 추가·상태·장르 태그·필터·독서록 작성·수정·삭제", async ({
  page,
  browser,
}, info) => {
  page.on("dialog", (d) => void d.accept());
  await register(page, "서재");

  await page.goto("/me");
  await expect(page.getByText("아직 서재에 책이 없어요")).toBeVisible();

  // 도서 추가 팝업 (페이지 이동 없음)
  const suffix = randomUUID().slice(0, 4);
  const novel = `데미안 ${suffix}`;
  const science = `코스모스 ${suffix}`;
  const open = async () => {
    await page.getByRole("button", { name: "도서 추가" }).first().click();
    return page.getByRole("dialog", { name: "도서 추가" });
  };
  let dialog = await open();
  await dialog.getByRole("button", { name: "도서 추가" }).click();
  await expect(dialog.getByText("책 제목을 입력해 주세요.")).toBeVisible();
  await dialog.getByLabel("책 제목").fill(novel);
  await dialog.getByLabel("저자 (선택)").fill("헤르만 헤세");
  await dialog.locator("label", { hasText: "소설" }).click();
  await dialog.locator("label", { hasText: "철학·종교" }).click();
  await dialog.getByRole("button", { name: "도서 추가" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL("/me");

  const row = (t: string) => page.locator(`li[data-book="${t}"]`);
  await expect(row(novel)).toContainText("헤르만 헤세");
  await expect(row(novel)).toContainText("소설");
  await expect(row(novel)).toContainText("철학·종교");

  // 같은 제목은 중복 추가할 수 없다
  dialog = await open();
  await dialog.getByLabel("책 제목").fill(novel);
  await dialog.getByRole("button", { name: "도서 추가" }).click();
  await expect(dialog.getByText("이미 서재에 있는 책이에요.")).toBeVisible();
  await dialog.getByRole("button", { name: "취소" }).click();

  dialog = await open();
  await dialog.getByLabel("책 제목").fill(science);
  await dialog.locator("label", { hasText: "완독" }).click();
  await dialog.locator("label", { hasText: "과학" }).click();
  await dialog.getByRole("button", { name: "도서 추가" }).click();
  await expect(dialog).toBeHidden();

  // 상태·장르 필터
  await page.goto("/me/reading");
  await page.getByRole("link", { name: /완독 1/ }).click();
  await expect(row(science)).toBeVisible();
  await expect(row(novel)).toHaveCount(0);
  await page.getByRole("link", { name: /전체 2/ }).click();
  await page.getByRole("link", { name: "#소설" }).click();
  await expect(row(novel)).toBeVisible();
  await expect(row(science)).toHaveCount(0);
  await page.goto("/me/reading");

  // 표의 상태를 바로 바꾼다
  await page.getByLabel(`${novel} 읽기 상태`).selectOption("paused");
  await expect(page.getByRole("link", { name: /보류 1/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`${novel} 읽기 상태`)).toHaveValue("paused");

  // 책 옆의 독서록 작성
  await row(novel).getByRole("link", { name: "독서록 작성" }).click();
  await expect(page).toHaveURL(/\/me\/reading\/new\?book=/);
  await expect(page.getByText(novel).locator("visible=true")).toBeVisible();
  await page.getByLabel("읽은 페이지 수 (선택)").fill("45");
  await page.getByLabel("기록", { exact: true }).fill("새는 알을 깨고 나온다");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/reading\/[0-9a-f-]{36}$/);

  // 책 상세에 독서록이 모인다, 표에 숫자가 반영된다
  await page.getByRole("link", { name: "이 책의 독서록 모두 보기" }).click();
  await expect(page).toHaveURL(/\/me\/books\/[0-9a-f-]{36}$/);
  const bookUrl = new URL(page.url()).pathname;
  await expect(
    page.getByText("새는 알을 깨고 나온다").locator("visible=true"),
  ).toBeVisible();
  await page.goto("/me/reading");
  await expect(row(novel)).toContainText("45");

  // 읽은 쪽 수를 표에서 바로 고친다
  await row(novel)
    .getByRole("button", { name: /읽은 쪽 수 45쪽, 수정/ })
    .click();
  const pagesInput = row(novel).getByLabel(`${novel} 읽은 쪽 수`);
  await pagesInput.fill("300");
  await pagesInput.press("Enter");
  await expect(
    row(novel).getByRole("button", { name: /읽은 쪽 수 300쪽, 수정/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    row(novel).getByRole("button", { name: /읽은 쪽 수 300쪽, 수정/ }),
  ).toBeVisible();

  // 책 없이 독서록 주소로 오면 서재로
  await page.goto("/me/reading/new");
  await expect(page).toHaveURL("/me/reading");

  // 다른 사람은 내 책을 볼 수 없다
  const other = await newUserPage(browser, info);
  await register(other, "남");
  const res = await other.goto(bookUrl);
  await expect(other.getByText("책을 찾을 수 없어요")).toBeVisible();
  expect(await res!.text()).not.toContain("새는 알을 깨고");
  await other.context().close();

  // 책 정보 수정 → 표에 반영
  await page.goto(bookUrl);
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "도서 수정" });
  await edit.getByLabel("책 제목").fill(`${novel} 개정판`);
  await edit.getByRole("button", { name: "저장" }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 1, name: `${novel} 개정판` }),
  ).toBeVisible();

  // 책 삭제 → 독서록도 함께 사라진다
  await page.getByRole("button", { name: "책 삭제" }).click();
  await expect(page).toHaveURL("/me/reading");
  await expect(row(`${novel} 개정판`)).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
