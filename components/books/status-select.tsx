"use client";

import { useState, useTransition } from "react";
import { setBookStatus } from "@/app/me/books/actions";
import { cn } from "@/components/ui/cn";
import { BOOK_STATUS, STATUS_TONE, type BookStatus } from "@/lib/books";

// 표에서 바로 바꾸는 읽기 상태
export function StatusSelect({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: BookStatus;
}) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        aria-label={`${title} 읽기 상태`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as BookStatus;
          const before = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            let message: string | null;
            try {
              message = (await setBookStatus(id, next)).error;
            } catch {
              message = "연결을 확인해 주세요.";
            }
            if (message) {
              setValue(before);
              setError(message);
            }
          });
        }}
        className={cn(
          "h-8 w-full cursor-pointer rounded-md border-2 border-ink px-1.5 text-xs font-bold disabled:opacity-60",
          STATUS_TONE[value],
        )}
      >
        {Object.entries(BOOK_STATUS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
