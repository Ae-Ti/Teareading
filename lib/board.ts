import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/records";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

// 말머리. DB 체크 제약과 같아야 한다 (20261109000500_board.sql)
export const CATEGORIES = {
  free: "자유",
  question: "질문",
  book: "책 추천",
  tea: "차 이야기",
} as const;
export type Category = keyof typeof CATEGORIES;
export const isCategory = (v: unknown): v is Category =>
  typeof v === "string" && v in CATEGORIES;

export const SORTS = {
  latest: "최신순",
  likes: "추천순",
  views: "조회순",
  comments: "댓글순",
} as const;
export type Sort = keyof typeof SORTS;

export const FIELDS = {
  title_body: "제목+내용",
  title: "제목",
  author: "작성자",
} as const;
export type Field = keyof typeof FIELDS;

export const PAGE_SIZE = 20;
export const TITLE_MIN = 2;
export const TITLE_MAX = 100;
export const BODY_MAX = 10000;
export const COMMENT_MAX = 1000;

const chars = (v: string) => [...v].length;

// 보이지 않는 문자(전각 공백, 한글 채움 문자, 폭 없는 문자 등)만 있는 입력을 막는다.
// DB의 has_visible_text와 같은 기준이다.
const INVISIBLE =
  /[\s\u00A0\u00AD\u115F\u1160\u1680\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u3000\u3164\uFEFF\uFFA0]/g;
export const hasVisibleText = (v: string) =>
  v.replace(INVISIBLE, "").length > 0;

// ── 입력 검사 (DB 제약과 같은 기준) ──
export type PostValues = { category: Category; title: string; body: string };
export type PostErrors = Partial<Record<keyof PostValues | "form", string>>;

export function validatePost(form: FormData) {
  const category = String(form.get("category") ?? "free");
  const values: PostValues = {
    category: isCategory(category) ? category : "free",
    title: String(form.get("title") ?? "").trim(),
    body: String(form.get("body") ?? "").replace(
      /^[ \t\r\n]+|[ \t\r\n]+$/g,
      "",
    ),
  };
  const errors: PostErrors = {};
  if (!isCategory(category)) errors.category = "말머리를 골라 주세요.";
  if (
    !hasVisibleText(values.title) ||
    chars(values.title) < TITLE_MIN ||
    chars(values.title) > TITLE_MAX
  )
    errors.title = `제목은 ${TITLE_MIN}~${TITLE_MAX}자로 입력해 주세요.`;
  if (!hasVisibleText(values.body)) errors.body = "내용을 입력해 주세요.";
  else if (chars(values.body) > BODY_MAX)
    errors.body = `내용은 ${BODY_MAX.toLocaleString()}자 이내로 입력해 주세요.`;
  return { values, errors: Object.keys(errors).length ? errors : null };
}

export function validateComment(raw: string) {
  const body = raw.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
  if (!hasVisibleText(body))
    return { body, error: "댓글 내용을 입력해 주세요." };
  if (chars(body) > COMMENT_MAX)
    return {
      body,
      error: `댓글은 ${COMMENT_MAX.toLocaleString()}자 이내로 입력해 주세요.`,
    };
  return { body, error: null };
}

// ── 목록 조건 (주소의 ?category=&sort=&field=&q=&page=) ──
export type BoardQuery = {
  category: Category | null;
  sort: Sort;
  field: Field;
  q: string;
  page: number;
};

