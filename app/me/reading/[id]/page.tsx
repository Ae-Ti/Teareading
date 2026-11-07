import { RecordDetailPage } from "@/components/records/record-detail";

export default function Page(props: PageProps<"/me/reading/[id]">) {
  return <RecordDetailPage kind="reading" params={props.params} />;
}
