import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/records";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type DmThreadSummary = {
  id: string;
  otherId: string;
  otherNickname: string;
  otherAvatarUrl: string | null;
  lastBody: string | null;
  lastMine: boolean;
  lastAt: string;
  blockedByMe: boolean;
};

// 내가 차단한 회원 ID 목록 (차단 목록은 본인 것만 조회된다)
async function myBlocks(supabase: Client, me: string) {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", me);
  return { ids: new Set((data ?? []).map((b) => b.blocked_id)), error };
}

export async function listThreads(supabase: Client, me: string) {
  const [threads, blocks] = await Promise.all([
    supabase.rpc("my_dm_threads"),
    myBlocks(supabase, me),
  ]);
  if (threads.error || blocks.error)
    return { threads: null, error: threads.error ?? blocks.error };
  return {
    error: null,
    threads: threads.data.map((t): DmThreadSummary => ({
      id: t.id,
      otherId: t.other_id,
      otherNickname: t.other_nickname,
      otherAvatarUrl: t.other_avatar_url,
      lastBody: t.last_body,
      lastMine: t.last_sender_id === me,
      lastAt: t.last_at ?? t.created_at,
      blockedByMe: blocks.ids.has(t.other_id),
    })),
  };
}

// 대화방 정보. 참여자가 아니면 RLS가 대화를 숨기므로 "없는 대화"와 같게 처리한다.
export async function getThread(supabase: Client, id: string, me: string) {
  if (!isUuid(id)) return { thread: null, error: null };
  const thread = await supabase
    .from("dm_threads")
    .select("id, user_a, user_b")
    .eq("id", id)
    .maybeSingle();
  if (thread.error || !thread.data)
    return { thread: null, error: thread.error };

  const otherId =
    thread.data.user_a === me ? thread.data.user_b : thread.data.user_a;
  const [other, canSend, blockedByMe] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .eq("id", otherId)
      .maybeSingle(),
    supabase.rpc("dm_can_send", { p_thread_id: id }),
    isBlockedByMe(supabase, me, otherId),
  ]);
  const error = other.error ?? canSend.error ?? blockedByMe.error;
  if (error || !other.data) return { thread: null, error };
  return {
    error: null,
    thread: {
      id,
      other: other.data,
      canSend: Boolean(canSend.data),
      blockedByMe: blockedByMe.blocked,
    },
  };
}

export async function isBlockedByMe(
  supabase: Client,
  me: string,
  other: string,
) {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", me)
    .eq("blocked_id", other)
    .maybeSingle();
  return { blocked: Boolean(data), error };
}

// 목록의 시간 표시: 오늘이면 시각, 올해면 월·일, 그 전이면 연·월·일 (KST)
export function formatThreadTime(iso: string, now = new Date()) {
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
  const date = new Date(iso);
  if (day(date) === day(now))
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  const sameYear = day(date).slice(0, 4) === day(now).slice(0, 4);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(sameYear ? {} : { year: "numeric" }),
    month: "short",
    day: "numeric",
  }).format(date);
}

// 메시지 탭에 함께 보이는 모임 단체 채팅방 (내가 참여한 모임, 마지막 메시지 순)
export type GroupChatSummary = {
  groupId: string;
  name: string;
  memberCount: number;
  lastBody: string | null;
  lastDeleted: boolean;
  lastSender: string | null;
  lastMine: boolean;
  lastAt: string;
};

export async function listGroupChats(supabase: Client, me: string) {
  const { data, error } = await supabase.rpc("my_group_chats");
  if (error) return { chats: null, error };
  return {
    error: null,
    chats: data.map((g): GroupChatSummary => ({
      groupId: g.group_id,
      name: g.name,
      memberCount: g.member_count,
      lastBody: g.last_body,
      lastDeleted: g.last_deleted,
      lastSender: g.last_sender_nickname,
      lastMine: g.last_sender_id === me,
      lastAt: g.last_at ?? g.joined_at,
    })),
  };
}
