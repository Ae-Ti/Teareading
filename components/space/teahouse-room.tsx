"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { enterSpace, leaveSpace } from "@/app/space/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { defaultLook, parseLook, type Look } from "@/lib/space/look";
import {
  isWalkable,
  seatAt,
  seatById,
  SPAWN,
  type Dir,
  type Point,
} from "@/lib/space/map";
import { findPath, isValidPath, nearestWalkable } from "@/lib/space/path";
import { createClient } from "@/lib/supabase/client";
import { detectDevice } from "@/lib/track";
import { AvatarEditor } from "./avatar-editor";
import { TeahouseScene } from "./pixel/scene";
import {
  MOVE_EVENT,
  SPACE_CHANNEL,
  type MoveMessage,
  type SpacePresence,
} from "./presence";

type Status = "connecting" | "ready" | "entering" | "inside" | "error";

const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};
const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function timerStatus(
  timer: SpacePresence["timer"],
  startedAt: string | null | undefined,
  now: number,
) {
  if (!timer) return "";
  const icon = timer === "tea" ? "☕" : "📖";
  if (!startedAt) return `${icon} ${timer === "tea" ? "다도" : "독서"} 중`;
  const min = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 60000),
  );
  return `${icon} ${min}분`;
}

export function TeahouseRoom({
  me,
  initialLook,
  timer,
  timerStartedAt,
}: {
  me: Pick<SpacePresence, "user_id" | "nickname" | "avatar_url">;
  initialLook: Look;
  timer: SpacePresence["timer"];
  timerStartedAt: string | null;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [people, setPeople] = useState<SpacePresence[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [look, setLook] = useState(initialLook);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TeahouseScene | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const visitRef = useRef<string | null>(null);
  const insideRef = useRef(false);
  const othersRef = useRef<SpacePresence[]>([]);
  const myStateRef = useRef<SpacePresence | null>(null);
  const trackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // 내 상태(위치·자리·캐릭터)를 Presence에 반영. 연달아 바뀌면 마지막 것만 보낸다.
  const pushState = useCallback((patch: Partial<SpacePresence>) => {
    if (!myStateRef.current) return;
    myStateRef.current = { ...myStateRef.current, ...patch };
    if (trackTimer.current) clearTimeout(trackTimer.current);
    trackTimer.current = setTimeout(() => {
      if (insideRef.current && myStateRef.current)
        void channelRef.current?.track(myStateRef.current);
    }, 300);
  }, []);

  const seatTakenByOther = useCallback(
    (seatId: string) => othersRef.current.some((p) => p.seat === seatId),
    [],
  );

  // 내 캐릭터를 경로대로 걷게 하고 다른 사람에게 경로를 보낸다
  const moveMe = useCallback(
    (target: Point) => {
      const scene = sceneRef.current;
      if (!scene || !insideRef.current) return;
      const from = scene.planStart(me.user_id);
      if (!from) return;
      const path = findPath(from, target);
      if (!path) return;
      scene.walk(me.user_id, from, path, true);
      if (myStateRef.current?.seat) pushState({ seat: null });
      void channelRef.current?.send({
        type: "broadcast",
        event: MOVE_EVENT,
        payload: { user_id: me.user_id, from, path } satisfies MoveMessage,
      });
    },
    [me.user_id, pushState],
  );

  // 장면은 한 번만 만든다
  useEffect(() => {
    const scene = new TeahouseScene(canvasRef.current!, overlayRef.current!, {
      onTap: (tile) => {
        if (!insideRef.current) return;
        const seat = seatAt(tile.x, tile.y);
        if (seat && seatTakenByOther(seat.id)) {
          showToast("이미 다른 분이 앉아 있어요");
          return;
        }
        const from = sceneRef.current?.planStart(me.user_id) ?? SPAWN;
        const target = seat ? tile : nearestWalkable(tile, from);
        if (target) moveMe(target);
      },
      onArrive: (tile, dir) => {
        const seat = seatAt(tile.x, tile.y);
        if (seat && !seatTakenByOther(seat.id)) {
          sceneRef.current?.sit(me.user_id, seat.face);
          pushState({ pos: tile, dir: seat.face, seat: seat.id });
        } else {
          if (seat) showToast("이미 다른 분이 앉아 있어요");
          pushState({ pos: tile, dir, seat: null });
        }
      },
    });
    sceneRef.current = scene;
    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [me.user_id, moveMe, pushState, seatTakenByOther, showToast]);

  // 다른 사람 캐릭터를 Presence 상태에 맞춘다
  const syncOthers = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const now = Date.now();
    const present = new Set<string>();
    for (const p of othersRef.current) {
      present.add(p.user_id);
      const seat = seatById(p.seat);
      const pos = p.pos && isWalkable(p.pos.x, p.pos.y) ? p.pos : SPAWN;
      scene.upsert(p.user_id, {
        look: parseLook(p.look) ?? defaultLook(p.user_id),
        name: p.nickname,
        status: timerStatus(p.timer, p.timer_started_at, now),
        tile: pos,
        dir: seat?.face ?? p.dir ?? "down",
        sitting: !!seat && seat.x === pos.x && seat.y === pos.y,
      });
    }
    for (const id of scene.ids()) {
      if (id !== me.user_id && !present.has(id)) scene.remove(id);
    }
  }, [me.user_id]);

  // 채널 연결은 입장 전부터 한다 (지금 누가 있는지 보여주기 위해). 입장 = track, 퇴장 = untrack.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(SPACE_CHANNEL, {
      config: { presence: { key: me.user_id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<SpacePresence>();
        // 같은 계정이 탭을 여러 개 열어도 한 명으로 센다 (key = user_id)
        const list = Object.values(state)
          .map((metas) => metas[0])
          .sort((a, b) => a.entered_at.localeCompare(b.entered_at));
        othersRef.current = list.filter((p) => p.user_id !== me.user_id);
        setPeople(list);
        syncOthers();
      })
      .on("broadcast", { event: MOVE_EVENT }, ({ payload }) => {
        const msg = payload as MoveMessage;
        if (!msg || msg.user_id === me.user_id || !msg.from) return;
        if (!othersRef.current.some((p) => p.user_id === msg.user_id)) return;
        if (
          !isWalkable(msg.from.x, msg.from.y) ||
          !isValidPath(msg.from, msg.path)
        )
          return;
        sceneRef.current?.walk(msg.user_id, msg.from, msg.path);
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
      myStateRef.current = null;
      sceneRef.current?.remove(me.user_id);
      void supabase.removeChannel(channel);
    };
  }, [me.user_id, attempt, syncOthers]);

  // 타이머 분 표시는 30초마다 다시 계산한다
  useEffect(() => {
    const id = setInterval(() => {
      syncOthers();
      const scene = sceneRef.current;
      if (scene && insideRef.current)
        scene.upsert(me.user_id, {
          look,
          name: me.nickname,
          status: timerStatus(timer, timerStartedAt, Date.now()),
          isMe: true,
        });
    }, 30_000);
    return () => clearInterval(id);
  }, [syncOthers, me.user_id, me.nickname, look, timer, timerStartedAt]);

  const enter = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || insideRef.current) return;
    setStatus("entering");
    const state: SpacePresence = {
      ...me,
      timer,
      timer_started_at: timerStartedAt,
      entered_at: new Date().toISOString(),
      look,
      pos: SPAWN,
      dir: "up",
      seat: null,
    };
    const res = await channel.track(state);
    if (res !== "ok") {
      setStatus("error");
      return;
    }
    myStateRef.current = state;
    insideRef.current = true;
    sceneRef.current?.upsert(me.user_id, {
      look,
      name: me.nickname,
      status: timerStatus(timer, timerStartedAt, Date.now()),
      tile: SPAWN,
      dir: "up",
      isMe: true,
    });
    setStatus("inside");
    // 들어오자마자 방향키로 움직일 수 있게
    canvasRef.current?.parentElement?.focus();
    const { visitId } = await enterSpace(detectDevice());
    visitRef.current = visitId;
  }, [me, timer, timerStartedAt, look]);

  const leave = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !insideRef.current) return;
    insideRef.current = false;
    myStateRef.current = null;
    sceneRef.current?.remove(me.user_id);
    await channel.untrack();
    setStatus("ready");
    if (visitRef.current) {
      await leaveSpace(visitRef.current, detectDevice());
      visitRef.current = null;
    }
  }, [me.user_id]);

  const onKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      const dir = KEYS[ev.key];
      if (!dir || !insideRef.current) return;
      ev.preventDefault();
      const scene = sceneRef.current;
      if (!scene || !scene.isIdle(me.user_id)) return;
      const from = scene.planStart(me.user_id)!;
      const to = { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
      const seat = seatAt(to.x, to.y);
      if (isWalkable(to.x, to.y) && !(seat && seatTakenByOther(seat.id))) {
        moveMe(to);
      } else {
        scene.turn(me.user_id, dir);
        pushState({ dir, seat: null });
      }
    },
    [me.user_id, moveMe, pushState, seatTakenByOther],
  );

  const onSaved = useCallback(
    (next: Look) => {
      setLook(next);
      setEditing(false);
      if (insideRef.current) {
        sceneRef.current?.upsert(me.user_id, {
          look: next,
          name: me.nickname,
          status: timerStatus(timer, timerStartedAt, Date.now()),
          isMe: true,
        });
        pushState({ look: next });
      }
      showToast("캐릭터를 저장했어요");
    },
    [me.user_id, me.nickname, timer, timerStartedAt, pushState, showToast],
  );

  const inside = status === "inside";
  const others = people.filter((p) => p.user_id !== me.user_id);

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
        <div className="flex flex-wrap items-center gap-2">
          {timer && (
            <Link href="/dashboard">
              <Badge tone="matcha">
                타이머 진행 중 · {timer === "tea" ? "다도" : "독서"}
              </Badge>
            </Link>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            캐릭터 꾸미기
          </Button>
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

      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="찻집 공간. 바닥을 누르거나 방향키로 걸어가요"
        className={cn(
          "relative overflow-hidden rounded-lg border-2 border-ink bg-ink shadow-hard focus-visible:outline-2 focus-visible:outline-offset-2",
          status === "error" && "opacity-60",
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "block touch-none select-none [image-rendering:pixelated]",
            inside ? "cursor-pointer" : "cursor-default",
          )}
        />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute top-0 left-0"
          aria-hidden
        />

        {toast && (
          <div
            className="space-textbox absolute inset-x-3 bottom-3"
            role="status"
          >
            {toast}
          </div>
        )}
        {!inside && status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
            <p className="space-textbox mx-4 text-center">
              입장하면 다른 사람들에게 내 캐릭터와 닉네임이 보여요
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
      {inside && (
        <p className="text-xs text-ink-muted">
          바닥을 누르면 걸어가요. 방석을 누르면 앉아요. 키보드는 방향키나 WASD.
        </p>
      )}

      {editing && (
        <AvatarEditor
          initial={look}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
