import Link from "next/link";
import { BookCover } from "@/components/books/book-cover";
import { Card } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
import type { getPublicRecords } from "@/lib/profile/data";
import { isTeaType, TEA_TYPES } from "@/lib/records";
import { formatKoreanDate } from "@/lib/time";

// 공개 프로필: 완독한 책과 차 칼럼
export function PublicRecords({
  userId,
  records,
}: {
  userId: string;
  records: Awaited<ReturnType<typeof getPublicRecords>>;
}) {
  return (
    <>
      <section className="space-y-4" aria-labelledby="public-books-heading">
        <h2 id="public-books-heading" className="text-xl font-bold">
          읽은 책
        </h2>
        {records.error ? (
          <StateMessage tone="error" title="읽은 책을 불러오지 못했어요" />
        ) : records.books.length === 0 ? (
          <StateMessage title="아직 다 읽은 책이 없어요" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {records.books.map((book) => (
              <li key={book.id}>
                <Card className="flex h-full items-center gap-3 p-3 shadow-hard-sm">
                  <BookCover
                    title={book.title}
                    src={book.cover_url}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-bold break-words">
                      {book.title}
                    </p>
                    {book.author && (
                      <p className="truncate text-sm text-ink-muted">
                        {book.author}
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="public-logs-heading">
        <h2 id="public-logs-heading" className="text-xl font-bold">
          독서기록
        </h2>
        {records.error ? (
          <StateMessage tone="error" title="독서기록을 불러오지 못했어요" />
        ) : records.logs.length === 0 ? (
          <StateMessage title="공개한 독서기록이 없어요" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y-2 divide-sunken">
              {records.logs.map((log) => (
                <li key={log.id}>
                  <Link
                    href={`/u/${userId}/reading/${log.id}`}
                    className="flex flex-col gap-1 p-3 hover:bg-sunken"
                  >
                    <span className="truncate font-bold">{log.title}</span>
                    <span className="truncate text-sm text-ink-muted">
                      {log.excerpt}
                    </span>
                    <span className="text-xs text-ink-subtle">
                      {log.pages_read != null &&
                        `${log.pages_read.toLocaleString()}쪽 · `}
                      {formatKoreanDate(log.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="public-columns-heading">
        <h2 id="public-columns-heading" className="text-xl font-bold">
          차 칼럼
        </h2>
        {records.error ? (
          <StateMessage tone="error" title="차 칼럼을 불러오지 못했어요" />
        ) : records.columns.length === 0 ? (
          <StateMessage title="공개한 차 칼럼이 없어요" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y-2 divide-sunken">
              {records.columns.map((column) => (
                <li key={column.id}>
                  <Link
                    href={`/u/${userId}/columns/${column.id}`}
                    className="flex flex-col gap-1 p-3 hover:bg-sunken"
                  >
                    <span className="truncate font-bold">{column.title}</span>
                    <span className="truncate text-sm text-ink-muted">
                      {column.excerpt}
                    </span>
                    <span className="text-xs text-ink-subtle">
                      {isTeaType(column.tea_type) &&
                        `${TEA_TYPES[column.tea_type]} · `}
                      {formatKoreanDate(column.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
