import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { newUserPage, register } from "./helpers";

// 내비게이션의 빨간 개수 (화면 크기별로 보이는 메뉴에서 찾는다)
const navBadge = (p: Page, n: number) =>
  p
    .locator("nav")
    .getByRole("link", { name: new RegExp(`안 읽은 메시지 ${n}개`) });
const anyNavBadge = (p: Page) =>
  p.locator("nav").getByRole("status", { name: /안 읽은 메시지/ });
const row = (p: Page, title: string) => p.locator(`li[data-chat="${title}"]`);
async function menu(p: Page, title: string, item: string) {
  await row(p, title).hover();
  await row(p, title)
    .getByRole("button", { name: `${title} 채팅방 옵션` })
    .click();
  await row(p, title).getByRole("menuitem", { name: item }).click();
}

test("메시지 목록 ⋮ 메뉴(알람·고정·나가기)와 내비게이션 빨간 개수", async ({
  page: a,
  browser,
}, info) => {
  test.setTimeout(120_000);
  a.on("dialog", (d) => void d.accept());
  const mobile = info.project.name === "mobile";
  const nameA = await register(a, "목록A");
  const b = await newUserPage(browser, info);
  const nameB = await register(b, "목록B");

  await a.goto("/groups/new");
  const groupName = `목록 모임 ${randomUUID().slice(0, 6)}`;
  await a.getByLabel("모임 이름").fill(groupName);
  await a.getByRole("button", { name: "모임 만들기" }).click();
  await expect(a).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const groupUrl = new URL(a.url()).pathname;
  await b.goto(groupUrl);
  await b.getByRole("button", { name: "모임 가입" }).click();
  const ownerRow = b.locator(`li[data-member="${nameA}"]`);
  await ownerRow.hover();
  await ownerRow.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(b).toHaveURL(/\/dm\/[0-9a-f-]{36}$/);
  const dmUrl = new URL(b.url()).pathname;

  // A는 다른 화면에 있고, B가 보내면 새로고침 없이 빨간 개수가 뜬다
  await a.goto("/guide");
  await expect(anyNavBadge(a)).toHaveCount(0);
  await a.waitForTimeout(3500); // 실시간 구독이 걸릴 시간
  await b.getByLabel("메시지 입력").fill("첫 번째");
  await b.getByRole("button", { name: "보내기" }).click();
  await expect(navBadge(a, 1)).toBeVisible({ timeout: 15_000 });
  await b.getByLabel("메시지 입력").fill("두 번째");
  await b.getByRole("button", { name: "보내기" }).click();
  await expect(navBadge(a, 2)).toBeVisible({ timeout: 15_000 });

  // ⋮는 마우스를 올렸을 때 보인다 (터치 기기는 항상)
  await a.goto("/dm");
  const menuBox = row(a, nameB).locator(".chat-row-menu");
  if (!mobile) {
    await a.mouse.move(0, 0);
    await expect(menuBox).toHaveCSS("opacity", "0");
    await row(a, nameB).hover();
    await expect(menuBox).toHaveCSS("opacity", "1");
  }
  await expect(row(a, nameB)).toContainText("두 번째");
  await expect(row(a, nameB).getByLabel("안 읽은 메시지 2개")).toBeVisible();

  // 알람 끄기: 메뉴의 개수에서 빠지고 목록에는 표시
  await menu(a, nameB, "채팅방 알람 끄기");
  await expect(row(a, nameB).getByLabel("알람 꺼짐")).toBeVisible();
  await expect(anyNavBadge(a)).toHaveCount(0);
  await expect(row(a, nameB).getByLabel("안 읽은 메시지 2개")).toBeVisible();
  await menu(a, nameB, "채팅방 알람 켜기");
  await expect(row(a, nameB).getByLabel("알람 꺼짐")).toHaveCount(0);
  await expect(navBadge(a, 2)).toBeVisible();

  // 상단 고정: 더 최근 대화가 있어도 맨 위
  await menu(a, groupName, "상단 고정");
  await expect(row(a, groupName).getByLabel("상단 고정")).toBeVisible();
  await expect(a.locator("li[data-chat]").first()).toHaveAttribute(
    "data-chat",
    groupName,
  );

  // 채팅방을 열면 읽음 → 개수가 사라진다
  await row(a, nameB).getByRole("link").first().click();
  await expect(a).toHaveURL(dmUrl);
  await expect(anyNavBadge(a)).toHaveCount(0, { timeout: 10_000 });

  // 돌아오면 목록의 개수도 사라져 있다
  await a.getByRole("link", { name: "← 목록" }).click();
  await expect(a).toHaveURL("/dm");
  await expect(row(a, nameB).getByLabel(/안 읽은 메시지/)).toHaveCount(0, {
    timeout: 10_000,
  });

  // 모임장은 단체 채팅방을 나갈 수 없다
  await row(a, groupName).hover();
  await row(a, groupName)
    .getByRole("button", { name: `${groupName} 채팅방 옵션` })
    .click();
  await expect(
    row(a, groupName).getByRole("menuitem", { name: "채팅방 나가기" }),
  ).toBeDisabled();
  await a.keyboard.press("Escape");
  await expect(row(a, groupName).getByRole("menu")).toHaveCount(0);

  // 1:1 나가기: 내 목록에서만 사라지고, 새 메시지가 오면 돌아온다
  await menu(a, nameB, "채팅방 나가기");
  await expect(row(a, nameB)).toHaveCount(0);
  await b.goto("/dm");
  await expect(row(b, nameA)).toBeVisible();
  await b.goto(dmUrl);
  await b.getByLabel("메시지 입력").fill("돌아와요");
  await b.getByRole("button", { name: "보내기" }).click();
  await expect(row(a, nameB)).toBeVisible({ timeout: 15_000 });
  await expect(navBadge(a, 1)).toBeVisible({ timeout: 15_000 });

  // 단체 채팅 나가기 = 모임 탈퇴
  await b.goto("/dm");
  await menu(b, groupName, "채팅방 나가기");
  await expect(row(b, groupName)).toHaveCount(0);
  await b.goto(groupUrl);
  await expect(b.getByRole("button", { name: "모임 가입" })).toBeVisible();

  await b.context().close();
});
