import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("공개 프로필: 다른 사람의 활동 통계를 합계로만 본다", async ({
  page: owner,
  browser,
}, info) => {
  await register(owner, "공개");
  const title = `비밀스러운 책 ${randomUUID().slice(0, 6)}`;
  await owner.goto("/me/reading");
  await owner
    .getByRole("button", { name: /도서 추가|첫 책 추가하기/ })
    .first()
    .click();
  const dialog = owner.getByRole("dialog", { name: "도서 추가" });
  await dialog.getByLabel("책 제목").fill(title);
  await dialog.locator("label", { hasText: "완독" }).click();
  await dialog.getByRole("button", { name: "도서 추가" }).click();
  await expect(dialog).toBeHidden();

  await owner.goto("/mypage");
  const href = await owner
    .getByRole("link", { name: "내 공개 프로필" })
    .getAttribute("href");

  const visitor = await newUserPage(browser, info);
  await register(visitor, "방문");
  const res = await visitor.goto(href!);
  const section = visitor.getByRole("region", { name: "활동 통계" });
  await expect(section).toContainText("연속 학습");
  await expect(section).toContainText("0일");
  await expect(section).toContainText("완독");
  await expect(section).toContainText("1권");
  await expect(section).toContainText("다도 시간");
  expect(await res!.text()).not.toContain(title);
  await visitor.context().close();
});
