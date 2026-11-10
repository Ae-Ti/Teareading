import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isUuid } from "@/lib/records";
import { PUBLIC_PROFILE_FIELDS } from "./forms";

export function getPublicProfile(client: SupabaseClient<Database>, id: string) {
  if (!isUuid(id)) return Promise.resolve({ data: null, error: null });
  // 개인 기록·이메일·인증 metadata는 공개 프로필 쿼리에 포함하지 않는다.
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
