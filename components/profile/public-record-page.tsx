import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getPublicRecord } from "@/lib/profile/data";
import { isTeaType, isUuid, TEA_TYPES, type RecordKind } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { formatKoreanDateTime } from "@/lib/time";

type Params = Promise<{ id: string; recordId: string }>;

const LABEL: Record<RecordKind, string> = {
  columns: "칼럼",
  reading: "독서기록",
};

// 다른 회원이 공개로 지정한 차 칼럼·독서기록을 읽는 화면
export function PublicRecordPage({
  kind,
  params,
}: {
  kind: RecordKind;
  params: Params;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Suspense fallback={<LoadingBlock className="h-80" />}>
        <PublicRecord kind={kind} params={params} />
      </Suspense>
    </div>
  );
}

async function PublicRecord({
  kind,
  params,
}: {
  kind: RecordKind;
  params: Params;
}) {
  const { id, recordId } = await params;
  const path = kind === "columns" ? "columns" : "reading";
  const { supabase } = await requireUser(
    `/u/${encodeURIComponent(id)}/${path}/${encodeURIComponent(recordId)}`,
  );
  const back = `/u/${encodeURIComponent(id)}`;
  const label = LABEL[kind];
  const { record, error } = isUuid(recordId)
    ? await getPublicRecord(supabase, kind, recordId)
    : { record: null, error: null };
  if (error)
    return (
      <StateMessage
        tone="error"
        title={`${label}을 불러오지 못했어요`}
        description="잠시 후 다시 시도해 주세요."
        action={{ href: back, label: "프로필로" }}
      />
    );
  // 주소의 회원과 작성자가 다르거나 비공개면 없는 글로 본다
  if (!record || record.user_id !== id)
    return (
      <StateMessage
        title={`${label}을 찾을 수 없어요`}
        description="삭제되었거나 비공개인 글이에요."
        action={{ href: back, label: "프로필로" }}
      />
    );

  return (
    <>
      <Link
        href={back}
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 프로필로
      </Link>
      <article className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {isTeaType(record.tea_type) && (
              <Badge tone="matcha">{TEA_TYPES[record.tea_type]}</Badge>
            )}
            {record.pages_read != null && (
              <Badge tone="hongcha">
                {record.pages_read.toLocaleString()}쪽 읽음
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold break-words md:text-3xl">
            {record.title}
          </h1>
          <p className="text-sm text-ink-muted">
            {formatKoreanDateTime(record.created_at)}
          </p>
        </header>
        <Card>
          <p className="leading-relaxed break-words whitespace-pre-wrap">
            {record.body}
          </p>
        </Card>
      </article>
    </>
  );
}
