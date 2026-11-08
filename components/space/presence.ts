import type { Look } from "@/lib/space/look";
import type { Dir, Point } from "@/lib/space/map";

// 찻집 Realtime 채널 이름과 상태 모양. 입장 화면과 대시보드가 같이 쓴다.
export const SPACE_CHANNEL = "space:teahouse";

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
};

// Broadcast 이동 메시지: 클릭 한 번에 경로 전체를 보낸다
export const MOVE_EVENT = "move";
export type MoveMessage = { user_id: string; from: Point; path: Point[] };
