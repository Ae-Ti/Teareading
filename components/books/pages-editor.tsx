"use client";

import { useRef, useState, useTransition } from "react";
import { setBookPages } from "@/app/me/books/actions";
import { cn } from "@/components/ui/cn";
import { BOOK_PAGES_MAX } from "@/lib/books";

// 읽은 쪽 수: 숫자를 누르면 그 자리에서 고친다
export function PagesEditor({
  id,
  title,
  pages,
  className,
}: {
  id: string;
  title: string;
  pages: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(pages));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cancelled = useRef(false);

  const save = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = Number(value);
    if (value.trim() === String(pages)) {
      setEditing(false);
      setError(null);
      return;
    }
    if (!/^\d+$/.test(value.trim()) || next > BOOK_PAGES_MAX) {
      setError(`0~${BOOK_PAGES_MAX.toLocaleString()} 사이 숫자`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await setBookPages(id, next);
        if (res.error) setError(res.error);
        else setEditing(false);
      } catch {
        setError("연결을 확인해 주세요.");
      }
    });
  };

  if (!editing)
    return (
      <button
        type="button"
        title="눌러서 수정"
        aria-label={`${title} 읽은 쪽 수 ${pages}쪽, 수정`}
        onClick={() => {
          setValue(String(pages));
          setEditing(true);
        }}
        className={cn(
          "rounded border-b-2 border-dashed border-ink-subtle px-1 font-mono font-bold tabular-nums hover:border-ink hover:bg-sunken",
          className,
        )}
      >
        {pages.toLocaleString()}
      </button>
    );

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={BOOK_PAGES_MAX}
        autoFocus
        aria-label={`${title} 읽은 쪽 수`}
        aria-invalid={error ? true : undefined}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            setError(null);
            setEditing(false);
          }
        }}
        className="h-8 w-20 rounded-md border-2 border-ink bg-surface px-1.5 text-right font-mono text-sm focus:outline-none disabled:opacity-60"
      />
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
