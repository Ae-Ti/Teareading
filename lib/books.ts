import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedCover } from "@/lib/book-search";
import { isUuid } from "@/lib/records";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

// 읽기 상태와 장르. DB 체크 제약과 같아야 한다 (20261109001100_books.sql)
export const BOOK_STATUS = {
  reading: "읽는 중",
  done: "완독",
  paused: "보류",
  want: "읽고 싶음",
} as const;
export type BookStatus = keyof typeof BOOK_STATUS;
export const isBookStatus = (v: unknown): v is BookStatus =>
  typeof v === "string" && v in BOOK_STATUS;

export const STATUS_TONE: Record<BookStatus, string> = {
  reading: "bg-yuja",
  done: "bg-matcha",
  paused: "bg-sunken",
  want: "bg-hongcha",
};

export const GENRES = {
  novel: "소설",
  essay: "에세이",
  poetry: "시",
  humanities: "인문",
  history: "역사",
  science: "과학",
  society: "사회",
  economy: "경제·경영",
  selfhelp: "자기계발",
  art: "예술",
  philosophy: "철학·종교",
  comic: "만화",
  other: "기타",
} as const;
export type Genre = keyof typeof GENRES;
export const isGenre = (v: unknown): v is Genre =>
  typeof v === "string" && v in GENRES;
export const GENRE_MAX = 5;
export const BOOK_TITLE_MAX = 200;
export const AUTHOR_MAX = 100;
export const BOOK_PAGES_MAX = 200000;

export type BookRow = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  genres: Genre[];
  cover_url: string | null;
  log_count: number;
  pages: number;
  last_log_at: string | null;
  created_at: string;
};

export type BookValues = {
  title: string;
  author: string;
  status: BookStatus;
  genres: Genre[];
  coverUrl: string;
};
export type BookErrors = Partial<
  Record<"title" | "author" | "genres" | "form", string>
>;

export function validateBook(form: FormData) {
  const status = String(form.get("status") ?? "reading");
  const values: BookValues = {
    title: String(form.get("title") ?? "").trim(),
    author: String(form.get("author") ?? "").trim(),
    status: isBookStatus(status) ? status : "reading",
    genres: [...new Set(form.getAll("genres"))].filter(isGenre),
    coverUrl: (() => {
      const url = String(form.get("coverUrl") ?? "");
      return isAllowedCover(url) ? url : "";
    })(),
  };
  const errors: BookErrors = {};
  if (!values.title) errors.title = "책 제목을 입력해 주세요.";
  else if ([...values.title].length > BOOK_TITLE_MAX)
    errors.title = `책 제목은 ${BOOK_TITLE_MAX}자 이내로 입력해 주세요.`;
  if ([...values.author].length > AUTHOR_MAX)
    errors.author = `저자는 ${AUTHOR_MAX}자 이내로 입력해 주세요.`;
  if (values.genres.length > GENRE_MAX)
    errors.genres = `장르는 ${GENRE_MAX}개까지 고를 수 있어요.`;
  return { values, errors: Object.keys(errors).length ? errors : null };
}

export async function listBooks(supabase: Client) {
  const { data, error } = await supabase.rpc("my_books");
  if (error) return { books: [] as BookRow[], error };
  return { books: data as unknown as BookRow[], error: null };
}

export type BookLog = {
  id: string;
  body: string;
  pages_read: number | null;
  created_at: string;
  updated_at: string;
};

// 책 한 권과 그 책의 독서록. 남의 책은 RLS가 숨기므로 "없는 책"과 같다.
export async function getBook(supabase: Client, id: string) {
  if (!isUuid(id)) return { book: null, logs: [] as BookLog[], error: null };
  const [book, logs] = await Promise.all([
    supabase
      .from("books")
      .select(
        "id, title, author, status, genres, cover_url, pages_adjust, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("reading_logs")
      .select("id, body, pages_read, created_at, updated_at")
      .eq("book_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const error = book.error ?? logs.error;
  if (error || !book.data) return { book: null, logs: [] as BookLog[], error };
  return {
    error: null,
    book: book.data as unknown as Omit<
      BookRow,
      "log_count" | "pages" | "last_log_at"
    > & { pages_adjust: number },
    logs: (logs.data ?? []) as BookLog[],
  };
}

// 서재 표의 필터 (주소의 ?status=&genre=)
export type LibraryQuery = { status: BookStatus | null; genre: Genre | null };

export function parseLibraryQuery(
  params: Record<string, string | string[] | undefined>,
): LibraryQuery {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const status = one("status");
  const genre = one("genre");
  return {
    status: isBookStatus(status) ? status : null,
    genre: isGenre(genre) ? genre : null,
  };
}

export function libraryHref(
  query: LibraryQuery,
  change: Partial<LibraryQuery> = {},
) {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.genre) params.set("genre", next.genre);
  const qs = params.toString();
  return qs ? `/me/reading?${qs}` : "/me/reading";
}
