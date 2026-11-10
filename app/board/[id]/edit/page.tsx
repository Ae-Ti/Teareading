import Link from "next/link";
import { Suspense } from "react";
import { updatePost } from "@/app/board/actions";
import { PostForm } from "@/components/board/post-form";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getPost, readBlocks } from "@/lib/board";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "글 수정 · 게시판 · 티어리딩" };

export default function Page(props: PageProps<"/board/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <EditPost params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(`/board/${id}/edit`);
  const { post, error } = await getPost(supabase, id, userId);
  if (error)
    return (
      <StateMessage
        tone="error"
        title="글을 불러오지 못했어요"
        action={{ href: `/board/${id}/edit`, label: "다시 시도" }}
      />
    );
  if (!post)
    return (
      <StateMessage
        title="글을 찾을 수 없어요"
        description="삭제되었거나 없는 글이에요."
        action={{ href: "/board", label: "게시판으로" }}
      />
    );
  if (post.author_id !== userId)
    return (
      <StateMessage
        title="작성자만 수정할 수 있어요"
        action={{ href: `/board/${id}`, label: "글로 돌아가기" }}
      />
    );

  return (
    <>
      <Link
        href={`/board/${id}`}
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 글로 돌아가기
      </Link>
      <h1 className="text-2xl font-bold md:text-3xl">글 수정</h1>
      <Card>
        <PostForm
          action={updatePost.bind(null, id)}
          initial={{
            category: post.category,
            title: post.title,
            body: post.body,
            content: readBlocks(post.content, userId),
          }}
          submitLabel="수정 저장"
          cancelHref={`/board/${id}`}
        />
      </Card>
    </>
  );
}
