import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { EventName } from "@/lib/track";
import type { Database } from "@/types/database";
import { PAGE_SIZE, type ChatMessage, type ChatProfile } from "./core";

// 채팅방 종류별 설정. DM은 같은 구조로 여기에 추가한다.
export const CHAT_ROOMS = {
  group: {
    table: "group_messages",
    column: "group_id",
    event: "group_message_sent",
    denied: "모임에 가입한 멤버만 메시지를 보낼 수 있어요.",
  },
} as const satisfies Record<
  string,
  { table: string; column: string; event: EventName; denied: string }
>;

export type ChatKind = keyof typeof CHAT_ROOMS;
export type ChatRoomRef = { kind: ChatKind; id: string };

const COLUMNS =
  "id, client_id, sender_id, body, created_at, sender:profiles(nickname, avatar_url)";

type Row = ChatMessage & { sender: ChatProfile | null };

// 테이블 이름이 방 종류에 따라 바뀌므로 타입 없는 쿼리로 다루고 결과 모양만 고정한다.
function table(supabase: SupabaseClient<Database>, room: ChatRoomRef) {
  return (supabase as unknown as SupabaseClient).from(
    CHAT_ROOMS[room.kind].table,
  );
}

function split(rows: Row[]) {
  const profiles: Record<string, ChatProfile> = {};
  const messages: ChatMessage[] = rows.map(({ sender, ...m }) => {
    if (sender) profiles[m.sender_id] = sender;
    return m;
  });
  return { messages, profiles };
}

// 최근 메시지 한 페이지(시간순). before를 주면 그보다 이전 메시지를 가져온다.
// before는 DB가 준 created_at 문자열을 그대로 넘긴다 (마이크로초까지 비교).
export async function fetchMessages(
  supabase: SupabaseClient<Database>,
  room: ChatRoomRef,
  before?: string,
) {
  let query = table(supabase, room)
    .select(COLUMNS)
    .eq(CHAT_ROOMS[room.kind].column, room.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error)
    return { error, messages: [], profiles: {}, hasMore: false } as const;
  const rows = (data as unknown as Row[]).reverse();
  return { error: null, ...split(rows), hasMore: rows.length === PAGE_SIZE };
}

export type SendResult =
  | {
      ok: true;
      message: ChatMessage;
      profile: ChatProfile | null;
      duplicate: boolean;
    }
  | { ok: false; reason: "denied" | "invalid" | "network"; message: string };

function failure(room: ChatRoomRef, error: PostgrestError): SendResult {
  if (error.code === "42501")
    return {
      ok: false,
      reason: "denied",
      message: CHAT_ROOMS[room.kind].denied,
    };
  if (error.code === "23514" || error.code === "22001")
    return {
      ok: false,
      reason: "invalid",
      message: "보낼 수 없는 메시지예요. 내용을 확인해 주세요.",
    };
  return {
    ok: false,
    reason: "network",
    message: "보내지 못했어요. 연결을 확인하고 다시 보내 주세요.",
  };
}

// 메시지 저장. 같은 client_id로 다시 보내면 새로 만들지 않고 이미 저장된 메시지를 돌려준다.
// sender_id는 DB 기본값(auth.uid())과 RLS가 정한다. 여기서는 중복 조회에만 쓴다.
export async function insertMessage(
  supabase: SupabaseClient<Database>,
  room: ChatRoomRef,
  senderId: string,
  clientId: string,
  body: string,
): Promise<SendResult> {
  const { data, error } = await table(supabase, room)
    .insert({
      [CHAT_ROOMS[room.kind].column]: room.id,
      client_id: clientId,
      body,
    })
    .select(COLUMNS)
    .single();

  if (!error) {
    const { sender, ...message } = data as unknown as Row;
    return { ok: true, message, profile: sender, duplicate: false };
  }
  if (error.code !== "23505") return failure(room, error);

  // 앞선 시도가 저장됐지만 응답을 못 받은 경우
  const existing = await table(supabase, room)
    .select(COLUMNS)
    .eq("sender_id", senderId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing.error || !existing.data)
    return failure(room, existing.error ?? error);
  const { sender, ...message } = existing.data as unknown as Row;
  return { ok: true, message, profile: sender, duplicate: true };
}
