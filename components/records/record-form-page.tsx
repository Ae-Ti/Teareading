import Link from "next/link";
import { Suspense } from "react";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getRecord, RECORD_KINDS, type RecordKind } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { RecordForm } from "./record-form";

export function NewRecordPage({ kind }: { kind: RecordKind }) {
  const config = RECORD_KINDS[kind];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Link
        href={config.path}
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← {config.label} 목록
      </Link>
      <h1 className="text-2xl font-bold md:text-3xl">새 {config.label}</h1>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <AuthGate next={`${config.path}/new`}>
          <RecordForm kind={kind} />
        </AuthGate>
      </Suspense>
    </div>
  );
}

async function AuthGate({
  next,
  children,
}: {
  next: string;
  children: React.ReactNode;
}) {
  await requireUser(next);
  return children;
}

export function EditRecordPage({
  kind,
  params,
}: {
  kind: RecordKind;
  params: Promise<{ id: string }>;
}) {
  const config = RECORD_KINDS[kind];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Link
        href={config.path}
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← {config.label} 목록
      </Link>
      <h1 className="text-2xl font-bold md:text-3xl">{config.label} 수정</h1>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <EditForm kind={kind} params={params} />
      </Suspense>
    </div>
  );
}

async function EditForm({
  kind,
  params,
}: {
  kind: RecordKind;
  params: Promise<{ id: string }>;
}) {
  const config = RECORD_KINDS[kind];
  const { id } = await params;
  const { supabase } = await requireUser(`${config.path}/${id}/edit`);
  const { row, error } = await getRecord(supabase, kind, id);

  if (error)
    return <StateMessage tone="error" title="기록을 불러오지 못했어요" />;
  if (!row) {
    return (
      <StateMessage
        title="기록을 찾을 수 없어요"
        description="삭제되었거나 수정할 수 없는 기록이에요."
        action={{ href: config.path, label: "목록으로" }}
      />
    );
  }
  return (
    <RecordForm
      kind={kind}
      id={row.id}
      initial={{ title: row.title, body: row.body }}
    />
  );
}
