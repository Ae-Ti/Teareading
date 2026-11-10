import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("글별 공개 범위와 프로필 비공개", async ({
  page: owner,
  browser,
}, info) => {
  await register(owner, "범위");
  const writeColumn = async (title: string, open: boolean) => {
    await owner.goto("/me/columns/new");
    await owner.getByLabel("제목", { exact: true }).fill(title);
    await owner.getByLabel("본문", { exact: true }).fill(`${title} 본문`);
    if (open) await owner.locator("label", { hasText: /^공개$/ }).click();
    await owner
      .locator("form:visible")
      .getByRole("button", { name: "저장" })
      .click();
    await expect(owner).toHaveURL(/\/me\/columns\/[0-9a-f-]{36}$/);
    await expect(
      owner.getByText(open ? "공개" : "비공개", { exact: true }).first(),
    ).toBeVisible();
  };
  await writeColumn("모두 보는 칼럼", true);
  await writeColumn("나만 보는 칼럼", false);

  await owner.goto("/mypage");
  const href = await owner
    .getByRole("link", { name: "내 공개 프로필" })
    .getAttribute("href");

  const visitor = await newUserPage(browser, info);
  await register(visitor, "구경");
  await visitor.goto(href!);
  const columns = visitor.getByRole("region", { name: "차 칼럼" });
  await expect(columns).toContainText("모두 보는 칼럼");
  await expect(columns).not.toContainText("나만 보는 칼럼");

  // 프로필을 비공개로 바꾸면 닉네임과 사진만 보인다
  await owner.goto("/mypage");
  await owner.locator("label", { hasText: /^비공개$/ }).click();
  await expect(owner.getByText("다른 회원에게는 닉네임과")).toBeVisible();
  await expect(async () => {
    const res = await visitor.goto(href!);
    await expect(visitor.getByText("비공개 프로필이에요.")).toBeVisible({
      timeout: 1000,
    });
    expect(await res!.text()).not.toContain("모두 보는 칼럼");
  }).toPass({ timeout: 10_000 });
  await expect(visitor.getByRole("heading", { name: "활동 통계" })).toHaveCount(
    0,
  );
  await visitor.context().close();
});

test("공개 프로필: 다른 사람의 활동 통계와 다 읽은 책을 본다", async ({
  page: owner,
  browser,
}, info) => {
  await register(owner, "공개");
  const title = `다 읽은 책 ${randomUUID().slice(0, 6)}`;
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
  await visitor.goto(href!);
  const section = visitor.getByRole("region", { name: "활동 통계" });
  await expect(section).toContainText("연속 학습");
  await expect(section).toContainText("0일");
  await expect(section).toContainText("완독");
  await expect(section).toContainText("1권");
  await expect(section).toContainText("다도 시간");
  await expect(visitor.getByRole("region", { name: "읽은 책" })).toContainText(
    title,
  );
  await visitor.context().close();
});
