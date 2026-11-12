import { expect, test } from "@playwright/test";
import { newUserPage } from "./helpers";
import {
  admin,
  befriend,
  collect,
  inspect,
  login,
  makeUser,
  report,
  type Issue,
  type SeedUser,
} from "./seed";

// 고도화 시험 1: 모든 화면을 손님·주인·친구·모르는 사람으로 돌며
// 서버 오류·화면 오류·콘솔 오류·가로 넘침·접근성(axe)을 한꺼번에 검사한다.
// 접근성은 axe critical·serious(대비 포함)를 실패로, 그 아래는 보고만 한다.

const SECRET = "비밀본문-사적인기록";

type Seed = {
  owner: SeedUser;
  friend: SeedUser;
  stranger: SeedUser;
  post: string;
  group: string;
  column: string;
  privateColumn: string;
  reading: string;
  privateReading: string;
  book: string;
  thread: string;
};

async function seed(): Promise<Seed> {
  const [owner, friend, stranger] = await Promise.all([
    makeUser("주인"),
    makeUser("친구"),
    makeUser("남"),
  ]);
  await befriend(owner.id, friend.id);
  const one = async (
    q: PromiseLike<{ data: { id: string } | null; error: unknown }>,
  ) => {
    const { data, error } = await q;
    if (error || !data) throw error ?? new Error("seed failed");
    return data;
  };
  const post = await one(
    admin
      .from("posts")
      .insert({
        author_id: owner.id,
        category: "tea",
        title: "순회 시험 글",
        body: "본문입니다",
      })
      .select("id")
      .single(),
  );
  const group = await one(
    admin
      .from("groups")
      .insert({ name: "순회 모임", owner_id: owner.id })
      .select("id")
      .single(),
  );
  await admin
    .from("group_members")
    .upsert({ group_id: group.id, user_id: owner.id, role: "owner" });
  await admin.from("group_messages").insert({
    group_id: group.id,
    sender_id: owner.id,
    body: "안녕하세요",
    client_id: crypto.randomUUID(),
  });
  const column = await one(
    admin
      .from("tea_columns")
      .insert({
        user_id: owner.id,
        title: "공개 칼럼",
        body: "공개 본문",
        tea_type: "green",
        is_public: true,
      })
      .select("id")
      .single(),
  );
  const privateColumn = await one(
    admin
      .from("tea_columns")
      .insert({
        user_id: owner.id,
        title: "비공개 칼럼",
        body: SECRET,
        tea_type: "black",
        is_public: false,
      })
      .select("id")
      .single(),
  );
  const book = await one(
    admin
      .from("books")
      .insert({ user_id: owner.id, title: "순회 책", status: "reading" })
      .select("id")
      .single(),
  );
  const reading = await one(
    admin
      .from("reading_logs")
      .insert({
        user_id: owner.id,
        book_title: "순회 책",
        body: "공개 독서록",
        book_id: book.id,
        pages_read: 10,
        is_public: true,
      })
      .select("id")
      .single(),
  );
  const privateReading = await one(
    admin
      .from("reading_logs")
      .insert({
        user_id: owner.id,
        book_title: "순회 책",
        body: SECRET,
        book_id: book.id,
        pages_read: 5,
        is_public: false,
      })
      .select("id")
      .single(),
  );
  const [user_a, user_b] =
    owner.id < friend.id ? [owner.id, friend.id] : [friend.id, owner.id];
  const thread = await one(
    admin.from("dm_threads").insert({ user_a, user_b }).select("id").single(),
  );
  await admin.from("dm_messages").insert({
    thread_id: thread.id,
    sender_id: owner.id,
    body: "친구야 안녕",
    client_id: crypto.randomUUID(),
  });
  return {
    owner,
    friend,
    stranger,
    post: post.id,
    group: group.id,
    column: column.id,
    privateColumn: privateColumn.id,
    reading: reading.id,
    privateReading: privateReading.id,
    book: book.id,
    thread: thread.id,
  };
}

const PUBLIC = [
  "/",
  "/login",
  "/signup",
  "/guide",
  "/guide/brewing-basics",
  "/guide/no-such-guide",
  "/privacy",
  "/terms",
  "/goodbye",
];

const ownerRoutes = (s: Seed) => [
  "/dashboard",
  "/attendance",
  "/board",
  "/board/new",
  `/board/${s.post}`,
  `/board/${s.post}/edit`,
  "/community",
  "/groups/new",
  `/groups/${s.group}`,
  `/groups/${s.group}/chat`,
  "/dm",
  `/dm/${s.thread}`,
  "/me",
  "/me/stats",
  "/me/reading",
  "/me/reading/new",
  `/me/reading/${s.reading}`,
  `/me/reading/${s.reading}/edit`,
  "/me/columns",
  "/me/columns/new",
  `/me/columns/${s.column}`,
  `/me/columns/${s.column}/edit`,
  `/me/books/${s.book}`,
  "/mypage",
  "/mypage/edit",
  "/mypage/settings",
  "/mypage/delete",
  "/space",
  `/u/${s.owner.id}`,
  `/u/${s.owner.id}/columns/${s.column}`,
  `/u/${s.owner.id}/reading/${s.reading}`,
];

