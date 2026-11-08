import Link from "next/link";
import { Suspense } from "react";
import { ChatRoom } from "@/components/chat/chat-room";
import { BlockButton } from "@/components/dm/block-button";
import { MiniAvatar } from "@/components/groups/avatar";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { fetchMessages } from "@/lib/chat/rooms";
import { getThread } from "@/lib/dm";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "대화 · 티어리딩" };

export default function Page(props: PageProps<"/dm/[threadId]">) {
  return (
    <div className="chat-viewport mx-auto flex max-w-3xl flex-col gap-3 py-3 md:py-5">
      <Suspense fallback={<LoadingBlock className="flex-1" />}>
        <Conversation params={props.params} />
      </Suspense>
    </div>
  );
}

async function Conversation({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { supabase, userId } = await requireUser(
    `/dm/${encodeURIComponent(threadId)}`,
  );
  const { thread, error } = await getThread(supabase, threadId, userId);
  if (error) return <LoadError id={threadId} />;
  // 없는 대화와 남의 대화는 구분하지 않는다 (RLS가 둘 다 숨긴다)
  if (!thread)
    return (
      <StateMessage
        title="대화를 찾을 수 없어요"
        description="없는 대화이거나 참여하지 않은 대화예요."
        action={{ href: "/dm", label: "메시지 목록으로" }}
        className="my-6"
      />
    );

  const initial = await fetchMessages(supabase, { kind: "dm", id: thread.id });
  if (initial.error) return <LoadError id={threadId} />;

  const disabledReason = thread.canSend
    ? null
    : thread.blockedByMe
      ? "차단한 회원이에요. 차단을 해제하면 메시지를 보낼 수 있어요."
      : "지금은 이 회원에게 메시지를 보낼 수 없어요.";

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href="/dm"
          className="shrink-0 text-sm font-bold text-ink-muted hover:text-ink"
        >
          ← 목록
        </Link>
        <Link
          href={`/u/${thread.other.id}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <MiniAvatar
            nickname={thread.other.nickname}
            src={thread.other.avatar_url}
            className="size-9"
          />
          <h1 className="truncate text-lg font-bold md:text-2xl">
            {thread.other.nickname}
          </h1>
        </Link>
        <BlockButton
          userId={thread.other.id}
          nickname={thread.other.nickname}
          blocked={thread.blockedByMe}
          size="sm"
        />
      </header>
      <ChatRoom
        key={`${thread.id}:${disabledReason ?? ""}`}
        room={{ kind: "dm", id: thread.id }}
        me={userId}
        initial={initial}
        emptyTitle="아직 메시지가 없어요"
        emptyDescription={`${thread.other.nickname} 님에게 첫 메시지를 보내 보세요.`}
        placeholder="메시지를 입력하세요"
        disabledReason={disabledReason}
      />
    </>
  );
}

function LoadError({ id }: { id: string }) {
  return (
    <StateMessage
      tone="error"
      title="대화를 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요."
      action={{ href: `/dm/${encodeURIComponent(id)}`, label: "다시 시도" }}
      className="my-6"
    />
  );
}
