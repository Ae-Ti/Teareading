"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { track, type Device } from "@/lib/track";

export type GroupFormState = {
  errors?: { name?: string; description?: string; form?: string };
  values?: { name: string; description: string };
};

const NAME_MIN = 2;
const NAME_MAX = 40;
const DESCRIPTION_MAX = 500;

function readForm(formData: FormData) {
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
  };
  const errors: GroupFormState["errors"] = {};
  if (values.name.length < NAME_MIN || values.name.length > NAME_MAX)
    errors.name = `모임 이름은 ${NAME_MIN}~${NAME_MAX}자로 입력해 주세요.`;
  if (values.description.length > DESCRIPTION_MAX)
    errors.description = `소개는 ${DESCRIPTION_MAX}자 이내로 입력해 주세요.`;
  return { values, errors: errors.name || errors.description ? errors : null };
}

export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireUser("/groups/new");
  const { values, errors } = readForm(formData);
  if (errors) return { errors, values };

  const { data, error } = await supabase
    .from("groups")
    .insert(values)
    .select("id")
    .single();
  if (error)
    return {
      errors: { form: "모임을 만들지 못했어요. 다시 시도해 주세요." },
      values,
    };

  revalidatePath("/community");
  redirect(`/groups/${data.id}`);
}

export async function updateGroup(
  id: string,
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const { supabase } = await requireUser(`/groups/${id}/manage`);
  const { values, errors } = readForm(formData);
  if (errors) return { errors, values };
  if (!isUuid(id))
    return { errors: { form: "모임을 찾을 수 없어요." }, values };

  const { data, error } = await supabase
    .from("groups")
    .update(values)
    .eq("id", id)
    .select("id");
  if (error)
    return {
      errors: { form: "저장하지 못했어요. 다시 시도해 주세요." },
      values,
    };
  if (!data?.length)
    return {
      errors: { form: "모임장만 모임 정보를 수정할 수 있어요." },
      values,
    };

  revalidatePath(`/groups/${id}`);
  redirect(`/groups/${id}`);
}

export async function joinGroup(id: string, device: Device | null) {
  const { supabase, userId } = await requireUser(`/groups/${id}`);
  if (!isUuid(id)) return { error: "모임을 찾을 수 없어요." };

  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: id, user_id: userId });
  // 이미 가입한 상태(중복 요청)는 성공으로 본다
  if (error && error.code !== "23505")
    return {
      error:
        error.code === "42501"
          ? "모임장이 내보낸 모임이라 다시 가입할 수 없어요."
          : "가입하지 못했어요. 다시 시도해 주세요.",
    };
  if (!error) await track(supabase, "group_joined", { group_id: id }, device);

  revalidatePath(`/groups/${id}`);
  return { error: null };
}

export async function leaveGroup(id: string) {
  const { supabase, userId } = await requireUser(`/groups/${id}`);
  if (!isUuid(id)) return { error: "모임을 찾을 수 없어요." };

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", userId);
  if (error) return { error: "탈퇴하지 못했어요. 다시 시도해 주세요." };

  revalidatePath(`/groups/${id}`);
  return { error: null };
}

export async function removeMember(groupId: string, memberId: string) {
  const { supabase } = await requireUser(`/groups/${groupId}/manage`);
  if (!isUuid(groupId) || !isUuid(memberId))
    return { error: "멤버를 찾을 수 없어요." };

  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .select("user_id");
  if (error) return { error: "내보내지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "모임장만 멤버를 내보낼 수 있어요." };

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/manage`);
  return { error: null };
}
