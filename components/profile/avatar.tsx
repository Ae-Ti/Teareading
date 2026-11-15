"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { avatarObjectPath } from "@/lib/profile/forms";

export function ProfileAvatar({
  nickname,
  src,
  size = "lg",
  className,
}: {
  nickname: string;
  src?: string | null;
  size?: "xs" | "sm" | "lg";
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const valid = src && src !== failedSrc && avatarObjectPath(src);
  // className으로 크기·글자 크기를 정하면 기본값을 쓰지 않는다 (같이 쓰면 기본값이 이겨 지정한 크기가 무시됐다)
  const custom = className?.split(/\s+/) ?? [];
  const customSize = custom.some((c) => c.startsWith("size-"));
  const customText = custom.some((c) =>
    /^text-(xs|sm|base|lg|xl|\d|\[)/.test(c),
  );
  return (
    <span
      role="img"
      aria-label={`${nickname} 프로필 이미지`}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-yuja font-bold",
        !customSize && size === "lg" && "size-24",
        !customSize && size === "sm" && "size-10",
        !customSize && size === "xs" && "size-7",
        !customText && size === "lg" && "text-3xl",
        !customText && size === "sm" && (customSize ? "text-sm" : "text-base"),
        !customText && size === "xs" && "text-xs",
        className,
      )}
    >
      {valid ? (
        // 원격 이미지 최적화 프록시를 거치지 않고 검증된 Storage URL만 표시한다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        ([...nickname][0] ?? "茶")
      )}
    </span>
  );
}
