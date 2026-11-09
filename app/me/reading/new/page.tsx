import { NewRecordPage } from "@/components/records/record-form-page";

export default function Page(props: PageProps<"/me/reading/new">) {
  return <NewRecordPage kind="reading" searchParams={props.searchParams} />;
}
