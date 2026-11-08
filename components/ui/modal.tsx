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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
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
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "modal-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-lg border-2 border-ink bg-surface p-0 text-ink shadow-hard-lg backdrop:bg-ink/40",
        "md:m-auto md:max-h-[80dvh] md:w-[min(36rem,calc(100%-2rem))] md:rounded-lg",
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
