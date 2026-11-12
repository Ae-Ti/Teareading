"use client";

import type {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";
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
  doorAt,
  isWalkable,
  MAPS,
  seatAt,
  seatById,
  type Dir,
  type Door,
  type GameMap,
  type MapId,
  type Point,
} from "@/lib/space/map";
import type { RoomStats, RoomStyle } from "@/lib/space/room";
import { findPath, isValidPath, nearestWalkable } from "@/lib/space/path";
import {
  cleanMessage,
  clearSnapshot,
  readSnapshot,
  SPACE_MESSAGE_MAX,
  writeSnapshot,
} from "@/lib/space/resume";
import { createClient } from "@/lib/supabase/client";
import { detectDevice } from "@/lib/track";
import { SOCIAL_CHANGED } from "@/lib/social/requests";
import { AvatarEditor } from "./avatar-editor";
import { PlayerMenu, type PlayerTarget } from "./player-menu";
import { RoomEditor } from "./room-editor";
import { TeahouseScene } from "./pixel/scene";
import type { Decor } from "./pixel/tiles";
import {
  MOVE_EVENT,
  spaceChannel,
  STATE_EVENT,
  type MoveMessage,
  type SpacePresence,
  type StateMessage,
} from "./presence";

// Presence 전송 간격. 서버 제한(30초에 5번)을 넘지 않게 한다.
const TRACK_GAP_MS = 7000;
// 바로 받은 상태를 Presence 값보다 우선하는 시간 (Presence는 최대 TRACK_GAP_MS 늦다)
const LIVE_STATE_MS = 10_000;

