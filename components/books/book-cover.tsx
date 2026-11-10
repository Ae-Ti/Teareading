"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";

const SIZES = {
  sm: "h-12 w-9 text-sm",
  md: "h-16 w-12 text-base",
  lg: "h-32 w-24 text-3xl",
} as const;

// 책 표지. 없거나 이미지를 못 불러오면 제목 첫 글자를 보여 준다.
export function BookCover({
  title,
  src,
  size = "sm",
  className,
}: {
  title: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = src && src !== failed;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded border-2 border-ink bg-hojicha font-bold",
        SIZES[size],
        className,
      )}
    >
      {show ? (
        // 검색 서비스의 표지 이미지를 그대로 쓴다 (허용된 주소만 저장됨)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        ([...title.trim()][0] ?? "책")
      )}
    </span>
  );
}
