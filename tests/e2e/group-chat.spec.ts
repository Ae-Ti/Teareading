import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function register(page: Page, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const nickname = `${label}${suffix}`;
  await page.goto("/signup?next=/mypage");
  const form = page.locator("form:visible");
  await form
    .getByLabel("이메일", { exact: true })
    .fill(`ui-chat-${suffix}@example.com`);
  await form.getByLabel("닉네임", { exact: true }).fill(nickname);
  await form.getByLabel("비밀번호", { exact: true }).fill("Chat-reader-123!");
  await form
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("Chat-reader-123!");
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/mypage");
  return nickname;
}

async function sessionClient(context: BrowserContext) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(url).hostname);
  const cookie = (await context.cookies()).find((value) =>
    /auth-token$/.test(value.name),
  )!;
  const session = JSON.parse(
    Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString(),
  );
  const client = createClient<Database>(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return client;
}

const log = (page: Page) => page.getByRole("log", { name: "메시지 목록" });
const input = (page: Page) => page.getByLabel("메시지 입력");

test("두 계정 실시간 대화·비회원 차단·실패 후 재시도·중복 없음", async ({
  browser,
  page: pageA,
  context: contextA,
}, testInfo) => {
  const isMobile = testInfo.project.name === "mobile";
  const contextB = await browser.newContext({
    ...testInfo.project.use,
    baseURL: "http://127.0.0.1:3100",
  });
  const pageB = await contextB.newPage();
  try {
    const nickA = await register(pageA, "채팅A");
    const nickB = await register(pageB, "채팅B");

    // A가 모임을 만든다
    await pageA.goto("/groups/new");
    const groupName = `채팅 모임 ${randomUUID().slice(0, 6)}`;
    await pageA.getByLabel("모임 이름").fill(groupName);
    await pageA.getByRole("button", { name: /만들기/ }).click();
    await expect(pageA).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
    const groupId = pageA.url().split("/").pop()!;

    // 비회원 B는 채팅 내용 대신 가입 안내를 본다
    await pageB.goto(`/groups/${groupId}/chat`);
    await expect(pageB.getByText("모임에 가입해야 볼 수 있어요")).toBeVisible();
    await expect(log(pageB)).toHaveCount(0);

    // 빈 채팅방
    await pageA.getByRole("link", { name: "단체 채팅방" }).click();
    await expect(pageA).toHaveURL(`/groups/${groupId}/chat`);
    await expect(pageA.getByText("아직 대화가 없어요")).toBeVisible();

    // B 가입 후 입장
    await pageB.goto(`/groups/${groupId}`);
    await pageB.getByRole("button", { name: "모임 가입" }).click();
    await pageB.getByRole("link", { name: "단체 채팅방" }).click();
    await expect(pageB).toHaveURL(`/groups/${groupId}/chat`);

    // A → B 실시간 (데스크톱은 Enter, 모바일은 버튼)
    await input(pageA).fill("안녕하세요 첫 인사예요");
    if (isMobile) await pageA.getByRole("button", { name: "보내기" }).click();
    else await input(pageA).press("Enter");
    await expect(input(pageA)).toHaveValue("");
    await expect(log(pageB).getByText("안녕하세요 첫 인사예요")).toBeVisible();
    // 보낸 사람 닉네임 옆에 역할(모임장) 표시
    await expect(log(pageB)).toContainText(`${nickA}모임장`);

    // B → A 실시간, 줄바꿈 유지
    await input(pageB).fill("반가워요");
    await pageB.getByRole("button", { name: "보내기" }).click();
    await expect(log(pageA).getByText("반가워요")).toBeVisible();
    await expect(log(pageA).getByText(nickB, { exact: true })).toBeVisible();

    // 띄어쓰기 없는 긴 메시지는 말풍선 안에서 줄바꿈된다 (태일 D6 9장 1번)
    // 한글은 글자 사이에서 원래 줄이 바뀌므로 영문·숫자 연속 문자로 확인한다
    const longBody = "a".repeat(400);
    await input(pageB).fill(longBody);
    await pageB.getByRole("button", { name: "보내기" }).click();
    const bubble = log(pageB).locator("p", { hasText: longBody });
    await expect(bubble).toBeVisible();
    const [bubbleBox, logBox] = await Promise.all([
      bubble.boundingBox(),
      log(pageB).boundingBox(),
    ]);
    // 내 말풍선은 오른쪽 정렬이라 넘치면 왼쪽으로 나간다. 양쪽 끝을 모두 본다
    expect(bubbleBox!.x).toBeGreaterThanOrEqual(logBox!.x);
    expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(
      logBox!.x + logBox!.width,
    );

    // 공백만 있으면 보내지 않는다
    await input(pageA).fill("   ");
    await expect(pageA.getByRole("button", { name: "보내기" })).toBeDisabled();

    // 네트워크가 끊긴 채 보내면 실패 → 재시도 → 1건만 저장
    await contextA.setOffline(true);
    await input(pageA).fill("끊긴 상태에서 보냄");
    await pageA.getByRole("button", { name: "보내기" }).click();
    const failed = log(pageA).locator('li[data-status="failed"]');
    await expect(failed).toContainText("보내지 못했어요");
    await contextA.setOffline(false);
    const retry = failed.getByRole("button", { name: "다시 보내기" });
    await retry.click();
    await expect(failed).toHaveCount(0);
    await expect(
      log(pageA).locator('li[data-status="sent"]', {
        hasText: "끊긴 상태에서 보냄",
      }),
    ).toHaveCount(1);
    await expect(log(pageB).getByText("끊긴 상태에서 보냄")).toBeVisible();

    const client = await sessionClient(contextA);
    const { count } = await client
      .from("group_messages")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("body", "끊긴 상태에서 보냄");
    expect(count).toBe(1);

    // 새로고침해도 같은 기록 (중복 없음)
    await pageB.reload();
    for (const body of [
      "안녕하세요 첫 인사예요",
      "반가워요",
      "끊긴 상태에서 보냄",
    ])
      await expect(log(pageB).getByText(body)).toHaveCount(1);

    // 입력창이 화면 안에 있고 가로로 넘치지 않는다
    const viewport = pageB.viewportSize()!;
    const box = await input(pageB).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    const overflow = await pageB.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // 탈퇴하면 채팅방에 들어갈 수 없다
    await pageB.goto(`/groups/${groupId}`);
    // 탈퇴는 한 번 더 묻는다: 아니오면 그대로
    await pageB.getByRole("button", { name: "모임 탈퇴" }).click();
    const confirmLeave = pageB.getByRole("dialog", { name: "모임 탈퇴" });
    await expect(confirmLeave).toContainText("정말 탈퇴하시겠습니까?");
    await confirmLeave.getByRole("button", { name: "아니오" }).click();
    await expect(confirmLeave).toBeHidden();
    await expect(
      pageB.getByRole("link", { name: "단체 채팅방" }),
    ).toBeVisible();
    await pageB.getByRole("button", { name: "모임 탈퇴" }).click();
    await confirmLeave.getByRole("button", { name: "예", exact: true }).click();
    await expect(
      pageB.getByRole("button", { name: "모임 가입" }),
    ).toBeVisible();
    await pageB.goto(`/groups/${groupId}/chat`);
    await expect(pageB.getByText("모임에 가입해야 볼 수 있어요")).toBeVisible();
  } finally {
    await contextB.close();
  }
});

test("없는 모임 주소는 안내를 보여 준다", async ({ page }) => {
  await register(page, "채팅C");
  await page.goto(`/groups/${randomUUID()}/chat`);
  await expect(page.getByText("모임을 찾을 수 없어요")).toBeVisible();
  await page.goto(`/groups/not-a-uuid/chat`);
  await expect(page.getByText("모임을 찾을 수 없어요")).toBeVisible();
});
