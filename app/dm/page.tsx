import Link from "next/link";
import { Suspense } from "react";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { ChatListRefresh } from "@/components/dm/chat-list-refresh";
import { ChatRowMenu } from "@/components/dm/chat-row-menu";
import { cn } from "@/components/ui/cn";
import {
  chatKey,
  formatThreadTime,
  listChatStates,
  listGroupChats,
  listThreads,
  type ChatState,
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

const NO_STATE: ChatState = {
  pinnedAt: null,
  muted: false,
  unread: 0,
  hidden: false,
};

type Row = {
  key: string;
  kind: "group" | "dm";
  roomId: string;
  title: string;
  href: string;
  lastAt: string;
  preview: string;
  state: ChatState;
  cannotLeave?: string;
  avatar: React.ReactNode;
  badges: React.ReactNode;
};

const flat = (body: string) => body.replace(/\s+/g, " ");

async function ThreadList() {
  const { supabase, userId } = await requireUser("/dm");
  const [dm, groups, states] = await Promise.all([
    listThreads(supabase, userId),
    listGroupChats(supabase, userId),
    listChatStates(supabase),
  ]);

  if (
    dm.error ||
    !dm.threads ||
    groups.error ||
    !groups.chats ||
    states.error ||
    !states.states
  )
    return (
      <StateMessage
        tone="error"
        title="대화 목록을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
        action={{ href: "/dm", label: "다시 시도" }}
      />
    );

  const known = states.states;
  const stateOf = (kind: string, id: string) =>
    known.get(chatKey(kind, id)) ?? NO_STATE;

  const rows: Row[] = [
    ...dm.threads.map((t): Row => ({
      key: chatKey("dm", t.id),
      kind: "dm",
      roomId: t.id,
      title: t.otherNickname,
      href: `/dm/${t.id}`,
      lastAt: t.lastAt,
      state: stateOf("dm", t.id),
      preview:
        t.lastBody === null
          ? "아직 메시지가 없어요"
          : `${t.lastMine ? "나: " : ""}${flat(t.lastBody)}`,
      avatar: (
        <MiniAvatar
          nickname={t.otherNickname}
          src={t.otherAvatarUrl}
          className="size-12"
        />
      ),
      badges: t.blockedByMe && <Badge tone="danger">차단함</Badge>,
    })),
    ...groups.chats.map((g): Row => ({
      key: chatKey("group", g.groupId),
      kind: "group",
      roomId: g.groupId,
      title: g.name,
      href: `/groups/${g.groupId}/chat`,
      lastAt: g.lastAt,
      state: stateOf("group", g.groupId),
      cannotLeave: g.isOwner ? "모임장은 나갈 수 없어요." : undefined,
      preview:
        g.lastBody === null
          ? "아직 대화가 없어요. 첫 인사를 건네 보세요."
          : `${g.lastMine ? "나" : (g.lastSender ?? "알 수 없음")}: ${
              g.lastDeleted ? "삭제된 메시지" : flat(g.lastBody)
            }`,
      avatar: (
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-matcha text-xl"
        >
          🍵
        </span>
      ),
      badges: <Badge tone="matcha">모임</Badge>,
    })),
  ]
    .filter((r) => !r.state.hidden)
    // 상단 고정(먼저 고정한 순) → 최근 대화순
    .sort((a, b) => {
      const pinA = a.state.pinnedAt ? Date.parse(a.state.pinnedAt) : 0;
      const pinB = b.state.pinnedAt ? Date.parse(b.state.pinnedAt) : 0;
      if (Boolean(pinA) !== Boolean(pinB)) return pinA ? -1 : 1;
      if (pinA && pinB && pinA !== pinB) return pinA - pinB;
      return Date.parse(b.lastAt) - Date.parse(a.lastAt);
    });

  if (rows.length === 0)
    return (
      <>
        <ChatListRefresh />
        <StateMessage
          title="아직 나눈 대화가 없어요"
          description="모임에 가입하면 단체 채팅방이 여기에 보여요. 멤버에게 1:1 메시지를 보낼 수도 있어요."
          action={{ href: "/community", label: "모임 둘러보기" }}
        />
      </>
    );

  return (
    <>
      <ChatListRefresh />
      <ul className="flex flex-col rounded-lg border-2 border-ink bg-surface shadow-hard">
        {rows.map((r) => (
          <li
            key={r.key}
            data-chat={r.title}
            className="group/chat relative border-ink not-last:border-b-2 first:rounded-t-[inherit] last:rounded-b-[inherit]"
          >
            <Link
              href={r.href}
              className="flex items-center gap-3 rounded-[inherit] p-3 pr-12 hover:bg-sunken md:p-4 md:pr-12"
            >
              {r.avatar}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  {r.badges}
                  <span className="truncate font-bold">{r.title}</span>
                  {r.state.pinnedAt && (
                    <span role="img" aria-label="상단 고정" className="text-xs">
                      📌
                    </span>
                  )}
                  {r.state.muted && (
                    <span role="img" aria-label="알람 꺼짐" className="text-xs">
                      🔕
                    </span>
                  )}
                  <time
                    dateTime={r.lastAt}
                    className="ml-auto shrink-0 text-xs text-ink-muted"
                  >
                    {formatThreadTime(r.lastAt)}
                  </time>
                </div>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                    {r.preview}
                  </p>
                  {r.state.unread > 0 && (
                    <span
                      aria-label={`안 읽은 메시지 ${r.state.unread}개`}
                      className={cn(
                        "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white",
                        r.state.muted ? "bg-ink-subtle" : "bg-danger",
                      )}
                    >
                      {r.state.unread > 99 ? "99+" : r.state.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <ChatRowMenu
              kind={r.kind}
              roomId={r.roomId}
              title={r.title}
              pinned={Boolean(r.state.pinnedAt)}
              muted={r.state.muted}
              cannotLeave={r.cannotLeave}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
