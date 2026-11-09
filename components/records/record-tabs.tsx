import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { RECORD_KINDS, type RecordKind } from "@/lib/records";

// 개인 페이지(내 기록) 상단 탭
export function RecordTabs({ active }: { active: RecordKind | "stats" }) {
  const tabs = [
    ...(Object.keys(RECORD_KINDS) as RecordKind[]).map((kind) => ({
      key: kind as RecordKind | "stats",
      href: RECORD_KINDS[kind].path as string,
      label: RECORD_KINDS[kind].label as string,
    })),
    { key: "stats" as const, href: "/me/stats", label: "통계" },
  ];
  return (
    <nav aria-label="내 기록" className="flex gap-2 border-b-2 border-ink">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-0.5 rounded-t-md border-2 px-3 py-2 font-bold whitespace-nowrap md:px-4",
            tab.key === active
              ? "border-ink border-b-canvas bg-canvas"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
