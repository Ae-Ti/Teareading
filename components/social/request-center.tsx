"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { newClientId } from "@/lib/chat/id";
import {
  answerRequest,
  notifySocialChanged,
  type PendingRequest,
  type RequestKind,
  type RequestResult,
} from "@/lib/social/requests";
import { createClient } from "@/lib/supabase/client";
import { ChatDock } from "./chat-dock";

const HEARTBEAT_MS = 45_000;

const TITLES: Record<RequestKind, string> = {
  dm: "메시지 요청",
  friend: "친구 요청",
  group_create: "모임맺기 요청",
  group_join: "모임 가입 요청",
};

const payloadOf = (r: Pick<PendingRequest, "payload">) =>
  (r.payload ?? {}) as { name?: string; description?: string };

function requestText(r: PendingRequest) {
  const who = r.from_nickname;
  switch (r.kind as RequestKind) {
    case "dm":
      return `${who}님이 메시지를 보냈습니다.`;
    case "friend":
      return `${who}님이 친구 맺기를 신청하셨습니다.`;
    case "group_create":
      return `${who}님이 모임맺기를 신청하셨습니다.`;
    case "group_join":
      return `${who}님이 「${payloadOf(r).name ?? "모임"}」 모임에 들어가기를 신청하셨습니다.`;
  }
}

type RequestRow = {
  kind: RequestKind;
  to_user: string;
  status: RequestResult["status"];
  result: RequestResult["result"];
  payload: { name?: string };
};

// 어느 화면에 있든 요청을 받아 가운데에 수락/거절 창을 띄우고, 접속 중임을 기록한다.
export function RequestCenter({ userId }: { userId: string }) {
  const [queue, setQueue] = useState<PendingRequest[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<{
    threadId: string;
    nickname: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc("my_pending_requests");
    if (!error) setQueue(data ?? []);
  }, []);

  // 내가 보낸 요청에 상대가 답했을 때
  const onAnswered = useCallback(
    async (row: RequestRow) => {
      if (row.status !== "accepted" && row.status !== "rejected") return;
      const { data } = await createClient()
        .from("profiles")
        .select("nickname")
        .eq("id", row.to_user)
        .maybeSingle();
      const nickname = data?.nickname ?? "상대";
      if (row.status === "rejected") {
        showToast(`${nickname}님이 요청을 거절했어요.`);
        return;
      }
      if (row.kind === "dm" && row.result?.thread_id) {
        setChat({ threadId: row.result.thread_id, nickname });
      } else if (row.kind === "friend") {
        showToast(`${nickname}님과 친구가 되었어요.`);
        router.refresh();
      } else {
        showToast(
          row.kind === "group_create"
            ? `「${row.result?.name ?? "모임"}」 모임이 만들어졌어요.`
            : `「${row.result?.name ?? "모임"}」 모임에 들어갔어요.`,
        );
        notifySocialChanged();
      }
    },
    [router, showToast],
  );

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 로그인 정보가 실린 뒤에 구독해야 내 요청이 전달된다
    void supabase.auth.getSession().then(() => {
      if (disposed) return;
      channel = supabase
        .channel(`requests:${userId}:${newClientId()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "live_requests",
            filter: `to_user=eq.${userId}`,
          },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "live_requests",
            filter: `from_user=eq.${userId}`,
          },
          (payload) => void onAnswered(payload.new as RequestRow),
        )
        .subscribe((status) => {
          // 구독이 실제로 걸리기까지 온 요청을 놓치지 않게 다시 확인한다
          if (status === "SUBSCRIBED") {
            void refresh();
            timers.push(setTimeout(() => void refresh(), 3000));
          }
        });
    });

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, refresh, onAnswered]);

  // 접속 중 표시. 화면을 보고 있을 때만 기록한다
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState === "visible")
        void createClient()
          .rpc("touch_presence")
          .then(() => undefined);
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  const current = queue.find((r) => !dismissed.includes(r.id));

  const respond = async (r: PendingRequest, accept: boolean) => {
    setBusy(true);
    const res = await answerRequest(r.id, accept).catch(() => ({
      error: "처리하지 못했어요. 연결을 확인해 주세요.",
      response: undefined,
    }));
    setBusy(false);
    setQueue((q) => q.filter((x) => x.id !== r.id));
    if (res.error) {
      showToast(res.error);
      void refresh();
      return;
    }
    const status = res.response?.status;
    if (status === "expired") showToast("시간이 지나 요청이 끝났어요.");
    if (status !== "accepted" || !accept) return;
    const result = res.response?.result;
    if (r.kind === "dm" && result?.thread_id) {
      setChat({ threadId: result.thread_id, nickname: r.from_nickname });
    } else if (r.kind === "friend") {
      showToast(`${r.from_nickname}님과 친구가 되었어요.`);
      router.refresh();
    } else {
      showToast(
        r.kind === "group_create"
          ? `「${result?.name ?? "모임"}」 모임이 만들어졌어요.`
          : `${r.from_nickname}님이 모임에 들어왔어요.`,
      );
      notifySocialChanged();
    }
  };

  return (
    <>
      {current && (
        <Modal
          key={current.id}
          center
          open
          onClose={() => setDismissed((d) => [...d, current.id])}
          title={TITLES[current.kind as RequestKind]}
        >
          <p className="text-center font-bold break-words">
            {requestText(current)}
          </p>
          {current.kind === "group_create" && (
            <div className="mt-3 rounded-md bg-sunken p-3 text-sm break-words">
              <p className="font-bold">{payloadOf(current).name}</p>
              {payloadOf(current).description && (
                <p className="mt-1 whitespace-pre-wrap text-ink-muted">
                  {payloadOf(current).description}
                </p>
              )}
            </div>
          )}
          <div className="mt-5 flex justify-center gap-3">
            <Button loading={busy} onClick={() => respond(current, true)}>
              수락
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => respond(current, false)}
            >
              거절
            </Button>
          </div>
        </Modal>
      )}
      {chat && (
        <ChatDock
          key={chat.threadId}
          threadId={chat.threadId}
          nickname={chat.nickname}
          me={userId}
          onClose={() => setChat(null)}
        />
      )}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto w-fit max-w-full rounded-md border-2 border-ink bg-yuja px-4 py-2 text-sm font-bold shadow-hard md:bottom-6"
        >
          {toast}
        </div>
      )}
    </>
  );
}
