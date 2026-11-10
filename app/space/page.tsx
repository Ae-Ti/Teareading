import { Suspense } from "react";
import { TeahouseRoom } from "@/components/space/teahouse-room";
import { LoadingBlock } from "@/components/ui/state";
import { defaultLook, parseLook } from "@/lib/space/look";
import { DEFAULT_ROOM_STYLE, parseRoomStyle } from "@/lib/space/room";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "찻집 · 티어리딩" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">찻집</h1>
        <p className="text-sm text-ink-muted">
          다른 사람들과 같은 공간에서 조용히 차를 마시고 책을 읽어요. 바닥을
          눌러 걸어가고, 방석을 누르면 앉아요. 타이머는 찻집 밖에서도 그대로 쓸
          수 있어요.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock className="h-[28rem]" />}>
        <Room />
      </Suspense>
    </div>
  );
}

// 찻집의 "N분" 표시에서 지난 멈춤 시간을 뺀다
function focusStartedAt(
  timer: { started_at: string; paused_seconds: number } | null,
) {
  if (!timer) return null;
  const started = new Date(timer.started_at).getTime();
  return new Date(started + timer.paused_seconds * 1000).toISOString();
}

async function Room() {
  const { supabase, userId } = await requireUser("/space");
  const count = (table: "reading_logs" | "tea_columns") =>
    supabase.from(table).select("id", { count: "exact", head: true });
  const [profile, running, avatar, room, books, columns, tea, days] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", userId)
        .single(),
      supabase
        .from("timer_sessions")
        .select("activity, started_at, paused_at, paused_seconds")
        .eq("status", "running")
        .maybeSingle(),
      supabase
        .from("space_avatars")
        .select("look")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("space_rooms")
        .select("style")
        .eq("user_id", userId)
        .maybeSingle(),
      count("reading_logs"),
      count("tea_columns"),
      supabase
        .from("timer_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .eq("activity", "tea"),
      supabase
        .from("attendance_days")
        .select("day", { count: "exact", head: true }),
    ]);

  return (
    <TeahouseRoom
      me={{
        user_id: userId,
        nickname: profile.data?.nickname ?? "손님",
        avatar_url: profile.data?.avatar_url ?? null,
      }}
      initialLook={parseLook(avatar.data?.look) ?? defaultLook(userId)}
      timer={
        // 멈춘 타이머는 찻집에 표시하지 않는다
        running.data && !running.data.paused_at
          ? (running.data.activity as "tea" | "reading")
          : null
      }
      timerStartedAt={focusStartedAt(running.data)}
      initialRoomStyle={parseRoomStyle(room.data?.style) ?? DEFAULT_ROOM_STYLE}
      roomStats={{
        books: books.count ?? 0,
        columns: columns.count ?? 0,
        teaSessions: tea.count ?? 0,
        attendanceDays: days.count ?? 0,
      }}
    />
  );
}
