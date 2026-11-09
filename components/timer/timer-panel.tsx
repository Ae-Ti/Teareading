"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  finishTimer,
  startTimer,
  type TimerSession,
} from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { LinkButton } from "@/components/ui/link-button";
import { detectDevice } from "@/lib/track";

const PRESETS = [15, 25, 45, 60];
const LABEL = { tea: "다도", reading: "독서" } as const;

function format(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function durationText(session: TimerSession) {
  const sec = Math.round(
    (new Date(session.ended_at!).getTime() -
      new Date(session.started_at).getTime()) /
      1000,
  );
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}분` : `${sec}초`;
}

export function TimerPanel({
  initialSession,
  serverNow,
}: {
  initialSession: TimerSession | null;
  serverNow: number;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [result, setResult] = useState<TimerSession | null>(null);
  // 완료를 눌렀는데 1분이 안 돼 서버가 중단으로 기록한 경우
  const [finishedTooEarly, setFinishedTooEarly] = useState(false);
  const [activity, setActivity] = useState<"tea" | "reading">("tea");
  const [minutes, setMinutes] = useState(25);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 서버와 기기 시계 차이. 진행 시간은 항상 서버의 started_at 기준으로 계산한다.
  const [skew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now() + skew);
  const finishing = useRef(false);

  // 서버에서 새 상태가 오면(새로고침, 다른 기기에서 시작·종료) 그 상태를 따른다
  const [prevInitial, setPrevInitial] = useState(initialSession);
  if (initialSession !== prevInitial) {
    setPrevInitial(initialSession);
    setSession(initialSession);
  }

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now() + skew), 250);
    return () => clearInterval(t);
  }, [session, skew]);

  const remaining = session
    ? session.target_seconds -
      Math.floor((now - new Date(session.started_at).getTime()) / 1000)
    : minutes * 60;

  const finish = useCallback(
    (status: "completed" | "stopped") => {
      if (!session || finishing.current) return;
      finishing.current = true;
      setError(null);
      startTransition(async () => {
        const res = await finishTimer(session.id, status, detectDevice());
        finishing.current = false;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSession(null);
        setResult(res.session);
        setFinishedTooEarly(
          status === "completed" && res.session.status === "stopped",
        );
        router.refresh();
      });
    },
    [router, session],
  );

  // 목표 시간에 닿으면 자동 완료 (자리를 비운 사이 끝났어도 돌아오면 완료 처리)
  useEffect(() => {
    if (session && remaining <= 0) finish("completed");
  }, [session, remaining, finish]);

  // 탭 제목에 남은 시간 표시
  useEffect(() => {
    if (!session) return;
    const original = document.title;
    document.title = `${format(remaining)} · ${LABEL[session.activity as "tea"]} · 티어리딩`;
    return () => {
      document.title = original;
    };
  }, [session, remaining]);

  const start = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await startTimer(activity, minutes, detectDevice());
      if (!res.ok) {
        setError(res.error);
        if (res.code === "already_running") router.refresh();
        return;
      }
      setNow(Date.now() + skew);
      setSession(res.session);
    });
  };

  const phase = session ? "running" : result ? "done" : "idle";
  const current = session ?? result;
  const currentLabel = current
    ? LABEL[current.activity as "tea"]
    : LABEL[activity];
  const completed = result?.status === "completed";
  const progress = session
    ? 1 - Math.max(0, remaining) / session.target_seconds
    : 0;

  return (
    <Card
      tone={phase === "done" && completed ? "yuja" : "matcha"}
      className="flex flex-col gap-6 p-5 md:p-8"
    >
      {phase === "idle" && (
        <>
          <div
            role="radiogroup"
            aria-label="활동 유형"
            className="grid grid-cols-2 gap-2 rounded-md border-2 border-ink bg-surface p-1.5"
          >
            {(["tea", "reading"] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={activity === a}
                onClick={() => setActivity(a)}
                className={cn(
                  "rounded-sm border-2 py-2.5 font-bold",
                  activity === a
                    ? "border-ink bg-ink text-canvas"
                    : "border-transparent",
                )}
              >
                {a === "tea" ? "☕ 다도" : "📖 독서"}
              </button>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="목표 시간"
          >
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={!custom && minutes === m}
                onClick={() => {
                  setCustom(false);
                  setMinutes(m);
                }}
                className={cn(
                  "h-10 rounded-md border-2 border-ink px-4 text-sm font-bold",
                  !custom && minutes === m
                    ? "bg-surface shadow-hard-sm"
                    : "bg-transparent",
                )}
              >
                {m}분
              </button>
            ))}
            {custom ? (
              <label className="flex h-10 items-center gap-1 rounded-md border-2 border-ink bg-surface px-3 text-sm font-bold shadow-hard-sm">
                <input
                  type="number"
                  min={1}
                  max={180}
                  autoFocus
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(
                      Math.min(
                        180,
                        Math.max(1, Math.round(Number(e.target.value) || 1)),
                      ),
                    )
                  }
                  className="w-14 bg-transparent text-right font-mono tabular-nums focus:outline-none"
                  aria-label="직접 입력 (분)"
                />
                분
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setCustom(true)}
                className="h-10 rounded-md border-2 border-dashed border-ink px-4 text-sm font-bold"
              >
                직접 입력
              </button>
            )}
          </div>
        </>
      )}

      {phase !== "idle" && current && (
        <div className="flex items-center justify-between">
          <Badge
            tone={
              phase === "done" ? (completed ? "matcha" : "neutral") : "neutral"
            }
          >
            {phase === "done"
              ? completed
                ? "완료"
                : "중단"
              : `진행 중 · ${currentLabel}`}
          </Badge>
          <span className="text-sm font-bold">
            목표{" "}
            <span className="font-mono tabular-nums">
              {current.target_seconds / 60}
            </span>
            분
          </span>
        </div>
      )}

      {phase === "done" && result ? (
        <div
          className="flex flex-col items-center gap-2 py-4 text-center"
          aria-live="polite"
        >
          <p className="text-4xl font-bold md:text-5xl">
            {completed ? "수고했어요" : "잠시 멈췄어요"}
          </p>
          <p className="text-ink-muted">
            {completed
              ? `${currentLabel} ${durationText(result)}을 마쳤어요. 오늘 출석이 기록됐어요.`
              : `${currentLabel} ${durationText(result)} 했어요. ${
                  finishedTooEarly
                    ? "1분이 지나야 완료로 기록돼서 이번엔 중단으로 남았어요. "
                    : ""
                }완료한 타이머만 출석으로 쳐요.`}
          </p>
        </div>
      ) : (
        <p
          className="text-center font-mono text-7xl font-extrabold tracking-tighter tabular-nums sm:text-8xl md:text-9xl"
          role="timer"
          aria-label={`남은 시간 ${format(remaining)}`}
        >
          {format(remaining)}
        </p>
      )}

      {phase === "running" && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-4 overflow-hidden rounded-sm border-2 border-ink bg-surface"
        >
          <div
            className="h-full bg-ink transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-danger bg-danger-soft p-3 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {phase === "idle" && (
          <Button size="lg" onClick={start} loading={pending}>
            {currentLabel} {minutes}분 시작
          </Button>
        )}
        {phase === "running" && (
          <>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => finish("completed")}
              loading={pending}
            >
              완료
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => finish("stopped")}
              disabled={pending}
            >
              중단
            </Button>
          </>
        )}
        {phase === "done" && result && (
          <>
            <LinkButton
              size="lg"
              href={
                result.activity === "reading"
                  ? "/me/reading/new"
                  : "/me/columns/new"
              }
            >
              {result.activity === "reading"
                ? "독서기록 남기기"
                : "차 칼럼 쓰기"}
            </LinkButton>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setResult(null)}
            >
              한 번 더
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
