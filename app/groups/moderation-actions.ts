"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";

// 모임 상세 화면의 팝업(모임 관리·멤버 관리)에서 쓰는 서버 함수. 권한은 DB 함수·RLS가 최종 판단한다.

export type ActionResult = { error: string | null };

function refresh(groupId: string) {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/chat`);
  revalidatePath("/community");
  revalidatePath("/dm");
}

function message(code: string | undefined, fallback: string) {
  if (code === "42501") return "이 작업을 할 권한이 없어요.";
  if (code === "P0002") return "이미 모임을 나간 멤버예요.";
  if (code === "22023") return "이 멤버에게는 할 수 없는 작업이에요.";
  return fallback;
}

const NAME_MIN = 2;
const NAME_MAX = 40;
const DESCRIPTION_MAX = 500;

export type GroupInfoState = {
  error: string | null;
  fieldErrors?: { name?: string; description?: string };
  saved?: number;
};

export async function saveGroupInfo(
  groupId: string,
  prev: GroupInfoState,
  form: FormData,
): Promise<GroupInfoState> {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const fieldErrors: GroupInfoState["fieldErrors"] = {};
  if ([...name].length < NAME_MIN || [...name].length > NAME_MAX)
    fieldErrors.name = `모임 이름은 ${NAME_MIN}~${NAME_MAX}자로 입력해 주세요.`;
  if ([...description].length > DESCRIPTION_MAX)
    fieldErrors.description = `소개는 ${DESCRIPTION_MAX}자 이내로 입력해 주세요.`;
  if (fieldErrors.name || fieldErrors.description)
    return { error: null, fieldErrors };
  if (!isUuid(groupId)) return { error: "모임을 찾을 수 없어요." };

  const { data, error } = await supabase
    .from("groups")
    .update({ name, description })
    .eq("id", groupId)
    .select("id");
  if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "모임장만 모임 정보를 수정할 수 있어요." };
  refresh(groupId);
  return { error: null, saved: (prev.saved ?? 0) + 1 };
}

export async function setManager(
  groupId: string,
  userId: string,
  manager: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  if (!isUuid(groupId) || !isUuid(userId))
    return { error: "멤버를 찾을 수 없어요." };
  const { error } = await supabase.rpc("set_group_manager", {
    p_group_id: groupId,
    p_user_id: userId,
    p_manager: manager,
  });
  if (error)
    return {
      error: message(error.code, "역할을 바꾸지 못했어요. 다시 시도해 주세요."),
    };
  refresh(groupId);
  return { error: null };
}

export async function setMute(
  groupId: string,
  userId: string,
  muted: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  if (!isUuid(groupId) || !isUuid(userId))
    return { error: "멤버를 찾을 수 없어요." };
  const { error } = await supabase.rpc("set_group_mute", {
    p_group_id: groupId,
    p_user_id: userId,
    p_muted: muted,
  });
  if (error)
    return {
      error: message(error.code, "처리하지 못했어요. 다시 시도해 주세요."),
    };
  refresh(groupId);
  return { error: null };
}

// 강제 퇴장한 사람의 재가입 허용 (모임장만, RLS가 막는다)
export async function allowRejoin(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  if (!isUuid(groupId) || !isUuid(userId))
    return { error: "멤버를 찾을 수 없어요." };
  const { data, error } = await supabase
    .from("group_bans")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { error: "처리하지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "이미 재가입이 허용된 멤버예요." };
  refresh(groupId);
  return { error: null };
}

export async function kickMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  if (!isUuid(groupId) || !isUuid(userId))
    return { error: "멤버를 찾을 수 없어요." };
  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { error: "내보내지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "모임장만 멤버를 내보낼 수 있어요." };
  refresh(groupId);
  return { error: null };
}
