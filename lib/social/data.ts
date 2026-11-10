import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/records";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type Friend = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};
export type FriendRelation = "none" | "friend" | "sent" | "received";

export async function getFriends(supabase: Client, id: string) {
  if (!isUuid(id)) return [] as Friend[];
  const { data } = await supabase.rpc("friends_of", { p_user_id: id });
  return (data ?? []) as Friend[];
}

export async function getFriendRelation(
  supabase: Client,
  me: string,
  other: string,
): Promise<{ relation: FriendRelation; requestId: string | null }> {
  const [low, high] = me < other ? [me, other] : [other, me];
  const [friend, pending] = await Promise.all([
    supabase
      .from("friendships")
      .select("user_a")
      .eq("user_a", low)
      .eq("user_b", high)
      .maybeSingle(),
    supabase
      .from("live_requests")
      .select("id, from_user")
      .eq("kind", "friend")
      .eq("status", "pending")
      .or(
        `and(from_user.eq.${me},to_user.eq.${other}),and(from_user.eq.${other},to_user.eq.${me})`,
      )
      .limit(1)
      .maybeSingle(),
  ]);
  if (friend.data) return { relation: "friend", requestId: null };
  if (pending.data)
    return {
      relation: pending.data.from_user === me ? "sent" : "received",
      requestId: pending.data.id,
    };
  return { relation: "none", requestId: null };
}
