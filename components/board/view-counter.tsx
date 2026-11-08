"use client";

import { useEffect, useRef } from "react";
import { recordView } from "@/app/board/actions";

// 화면을 실제로 연 경우에만 조회수를 센다 (링크 미리 불러오기는 세지 않음)
export function ViewCounter({ postId }: { postId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordView(postId).catch(() => undefined);
  }, [postId]);
  return null;
}
