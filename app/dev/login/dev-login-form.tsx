"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { devLogin } from "./actions";

export function DevLoginForm() {
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [error, action, pending] = useActionState(devLogin, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Input
        label="이메일"
        name="email"
        type="email"
        defaultValue="tea@example.com"
        required
      />
      <Input
        label="비밀번호"
        name="password"
        type="password"
        defaultValue="password123"
        required
      />
      <Input
        label="닉네임 (처음 가입할 때만)"
        name="nickname"
        defaultValue="차향"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button loading={pending}>로그인</Button>
    </form>
  );
}
