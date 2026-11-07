import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { RECORD_KINDS, type RecordKind } from "@/lib/records";

// 개인 페이지(내 기록) 상단 탭
export function RecordTabs({ active }: { active: RecordKind }) {
  return (
    <nav aria-label="내 기록" className="flex gap-2 border-b-2 border-ink">
      {(Object.keys(RECORD_KINDS) as RecordKind[]).map((kind) => (
        <Link
          key={kind}
          href={RECORD_KINDS[kind].path}
          aria-current={kind === active ? "page" : undefined}
          className={cn(
            "-mb-0.5 rounded-t-md border-2 px-4 py-2 font-bold",
            kind === active
              ? "border-ink border-b-canvas bg-canvas"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {RECORD_KINDS[kind].label}
        </Link>
      ))}
    </nav>
  );
}
