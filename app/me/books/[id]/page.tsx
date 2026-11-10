import Link from "next/link";
import { Suspense } from "react";
import { BookCover } from "@/components/books/book-cover";
import { BookDialogButton } from "@/components/books/book-dialog";
import { GenreTags } from "@/components/books/book-tags";
import { DeleteBookButton } from "@/components/books/delete-book-button";
import { PagesEditor } from "@/components/books/pages-editor";
import { StatusSelect } from "@/components/books/status-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getBook } from "@/lib/books";
import { requireUser } from "@/lib/supabase/user";
import { formatKoreanDate } from "@/lib/time";

export const metadata = { title: "서재 · 티어리딩" };

export default function Page(props: PageProps<"/me/books/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Link
        href="/me/reading"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 독서기록
      </Link>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <BookDetail params={props.params} />
      </Suspense>
    </div>
  );
}

async function BookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser(`/me/books/${encodeURIComponent(id)}`);
  const { book, logs, error } = await getBook(supabase, id);
  if (error)
    return (
      <StateMessage
        tone="error"
        title="책을 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  if (!book)
    return (
      <StateMessage
        title="책을 찾을 수 없어요"
        description="삭제되었거나 없는 책이에요."
        action={{ href: "/me/reading", label: "서재로" }}
      />
    );
  const pages = Math.max(
    logs.reduce((sum, l) => sum + (l.pages_read ?? 0), 0) + book.pages_adjust,
    0,
  );
  const newHref = `/me/reading/new?book=${book.id}`;

  return (
    <>
      <Card className="flex flex-col gap-4 p-5 md:p-8">
        <div className="flex items-start gap-4">
          <BookCover title={book.title} src={book.cover_url} size="lg" />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-2xl font-bold break-words md:text-3xl">
              {book.title}
            </h1>
            {book.author && <p className="text-ink-muted">{book.author}</p>}
            <GenreTags genres={book.genres} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="w-28">
            <StatusSelect
              id={book.id}
              title={book.title}
              status={book.status}
            />
          </div>
          <span>
            읽은 쪽{" "}
            <PagesEditor id={book.id} title={book.title} pages={pages} />
          </span>
          <span>
            독서록 <b className="font-mono tabular-nums">{logs.length}</b>
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-2 border-t-2 border-ink pt-4">
          <LinkButton href={newHref} size="sm">
            독서록 작성
          </LinkButton>
          <BookDialogButton
            label="수정"
            variant="secondary"
            book={{
              id: book.id,
              title: book.title,
              author: book.author ?? "",
              status: book.status,
              genres: book.genres,
              coverUrl: book.cover_url ?? "",
            }}
          />
          <DeleteBookButton
            id={book.id}
            title={book.title}
            logCount={logs.length}
          />
        </div>
      </Card>

      <section aria-labelledby="book-logs" className="flex flex-col gap-3">
        <h2 id="book-logs" className="text-lg font-bold">
          독서록 <span className="font-mono">{logs.length}</span>
        </h2>
        {logs.length === 0 ? (
          <StateMessage
            title="아직 독서록이 없어요"
            description="이 책을 읽으며 남기고 싶은 문장과 생각을 적어 보세요."
            action={{ href: newHref, label: "독서록 작성" }}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {logs.map((l) => (
              <li key={l.id}>
                <Link href={`/me/reading/${l.id}`} className="block">
                  <Card className="flex items-start gap-3 p-4 shadow-hard-sm transition hover:-translate-y-px hover:shadow-hard">
                    <BookCover
                      title={book.title}
                      src={book.cover_url}
                      size="md"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                        <span>
                          {formatKoreanDate(l.created_at)}
                          {l.updated_at !== l.created_at && " · 수정됨"}
                        </span>
                        {l.pages_read && (
                          <Badge>{l.pages_read.toLocaleString()}쪽</Badge>
                        )}
                      </div>
                      <p className="line-clamp-3 leading-relaxed break-words whitespace-pre-wrap">
                        {l.body}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