type Status = "connecting" | "ready" | "entering" | "inside" | "error";
type SpaceGroup = { id: string; name: string };

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
  roomStats,
  initialRoomStyle,
}: {
  me: Pick<SpacePresence, "user_id" | "nickname" | "avatar_url">;
  initialLook: Look;
  timer: SpacePresence["timer"];
  timerStartedAt: string | null;
  roomStats: RoomStats;
  initialRoomStyle: RoomStyle;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [people, setPeople] = useState<SpacePresence[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [look, setLook] = useState(initialLook);
  const [editing, setEditing] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomStyle, setRoomStyle] = useState(initialRoomStyle);
  const [mapId, setMapId] = useState<MapId>("teahouse");
  const [toast, setToast] = useState<string | null>(null);
  const [seated, setSeated] = useState(false);
  const [myMessage, setMyMessage] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [menu, setMenu] = useState<PlayerTarget | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TeahouseScene | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const visitRef = useRef<string | null>(null);
  const insideRef = useRef(false);
  const othersRef = useRef<SpacePresence[]>([]);
  const myStateRef = useRef<SpacePresence | null>(null);
  const trackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackRef = useRef(0);
  const liveRef = useRef(
    new Map<string, { at: number; state: StateMessage }>(),
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupsRef = useRef(new Map<string, SpaceGroup[]>()); // 사람별 찻집 모임
  const peopleKeyRef = useRef("");
  const mapRef = useRef<GameMap>(MAPS.teahouse);
  const movingRef = useRef(false); // 문을 지나는 중에는 입력을 받지 않는다
  const seatCheckRef = useRef(false); // 돌아온 직후 내 자리에 다른 사람이 앉았는지 확인
  const decorRef = useRef<Decor>({
    style: initialRoomStyle,
    stats: roomStats,
  });

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // 이 사람의 대표 모임: 나도 들어가 있는 모임이 먼저
  const groupOf = useCallback(
    (id: string) => {
      const mine = groupsRef.current.get(me.user_id) ?? [];
      const theirs = groupsRef.current.get(id) ?? [];
      const shared = theirs.find((g) => mine.some((m) => m.id === g.id));
      const group = shared ?? theirs[0];
      return group ? { ...group, member: Boolean(shared) } : null;
    },
    [me.user_id],
  );

  // 지금 찻집에 있는 사람들의 모임을 읽어 캐릭터 아래 이름표를 맞춘다
  const refreshGroups = useCallback(async () => {
    const ids = [me.user_id, ...othersRef.current.map((p) => p.user_id)];
    const { data, error } = await createClient()
      .from("group_members")
      .select("user_id, group:groups!inner(id, name, from_space)")
      .in("user_id", ids)
      .eq("group.from_space", true)
      .order("joined_at", { ascending: false });
    if (error || !data) return;
    const next = new Map<string, SpaceGroup[]>();
    for (const row of data) {
      next.set(row.user_id, [
        ...(next.get(row.user_id) ?? []),
        { id: row.group.id, name: row.group.name },
      ]);
    }
    groupsRef.current = next;
    const scene = sceneRef.current;
    for (const id of scene?.ids() ?? [])
      scene?.setGroup(id, groupOf(id)?.name ?? null);
    // 메뉴를 연 채로 모임 정보가 바뀌면 메뉴도 맞춘다
    setMenu((open) => open && { ...open, group: groupOf(open.id) });
  }, [me.user_id, groupOf]);

  // 내 상태(위치·자리·캐릭터)를 Presence에 반영. 연달아 바뀌면 마지막 것만 보낸다.
  const pushState = useCallback(
    (patch: Partial<SpacePresence>) => {
      if (!myStateRef.current) return;
      // 일어나면 상태 메시지도 함께 사라진다
      const standing = "seat" in patch && !patch.seat;
      myStateRef.current = {
        ...myStateRef.current,
        ...patch,
        ...(standing ? { message: null } : {}),
      };
      if ("seat" in patch) setSeated(!standing);
      if (standing) {
        setMyMessage(null);
        setMessageDraft("");
        sceneRef.current?.setMessage(me.user_id, null);
      }
      // 같은 공간 사람에게는 바로 알린다 (연달아 바뀌면 마지막 것만)
      if (stateTimer.current) clearTimeout(stateTimer.current);
      stateTimer.current = setTimeout(() => {
        const state = myStateRef.current;
        if (!insideRef.current || !state) return;
        const payload: StateMessage = {
          user_id: state.user_id,
          pos: state.pos,
          dir: state.dir,
          seat: state.seat,
          message: state.message,
        };
        void channelRef.current?.send({
          type: "broadcast",
          event: STATE_EVENT,
          payload,
        });
      }, 150);
      // 늦게 들어온 사람을 위한 Presence는 드물게, 마지막 상태로 보낸다
      if (trackTimer.current) return;
      trackTimer.current = setTimeout(
        () => {
          trackTimer.current = null;
          if (!insideRef.current || !myStateRef.current) return;
          lastTrackRef.current = Date.now();
          void channelRef.current?.track(myStateRef.current);
        },
        Math.max(300, lastTrackRef.current + TRACK_GAP_MS - Date.now()),
      );
    },
    [me.user_id],
  );

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
      const path = findPath(mapRef.current, from, target);
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

  // 맵을 바꾼다. 실시간 채널은 mapId를 따라 아래 effect에서 다시 연결된다.
  const switchMap = useCallback(
    (next: GameMap, tile: Point, dir: Dir) => {
      if (trackTimer.current) clearTimeout(trackTimer.current);
      mapRef.current = next;
      othersRef.current = [];
      setPeople([]);
      setMapId(next.id);
      setEditingRoom(false);
      setMenu(null);
      sceneRef.current?.setMap(
        next,
        next.id === "room" ? decorRef.current : undefined,
        tile,
        dir,
      );
      if (myStateRef.current)
        myStateRef.current = {
          ...myStateRef.current,
          pos: tile,
          dir,
          seat: null,
          message: null,
        };
      setSeated(false);
      setMyMessage(null);
      setMessageDraft("");
      sceneRef.current?.setMessage(me.user_id, null);
    },
    [me.user_id],
  );

  const goThrough = useCallback(
    (door: Door) => {
      if (movingRef.current) return;
      movingRef.current = true;
      sceneRef.current?.fadeThrough(() => {
        switchMap(MAPS[door.to], door.at, door.face);
        movingRef.current = false;
      });
    },
    [switchMap],
  );

  // 장면은 한 번만 만든다
  useEffect(() => {
    const scene = new TeahouseScene(
      canvasRef.current!,
      overlayRef.current!,
      mapRef.current,
      undefined,
      {
        onPlayer: (id, at) => {
          if (!insideRef.current || movingRef.current) return;
          const person = othersRef.current.find((p) => p.user_id === id);
          if (!person) return;
          setMenu({
            id,
            nickname: person.nickname,
            x: at.x,
            y: at.y,
            areaW: canvasRef.current?.clientWidth ?? 320,
            areaH: canvasRef.current?.clientHeight ?? 320,
            group: groupOf(id),
          });
        },
        onTap: (tile) => {
          setMenu(null);
          if (!insideRef.current || movingRef.current) return;
          const map = mapRef.current;
          const seat = seatAt(map, tile.x, tile.y);
          if (seat && seatTakenByOther(seat.id)) {
            showToast("이미 다른 분이 앉아 있어요");
            return;
          }
          const from = sceneRef.current?.planStart(me.user_id) ?? map.spawn;
          const target = seat ? tile : nearestWalkable(map, tile, from);
          if (target) moveMe(target);
        },
        onArrive: (tile, dir) => {
          const map = mapRef.current;
          const door = doorAt(map, tile.x, tile.y);
          if (door) {
            goThrough(door);
            return;
          }
          const seat = seatAt(map, tile.x, tile.y);
          if (seat && !seatTakenByOther(seat.id)) {
            sceneRef.current?.sit(me.user_id, seat.face);
            pushState({ pos: tile, dir: seat.face, seat: seat.id });
          } else {
            if (seat) showToast("이미 다른 분이 앉아 있어요");
            pushState({ pos: tile, dir, seat: null });
          }
        },
      },
    );
    sceneRef.current = scene;
    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [
    me.user_id,
    goThrough,
    moveMe,
    pushState,
    seatTakenByOther,
    showToast,
    groupOf,
  ]);

  // 다른 화면에 갔다 돌아오면 있던 곳에서 이어서 시작한다.
  // Next.js가 화면을 숨겼다 다시 보여 줄 때도, 새로 그릴 때도 여기를 지난다.
  useEffect(() => {
    if (insideRef.current || !sceneRef.current) return;
    const saved = readSnapshot(me.user_id);
    if (!saved) return;
    const map = MAPS[saved.mapId];
    const pos = isWalkable(map, saved.pos.x, saved.pos.y)
      ? saved.pos
      : map.spawn;
    const seat = seatById(map, saved.seat);
    const sitting = !!seat && seat.x === pos.x && seat.y === pos.y;
    const dir = sitting ? seat.face : saved.dir;
    const message = sitting ? saved.message : null;

    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 저장소(외부)에서 되살린 값을 화면에 반영한다 */
    mapRef.current = map;
    setMapId(map.id);
    sceneRef.current.setMap(
      map,
      map.id === "room" ? decorRef.current : undefined,
      pos,
      dir,
    );
    myStateRef.current = {
      ...me,
      timer,
      timer_started_at: timerStartedAt,
      entered_at: new Date().toISOString(),
      look,
      pos,
      dir,
      seat: sitting ? seat.id : null,
      message,
    };
    insideRef.current = true;
    seatCheckRef.current = sitting;
    sceneRef.current.upsert(me.user_id, {
      look,
      name: me.nickname,
      status: timerStatus(timer, timerStartedAt, Date.now()),
      tile: pos,
      dir,
      sitting,
      isMe: true,
      message,
    });
    setStatus("inside");
    setSeated(sitting);
    setMyMessage(message);
    setMessageDraft(message ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
    // 체류 기록은 화면을 떠날 때 닫았으므로 새로 연다
    const visit = setTimeout(() => {
      void enterSpace(detectDevice()).then(({ visitId }) => {
        visitRef.current = visitId;
      });
    }, 0);
    return () => clearTimeout(visit);
    // 화면이 다시 보일 때만 실행한다. 입장 중에는 위 조건으로 바로 끝난다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.user_id]);

  // 다른 사람 캐릭터를 Presence 상태에 맞춘다
  const syncOthers = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const map = mapRef.current;
    const now = Date.now();
    const present = new Set<string>();
    for (const p of othersRef.current) {
      present.add(p.user_id);
      const seat = seatById(map, p.seat);
      const pos =
        p.pos && isWalkable(map, p.pos.x, p.pos.y) ? p.pos : map.spawn;
      scene.upsert(p.user_id, {
        look: parseLook(p.look) ?? defaultLook(p.user_id),
        name: p.nickname,
        status: timerStatus(p.timer, p.timer_started_at, now),
        tile: pos,
        dir: seat?.face ?? p.dir ?? "down",
        sitting: !!seat && seat.x === pos.x && seat.y === pos.y,
        message: seat ? cleanMessage(p.message) : null,
      });
      scene.setGroup(p.user_id, groupOf(p.user_id)?.name ?? null);
    }
    for (const id of scene.ids()) {
      if (id !== me.user_id && !present.has(id)) scene.remove(id);
    }
  }, [me.user_id, groupOf]);

  // 공용 공간의 채널 연결은 입장 전부터 한다 (지금 누가 있는지 보여주기 위해). 입장 = track, 퇴장 = untrack.
  // 내 방은 채널을 열지 않는다. 친구의 구경은 별도 화면(room-visit)이고 실시간 전달이 없다.
  useEffect(() => {
    if (!MAPS[mapId].shared) return;
    const supabase = createClient();
    const channel = supabase.channel(spaceChannel(mapId), {
      config: {
        private: true, // 로그인 회원만 접속 (20261111000200_space_channel_auth.sql)
        presence: { key: me.user_id },
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;
    let active = true;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<SpacePresence>();
        // 같은 계정이 탭을 여러 개 열어도 한 명으로 센다 (key = user_id)
        const list = Object.values(state)
          .map((metas) => metas[0])
          .sort((a, b) => a.entered_at.localeCompare(b.entered_at));
        // Presence보다 최근에 바로 받은 상태가 있으면 그것을 쓴다
        const now = Date.now();
        othersRef.current = list
          .filter((p) => p.user_id !== me.user_id)
          .map((p) => {
            const live = liveRef.current.get(p.user_id);
            return live && now - live.at < LIVE_STATE_MS
              ? { ...p, ...live.state }
              : p;
          });
        setPeople(list);
        syncOthers();
        // 드나드는 사람이 바뀌었을 때만 모임 이름을 다시 읽는다
        const key = list
          .map((p) => p.user_id)
          .sort()
          .join();
        if (key !== peopleKeyRef.current) {
          peopleKeyRef.current = key;
          void refreshGroups();
        }
        // 비운 사이 내 자리에 다른 분이 앉았으면 입구로 옮긴다
        if (seatCheckRef.current) {
          seatCheckRef.current = false;
          const mine = myStateRef.current?.seat;
          if (mine && othersRef.current.some((p) => p.seat === mine)) {
            const spawn = mapRef.current.spawn;
            sceneRef.current?.setMap(mapRef.current, undefined, spawn, "up");
            pushState({ seat: null, pos: spawn, dir: "up" });
            showToast("비운 사이 다른 분이 앉아서 입구로 왔어요");
          }
        }
      })
      .on("broadcast", { event: STATE_EVENT }, ({ payload }) => {
        const msg = payload as StateMessage;
        if (!msg?.user_id || msg.user_id === me.user_id) return;
        liveRef.current.set(msg.user_id, { at: Date.now(), state: msg });
        othersRef.current = othersRef.current.map((p) =>
          p.user_id === msg.user_id ? { ...p, ...msg } : p,
        );
        syncOthers();
      })
      .on("broadcast", { event: MOVE_EVENT }, ({ payload }) => {
        const msg = payload as MoveMessage;
        const map = mapRef.current;
        if (!msg || msg.user_id === me.user_id || !msg.from) return;
        if (!othersRef.current.some((p) => p.user_id === msg.user_id)) return;
        if (
          !isWalkable(map, msg.from.x, msg.from.y) ||
          !isValidPath(map, msg.from, msg.path)
        )
          return;
        sceneRef.current?.walk(msg.user_id, msg.from, msg.path);
      });

    const onStatus = (s: `${REALTIME_SUBSCRIBE_STATES}`) => {
      if (s === "SUBSCRIBED") {
        if (
          insideRef.current &&
          myStateRef.current &&
          mapRef.current.id === mapId
        ) {
          // 맵을 옮겼거나 다시 연결한 경우: 이 채널에서 다시 나타난다
          lastTrackRef.current = Date.now();
          void channel.track(myStateRef.current);
          setStatus("inside");
        } else {
          setStatus((prev) => (prev === "connecting" ? "ready" : prev));
        }
      }
      if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
    };
    // 비공개 채널은 로그인 토큰이 있어야 해서, 토큰을 넘긴 뒤 연결한다
    void supabase.realtime.setAuth().finally(() => {
      if (active) channel.subscribe(onStatus);
    });

    return () => {
      active = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    me.user_id,
    attempt,
    mapId,
    syncOthers,
    pushState,
    showToast,
    refreshGroups,
  ]);

  // 입장했을 때, 찻집에서 모임이 새로 맺어졌을 때 이름표를 맞춘다
  const isInside = status === "inside";
  useEffect(() => {
    if (!isInside) return;
    void refreshGroups();
    window.addEventListener(SOCIAL_CHANGED, refreshGroups);
    return () => window.removeEventListener(SOCIAL_CHANGED, refreshGroups);
  }, [isInside, refreshGroups]);

  // 화면을 떠나면 있던 곳을 저장하고 체류 기록을 닫는다
  useEffect(() => {
    const save = () => {
      const state = myStateRef.current;
      if (!insideRef.current || !state?.pos) return;
      writeSnapshot(me.user_id, {
        mapId: mapRef.current.id,
        pos: state.pos,
        dir: state.dir ?? "up",
        seat: state.seat ?? null,
        message: state.message ?? null,
      });
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
      for (const timer of [trackTimer, stateTimer]) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
      }
      if (insideRef.current && visitRef.current) {
        void leaveSpace(visitRef.current, detectDevice());
      }
      insideRef.current = false;
      visitRef.current = null;
      myStateRef.current = null;
    };
  }, [me.user_id]);

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
    const spawn = MAPS.teahouse.spawn;
    setStatus("entering");
    const state: SpacePresence = {
      ...me,
      timer,
      timer_started_at: timerStartedAt,
      entered_at: new Date().toISOString(),
      look,
      pos: spawn,
      dir: "up",
      seat: null,
      message: null,
    };
    lastTrackRef.current = Date.now();
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
      tile: spawn,
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
    if (!insideRef.current || movingRef.current) return;
    insideRef.current = false;
    myStateRef.current = null;
    clearSnapshot(me.user_id);
    setSeated(false);
    setMyMessage(null);
    setMessageDraft("");
    for (const timer of [trackTimer, stateTimer]) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
    sceneRef.current?.remove(me.user_id);
    if (mapRef.current.id === "teahouse") {
      await channelRef.current?.untrack();
      setStatus("ready");
    } else {
      // 입장 화면은 항상 찻집이다
      setStatus("connecting");
      switchMap(MAPS.teahouse, MAPS.teahouse.spawn, "up");
    }
    if (visitRef.current) {
      await leaveSpace(visitRef.current, detectDevice());
      visitRef.current = null;
    }
  }, [me.user_id, switchMap]);

  const onKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      const dir = KEYS[ev.key];
      if (!dir || !insideRef.current || movingRef.current) return;
      ev.preventDefault();
      const scene = sceneRef.current;
      if (!scene || !scene.isIdle(me.user_id)) return;
      const from = scene.planStart(me.user_id)!;
      const to = { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
      const map = mapRef.current;
      const seat = seatAt(map, to.x, to.y);
      if (isWalkable(map, to.x, to.y) && !(seat && seatTakenByOther(seat.id))) {
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

  const onRoomSaved = useCallback(
    (next: RoomStyle) => {
      setRoomStyle(next);
      setEditingRoom(false);
      decorRef.current = { ...decorRef.current, style: next };
      if (mapRef.current.id === "room")
        sceneRef.current?.setDecor(decorRef.current);
      showToast("방을 꾸몄어요");
    },
    [showToast],
  );

  const saveMessage = (value: string) => {
    const message = cleanMessage(value);
    setMyMessage(message);
    setMessageDraft(message ?? "");
    sceneRef.current?.setMessage(me.user_id, message);
    pushState({ message });
  };

  const inside = status === "inside";
  const others = people.filter((p) => p.user_id !== me.user_id);
  const map = MAPS[mapId];

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
            (!map.shared
              ? "내 방 · 친구만 구경할 수 있어요"
              : others.length === 0
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
          {inside && <Badge tone="yuja">{map.title}</Badge>}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            캐릭터 꾸미기
          </Button>
          {inside && mapId === "room" && (
            <Button variant="secondary" onClick={() => setEditingRoom(true)}>
              방 꾸미기
            </Button>
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

        {menu && inside && (
          <PlayerMenu
            key={menu.id}
            target={menu}
            onClose={() => setMenu(null)}
            onToast={showToast}
          />
        )}
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
      {inside && seated && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border-2 border-ink bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMessage(messageDraft);
          }}
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-bold">
            상태 메시지
            <input
              value={messageDraft}
              maxLength={SPACE_MESSAGE_MAX}
              onChange={(e) => setMessageDraft(e.target.value)}
              placeholder="예: 데미안 읽는 중 🍵"
              className="h-10 rounded-md border-2 border-ink bg-surface px-3 text-base font-normal placeholder:text-ink-subtle focus:shadow-hard-sm focus:outline-none"
            />
          </label>
          <Button size="sm" className="h-10">
            올리기
          </Button>
          {myMessage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-10"
              onClick={() => saveMessage("")}
            >
              지우기
            </Button>
          )}
          <p className="w-full text-xs text-ink-muted">
            앉아 있는 동안 머리 위에 보여요. 일어나면 사라져요.
          </p>
        </form>
      )}
      {inside && (
        <p className="text-xs text-ink-muted">
          바닥을 누르면 걸어가요. 방석을 누르면 앉고, 문을 밟으면 다른 곳으로
          가요. 다른 사람 캐릭터를 누르면 대화나 모임을 신청할 수 있어요.
          키보드는 방향키나 WASD.
        </p>
      )}

      {editing && (
        <AvatarEditor
          initial={look}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
      {editingRoom && (
        <RoomEditor
          initial={roomStyle}
          stats={roomStats}
          onClose={() => setEditingRoom(false)}
          onSaved={onRoomSaved}
        />
      )}
    </div>
  );
}
