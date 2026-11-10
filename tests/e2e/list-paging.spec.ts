import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { register } from "./helpers";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

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

test("커뮤니티와 게시판은 한 쪽에 15개씩, 검색과 쪽 이동", async ({
  page,
  context,
}) => {
  await register(page, "목록");
  const client = await sessionClient(context);
  const token = `찾기${randomUUID().slice(0, 6)}`;
  const main = page.getByRole("main");

  const groups = await client
    .from("groups")
    .insert(
      Array.from({ length: 16 }, (_, i) => ({
        name: `${token} 모임 ${i + 1}`,
        description: i === 0 ? `${token}소개만` : "소개",
      })),
    )
    .select("id");
  expect(groups.error).toBeNull();
  const posts = await client
    .from("posts")
    .insert(
      Array.from({ length: 16 }, (_, i) => ({
        title: `${token} 글 ${i + 1}`,
        body: "본문",
      })),
    )
    .select("id");
  expect(posts.error).toBeNull();

  try {
    // 커뮤니티: 검색창으로 찾는다
    await page.goto("/community");
    await page.getByLabel("모임 검색어").fill(token);
    await page.getByRole("button", { name: "검색" }).click();
    await expect(page).toHaveURL(/\/community\?q=/);
    await expect(main.getByText(/검색 결과/)).toContainText("16");
    const cards = main
      .getByRole("list", { name: "모임 목록" })
      .getByRole("listitem");
    await expect(cards).toHaveCount(15);

    // 2쪽으로 넘어가도 검색어가 유지된다
    await main.getByRole("link", { name: "2", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards).toHaveCount(1);
    await expect(page).toHaveURL(/q=/);

    // 소개 글로도 찾는다
    await page.goto(`/community?q=${encodeURIComponent(`${token}소개만`)}`);
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(`${token} 모임 1`);

    // 없는 검색어, 범위를 넘는 쪽 번호
    await page.goto(`/community?q=${token}없음`);
    await expect(main.getByText("검색 결과가 없어요")).toBeVisible();
    await page.goto(`/community?q=${token}&page=99`);
    await expect(cards).toHaveCount(1);

    // 게시판도 15개씩
    await page.goto(`/board?q=${encodeURIComponent(token)}`);
    await expect(main.getByText(/검색 결과/)).toContainText("16");
    const rows = main.getByRole("link", { name: new RegExp(`${token} 글`) });
    await expect(rows).toHaveCount(15);
    await main.getByRole("link", { name: "2", exact: true }).click();
    await expect(rows).toHaveCount(1);
  } finally {
    await client
      .from("groups")
      .delete()
      .in(
        "id",
        (groups.data ?? []).map((g) => g.id),
      );
    await client
      .from("posts")
      .delete()
      .in(
        "id",
        (posts.data ?? []).map((p) => p.id),
      );
  }
});
