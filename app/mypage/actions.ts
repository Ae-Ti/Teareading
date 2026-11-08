"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DELETE_CONFIRM, deleteAccount } from "@/lib/account";
import { requireUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "@/lib/profile/operations";
import type { ProfileState } from "@/lib/profile/forms";

export async function updateProfile(
  _previous: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const result = await saveProfile(form, createClient);
  if (result.status === "success") {
    revalidatePath("/mypage");
    revalidatePath("/mypage/edit");
    revalidatePath(`/u/${result.profile!.id}`);
    revalidatePath("/groups", "layout");
    revalidatePath("/space");
    revalidatePath("/dashboard");
  }
  return result;
}

export type DeleteAccountState = { error: string | null };

export async function deleteMyAccount(
  _previous: DeleteAccountState,
  form: FormData,
): Promise<DeleteAccountState> {
  const { supabase, userId } = await requireUser("/mypage/delete");
  if (String(form.get("confirm") ?? "").trim() !== DELETE_CONFIRM)
    return { error: `확인 문구 '${DELETE_CONFIRM}'를 정확히 입력해 주세요.` };

  const result = await deleteAccount(supabase, userId);
  if (!result.ok) return { error: result.message };

  // 계정이 지워졌으므로 세션 쿠키만 정리한다 (서버 응답 오류는 무시)
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  revalidatePath("/", "layout");
  redirect("/goodbye");
}
