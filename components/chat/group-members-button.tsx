"use client";

import { useEffect, useState } from "react";
import { StartDmButton } from "@/components/dm/start-dm-button";
import { MiniAvatar } from "@/components/groups/avatar";
import type { MemberRole } from "@/components/groups/member-row";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Modal } from "@/components/ui/modal";

// 단체 채팅방 상단의 '모임 멤버': 누가 있는지 보고 프로필·1:1 채팅으로 이동한다.
export function GroupMembersButton({
  members,
  me,
}: {
  members: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    role: MemberRole;
  }[];
  me: string;
}) {
  const [open, setOpen] = useState(false);
  // 프로필·1:1 채팅으로 갔다가 돌아왔을 때 팝업이 다시 열려 있지 않게 한다
  useEffect(() => () => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md border-2 border-ink bg-surface px-2.5 py-1 text-sm font-bold whitespace-nowrap hover:bg-sunken"
      >
        <span className="hidden sm:inline">모임 </span>멤버{" "}
        <span className="font-mono">{members.length}</span>명
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`모임 멤버 ${members.length}명`}
      >
        <ul className="flex flex-col divide-y-2 divide-sunken">
          {members.map((m) => (
            <li
              key={m.id}
              data-member={m.nickname}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
            >
              <span className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                <MiniAvatar
                  nickname={m.nickname}
                  src={m.avatar_url}
                  className="size-9"
                />
                <span className="truncate font-bold">{m.nickname}</span>
                {m.role === "owner" && <Badge tone="yuja">모임장</Badge>}
                {m.role === "manager" && <Badge tone="hojicha">부모임장</Badge>}
                {m.id === me && (
                  <span className="shrink-0 text-xs text-ink-muted">나</span>
                )}
              </span>
              <span className="flex shrink-0 items-start gap-1.5">
                <LinkButton
                  href={`/u/${m.id}`}
                  size="sm"
                  variant="secondary"
                  className="whitespace-nowrap"
                >
                  프로필 보기
                </LinkButton>
                {m.id !== me && (
                  <StartDmButton
                    userId={m.id}
                    size="sm"
                    label="1:1 채팅하기"
                    className="flex max-w-40 flex-col items-end gap-1"
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
