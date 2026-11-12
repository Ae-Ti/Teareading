import { Suspense } from "react";
import { RoomVisit } from "@/components/space/room-visit";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { isUuid } from "@/lib/records";
import { defaultLook, parseLook } from "@/lib/space/look";
import { DEFAULT_ROOM_STYLE, parseRoomStyle } from "@/lib/space/room";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "친구의 방 · 티어리딩" };

type FriendRoom = {
  style: unknown;
  books: number;
  columns: number;
  tea_sessions: number;
  attendance_days: number;
};

export default function Page(props: PageProps<"/space/room/[id]">) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <Suspense fallback={<LoadingBlock className="h-[28rem]" />}>
        <Room params={props.params} />
      </Suspense>
    </div>
  );
}

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(`/space/room/${id}`);

  if (id === userId) {
    return (
      <StateMessage
        title="내 방은 찻집 마을에서 들어갈 수 있어요"
        action={{ href: "/space", label: "찻집으로" }}
      />
    );
  }
  const room = isUuid(id)
    ? await supabase.rpc("friend_room", { p_owner: id })
    : null;
  if (room?.error) {
    return (
      <StateMessage
        tone="error"
        title="방을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
      />
    );
  }
  const data = room?.data as FriendRoom | null | undefined;
  if (!data) {
    return (
      <StateMessage
        title="친구의 방만 구경할 수 있어요"
        action={{ href: "/community", label: "커뮤니티로" }}
      />
    );
  }

  const [owner, avatar] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", id).maybeSingle(),
    supabase
      .from("space_avatars")
      .select("look")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return (
    <RoomVisit
      meId={userId}
      look={parseLook(avatar.data?.look) ?? defaultLook(userId)}
      ownerId={id}
      ownerName={owner.data?.nickname ?? "친구"}
      style={parseRoomStyle(data.style) ?? DEFAULT_ROOM_STYLE}
      stats={{
        books: data.books,
        columns: data.columns,
        teaSessions: data.tea_sessions,
        attendanceDays: data.attendance_days,
      }}
    />
  );
}