// 검색어에서 와일드카드·따옴표·괄호·쉼표를 빼서 검색 조건 문법이 깨지지 않게 한다
export function cleanSearch(raw: unknown) {
  return String(raw ?? "")
    .replace(/[%_\\"(),*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

export function parseQuery(
  params: Record<string, string | string[] | undefined>,
): BoardQuery {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const category = one("category");
  const sort = one("sort");
  const field = one("field");
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    category: isCategory(category) ? category : null,
    sort: sort && sort in SORTS ? (sort as Sort) : "latest",
    field: field && field in FIELDS ? (field as Field) : "title_body",
    q: cleanSearch(one("q")),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}

export function boardHref(query: BoardQuery, change: Partial<BoardQuery> = {}) {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.sort !== "latest") params.set("sort", next.sort);
  if (next.q) {
    params.set("q", next.q);
    if (next.field !== "title_body") params.set("field", next.field);
  }
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/board?${qs}` : "/board";
}

// ── 조회 ──
export type Author = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

export type PostSummary = {
  id: string;
  category: Category;
  title: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  author: Author | null;
};

const SUMMARY =
  "id, category, title, created_at, updated_at, view_count, like_count, comment_count";

const ORDER: Record<Sort, string> = {
  latest: "created_at",
  likes: "like_count",
  views: "view_count",
  comments: "comment_count",
};

export async function listPosts(
  supabase: Client,
  query: BoardQuery,
): Promise<{
  posts: PostSummary[];
  total: number;
  error: PostgrestError | null;
}> {
  // 작성자 검색일 때만 inner join으로 닉네임 조건을 건다
  const author =
    query.q && query.field === "author"
      ? "author:profiles!posts_author_id_fkey!inner(id, nickname, avatar_url)"
      : "author:profiles!posts_author_id_fkey(id, nickname, avatar_url)";
  let request = supabase
    .from("posts")
    .select(`${SUMMARY}, ${author}`, { count: "exact" });

  if (query.category) request = request.eq("category", query.category);
  if (query.q) {
    const pattern = `%${query.q}%`;
    if (query.field === "title") request = request.ilike("title", pattern);
    else if (query.field === "author")
      request = request.ilike("author.nickname", pattern);
    else
      request = request.or(`title.ilike."${pattern}",body.ilike."${pattern}"`);
  }
  request = request.order(ORDER[query.sort], { ascending: false });
  if (query.sort !== "latest")
    request = request.order("created_at", { ascending: false });
  request = request.order("id", { ascending: false });

  const from = (query.page - 1) * PAGE_SIZE;
  const { data, error, count } = await request.range(
    from,
    from + PAGE_SIZE - 1,
  );
  // 글 수를 넘는 페이지(주소를 직접 입력, 마지막 글 삭제 등)는 마지막 페이지를 보여 준다
  if (error?.code === "PGRST103" && query.page > 1) {
    const first = await listPosts(supabase, { ...query, page: 1 });
    const last = Math.ceil(first.total / PAGE_SIZE);
    return last > 1 ? listPosts(supabase, { ...query, page: last }) : first;
  }
  if (error) return { posts: [], total: 0, error };
  return {
    posts: (data ?? []) as unknown as PostSummary[],
    total: count ?? 0,
    error: null,
  };
}

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: Author | null;
};

export type PostDetail = PostSummary & { body: string; author_id: string };

export async function getPost(supabase: Client, id: string, me: string) {
  if (!isUuid(id))
    return { post: null, liked: false, comments: [], error: null };
  const [post, like, comments] = await Promise.all([
    supabase
      .from("posts")
      .select(
        `${SUMMARY}, body, author_id, author:profiles!posts_author_id_fkey(id, nickname, avatar_url)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", me)
      .maybeSingle(),
    supabase
      .from("post_comments")
      .select(
        "id, body, created_at, updated_at, author_id, author:profiles!post_comments_author_id_fkey(id, nickname, avatar_url)",
      )
      .eq("post_id", id)
      .order("created_at")
      .order("id"),
  ]);
  const error = post.error ?? like.error ?? comments.error;
  if (error || !post.data)
    return { post: null, liked: false, comments: [], error };
  return {
    error: null,
    post: post.data as unknown as PostDetail,
    liked: Boolean(like.data),
    comments: (comments.data ?? []) as unknown as Comment[],
  };
}

// ── 표시 ──
const KST = "Asia/Seoul";
const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: KST }).format(d);

// 목록: 오늘 글은 시각, 그 외는 날짜
export function formatBoardDate(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (day(date) === day(now))
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  return day(date).replaceAll("-", ".");
}

export function formatBoardDateTime(iso: string) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day(date).replaceAll("-", ".")} ${time}`;
}

export const isNew = (iso: string, now = Date.now()) =>
  now - Date.parse(iso) < 24 * 60 * 60 * 1000;

// 저장 직후 작은 시간차는 수정으로 보지 않는다
export const wasEdited = (p: { created_at: string; updated_at: string }) =>
  Date.parse(p.updated_at) - Date.parse(p.created_at) > 1000;
