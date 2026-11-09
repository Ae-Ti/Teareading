import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { newClientId } from "@/lib/chat/id";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

// 내비게이션의 안 읽은 메시지 개수. 메뉴가 화면 크기별로 두 군데 그려져도 구독은 하나만 쓴다.
// 내가 볼 수 있는 방의 메시지만 RLS를 거쳐 전달된다.

let count = 0;
let channel: RealtimeChannel | null = null;
let channelClient: SupabaseClient<Database> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const activity = new Set<() => void>();

function setCount(next: number) {
  if (next === count) return;
  count = next;
  listeners.forEach((listener) => listener());
}

function stopChannel() {
  if (channel && channelClient) void channelClient.removeChannel(channel);
  channel = null;
  channelClient = null;
}

function onChange() {
  requestUnreadRefresh();
  activity.forEach((listener) => listener());
}

function startChannel(supabase: SupabaseClient<Database>) {
  if (channel) return;
  channelClient = supabase;
  const on = (table: string, event: "INSERT" | "UPDATE") =>
    channel!.on(
      "postgres_changes",
      { event, schema: "public", table },
      onChange,
    );
  channel = supabase.channel(`chat-unread:${newClientId()}`);
  on("group_messages", "INSERT");
  on("group_messages", "UPDATE");
  on("dm_messages", "INSERT");
  channel.subscribe((status) => {
    // 구독이 실제로 걸리기까지 온 메시지를 놓치지 않게 한 번 더 센다
    if (status === "SUBSCRIBED") {
      requestUnreadRefresh(0);
      requestUnreadRefresh(3000);
    }
  });
}

async function load() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    stopChannel();
    setCount(0);
    return;
  }
  if (listeners.size) startChannel(supabase);
  const result = await supabase.rpc("my_unread_total");
  if (!result.error) setCount(result.data);
}

export function requestUnreadRefresh(delay = 300) {
  clearTimeout(timer);
  timer = setTimeout(() => void load(), delay);
}

export function subscribeUnread(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) requestUnreadRefresh(0);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      stopChannel();
    }
  };
}

export const getUnread = () => count;
export const getServerUnread = () => 0;

// 메시지가 오갈 때 알림을 받는다 (메시지 목록 새로고침용)
export function onChatActivity(listener: () => void) {
  activity.add(listener);
  return () => {
    activity.delete(listener);
  };
}
