"use client";

import { useState, useTransition } from "react";
import { joinGroup, leaveGroup } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { detectDevice } from "@/lib/track";

const FAILED = "처리하지 못했어요. 연결을 확인해 주세요.";

export function MembershipButton({
  groupId,
  joined,
}: {
  groupId: string;
  joined: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const join = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await joinGroup(groupId, detectDevice());
        if (res.error) setError(res.error);
      } catch {
        setError(FAILED);
      }
    });
  };

  const leave = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await leaveGroup(groupId);
        if (res.error) setError(res.error);
      } catch {
        setError(FAILED);
      }
      setConfirming(false);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={joined ? "secondary" : "primary"}
        onClick={joined ? () => setConfirming(true) : join}
        loading={pending && !confirming}
      >
        {joined ? "모임 탈퇴" : "모임 가입"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {joined && (
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          title="모임 탈퇴"
          className="md:w-[min(24rem,calc(100%-2rem))]"
        >
          <p className="font-bold">정말 탈퇴하시겠습니까?</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              아니오
            </Button>
            <Button variant="danger" loading={pending} onClick={leave}>
              예
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
