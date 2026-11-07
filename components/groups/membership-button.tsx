"use client";

import { useState, useTransition } from "react";
import { joinGroup, leaveGroup } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";
import { detectDevice } from "@/lib/track";

export function MembershipButton({
  groupId,
  joined,
}: {
  groupId: string;
  joined: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = joined
        ? await leaveGroup(groupId)
        : await joinGroup(groupId, detectDevice());
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={joined ? "secondary" : "primary"}
        onClick={run}
        loading={pending}
      >
        {joined ? "모임 탈퇴" : "모임 가입"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
