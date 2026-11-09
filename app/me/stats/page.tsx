import { RecordStatsPanel } from "@/components/records/record-stats";
import { RecordTabs } from "@/components/records/record-tabs";

export const metadata = { title: "통계 · 내 기록 · 티어리딩" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">내 기록</h1>
      <RecordTabs active="stats" />
      <RecordStatsPanel />
    </div>
  );
}
