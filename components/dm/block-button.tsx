"use client";

import { useState, useTransition } from "react";
import { blockUser, unblockUser } from "@/app/dm/actions";
import { Button } from "@/components/ui/button";

// 차단은 한 번 더 확인한다. 해제는 바로 한다.
export function BlockButton({
  userId,
  nickname,
  blocked,
  size = "md",
}: {
  userId: string;
  nickname: string;
  blocked: boolean;
  size?: "sm" | "md";
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: typeof blockUser) =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await action(userId);
        if (res.error) setError(res.error);
        else setConfirming(false);
      } catch {
        setError("처리하지 못했어요. 연결을 확인해 주세요.");
      }
    });

  if (blocked)
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size={size}
          loading={pending}
          onClick={() => run(unblockUser)}
        >
          차단 해제
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size={size}
        aria-expanded={confirming}
        onClick={() => setConfirming((v) => !v)}
      >
        차단
      </Button>
      {confirming && (
        <div
          role="group"
          aria-label="차단 확인"
          className="absolute top-full right-0 z-20 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-md border-2 border-ink bg-surface p-3 text-sm shadow-hard"
        >
          <p>
            <strong className="break-all">{nickname}</strong> 님을 차단할까요?
            서로 새 메시지를 보낼 수 없게 돼요. 지난 대화는 남아 있어요.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={pending}
              onClick={() => run(blockUser)}
            >
              차단하기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              취소
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
