import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

// 이벤트 이름은 개발계획 문서 3.4 목록과 같아야 한다. 새 이벤트는 문서에 먼저 추가한다.
export type EventName =
  | "signup_completed"
  | "login_completed"
  | "profile_updated"
  | "timer_started"
  | "timer_completed"
  | "timer_stopped"
  | "attendance_viewed"
  | "reading_log_created"
  | "tea_column_created"
  | "guide_viewed"
  | "space_entered"
  | "space_left"
  | "space_avatar_updated"
  | "group_viewed"
  | "group_joined"
  | "group_message_sent"
  | "dm_started"
  | "dm_message_sent"
  | "post_created";

export type Device = "desktop" | "mobile";

const MOBILE_MAX_WIDTH = 767;

// 브라우저에서만 화면 너비로 판단한다. 서버에서 부를 때는 device를 직접 넘긴다.
export function detectDevice(): Device | null {
  if (typeof window === "undefined") return null;
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
    ? "mobile"
    : "desktop";
}

// 분석 이벤트 기록. 실패해도 사용자 흐름을 막지 않도록 예외를 던지지 않는다.
export async function track(
  supabase: SupabaseClient<Database>,
  name: EventName,
  props: Record<string, Json> = {},
  device: Device | null = detectDevice(),
) {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  const { error } = await supabase
    .from("events")
    .insert({ user_id: userId, name, props, device });

  if (error && process.env.NODE_ENV !== "production") {
    console.warn(`[track] ${name} 기록 실패`, error.message);
  }
}
