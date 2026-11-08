import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function register(page: Page, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const nickname = `${label}${suffix}`;
  await page.goto("/signup?next=/mypage");
  const form = page.locator("form:visible");
  await form
    .getByLabel("이메일", { exact: true })
    .fill(`ui-dm-${suffix}@example.com`);
  await form.getByLabel("닉네임", { exact: true }).fill(nickname);
  await form.getByLabel("비밀번호", { exact: true }).fill("Dm-reader-123!");
  await form
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("Dm-reader-123!");
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/mypage");
  return nickname;
}

async function userId(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) =>
    /auth-token$/.test(c.name),
  )!;
  const session = JSON.parse(
    Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString(),
  );
  return session.user.id as string;
}

const log = (page: Page) => page.getByRole("log", { name: "메시지 목록" });
const input = (page: Page) => page.getByLabel("메시지 입력");
async function send(page: Page, body: string) {
  await input(page).fill(body);
  await page.getByRole("button", { name: "보내기" }).click();
}

test("프로필에서 대화 시작·실시간·같은 대화 재진입·제3자 차단·차단/해제", async ({
  browser,
  page: pageA,
  context: contextA,
}, testInfo) => {
  const options = { ...testInfo.project.use, baseURL: "http://127.0.0.1:3100" };
  const contextB = await browser.newContext(options);
  const contextC = await browser.newContext(options);
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();
  try {
    const nickA = await register(pageA, "디엠A");
    const nickB = await register(pageB, "디엠B");
    await register(pageC, "디엠C");
    const idA = await userId(contextA);
    const idB = await userId(contextB);

    // 빈 목록
    await pageB.goto("/dm");
    await expect(pageB.getByText("아직 나눈 대화가 없어요")).toBeVisible();

    // A가 B 프로필에서 대화를 시작한다
    await pageA.goto(`/u/${idB}`);
    await pageA.getByRole("button", { name: "메시지 보내기" }).click();
    await expect(pageA).toHaveURL(/\/dm\/[0-9a-f-]{36}$/);
    const threadUrl = new URL(pageA.url()).pathname;
    await expect(pageA.getByRole("heading", { name: nickB })).toBeVisible();
    await expect(pageA.getByText("아직 메시지가 없어요")).toBeVisible();
    await send(pageA, "안녕하세요, 모임에서 봤어요");

    // B 목록에 A와 마지막 메시지가 보인다 → 들어가서 답장
    await pageB.goto("/dm");
    const row = pageB.getByRole("link", { name: new RegExp(nickA) });
    await expect(row).toContainText("안녕하세요, 모임에서 봤어요");
    await row.click();
    await expect(pageB).toHaveURL(threadUrl);
    await expect(
      log(pageB).getByText("안녕하세요, 모임에서 봤어요"),
    ).toBeVisible();
    await send(pageB, "반가워요!");
    await expect(log(pageA).getByText("반가워요!")).toBeVisible();

    // 같은 상대에게 다시 시작하면 기존 대화로 간다 (반대쪽에서도)
    await pageA.goto(`/u/${idB}`);
    await pageA.getByRole("button", { name: "메시지 보내기" }).click();
    await expect(pageA).toHaveURL(threadUrl);
    await pageB.goto(`/u/${idA}`);
    await pageB.getByRole("button", { name: "메시지 보내기" }).click();
    await expect(pageB).toHaveURL(threadUrl);

    // 제3자는 대화 주소로 들어와도 내용을 볼 수 없다
    const response = await pageC.goto(threadUrl);
    await expect(pageC.getByText("대화를 찾을 수 없어요")).toBeVisible();
    const html = await response!.text();
    expect(html).not.toContain("안녕하세요, 모임에서 봤어요");

    // 자기 프로필에는 메시지 버튼이 없다
    await pageA.goto(`/u/${idA}`);
    await expect(
      pageA.getByRole("button", { name: "메시지 보내기" }),
    ).toHaveCount(0);

    // A가 대화 화면에서 B를 차단한다
    await pageA.goto(threadUrl);
    await pageA.getByRole("button", { name: "차단", exact: true }).click();
    await pageA.getByRole("button", { name: "차단하기" }).click();
    await expect(
      pageA.getByRole("button", { name: "차단 해제" }),
    ).toBeVisible();
    await expect(input(pageA)).toBeDisabled();
    await expect(input(pageA)).toHaveAttribute(
      "placeholder",
      /차단한 회원이에요/,
    );

    // 열려 있던 B 화면에서 보내면 거부 이유가 보인다
    await send(pageB, "차단된 뒤 보냄");
    await expect(log(pageB).locator('li[data-status="failed"]')).toContainText(
      "지금은 이 대화에 메시지를 보낼 수 없어요",
    );
    // 새로고침하면 입력창이 막혀 있다. 차단당한 쪽에는 중립적인 안내만 보인다
    await pageB.reload();
    await expect(input(pageB)).toBeDisabled();
    await expect(input(pageB)).toHaveAttribute("placeholder", /보낼 수 없어요/);
    await expect(pageB.getByText("차단한 회원이에요")).toHaveCount(0);
    // 지난 대화는 남아 있다
    await expect(log(pageB).getByText("반가워요!")).toBeVisible();

    // 목록에 차단 표시, 프로필에는 해제 안내
    await pageA.goto("/dm");
    await expect(
      pageA.getByRole("link", { name: new RegExp(nickB) }),
    ).toContainText("차단함");
    await pageA.goto(`/u/${idB}`);
    await expect(pageA.getByText("차단한 회원이에요")).toBeVisible();

    // 해제하면 다시 보낼 수 있다
    await pageA.getByRole("button", { name: "차단 해제" }).click();
    await expect(
      pageA.getByRole("button", { name: "메시지 보내기" }),
    ).toBeVisible();
    await pageB.reload();
    await send(pageB, "다시 이야기해요");
    await expect(
      log(pageB).locator('li[data-status="sent"]', {
        hasText: "다시 이야기해요",
      }),
    ).toHaveCount(1);

    // 채팅방을 떠나면 하단 탭(모바일)·푸터가 돌아온다 — 지나간 화면이 숨겨진 채 DOM에 남아 있어도
    const tabs = pageB.getByRole("navigation", { name: "주요 메뉴" });
    const footer = pageB.locator("footer.site-footer");
    const mobile = testInfo.project.name === "mobile";
    for (let round = 0; round < 2; round++) {
      await expect(footer).toBeHidden();
      if (mobile) await expect(tabs).toHaveCount(0);
      await pageB.getByRole("link", { name: "← 목록" }).click();
      await expect(pageB).toHaveURL("/dm");
      await expect(footer).toBeVisible();
      if (mobile) await expect(tabs).toBeVisible();
      if (round === 0)
        await pageB.getByRole("link", { name: new RegExp(nickA) }).click();
    }

    const overflow = await pageB.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await contextB.close();
    await contextC.close();
  }
});
