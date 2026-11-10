import { readBlocks } from "@/lib/board";

// 글 본문: 글과 사진을 쓴 순서대로 보여 준다. 사진 없는 글은 본문 그대로.
export function PostContent({
  post,
}: {
  post: { body: string; content: unknown; author_id: string };
}) {
  const blocks = readBlocks(post.content, post.author_id);
  if (!blocks)
    return (
      <div className="min-h-32 leading-relaxed break-words whitespace-pre-wrap">
        {post.body}
      </div>
    );
  return (
    <div className="flex min-h-32 flex-col gap-4">
      {blocks.map((block, i) =>
        block.type === "text" ? (
          <p
            key={i}
            className="leading-relaxed break-words whitespace-pre-wrap"
          >
            {block.text}
          </p>
        ) : (
          // 사용자가 올린 사진은 크기를 미리 알 수 없어 img를 쓴다
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={block.url}
            alt="글에 넣은 사진"
            loading="lazy"
            className="max-w-full self-center rounded-md border-2 border-ink"
          />
        ),
      )}
    </div>
  );
}
