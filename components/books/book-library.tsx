import Link from "next/link";
import { Suspense } from "react";
import { RecordTabs } from "@/components/records/record-tabs";
import { cn } from "@/components/ui/cn";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  BOOK_STATUS,
  GENRES,
  libraryHref,
  listBooks,
  parseLibraryQuery,
  type BookRow,
  type BookStatus,
  type Genre,
} from "@/lib/books";
import { requireUser } from "@/lib/supabase/user";
import { BookCover } from "./book-cover";
import { BookDialogButton } from "./book-dialog";
import { genreTone, GenreTags } from "./book-tags";
import { PagesEditor } from "./pages-editor";
import { StatusSelect } from "./status-select";

type Params = Promise<Record<string, string | string[] | undefined>>;

// 내 기록의 독서기록 탭: 서재 표
export function BookLibraryPage({ searchParams }: { searchParams: Params }) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">내 기록</h1>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <RecordTabs active="reading" />
        </div>
        <div className="mb-1">
          <BookDialogButton label="도서 추가" />
        </div>
      </div>
      <Suspense fallback={<LoadingBlock className="h-80" />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const COLS =
  "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)_6.5rem_4.5rem_4.5rem_7rem]";

async function Library({ searchParams }: { searchParams: Params }) {
  const query = parseLibraryQuery(await searchParams);
  const { supabase } = await requireUser("/me/reading");
  const { books, error } = await listBooks(supabase);

  if (error)
    return (
      <StateMessage
        tone="error"
        title="서재를 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  if (books.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-ink-subtle p-10 text-center">
        <span aria-hidden className="text-4xl">
          📚
        </span>
        <p className="font-bold">아직 서재에 책이 없어요</p>
        <p className="text-sm text-ink-muted">
          읽고 있는 책을 추가하고, 책마다 독서록을 남겨 보세요.
        </p>
        <BookDialogButton label="첫 책 추가하기" size="md" />
      </div>
    );

  const countBy = (s: BookStatus) => books.filter((b) => b.status === s).length;
  const usedGenres = (Object.keys(GENRES) as Genre[]).filter((g) =>
    books.some((b) => b.genres.includes(g)),
  );
  const shown = books.filter(
    (b) =>
      (!query.status || b.status === query.status) &&
      (!query.genre || b.genres.includes(query.genre)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <nav aria-label="읽기 상태" className="flex flex-wrap gap-2">
          <Chip
            href={libraryHref(query, { status: null })}
            active={!query.status}
            label="전체"
            count={books.length}
          />
          {(Object.keys(BOOK_STATUS) as BookStatus[]).map((s) => (
            <Chip
              key={s}
              href={libraryHref(query, { status: s })}
              active={query.status === s}
              label={BOOK_STATUS[s]}
              count={countBy(s)}
            />
          ))}
        </nav>
        {usedGenres.length > 0 && (
          <nav aria-label="장르" className="flex flex-wrap gap-1.5">
            {usedGenres.map((g) => {
              const active = query.genre === g;
              return (
                <Link
                  key={g}
                  href={libraryHref(query, { genre: active ? null : g })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold",
                    genreTone(g),
                    active ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100",
                  )}
                >
                  #{GENRES[g]}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {shown.length === 0 ? (
        <StateMessage
          title="조건에 맞는 책이 없어요"
          action={{ href: "/me/reading", label: "필터 지우기" }}
        />
      ) : (
        <div className="rounded-lg border-2 border-ink bg-surface shadow-hard">
          <div
            aria-hidden
            className={cn(
              "hidden gap-3 rounded-t-[inherit] border-b-2 border-ink bg-sunken px-4 py-2 text-xs font-bold text-ink-muted lg:grid",
              COLS,
            )}
          >
            <span>책</span>
            <span>장르</span>
            <span>상태</span>
            <span className="text-right">읽은 쪽</span>
            <span className="text-right">독서록</span>
            <span />
          </div>
          <ul>
            {shown.map((b) => (
              <BookItem key={b.id} book={b} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-md border-2 border-ink px-3 py-1 text-sm font-bold",
        active ? "bg-matcha" : "bg-surface hover:bg-sunken",
      )}
    >
      {label} <span className="font-mono text-xs">{count}</span>
    </Link>
  );
}

function BookItem({ book: b }: { book: BookRow }) {
  return (
    <li
      data-book={b.title}
      className={cn(
        "grid gap-x-3 gap-y-2 border-ink-subtle p-4 not-last:border-b lg:items-center lg:py-3",
        COLS,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link href={`/me/books/${b.id}`} tabIndex={-1} aria-hidden>
          <BookCover title={b.title} src={b.cover_url} />
        </Link>
        <div className="min-w-0">
          <Link
            href={`/me/books/${b.id}`}
            className="block truncate font-bold hover:underline"
          >
            {b.title}
          </Link>
          {b.author && (
            <p className="truncate text-sm text-ink-muted">{b.author}</p>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <GenreTags genres={b.genres} />
      </div>
      <div className="flex items-center gap-3 lg:contents">
        <div className="w-28 lg:w-auto">
          <StatusSelect id={b.id} title={b.title} status={b.status} />
        </div>
        <p className="text-sm lg:text-right">
          <span className="text-ink-muted lg:sr-only">읽은 쪽 </span>
          <PagesEditor id={b.id} title={b.title} pages={b.pages} />
        </p>
        <p className="text-sm lg:text-right">
          <span className="text-ink-muted lg:sr-only">독서록 </span>
          <Link
            href={`/me/books/${b.id}`}
            className="font-mono font-bold tabular-nums hover:underline"
          >
            {b.log_count}
          </Link>
        </p>
      </div>
      <LinkButton
        href={`/me/reading/new?book=${b.id}`}
        size="sm"
        variant="secondary"
        className="whitespace-nowrap sm:justify-self-start lg:justify-self-auto"
      >
        독서록 작성
      </LinkButton>
    </li>
  );
}
