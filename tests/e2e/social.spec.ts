import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { newUserPage, register } from "./helpers";

// 다른 사람 캐릭터 위를 누른다 (이름표 바로 아래가 캐릭터)
async function clickCharacter(page: Page, nickname: string) {
  const label = page.locator(".space-label", { hasText: nickname }).first();
  await expect(label).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    const box = (await label.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + 14);
    await expect(page.getByRole("group", { name: /메뉴$/ })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
}

async function enterTeahouse(page: Page) {
  await page.goto("/space");
  await page.getByRole("button", { name: "찻집 입장" }).click();
  await expect(page.getByRole("button", { name: "나가기" })).toBeVisible({
    timeout: 15_000,
  });
}

test("게시판: 답글은 한 단계만, 댓글 추천, 사진을 글 중간에 넣기", async ({
  page,
  browser,
}, info) => {
  await register(page, "글쓴이");
  await page.goto("/board/new");
  await page.getByLabel("제목").fill("사진 넣은 글입니다");
  const body = page.getByLabel("내용", { exact: true });
  await body.fill("앞문장뒷문장");
  // 커서를 "앞문장" 뒤에 두고 사진을 넣는다
  await body.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(3, 3);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  const png = await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 120, g: 160, b: 90 },
    },
  })
    .png()
    .toBuffer();
  await page.getByLabel("사진 파일 선택").setInputFiles({
    name: "tea.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByRole("img", { name: "글에 넣은 사진" })).toBeVisible();
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page).toHaveURL(/\/board\/[0-9a-f-]{36}$/);
  const postUrl = new URL(page.url()).pathname;

  const main = page.locator("main");
  const image = main.getByRole("img", { name: "글에 넣은 사진" });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /post-images.*\.webp$/);
  const before = await main.locator("p", { hasText: "앞문장" }).boundingBox();
  const shot = await image.boundingBox();
  const after = await main.locator("p", { hasText: "뒷문장" }).boundingBox();
  expect(before!.y).toBeLessThan(shot!.y);
  expect(shot!.y).toBeLessThan(after!.y);

  await page.getByLabel("댓글 입력").fill("첫 댓글이에요");
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(main.getByText("첫 댓글이에요")).toBeVisible();
  // 내 댓글은 추천할 수 없다
  await expect(
    main.getByRole("button", { name: "댓글 추천 0" }),
  ).toBeDisabled();

  const reader = await newUserPage(browser, info);
  await register(reader, "독자");
  await reader.goto(postUrl);
  const rmain = reader.locator("main");
  await rmain.getByRole("button", { name: "댓글 추천 0" }).click();
  await expect(
    rmain.getByRole("button", { name: "댓글 추천 1" }),
  ).toHaveAttribute("aria-pressed", "true");

  await rmain.getByRole("button", { name: "답글", exact: true }).click();
  await reader.getByLabel("답글 입력").fill("답글 달아요");
  await reader.getByRole("button", { name: "답글 등록" }).click();
  const replies = rmain.getByRole("list", { name: "답글" });
  await expect(replies.getByText("답글 달아요")).toBeVisible();
  // 답글 아래에는 답글 버튼이 없다
  await expect(
    replies.getByRole("button", { name: "답글", exact: true }),
  ).toHaveCount(0);
  await expect(
    rmain.getByRole("button", { name: "답글", exact: true }),
  ).toHaveCount(1);
  await reader.context().close();
});

