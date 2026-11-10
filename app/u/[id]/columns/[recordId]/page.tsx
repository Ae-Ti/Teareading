import { PublicRecordPage } from "@/components/profile/public-record-page";

export const metadata = { title: "차 칼럼 · 티어리딩" };

export default function Page(props: PageProps<"/u/[id]/columns/[recordId]">) {
  return <PublicRecordPage kind="columns" params={props.params} />;
}
