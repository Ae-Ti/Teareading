"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveLook } from "@/app/space/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
  BOTTOM_COLORS,
  HAIR_COLORS,
  HAIR_STYLE_LABELS,
  HAIR_STYLES,
  HAT_LABELS,
  HATS,
  SKINS,
  TOP_COLORS,
  type Look,
} from "@/lib/space/look";
import type { Dir } from "@/lib/space/map";
import { detectDevice } from "@/lib/track";
import { CHAR_H, CHAR_W, characterSprite, type Pose } from "./pixel/character";

const PREVIEW_SCALE = 5;
const TURN: Dir[] = ["down", "left", "up", "right"];
const WALK: Pose[] = ["stand", "stepA", "stand", "stepB"];

// 미리보기: 4방향으로 돌면서 걷는다
function Preview({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const draw = () => {
      const dir = TURN[Math.floor(frame / 8) % 4];
      const pose = WALK[frame % 4];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "rgba(44,36,48,0.2)";
      ctx.fillRect(
        4 * PREVIEW_SCALE,
        (CHAR_H - 2) * PREVIEW_SCALE,
        8 * PREVIEW_SCALE,
        PREVIEW_SCALE,
      );
      ctx.drawImage(
        characterSprite(look, dir, pose),
        0,
        0,
        CHAR_W * PREVIEW_SCALE,
        CHAR_H * PREVIEW_SCALE,
      );
      frame++;
    };
    draw();
    const id = setInterval(draw, 220);
    return () => clearInterval(id);
  }, [look]);
  return (
    <canvas
      ref={ref}
      width={CHAR_W * PREVIEW_SCALE}
      height={CHAR_H * PREVIEW_SCALE}
      className="[image-rendering:pixelated]"
      aria-label="캐릭터 미리보기"
    />
  );
}

function Swatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: readonly string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${i + 1}번`}
            aria-pressed={value === i}
            onClick={() => onChange(i)}
            className={cn(
              "size-8 rounded-sm border-2 border-ink",
              value === i &&
                "shadow-hard-sm outline-2 outline-offset-2 outline-ink",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Choices<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-sm border-2 border-ink px-3 py-1 text-sm font-bold",
              value === o ? "bg-matcha shadow-hard-sm" : "bg-surface",
            )}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AvatarEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Look;
  onClose: () => void;
  onSaved: (look: Look) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [look, setLook] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Look>(k: K, v: Look[K]) =>
    setLook((l) => ({ ...l, [k]: v }));

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveLook(look, detectDevice());
      if (res.ok) onSaved(res.look);
      else setError(res.error);
    });
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="avatar-editor-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100%-2rem))] overflow-y-auto rounded-lg border-2 border-ink bg-surface p-6 shadow-hard-lg backdrop:bg-ink/40"
    >
      <h2 id="avatar-editor-title" className="text-lg font-bold">
        캐릭터 꾸미기
      </h2>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <div className="flex shrink-0 items-center justify-center self-center rounded-md border-2 border-ink bg-[#d3d792] p-4 sm:self-start">
          <Preview look={look} />
        </div>
        <div className="flex flex-col gap-4">
          <Swatches
            label="피부"
            colors={SKINS}
            value={look.skin}
            onChange={(v) => set("skin", v)}
          />
          <Choices
            label="머리 모양"
            options={HAIR_STYLES}
            labels={HAIR_STYLE_LABELS}
            value={look.hairStyle}
            onChange={(v) => set("hairStyle", v)}
          />
          <Swatches
            label="머리 색"
            colors={HAIR_COLORS}
            value={look.hairColor}
            onChange={(v) => set("hairColor", v)}
          />
          <Swatches
            label="윗옷"
            colors={TOP_COLORS}
            value={look.top}
            onChange={(v) => set("top", v)}
          />
          <Swatches
            label="아래옷"
            colors={BOTTOM_COLORS}
            value={look.bottom}
            onChange={(v) => set("bottom", v)}
          />
          <Choices
            label="머리 장식"
            options={HATS}
            labels={HAT_LABELS}
            value={look.hat}
            onChange={(v) => set("hat", v)}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => dialog.current?.close()}
          disabled={pending}
        >
          취소
        </Button>
        <Button onClick={save} loading={pending}>
          저장
        </Button>
      </div>
    </dialog>
  );
}
