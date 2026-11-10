import Link from "next/link";
import { Suspense } from "react";
import { AuthorChip } from "@/components/board/author-chip";
import { CommentForm, CommentItem } from "@/components/board/comments";
import { LikeButton } from "@/components/board/like-button";
import { PostContent } from "@/components/board/post-content";
import { PostOwnerActions } from "@/components/board/post-owner-actions";
import { ViewCounter } from "@/components/board/view-counter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  CATEGORIES,
  formatBoardDateTime,
  getPost,
  wasEdited,
} from "@/lib/board";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "게시판 · 티어리딩" };

export default function Page(props: PageProps<"/board/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Link
        href="/board"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 목록으로
      </Link>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <PostView params={props.params} />
      </Suspense>
    </div>
  );
}

async function PostView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(
    `/board/${encodeURIComponent(id)}`,
  );
  const { post, liked, comments, error } = await getPost(supabase, id, userId);
  if (error)
    return (
      <StateMessage
        tone="error"
        title="글을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
        action={{
          href: `/board/${encodeURIComponent(id)}`,
          label: "다시 시도",
        }}
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
  const mine = post.author_id === userId;

  return (
    <>
      <ViewCounter postId={post.id} />
      <Card className="flex flex-col gap-5 p-5 md:p-8">
        <header className="flex flex-col gap-3 border-b-2 border-ink pb-4">
          <Badge tone="matcha" className="self-start">
            {CATEGORIES[post.category]}
          </Badge>
          <h1 className="text-xl font-bold break-words md:text-3xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
            <AuthorChip author={post.author} className="text-ink" />
            <time dateTime={post.created_at}>
              {formatBoardDateTime(post.created_at)}
            </time>
            {wasEdited(post) && (
              <span title={formatBoardDateTime(post.updated_at)}>(수정됨)</span>
            )}
            <span className="ml-auto flex gap-3">
              <span>
                조회 <span className="font-mono">{post.view_count}</span>
              </span>
              <span>
                추천 <span className="font-mono">{post.like_count}</span>
              </span>
              <span>
                댓글 <span className="font-mono">{post.comment_count}</span>
              </span>
            </span>
          </div>
        </header>

        <PostContent post={post} />

        <div className="flex flex-col items-center gap-4 border-t-2 border-dashed border-ink-subtle pt-5">
          <LikeButton
            postId={post.id}
            liked={liked}
            count={post.like_count}
            disabled={mine}
          />
          {mine && <PostOwnerActions postId={post.id} />}
        </div>
      </Card>

      <section
        aria-labelledby="comments-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="comments-heading" className="text-lg font-bold">
          댓글 <span className="font-mono">{comments.length}</span>
        </h2>
        <Card className="flex flex-col gap-2">
          {comments.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">
              첫 댓글을 남겨 보세요.
            </p>
          ) : (
            <ul className="divide-y-2 divide-sunken">
              {comments
                .filter((c) => !c.parent_id)
                .map((c) => {
                  const replies = comments.filter((r) => r.parent_id === c.id);
                  return (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      postId={post.id}
                      mine={c.author_id === userId}
                      byPostAuthor={c.author_id === post.author_id}
                      hasReplies={replies.length > 0}
                    >
                      {replies.length > 0 && (
                        <ul
                          aria-label="답글"
                          className="ml-4 divide-y-2 divide-sunken border-l-2 border-ink-subtle pl-3 md:ml-8 md:pl-4"
                        >
                          {replies.map((r) => (
                            <CommentItem
                              key={r.id}
                              comment={r}
                              postId={post.id}
                              mine={r.author_id === userId}
                              byPostAuthor={r.author_id === post.author_id}
                            />
                          ))}
                        </ul>
                      )}
                    </CommentItem>
                  );
                })}
            </ul>
          )}
          <div className="border-t-2 border-ink pt-4">
            <CommentForm postId={post.id} />
          </div>
        </Card>
      </section>
    </>
  );
}
