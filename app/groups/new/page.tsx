import Link from "next/link";
import { Suspense } from "react";
import { createGroup } from "@/app/groups/actions";
import { GroupForm } from "@/components/groups/group-form";
import { LoadingBlock } from "@/components/ui/state";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "모임 만들기 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6 md:py-10">
      <Link
        href="/community"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 커뮤니티
      </Link>
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">모임 만들기</h1>
        <p className="text-sm text-ink-muted">
          만든 사람이 모임장이 되고, 누구나 바로 가입할 수 있어요.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock className="h-80" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await requireUser("/groups/new");
  return (
    <GroupForm
      action={createGroup}
      submitLabel="모임 만들기"
      cancelHref="/community"
    />
  );
}
