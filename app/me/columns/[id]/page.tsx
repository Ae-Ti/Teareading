import { RecordDetailPage } from "@/components/records/record-detail";

export default function Page(props: PageProps<"/me/columns/[id]">) {
  return <RecordDetailPage kind="columns" params={props.params} />;
}
