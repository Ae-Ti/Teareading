import Link from "next/link";
import { Suspense } from "react";
import { WeekAttendance } from "@/components/attendance/week-attendance";
import { SpacePeekText } from "@/components/space/space-peek";
import { TimerPanel } from "@/components/timer/timer-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { fetchAttendance } from "@/lib/attendance";
import { guideOfDay } from "@/lib/guide";
import { recentRecords } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { addDays, formatKoreanDate, kstDate, streak } from "@/lib/time";

export const metadata = { title: "타이머 · 티어리딩" };

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function greeting(hour: number) {
  if (hour < 5) return "늦은 밤";
  if (hour < 11) return "아침";
  if (hour < 17) return "오후";
  return "저녁";
}

async function Dashboard() {
  const { supabase, userId } = await requireUser("/dashboard");
  const now = new Date();
  const today = kstDate(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );

  const [profile, running, attendance, records, guide] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", userId).single(),
    supabase
      .from("timer_sessions")
      .select("*")
      .eq("status", "running")
      .maybeSingle(),
    fetchAttendance(supabase, addDays(today, -366), today),
    recentRecords(supabase, 2),
    guideOfDay(today),
  ]);

  const days = attendance.days ?? [];
  const streakCount = streak(new Set(days.map((d) => d.day)), today);

  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">
          {formatKoreanDate(now, true)} · {greeting(hour)}
        </p>
        <h1 className="text-2xl font-bold md:text-4xl">
          {profile.data?.nickname ?? "손님"} 님, 오늘도 한 잔 우려 볼까요?
        </h1>
      </div>

      {(running.error || attendance.error) && (
        <StateMessage
          tone="error"
          title="최신 정보를 불러오지 못했어요"
          description="네트워크 상태를 확인하고 새로고침해 주세요."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <TimerPanel initialSession={running.data} serverNow={now.getTime()} />

        <div className="flex flex-col gap-6">
          <WeekAttendance today={today} days={days} streakCount={streakCount} />

          <Card tone="hongcha" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">찻집</h2>
              <Badge>함께 읽는 공간</Badge>
            </div>
            <SpacePeekText />
            <LinkButton
              href="/space"
              variant="secondary"
              size="sm"
              className="self-start"
            >
              찻집 입장
            </LinkButton>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">최근 기록</h2>
            <Link
              href="/me"
              className="text-sm font-bold underline underline-offset-4"
            >
              전체 보기
            </Link>
          </div>
          {records.length === 0 ? (
            <StateMessage
              title="아직 쓴 기록이 없어요"
              description="타이머를 마친 뒤 오늘 읽은 내용을 남겨 보세요."
              action={{ href: "/me/reading", label: "첫 기록 쓰기" }}
            />
          ) : (
            records.map((r) => (
              <Link key={r.href} href={r.href}>
                <Card className="flex flex-col gap-1.5 p-4 shadow-hard-sm transition hover:-translate-y-px">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold">{r.title}</h3>
                    <Badge tone={r.kind === "reading" ? "hongcha" : "matcha"}>
                      {r.kindLabel}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-ink-muted">{r.excerpt}</p>
                  <p className="text-xs text-ink-subtle">
                    {formatKoreanDate(r.createdAt)}
                  </p>
                </Card>
              </Link>
            ))
          )}
        </section>

        {guide && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">오늘의 다도 가이드</h2>
            <Card tone="yuja" className="flex flex-col gap-3">
              <Badge className="self-start">
                입문 · <span className="font-mono">{guide.minutes}</span>분
              </Badge>
              <h3 className="text-xl font-bold">{guide.title}</h3>
              <p className="text-sm">{guide.summary}</p>
              <LinkButton
                href={`/guide/${guide.slug}`}
                variant="secondary"
                size="sm"
                className="self-start"
              >
                읽어 보기
              </LinkButton>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <LoadingBlock className="h-16" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <LoadingBlock className="h-96" />
        <LoadingBlock className="h-96" />
      </div>
    </div>
  );
}
