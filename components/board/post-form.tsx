"use client";

import { useActionState, useEffect, useState } from "react";
import type { PostFormState } from "@/app/board/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Textarea } from "@/components/ui/textarea";
import { BODY_MAX, CATEGORIES, TITLE_MAX, type PostValues } from "@/lib/board";
import { detectDevice } from "@/lib/track";

export function PostForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (prev: PostFormState, form: FormData) => Promise<PostFormState>;
  initial?: PostValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: PostFormState, form: FormData) => {
      form.set("device", detectDevice() ?? "");
      return action(prev, form);
    },
    {},
  );
  const values = state.values ?? initial;
  const [title, setTitle] = useState(values?.title ?? "");
  const [body, setBody] = useState(values?.body ?? "");
  const [dirty, setDirty] = useState(false);

  // 저장하지 않은 내용이 있으면 떠나기 전에 묻는다
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const count = (v: string) => [...v].length;

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-bold">말머리</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORIES).map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-md border-2 border-ink px-3 py-1.5 text-sm font-bold has-checked:bg-matcha has-focus-visible:outline-3 has-focus-visible:outline-yuja"
            >
              <input
                type="radio"
                name="category"
                value={value}
                defaultChecked={(values?.category ?? "free") === value}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        {state.errors?.category && (
          <p className="text-sm text-danger">{state.errors.category}</p>
        )}
      </fieldset>
      <Input
        label="제목"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력해 주세요"
        error={state.errors?.title}
        hint={`${count(title)} / ${TITLE_MAX}자`}
      />
      <Textarea
        label="내용"
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="함께 나누고 싶은 이야기를 적어 주세요. 다른 사람을 배려하는 글을 부탁드려요."
        error={state.errors?.body}
        hint={`${count(body).toLocaleString()} / ${BODY_MAX.toLocaleString()}자`}
        className={cn("min-h-72")}
      />
      {state.errors?.form && (
        <p role="alert" className="text-sm text-danger">
          {state.errors.form}
        </p>
      )}
      <div className="flex gap-3">
        <Button loading={pending}>{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="ghost">
          취소
        </LinkButton>
      </div>
    </form>
  );
}
