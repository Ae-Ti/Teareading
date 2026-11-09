import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("모임: 멤버 hover 버튼·모임/멤버 관리 팝업·부모임장·메시지 삭제·차단·강제 퇴장·메시지 탭", async ({
  page: owner,
  browser,
}, info) => {
  test.setTimeout(120_000);
  owner.on("dialog", (d) => void d.accept());
  const mobile = info.project.name === "mobile";
  const ownerName = await register(owner, "모임장");
  const sub = await newUserPage(browser, info);
  const subName = await register(sub, "부모임장");
  const mem = await newUserPage(browser, info);
  const memName = await register(mem, "멤버");

  await owner.goto("/groups/new");
  const groupName = `운영 모임 ${randomUUID().slice(0, 6)}`;
  await owner.getByLabel("모임 이름").fill(groupName);
  await owner.getByRole("button", { name: "모임 만들기" }).click();
  await expect(owner).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const groupUrl = new URL(owner.url()).pathname;

  for (const p of [sub, mem]) {
    await p.goto(groupUrl);
    await p.getByRole("button", { name: "모임 가입" }).click();
    await expect(p.getByRole("link", { name: "단체 채팅방" })).toBeVisible();
  }

  // 메시지 탭에 모임 단체 채팅방이 보인다
  await mem.goto("/dm");
  const groupRow = mem.getByRole("link", { name: new RegExp(groupName) });
  await expect(groupRow).toContainText("모임");
  await groupRow.click();
  await expect(mem).toHaveURL(`${groupUrl}/chat`);

  // 멤버 목록: 마우스를 올리면 '메시지 보내기'·'프로필 보기'
  await sub.goto(groupUrl);
  const ownerRow = sub.locator(`li[data-member="${ownerName}"]`);
  const dmButton = ownerRow.getByRole("button", { name: "메시지 보내기" });
  if (!mobile) {
    await sub.mouse.move(0, 0);
    await expect(ownerRow.locator(".member-actions")).toHaveCSS("opacity", "0");
    await ownerRow.hover();
    await expect(ownerRow.locator(".member-actions")).toHaveCSS("opacity", "1");
  }
  await expect(
    ownerRow.getByRole("link", { name: "프로필 보기" }),
  ).toHaveAttribute("href", /\/u\//);
  await dmButton.click();
  await expect(sub).toHaveURL(/\/dm\/[0-9a-f-]{36}$/);
  // 내 줄에는 메시지 보내기가 없다
  await sub.goto(groupUrl);
  await expect(
    sub
      .locator(`li[data-member="${subName}"]`)
      .getByRole("button", { name: "메시지 보내기" }),
  ).toHaveCount(0);
  // 일반 멤버에게는 관리 버튼이 없다
  await expect(sub.getByRole("button", { name: "멤버 관리" })).toHaveCount(0);

  // 모임 관리 팝업: 페이지 이동 없이 이름 수정
  await owner.goto(groupUrl);
  await owner.getByRole("button", { name: "모임 관리" }).click();
  const settings = owner.getByRole("dialog", { name: "모임 관리" });
  await expect(settings).toBeVisible();
  await settings.getByLabel("모임 이름").fill(`${groupName} 2기`);
  await settings.getByRole("button", { name: "저장" }).click();
  await expect(settings).toBeHidden();
  await expect(owner).toHaveURL(groupUrl);
  await expect(
    owner.getByRole("heading", { level: 1, name: `${groupName} 2기` }),
  ).toBeVisible();

  // 멤버 관리 팝업: 부모임장 지정
  await owner.getByRole("button", { name: "멤버 관리" }).click();
  const manage = owner.getByRole("dialog", { name: "멤버 관리" });
  const subItem = manage.getByRole("listitem").filter({ hasText: subName });
  await subItem.getByRole("button", { name: "부모임장 지정" }).click();
  await expect(subItem.getByText("부모임장", { exact: true })).toBeVisible();
  await owner.keyboard.press("Escape");
  await expect(manage).toBeHidden();

  // 멤버가 채팅 → 부모임장이 메시지 삭제 → 멤버 화면에서도 바로 바뀐다
  await mem.goto(`${groupUrl}/chat`);
  await mem.getByLabel("메시지 입력").fill("광고 메시지입니다");
  await mem.getByRole("button", { name: "보내기" }).click();
  await sub.goto(`${groupUrl}/chat`);
  const log = sub.getByRole("log", { name: "메시지 목록" });
  const target = log.locator("li").filter({ hasText: "광고 메시지입니다" });
  await expect(target).toBeVisible();
  await expect(log.getByText("부모임장", { exact: true })).toHaveCount(0); // 부모임장은 아직 말한 적 없음
  await target.hover();
  await target.getByRole("button", { name: "삭제" }).click();
  await target.getByRole("button", { name: "정말 삭제" }).click();
  await expect(log.getByText("모임 관리자가 삭제한 메시지예요.")).toBeVisible();
  await expect(
    mem
      .getByRole("log", { name: "메시지 목록" })
      .getByText("모임 관리자가 삭제한 메시지예요."),
  ).toBeVisible({ timeout: 15_000 });
  // 일반 멤버에게는 삭제 버튼이 없다
  await expect(
    mem.getByRole("button", { name: "삭제", exact: true }),
  ).toHaveCount(0);

  // 부모임장이 멤버 메시지 차단 → 멤버 입력창이 막힌다
  await sub.goto(groupUrl);
  await sub.getByRole("button", { name: "멤버 관리" }).click();
  const subManage = sub.getByRole("dialog", { name: "멤버 관리" });
  // 부모임장은 강제 퇴장·역할 변경을 할 수 없다
  await expect(
    subManage.getByRole("button", { name: "강제 퇴장" }),
  ).toHaveCount(0);
  await expect(
    subManage.getByRole("button", { name: "부모임장 지정" }),
  ).toHaveCount(0);
  const memItem = subManage.getByRole("listitem").filter({ hasText: memName });
  await memItem.getByRole("button", { name: "메시지 차단" }).click();
  await expect(
    memItem.getByRole("button", { name: "메시지 차단 해제" }),
  ).toBeVisible();
  await mem.goto(`${groupUrl}/chat`);
  await expect(mem.getByLabel("메시지 입력")).toBeDisabled();
  await expect(mem.getByLabel("메시지 입력")).toHaveAttribute(
    "placeholder",
    /메시지 보내기를 막았어요/,
  );

  // 모임장이 강제 퇴장 → 채팅방에 들어갈 수 없다
  await owner.goto(groupUrl);
  await owner.getByRole("button", { name: "멤버 관리" }).click();
  await owner
    .getByRole("dialog", { name: "멤버 관리" })
    .getByRole("listitem")
    .filter({ hasText: memName })
    .getByRole("button", { name: "강제 퇴장" })
    .click();
  // 멤버 목록에서 빠지고 "강제 퇴장한 멤버"로 옮겨 간다
  await expect(
    owner
      .getByRole("dialog", { name: "멤버 관리" })
      .getByRole("region", { name: "강제 퇴장한 멤버" })
      .getByText(memName),
  ).toBeVisible();
  await expect(
    owner
      .getByRole("dialog", { name: "멤버 관리" })
      .getByRole("listitem")
      .filter({ hasText: memName })
      .getByRole("button", { name: "강제 퇴장" }),
  ).toHaveCount(0);
  await mem.goto(`${groupUrl}/chat`);
  await expect(mem.getByText("모임에 가입해야 볼 수 있어요")).toBeVisible();

  // 강제 퇴장한 사람은 가입 버튼 대신 안내를 본다 → 모임장이 허용하면 다시 가입할 수 있다
  await mem.goto(groupUrl);
  await expect(mem.getByText("다시 가입할 수 없어요")).toBeVisible();
  await expect(mem.getByRole("button", { name: "모임 가입" })).toHaveCount(0);
  await owner
    .getByRole("dialog", { name: "멤버 관리" })
    .getByRole("listitem")
    .filter({ hasText: memName })
    .getByRole("button", { name: "재가입 허용" })
    .click();
  await expect(
    owner.getByRole("dialog", { name: "멤버 관리" }).getByText(memName),
  ).toHaveCount(0);
  await mem.goto(groupUrl);
  await mem.getByRole("button", { name: "모임 가입" }).click();
  await expect(mem.getByRole("link", { name: "단체 채팅방" })).toBeVisible();

  for (const p of [sub, mem]) await p.context().close();
});
