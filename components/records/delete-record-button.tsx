"use client";

import { useRef, useState, useTransition } from "react";
import { deleteRecord } from "@/app/me/actions";
import { Button } from "@/components/ui/button";
import type { RecordKind } from "@/lib/records";

export function DeleteRecordButton({
  kind,
  id,
  label,
}: {
  kind: RecordKind;
  id: string;
  label: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteRecord(kind, id);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <>
      <Button variant="ghost" onClick={() => dialog.current?.showModal()}>
        삭제
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`delete-${id}`}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-lg border-2 border-ink bg-surface p-6 shadow-hard-lg backdrop:bg-ink/40"
      >
        <h2 id={`delete-${id}`} className="text-lg font-bold">
          이 {label}을 삭제할까요?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          삭제하면 되돌릴 수 없어요.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => dialog.current?.close()}
            disabled={pending}
          >
            취소
          </Button>
          <Button variant="danger" onClick={confirm} loading={pending}>
            삭제
          </Button>
        </div>
      </dialog>
    </>
  );
}
