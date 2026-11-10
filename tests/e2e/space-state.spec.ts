import { expect, test, type Page } from "@playwright/test";
import { MAPS, type Point } from "@/lib/space/map";
import { findPath } from "@/lib/space/path";
import { newUserPage, register } from "./helpers";

const area = (p: Page) => p.getByLabel(/찻집 공간/);
const leaveButton = (p: Page) => p.getByRole("button", { name: "나가기" });
const myLabel = (p: Page, text: string) =>
  p.locator(".space-label-message", { hasText: text });

function keyFor(from: Point, to: Point) {
  if (to.x > from.x) return "ArrowRight";
  if (to.x < from.x) return "ArrowLeft";
  return to.y > from.y ? "ArrowDown" : "ArrowUp";
}

// 입구에서 방석까지 방향키로 걸어가 앉는다
async function walkToSeat(p: Page) {
  const map = MAPS.teahouse;
  const seat = map.seats[0];
  const path = findPath(map, map.spawn, { x: seat.x, y: seat.y })!;
  let at = map.spawn;
  await area(p).focus();
  for (const step of path) {
    if (step.x === at.x && step.y === at.y) continue;
    await area(p).press(keyFor(at, step));
    await p.waitForTimeout(340);
    at = step;
  }
}

test("찻집: 앉아서 상태 메시지, 다른 화면에 갔다 와도 그대로", async ({
  page: a,
  browser,
}, info) => {
  test.setTimeout(90_000);
  await register(a, "찻집A", "/space");
  const b = await newUserPage(browser, info);
  await register(b, "찻집B", "/space");

  await a.getByRole("button", { name: "찻집 입장" }).click();
  await expect(leaveButton(a)).toBeVisible({ timeout: 15_000 });
  await b.getByRole("button", { name: "찻집 입장" }).click();
  await expect(leaveButton(b)).toBeVisible({ timeout: 15_000 });

  // 서 있을 때는 입력칸이 없다
  await expect(a.getByLabel("상태 메시지")).toHaveCount(0);

  await walkToSeat(a);
  const input = a.getByLabel("상태 메시지");
  await expect(input).toBeVisible();
  await input.fill("데미안 읽는 중");
  await a.getByRole("button", { name: "올리기" }).click();
  await expect(myLabel(a, "데미안 읽는 중")).toBeVisible();
  await expect(myLabel(b, "데미안 읽는 중")).toBeVisible({ timeout: 15_000 });

  // 다른 화면에 갔다가 돌아와도 앉은 채 그대로 (다시 입장 안 눌러도 됨)
  await a.getByRole("link", { name: "다도 입문 가이드" }).first().click();
  await expect(a).toHaveURL("/guide");
  await expect(myLabel(b, "데미안 읽는 중")).toHaveCount(0, {
    timeout: 20_000,
  });
  await a.getByRole("link", { name: "찻집", exact: true }).first().click();
  await expect(a).toHaveURL("/space");
  await expect(leaveButton(a)).toBeVisible({ timeout: 15_000 });
  await expect(a.getByRole("button", { name: "찻집 입장" })).toHaveCount(0);
  await expect(a.getByLabel("상태 메시지")).toHaveValue("데미안 읽는 중");
  await expect(myLabel(a, "데미안 읽는 중")).toBeVisible();
  await expect(myLabel(b, "데미안 읽는 중")).toBeVisible({ timeout: 20_000 });

  // 새로고침해도 그대로
  await a.reload();
  await expect(leaveButton(a)).toBeVisible({ timeout: 15_000 });
  await expect(a.getByLabel("상태 메시지")).toHaveValue("데미안 읽는 중");

  // 일어나면 메시지가 사라진다
  const seat = MAPS.teahouse.seats[0];
  const free = [
    { x: seat.x, y: seat.y + 1 },
    { x: seat.x, y: seat.y - 1 },
    { x: seat.x + 1, y: seat.y },
    { x: seat.x - 1, y: seat.y },
  ].find((t) => !MAPS.teahouse.blocked.has(`${t.x},${t.y}`))!;
  await area(a).focus();
  await area(a).press(keyFor(seat, free));
  await expect(a.getByLabel("상태 메시지")).toHaveCount(0);
  await expect(myLabel(a, "데미안 읽는 중")).toHaveCount(0);

  // '나가기'를 누르면 다음엔 입구에서 시작
  await leaveButton(a).click();
  await expect(a.getByRole("button", { name: "찻집 입장" })).toBeVisible();
  await a.getByRole("link", { name: "다도 입문 가이드" }).first().click();
  await expect(a).toHaveURL("/guide");
  await a.getByRole("link", { name: "찻집", exact: true }).first().click();
  await expect(a).toHaveURL("/space");
  await expect(a.getByRole("button", { name: "찻집 입장" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(leaveButton(a)).toHaveCount(0);

  await b.context().close();
});
