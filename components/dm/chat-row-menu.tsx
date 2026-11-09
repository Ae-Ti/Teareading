"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { leaveChat, setChatPref } from "@/app/dm/actions";
import { cn } from "@/components/ui/cn";
import { requestUnreadRefresh } from "@/lib/chat/unread-store";

type Result = { error: string | null };

// 메시지 목록 한 줄의 ⋮ 메뉴: 알람 끄기, 상단 고정, 나가기
export function ChatRowMenu({
  kind,
  roomId,
  title,
  pinned,
  muted,
  cannotLeave,
}: {
  kind: "group" | "dm";
  roomId: string;
  title: string;
  pinned: boolean;
  muted: boolean;
  cannotLeave?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const run = (action: () => Promise<Result>) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        requestUnreadRefresh(0);
      } catch {
        setError("처리하지 못했어요. 연결을 확인해 주세요.");
      }
    });
  };

  const leave = () => {
    const message =
      kind === "group"
        ? `'${title}' 채팅방에서 나갈까요? 모임에서도 탈퇴돼요.`
        : `'${title}' 대화를 목록에서 지울까요? 상대가 새 메시지를 보내면 다시 나타나요.`;
    if (window.confirm(message)) run(() => leaveChat(kind, roomId));
  };

  const item =
    "w-full rounded px-3 py-2 text-left text-sm hover:bg-sunken focus-visible:bg-sunken disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent";

  return (
    <div
      ref={root}
      data-open={open || undefined}
      // 열린 메뉴가 아래 줄에 가리지 않도록 위로 올린다
      className={cn(
        "chat-row-menu absolute top-1/2 right-1.5 -translate-y-1/2",
        open && "z-30",
      )}
    >
      <button
        type="button"
        aria-label={`${title} 채팅방 옵션`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-md hover:bg-surface"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          aria-hidden
          fill="currentColor"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`${title} 채팅방 옵션`}
          aria-busy={pending}
          className={cn(
            "absolute top-full right-0 z-30 mt-1 flex w-52 flex-col rounded-md border-2 border-ink bg-surface p-1 shadow-hard",
          )}
        >
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            className={item}
            onClick={() =>
              run(() => setChatPref(kind, roomId, { muted: !muted }))
            }
          >
            {muted ? "채팅방 알람 켜기" : "채팅방 알람 끄기"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            className={item}
            onClick={() =>
              run(() => setChatPref(kind, roomId, { pinned: !pinned }))
            }
          >
            {pinned ? "상단 고정 해제" : "상단 고정"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={pending || Boolean(cannotLeave)}
            title={cannotLeave}
            className={cn(item, !cannotLeave && "text-danger")}
            onClick={leave}
          >
            채팅방 나가기
          </button>
          {cannotLeave && (
            <p className="px-3 pb-1 text-xs text-ink-muted">{cannotLeave}</p>
          )}
          {error && (
            <p role="alert" className="px-3 py-1 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
