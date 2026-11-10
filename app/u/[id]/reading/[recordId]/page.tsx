import { PublicRecordPage } from "@/components/profile/public-record-page";

export const metadata = { title: "독서기록 · 티어리딩" };

export default function Page(props: PageProps<"/u/[id]/reading/[recordId]">) {
  return <PublicRecordPage kind="reading" params={props.params} />;
}
