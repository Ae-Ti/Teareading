"use client";

import { useActionState, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { deleteMyAccount, type DeleteAccountState } from "@/app/mypage/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DELETE_CONFIRM } from "@/lib/account";

export function DeleteAccountForm() {
  const [value, setValue] = useState("");
  const [state, action, pending] = useActionState(
    async (previous: DeleteAccountState, form: FormData) => {
      try {
        return await deleteMyAccount(previous, form);
      } catch (error) {
        // 성공 시 /goodbye로 이동하는 redirect는 다시 던진다
        unstable_rethrow(error);
        return {
          error: "연결이 불안정해요. 계정은 그대로예요. 다시 시도해 주세요.",
        };
      }
    },
    { error: null },
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        label={`확인을 위해 '${DELETE_CONFIRM}'를 입력해 주세요`}
        name="confirm"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={state.error ?? undefined}
      />
      <Button
        type="submit"
        variant="danger"
        loading={pending}
        disabled={value.trim() !== DELETE_CONFIRM}
        className="self-start"
      >
        회원 탈퇴
      </Button>
    </form>
  );
}
