"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveRecord, type RecordFormState } from "@/app/me/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Textarea } from "@/components/ui/textarea";
import {
  BODY_MAX,
  RECORD_KINDS,
  TITLE_MAX,
  type RecordKind,
} from "@/lib/records";
import { detectDevice } from "@/lib/track";

export function RecordForm({
  kind,
  id = null,
  initial = { title: "", body: "" },
}: {
  kind: RecordKind;
  id?: string | null;
  initial?: { title: string; body: string };
}) {
  const config = RECORD_KINDS[kind];
  const action = useMemo(
    () => saveRecord.bind(null, kind, id, detectDevice()),
    [kind, id],
  );
  const [state, formAction, pending] = useActionState<
    RecordFormState,
    FormData
  >(action, {});
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const dirty = title !== initial.title || body !== initial.body;

  // 저장하지 않은 내용이 있으면 페이지를 떠나기 전에 경고
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const cancelHref = id ? `${config.path}/${id}` : config.path;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Input
        label={config.titleLabel}
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={config.titlePlaceholder}
        maxLength={TITLE_MAX}
        required
        error={state.errors?.title}
      />
      <Textarea
        label={config.bodyLabel}
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={config.bodyPlaceholder}
        maxLength={BODY_MAX}
        rows={14}
        required
        error={state.errors?.body}
        hint={`${body.length.toLocaleString()} / ${BODY_MAX.toLocaleString()}자`}
      />
      {state.errors?.form && (
        <p
          role="alert"
          className="rounded-md border-2 border-danger bg-danger-soft p-3 text-sm"
        >
          {state.errors.form}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button loading={pending}>{id ? "수정 저장" : "저장"}</Button>
        <LinkButton href={cancelHref} variant="ghost">
          취소
        </LinkButton>
      </div>
    </form>
  );
}
