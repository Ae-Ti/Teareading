"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startConversation } from "@/app/dm/actions";
import { Button } from "@/components/ui/button";
import { detectDevice } from "@/lib/track";

export function StartDmButton({ userId }: { userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2">
      <Button
        loading={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await startConversation(userId, detectDevice());
              if (res.error) setError(res.error);
              else if (res.threadId) router.push(`/dm/${res.threadId}`);
            } catch {
              setError("대화를 시작하지 못했어요. 연결을 확인해 주세요.");
            }
          });
        }}
      >
        메시지 보내기
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
