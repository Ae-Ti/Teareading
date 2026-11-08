import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newUserPage, register } from "./helpers";

test("게시판: 글쓰기·목록(작성자·날짜·조회·추천)·추천·댓글·검색·수정·삭제", async ({
  page,
  browser,
}, info) => {
  page.on("dialog", (d) => void d.accept());
  const writer = await register(page, "글쓴이");
  const reader = await newUserPage(browser, info);
  const readerName = await register(reader, "독자");
  const title = `우전 녹차 추천해요 ${randomUUID().slice(0, 6)}`;

  // 메뉴에서 게시판으로
  await page.getByRole("link", { name: "게시판" }).first().click();
  await expect(page).toHaveURL("/board");
  await page.getByRole("link", { name: "글쓰기" }).click();
  await expect(page).toHaveURL("/board/new");

  // 필수값 누락
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page.getByText("제목은 2~100자로 입력해 주세요.")).toBeVisible();

  await page.locator("label", { hasText: "차 이야기" }).click();
  await expect(page.getByRole("radio", { name: "차 이야기" })).toBeChecked();
  await page.getByLabel("제목").fill(title);
  await page
    .getByLabel("내용")
    .fill("첫물 우전은 70도에서 1분.\n향이 정말 좋아요.");
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page).toHaveURL(/\/board\/[0-9a-f-]{36}$/);
  const postUrl = new URL(page.url()).pathname;
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await expect(page.getByText("차 이야기").first()).toBeVisible();
  // 내 글은 추천할 수 없다
  await expect(page.getByRole("button", { name: /추천 0/ })).toBeDisabled();

  // 다른 사람이 목록에서 작성자·날짜를 보고 들어간다
  await reader.goto("/board");
  const row = reader.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText(writer);
  await expect(row.getByRole("time")).toBeVisible();
  await row.getByRole("link", { name: new RegExp(title) }).click();
  await expect(reader).toHaveURL(postUrl);
  await expect(reader.getByText("향이 정말 좋아요.")).toBeVisible();

  // 추천 → 숫자 증가, 다시 누르면 취소
  const like = reader.getByRole("button", { name: /추천 \d/ });
  await like.click();
  await expect(reader.getByRole("button", { name: "추천 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await reader.getByRole("button", { name: "추천 1" }).click();
  await expect(reader.getByRole("button", { name: "추천 0" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await reader.getByRole("button", { name: "추천 0" }).click();
  await expect(reader.getByRole("button", { name: "추천 1" })).toBeVisible();

  // 댓글
  await reader.getByLabel("댓글 입력").fill("저도 우전 좋아해요!");
  await reader.getByRole("button", { name: "댓글 등록" }).click();
  await expect(reader.getByText("저도 우전 좋아해요!")).toBeVisible();
  await expect(reader.getByLabel("댓글 입력")).toHaveValue("");
  await expect(reader.getByRole("heading", { name: "댓글 1" })).toBeVisible();

  // 목록: 댓글 수·조회·추천이 반영되고 검색된다
  await page.goto(`/board?q=${encodeURIComponent(title.slice(-6))}`);
  const mine = page.getByRole("listitem").filter({ hasText: title });
  await expect(mine).toContainText("[1]");
  await expect(page.getByText(/검색 결과/)).toBeVisible();
  await page.goto(`/board?field=author&q=${encodeURIComponent(writer)}`);
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toBeVisible();
  await page.goto(`/board?q=없는검색어${randomUUID().slice(0, 4)}`);
  await expect(page.getByText("검색 결과가 없어요")).toBeVisible();
  await page.goto("/board?sort=likes&category=tea");
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toBeVisible();

  // 다른 사람은 수정 화면에 들어갈 수 없다
  await reader.goto(`${postUrl}/edit`);
  await expect(reader.getByText("작성자만 수정할 수 있어요")).toBeVisible();
  void readerName;

  // 수정 → (수정됨), 삭제 → 목록에서 사라짐
  await page.goto(postUrl);
  await expect(page.getByText(/조회 \d/)).toBeVisible();
  await page.getByRole("link", { name: "수정" }).click();
  await page.getByLabel("제목").fill(`${title} (후기 추가)`);
  await page.getByRole("button", { name: "수정 저장" }).click();
  await expect(page).toHaveURL(postUrl);
  await expect(page.getByText("(수정됨)")).toBeVisible();
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL("/board");
  await expect(
    page.getByRole("listitem").filter({ hasText: title }),
  ).toHaveCount(0);
  await reader.goto(postUrl);
  await expect(reader.getByText("글을 찾을 수 없어요")).toBeVisible();
  await reader.context().close();
});
