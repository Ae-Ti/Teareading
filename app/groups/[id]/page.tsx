import Link from "next/link";
import { Suspense } from "react";
import {
  GroupSettingsButton,
  MemberManageButton,
} from "@/components/groups/group-admin";
import { MemberRow, type MemberRole } from "@/components/groups/member-row";
import { MembershipButton } from "@/components/groups/membership-button";
import { TrackView } from "@/components/track-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getGroup } from "@/lib/groups";
import { requireUser } from "@/lib/supabase/user";
import { formatKoreanDate } from "@/lib/time";

export default function Page(props: PageProps<"/groups/[id]">) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <Link
        href="/community"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 커뮤니티
      </Link>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <GroupDetail params={props.params} />
      </Suspense>
    </div>
  );
}

async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(`/groups/${id}`);
  const { group, members, error } = await getGroup(supabase, id);

  if (error)
    return (
      <StateMessage
        tone="error"
        title="모임을 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  if (!group) {
    return (
      <StateMessage
        title="모임을 찾을 수 없어요"
        description="삭제되었거나 없는 모임이에요."
        action={{ href: "/community", label: "커뮤니티로" }}
      />
    );
  }

  const isOwner = group.owner_id === userId;
  const myRole = members.find((m) => m.profile.id === userId)?.role as
    MemberRole | undefined;
  const isMember = Boolean(myRole);
  const isModerator = myRole === "owner" || myRole === "manager";
  // 메시지 차단 목록은 모임 멤버만 볼 수 있다 (RLS)
  const { data: mutes } = isMember
    ? await supabase
        .from("group_mutes")
        .select("user_id")
        .eq("group_id", group.id)
    : { data: [] };
  const muted = new Set((mutes ?? []).map((m) => m.user_id));
  // 내보내진 본인에게는 가입 버튼 대신 안내를, 모임장에게는 재가입 허용 목록을 보여 준다
  const { data: bans } = await supabase
    .from("group_bans")
    .select(
      "user_id, profile:profiles!group_bans_user_id_fkey(id, nickname, avatar_url)",
    )
    .eq("group_id", group.id)
    .order("created_at", { ascending: false });
  const iAmBanned = (bans ?? []).some((b) => b.user_id === userId);
  const banned = isOwner ? (bans ?? []).flatMap((b) => b.profile ?? []) : [];
  const roster = members.map((m) => ({
    id: m.profile.id,
    nickname: m.profile.nickname,
    avatar_url: m.profile.avatar_url,
    role: (m.role as MemberRole) ?? "member",
    muted: muted.has(m.profile.id),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <TrackView name="group_viewed" props={{ group_id: group.id }} />

      <Card className="flex flex-col gap-5 p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="matcha">모임</Badge>
          {isOwner ? (
            <Badge tone="yuja">내가 모임장</Badge>
          ) : myRole === "manager" ? (
            <Badge tone="hojicha">내가 부모임장</Badge>
          ) : (
            isMember && <Badge>참여 중</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold break-words md:text-4xl">
          {group.name}
        </h1>
        <p className="leading-relaxed break-words whitespace-pre-wrap text-ink-muted">
          {group.description || "아직 소개가 없어요."}
        </p>
        <p className="text-xs text-ink-subtle">
          {formatKoreanDate(group.created_at)} 개설
        </p>

        <div className="flex flex-wrap items-start gap-3 border-t-2 border-ink pt-5">
          {isMember ? (
            <LinkButton href={`/groups/${group.id}/chat`}>
              단체 채팅방
            </LinkButton>
          ) : iAmBanned ? (
            <p role="status" className="w-full text-sm text-ink-muted">
              모임장이 내보낸 모임이라 다시 가입할 수 없어요.
            </p>
          ) : (
            <p className="w-full text-sm text-ink-muted">
              가입하면 단체 채팅방에 들어갈 수 있어요.
            </p>
          )}
          {isOwner && (
            <GroupSettingsButton
              groupId={group.id}
              name={group.name}
              description={group.description}
            />
          )}
          {isModerator && (
            <MemberManageButton
              groupId={group.id}
              myRole={myRole}
              me={userId}
              members={roster}
              banned={banned}
            />
          )}
          {!isOwner && !iAmBanned && (
            <MembershipButton groupId={group.id} joined={isMember} />
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">
          멤버 <span className="font-mono">{members.length}</span>명
        </h2>
        <ul className="flex flex-col gap-1">
          {roster.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={m.id === userId}
              muted={isModerator && m.muted}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}
