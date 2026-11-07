"use server";

import { isUuid } from "@/lib/records";
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
