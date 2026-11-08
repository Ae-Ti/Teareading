"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MiniAvatar } from "@/components/groups/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
  addPending,
  formatChatDay,
  formatChatTime,
  kstDay,
  mergeMessages,
  messageKey,
  removeLocal,
  setLocalStatus,
  startsGroup,
  type ChatItem,
  type ChatMessage,
  type ChatProfile,
} from "@/lib/chat/core";
import { newClientId } from "@/lib/chat/id";
import {
  CHAT_ROOMS,
  fetchMessages,
  fetchNewer,
  insertMessage,
  type ChatRoomRef,
  type Cursor,
} from "@/lib/chat/rooms";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { Composer } from "./composer";

// 채팅 화면이 보이는 동안만 <html data-chat>을 단다 (하단 탭·푸터 숨김, globals.css).
// Next.js가 지나간 화면을 숨겨 둘 때(Activity) 레이아웃 효과 정리가 실행되므로 떠나면 바로 풀린다.
let visibleChatRooms = 0;
function useChatChrome() {
  useLayoutEffect(() => {
    visibleChatRooms += 1;
    document.documentElement.dataset.chat = "";
    return () => {
      visibleChatRooms -= 1;
      if (visibleChatRooms === 0) delete document.documentElement.dataset.chat;
    };
  }, []);
}

type Conn = "connecting" | "live" | "lost";

const NEAR_BOTTOM = 96;

