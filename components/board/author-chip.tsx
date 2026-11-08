import Link from "next/link";
import { MiniAvatar } from "@/components/groups/avatar";
import { cn } from "@/components/ui/cn";
import type { Author } from "@/lib/board";

// 글·댓글 작성자: 아바타 + 닉네임 → 공개 프로필
export function AuthorChip({
  author,
  size = "sm",
  className,
}: {
  author: Author | null;
  size?: "xs" | "sm";
  className?: string;
}) {
  if (!author) return <span className="text-ink-muted">알 수 없음</span>;
  return (
    <Link
      href={`/u/${author.id}`}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 font-bold hover:underline",
        className,
      )}
    >
      <MiniAvatar
        nickname={author.nickname}
        src={author.avatar_url}
        className={size === "xs" ? "size-6 text-[10px]" : "size-8 text-sm"}
      />
      <span className="truncate">{author.nickname}</span>
    </Link>
  );
}
