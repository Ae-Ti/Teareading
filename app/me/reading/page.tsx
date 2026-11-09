import { BookLibraryPage } from "@/components/books/book-library";

export const metadata = { title: "내 기록 · 티어리딩" };

export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BookLibraryPage searchParams={props.searchParams} />;
}
