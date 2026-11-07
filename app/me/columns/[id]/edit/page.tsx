import { EditRecordPage } from "@/components/records/record-form-page";

export default function Page(props: PageProps<"/me/columns/[id]/edit">) {
  return <EditRecordPage kind="columns" params={props.params} />;
}
