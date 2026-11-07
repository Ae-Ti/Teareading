// 찻집 Realtime Presence 채널 이름과 상태 모양. 입장 화면과 대시보드가 같이 쓴다.
export const SPACE_CHANNEL = "space:teahouse";

export type SpacePresence = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  entered_at: string;
  timer: "tea" | "reading" | null;
};
