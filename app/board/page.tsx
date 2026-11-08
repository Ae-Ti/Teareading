import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { AuthorChip } from "@/components/board/author-chip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  boardHref,
  CATEGORIES,
  FIELDS,
  formatBoardDate,
  isNew,
  listPosts,
  PAGE_SIZE,
  parseQuery,
  SORTS,
  type BoardQuery,
  type Category,
  type Sort,
} from "@/lib/board";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "게시판 · 티어리딩" };

export default function Page(props: PageProps<"/board">) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold md:text-4xl">게시판</h1>
          <p className="text-sm text-ink-muted">
            책과 차 이야기를 자유롭게 나눠요.
          </p>
        </div>
        <LinkButton href="/board/new" className="shrink-0">
          글쓰기
        </LinkButton>
      </div>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <Board searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Board({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseQuery(await searchParams);
  const { supabase } = await requireUser(boardHref(query));
  const { posts, total, error } = await listPosts(supabase, query);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <nav aria-label="말머리" className="flex flex-wrap gap-2">
        {([null, ...Object.keys(CATEGORIES)] as (Category | null)[]).map(
          (c) => {
            const active = query.category === c;
            return (
              <Link
                key={c ?? "all"}
                href={boardHref(query, { category: c, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md border-2 border-ink px-3 py-1 text-sm font-bold",
                  active ? "bg-matcha" : "bg-surface hover:bg-sunken",
                )}
              >
                {c ? CATEGORIES[c] : "전체"}
              </Link>
            );
          },
        )}
      </nav>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-muted">
            {query.q ? `'${query.q}' 검색 결과 ` : "글 "}
            <span className="font-mono font-bold text-ink">{total}</span>개
          </span>
          <span aria-hidden className="text-ink-subtle">
            |
          </span>
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link
              key={s}
              href={boardHref(query, { sort: s, page: 1 })}
              aria-current={query.sort === s ? "true" : undefined}
              className={cn(
                query.sort === s
                  ? "font-bold underline underline-offset-4"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {SORTS[s]}
            </Link>
          ))}
        </div>
        <SearchForm query={query} />
      </div>

      {error ? (
        <StateMessage
          tone="error"
          title="글 목록을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={{ href: boardHref(query), label: "다시 시도" }}
        />
      ) : posts.length === 0 ? (
        <StateMessage
          title={query.q ? "검색 결과가 없어요" : "아직 글이 없어요"}
          description={
            query.q
              ? "다른 검색어나 말머리로 찾아보세요."
              : "첫 글을 남겨 이야기를 시작해 보세요."
          }
          action={
            query.q
              ? {
                  href: boardHref(query, { q: "", page: 1 }),
                  label: "검색 지우기",
                }
              : { href: "/board/new", label: "글쓰기" }
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-hard">
          <div
            aria-hidden
            className="hidden grid-cols-[5.5rem_1fr_9rem_6rem_3.5rem_3.5rem] gap-3 border-b-2 border-ink bg-sunken px-4 py-2 text-xs font-bold text-ink-muted md:grid"
          >
            <span>말머리</span>
            <span>제목</span>
            <span>작성자</span>
            <span className="text-center">등록일</span>
            <span className="text-center">조회</span>
            <span className="text-center">추천</span>
          </div>
          <ul>
            {posts.map((p) => (
              <li
                key={p.id}
                className="border-ink-subtle not-last:border-b md:grid md:grid-cols-[5.5rem_1fr_9rem_6rem_3.5rem_3.5rem] md:items-center md:gap-3 md:px-4 md:py-2.5"
              >
                <span className="hidden md:block">
                  <Badge>{CATEGORIES[p.category]}</Badge>
                </span>
                <Link
                  href={`/board/${p.id}`}
                  className="flex min-w-0 flex-col gap-1 px-4 pt-3 hover:bg-sunken md:flex-row md:items-center md:gap-2 md:p-0 md:hover:bg-transparent"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-xs font-bold text-ink-muted md:hidden">
                      [{CATEGORIES[p.category]}]
                    </span>
                    <span className="truncate font-bold md:font-medium md:hover:underline">
                      {p.title}
                    </span>
                    {p.comment_count > 0 && (
                      <span
                        className="shrink-0 font-mono text-sm font-bold text-matcha-strong"
                        aria-label={`댓글 ${p.comment_count}개`}
                      >
                        [{p.comment_count}]
                      </span>
                    )}
                    {isNew(p.created_at) && (
                      <span
                        className="shrink-0 rounded-sm bg-hongcha px-1 text-[10px] font-bold"
                        aria-label="새 글"
                      >
                        N
                      </span>
                    )}
                    {p.like_count >= 5 && (
                      <span className="shrink-0 rounded-sm bg-yuja px-1 text-[10px] font-bold">
                        인기
                      </span>
                    )}
                  </span>
                </Link>
                <div className="flex items-center gap-2 px-4 pt-1 pb-3 text-xs text-ink-muted md:contents">
                  <AuthorChip
                    author={p.author}
                    size="xs"
                    className="text-ink md:text-sm"
                  />
                  <span aria-hidden className="md:hidden">
                    ·
                  </span>
                  <time
                    dateTime={p.created_at}
                    className="md:text-center md:text-sm"
                  >
                    {formatBoardDate(p.created_at)}
                  </time>
                  <span className="md:text-center md:font-mono md:text-sm">
                    <span className="md:sr-only">조회 </span>
                    {p.view_count}
                  </span>
                  <span className="md:text-center md:font-mono md:text-sm">
                    <span className="md:sr-only">추천 </span>
                    {p.like_count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && <Pagination query={query} pages={pages} />}
    </>
  );
}

function SearchForm({ query }: { query: BoardQuery }) {
  return (
    <Form action="/board" className="flex w-full gap-2 md:w-auto">
      {query.category && (
        <input type="hidden" name="category" value={query.category} />
      )}
      {query.sort !== "latest" && (
        <input type="hidden" name="sort" value={query.sort} />
      )}
      <label htmlFor="board-field" className="sr-only">
        검색 범위
      </label>
      <select
        id="board-field"
        name="field"
        defaultValue={query.field}
        className="h-10 shrink-0 rounded-md border-2 border-ink bg-surface px-2 text-sm"
      >
        {Object.entries(FIELDS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="board-q" className="sr-only">
        검색어
      </label>
      <input
        id="board-q"
        name="q"
        type="search"
        defaultValue={query.q}
        placeholder="검색어"
        maxLength={50}
        className="h-10 min-w-0 flex-1 rounded-md border-2 border-ink bg-surface px-3 text-sm md:w-48"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-md border-2 border-ink bg-matcha px-3 text-sm font-bold"
      >
        검색
      </button>
    </Form>
  );
}

// 페이지 번호: 현재 기준 앞뒤 2쪽 + 처음·끝
function Pagination({ query, pages }: { query: BoardQuery; pages: number }) {
  const current = Math.min(query.page, pages);
  const start = Math.max(1, current - 2);
  const end = Math.min(pages, current + 2);
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const item =
    "flex h-9 min-w-9 items-center justify-center rounded-md border-2 px-2 text-sm font-bold";
  return (
    <nav aria-label="페이지" className="flex flex-wrap justify-center gap-1.5">
      {current > 1 && (
        <Link
          href={boardHref(query, { page: current - 1 })}
          className={cn(item, "border-ink bg-surface")}
          aria-label="이전 페이지"
        >
          ‹
        </Link>
      )}
      {start > 1 && (
        <>
          <Link
            href={boardHref(query, { page: 1 })}
            className={cn(item, "border-transparent")}
          >
            1
          </Link>
          {start > 2 && <span className="self-center text-ink-subtle">…</span>}
        </>
      )}
      {nums.map((n) => (
        <Link
          key={n}
          href={boardHref(query, { page: n })}
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
            href={boardHref(query, { page: pages })}
            className={cn(item, "border-transparent")}
          >
            {pages}
          </Link>
        </>
      )}
      {current < pages && (
        <Link
          href={boardHref(query, { page: current + 1 })}
          className={cn(item, "border-ink bg-surface")}
          aria-label="다음 페이지"
        >
          ›
        </Link>
      )}
    </nav>
  );
}
