import { EditRecordPage } from "@/components/records/record-form-page";

export default function Page(props: PageProps<"/me/reading/[id]/edit">) {
  return <EditRecordPage kind="reading" params={props.params} />;
}
