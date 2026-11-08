import Link from "next/link";
import { Suspense } from "react";
import { createPost } from "@/app/board/actions";
import { PostForm } from "@/components/board/post-form";
import { Card } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/state";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "글쓰기 · 게시판 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Link
        href="/board"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 게시판
      </Link>
      <h1 className="text-2xl font-bold md:text-3xl">글쓰기</h1>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <NewPost />
      </Suspense>
    </div>
  );
}

async function NewPost() {
  await requireUser("/board/new");
  return (
    <Card>
      <PostForm action={createPost} submitLabel="등록" cancelHref="/board" />
    </Card>
  );
}
