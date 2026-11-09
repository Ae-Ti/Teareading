"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import {
  getServerUnread,
  getUnread,
  requestUnreadRefresh,
  subscribeUnread,
} from "@/lib/chat/unread-store";

// 내비게이션 '메시지' 위의 빨간 동그라미. 안 읽은 메시지가 없으면 그리지 않는다.
export function UnreadBadge({
  pathname,
  className,
}: {
  pathname: string | null;
  className?: string;
}) {
  const count = useSyncExternalStore(
    subscribeUnread,
    getUnread,
    getServerUnread,
  );
  // 화면을 옮길 때 다시 센다 (로그아웃·읽음 반영)
  useEffect(() => requestUnreadRefresh(), [pathname]);
  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`안 읽은 메시지 ${count}개`}
      className={cn(
        "absolute flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] leading-none font-bold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
