import Link from "next/link";
import { Suspense } from "react";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { formatThreadTime, listThreads } from "@/lib/dm";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "메시지 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6 md:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-4xl">메시지</h1>
        <p className="text-sm text-ink-muted">
          모임에서 만난 사람과 1:1로 이야기를 나눠요.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock className="h-72" />}>
        <ThreadList />
      </Suspense>
    </div>
  );
}

async function ThreadList() {
  const { supabase, userId } = await requireUser("/dm");
  const { threads, error } = await listThreads(supabase, userId);

  if (error || !threads)
    return (
      <StateMessage
        tone="error"
        title="대화 목록을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
        action={{ href: "/dm", label: "다시 시도" }}
      />
    );
  if (threads.length === 0)
    return (
      <StateMessage
        title="아직 나눈 대화가 없어요"
        description="모임 멤버의 프로필에서 '메시지 보내기'를 눌러 대화를 시작해 보세요."
        action={{ href: "/community", label: "모임 둘러보기" }}
      />
    );

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-hard">
      {threads.map((t) => (
        <li key={t.id} className="border-ink not-last:border-b-2">
          <Link
            href={`/dm/${t.id}`}
            className="flex items-center gap-3 p-3 hover:bg-sunken md:p-4"
          >
            <MiniAvatar
              nickname={t.otherNickname}
              src={t.otherAvatarUrl}
              className="size-12"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{t.otherNickname}</span>
                {t.blockedByMe && <Badge tone="danger">차단함</Badge>}
                <time
                  dateTime={t.lastAt}
                  className="ml-auto shrink-0 text-xs text-ink-muted"
                >
                  {formatThreadTime(t.lastAt)}
                </time>
              </div>
              <p className="truncate text-sm text-ink-muted">
                {t.lastBody === null
                  ? "아직 메시지가 없어요"
                  : `${t.lastMine ? "나: " : ""}${t.lastBody.replace(/\s+/g, " ")}`}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
