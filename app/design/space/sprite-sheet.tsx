"use client";

import { useEffect, useRef } from "react";
import {
  CHAR_H,
  CHAR_W,
  characterSprite,
  type Pose,
} from "@/components/space/pixel/character";
import { HAIR_STYLES, HATS, type Look } from "@/lib/space/look";
import type { Dir } from "@/lib/space/map";

const S = 4;
const DIRS: Dir[] = ["down", "left", "up", "right"];
const POSES: Pose[] = ["stand", "stepA", "stepB", "sit"];

// 캐릭터 도트 확인용: 머리 모양·장식별로 방향 × 자세를 한 장에 그린다
export function SpriteSheet() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#d3d792";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rows: Look[] = [
      ...HAIR_STYLES.map((hairStyle, i) => ({
        skin: i % 4,
        hairStyle,
        hairColor: i,
        top: i * 2,
        bottom: i,
        hat: "none" as const,
      })),
      ...HATS.slice(1).map((hat, i) => ({
        skin: (i + 1) % 4,
        hairStyle: HAIR_STYLES[i],
        hairColor: i + 3,
        top: i + 1,
        bottom: i + 2,
        hat,
      })),
    ];
    rows.forEach((look, r) => {
      DIRS.forEach((dir, d) =>
        POSES.forEach((pose, p) => {
          const x = (d * POSES.length + p) * (CHAR_W + 4) * S + 8;
          const y = r * (CHAR_H + 4) * S + 8;
          ctx.drawImage(
            characterSprite(look, dir, pose),
            x,
            y,
            CHAR_W * S,
            CHAR_H * S,
          );
        }),
      );
    });
  }, []);
  return (
    <canvas
      ref={ref}
      width={16 * (CHAR_W + 4) * S + 16}
      height={7 * (CHAR_H + 4) * S + 16}
      className="max-w-none [image-rendering:pixelated]"
    />
  );
}