export function ChatRoom({
  room,
  me,
  initial,
  emptyTitle,
  emptyDescription,
  placeholder,
  disabledReason,
}: {
  room: ChatRoomRef;
  me: string;
  initial: {
    messages: ChatMessage[];
    profiles: Record<string, ChatProfile>;
    hasMore: boolean;
  };
  emptyTitle: string;
  emptyDescription: string;
  placeholder: string;
  disabledReason?: string | null;
}) {
  useChatChrome();
  const [items, setItems] = useState<ChatItem[]>(() =>
    mergeMessages([], initial.messages),
  );
  const [profiles, setProfiles] = useState(initial.profiles);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [older, setOlder] = useState<"idle" | "loading" | "error">("idle");
  const [conn, setConn] = useState<Conn>("connecting");
  const [unseen, setUnseen] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const addProfiles = useCallback((next: Record<string, ChatProfile>) => {
    if (Object.keys(next).length) setProfiles((p) => ({ ...p, ...next }));
  }, []);

  // 처음 보는 보낸 사람(목록을 연 뒤 가입한 멤버 등)의 닉네임·아바타
  const ensureProfile = useCallback(
    async (senderId: string) => {
      if (profilesRef.current[senderId]) return;
      const { data } = await createClient()
        .from("profiles")
        .select("id, nickname, avatar_url")
        .eq("id", senderId)
        .maybeSingle();
      if (data)
        addProfiles({
          [data.id]: { nickname: data.nickname, avatar_url: data.avatar_url },
        });
    },
    [addProfiles],
  );

  // 실시간 수신. 화면을 떠나거나 방이 바뀌면 구독을 해제한다.
  useEffect(() => {
    const supabase = createClient();
    const { table, column } = CHAT_ROOMS[room.kind];
    let disposed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 서버가 화면을 만든 뒤 구독이 실제로 걸리기까지(수 초) 또는 연결이 끊긴 동안 온 메시지를 채운다.
    // 화면에 있는 가장 최근 메시지 이후를 페이지 단위로 끝까지 받아 오므로, 오래 끊겨도 중간이 비지 않는다.
    // 같은 메시지는 mergeMessages가 한 번만 남긴다.
    const catchUp = async () => {
      const sent = itemsRef.current.filter((m) => m.status === "sent");
      const newest = sent[sent.length - 1];
      if (!newest) {
        const res = await fetchMessages(supabase, room);
        if (res.error || disposed) return;
        addProfiles(res.profiles);
        setItems((s) => mergeMessages(s, res.messages));
        return;
      }
      let after: Cursor = newest;
      for (let page = 0; page < 20; page++) {
        const res = await fetchNewer(supabase, room, after);
        if (res.error || disposed) return;
        addProfiles(res.profiles);
        setItems((s) => mergeMessages(s, res.messages));
        if (!res.hasMore) return;
        after = res.messages[res.messages.length - 1];
      }
    };

    const channel = supabase
      .channel(`chat:${room.kind}:${room.id}:${newClientId()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `${column}=eq.${room.id}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (!stickRef.current && m.sender_id !== me) setUnseen((n) => n + 1);
          setItems((s) => mergeMessages(s, [m]));
          void ensureProfile(m.sender_id);
        },
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setConn("live");
          void catchUp();
          timers.push(setTimeout(() => void catchUp(), 3000));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConn("lost");
        }
      });

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      void supabase.removeChannel(channel);
    };
    // room은 kind·id로만 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.kind, room.id, me, ensureProfile, addProfiles]);

  const loadOlder = useCallback(async () => {
    if (older === "loading" || !hasMore) return;
    const oldest = items.find((m) => m.status === "sent");
    if (!oldest) return;
    setOlder("loading");
    const res = await fetchMessages(createClient(), room, oldest);
    if (res.error) {
      setOlder("error");
      return;
    }
    // 붙일 메시지가 있을 때만 위치 복원을 예약한다 (빈 결과면 다시 그리지 않아 복원 값이 남는다)
    const el = listRef.current;
    if (el && res.messages.length)
      restoreRef.current = { height: el.scrollHeight, top: el.scrollTop };
    addProfiles(res.profiles);
    setItems((s) => mergeMessages(s, res.messages));
    setHasMore(res.hasMore);
    setOlder("idle");
  }, [older, hasMore, items, room, addProfiles]);

  // 위로 스크롤해 맨 위에 닿으면 이전 메시지를 가져온다
  useEffect(() => {
    const target = topRef.current;
    const root = listRef.current;
    if (!target || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && older === "idle")
          void loadOlder();
      },
      { root, rootMargin: "120px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, older, loadOlder]);

  // 이전 메시지를 위에 붙여도 보던 위치를 유지하고, 맨 아래를 보던 중이면 새 메시지로 따라 내려간다
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const restore = restoreRef.current;
    if (restore) {
      el.scrollTop = el.scrollHeight - restore.height + restore.top;
      restoreRef.current = null;
    } else if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    stickRef.current = near;
    if (near) setUnseen(0);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnseen(0);
  };

  const deliver = useCallback(
    async (clientId: string, body: string) => {
      const key = messageKey({ sender_id: me, client_id: clientId });
      setItems((s) => setLocalStatus(s, key, "sending"));
      const supabase = createClient();
      let res: Awaited<ReturnType<typeof insertMessage>>;
      try {
        res = await insertMessage(supabase, room, me, clientId, body);
      } catch {
        res = {
          ok: false,
          reason: "network",
          message: "보내지 못했어요. 연결을 확인하고 다시 보내 주세요.",
        };
      }
      if (!res.ok) {
        setItems((s) => setLocalStatus(s, key, "failed", res.message));
        return;
      }
      if (res.profile) addProfiles({ [me]: res.profile });
      setItems((s) => mergeMessages(s, [res.message]));
      // 실제로 새로 저장된 메시지만 센다 (재시도로 이미 있던 메시지는 제외)
      if (!res.duplicate)
        void track(supabase, CHAT_ROOMS[room.kind].event, {
          [CHAT_ROOMS[room.kind].column]: room.id,
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.kind, room.id, me, addProfiles],
  );

  const send = (body: string) => {
    const clientId = newClientId();
    stickRef.current = true;
    setItems((s) =>
      addPending(s, {
        client_id: clientId,
        sender_id: me,
        body,
        created_at: new Date().toISOString(),
      }),
    );
    void deliver(clientId, body);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-2 border-ink bg-canvas shadow-hard">
      {conn === "lost" && (
        <p
          role="status"
          className="border-b-2 border-ink bg-yuja px-3 py-1.5 text-center text-xs font-bold"
        >
          실시간 연결이 끊겼어요. 다시 연결하는 중…
        </p>
      )}

      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-label="메시지 목록"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 md:px-5"
      >
        <div ref={topRef} />
        {hasMore && (
          <div className="mb-3 flex justify-center">
            {older === "error" ? (
              <p
                role="alert"
                className="flex items-center gap-2 text-sm text-danger"
              >
                이전 메시지를 불러오지 못했어요.
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadOlder()}
                >
                  다시 시도
                </Button>
              </p>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                loading={older === "loading"}
                onClick={() => void loadOlder()}
              >
                이전 메시지 더 보기
              </Button>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="m-auto flex max-w-xs flex-col items-center gap-2 text-center">
            <p className="font-bold">{emptyTitle}</p>
            <p className="text-sm text-ink-muted">{emptyDescription}</p>
          </div>
        ) : (
          <ol className="mt-auto flex flex-col">
            {items.map((m, i) => {
              const prev = items[i - 1];
              const newDay =
                m.status === "sent" &&
                (!prev || kstDay(prev.created_at) !== kstDay(m.created_at));
              return (
                <Fragment key={messageKey(m)}>
                  {newDay && (
                    <li
                      className="my-3 flex items-center gap-3 text-xs text-ink-muted"
                      aria-hidden
                    >
                      <span className="h-px flex-1 bg-ink-subtle" />
                      {formatChatDay(m.created_at)}
                      <span className="h-px flex-1 bg-ink-subtle" />
                    </li>
                  )}
                  <MessageRow
                    item={m}
                    mine={m.sender_id === me}
                    first={newDay || startsGroup(prev, m)}
                    profile={profiles[m.sender_id]}
                    onRetry={() => void deliver(m.client_id, m.body)}
                    onDiscard={() =>
                      setItems((s) => removeLocal(s, messageKey(m)))
                    }
                  />
                </Fragment>
              );
            })}
          </ol>
        )}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-yuja px-4 py-1.5 text-sm font-bold shadow-hard-sm"
        >
          새 메시지 {unseen}개 ↓
        </button>
      )}

      <Composer
        onSend={send}
        placeholder={placeholder}
        disabledReason={disabledReason}
      />
    </div>
  );
}

function MessageRow({
  item,
  mine,
  first,
  profile,
  onRetry,
  onDiscard,
}: {
  item: ChatItem;
  mine: boolean;
  first: boolean;
  profile?: ChatProfile;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const nickname = profile?.nickname ?? "알 수 없음";
  return (
    <li
      className={cn(
        "flex gap-2",
        first ? "mt-3" : "mt-1",
        mine ? "flex-row-reverse" : "flex-row",
      )}
      data-status={item.status}
    >
      {!mine &&
        (first ? (
          <Link
            href={`/u/${item.sender_id}`}
            className="shrink-0"
            aria-label={`${nickname} 프로필`}
          >
            <MiniAvatar
              nickname={nickname}
              src={profile?.avatar_url}
              className="size-9"
            />
          </Link>
        ) : (
          <span className="w-9 shrink-0" aria-hidden />
        ))}
      <div
        className={cn(
          "flex min-w-0 max-w-[80%] flex-col gap-1 md:max-w-[65%]",
          mine ? "items-end" : "items-start",
        )}
      >
        {!mine && first && (
          <span className="text-xs font-bold">{nickname}</span>
        )}
        <div
          className={cn(
            "flex items-end gap-1.5",
            mine ? "flex-row-reverse" : "flex-row",
          )}
        >
          <p
            className={cn(
              "rounded-lg border-2 px-3 py-2 leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
              mine ? "bg-matcha" : "bg-surface",
              item.status === "failed" ? "border-danger" : "border-ink",
              item.status === "sending" && "opacity-60",
            )}
          >
            <span className="sr-only">
              {mine ? "내 메시지: " : `${nickname}: `}
            </span>
            {item.body}
          </p>
          {item.status === "sent" && (
            <time
              dateTime={item.created_at}
              className="shrink-0 text-[11px] text-ink-muted"
            >
              {formatChatTime(item.created_at)}
            </time>
          )}
          {item.status === "sending" && (
            <span className="shrink-0 text-[11px] text-ink-muted">
              보내는 중…
            </span>
          )}
        </div>
        {item.status === "failed" && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-end gap-2 text-xs text-danger"
          >
            <span>{item.error ?? "보내지 못했어요."}</span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={onRetry}
            >
              다시 보내기
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={onDiscard}
            >
              삭제
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
