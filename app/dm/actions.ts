"use server";

import { revalidatePath } from "next/cache";
import { isBlockedByMe } from "@/lib/dm";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { track, type Device } from "@/lib/track";

// 공개 프로필의 "메시지 보내기": 기존 대화가 있으면 그 대화를, 없으면 새로 만들어 ID를 돌려준다.
export async function startConversation(
  otherId: string,
  device: Device | null,
) {
  const { supabase, userId } = await requireUser(`/u/${otherId}`);
  if (!isUuid(otherId)) return { error: "회원을 찾을 수 없어요." };

  const { data, error } = await supabase.rpc("start_dm", { p_other: otherId });
  if (error) {
    if (error.code === "22023")
      return { error: "자기 자신에게는 메시지를 보낼 수 없어요." };
    if (error.code === "P0002") return { error: "회원을 찾을 수 없어요." };
    if (error.hint === "blocked") {
      const mine = await isBlockedByMe(supabase, userId, otherId);
      return {
        error: mine.blocked
          ? "차단한 회원이에요. 차단을 해제하면 대화를 시작할 수 있어요."
          : "지금은 이 회원에게 메시지를 보낼 수 없어요.",
      };
    }
    return { error: "대화를 시작하지 못했어요. 다시 시도해 주세요." };
  }

  const { id, created } = data as { id: string; created: boolean };
  // 기존 대화로 다시 들어가는 것은 새 대화로 세지 않는다
  if (created) await track(supabase, "dm_started", { thread_id: id }, device);
  revalidatePath("/dm");
  return { error: null, threadId: id };
}

function refresh(otherId: string) {
  revalidatePath(`/u/${otherId}`);
  revalidatePath("/dm", "layout");
}

export async function blockUser(otherId: string) {
  const { supabase, userId } = await requireUser(`/u/${otherId}`);
  if (!isUuid(otherId) || otherId === userId)
    return { error: "차단할 수 없는 회원이에요." };
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: userId, blocked_id: otherId });
  // 이미 차단한 상태(중복 요청)는 성공으로 본다
  if (error && error.code !== "23505")
    return {
      error:
        error.code === "23503"
          ? "회원을 찾을 수 없어요."
          : "차단하지 못했어요. 다시 시도해 주세요.",
    };
  refresh(otherId);
  return { error: null };
}

export async function unblockUser(otherId: string) {
  const { supabase, userId } = await requireUser(`/u/${otherId}`);
  if (!isUuid(otherId)) return { error: "회원을 찾을 수 없어요." };
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", otherId);
  if (error) return { error: "차단을 해제하지 못했어요. 다시 시도해 주세요." };
  refresh(otherId);
  return { error: null };
}
