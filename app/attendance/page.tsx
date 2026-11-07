import Link from "next/link";
import { Suspense } from "react";
import { TrackView } from "@/components/track-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { fetchAttendance } from "@/lib/attendance";
import { requireUser } from "@/lib/supabase/user";
import {
  addDays,
  formatDuration,
  kstDate,
  streak,
  WEEKDAY_LABELS,
  weekdayIndex,
} from "@/lib/time";

export const metadata = { title: "출석 · 티어리딩" };

export default function Page(props: PageProps<"/attendance">) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">출석</h1>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <Attendance searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function monthKey(day: string) {
  return day.slice(0, 7);
}

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

async function Attendance({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireUser("/attendance");
  const today = kstDate();
  const raw = (await searchParams).month;
  const month =
    typeof raw === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) &&
    raw <= monthKey(today)
      ? raw
      : monthKey(today);

  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);

  const [monthData, streakData] = await Promise.all([
    fetchAttendance(supabase, first, last),
    fetchAttendance(supabase, addDays(today, -366), today),
  ]);

  if (monthData.error || streakData.error) {
    return (
      <StateMessage
        tone="error"
        title="출석 정보를 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  }

  const byDay = new Map(monthData.days!.map((d) => [d.day, d]));
  const streakCount = streak(
    new Set(streakData.days!.map((d) => d.day)),
    today,
  );
  const attendedToday = streakData.days!.some((d) => d.day === today);
  const monthTotal = monthData.days!.reduce((s, d) => s + d.focus_seconds, 0);
  const everAttended = streakData.days!.length > 0;

  const cells: (string | null)[] = [
    ...Array<null>(weekdayIndex(first)).fill(null),
    ...Array.from({ length: Number(last.slice(8)) }, (_, i) =>
      addDays(first, i),
    ),
  ];
  const [y, m] = month.split("-");

  return (
    <div className="flex flex-col gap-6">
      <TrackView name="attendance_viewed" props={{ month }} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          tone={attendedToday ? "matcha" : "surface"}
          className="flex flex-col gap-1"
        >
          <span className="text-sm font-bold text-ink-muted">오늘</span>
          <span className="text-2xl font-bold">
            {attendedToday ? "출석 완료 ✓" : "아직 출석 전"}
          </span>
        </Card>
        <Card
          tone={streakCount > 0 ? "yuja" : "surface"}
          className="flex flex-col gap-1"
        >
          <span className="text-sm font-bold text-ink-muted">연속 출석</span>
          <span className="text-2xl font-bold">
            <span className="font-mono tabular-nums">{streakCount}</span>일
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink-muted">
            {Number(m)}월 출석
          </span>
          <span className="text-2xl font-bold">
            <span className="font-mono tabular-nums">{byDay.size}</span>일 ·{" "}
            {formatDuration(monthTotal)}
          </span>
        </Card>
      </div>

      {!everAttended && (
        <StateMessage
          title="아직 출석 이력이 없어요"
          description="다도나 독서 타이머를 끝까지 마치면 그날 출석으로 기록돼요."
          action={{ href: "/dashboard", label: "타이머 시작하기" }}
        />
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/attendance?month=${shiftMonth(month, -1)}`}
            className="rounded-md border-2 border-ink px-3 py-1.5 text-sm font-bold"
            aria-label="이전 달"
          >
            ←
          </Link>
          <h2 className="text-lg font-bold">
            <span className="font-mono">{y}</span>년{" "}
            <span className="font-mono">{Number(m)}</span>월
          </h2>
          {month < monthKey(today) ? (
            <Link
              href={`/attendance?month=${shiftMonth(month, 1)}`}
              className="rounded-md border-2 border-ink px-3 py-1.5 text-sm font-bold"
              aria-label="다음 달"
            >
              →
            </Link>
          ) : (
            <span className="w-11" />
          )}
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="text-xs font-bold text-ink-muted">
              {w}
            </span>
          ))}
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />;
            const record = byDay.get(day);
            const isToday = day === today;
            return (
              <div
                key={day}
                title={
                  record
                    ? `${record.sessions}회 · ${formatDuration(record.focus_seconds)}`
                    : undefined
                }
                aria-label={`${Number(day.slice(8))}일 ${record ? "출석" : "미출석"}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-sm border-2 text-sm",
                  record
                    ? "border-ink bg-matcha font-bold"
                    : "border-ink-subtle/50",
                  day > today && "opacity-40",
                  isToday && "border-ink shadow-hard-sm",
                )}
              >
                <span className="font-mono tabular-nums">
                  {Number(day.slice(8))}
                </span>
                {record && (
                  <span className="hidden text-[10px] sm:block">
                    {formatDuration(record.focus_seconds)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <Badge tone="matcha">✓</Badge> 완료한 타이머가 있는 날
          <span>· 기준: 한국 시간 하루</span>
        </div>
      </Card>

      {!attendedToday && everAttended && (
        <LinkButton href="/dashboard" className="self-start">
          오늘 출석하러 가기
        </LinkButton>
      )}
    </div>
  );
}
