"use client";

import { useActionState, useEffect, useState } from "react";
import { saveBook, type BookFormState } from "@/app/me/books/actions";
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

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  const toggle = (g: Genre) =>
    setGenres((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]));
  const pill =
    "cursor-pointer rounded-full border-2 border-ink px-3 py-1 text-sm font-bold has-focus-visible:outline-3 has-focus-visible:outline-yuja";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Input
        label="책 제목"
        name="title"
        defaultValue={state.values?.title ?? book?.title ?? ""}
        maxLength={BOOK_TITLE_MAX}
        placeholder="예: 데미안"
        required
        autoFocus
        error={state.errors?.title}
      />
      <Input
        label="저자 (선택)"
        name="author"
        defaultValue={state.values?.author ?? book?.author ?? ""}
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
