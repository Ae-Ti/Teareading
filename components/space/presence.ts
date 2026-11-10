import type { Look } from "@/lib/space/look";
import type { Dir, Point } from "@/lib/space/map";

// 찻집 Realtime 채널 이름과 상태 모양. 입장 화면과 대시보드가 같이 쓴다.
export const SPACE_CHANNEL = "space:teahouse";

// 공용 공간마다 채널을 따로 쓴다. 대시보드의 인원 표시는 찻집(SPACE_CHANNEL) 기준이다.
export const spaceChannel = (mapId: string) => `space:${mapId}`;

export type SpacePresence = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  entered_at: string;
  timer: "tea" | "reading" | null;
  // 픽셀 찻집 (docs/taeil/space-pixel-prd.md 6장). 예전 화면이 보낸 상태에는 없을 수 있다.
  timer_started_at?: string | null;
  look?: Look;
  pos?: Point;
  dir?: Dir;
  seat?: string | null;
  // 앉아 있는 동안 보이는 상태 메시지 (저장하지 않고 같은 공간 사람에게만 전달)
  message?: string | null;
};

// Broadcast 이동 메시지: 클릭 한 번에 경로 전체를 보낸다
export const MOVE_EVENT = "move";
// Broadcast 상태 메시지: 위치·자리·상태 메시지를 바로 알린다.
// Presence는 서버 제한(연결당 30초에 5번)이 있어 늦게 들어온 사람을 위한 저장용으로만 드물게 쓴다.
export const STATE_EVENT = "state";
export type StateMessage = Pick<
  SpacePresence,
  "user_id" | "pos" | "dir" | "seat" | "message"
>;

export type MoveMessage = { user_id: string; from: Point; path: Point[] };
