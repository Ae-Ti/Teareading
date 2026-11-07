import { Suspense } from "react";
import { TeahouseRoom } from "@/components/space/teahouse-room";
import { LoadingBlock } from "@/components/ui/state";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "찻집 · 티어리딩" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">찻집</h1>
        <p className="text-sm text-ink-muted">
          다른 사람들과 같은 공간에서 조용히 차를 마시고 책을 읽어요. 타이머는
          찻집 밖에서도 그대로 쓸 수 있어요.
        </p>
      </div>
      <Suspense fallback={<LoadingBlock className="h-[28rem]" />}>
        <Room />
      </Suspense>
    </div>
  );
}

async function Room() {
  const { supabase, userId } = await requireUser("/space");
  const [profile, running] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", userId)
      .single(),
    supabase
      .from("timer_sessions")
      .select("activity")
      .eq("status", "running")
      .maybeSingle(),
  ]);

  return (
    <TeahouseRoom
      me={{
        user_id: userId,
        nickname: profile.data?.nickname ?? "손님",
        avatar_url: profile.data?.avatar_url ?? null,
      }}
      timer={(running.data?.activity as "tea" | "reading" | undefined) ?? null}
    />
  );
}
