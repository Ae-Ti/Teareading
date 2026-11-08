"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveRoomStyle } from "@/app/space/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
  FLOORS,
  WALLS,
  type RoomStats,
  type RoomStyle,
} from "@/lib/space/room";

function Options({
  label,
  options,
  value,
  days,
  onChange,
}: {
  label: string;
  options: typeof WALLS;
  value: string;
  days: number;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const locked = o.need > days;
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              aria-pressed={value === o.id}
              onClick={() => onChange(o.id)}
              className={cn(
                "flex items-center gap-2 rounded-sm border-2 border-ink px-2 py-1 text-sm font-bold",
                value === o.id ? "bg-matcha shadow-hard-sm" : "bg-surface",
                locked && "opacity-50",
              )}
            >
              <span
                className="size-5 rounded-sm border-2 border-ink"
                style={{ backgroundColor: o.color }}
                aria-hidden
              />
              {o.label}
              {locked && (
                <span className="text-xs font-normal">🔒 출석 {o.need}일</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function RoomEditor({
  initial,
  stats,
  onClose,
  onSaved,
}: {
  initial: RoomStyle;
  stats: RoomStats;
  onClose: () => void;
  onSaved: (style: RoomStyle) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [style, setStyle] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveRoomStyle(style);
      if (res.ok) onSaved(res.style);
      else setError(res.error);
    });
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="room-editor-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-lg border-2 border-ink bg-surface p-6 shadow-hard-lg backdrop:bg-ink/40"
    >
      <h2 id="room-editor-title" className="text-lg font-bold">
        방 꾸미기
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        책장과 다기, 액자는 내 기록에 따라 저절로 채워져요. 지금까지 독서기록{" "}
        {stats.books}개 · 차 칼럼 {stats.columns}편 · 다도 {stats.teaSessions}회
        · 출석 {stats.attendanceDays}일
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <Options
          label="벽지"
          options={WALLS}
          value={style.wall}
          days={stats.attendanceDays}
          onChange={(wall) => setStyle((s) => ({ ...s, wall }))}
        />
        <Options
          label="바닥"
          options={FLOORS}
          value={style.floor}
          days={stats.attendanceDays}
          onChange={(floor) => setStyle((s) => ({ ...s, floor }))}
        />
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
