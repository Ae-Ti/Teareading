import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function listGroups(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const [groups, mine] = await Promise.all([
    supabase
      .from("groups")
      .select(
        "id, name, description, created_at, group_members(count), owner:profiles!groups_owner_id_fkey(nickname)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
  ]);
  if (groups.error) return { groups: null, error: groups.error };

  const joined = new Set((mine.data ?? []).map((m) => m.group_id));
  return {
    error: null,
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
