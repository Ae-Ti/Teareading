"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

// 내 프로필: 프로필 공개/비공개. 고르면 바로 저장한다.
export function ProfileVisibility({
  userId,
  isPublic: initial,
}: {
  userId: string;
  isPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    if (next === isPublic) return;
    setIsPublic(next);
    setError(null);
    startTransition(async () => {
      const { error: failed } = await createClient()
        .from("profiles")
        .update({ is_public: next })
        .eq("id", userId);
      if (failed) {
        setIsPublic(!next);
        setError("저장하지 못했어요. 다시 시도해 주세요.");
      }
    });
  };

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">프로필 공개 설정</legend>
      <span className="text-sm font-bold">프로필</span>
      {[
        { value: true, label: "공개" },
        { value: false, label: "비공개" },
      ].map((option) => (
        <label
          key={option.label}
          className="cursor-pointer rounded-md border-2 border-ink px-2.5 py-0.5 text-sm font-bold has-checked:bg-matcha has-focus-visible:outline-3 has-focus-visible:outline-yuja"
        >
          <input
            type="radio"
            name="profile-visibility"
            checked={isPublic === option.value}
            disabled={pending}
            onChange={() => change(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
      <span className="w-full text-xs text-ink-muted">
        {isPublic
          ? "다른 회원이 내 활동 통계, 읽은 책, 친구, 참여 모임, 공개로 지정한 글을 볼 수 있어요."
          : "다른 회원에게는 닉네임과 프로필 사진만 보여요."}
      </span>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
