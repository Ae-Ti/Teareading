import Link from "next/link";
import { Suspense } from "react";
import { ChatRoom } from "@/components/chat/chat-room";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { fetchMessages } from "@/lib/chat/rooms";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "단체 채팅 · 티어리딩" };

export default function Page(props: PageProps<"/groups/[id]/chat">) {
  return (
    <div className="chat-viewport flex flex-col gap-3 py-3 md:py-5">
      <Suspense fallback={<LoadingBlock className="flex-1" />}>
        <GroupChat params={props.params} />
      </Suspense>
    </div>
  );
}

async function GroupChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(
    `/groups/${encodeURIComponent(id)}/chat`,
  );
  if (!isUuid(id)) return <NotFound />;

  const group = await supabase
    .from("groups")
    .select("id, name, group_members(count)")
    .eq("id", id)
    .maybeSingle();
  if (group.error) return <LoadError id={id} />;
  if (!group.data) return <NotFound />;

  // 화면 안내용 확인. 실제 조회·전송 권한은 RLS(is_group_member)가 막는다.
  // 역할 표시(모임장·부모임장)와 내 권한·전송 제한 여부
  const [roster, mute] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", id)
      .in("role", ["owner", "manager"]),
    supabase
      .from("group_mutes")
      .select("user_id")
      .eq("group_id", id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const membership = await supabase
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership.error || roster.error) return <LoadError id={id} />;
  if (!membership.data)
    return (
      <StateMessage
        title="모임에 가입해야 볼 수 있어요"
        description="단체 채팅은 모임 멤버만 읽고 쓸 수 있어요."
        action={{ href: `/groups/${id}`, label: "모임 보러 가기" }}
        className="my-6"
      />
    );

  const initial = await fetchMessages(supabase, { kind: "group", id });
  if (initial.error) return <LoadError id={id} />;
  const memberCount = group.data.group_members[0]?.count ?? 0;
  const roles = Object.fromEntries(
    (roster.data ?? []).map((r) => [r.user_id, r.role as "owner" | "manager"]),
  );
  const myRole = membership.data.role;
  const canModerate = myRole === "owner" || myRole === "manager";

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href={`/groups/${id}`}
          className="shrink-0 text-sm font-bold text-ink-muted hover:text-ink"
        >
          ← 모임
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold md:text-2xl">
          {group.data.name}
        </h1>
        <span className="shrink-0 text-sm text-ink-muted">
          멤버 <span className="font-mono">{memberCount}</span>명
        </span>
      </header>
      <ChatRoom
        key={`${id}:${mute.data ? "muted" : ""}`}
        room={{ kind: "group", id }}
        me={userId}
        initial={initial}
        emptyTitle="아직 대화가 없어요"
        emptyDescription="모임 사람들에게 첫 인사를 건네 보세요."
        placeholder="메시지를 입력하세요"
        roles={roles}
        canModerate={canModerate}
        disabledReason={
          mute.data
            ? "모임 관리자가 메시지 보내기를 막았어요. 읽기만 할 수 있어요."
            : null
        }
      />
    </>
  );
}

function NotFound() {
  return (
    <StateMessage
      title="모임을 찾을 수 없어요"
      description="삭제되었거나 없는 모임이에요."
      action={{ href: "/community", label: "커뮤니티로" }}
      className="my-6"
    />
  );
}

function LoadError({ id }: { id: string }) {
  return (
    <StateMessage
      tone="error"
      title="채팅을 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요."
      action={{ href: `/groups/${id}/chat`, label: "다시 시도" }}
      className="my-6"
    />
  );
}
