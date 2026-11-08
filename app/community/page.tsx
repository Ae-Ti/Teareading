import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { listGroups } from "@/lib/groups";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "커뮤니티 · 티어리딩" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">커뮤니티</h1>
          <p className="text-sm text-ink-muted">
            차와 책을 좋아하는 사람들의 모임을 찾아보세요.
          </p>
        </div>
        <LinkButton href="/groups/new" size="sm" className="shrink-0">
          모임 만들기
        </LinkButton>
      </div>
      <Suspense fallback={<LoadingBlock />}>
        <GroupList />
      </Suspense>
    </div>
  );
}

async function GroupList() {
  const { supabase, userId } = await requireUser("/community");
  const { groups, error } = await listGroups(supabase, userId);

  if (error) {
    return (
      <StateMessage
        tone="error"
        title="모임 목록을 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  }
  if (groups.length === 0) {
    return (
      <StateMessage
        title="아직 모임이 없어요"
        description="첫 모임을 만들어 함께 읽을 사람을 모아 보세요."
        action={{ href: "/groups/new", label: "모임 만들기" }}
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <li key={g.id}>
          <Link href={`/groups/${g.id}`} className="block h-full">
            <Card className="flex h-full flex-col gap-2 p-4 shadow-hard-sm transition hover:-translate-y-px hover:shadow-hard">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold break-words">{g.name}</h2>
                {g.joined && <Badge tone="matcha">참여 중</Badge>}
              </div>
              {g.description && (
                <p className="line-clamp-2 text-sm text-ink-muted">
                  {g.description}
                </p>
              )}
              <p className="mt-auto text-xs text-ink-subtle">
                모임장 {g.ownerNickname} · 멤버{" "}
                <span className="font-mono">{g.memberCount}</span>명
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
