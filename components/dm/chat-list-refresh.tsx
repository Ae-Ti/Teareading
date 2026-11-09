"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { onChatActivity } from "@/lib/chat/unread-store";

// 메시지 목록을 보고 있을 때 새 메시지가 오면 목록을 다시 받는다.
// 채팅방에 들어갔다가 돌아왔을 때도(Next.js가 숨겨 둔 화면이 다시 보일 때) 읽음을 반영한다.
export function ChatListRefresh() {
  const router = useRouter();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else router.refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onChatActivity(() => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [router]);
  return null;
}
