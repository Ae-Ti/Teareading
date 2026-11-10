import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("친구의 방: 친구만 들어가고, 친구가 아니면 안내를 본다", async ({
  page,
  browser,
}, info) => {
  await register(page, "방손님", "/dashboard");
  const owner = await newUserPage(browser, info);
  const ownerName = await register(owner, "방주인");
  await owner.getByRole("link", { name: "내 공개 프로필" }).click();
  await expect(owner).toHaveURL(/\/u\//);
  const profile = new URL(owner.url()).pathname;
  const room = `/space/room/${profile.split("/").pop()}`;

  // 친구가 되기 전
  await page.goto(room);
  await expect(page.getByText("친구의 방만 구경할 수 있어요")).toBeVisible();
  await page.goto(profile);
  await expect(page.getByRole("link", { name: "방 구경하기" })).toHaveCount(0);

  await page.getByRole("button", { name: "친구 맺기" }).click();
  const dialog = owner.getByRole("dialog", { name: "친구 요청" });
  await dialog.getByRole("button", { name: "수락" }).click({ timeout: 15_000 });
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByRole("link", { name: "방 구경하기" }).click();
  await expect(page).toHaveURL(room);
  await expect(
    page.getByRole("heading", { name: `${ownerName} 님의 방` }),
  ).toBeVisible();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  expect(box.width).toBeGreaterThan(100);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();

  await page.getByRole("link", { name: "나가기" }).click();
  await expect(page).toHaveURL(profile);
});
