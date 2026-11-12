import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";

export type RequestKind = "friend" | "dm" | "group_create" | "group_join";
export type PendingRequest =
  Database["public"]["Functions"]["my_pending_requests"]["Returns"][number];
export type RequestResult = {
  status: "pending" | "accepted" | "rejected" | "expired";
  result?: { thread_id?: string; group_id?: string; name?: string } | null;
};

// 모임·친구 관계가 바뀌면 찻집 이름표 등 화면 곳곳에 알린다
export const SOCIAL_CHANGED = "teareading:social-changed";
export const notifySocialChanged = () =>
  window.dispatchEvent(new Event(SOCIAL_CHANGED));

function sendError(
  kind: RequestKind,
  error: { code?: string; hint?: string | null },
) {
  if (error.hint === "blocked")
    return "차단한 회원이에요. 차단을 해제하면 요청을 보낼 수 있어요.";
  // 상대가 나를 차단했는지는 알리지 않는다
  if (error.hint === "unavailable") return "지금은 요청을 보낼 수 없어요.";
  if (error.hint === "cooldown")
    return "거절된 요청은 하루 뒤에 다시 보낼 수 있어요.";
  if (kind === "group_join" && error.code === "42501")
    return "이 모임에는 들어갈 수 없어요.";
  if (kind === "group_join" && error.code === "22023")
    return "이미 모임 멤버예요.";
  if (kind === "group_join" && error.code === "P0002")
    return "모임을 찾을 수 없어요.";
  if (kind === "group_create" && error.code === "22023")
    return "모임 이름은 2~40자, 소개는 500자 이내로 입력해 주세요.";
  return "요청을 보내지 못했어요. 다시 시도해 주세요.";
}

export async function sendRequest(
  kind: RequestKind,
  to: string,
  payload: Json = {},
): Promise<{ error: string | null; status?: RequestResult["status"] }> {
  const { data, error } = await createClient().rpc("create_live_request", {
    p_kind: kind,
    p_to: to,
    p_payload: payload,
  });
  if (error) return { error: sendError(kind, error) };
  return { error: null, status: (data as unknown as RequestResult).status };
}

export async function answerRequest(
  id: string,
  accept: boolean,
): Promise<{ error: string | null; response?: RequestResult }> {
  const { data, error } = await createClient().rpc("respond_live_request", {
    p_id: id,
    p_accept: accept,
  });
  if (error)
    return {
      error:
        error.hint === "blocked"
          ? "차단 관계에서는 수락할 수 없어요."
          : "처리하지 못했어요. 다시 시도해 주세요.",
    };
  return { error: null, response: data as unknown as RequestResult };
}
