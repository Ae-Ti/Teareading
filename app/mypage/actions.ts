"use server";

import { revalidatePath } from "next/cache";
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
