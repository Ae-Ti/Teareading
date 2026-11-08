"use client";

import { useState, useTransition } from "react";
import { setLike } from "@/app/board/actions";
import { cn } from "@/components/ui/cn";

// 추천 / 추천 취소. 내 글이면 숫자만 보인다.
export function LikeButton({
  postId,
  liked: initialLiked,
  count: initialCount,
  disabled,
}: {
  postId: string;
  liked: boolean;
  count: number;
  disabled?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !liked;
    setError(null);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    startTransition(async () => {
      try {
        const res = await setLike(postId, next);
        if (res.error) throw new Error(res.error);
        setLiked(res.liked!);
        setCount(res.count!);
      } catch (e) {
        setLiked(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        setError(
          e instanceof Error && e.message
            ? e.message
            : "처리하지 못했어요. 다시 시도해 주세요.",
        );
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-pressed={liked}
        aria-label={`추천 ${count}`}
        title={disabled ? "내 글은 추천할 수 없어요" : undefined}
        className={cn(
          "flex min-w-24 flex-col items-center gap-0.5 rounded-lg border-2 border-ink px-5 py-2.5 font-bold shadow-hard transition",
          "enabled:hover:-translate-y-px enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:cursor-not-allowed disabled:shadow-none",
          liked ? "bg-hongcha" : "bg-surface",
        )}
      >
        <span aria-hidden className="text-xl">
          {liked ? "♥" : "♡"}
        </span>
        <span className="text-sm">
          추천 <span className="font-mono">{count}</span>
        </span>
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
