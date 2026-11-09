"use server";

import { requireUser } from "@/lib/supabase/user";
import { track, type Device } from "@/lib/track";
import type { Tables } from "@/types/database";

export type TimerSession = Tables<"timer_sessions">;
export type TimerResult =
  | { ok: true; session: TimerSession }
  | { ok: false; error: string; code?: "already_running" };

const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

export async function startTimer(
  activity: "tea" | "reading",
  minutes: number,
  device: Device | null,
): Promise<TimerResult> {
  const { supabase } = await requireUser("/dashboard");

  if (activity !== "tea" && activity !== "reading") {
    return { ok: false, error: "활동 유형을 골라 주세요." };
  }
  if (
    !Number.isInteger(minutes) ||
    minutes < MIN_MINUTES ||
    minutes > MAX_MINUTES
  ) {
    return {
      ok: false,
      error: `시간은 ${MIN_MINUTES}~${MAX_MINUTES}분 사이로 정해 주세요.`,
    };
  }

  const { data, error } = await supabase.rpc("start_timer", {
    p_activity: activity,
    p_target_seconds: minutes * 60,
  });

  if (error) {
    if (error.message.includes("timer_already_running")) {
      return {
        ok: false,
        code: "already_running",
        error: "이미 진행 중인 타이머가 있어요. 진행 중인 타이머를 불러왔어요.",
      };
    }
    return {
      ok: false,
      error: "타이머를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  await track(
    supabase,
    "timer_started",
    { activity, target_minutes: minutes },
    device,
  );
  return { ok: true, session: data };
}

export async function finishTimer(
  id: string,
  status: "completed" | "stopped" | "expired",
  device: Device | null,
): Promise<TimerResult> {
  const { supabase } = await requireUser("/dashboard");

  const { data, error } = await supabase.rpc("finish_timer", {
    p_id: id,
    p_status: status,
  });
  if (error) {
    return {
      ok: false,
      error: "타이머를 종료하지 못했어요. 다시 시도해 주세요.",
    };
  }
  // 자동 완료 요청인데 서버 기준으로 아직 끝나지 않은 경우 (다른 탭에서 멈춤 등)
  if (data.status === "running") return { ok: true, session: data };

  const seconds =
    Math.round(
      (new Date(data.ended_at!).getTime() -
        new Date(data.started_at).getTime()) /
        1000,
    ) - data.paused_seconds;
  await track(
    supabase,
    data.status === "completed" ? "timer_completed" : "timer_stopped",
    {
      activity: data.activity,
      target_minutes: data.target_seconds / 60,
      seconds,
    },
    device,
  );
  return { ok: true, session: data };
}

export async function pauseTimer(id: string): Promise<TimerResult> {
  const { supabase } = await requireUser("/dashboard");
  const { data, error } = await supabase.rpc("pause_timer", { p_id: id });
  if (error) {
    return {
      ok: false,
      error: "타이머를 멈추지 못했어요. 다시 시도해 주세요.",
    };
  }
  return { ok: true, session: data };
}

export async function resumeTimer(id: string): Promise<TimerResult> {
  const { supabase } = await requireUser("/dashboard");
  const { data, error } = await supabase.rpc("resume_timer", { p_id: id });
  if (error) {
    return {
      ok: false,
      error: "타이머를 이어 가지 못했어요. 다시 시도해 주세요.",
    };
  }
  return { ok: true, session: data };
}
