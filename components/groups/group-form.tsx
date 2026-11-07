"use client";

import { useActionState, useState } from "react";
import type { GroupFormState } from "@/app/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Textarea } from "@/components/ui/textarea";

export function GroupForm({
  action,
  initial = { name: "", description: "" },
  submitLabel,
  cancelHref,
}: {
  action: (prev: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  initial?: { name: string; description: string };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [description, setDescription] = useState(initial.description);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Input
        label="모임 이름"
        name="name"
        defaultValue={state.values?.name ?? initial.name}
        placeholder="예: 새벽 독서 모임"
        maxLength={40}
        required
        error={state.errors?.name}
        hint="2~40자"
      />
      <Textarea
        label="소개"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="어떤 책과 차를 함께하는 모임인지, 언제 모이는지 적어 주세요."
        maxLength={500}
        rows={6}
        error={state.errors?.description}
        hint={`${description.length} / 500자`}
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
        <Button loading={pending}>{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="ghost">
          취소
        </LinkButton>
      </div>
    </form>
  );
}
