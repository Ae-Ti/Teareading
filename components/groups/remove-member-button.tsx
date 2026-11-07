"use client";

import { useState, useTransition } from "react";
import { removeMember } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";

export function RemoveMemberButton({
  groupId,
  memberId,
  nickname,
}: {
  groupId: string;
  memberId: string;
  nickname: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        aria-label={`${nickname} 님 내보내기`}
        onClick={() => {
          if (!window.confirm(`${nickname} 님을 모임에서 내보낼까요?`)) return;
          setError(null);
          startTransition(async () => {
            const res = await removeMember(groupId, memberId);
            if (res.error) setError(res.error);
          });
        }}
      >
        내보내기
      </Button>
    </div>
  );
}
