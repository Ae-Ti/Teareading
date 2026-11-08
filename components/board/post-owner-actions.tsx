"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { deletePost } from "@/app/board/actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

export function PostOwnerActions({ postId }: { postId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LinkButton href={`/board/${postId}/edit`} size="sm" variant="secondary">
        수정
      </LinkButton>
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() => {
          if (
            !window.confirm("이 글을 삭제할까요? 댓글과 추천도 함께 지워져요.")
          )
            return;
          setError(null);
          startTransition(async () => {
            try {
              const res = await deletePost(postId);
              if (res?.error) setError(res.error);
            } catch (e) {
              unstable_rethrow(e);
              setError("삭제하지 못했어요. 다시 시도해 주세요.");
            }
          });
        }}
      >
        삭제
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
