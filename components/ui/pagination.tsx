import Link from "next/link";
import { cn } from "./cn";

// 페이지 번호: 현재 기준 앞뒤 2쪽 + 처음·끝
export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  const current = Math.min(page, pages);
  const start = Math.max(1, current - 2);
  const end = Math.min(pages, current + 2);
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const item =
    "flex h-9 min-w-9 items-center justify-center rounded-md border-2 px-2 text-sm font-bold";
  return (
    <nav aria-label="페이지" className="flex flex-wrap justify-center gap-1.5">
      {current > 1 && (
        <Link
          href={hrefFor(current - 1)}
          className={cn(item, "border-ink bg-surface")}
          aria-label="이전 페이지"
        >
          ‹
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={hrefFor(1)} className={cn(item, "border-transparent")}>
            1
          </Link>
          {start > 2 && <span className="self-center text-ink-subtle">…</span>}
        </>
      )}
      {nums.map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          aria-current={n === current ? "page" : undefined}
          className={cn(
            item,
            n === current
              ? "border-ink bg-matcha"
              : "border-transparent hover:bg-sunken",
          )}
        >
          {n}
        </Link>
      ))}
      {end < pages && (
        <>
          {end < pages - 1 && (
            <span className="self-center text-ink-subtle">…</span>
          )}
          <Link
            href={hrefFor(pages)}
            className={cn(item, "border-transparent")}
          >
            {pages}
          </Link>
        </>
      )}
      {current < pages && (
        <Link
          href={hrefFor(current + 1)}
          className={cn(item, "border-ink bg-surface")}
          aria-label="다음 페이지"
        >
          ›
        </Link>
      )}
    </nav>
  );
}
