"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SPACE_CHANNEL, type SpacePresence } from "./presence";

// 찻집에 입장하지 않고 지금 몇 명이 있는지만 본다 (track 하지 않음)
export function useSpacePeek() {
  const [people, setPeople] = useState<SpacePresence[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(SPACE_CHANNEL, {
      config: { private: true },
    });
    let active = true;
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<SpacePresence>();
      setPeople(Object.values(state).map((metas) => metas[0]));
    });
    // 비공개 채널은 로그인 토큰이 있어야 해서, 토큰을 넘긴 뒤 연결한다
    void supabase.realtime.setAuth().finally(() => {
      if (active) channel.subscribe();
    });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return people;
}

export function SpacePeekText() {
  const people = useSpacePeek();
  if (people === null)
    return <span className="text-sm text-ink-muted">확인하는 중…</span>;
  if (people.length === 0)
    return (
      <span className="text-sm">
        지금은 아무도 없어요. 첫 손님이 되어 보세요.
      </span>
    );
  return (
    <span className="flex items-center gap-3">
      <span className="flex -space-x-2">
        {people.slice(0, 4).map((p) => (
          <span
            key={p.user_id}
            className="flex size-10 items-center justify-center rounded-full border-2 border-ink bg-surface font-bold"
          >
            {p.nickname.slice(0, 1)}
          </span>
        ))}
      </span>
      <span className="text-sm">
        {people[0].nickname} 님
        {people.length > 1 ? ` 외 ${people.length - 1}명이` : "이"} 머물고
        있어요
      </span>
    </span>
  );
}
