import { RecordListPage } from "@/components/records/record-list";

export const metadata = { title: "내 기록 · 티어리딩" };

// 내 기록의 기본 탭은 독서기록
export default function Page() {
  return <RecordListPage kind="reading" />;
}