test("내 프로필: 이름, 카드 안 버튼, 내가 쓴 글·댓글, 공개 프로필 제목 없음", async ({
  page,
}) => {
  const nickname = await register(page, "프로필");
  await expect(page).toHaveTitle(/내 프로필/);
  await expect(
    page.getByRole("heading", { name: "내 프로필", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "내가 쓴 글" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "내가 쓴 댓글" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "내 공개 프로필" }).click();
  await expect(page).toHaveURL(/\/u\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nickname);
  await expect(page.getByRole("heading", { name: "공개 프로필" })).toHaveCount(
    0,
  );
});

test("상단 내 메뉴와 개인 설정, 대시보드 캐릭터", async ({ page }, info) => {
  const nickname = await register(page, "메뉴");
  await expect(
    page.getByRole("navigation", { name: "전체 메뉴" }).getByRole("link", {
      name: "가이드",
    }),
  ).toHaveCount(0);

  const open = async () => {
    await page.getByRole("button", { name: `${nickname} 메뉴` }).click();
    return page.getByRole("menu", { name: "내 메뉴" });
  };
  const menu = await open();
  await expect(menu.getByRole("menuitem")).toHaveText([
    "프로필 정보",
    "개인 설정",
    "내 서재",
    "내 차칼럼",
  ]);
  await menu.getByRole("menuitem", { name: "개인 설정" }).click();
  await expect(page).toHaveURL("/mypage/settings");
  await expect(menu).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "프로필 공개 범위" }),
  ).toBeVisible();

  for (const [label, url] of [
    ["내 서재", "/me/reading"],
    ["내 차칼럼", "/me/columns"],
    ["프로필 정보", "/mypage"],
  ]) {
    await (await open()).getByRole("menuitem", { name: label }).click();
    await expect(page).toHaveURL(url);
  }

  // 닉네임을 바꾸면 상단 버튼도 바뀐다
  const renamed = `바뀐${Date.now() % 100000}`;
  await page.goto("/mypage/edit");
  await page.getByLabel("닉네임", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(page.locator("form:visible").getByRole("status")).toContainText(
    "프로필을 저장했어요.",
  );
  await expect(
    page.getByRole("button", { name: `${renamed} 메뉴` }),
  ).toBeVisible();

  // 대시보드: 컴퓨터 화면에서만 캐릭터 카드가 보인다
  await page.goto("/dashboard");
  const character = page.getByRole("img", { name: "내 찻집 캐릭터" });
  if (info.project.name === "desktop") {
    await expect(character).toBeVisible();
    const timer = await page.getByRole("radio", { name: /독서/ }).boundingBox();
    const week = await page
      .getByRole("heading", { name: "이번 주 출석" })
      .boundingBox();
    expect(week!.y).toBeGreaterThan(timer!.y);
    expect(week!.x).toBeLessThan((await character.boundingBox())!.x);
  } else {
    await expect(character).toBeHidden();
  }
});

