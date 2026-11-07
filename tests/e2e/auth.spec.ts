import { expect, test, type Page } from "@playwright/test";

async function fillSignup(page: Page, email: string, nickname: string) {
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-nickname").fill(nickname);
  await page.locator("#signup-password").fill("Tea-reader-123!");
  await page.locator("#signup-passwordConfirmation").fill("Tea-reader-123!");
  const signup = page.locator("form:visible");
  await signup
    .getByLabel("개인정보 수집·이용에 동의합니다.", { exact: false })
    .check();
  await signup.getByLabel("만 14세 이상입니다.", { exact: false }).check();
}

test("가입·로그인·세션 갱신·로그아웃과 중복 가입을 처리한다", async ({
  page,
  context,
}, info) => {
  const suffix = `${Date.now()}${info.project.name === "mobile" ? "m" : "d"}`;
  const email = `auth-${suffix}@example.com`;
  const nickname = `차읽기${suffix}`;
  await page.goto("/me/reading?sort=recent");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole("link", { name: "회원가입", exact: true }).click();
  await fillSignup(page, email, nickname);

  // 문서 확인은 새 창으로 열려 작성 중인 입력값을 보존한다.
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "개인정보처리방침 (새 창)" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/privacy$/);
  await popup.close();
  await expect(
    page.locator("form:visible").getByLabel("이메일", { exact: true }),
  ).toHaveValue(email);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL("/me/reading?sort=recent");
  await page.reload();
  await expect(page).toHaveURL("/me/reading?sort=recent");

  // 만료 시각을 지난 쿠키가 로그인 페이지에서 갱신돼도 리다이렉트에 쿠키를 보존한다.
  const cookies = await context.cookies();
  const authCookie = cookies.find((cookie) => /auth-token$/.test(cookie.name));
  expect(authCookie).toBeTruthy();
  const session = JSON.parse(
    Buffer.from(
      authCookie!.value.replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  );
  session.expires_at = Math.floor(Date.now() / 1000) - 120;
  await context.addCookies([
    {
      ...authCookie!,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    },
  ]);
  await page.goto("/login?next=/mypage");
  await expect(page).toHaveURL("/mypage");
  const refreshed = (await context.cookies()).find(
    (cookie) => cookie.name === authCookie!.name,
  )!;
  const refreshedSession = JSON.parse(
    Buffer.from(
      refreshed.value.replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  );
  expect(refreshedSession.expires_at).toBeGreaterThan(
    Math.floor(Date.now() / 1000),
  );

  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL("/login?loggedOut=1");
  await page.goto("/groups/123/chat?from=invite");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page
    .locator("form:visible")
    .getByLabel("이메일", { exact: true })
    .fill(email);
  await page
    .locator("form:visible")
    .getByLabel("비밀번호", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.locator("form:visible").getByRole("alert")).toContainText(
    "이메일 또는 비밀번호",
  );
  await expect(
    page.locator("form:visible").getByLabel("이메일", { exact: true }),
  ).toHaveValue(email);
  await page
    .locator("form:visible")
    .getByLabel("비밀번호", { exact: true })
    .fill("Tea-reader-123!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("/groups/123/chat?from=invite");
  await page.goto("/mypage");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL("/login?loggedOut=1");

  await page.goto("/signup");
  await fillSignup(page, `new-${suffix}@example.com`, nickname);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByText("이미 사용 중인 닉네임이에요.")).toBeVisible();
  await page
    .locator("form:visible")
    .getByLabel("닉네임", { exact: true })
    .fill(`새${suffix}`);
  await page
    .locator("form:visible")
    .getByLabel("이메일", { exact: true })
    .fill(email);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.locator("form:visible").getByRole("alert")).toContainText(
    "이미 가입된 이메일",
  );
});

test("검증·연결 실패·재시도와 작은 화면 접근성을 확인한다", async ({
  page,
}, info) => {
  await page.goto("/signup?next=//evil.example");
  await fillSignup(page, "reader@example.com", "검증용닉네임");
  await page
    .getByLabel("비밀번호 확인", { exact: true })
    .fill("different-password");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByText("비밀번호가 일치하지 않아요.")).toBeVisible();
  await expect(page.locator('input[name="privacyConsent"]')).toBeChecked();
  await expect(page.locator('input[name="ageConfirmed"]')).toBeChecked();
  await page.locator("#signup-email").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#signup-nickname")).toBeFocused();
  await expect(
    page.locator("form:visible").getByLabel("비밀번호 확인", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();

  await page.screenshot({
    path: info.outputPath("signup.png"),
    fullPage: true,
  });
  await page.goto("/login?next=https://evil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
  await page
    .locator("form:visible")
    .getByLabel("이메일", { exact: true })
    .fill("reader@example.com");
  await page
    .locator("form:visible")
    .getByLabel("비밀번호", { exact: true })
    .fill("kept-password");
  await page.route("**/login?**", async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.locator("form:visible").getByRole("alert")).toContainText(
    "인증 서비스에 연결하지 못했어요",
  );
  await expect(
    page.locator("form:visible").getByLabel("비밀번호", { exact: true }),
  ).toHaveValue("kept-password");
  await expect(
    page.getByRole("button", { name: "로그인", exact: true }),
  ).toBeEnabled();
  await page.unrouteAll();

  await page.goto("/groups/private.png");
  await expect(page).toHaveURL(/\/login\?next=/);
  for (const path of ["/guide", "/terms", "/privacy"]) {
    await page.goto(path);
    await expect(page).toHaveURL(path);
  }
});

test("위조한 세션 쿠키로 보호 페이지에 접근할 수 없다", async ({
  page,
  context,
}) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const userId = "00000000-0000-4000-8000-000000000001";
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    exp: expiresAt,
    iss: "http://127.0.0.1:54321/auth/v1",
  })}.${Buffer.from("forged-signature").toString("base64url")}`;
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${encode({
        access_token: token,
        refresh_token: "forged-refresh-token",
        token_type: "bearer",
        expires_at: expiresAt,
        expires_in: 3600,
        user: { id: userId, aud: "authenticated", role: "authenticated" },
      })}`,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/mypage");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
});
