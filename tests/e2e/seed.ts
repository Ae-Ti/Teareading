import { execSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// 고도화 시험용 공통 도구: 관리자 키로 데이터를 만들고, 화면 품질을 검사한다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
// 관리자 키: 환경 변수 → supabase status(도커) → 로컬 기본 비밀값으로 직접 서명 순으로 찾는다.
// 도커 CLI가 멈춰도 시험이 멈추지 않도록 status는 10초만 기다린다.
function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY)
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    return (
      JSON.parse(
        execSync("npx --no-install supabase status -o json", {
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 10_000,
        }).toString(),
      ) as { SERVICE_ROLE_KEY: string }
    ).SERVICE_ROLE_KEY;
  } catch {
    if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(SUPABASE_URL))
      throw new Error(
        "로컬 Supabase가 아니면 SUPABASE_SERVICE_ROLE_KEY가 필요합니다",
      );
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase-demo", role: "service_role", exp: 1983812996 })}`;
    const sig = createHmac(
      "sha256",
      "super-secret-jwt-token-with-at-least-32-characters-long",
    )
      .update(body)
      .digest("base64url");
    return `${body}.${sig}`;
  }
}
export const admin = createClient<Database>(SUPABASE_URL, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const PASSWORD = "Reader-test-123!";

export type SeedUser = { id: string; email: string; nickname: string };

export async function makeUser(label: string): Promise<SeedUser> {
  const suffix = randomUUID().slice(0, 8);
  const email = `seed-${suffix}@example.com`;
  const nickname = `${label}${suffix}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nickname },
  });
  if (error) throw error;
  return { id: data.user.id, email, nickname };
}

export async function login(page: Page, user: SeedUser, next = "/dashboard") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  const form = page.locator("form:visible");
  await form.getByLabel("이메일", { exact: true }).fill(user.email);
  await form.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  // 느린 망 시험에서도 쓰므로 넉넉히 기다린다
  await expect(page).toHaveURL(new RegExp(`127\\.0\\.0\\.1:3100${next}$`), {
    timeout: 30_000,
  });
}

/** 사용자 토큰으로 움직이는 클라이언트 (브라우저 없이 API를 직접 부르는 사람) */
export async function userClient(user: SeedUser) {
  const c = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
  });
  if (error) throw error;
  return c;
}

export async function befriend(a: string, b: string) {
  const [user_a, user_b] = a < b ? [a, b] : [b, a];
  const { error } = await admin.from("friendships").insert({ user_a, user_b });
  if (error) throw error;
}

/** 화면 하나에서 나온 문제 */
export type Issue = { path: string; kind: string; detail: string };

const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

// 개발 중 흔히 나오는, 사용자에게 영향이 없는 콘솔 소리는 뺀다
const NOISE = [
  /Download the React DevTools/,
  /favicon/,
  /WebSocket/i, // 실시간 재연결 중 일시 경고
];

/** 페이지에 붙여 두고 오류를 모은다. 화면 이동마다 path를 바꿔 준다. */
export function collect(page: Page) {
  const issues: Issue[] = [];
  const state = { path: "" };
  page.on("pageerror", (e) =>
    issues.push({
      path: state.path,
      kind: "pageerror",
      detail: e.message.slice(0, 200),
    }),
  );
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (NOISE.some((n) => n.test(text))) return;
    issues.push({
      path: state.path,
      kind: "console",
      detail: text.slice(0, 200),
    });
  });
  page.on("response", (r) => {
    if (r.status() >= 500 && r.url().startsWith("http://127.0.0.1:3100"))
      issues.push({
        path: state.path,
        kind: "5xx",
        detail: `${r.status()} ${new URL(r.url()).pathname}`,
      });
  });
  return { issues, state };
}

/** 지금 화면의 품질: 넘침·오류 화면·접근성(axe)·이미지 대체 글·제목 */
export async function inspect(page: Page, path: string): Promise<Issue[]> {
  const out: Issue[] = [];
  const add = (kind: string, detail: string) =>
    out.push({ path, kind, detail });
  // 스트리밍 중인 화면(불러오는 중 상자)이 다 그려질 때까지 기다린다
  await page
    .waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
      null,
      {
        timeout: 10_000,
      },
    )
    .catch(() => add("loading", "10초 넘게 불러오는 중"));

  if (
    await page
      .getByText(
        /Application error|This page couldn.t load|Something went wrong/,
      )
      .count()
  )
    add("crash", "오류 화면");

  const overflow = await page.evaluate(() => {
    const w = window.innerWidth;
    if (document.documentElement.scrollWidth <= w) return null;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > w + 1)
      .filter((el) => getComputedStyle(el).position !== "fixed")
      .slice(0, 3)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : ""}`,
      );
    return `${document.documentElement.scrollWidth}px > ${w}px (${wide.join(", ")})`;
  });
  if (overflow) add("overflow", overflow);

  const basics = await page.evaluate(() => ({
    title: document.title.trim(),
    h1: document.querySelectorAll("h1").length,
    noAlt: [...document.images]
      .filter((i) => !i.hasAttribute("alt"))
      .map((i) => i.src.slice(-60)),
    lang: document.documentElement.lang,
  }));
  if (!basics.title) add("a11y", "문서 제목 없음");
  if (basics.h1 === 0) add("a11y:h1", "h1 없음"); // 보고만 한다
  if (!basics.lang) add("a11y", "html lang 없음");
  for (const src of basics.noAlt) add("a11y", `img alt 없음: ${src}`);

  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe는 위에서 주입했다
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      resultTypes: ["violations"],
    });
    return (
      r.violations as {
        id: string;
        impact: string;
        nodes: { target: string[] }[];
      }[]
    ).map((v) => ({
      id: v.id,
      impact: v.impact,
      n: v.nodes.length,
      target: v.nodes[0]?.target.join(" ") ?? "",
    }));
  });
  for (const v of violations)
    add(`axe:${v.impact}`, `${v.id} ×${v.n} (${v.target.slice(0, 80)})`);
  return out;
}

export function report(title: string, issues: Issue[]) {
  if (!issues.length) {
    console.log(`\n[${title}] 문제 없음`);
    return;
  }
  const byKind = new Map<string, Issue[]>();
  for (const i of issues)
    byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);
  const lines = [`\n[${title}] 문제 ${issues.length}건`];
  for (const [kind, list] of byKind) {
    lines.push(`  ■ ${kind} (${list.length})`);
    for (const i of list) lines.push(`    ${i.path}  ${i.detail}`);
  }
  console.log(lines.join("\n"));
}
