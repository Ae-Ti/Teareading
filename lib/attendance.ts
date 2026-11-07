import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, kstDate, streak } from "@/lib/time";
import type { Database } from "@/types/database";

export type AttendanceDay = {
  day: string;
  sessions: number;
  focus_seconds: number;
};

// from~to(포함) 사이 출석일. RLS로 본인 것만 온다.
export async function fetchAttendance(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string,
) {
  const { data, error } = await supabase
    .from("attendance_days")
    .select("day, sessions, focus_seconds")
    .gte("day", from)
    .lte("day", to)
    .order("day");
  if (error) return { days: null, error };
  return { days: (data ?? []) as AttendanceDay[], error: null };
}

// 연속 출석 계산용으로 넉넉히 1년치를 본다
export async function fetchStreak(supabase: SupabaseClient<Database>) {
  const today = kstDate();
  const { days } = await fetchAttendance(supabase, addDays(today, -366), today);
  return streak(new Set((days ?? []).map((d) => d.day)), today);
}
