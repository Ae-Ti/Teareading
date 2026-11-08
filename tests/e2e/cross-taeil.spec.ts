import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";

// D6 교차 테스트(개발계획 5.5) — 태일 담당 기능을 웅싯이 확인한다. D7 스모크 테스트로도 쓴다.

async function register(page: Page, label: string) {
  const suffix = randomUUID().slice(0, 8);
  await page.goto("/signup?next=/dashboard");
  const form = page.locator("form:visible");
  await form
    .getByLabel("이메일", { exact: true })
    .fill(`ui-cross-${suffix}@example.com`);
  await form.getByLabel("닉네임", { exact: true }).fill(`${label}${suffix}`);
  await form.getByLabel("비밀번호", { exact: true }).fill("Cross-reader-123!");
  await form
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("Cross-reader-123!");
  await form
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await form.getByLabel("만 14세 이상입니다.", { exact: false }).check();
  await form.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
}

async function newPage(browser: Browser, info: TestInfo) {
  const context = await browser.newContext({
    ...info.project.use,
    baseURL: "http://127.0.0.1:3100",
  });
  return context.newPage();
}

test("타이머: 새로고침·다른 탭 유지, 두 번 시작 차단, 1분 내 완료=중단, 자동 완료, 출석", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await register(page, "교차T");
  const other = await context.newPage();
  await other.goto("/dashboard");

  // 하이드레이션 전 클릭은 무시될 수 있어 선택이 반영될 때까지 다시 누른다
  const reading = page.getByRole("radio", { name: /독서/ });
  await expect(async () => {
    await reading.click();
    await expect(reading).toBeChecked({ timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: "15분" }).click();
  await page.getByRole("button", { name: "독서 15분 시작" }).click();
  await expect(page.getByRole("button", { name: "완료" })).toBeVisible();

  // 새로고침해도 서버의 시작 시각 기준으로 이어진다
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("button", { name: "완료" })).toBeVisible();

  // 시작 전 화면을 열어 둔 다른 탭에서 또 시작하면 기존 타이머로 안내
  await expect(other.getByRole("button", { name: /분 시작$/ })).toBeEnabled();
  await other.getByRole("button", { name: /분 시작$/ }).click();
  await expect(other.locator("main").getByRole("alert")).toContainText(
    "이미 진행 중인 타이머",
  );
  await expect(other.getByRole("button", { name: "완료" })).toBeVisible();

  // 1분 안에 누른 완료는 중단으로 기록된다(0초 출석 방지, 태일 정책). 연타해도 결과는 하나
  await page.getByRole("button", { name: "완료" }).dblclick();
  await expect(page.getByText("잠시 멈췄어요")).toHaveCount(1);
  // 중단만 있는 날은 미출석
  await page.goto("/attendance");
  await expect(page.getByText("아직 출석 전")).toBeVisible();

  // 목표 시간(1분)에 닿으면 자동 완료 → 출석
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "직접 입력" }).click();
  await page.getByLabel("직접 입력 (분)").fill("1");
  await page.getByRole("button", { name: /1분 시작$/ }).click();
  await expect(page.getByRole("button", { name: "완료" })).toBeVisible();
  await expect(page.getByText("수고했어요")).toBeVisible({ timeout: 80_000 });
  await page.goto("/attendance");
  await expect(page.getByText("출석 완료 ✓")).toBeVisible();
  await other.close();
});

test("독서기록: 작성·필수값·다른 계정 URL 접근 차단", async ({
  page,
  browser,
}, info) => {
  await register(page, "교차R");
  await page.goto("/me/reading/new");
  await page.getByRole("button", { name: "저장" }).click();
  // 필수값 누락이면 저장되지 않는다
  await expect(page).toHaveURL("/me/reading/new");

  await page.getByLabel("책 제목").fill("데미안");
  await page.getByLabel("기록").fill("새는 알에서 나오려고 투쟁한다.");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page).toHaveURL(/\/me\/reading\/[0-9a-f-]{36}$/);
  const url = new URL(page.url()).pathname;

  const intruder = await newPage(browser, info);
  await register(intruder, "교차X");
  const res = await intruder.goto(url);
  await expect(intruder.getByText("기록을 찾을 수 없어요")).toBeVisible();
  expect(await res!.text()).not.toContain("새는 알에서");
  await intruder.context().close();
});

test("가이드: 로그아웃 상태 열람·없는 주소", async ({ page }) => {
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { name: "다도 입문 가이드" }),
  ).toBeVisible();
  await page.goto("/guide/brewing-basics");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "차 우리는 기본 순서",
  );
  await page.goto(`/guide/${randomUUID()}`);
  await expect(
    page.locator("main").getByText("가이드를 찾을 수 없어요"),
  ).toBeVisible();
});

test("찻집: 두 계정 동시 입장 → 함께 → 한쪽 나가면 혼자", async ({
  page,
  browser,
}, info) => {
  await register(page, "교차S");
  const b = await newPage(browser, info);
  await register(b, "교차S2");

  await page.goto("/space");
  await page.getByRole("button", { name: "찻집 입장" }).click();
  await expect(page.getByText("혼자 있어요")).toBeVisible({ timeout: 15_000 });

  await b.goto("/space");
  await b.getByRole("button", { name: "찻집 입장" }).click();
  await expect(page.getByText("1명과 함께 있어요")).toBeVisible({
    timeout: 15_000,
  });
  await expect(b.getByText("1명과 함께 있어요")).toBeVisible({
    timeout: 15_000,
  });

  await b.context().close();
  await expect(page.getByText("혼자 있어요")).toBeVisible({ timeout: 30_000 });
});
