"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChatRoom } from "@/components/chat/chat-room";
import { fetchMessages } from "@/lib/chat/rooms";
import { createClient } from "@/lib/supabase/client";

type Initial = React.ComponentProps<typeof ChatRoom>["initial"];

// 페이지를 옮기지 않고 화면 옆에서 바로 대화하는 창
export function ChatDock({
  threadId,
  nickname,
  me,
  onClose,
}: {
  threadId: string;
  nickname: string;
  me: string;
  onClose: () => void;
}) {
  const [initial, setInitial] = useState<Initial | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchMessages(createClient(), { kind: "dm", id: threadId }).then(
      (res) => {
        if (!live) return;
        if (res.error) setFailed(true);
        else
          setInitial({
            messages: [...res.messages],
            profiles: res.profiles,
            hasMore: res.hasMore,
          });
      },
    );
    return () => {
      live = false;
    };
  }, [threadId]);

  return (
    <aside
      aria-label={`${nickname}님과 대화`}
      className="fixed inset-x-2 bottom-20 z-40 flex h-[60dvh] flex-col gap-2 rounded-lg border-2 border-ink bg-surface p-2 shadow-hard-lg md:right-4 md:bottom-4 md:left-auto md:h-[32rem] md:w-96"
    >
      <header className="flex items-center gap-2 px-1">
        <h2 className="min-w-0 flex-1 truncate font-bold">{nickname}</h2>
        <Link
          href={`/dm/${threadId}`}
          onClick={onClose}
          className="shrink-0 text-xs font-bold text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          크게 보기
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="대화창 닫기"
          className="flex size-8 items-center justify-center rounded-md text-xl hover:bg-sunken"
        >
          ×
        </button>
      </header>
      {failed ? (
        <p role="alert" className="p-4 text-center text-sm text-danger">
          대화를 불러오지 못했어요.
        </p>
      ) : initial ? (
        <ChatRoom
          key={threadId}
          embedded
          room={{ kind: "dm", id: threadId }}
          me={me}
          initial={initial}
          emptyTitle="대화를 시작해 보세요"
          emptyDescription={`${nickname}님에게 첫 인사를 건네 보세요.`}
          placeholder="메시지를 입력하세요"
        />
      ) : (
        <p role="status" className="p-4 text-center text-sm text-ink-muted">
          불러오는 중…
        </p>
      )}
    </aside>
  );
}
