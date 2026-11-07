import { RecordListPage } from "@/components/records/record-list";

export const metadata = { title: "내 기록 · 티어리딩" };

export default function Page() {
  return <RecordListPage kind="columns" />;
}
