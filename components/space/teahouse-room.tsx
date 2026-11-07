"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { enterSpace, leaveSpace } from "@/app/space/actions";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { createClient } from "@/lib/supabase/client";
import { detectDevice } from "@/lib/track";
import { SPACE_CHANNEL, type SpacePresence } from "./presence";

type Status = "connecting" | "ready" | "entering" | "inside" | "error";

// 자리 배치 (찻집 그림 위 좌표, %)
const SEATS = [
  { left: 22, top: 58 },
  { left: 50, top: 50 },
  { left: 78, top: 58 },
  { left: 34, top: 78 },
  { left: 66, top: 78 },
  { left: 12, top: 82 },
  { left: 88, top: 82 },
  { left: 50, top: 86 },
];

export function TeahouseRoom({
  me,
  timer,
}: {
  me: Pick<SpacePresence, "user_id" | "nickname" | "avatar_url">;
  timer: SpacePresence["timer"];
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [people, setPeople] = useState<SpacePresence[]>([]);
  const [attempt, setAttempt] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const visitRef = useRef<string | null>(null);
  const insideRef = useRef(false);

  // 채널 연결은 입장 전부터 한다 (지금 몇 명 있는지 보여주기 위해). 입장 = track, 퇴장 = untrack.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(SPACE_CHANNEL, {
      config: { presence: { key: me.user_id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<SpacePresence>();
        // 같은 계정이 탭을 여러 개 열어도 한 명으로 센다 (key = user_id)
        const list = Object.values(state)
          .map((metas) => metas[0])
          .sort((a, b) => a.entered_at.localeCompare(b.entered_at));
        setPeople(list);
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED")
          setStatus((prev) => (prev === "connecting" ? "ready" : prev));
        if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
      });

    return () => {
      if (insideRef.current && visitRef.current) {
        void leaveSpace(visitRef.current, detectDevice());
      }
      insideRef.current = false;
      visitRef.current = null;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [me.user_id, attempt]);

  const enter = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || insideRef.current) return;
    setStatus("entering");
    const res = await channel.track({
      ...me,
      timer,
      entered_at: new Date().toISOString(),
    } satisfies SpacePresence);
    if (res !== "ok") {
      setStatus("error");
      return;
    }
    insideRef.current = true;
    setStatus("inside");
    const { visitId } = await enterSpace(detectDevice());
    visitRef.current = visitId;
  }, [me, timer]);

  const leave = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !insideRef.current) return;
    insideRef.current = false;
    await channel.untrack();
    setStatus("ready");
    if (visitRef.current) {
      await leaveSpace(visitRef.current, detectDevice());
      visitRef.current = null;
    }
  }, []);

  const inside = status === "inside";
  const others = people.filter((p) => p.user_id !== me.user_id);
  const shown = inside ? people : others;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold" aria-live="polite">
          {status === "connecting" && "찻집에 연결하는 중…"}
          {status === "error" && "찻집에 연결하지 못했어요"}
          {(status === "ready" || status === "entering") &&
            (others.length === 0
              ? "지금은 아무도 없어요"
              : `지금 ${others.length}명이 머물고 있어요`)}
          {inside &&
            (others.length === 0
              ? "혼자 있어요 🍵"
              : `${others.length}명과 함께 있어요 🍵`)}
        </p>
        <div className="flex items-center gap-2">
          {timer && (
            <Link href="/dashboard">
              <Badge tone="matcha">
                타이머 진행 중 · {timer === "tea" ? "다도" : "독서"}
              </Badge>
            </Link>
          )}
          {inside ? (
            <Button variant="secondary" onClick={leave}>
              나가기
            </Button>
          ) : status === "error" ? (
            <Button
              variant="secondary"
              onClick={() => {
                setStatus("connecting");
                setAttempt((n) => n + 1);
              }}
            >
              다시 연결
            </Button>
          ) : (
            <Button
              onClick={enter}
              loading={status === "entering"}
              disabled={status === "connecting"}
            >
              찻집 입장
            </Button>
          )}
        </div>
      </div>

      {/* 찻집 그림 */}
      <div
        className={cn(
          "relative h-[26rem] overflow-hidden rounded-lg border-2 border-ink shadow-hard md:h-[32rem]",
          status === "error" && "opacity-60",
        )}
        aria-label="찻집 공간"
      >
        {/* 벽 */}
        <div className="absolute inset-x-0 top-0 h-[45%] bg-[#efe3c8]" />
        {/* 창문 */}
        <div className="absolute top-[8%] left-1/2 grid h-[28%] w-[44%] -translate-x-1/2 grid-cols-3 gap-1 rounded-md border-2 border-ink bg-ink p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-sm bg-[#cfe6f2]" />
          ))}
        </div>
        {/* 선반 */}
        <div className="absolute top-[16%] left-[5%] hidden w-[16%] flex-col gap-2 sm:flex">
          {[
            ["bg-hongcha", "bg-matcha", "bg-yuja"],
            ["bg-hojicha", "bg-surface"],
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-end gap-1 border-b-2 border-ink pb-0.5"
            >
              {row.map((c, j) => (
                <span
                  key={j}
                  className={cn("h-7 w-3 rounded-t-sm border-2 border-ink", c)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute top-[20%] right-[6%] hidden size-12 rounded-full border-2 border-ink bg-matcha sm:block" />
        {/* 바닥 */}
        <div className="absolute inset-x-0 bottom-0 h-[55%] border-t-2 border-ink bg-[repeating-linear-gradient(90deg,#d9b48a_0_48px,#cfa77b_48px_50px)]" />
        {/* 다탁 */}
        <div className="absolute top-[64%] left-1/2 h-[12%] w-[38%] -translate-x-1/2 rounded-lg border-2 border-ink bg-hojicha shadow-hard-sm">
          <span className="absolute top-1/2 left-[30%] size-5 -translate-y-1/2 rounded-full border-2 border-ink bg-surface" />
          <span className="absolute top-1/2 left-[46%] h-6 w-8 -translate-y-1/2 rounded-md border-2 border-ink bg-matcha" />
          <span className="absolute top-1/2 left-[66%] size-5 -translate-y-1/2 rounded-full border-2 border-ink bg-surface" />
        </div>

        {/* 사람들 */}
        {shown.slice(0, SEATS.length).map((p, i) => {
          const seat = SEATS[i];
          const isMe = p.user_id === me.user_id;
          return (
            <div
              key={p.user_id}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-all"
              style={{ left: `${seat.left}%`, top: `${seat.top}%` }}
            >
              <MiniAvatar
                nickname={p.nickname}
                src={p.avatar_url}
                className={cn(
                  "size-12 shadow-hard-sm",
                  isMe ? "bg-matcha" : "bg-surface",
                )}
              />
              <span className="max-w-24 truncate rounded-sm border-2 border-ink bg-surface px-1.5 text-xs font-bold">
                {isMe ? "나" : p.nickname}
              </span>
              {p.timer && (
                <span className="text-[10px] font-bold">
                  {p.timer === "tea" ? "☕ 다도 중" : "📖 독서 중"}
                </span>
              )}
            </div>
          );
        })}
        {shown.length > SEATS.length && (
          <span className="absolute right-3 bottom-3 rounded-sm border-2 border-ink bg-surface px-2 text-sm font-bold">
            +{shown.length - SEATS.length}명
          </span>
        )}

        {!inside && status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/10">
            <p className="rounded-md border-2 border-ink bg-surface px-4 py-2 text-sm font-bold shadow-hard-sm">
              입장하면 다른 사람들에게 내 닉네임이 보여요
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p
              role="alert"
              className="rounded-md border-2 border-danger bg-danger-soft px-4 py-2 text-sm font-bold"
            >
              네트워크 상태를 확인하고 다시 연결해 주세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
