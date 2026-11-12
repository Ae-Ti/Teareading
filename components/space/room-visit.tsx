"use client";

import { useEffect, useRef } from "react";
import { LinkButton } from "@/components/ui/link-button";
import type { Look } from "@/lib/space/look";
import { MAPS, doorAt } from "@/lib/space/map";
import { findPath, nearestWalkable } from "@/lib/space/path";
import type { RoomStats, RoomStyle } from "@/lib/space/room";
import { TeahouseScene } from "./pixel/scene";

// 친구의 방 구경: 친구의 꾸밈을 그린 방을 혼자 걸어 다닌다.
// 실시간 채널을 열지 않아 방 주인과 다른 방문자에게는 아무것도 전달되지 않는다.
export function RoomVisit({
  meId,
  look,
  ownerId,
  ownerName,
  style,
  stats,
}: {
  meId: string;
  look: Look;
  ownerId: string;
  ownerName: string;
  style: RoomStyle;
  stats: RoomStats;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = MAPS.room;
    const scene: TeahouseScene = new TeahouseScene(
      canvasRef.current!,
      overlayRef.current!,
      map,
      { style, stats },
      {
        onPlayer: () => {},
        onArrive: () => {},
        onTap: (tile) => {
          const from = scene.planStart(meId) ?? map.spawn;
          const target = nearestWalkable(map, tile, from);
          // 문 칸으로는 걸어가지 않는다. 나갈 때는 위의 버튼을 쓴다.
          if (!target || doorAt(map, target.x, target.y)) return;
          const path = findPath(map, from, target);
          if (path) scene.walk(meId, from, path, true);
        },
      },
    );
    scene.upsert(meId, {
      look,
      name: "나",
      status: "",
      isMe: true,
      tile: map.spawn,
      dir: "up",
    });
    return () => scene.destroy();
  }, [meId, look, style, stats]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-bold break-words md:text-3xl">
          {ownerName} 님의 방
        </h1>
        <LinkButton variant="secondary" href={`/u/${ownerId}`}>
          나가기
        </LinkButton>
      </div>
      <p className="text-sm text-ink-muted">
        바닥을 눌러 둘러보세요. 친구에게는 알림이 가지 않아요.
      </p>
      <div
        aria-label={`${ownerName} 님의 방. 바닥을 누르면 걸어가요`}
        role="application"
        className="relative overflow-hidden rounded-lg border-2 border-ink bg-ink shadow-hard"
      >
        <canvas
          ref={canvasRef}
          className="block cursor-pointer touch-none select-none [image-rendering:pixelated]"
        />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute top-0 left-0"
          aria-hidden
        />
      </div>
    </div>
  );
}
