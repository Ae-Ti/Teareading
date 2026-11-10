import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
import { CATEGORIES, formatBoardDate, type Category } from "@/lib/board";
import type { getMyActivity } from "@/lib/profile/data";

// 내 프로필: 내가 쓴 글과 댓글
export function MyActivity({
  activity,
}: {
  activity: Awaited<ReturnType<typeof getMyActivity>>;
}) {
  return (
    <>
      <section className="space-y-4" aria-labelledby="my-posts-heading">
        <h2 id="my-posts-heading" className="text-xl font-bold">
          내가 쓴 글
        </h2>
        {activity.error ? (
          <StateMessage tone="error" title="글을 불러오지 못했어요" />
        ) : activity.posts.length === 0 ? (
          <StateMessage title="아직 쓴 글이 없어요" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y-2 divide-sunken">
              {activity.posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/board/${post.id}`}
                    className="flex items-center gap-2 p-3 hover:bg-sunken"
                  >
                    <span className="shrink-0 text-xs font-bold text-ink-muted">
                      {CATEGORIES[post.category as Category]}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {post.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-ink-muted">
                      {formatBoardDate(post.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
      <section className="space-y-4" aria-labelledby="my-comments-heading">
        <h2 id="my-comments-heading" className="text-xl font-bold">
          내가 쓴 댓글
        </h2>
        {activity.error ? (
          <StateMessage tone="error" title="댓글을 불러오지 못했어요" />
        ) : activity.comments.length === 0 ? (
          <StateMessage title="아직 쓴 댓글이 없어요" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y-2 divide-sunken">
              {activity.comments.map((comment) => (
                <li key={comment.id}>
                  <Link
                    href={`/board/${comment.post_id}`}
                    className="flex flex-col gap-0.5 p-3 hover:bg-sunken"
                  >
                    <span className="truncate">{comment.body}</span>
                    <span className="truncate text-xs text-ink-muted">
                      {comment.post?.title ?? "삭제된 글"} ·{" "}
                      <span className="font-mono">
                        {formatBoardDate(comment.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
