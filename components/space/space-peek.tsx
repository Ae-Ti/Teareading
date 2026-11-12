"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SpaceDirectory } from "./space-directory";

type Peek = { user_id: string; nickname: string };

// 찻집에 입장하지 않고 지금 누가 있는지만 본다 (track 하지 않음).
// 본인 채널에서 확인한 사람만 세고, 닉네임은 DB에서 읽는다 (space-directory.ts).
export function useSpacePeek() {
  const [people, setPeople] = useState<Peek[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const present = new Set<string>();
    const names = new Map<string, string>();
    let ready = false;
    let active = true;
    const publish = () => {
      if (!active || !ready) return;
      setPeople(
        [...present]
          .filter((id) => names.has(id))
          .map((id) => ({ user_id: id, nickname: names.get(id)! })),
      );
    };
    const directory = new SpaceDirectory(supabase, "teahouse", null, {
      onState: (id, state) => {
        if (!state) present.delete(id);
        else {
          present.add(id);
          if (!names.has(id))
            void supabase
              .from("profiles")
              .select("nickname")
              .eq("id", id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) names.set(id, data.nickname);
                publish();
              });
        }
        publish();
      },
      onLive: () => {},
      onMove: () => {},
      onStatus: (s) => {
        if (s !== "SUBSCRIBED") return;
        ready = true;
        publish();
      },
    });
    directory.start();
    return () => {
      active = false;
      directory.stop();
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
