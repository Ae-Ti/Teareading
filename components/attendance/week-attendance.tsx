import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import type { AttendanceDay } from "@/lib/attendance";
import { formatDuration, WEEKDAY_LABELS, weekOf } from "@/lib/time";
import Link from "next/link";

export function WeekAttendance({
  today,
  days,
  streakCount,
}: {
  today: string;
  days: AttendanceDay[];
  streakCount: number;
}) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const week = weekOf(today);
  const maxSeconds = Math.max(
    3600,
    ...week.map((d) => byDay.get(d)?.focus_seconds ?? 0),
  );
  const total = week.reduce(
    (s, d) => s + (byDay.get(d)?.focus_seconds ?? 0),
    0,
  );
  const attendedToday = byDay.has(today);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">이번 주 출석</h2>
        {streakCount > 0 ? (
          <Badge tone="yuja">🔥 {streakCount}일 연속</Badge>
        ) : (
          <Badge>연속 기록 없음</Badge>
        )}
      </div>

      <ol className="grid grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const attended = byDay.has(d);
          const isToday = d === today;
          return (
            <li key={d} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "text-xs",
                  isToday ? "font-bold" : "text-ink-muted",
                )}
              >
                {WEEKDAY_LABELS[i]}
              </span>
              <span
                aria-label={`${WEEKDAY_LABELS[i]}요일 ${attended ? "출석" : "미출석"}`}
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-sm border-2 border-ink text-xs font-bold",
                  attended
                    ? "bg-matcha"
                    : d > today
                      ? "border-dashed border-ink-subtle bg-transparent"
                      : "bg-sunken",
                  isToday && "shadow-hard-sm",
                )}
              >
                {attended ? "✓" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {/* 몰입 시간이 없는 주에는 빈 막대 대신 아래 요약 문장만 보여 준다 */}
      {total > 0 && (
        <div
          className="flex h-24 items-end gap-1.5 border-t-2 border-ink pt-4"
          aria-hidden
        >
          {week.map((d) => {
            const sec = byDay.get(d)?.focus_seconds ?? 0;
            return (
              <div
                key={d}
                className={cn(
                  "flex-1 rounded-t-sm",
                  sec > 0
                    ? "border-2 border-ink bg-hojicha"
                    : "border-b-2 border-ink",
                )}
                style={{
                  height:
                    sec > 0
                      ? `${Math.max(12, (sec / maxSeconds) * 100)}%`
                      : undefined,
                }}
              />
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-ink-muted">
          {attendedToday ? "오늘 출석 완료 · " : "오늘은 아직 출석 전 · "}
          이번 주 몰입 {formatDuration(total)}
        </p>
        <Link
          href="/attendance"
          className="shrink-0 font-bold underline underline-offset-4"
        >
          달력 보기
        </Link>
      </div>
    </Card>
  );
}
