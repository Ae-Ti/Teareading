"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveRecord, type RecordFormState } from "@/app/me/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Textarea } from "@/components/ui/textarea";
import {
  BODY_MAX,
  PAGES_MAX,
  RECORD_KINDS,
  TEA_TYPES,
  TITLE_MAX,
  type RecordKind,
} from "@/lib/records";
import { detectDevice } from "@/lib/track";

export function RecordForm({
  kind,
  id = null,
  initial = { title: "", body: "", pages: "", teaType: "" },
}: {
  kind: RecordKind;
  id?: string | null;
  initial?: { title: string; body: string; pages?: string; teaType?: string };
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
  const [pages, setPages] = useState(initial.pages ?? "");
  const [teaType, setTeaType] = useState(initial.teaType ?? "");
  const dirty =
    title !== initial.title ||
    body !== initial.body ||
    pages !== (initial.pages ?? "") ||
    teaType !== (initial.teaType ?? "");

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
      {kind === "reading" && (
        <Input
          label="읽은 페이지 수 (선택)"
          name="pages"
          type="number"
          inputMode="numeric"
          min={1}
          max={PAGES_MAX}
          value={pages}
          onChange={(e) => setPages(e.target.value)}
          placeholder="예: 45"
          hint="이번에 읽은 쪽수를 적으면 통계에 쌓여요."
          error={state.errors?.pages}
        />
      )}
      {kind === "columns" && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-bold">차 종류 (선택)</legend>
          <div className="flex flex-wrap gap-2">
            {[["", "선택 안 함"], ...Object.entries(TEA_TYPES)].map(
              ([value, label]) => (
                <label
                  key={value}
                  className="cursor-pointer rounded-md border-2 border-ink px-3 py-1.5 text-sm font-bold has-checked:bg-matcha has-focus-visible:outline-3 has-focus-visible:outline-yuja"
                >
                  <input
                    type="radio"
                    name="teaType"
                    value={value}
                    checked={teaType === value}
                    onChange={() => setTeaType(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ),
            )}
          </div>
          <p className="text-sm text-ink-muted">
            고르면 어떤 차를 몇 번 마셨는지 통계에 쌓여요.
          </p>
          {state.errors?.teaType && (
            <p className="text-sm text-danger">{state.errors.teaType}</p>
          )}
        </fieldset>
      )}
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