test("친구: 신청 → 가운데 팝업 수락 → 친구 수·목록·접속 중 표시", async ({
  page,
  browser,
}, info) => {
  const nickA = await register(page, "친구A", "/dashboard");
  const b = await newUserPage(browser, info);
  const nickB = await register(b, "친구B");

  await b.getByRole("link", { name: "내 공개 프로필" }).click();
  await expect(b).toHaveURL(/\/u\//);
  const urlB = new URL(b.url()).pathname;
  // B는 가입 뒤 화면 새로고침 없이 이동만 했다. 이 상태에서도 팝업을 받아야 한다

  await page.goto(urlB);
  await page.getByRole("button", { name: "친구 맺기" }).click();
  await expect(
    page.getByRole("button", { name: "친구 신청 보냄" }),
  ).toBeVisible();

  const dialog = b.getByRole("dialog", { name: "친구 요청" });
  await expect(dialog).toContainText(
    `${nickA}님이 친구 맺기를 신청하셨습니다.`,
    {
      timeout: 15_000,
    },
  );
  await dialog.getByRole("button", { name: "수락" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByRole("button", { name: /^친구 1명$/ }).click();
  await expect(
    page.getByRole("dialog", { name: "친구" }).getByRole("link", {
      name: nickA,
    }),
  ).toBeVisible();

  // 상대가 접속 중이면 대시보드에 보인다
  await b.goto("/dashboard");
  await expect(b.getByRole("link", { name: nickA })).toBeVisible({
    timeout: 45_000,
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: nickB })).toBeVisible({
    timeout: 45_000,
  });
  await b.context().close();
});

test("찻집 캐릭터: 1:1 요청 수락 → 옆 대화창, 모임맺기 → 이름표, 모임 들어가기", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const nickA = await register(page, "찻집A");
  const b = await newUserPage(browser, info);
  const nickB = await register(b, "찻집B");
  const c = await newUserPage(browser, info);
  await register(c, "찻집C");

  await enterTeahouse(page);
  await enterTeahouse(b);

  // 1:1 채팅 요청
  await clickCharacter(page, nickB);
  const menuA = page.getByRole("group", { name: `${nickB}님 메뉴` });
  await expect(menuA.getByRole("button", { name: "차단" })).toBeVisible();
  await menuA.getByRole("button", { name: "1:1 채팅하기" }).click();

  const dmDialog = b.getByRole("dialog", { name: "메시지 요청" });
  await expect(dmDialog).toContainText(`${nickA}님이 메시지를 보냈습니다.`, {
    timeout: 15_000,
  });
  await dmDialog.getByRole("button", { name: "수락" }).click();

  // 페이지 이동 없이 양쪽에 대화창이 뜨고 바로 대화한다
  const dockB = b.getByRole("complementary", { name: `${nickA}님과 대화` });
  const dockA = page.getByRole("complementary", { name: `${nickB}님과 대화` });
  await expect(dockB).toBeVisible({ timeout: 15_000 });
  await expect(dockA).toBeVisible({ timeout: 15_000 });
  await expect(b).toHaveURL("/space");
  await dockB.getByLabel("메시지 입력").fill("찻집에서 인사해요");
  await dockB.getByRole("button", { name: "보내기" }).click();
  await expect(dockA.getByText("찻집에서 인사해요")).toBeVisible({
    timeout: 15_000,
  });
  await dockA.getByRole("button", { name: "대화창 닫기" }).click();
  await dockB.getByRole("button", { name: "대화창 닫기" }).click();

  // 모임맺기: 설정 → 상대 수락 → 모임 생성, 이름표
  const groupName = `찻집모임${Date.now() % 100000}`;
  await clickCharacter(page, nickB);
  await menuA.getByRole("button", { name: "모임맺기" }).click();
  const settings = page.getByRole("dialog", { name: "모임맺기" });
  await settings.getByLabel("모임 이름").fill(groupName);
  await settings.getByRole("button", { name: "신청 보내기" }).click();
  await expect(settings).toBeHidden();

  const groupDialog = b.getByRole("dialog", { name: "모임맺기 요청" });
  await expect(groupDialog).toContainText(
    `${nickA}님이 모임맺기를 신청하셨습니다.`,
    { timeout: 15_000 },
  );
  await expect(groupDialog).toContainText(groupName);
  await groupDialog.getByRole("button", { name: "수락" }).click();
  await expect(page.locator(".space-label-group").first()).toHaveText(
    groupName,
    { timeout: 15_000 },
  );
  await expect(b.locator(".space-label-group").first()).toHaveText(groupName, {
    timeout: 15_000,
  });

  // 모임이 맺어진 뒤에는 메뉴가 바뀐다
  await expect(async () => {
    await page.mouse.move(0, 0);
    await clickCharacter(page, nickB);
    await expect(menuA.getByRole("link", { name: "모임 보기" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(menuA.getByRole("button", { name: "모임맺기" })).toHaveCount(0);

  // 셋째 사람: 모임 들어가기 → 모임장에게 팝업. 들어온 뒤 B가 입구에서 비켜서 겹치지 않게 한다
  await enterTeahouse(c);
  await b.locator('[aria-label^="찻집 공간"]').focus();
  await b.keyboard.press("ArrowUp");
  await b.waitForTimeout(400);
  await b.keyboard.press("ArrowUp");
  await b.waitForTimeout(600);
  await clickCharacter(c, nickB);
  const menuC = c.getByRole("group", { name: `${nickB}님 메뉴` });
  await menuC.getByRole("button", { name: "모임 들어가기" }).click();
  await expect(c.getByText("모임장에게 가입을 신청했어요")).toBeVisible();
  const joinDialog = page.getByRole("dialog", { name: "모임 가입 요청" });
  await expect(joinDialog).toContainText(groupName, { timeout: 15_000 });
  await joinDialog.getByRole("button", { name: "수락" }).click();
  await expect(c.locator(".space-label-group").first()).toHaveText(groupName, {
    timeout: 15_000,
  });

  await b.context().close();
  await c.context().close();
});
