// 단체 채팅·DM이 같이 쓰는 메시지 규칙. 화면·DB와 같은 기준(유니코드 코드 포인트)으로 센다.
export const MESSAGE_MAX = 1000;
export const PAGE_SIZE = 50;

export type ChatMessage = {
  id: string;
  client_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  // 단체 채팅에서 모임장·부모임장이 지운 메시지 (내용은 비워진다)
  deleted_at?: string | null;
};

export type ChatProfile = { nickname: string; avatar_url: string | null };

// 화면에 보이는 메시지. 내가 보낸 메시지는 저장 전까지 sending/failed 상태로 먼저 보인다.
export type ChatItem = ChatMessage & {
  status: "sent" | "sending" | "failed";
  error?: string;
};

export const messageKey = (m: { sender_id: string; client_id: string }) =>
  `${m.sender_id}:${m.client_id}`;

export const countChars = (value: string) => [...value].length;

// DB 검사와 같은 공백 문자만 앞뒤에서 지운다.
const EDGE_SPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;

export function normalizeBody(raw: string) {
  const body = raw.replace(EDGE_SPACE, "");
  if (!body) return { body: null, error: "메시지를 입력해 주세요." } as const;
  if (countChars(body) > MESSAGE_MAX)
    return {
      body: null,
      error: `메시지는 ${MESSAGE_MAX}자 이내로 보내 주세요.`,
    } as const;
  return { body, error: null } as const;
}

function byTime(a: ChatMessage, b: ChatMessage) {
  const diff = Date.parse(a.created_at) - Date.parse(b.created_at);
  if (diff) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// 서버에서 받은 메시지(첫 목록·이전 페이지·실시간·재연결 후 다시 받기)를 화면 목록에 합친다.
// 같은 메시지는 한 번만 남기고, 저장이 확인된 내 메시지는 대기 중 표시를 대체한다.
// 저장된 메시지는 시간순, 아직 저장되지 않은 내 메시지는 보낸 순서대로 맨 아래에 둔다.
export function mergeMessages(
  current: ChatItem[],
  incoming: ChatMessage[],
): ChatItem[] {
  if (!incoming.length) return current;
  const confirmed = new Map<string, ChatItem>();
  const local: ChatItem[] = [];
  for (const item of current) {
    if (item.status === "sent") confirmed.set(messageKey(item), item);
    else local.push(item);
  }
  for (const m of incoming) {
    confirmed.set(messageKey(m), {
      id: m.id,
      client_id: m.client_id,
      sender_id: m.sender_id,
      body: m.body,
      created_at: m.created_at,
      deleted_at: m.deleted_at ?? null,
      status: "sent",
    });
  }
  const sent = [...confirmed.values()].sort(byTime);
  return [...sent, ...local.filter((m) => !confirmed.has(messageKey(m)))];
}

// 내가 보낸 메시지를 저장 전에 먼저 보여 준다.
export function addPending(
  current: ChatItem[],
  pending: Omit<ChatItem, "status" | "id">,
): ChatItem[] {
  const key = messageKey(pending);
  if (current.some((m) => messageKey(m) === key)) return current;
  return [...current, { ...pending, id: `local:${key}`, status: "sending" }];
}

export function setLocalStatus(
  current: ChatItem[],
  key: string,
  status: "sending" | "failed",
  error?: string,
): ChatItem[] {
  return current.map((m) =>
    messageKey(m) === key && m.status !== "sent" ? { ...m, status, error } : m,
  );
}

export function removeLocal(current: ChatItem[], key: string) {
  return current.filter((m) => !(messageKey(m) === key && m.status !== "sent"));
}

// 같은 사람이 5분 안에 이어 보낸 메시지는 이름·아바타를 한 번만 보여 준다.
export function startsGroup(prev: ChatItem | undefined, cur: ChatItem) {
  if (!prev || prev.sender_id !== cur.sender_id) return true;
  return Date.parse(cur.created_at) - Date.parse(prev.created_at) > 5 * 60_000;
}

// 날짜 구분선용 KST 날짜
export function kstDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}

export function formatChatTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatChatDay(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}
