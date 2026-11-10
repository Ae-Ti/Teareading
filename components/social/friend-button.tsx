"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { FriendRelation } from "@/lib/social/data";
import { answerRequest, sendRequest } from "@/lib/social/requests";
import { createClient } from "@/lib/supabase/client";

// 공개 프로필의 친구 맺기 / 수락 / 끊기
export function FriendButton({
  me,
  userId,
  nickname,
  relation: initial,
  requestId,
}: {
  me: string;
  userId: string;
  nickname: string;
  relation: FriendRelation;
  requestId: string | null;
}) {
  const [relation, setRelation] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (work: () => Promise<string | null>) =>
    startTransition(async () => {
      setError(null);
      try {
        const failed = await work();
        if (failed) setError(failed);
        else router.refresh();
      } catch {
        setError("처리하지 못했어요. 연결을 확인해 주세요.");
      }
    });

  const request = () =>
    run(async () => {
      const res = await sendRequest("friend", userId);
      if (res.error) return res.error;
      setRelation(res.status === "accepted" ? "friend" : "sent");
      return null;
    });

  const accept = () =>
    run(async () => {
      if (!requestId) return "요청을 찾을 수 없어요.";
      const res = await answerRequest(requestId, true);
      if (res.error) return res.error;
      setRelation("friend");
      return null;
    });

  const unfriend = () =>
    run(async () => {
      const [low, high] = me < userId ? [me, userId] : [userId, me];
      const { error: failed } = await createClient()
        .from("friendships")
        .delete()
        .eq("user_a", low)
        .eq("user_b", high);
      if (failed) return "친구를 끊지 못했어요. 다시 시도해 주세요.";
      setRelation("none");
      setConfirming(false);
      return null;
    });

  return (
    <div className="flex flex-col gap-2">
      {relation === "none" && (
        <Button variant="secondary" loading={pending} onClick={request}>
          친구 맺기
        </Button>
      )}
      {relation === "sent" && (
        <Button variant="secondary" disabled>
          친구 신청 보냄
        </Button>
      )}
      {relation === "received" && (
        <Button loading={pending} onClick={accept}>
          친구 수락
        </Button>
      )}
      {relation === "friend" && (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          친구 끊기
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="친구 끊기"
      >
        <p>{nickname}님과 친구를 끊을까요?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            아니오
          </Button>
          <Button variant="danger" loading={pending} onClick={unfriend}>
            예
          </Button>
        </div>
      </Modal>
    </div>
  );
}
