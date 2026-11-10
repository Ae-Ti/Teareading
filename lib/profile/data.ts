import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isUuid, type RecordKind } from "@/lib/records";
import { PUBLIC_PROFILE_FIELDS } from "./forms";

export function getPublicProfile(client: SupabaseClient<Database>, id: string) {
  if (!isUuid(id)) return Promise.resolve({ data: null, error: null });
  // 이메일·인증 metadata는 공개 프로필 쿼리에 포함하지 않는다.
  return client
    .from("profiles")
    .select(PUBLIC_PROFILE_FIELDS)
    .eq("id", id)
    .maybeSingle();
}

export type PublicStats = {
  streak: number;
  attendance_days: number;
  finished: number;
  pages: number;
  reading_seconds: number;
  tea_seconds: number;
  tea_sessions: number;
};

// 공개 프로필의 활동 통계. 합계만 받는다 (책 제목·기록 내용은 포함되지 않는다).
export async function getPublicStats(
  client: SupabaseClient<Database>,
  id: string,
) {
  const { data, error } = await client.rpc("public_profile_stats", {
    p_user_id: id,
  });
  return { stats: error ? null : (data as unknown as PublicStats), error };
}

// 내 프로필: 내가 쓴 글·댓글 (최근 20개씩)
export async function getMyActivity(
  client: SupabaseClient<Database>,
  id: string,
) {
  const [posts, comments] = await Promise.all([
    client
      .from("posts")
      .select("id, title, category, created_at")
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("post_comments")
      .select("id, body, created_at, post_id, post:posts(title)")
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return {
    error: posts.error ?? comments.error,
    posts: posts.data ?? [],
    comments: comments.data ?? [],
  };
}

// 공개 프로필의 완독한 책과, 공개로 지정한 차 칼럼·독서기록. 읽는 중·보류 책은 받지 않는다.
export async function getPublicRecords(
  client: SupabaseClient<Database>,
  id: string,
) {
  const [books, columns, logs] = await Promise.all([
    client.rpc("public_finished_books", { p_user_id: id }),
    client.rpc("public_tea_columns", { p_user_id: id }),
    client.rpc("public_reading_logs", { p_user_id: id }),
  ]);
  return {
    error: books.error ?? columns.error ?? logs.error,
    books: books.data ?? [],
    columns: columns.data ?? [],
    logs: logs.data ?? [],
  };
}

// 공개로 지정한 글 한 편
export async function getPublicRecord(
  client: SupabaseClient<Database>,
  kind: RecordKind,
  id: string,
): Promise<{
  error: unknown;
  record: {
    user_id: string;
    title: string;
    body: string;
    created_at: string;
    tea_type?: string | null;
    pages_read?: number | null;
  } | null;
}> {
  if (kind === "columns") {
    const { data, error } = await client.rpc("public_tea_column", { p_id: id });
    return { error, record: data?.[0] ?? null };
  }
  const { data, error } = await client.rpc("public_reading_log", { p_id: id });
  return { error, record: data?.[0] ?? null };
}

export async function getProfileGroups(
  client: SupabaseClient<Database>,
  id: string,
) {
  const result = await client
    .from("group_members")
    .select("role,group:groups(id,name,description)")
    .eq("user_id", id)
    .order("joined_at", { ascending: false });
  return {
    error: result.error,
    groups: (result.data ?? []).flatMap((item) =>
      item.group ? [{ ...item.group, role: item.role }] : [],
    ),
  };
}
