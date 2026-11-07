"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

const NAV = [
  { label: "타이머", short: "타이머", mark: "◷", active: true },
  { label: "찻집", short: "찻집", mark: "☕" },
  { label: "내 기록", short: "기록", mark: "✎" },
  { label: "커뮤니티", short: "모임", mark: "◎" },
  { label: "메시지", short: "메시지", mark: "✉", badge: 2 },
  { label: "다도 가이드", short: "가이드", mark: "❖", desktopOnly: true },
];

const PRESETS = [15, 25, 45, 60];
const WEEK = [
  { d: "월", m: 40 },
  { d: "화", m: 25 },
  { d: "수", m: 70 },
  { d: "목", m: 50 },
  { d: "금", m: 0 },
  { d: "토", m: 35 },
  { d: "일", m: 0 },
];
const TODAY_INDEX = 5;

type Phase = "idle" | "running" | "done";

function format(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DashboardMock() {
  const [activity, setActivity] = useState<"tea" | "reading">("tea");
  const [minutes, setMinutes] = useState(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(25 * 60);
  const [heading, setHeading] = useState<"mono" | "sans">("sans");

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      // 목업이라 1초에 10초씩 줄인다
      setLeft((v) => {
        if (v <= 10) {
          setPhase("done");
          return 0;
        }
        return v - 10;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const pick = (m: number) => {
    setMinutes(m);
    setLeft(m * 60);
  };
  const progress = 1 - left / (minutes * 60);
  const label = activity === "tea" ? "다도" : "독서";

  return (
    // 목업은 임시 앱 셸 위에 전체 화면으로 덮어 그린다
    <div
      data-heading={heading}
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
    >
      {/* 시안 비교 스위치 */}
      <button
        onClick={() => setHeading((h) => (h === "mono" ? "sans" : "mono"))}
        className="fixed right-4 bottom-20 z-20 rounded-md border-2 border-ink bg-yuja px-3 py-2 font-mono text-xs font-bold shadow-hard-sm md:bottom-4"
      >
        한글 제목: {heading === "mono" ? "고정폭 (A안)" : "고딕 (B안)"} ⇄
      </button>
      <div className="flex min-h-dvh">
        {/* 데스크톱 사이드바 */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col justify-between border-r-2 border-ink bg-surface p-5 md:flex">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-md border-2 border-ink bg-matcha font-mono text-lg font-extrabold shadow-hard-sm">
                茶
              </span>
              <span className="font-mono text-lg font-extrabold">티어리딩</span>
            </div>
            <nav className="flex flex-col gap-1.5" aria-label="주 메뉴">
              {NAV.map((n) => (
                <a
                  key={n.label}
                  href="#"
                  aria-current={n.active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md border-2 px-3 py-2.5 font-mono text-sm font-bold",
                    n.active
                      ? "border-ink bg-matcha shadow-hard-sm"
                      : "border-transparent hover:border-ink hover:bg-sunken",
                  )}
                >
                  <span aria-hidden className="w-5 text-center">
                    {n.mark}
                  </span>
                  {n.label}
                  {n.badge && (
                    <span className="ml-auto rounded-sm border-2 border-ink bg-hongcha px-1.5 text-xs">
                      {n.badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </div>
          <a
            href="#"
            className="flex items-center gap-3 rounded-md border-2 border-ink bg-canvas p-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-yuja font-mono font-bold">
              차
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold">차향</span>
              <span className="text-xs text-ink-muted">마이페이지</span>
            </span>
          </a>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* 모바일 상단 바 */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-ink bg-surface px-4 py-3 md:hidden">
            <span className="font-mono text-lg font-extrabold">티어리딩</span>
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-yuja font-mono font-bold">
              차
            </span>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-12">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-ink-muted">11월 7일 토요일 · 저녁</p>
              <h1 className="font-mono text-2xl font-extrabold tracking-tight md:text-4xl">
                차향 님, 오늘도 한 잔 우려 볼까요?
              </h1>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              {/* 타이머 */}
              <Card
                tone={phase === "done" ? "yuja" : "matcha"}
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
                          role="radio"
                          aria-checked={activity === a}
                          onClick={() => setActivity(a)}
                          className={cn(
                            "rounded-sm py-2.5 font-mono font-bold",
                            activity === a
                              ? "border-2 border-ink bg-ink text-canvas"
                              : "border-2 border-transparent",
                          )}
                        >
                          {a === "tea" ? "☕ 다도" : "📖 독서"}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((m) => (
                        <button
                          key={m}
                          onClick={() => pick(m)}
                          aria-pressed={minutes === m}
                          className={cn(
                            "h-10 rounded-md border-2 border-ink px-4 font-mono text-sm font-bold",
                            minutes === m
                              ? "bg-surface shadow-hard-sm"
                              : "bg-transparent",
                          )}
                        >
                          {m}분
                        </button>
                      ))}
                      <button className="h-10 rounded-md border-2 border-dashed border-ink px-4 font-mono text-sm font-bold">
                        직접 입력
                      </button>
                    </div>
                  </>
                )}

                {phase !== "idle" && (
                  <div className="flex items-center justify-between">
                    <Badge tone={phase === "done" ? "matcha" : "neutral"}>
                      {phase === "done" ? "완료" : `진행 중 · ${label}`}
                    </Badge>
                    <span className="font-mono text-sm font-bold">
                      목표 {minutes}분
                    </span>
                  </div>
                )}

                <p
                  className="text-center font-mono text-7xl font-extrabold tracking-tighter tabular-nums sm:text-8xl md:text-9xl"
                  aria-live="polite"
                >
                  {phase === "done" ? "수고했어요" : format(left)}
                </p>

                {phase === "running" && (
                  <div className="h-4 overflow-hidden rounded-sm border-2 border-ink bg-surface">
                    <div
                      className="h-full border-r-2 border-ink bg-ink transition-[width] duration-700"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )}

                {phase === "done" && (
                  <p className="text-center text-ink-muted">
                    {label} {minutes}분을 마쳤어요. 오늘 출석이 기록됐어요.
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  {phase === "idle" && (
                    <Button size="lg" onClick={() => setPhase("running")}>
                      {label} {minutes}분 시작
                    </Button>
                  )}
                  {phase === "running" && (
                    <>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => setPhase("done")}
                      >
                        완료
                      </Button>
                      <Button
                        size="lg"
                        variant="ghost"
                        onClick={() => {
                          setPhase("idle");
                          setLeft(minutes * 60);
                        }}
                      >
                        중단
                      </Button>
                    </>
                  )}
                  {phase === "done" && (
                    <>
                      <Button size="lg">독서기록 남기기</Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => {
                          setPhase("idle");
                          setLeft(minutes * 60);
                        }}
                      >
                        한 번 더
                      </Button>
                    </>
                  )}
                </div>
              </Card>

              <div className="flex flex-col gap-6">
                {/* 출석 */}
                <Card className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-mono text-lg font-bold">
                      이번 주 출석
                    </h2>
                    <Badge tone="yuja">🔥 4일 연속</Badge>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEK.map((w, i) => {
                      const attended =
                        w.m > 0 || (i === TODAY_INDEX && phase === "done");
                      return (
                        <div
                          key={w.d}
                          className="flex flex-col items-center gap-1"
                        >
                          <span
                            className={cn(
                              "text-xs",
                              i === TODAY_INDEX
                                ? "font-bold"
                                : "text-ink-muted",
                            )}
                          >
                            {w.d}
                          </span>
                          <span
                            className={cn(
                              "flex aspect-square w-full items-center justify-center rounded-sm border-2 border-ink text-xs font-bold",
                              attended ? "bg-matcha" : "bg-sunken",
                              i === TODAY_INDEX && "shadow-hard-sm",
                            )}
                          >
                            {attended ? "✓" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-end gap-1.5 border-t-2 border-ink pt-4">
                    {WEEK.map((w) => (
                      <div
                        key={w.d}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        <div
                          className="w-full rounded-t-sm border-2 border-ink bg-hojicha"
                          style={{ height: `${Math.max(w.m, 4) * 0.9}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-ink-muted">
                    이번 주 몰입 시간 3시간 40분
                  </p>
                </Card>

                {/* 찻집 */}
                <Card tone="hongcha" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-mono text-lg font-bold">찻집</h2>
                    <Badge>지금 3명</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {["책", "윤", "솔"].map((n, i) => (
                        <span
                          key={n}
                          className={cn(
                            "flex size-10 items-center justify-center rounded-full border-2 border-ink font-mono font-bold",
                            ["bg-surface", "bg-matcha", "bg-yuja"][i],
                          )}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm">
                      책읽는윤 님 외 2명이 조용히 읽고 있어요
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" className="self-start">
                    찻집 입장
                  </Button>
                </Card>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* 최근 기록 */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-lg font-bold">최근 기록</h2>
                  <a
                    href="#"
                    className="font-mono text-sm font-bold underline underline-offset-4"
                  >
                    전체 보기
                  </a>
                </div>
                {[
                  {
                    t: "데미안",
                    d: "새는 알에서 나오려고 투쟁한다. 알은 세계다.",
                    tag: "독서",
                    date: "11월 6일",
                  },
                  {
                    t: "우전 녹차 첫물",
                    d: "70도 물에 2분. 풋풋한 향이 오래 남았다.",
                    tag: "차 칼럼",
                    date: "11월 4일",
                  },
                ].map((r) => (
                  <Card
                    key={r.t}
                    className="flex flex-col gap-1.5 p-4 shadow-hard-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-mono font-bold">{r.t}</h3>
                      <Badge tone={r.tag === "독서" ? "hongcha" : "matcha"}>
                        {r.tag}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-ink-muted">{r.d}</p>
                    <p className="text-xs text-ink-subtle">{r.date}</p>
                  </Card>
                ))}
              </section>

              {/* 가이드 */}
              <section className="flex flex-col gap-3">
                <h2 className="font-mono text-lg font-bold">
                  오늘의 다도 가이드
                </h2>
                <Card tone="yuja" className="flex flex-col gap-3">
                  <Badge className="self-start">입문 · 3분</Badge>
                  <h3 className="font-mono text-xl font-bold">
                    녹차는 왜 끓는 물에 우리면 안 될까?
                  </h3>
                  <p className="text-sm">
                    녹차는 70~80도에서 단맛과 향이 살아나요. 물을 한 김 식히는
                    법부터 알아봐요.
                  </p>
                  <Button variant="secondary" size="sm" className="self-start">
                    읽어 보기
                  </Button>
                </Card>
              </section>
            </div>
          </main>
        </div>
      </div>

      {/* 모바일 하단 탭 */}
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t-2 border-ink bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.filter((n) => !n.desktopOnly).map((n) => (
          <a
            key={n.label}
            href="#"
            aria-current={n.active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-2.5 font-mono text-[11px] font-bold",
              n.active && "bg-matcha",
            )}
          >
            <span aria-hidden className="text-lg leading-none">
              {n.mark}
            </span>
            {n.short}
            {n.badge && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] size-2.5 rounded-full border-2 border-ink bg-hongcha" />
            )}
          </a>
        ))}
      </nav>
    </div>
  );
}
