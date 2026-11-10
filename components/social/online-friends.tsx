"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/time";
import type { Database } from "@/types/database";

export type OnlineFriend =
  Database["public"]["Functions"]["my_online_friends"]["Returns"][number];

const REFRESH_MS = 30_000;

// 대시보드: 지금 접속 중인 친구와 오늘의 독서·다도 시간
export function OnlineFriends({ initial }: { initial: OnlineFriend[] }) {
  const [friends, setFriends] = useState(initial);

  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const { data, error } = await createClient().rpc("my_online_friends");
      if (!error) setFriends(data ?? []);
    };
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">접속 중인 친구</h2>
      {friends.length === 0 ? (
        <p className="text-sm text-ink-muted">지금 접속 중인 친구가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {friends.map((friend) => (
            <li key={friend.id} className="flex items-center gap-3">
              <MiniAvatar nickname={friend.nickname} src={friend.avatar_url} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${friend.id}`}
                  className="block truncate font-bold hover:underline"
                >
                  {friend.nickname}
                </Link>
                <p className="text-xs text-ink-muted">
                  독서 {formatDuration(friend.reading_seconds)} · 다도{" "}
                  {formatDuration(friend.tea_seconds)}
                </p>
              </div>
              {friend.activity && (
                <Badge tone="matcha">
                  {friend.activity === "tea" ? "다도 중" : "독서 중"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
