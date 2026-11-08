import { StartDmButton } from "@/components/dm/start-dm-button";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";

export type MemberRole = "owner" | "manager" | "member";

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "모임장",
  manager: "부모임장",
  member: "멤버",
};

// 모임 멤버 한 줄. 마우스를 올리거나(키보드 포커스 포함) 하면 옆에 '메시지 보내기'·'프로필 보기'가 뜬다.
// 마우스가 없는 터치 기기에서는 항상 보인다.
export function MemberRow({
  member,
  isMe,
  muted,
}: {
  member: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    role: MemberRole;
  };
  isMe: boolean;
  muted?: boolean;
}) {
  return (
    <li
      className="group/member relative flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-2 border-transparent p-1.5 hover:border-ink focus-within:border-ink"
      data-member={member.nickname}
    >
      <MiniAvatar nickname={member.nickname} src={member.avatar_url} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate font-bold">{member.nickname}</span>
        {member.role === "owner" && <Badge tone="yuja">모임장</Badge>}
        {member.role === "manager" && <Badge tone="hojicha">부모임장</Badge>}
        {muted && <Badge tone="danger">메시지 차단</Badge>}
        {isMe && <span className="shrink-0 text-xs text-ink-muted">나</span>}
      </span>
      <span className="member-actions flex shrink-0 items-center gap-1.5">
        {!isMe && (
          <StartDmButton
            userId={member.id}
            size="sm"
            label="메시지 보내기"
            className="flex flex-col items-end gap-1"
          />
        )}
        <LinkButton href={`/u/${member.id}`} size="sm" variant="secondary">
          프로필 보기
        </LinkButton>
      </span>
    </li>
  );
}
