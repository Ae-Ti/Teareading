"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { deleteBook } from "@/app/me/books/actions";
import { Button } from "@/components/ui/button";

export function DeleteBookButton({
  id,
  title,
  logCount,
}: {
  id: string;
  title: string;
  logCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() => {
          const note = logCount ? ` 독서록 ${logCount}개도 함께 지워져요.` : "";
          if (!window.confirm(`'${title}'을(를) 서재에서 지울까요?${note}`))
            return;
          setError(null);
          startTransition(async () => {
            try {
              const res = await deleteBook(id);
              if (res?.error) setError(res.error);
            } catch (e) {
              unstable_rethrow(e);
              setError("삭제하지 못했어요. 다시 시도해 주세요.");
            }
          });
        }}
      >
        책 삭제
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
