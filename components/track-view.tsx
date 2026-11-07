"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { track, type EventName } from "@/lib/track";
import type { Json } from "@/types/database";

// 화면 열람 이벤트를 한 번만 기록한다. 렌더링 중 부수효과를 피하려고 클라이언트에서 보낸다.
export function TrackView({
  name,
  props = {},
}: {
  name: EventName;
  props?: Record<string, Json>;
}) {
  const sent = useRef(false);
  const key = JSON.stringify(props);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void track(createClient(), name, JSON.parse(key));
  }, [name, key]);

  return null;
}
