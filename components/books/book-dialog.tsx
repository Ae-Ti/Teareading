"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  saveBook,
  searchBookInfo,
  type BookFormState,
} from "@/app/me/books/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  AUTHOR_MAX,
  BOOK_STATUS,
  BOOK_TITLE_MAX,
  GENRE_MAX,
  GENRES,
  STATUS_TONE,
  type BookStatus,
  type BookValues,
  type Genre,
} from "@/lib/books";
import type { BookHit } from "@/lib/book-search";
import { BookCover } from "./book-cover";
import { genreTone } from "./book-tags";

// 도서 추가·수정 팝업
export function BookDialogButton({
  book,
  label,
  size = "sm",
  variant = "primary",
}: {
  book?: { id: string } & BookValues;
  label: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={book ? "도서 수정" : "도서 추가"}
      >
        {open && <BookForm book={book} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function BookForm({
  book,
  onDone,
}: {
  book?: { id: string } & BookValues;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<BookFormState, FormData>(
    saveBook.bind(null, book?.id ?? null),
    {},
  );
  const [status, setStatus] = useState<BookStatus>(book?.status ?? "reading");
  const [genres, setGenres] = useState<Genre[]>(book?.genres ?? []);
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl ?? "");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const search = () => {
    if (!query.trim()) return;
    setSearchError(null);
    startSearch(async () => {
      try {
        const res = await searchBookInfo(query);
        setHits(res.results);
        setSearchError(res.error);
      } catch {
        setHits(null);
        setSearchError("지금은 검색할 수 없어요. 제목을 직접 입력해 주세요.");
      }
    });
  };

  const pick = (hit: BookHit) => {
    setTitle(hit.title);
    setAuthor(hit.author);
    setCoverUrl(hit.coverUrl ?? "");
    setHits(null);
    setQuery("");
  };

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  const toggle = (g: Genre) =>
    setGenres((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]));
  const pill =
    "cursor-pointer rounded-full border-2 border-ink px-3 py-1 text-sm font-bold has-focus-visible:outline-3 has-focus-visible:outline-yuja";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2 rounded-md bg-sunken p-3">
        <label htmlFor="book-search" className="text-sm font-bold">
          책 검색 (표지 가져오기)
        </label>
        <div className="flex gap-2">
          <input
            id="book-search"
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder="제목으로 찾기"
            className="h-10 min-w-0 flex-1 rounded-md border-2 border-ink bg-surface px-3 text-base focus:shadow-hard-sm focus:outline-none"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-10"
            loading={searching}
            onClick={search}
          >
            검색
          </Button>
        </div>
        {searchError && (
          <p role="alert" className="text-sm text-danger">
            {searchError}
          </p>
        )}
        {hits && hits.length === 0 && !searchError && (
          <p className="text-sm text-ink-muted">
            찾지 못했어요. 아래에 직접 입력해 주세요.
          </p>
        )}
        {hits && hits.length > 0 && (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {hits.map((hit, i) => (
              <li key={`${hit.title}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  className="flex w-full items-center gap-2 rounded-md p-1 text-left hover:bg-surface"
                >
                  <BookCover title={hit.title} src={hit.coverUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {hit.title}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {hit.author}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input type="hidden" name="coverUrl" value={coverUrl} />
      {coverUrl && (
        <div className="flex items-center gap-3">
          <BookCover title={title} src={coverUrl} size="md" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCoverUrl("")}
          >
            표지 지우기
          </Button>
        </div>
      )}
      <Input
        label="책 제목"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={BOOK_TITLE_MAX}
        placeholder="예: 데미안"
        required
        error={state.errors?.title}
      />
      <Input
        label="저자 (선택)"
        name="author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        maxLength={AUTHOR_MAX}
        placeholder="예: 헤르만 헤세"
        error={state.errors?.author}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">읽기 상태</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BOOK_STATUS) as BookStatus[]).map((s) => (
            <label
              key={s}
              className={cn(pill, status === s ? STATUS_TONE[s] : "bg-surface")}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="sr-only"
              />
              {BOOK_STATUS[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">
          장르 태그 (선택, {GENRE_MAX}개까지)
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GENRES) as Genre[]).map((g) => {
            const on = genres.includes(g);
            const full = !on && genres.length >= GENRE_MAX;
            return (
              <label
                key={g}
                className={cn(
                  pill,
                  on ? genreTone(g) : "bg-surface",
                  full && "cursor-not-allowed opacity-40",
                )}
              >
                <input
                  type="checkbox"
                  name="genres"
                  value={g}
                  checked={on}
                  disabled={full}
                  onChange={() => toggle(g)}
                  className="sr-only"
                />
                {GENRES[g]}
              </label>
            );
          })}
        </div>
        {state.errors?.genres && (
          <p className="text-sm text-danger">{state.errors.genres}</p>
        )}
      </fieldset>
      {state.errors?.form && (
        <p role="alert" className="text-sm text-danger">
          {state.errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <Button loading={pending}>{book ? "저장" : "도서 추가"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          취소
        </Button>
      </div>
    </form>
  );
}
