import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { cacheLife } from "next/cache";

// 가이드 콘텐츠는 content/guide/*.md 파일이다. 파일명 앞 번호가 노출 순서, 번호 뒤가 주소(slug).
const DIR = path.join(process.cwd(), "content", "guide");

export type GuideMeta = {
  slug: string;
  order: number;
  title: string;
  summary: string;
  minutes: number;
};

function parse(file: string, raw: string) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`가이드 머리말이 없어요: ${file}`);

  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  const [, order, slug] = /^(\d+)-(.+)\.md$/.exec(file) ?? [];

  const meta: GuideMeta = {
    slug,
    order: Number(order),
    title: fields.title,
    summary: fields.summary,
    minutes: Number(fields.minutes) || 3,
  };
  return { meta, body: match[2] };
}

async function readAll() {
  const files = (await readdir(DIR)).filter((f) => /^\d+-.+\.md$/.test(f));
  const guides = await Promise.all(
    files.map(async (f) => parse(f, await readFile(path.join(DIR, f), "utf8"))),
  );
  return guides.sort((a, b) => a.meta.order - b.meta.order);
}

// 가이드는 배포할 때만 바뀌므로 오래 캐시한다
export async function listGuides(): Promise<GuideMeta[]> {
  "use cache";
  cacheLife("max");
  return (await readAll()).map((g) => g.meta);
}

export async function getGuide(slug: string) {
  "use cache";
  cacheLife("max");
  const guide = (await readAll()).find((g) => g.meta.slug === slug);
  if (!guide) return null;
  // 콘텐츠는 저장소 안의 파일이라 신뢰할 수 있다. 이용자 입력을 이 함수로 렌더링하지 않는다.
  return { meta: guide.meta, html: await marked.parse(guide.body) };
}

// 날짜마다 다른 가이드 하나 (대시보드 "오늘의 다도 가이드")
export async function guideOfDay(day: string) {
  const guides = await listGuides();
  const n = Number(day.replaceAll("-", ""));
  return guides[n % guides.length] ?? null;
}