// 실패로 보는 문제: 서버·화면 오류, 넘침, 이미지 대체 글·lang 없음, axe critical·serious.
// h1 없음과 axe moderate 이하는 보고만 한다.
const blocking = (i: Issue) =>
  i.kind === "a11y:h1"
    ? false
    : !i.kind.startsWith("axe:") ||
      i.kind === "axe:critical" ||
      i.kind === "axe:serious";

let s: Seed;
test.beforeAll(async () => {
  s = await seed();
});

test("품질 순회: 손님으로 공개 화면과 보호 화면", async ({ page }) => {
  test.setTimeout(300_000);
  const { issues, state } = collect(page);
  for (const path of [...PUBLIC, ...ownerRoutes(s)]) {
    state.path = path;
    const res = await page.goto(path);
    if (res && res.status() >= 500)
      issues.push({ path, kind: "5xx", detail: String(res.status()) });
    const at = new URL(page.url());
    if (!PUBLIC.includes(path)) {
      // 보호 화면은 로그인으로 보내야 하고, 돌아올 곳은 이 사이트 안이어야 한다
      if (at.pathname !== "/login" && at.pathname !== "/signup")
        issues.push({
          path,
          kind: "guard",
          detail: `손님에게 열림: ${at.pathname}`,
        });
      continue;
    }
    issues.push(...(await inspect(page, path)));
  }
  report("손님", issues);
  expect(issues.filter(blocking)).toEqual([]);
});

test("품질 순회: 주인으로 모든 화면", async ({ page }) => {
  test.setTimeout(600_000);
  await login(page, s.owner);
  const { issues, state } = collect(page);
  for (const path of ownerRoutes(s)) {
    state.path = path;
    const res = await page.goto(path);
    if (res && res.status() >= 500)
      issues.push({ path, kind: "5xx", detail: String(res.status()) });
    await page.waitForLoadState("load");
    issues.push(...(await inspect(page, path)));
  }
  report("주인", issues);
  expect(issues.filter(blocking)).toEqual([]);
});

test("남의 기록: 친구·모르는 사람은 비공개 글과 남의 수정 화면을 볼 수 없다", async ({
  browser,
}, info) => {
  test.setTimeout(300_000);
  const leaks: string[] = [];
  for (const viewer of [s.friend, s.stranger]) {
    const page = await newUserPage(browser, info);
    await login(page, viewer);
    const { issues, state } = collect(page);
    const paths = [
      `/u/${s.owner.id}/columns/${s.privateColumn}`,
      `/u/${s.owner.id}/reading/${s.privateReading}`,
      `/me/columns/${s.privateColumn}`,
      `/me/columns/${s.privateColumn}/edit`,
      `/me/reading/${s.privateReading}`,
      `/me/reading/${s.privateReading}/edit`,
      `/me/books/${s.book}`,
      `/board/${s.post}/edit`,
      `/dm/${s.thread}`,
      `/space/room/${s.owner.id}`,
      `/u/${s.owner.id}`,
    ];
    for (const path of paths) {
      state.path = path;
      const res = await page.goto(path);
      const html = (await res?.text()) ?? "";
      const shown = await page.locator("body").innerText();
      if (html.includes(SECRET) || shown.includes(SECRET))
        leaks.push(`${viewer.nickname}: ${path} 비공개 본문 노출`);
      if (
        path === `/board/${s.post}/edit` &&
        new URL(page.url()).pathname === path
      ) {
        if (await page.getByRole("button", { name: /저장|수정/ }).count())
          leaks.push(`${viewer.nickname}: 남의 글 수정 화면 열림`);
      }
      if (
        path === `/dm/${s.thread}` &&
        viewer === s.stranger &&
        shown.includes("친구야 안녕")
      )
        leaks.push(`${viewer.nickname}: 남의 1:1 대화 노출`);
    }
    // 친구만 방에 들어간다
    await page.goto(`/space/room/${s.owner.id}`);
    const inRoom = await page.locator("canvas").count();
    if (viewer === s.friend && !inRoom) leaks.push("친구가 방에 못 들어감");
    if (viewer === s.stranger && inRoom)
      leaks.push("모르는 사람이 방에 들어감");
    report(`방문자 ${viewer === s.friend ? "친구" : "모르는 사람"}`, issues);
    expect(issues.filter((i) => i.kind !== "console")).toEqual([]);
    await page.context().close();
  }
  console.log(
    leaks.length ? `\n[노출]\n  ${leaks.join("\n  ")}` : "\n[노출] 없음",
  );
  expect(leaks).toEqual([]);
});
