import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("단체 채팅방 '모임 멤버': 목록·프로필 보기·1:1 채팅하기", async ({
  page: owner,
  browser,
}, info) => {
  const ownerName = await register(owner, "방장");
  const guest = await newUserPage(browser, info);
  const guestName = await register(guest, "손님");

  await owner.goto("/groups/new");
  await owner.getByLabel("모임 이름").fill(`멤버 ${randomUUID().slice(0, 6)}`);
  await owner.getByRole("button", { name: "모임 만들기" }).click();
  await expect(owner).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const groupUrl = new URL(owner.url()).pathname;
  await guest.goto(groupUrl);
  await guest.getByRole("button", { name: "모임 가입" }).click();
  await expect(guest.getByRole("link", { name: "단체 채팅방" })).toBeVisible();

  const chatUrl = `${groupUrl}/chat`;
  await guest.goto(chatUrl);
  const openMembers = async () => {
    await guest.getByRole("button", { name: /멤버 2명/ }).click();
    const dialog = guest.getByRole("dialog", { name: "모임 멤버 2명" });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  // 팝업: 페이지 이동 없이 전원, 모임장이 위에
  let dialog = await openMembers();
  await expect(guest).toHaveURL(chatUrl);
  const rows = dialog.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(ownerName);
  await expect(rows.first()).toContainText("모임장");

  // 내 줄에는 1:1 채팅이 없다
  const mine = dialog.locator(`li[data-member="${guestName}"]`);
  await expect(mine.getByRole("link", { name: "프로필 보기" })).toBeVisible();
  await expect(mine.getByRole("button", { name: "1:1 채팅하기" })).toHaveCount(
    0,
  );

  // 프로필 보기
  const ownerRow = dialog.locator(`li[data-member="${ownerName}"]`);
  await ownerRow.getByRole("link", { name: "프로필 보기" }).click();
  await expect(guest).toHaveURL(/\/u\/[0-9a-f-]{36}$/);
  await expect(guest.getByRole("dialog")).toHaveCount(0);

  // 돌아와도 팝업이 다시 열려 있지 않다
  await guest.goBack();
  await expect(guest).toHaveURL(chatUrl);
  await expect(guest.getByLabel("메시지 입력")).toBeVisible();
  await expect(guest.getByRole("dialog")).toHaveCount(0);

  // 1:1 채팅하기
  dialog = await openMembers();
  await dialog
    .locator(`li[data-member="${ownerName}"]`)
    .getByRole("button", { name: "1:1 채팅하기" })
    .click();
  await expect(guest).toHaveURL(/\/dm\/[0-9a-f-]{36}$/);
  await expect(guest.getByRole("dialog")).toHaveCount(0);
  await expect(
    guest.getByRole("heading", { name: ownerName }).locator("visible=true"),
  ).toBeVisible();

  await guest.context().close();
});
