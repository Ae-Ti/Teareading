"use client";

import { useEffect } from "react";

// 예상하지 못한 오류가 나도 상단 바는 그대로 두고, 이 화면만 안내와 다시 시도로 바꾼다.
// (Next 기본 오류 화면 "This page couldn't load" 대신)
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">화면을 불러오지 못했어요</h1>
      <p className="text-ink-muted">
        잠시 뒤에 다시 시도해 주세요. 계속되면 새로고침해 주세요.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex min-h-11 items-center rounded-md border-2 border-ink bg-matcha px-4 font-bold shadow-hard"
      >
        다시 시도
      </button>
    </section>
  );
}
