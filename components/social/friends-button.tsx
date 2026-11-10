"use client";

import Link from "next/link";
import { useState } from "react";
import { MiniAvatar } from "@/components/groups/avatar";
import { Modal } from "@/components/ui/modal";
import type { Friend } from "@/lib/social/data";

// "친구 N명" 버튼. 누르면 어떤 사람들과 친구인지 보여 준다.
export function FriendsButton({ friends }: { friends: Friend[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold underline underline-offset-4"
      >
        친구 <span className="font-mono">{friends.length}</span>명
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="친구">
        {friends.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">
            아직 친구가 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {friends.map((friend) => (
              <li key={friend.id}>
                <Link
                  href={`/u/${friend.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md p-1.5 font-bold hover:bg-sunken"
                >
                  <MiniAvatar
                    nickname={friend.nickname}
                    src={friend.avatar_url}
                  />
                  <span className="min-w-0 truncate">{friend.nickname}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
