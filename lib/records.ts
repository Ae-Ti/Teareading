import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventName } from "@/lib/track";
import type { Database } from "@/types/database";

// 독서기록과 차 칼럼은 같은 화면 구조를 쓰고 설정만 다르다 (명세 3.1·3.2)
export const RECORD_KINDS = {
  reading: {
    table: "reading_logs",
    titleColumn: "book_title",
    path: "/me/reading",
    label: "독서기록",
    short: "독서",
    titleLabel: "책 제목",
    titlePlaceholder: "예: 데미안",
    bodyLabel: "기록",
    bodyPlaceholder:
      "읽은 내용, 마음에 남은 문장, 떠오른 생각을 자유롭게 적어 보세요.",
    emptyTitle: "아직 쓴 독서기록이 없어요",
    emptyDescription: "타이머로 책을 읽은 뒤 오늘의 한 문장을 남겨 보세요.",
    event: "reading_log_created",
    tone: "hongcha",
  },
  columns: {
    table: "tea_columns",
    titleColumn: "title",
    path: "/me/columns",
    label: "차 칼럼",
    short: "차 칼럼",
    titleLabel: "제목",
    titlePlaceholder: "예: 우전 녹차 첫물",
    bodyLabel: "본문",
    bodyPlaceholder:
      "마신 차, 우린 방법, 향과 맛, 그날의 생각을 글로 남겨 보세요.",
    emptyTitle: "아직 쓴 차 칼럼이 없어요",
    emptyDescription: "오늘 마신 차 이야기를 한 편의 글로 남겨 보세요.",
    event: "tea_column_created",
    tone: "matcha",
  },
} as const satisfies Record<
  string,
  {
    table: "reading_logs" | "tea_columns";
    titleColumn: string;
    event: EventName;
    tone: "hongcha" | "matcha";
    [key: string]: string;
  }
>;

export type RecordKind = keyof typeof RECORD_KINDS;

export type RecordRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  pages_read?: number | null;
  book_id?: string | null;
  book?: { cover_url: string | null } | null;
  tea_type?: TeaType | null;
};

// 차 칼럼의 차 종류. DB 체크 제약과 같아야 한다 (20261109001000_record_stats.sql)
export const TEA_TYPES = {
  green: "녹차",
  white: "백차",
  oolong: "우롱차",
  black: "홍차",
  puer: "보이차",
  other: "기타",
} as const;
export type TeaType = keyof typeof TEA_TYPES;
export const isTeaType = (v: unknown): v is TeaType =>
  typeof v === "string" && v in TEA_TYPES;

export const PAGES_MAX = 20000;
export const TITLE_MAX = 200;
export const BODY_MAX = 20000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

function columns(kind: RecordKind) {
  const extra =
    kind === "reading"
      ? "pages_read, book_id, book:books(cover_url)"
      : "tea_type";
  return `id, title:${RECORD_KINDS[kind].titleColumn}, body, is_public, created_at, updated_at, ${extra}`;
}

export async function listRecords(
  supabase: SupabaseClient<Database>,
  kind: RecordKind,
) {
  const { data, error } = await supabase
    .from(RECORD_KINDS[kind].table)
    .select(columns(kind))
    .order("created_at", { ascending: false });
  return { rows: (data ?? []) as unknown as RecordRow[], error };
}

export async function getRecord(
  supabase: SupabaseClient<Database>,
  kind: RecordKind,
  id: string,
) {
  if (!isUuid(id)) return { row: null, error: null };
  const { data, error } = await supabase
    .from(RECORD_KINDS[kind].table)
    .select(columns(kind))
    .eq("id", id)
    .maybeSingle();
  return { row: data as unknown as RecordRow | null, error };
}

// 대시보드 "최근 기록": 두 종류를 합쳐 최신순
export async function recentRecords(
  supabase: SupabaseClient<Database>,
  limit: number,
) {
  const kinds = Object.keys(RECORD_KINDS) as RecordKind[];
  const results = await Promise.all(
    kinds.map(async (kind) => {
      const { data } = await supabase
        .from(RECORD_KINDS[kind].table)
        .select(columns(kind))
        .order("created_at", { ascending: false })
        .limit(limit);
      return ((data ?? []) as unknown as RecordRow[]).map((r) => ({
        kind,
        kindLabel: RECORD_KINDS[kind].short,
        href: `${RECORD_KINDS[kind].path}/${r.id}`,
        title: r.title,
        excerpt: r.body.replace(/\s+/g, " ").slice(0, 80),
        createdAt: r.created_at,
      }));
    }),
  );
  return results
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
