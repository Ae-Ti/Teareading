"use client";

import { useEffect, useRef } from "react";
import type { Look } from "@/lib/space/look";
import { CHAR_H, CHAR_W, characterSprite } from "./pixel/character";

const SCALE = 5;

// 찻집 캐릭터를 정면으로 크게 보여 준다
export function CharacterPortrait({
  look,
  label,
}: {
  look: Look;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CHAR_W * SCALE, CHAR_H * SCALE);
    ctx.drawImage(
      characterSprite(look, "down", "stand"),
      0,
      0,
      CHAR_W * SCALE,
      CHAR_H * SCALE,
    );
  }, [look]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      width={CHAR_W * SCALE}
      height={CHAR_H * SCALE}
      className="[image-rendering:pixelated]"
    />
  );
}
