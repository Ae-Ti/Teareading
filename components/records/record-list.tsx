import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { Badge } from "@/components/ui/badge";
import {
  listRecords,
  RECORD_KINDS,
  TEA_TYPES,
  type RecordKind,
} from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { formatKoreanDate } from "@/lib/time";
import { RecordTabs } from "./record-tabs";

export function RecordListPage({ kind }: { kind: RecordKind }) {
  const config = RECORD_KINDS[kind];
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">내 기록</h1>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <RecordTabs active={kind} />
        </div>
        <LinkButton
          href={`${config.path}/new`}
          size="sm"
          className="mb-1 shrink-0"
        >
          새 {config.label}
        </LinkButton>
      </div>
      <Suspense fallback={<LoadingBlock />}>
        <RecordList kind={kind} />
      </Suspense>
    </div>
  );
}

async function RecordList({ kind }: { kind: RecordKind }) {
  const config = RECORD_KINDS[kind];
  const { supabase } = await requireUser(config.path);
  const { rows, error } = await listRecords(supabase, kind);

  if (error) {
    return (
      <StateMessage
        tone="error"
        title={`${config.label}을 불러오지 못했어요`}
        description="잠시 후 새로고침해 주세요."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <StateMessage
        title={config.emptyTitle}
        description={config.emptyDescription}
        action={{ href: `${config.path}/new`, label: "첫 글 쓰기" }}
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`${config.path}/${r.id}`} className="block">
            <Card className="flex h-full flex-col gap-2 p-4 shadow-hard-sm transition hover:-translate-y-px hover:shadow-hard">
              <h2 className="truncate text-lg font-bold">{r.title}</h2>
              {(r.tea_type || r.pages_read) && (
                <div>
                  <Badge>
                    {r.tea_type
                      ? TEA_TYPES[r.tea_type]
                      : `${r.pages_read!.toLocaleString()}쪽`}
                  </Badge>
                </div>
              )}
              <p className="line-clamp-2 text-sm text-ink-muted">{r.body}</p>
              <p className="mt-auto text-xs text-ink-subtle">
                {formatKoreanDate(r.created_at)}
                {r.updated_at !== r.created_at && " · 수정됨"}
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
