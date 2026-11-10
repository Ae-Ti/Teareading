"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "./cn";

// 팝업 창: 데스크톱은 가운데, 모바일은 아래에서 올라오는 시트. 바깥을 누르거나 Esc로 닫는다.
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  center = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  // 모바일에서도 시트 대신 화면 가운데에 띄운다
  center?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // 화면을 떠나 숨겨질 때(Next.js Activity)도 닫는다
  useEffect(() => () => ref.current?.close(), []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // 수락/거절 창은 다른 곳을 누르다가 실수로 닫히지 않게 한다
        if (!center && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "modal-sheet max-w-none overflow-hidden border-2 border-ink bg-surface p-0 text-ink shadow-hard-lg backdrop:bg-ink/40",
        center
          ? "m-auto max-h-[80dvh] w-[min(24rem,calc(100%-2rem))] rounded-lg"
          : "m-0 mt-auto max-h-[85dvh] w-full rounded-t-lg md:m-auto md:max-h-[80dvh] md:w-[min(36rem,calc(100%-2rem))] md:rounded-lg",
        className,
      )}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-9 items-center justify-center rounded-md text-xl hover:bg-sunken"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
