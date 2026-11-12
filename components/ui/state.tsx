import Link from "next/link";
import { cn } from "./cn";

// 빈 상태·오류·권한 없음 안내. 명세서의 "표시" 항목을 화면마다 같은 모양으로 보여준다.
export function StateMessage({
  title,
  description,
  action,
  tone = "empty",
  className,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  tone?: "empty" | "error";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border-2 p-8 text-center",
        tone === "error"
          ? "border-danger bg-danger-soft"
          : "border-dashed border-ink-subtle",
        className,
      )}
    >
      <p className="font-bold">{title}</p>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="inline-flex h-9 items-center rounded-md border-2 border-ink bg-matcha px-3 text-sm font-bold shadow-hard"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy
      aria-label="불러오는 중"
      className={cn(
        "h-40 animate-pulse rounded-lg border-2 border-ink-subtle bg-sunken",
        className,
      )}
    />
  );
}
