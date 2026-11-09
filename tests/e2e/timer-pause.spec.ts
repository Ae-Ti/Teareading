import { expect, test } from "@playwright/test";
import { register } from "./helpers";

test("일시정지: 멈춤 유지·새로고침·다른 탭·이어서 하기·자동 완료", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await register(page, "일시정지", "/dashboard");

  const clock = page.getByRole("timer");
  const pauseButton = page.getByRole("button", { name: "일시정지" });
  const resumeButton = page.getByRole("button", { name: "이어서 하기" });

  await expect(page.getByRole("button", { name: /분 시작$/ })).toBeEnabled();
  await page.getByRole("button", { name: "직접 입력" }).click();
  await page.getByLabel("직접 입력 (분)").fill("1");
  await page.getByRole("button", { name: /1분 시작$/ }).click();
  await expect(pauseButton).toBeVisible();

  // 시작 후 열어 둔 다른 탭: 아직 멈춤을 모른다
  const stale = await context.newPage();
  await stale.goto("/dashboard");
  await expect(stale.getByRole("button", { name: "일시정지" })).toBeVisible();

  await pauseButton.dblclick();
  await expect(resumeButton).toBeVisible();
  await expect(page.getByText("일시정지 · 다도")).toBeVisible();
  const frozen = await clock.textContent();
  await page.waitForTimeout(2500);
  await expect(clock).toHaveText(frozen!);

  // 새로고침해도 남은 시간이 그대로다
  await page.reload();
  await expect(resumeButton).toBeVisible();
  await expect(clock).toHaveText(frozen!);

  // 오래된 탭에서 눌러도 한 번만 반영되고 멈춘 상태로 맞춰진다
  await stale.getByRole("button", { name: "일시정지" }).click();
  await expect(
    stale.getByRole("button", { name: "이어서 하기" }),
  ).toBeVisible();
  await expect(stale.getByRole("timer")).toHaveText(frozen!);
  await stale.close();

  // 멈춘 동안 다른 타이머는 시작 버튼 자체가 없다
  await expect(page.getByRole("button", { name: /분 시작$/ })).toHaveCount(0);

  // 이어서 하면 남은 시간부터 줄어든다
  await resumeButton.click();
  await expect(pauseButton).toBeVisible();
  await expect(clock).not.toHaveText(frozen!, { timeout: 3000 });
  await page.waitForTimeout(500);
  const [mm, ss] = (await clock.textContent())!.split(":").map(Number);
  const [fm, fs] = frozen!.split(":").map(Number);
  expect(fm * 60 + fs - (mm * 60 + ss)).toBeLessThan(6);

  // 멈춘 시간을 뺀 목표 시간에 닿으면 자동 완료 → 출석
  await expect(page.getByText("수고했어요")).toBeVisible({ timeout: 80_000 });
  await page.goto("/attendance");
  await expect(page.getByText("출석 완료 ✓")).toBeVisible();
});

test("일시정지: 멈춘 채로 중단하면 멈춘 시각까지만 기록된다", async ({
  page,
}) => {
  await register(page, "멈춤중단", "/dashboard");
  await expect(page.getByRole("button", { name: /분 시작$/ })).toBeEnabled();
  await page.getByRole("button", { name: /25분 시작$/ }).click();
  await page.getByRole("button", { name: "일시정지" }).click();
  await expect(page.getByRole("button", { name: "이어서 하기" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "중단" }).click();
  await expect(page.getByText("이번엔 여기까지")).toBeVisible();
  await expect(page.getByText(/다도 \d초 했어요/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(overflow).toBeTruthy();
});
