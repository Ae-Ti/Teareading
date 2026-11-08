import Link from "next/link";
import { Suspense } from "react";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  formatThreadTime,
  listGroupChats,
  listThreads,
  type DmThreadSummary,
  type GroupChatSummary,
} from "@/lib/dm";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "메시지 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6 md:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-4xl">메시지</h1>
        <p className="text-sm text-ink-muted">
          모임 단체 채팅방과 1:1 대화를 한곳에서 확인해요.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock className="h-72" />}>
        <ThreadList />
      </Suspense>
    </div>
  );
}

type Row =
  ({ kind: "dm" } & DmThreadSummary) | ({ kind: "group" } & GroupChatSummary);

async function ThreadList() {
  const { supabase, userId } = await requireUser("/dm");
  const [dm, groups] = await Promise.all([
    listThreads(supabase, userId),
    listGroupChats(supabase, userId),
  ]);

  if (dm.error || !dm.threads || groups.error || !groups.chats)
    return (
      <StateMessage
        tone="error"
        title="대화 목록을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
        action={{ href: "/dm", label: "다시 시도" }}
      />
    );

  // 1:1 대화와 모임 단체 채팅을 최근 대화순으로 한 목록에
  const rows: Row[] = [
    ...dm.threads.map((t) => ({ kind: "dm" as const, ...t })),
    ...groups.chats.map((g) => ({ kind: "group" as const, ...g })),
  ].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));

  if (rows.length === 0)
    return (
      <StateMessage
        title="아직 나눈 대화가 없어요"
        description="모임에 가입하면 단체 채팅방이 여기에 보여요. 멤버에게 1:1 메시지를 보낼 수도 있어요."
        action={{ href: "/community", label: "모임 둘러보기" }}
      />
    );

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-hard">
      {rows.map((r) =>
        r.kind === "group" ? (
          <li key={`g:${r.groupId}`} className="border-ink not-last:border-b-2">
            <Link
              href={`/groups/${r.groupId}/chat`}
              className="flex items-center gap-3 p-3 hover:bg-sunken md:p-4"
            >
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-matcha text-xl"
              >
                🍵
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Badge tone="matcha">모임</Badge>
                  <span className="truncate font-bold">{r.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">
                    {r.memberCount}
                  </span>
                  <time
                    dateTime={r.lastAt}
                    className="ml-auto shrink-0 text-xs text-ink-muted"
                  >
                    {formatThreadTime(r.lastAt)}
                  </time>
                </div>
                <p className="truncate text-sm text-ink-muted">
                  {r.lastBody === null
                    ? "아직 대화가 없어요. 첫 인사를 건네 보세요."
                    : `${r.lastMine ? "나" : (r.lastSender ?? "알 수 없음")}: ${
                        r.lastDeleted
                          ? "삭제된 메시지"
                          : r.lastBody.replace(/\s+/g, " ")
                      }`}
                </p>
              </div>
            </Link>
          </li>
        ) : (
          <li key={`d:${r.id}`} className="border-ink not-last:border-b-2">
            <Link
              href={`/dm/${r.id}`}
              className="flex items-center gap-3 p-3 hover:bg-sunken md:p-4"
            >
              <MiniAvatar
                nickname={r.otherNickname}
                src={r.otherAvatarUrl}
                className="size-12"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{r.otherNickname}</span>
                  {r.blockedByMe && <Badge tone="danger">차단함</Badge>}
                  <time
                    dateTime={r.lastAt}
                    className="ml-auto shrink-0 text-xs text-ink-muted"
                  >
                    {formatThreadTime(r.lastAt)}
                  </time>
                </div>
                <p className="truncate text-sm text-ink-muted">
                  {r.lastBody === null
                    ? "아직 메시지가 없어요"
                    : `${r.lastMine ? "나: " : ""}${r.lastBody.replace(/\s+/g, " ")}`}
                </p>
              </div>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
