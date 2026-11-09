import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getRecordStats, type MonthValue } from "@/lib/record-stats";
import { TEA_TYPES } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { formatDuration } from "@/lib/time";

// 내 기록 화면의 통계. 본인만 볼 수 있고 공개 프로필에는 나오지 않는다.
export function RecordStatsSection() {
  return (
    <section
      aria-labelledby="record-stats-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="record-stats-heading" className="text-lg font-bold">
        통계
      </h2>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <RecordStats />
      </Suspense>
    </section>
  );
}

async function RecordStats() {
  const { supabase } = await requireUser("/me");
  const { stats, error } = await getRecordStats(supabase);
  if (error || !stats)
    return (
      <StateMessage
        tone="error"
        title="통계를 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  const { reading, tea } = stats;
  const average = tea.sessions ? Math.round(tea.seconds / tea.sessions) : 0;
  const teaTypes = [
    ...tea.by_type.map((t) => ({ label: TEA_TYPES[t.type], value: t.count })),
    ...(tea.untyped ? [{ label: "종류 미선택", value: tea.untyped }] : []),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-5" data-stats="reading">
        <h3 className="font-bold">독서</h3>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="읽은 책" value={reading.books} unit="권" />
          <Stat label="읽은 페이지" value={reading.pages} unit="쪽" />
          <Stat label="이번 달" value={reading.pages_this_month} unit="쪽" />
        </dl>
        <Block title="월별 읽은 페이지">
          <MonthBars
            data={reading.monthly}
            format={(v) => `${v.toLocaleString()}쪽`}
            empty="독서기록에 페이지 수를 적으면 여기에 쌓여요."
          />
        </Block>
        <Block title="책별 페이지">
          <RankBars
            rows={reading.top_books.map((b) => ({
              label: b.title,
              value: b.pages,
            }))}
            format={(v) => `${v.toLocaleString()}쪽`}
            empty="페이지 수를 적은 책이 아직 없어요."
          />
        </Block>
      </Card>

      <Card className="flex flex-col gap-5" data-stats="tea">
        <h3 className="font-bold">차</h3>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="다도 시간" text={formatDuration(tea.seconds)} />
          <Stat label="다도 횟수" value={tea.sessions} unit="번" />
          <Stat label="1회 평균" text={formatDuration(average)} />
        </dl>
        <Block title="월별 다도 시간">
          <MonthBars
            data={tea.monthly}
            format={formatDuration}
            empty="다도 타이머를 완료하면 여기에 쌓여요."
          />
          <p className="text-xs text-ink-muted">
            이번 달 {formatDuration(tea.seconds_this_month)}
          </p>
        </Block>
        <Block title="마신 차 종류">
          <RankBars
            rows={teaTypes}
            format={(v) => `${v.toLocaleString()}번`}
            empty="차 칼럼에 차 종류를 고르면 여기에 쌓여요."
          />
        </Block>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  text,
}: {
  label: string;
  value?: number;
  unit?: string;
  text?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-lg font-bold break-keep">
        {text ?? (
          <>
            <span className="font-mono text-2xl tabular-nums">
              {(value ?? 0).toLocaleString()}
            </span>
            <span className="ml-0.5 text-sm">{unit}</span>
          </>
        )}
      </dd>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t-2 border-sunken pt-3">
      <h4 className="text-sm font-bold">{title}</h4>
      {children}
    </div>
  );
}

const monthLabel = (month: string) => `${Number(month.slice(5))}월`;

// 최근 6개월 세로 막대. 마지막 달의 값만 적고, 나머지는 마우스·키보드로 본다.
function MonthBars({
  data,
  format,
  empty,
}: {
  data: MonthValue[];
  format: (value: number) => string;
  empty: string;
}) {
  const max = Math.max(...data.map((d) => d.value));
  if (max <= 0) return <p className="py-2 text-sm text-ink-muted">{empty}</p>;
  const last = data.length - 1;
  return (
    <ol className="grid grid-cols-6">
      {data.map((d, i) => (
        <li
          key={d.month}
          tabIndex={0}
          className="group/bar relative flex flex-col items-center gap-1 rounded focus:outline-none focus-visible:bg-sunken"
        >
          <span className="sr-only">
            {monthLabel(d.month)} {format(d.value)}
          </span>
          <div
            aria-hidden
            className="mt-5 flex h-24 w-full items-end justify-center border-b border-ink-subtle"
          >
            <div
              className="w-full max-w-6 rounded-t bg-matcha-strong"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span aria-hidden className="text-[11px] text-ink-muted">
            {monthLabel(d.month)}
          </span>
          {i === last && d.value > 0 && (
            <span
              aria-hidden
              className="absolute top-0 text-[11px] font-bold whitespace-nowrap group-hover/bar:opacity-0 group-focus-visible/bar:opacity-0"
            >
              {format(d.value)}
            </span>
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 z-10 rounded border-2 border-ink bg-surface px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100"
          >
            {format(d.value)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// 많은 순 가로 막대. 항목이 적어 값은 막대 끝에 바로 적는다.
function RankBars({
  rows,
  format,
  empty,
}: {
  rows: { label: string; value: number }[];
  format: (value: number) => string;
  empty: string;
}) {
  if (!rows.length)
    return <p className="py-2 text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 truncate" title={r.label}>
            {r.label}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 rounded-r bg-matcha-strong"
              style={{ width: `calc((100% - 4.5rem) * ${r.value / max})` }}
            />
            <span className="shrink-0 font-mono text-xs font-bold tabular-nums">
              {format(r.value)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
