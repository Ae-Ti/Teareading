import Link from "next/link";
import { Suspense } from "react";
import { BookCover } from "@/components/books/book-cover";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  getRecord,
  RECORD_KINDS,
  TEA_TYPES,
  type RecordKind,
} from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { formatKoreanDateTime } from "@/lib/time";
import { DeleteRecordButton } from "./delete-record-button";

export function RecordDetailPage({
  kind,
  params,
}: {
  kind: RecordKind;
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <Link
        href={RECORD_KINDS[kind].path}
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← {RECORD_KINDS[kind].label} 목록
      </Link>
      <Suspense fallback={<LoadingBlock className="h-80" />}>
        <RecordDetail kind={kind} params={params} />
      </Suspense>
    </div>
  );
}

async function RecordDetail({
  kind,
  params,
}: {
  kind: RecordKind;
  params: Promise<{ id: string }>;
}) {
  const config = RECORD_KINDS[kind];
  const { id } = await params;
  const { supabase } = await requireUser(`${config.path}/${id}`);
  const { row, error } = await getRecord(supabase, kind, id);

  if (error) {
    return (
      <StateMessage
        tone="error"
        title="기록을 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  }
  if (!row) {
    return (
      <StateMessage
        title="기록을 찾을 수 없어요"
        description="삭제되었거나 볼 수 없는 기록이에요."
        action={{ href: config.path, label: "목록으로" }}
      />
    );
  }

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        {row.book_id && (
          <BookCover title={row.title} src={row.book?.cover_url} size="lg" />
        )}
        <div className="flex flex-wrap gap-2">
          <Badge tone={config.tone}>{config.label}</Badge>
          <Badge>{row.is_public ? "공개" : "비공개"}</Badge>
          {row.tea_type && <Badge>{TEA_TYPES[row.tea_type]}</Badge>}
          {row.pages_read && (
            <Badge>{row.pages_read.toLocaleString()}쪽 읽음</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold break-words md:text-4xl">
          {row.title}
        </h1>
        {row.book_id && (
          <Link
            href={`/me/books/${row.book_id}`}
            className="self-start text-sm font-bold underline underline-offset-4"
          >
            이 책의 독서록 모두 보기
          </Link>
        )}
        <p className="text-sm text-ink-muted">
          {formatKoreanDateTime(row.created_at)}
          {row.updated_at !== row.created_at &&
            ` · ${formatKoreanDateTime(row.updated_at)} 수정`}
        </p>
      </header>
      <Card className="p-5 md:p-8">
        <p className="leading-relaxed break-words whitespace-pre-wrap">
          {row.body}
        </p>
      </Card>
      <div className="flex flex-wrap gap-3">
        <LinkButton href={`${config.path}/${row.id}/edit`} variant="secondary">
          수정
        </LinkButton>
        <DeleteRecordButton kind={kind} id={row.id} label={config.label} />
      </div>
    </article>
  );
}
