import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getBook } from "@/lib/books";
import { getRecord, RECORD_KINDS, type RecordKind } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { RecordForm } from "./record-form";

export function NewRecordPage({
  kind,
  searchParams,
}: {
  kind: RecordKind;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
      <h1 className="text-2xl font-bold md:text-3xl">새 {config.label}</h1>
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        {kind === "reading" && searchParams ? (
          <NewBookLog searchParams={searchParams} />
        ) : (
          <AuthGate next={`${config.path}/new`}>
            <RecordForm kind={kind} />
          </AuthGate>
        )}
      </Suspense>
    </div>
  );
}

// 독서록은 책에 달린다: 표의 '독서록 작성'에서 책을 정해 들어온다. 책 없이 오면 서재로 보낸다.
async function NewBookLog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).book;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const { supabase } = await requireUser(
    id ? `/me/reading/new?book=${encodeURIComponent(id)}` : "/me/reading",
  );
  if (!id) redirect("/me/reading");
  const { book, error } = await getBook(supabase, id);
  if (error)
    return <StateMessage tone="error" title="책을 불러오지 못했어요" />;
  if (!book)
    return (
      <StateMessage
        title="책을 찾을 수 없어요"
        description="서재에서 책을 다시 골라 주세요."
        action={{ href: "/me/reading", label: "서재로" }}
      />
    );
  return <RecordForm kind="reading" book={book} />;
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
  // 독서록을 고칠 때도 책은 바꾸지 않고 보여 주기만 한다
  const book =
    kind === "reading" && row.book_id
      ? { id: row.book_id, title: row.title }
      : undefined;
  return (
    <RecordForm
      kind={kind}
      id={row.id}
      book={book}
      initial={{
        title: row.title,
        body: row.body,
        pages: row.pages_read?.toString() ?? "",
        teaType: row.tea_type ?? "",
      }}
    />
  );
}
