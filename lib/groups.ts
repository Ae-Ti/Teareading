import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { cleanSearch } from "@/lib/board";
import { isUuid } from "@/lib/records";
import type { Database } from "@/types/database";

export type MemberProfile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};
export type GroupMember = {
  role: string;
  joined_at: string;
  profile: MemberProfile;
};

export const GROUP_PAGE_SIZE = 15;

// 커뮤니티 목록 조건 (주소의 ?q=&page=)
export type GroupQuery = { q: string; page: number };

export function parseGroupQuery(
  params: Record<string, string | string[] | undefined>,
): GroupQuery {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    q: cleanSearch(one("q")),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}

export function groupsHref(
  query: GroupQuery,
  change: Partial<GroupQuery> = {},
) {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/community?${qs}` : "/community";
}

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  ownerNickname: string;
  memberCount: number;
  joined: boolean;
};
type GroupList =
  | { error: null; total: number; page: number; groups: GroupSummary[] }
  | { error: PostgrestError; total: 0; page: 1; groups: null };

export async function listGroups(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: GroupQuery,
): Promise<GroupList> {
  const from = (query.page - 1) * GROUP_PAGE_SIZE;
  let request = supabase
    .from("groups")
    .select(
      "id, name, description, created_at, group_members(count), owner:profiles!groups_owner_id_fkey(nickname)",
      { count: "exact" },
    );
  if (query.q) {
    const pattern = `%${query.q}%`;
    request = request.or(
      `name.ilike."${pattern}",description.ilike."${pattern}"`,
    );
  }
  const [groups, mine] = await Promise.all([
    request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + GROUP_PAGE_SIZE - 1),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);
  // 모임 수를 넘는 쪽(주소를 직접 입력, 마지막 모임 삭제 등)은 마지막 쪽을 보여 준다
  if (groups.error?.code === "PGRST103" && query.page > 1) {
    const first = await listGroups(supabase, userId, { ...query, page: 1 });
    const last = Math.ceil(first.total / GROUP_PAGE_SIZE);
    return last > 1
      ? listGroups(supabase, userId, { ...query, page: last })
      : first;
  }
  if (groups.error)
    return { groups: null, total: 0, page: 1, error: groups.error };

  const joined = new Set((mine.data ?? []).map((m) => m.group_id));
  return {
    error: null,
    total: groups.count ?? 0,
    page: query.page,
    groups: groups.data.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      ownerNickname: g.owner?.nickname ?? "알 수 없음",
      memberCount: g.group_members[0]?.count ?? 0,
      joined: joined.has(g.id),
    })),
  };
}

export async function getGroup(supabase: SupabaseClient<Database>, id: string) {
  if (!isUuid(id)) return { group: null, members: [], error: null };
  const [group, members] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, owner_id, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("role, joined_at, profile:profiles(id, nickname, avatar_url)")
      .eq("group_id", id)
      .order("joined_at"),
  ]);
  return {
    group: group.data,
    members: (members.data ?? []) as GroupMember[],
    error: group.error ?? members.error,
  };
}
