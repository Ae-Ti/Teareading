"use server";

import { isUuid } from "@/lib/records";
import { parseLook, type Look } from "@/lib/space/look";
import { requireUser } from "@/lib/supabase/user";
import { track, type Device } from "@/lib/track";

// 찻집 체류 기록. 실시간 "누가 있나"는 Presence가 맡고, 여기는 이력·분석용이다.
export async function enterSpace(device: Device | null) {
  const { supabase } = await requireUser("/space");
  const { data, error } = await supabase
    .from("space_visits")
    .insert({})
    .select("id")
    .single();
  if (error) return { visitId: null };
  await track(supabase, "space_entered", { space_id: "teahouse" }, device);
  return { visitId: data.id };
}

export async function leaveSpace(visitId: string, device: Device | null) {
  const { supabase } = await requireUser("/space");
  if (!isUuid(visitId)) return;
  const { data } = await supabase
    .from("space_visits")
    .update({ left_at: new Date().toISOString() })
    .eq("id", visitId)
    .is("left_at", null)
    .select("entered_at")
    .maybeSingle();
  if (data) {
    const seconds = Math.round(
      (Date.now() - new Date(data.entered_at).getTime()) / 1000,
    );
    await track(
      supabase,
      "space_left",
      { space_id: "teahouse", seconds },
      device,
    );
  }
}

// 캐릭터 꾸미기 저장 (허용된 값만)
export async function saveLook(
  value: unknown,
  device: Device | null,
): Promise<{ ok: true; look: Look } | { ok: false; error: string }> {
  const { supabase, userId } = await requireUser("/space");
  const look = parseLook(value);
  if (!look) return { ok: false, error: "고를 수 없는 값이 있어요." };
  const { error } = await supabase
    .from("space_avatars")
    .upsert({ user_id: userId, look });
  if (error)
    return { ok: false, error: "저장하지 못했어요. 다시 시도해 주세요." };
  await track(supabase, "space_avatar_updated", look, device);
  return { ok: true, look };
}
