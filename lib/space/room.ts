// 내 방 (docs/taeil/space-pixel-prd.md 13장). 내 활동 기록의 "개수"로만 방을 꾸민다. 기록 내용은 쓰지 않는다.

export type RoomStats = {
  books: number; // 독서기록 수
  columns: number; // 차 칼럼 수
  teaSessions: number; // 완료한 다도 타이머 수
  attendanceDays: number; // 지금까지 출석한 날 수 (연속이 끊겨도 줄지 않는다)
};

type Option = { id: string; label: string; color: string; need: number };

export const WALLS: readonly Option[] = [
  { id: "hanji", label: "한지", color: "#f4e7c9", need: 0 },
  { id: "matcha", label: "말차", color: "#cfe3b4", need: 3 },
  { id: "hongcha", label: "홍차", color: "#f3c9b9", need: 7 },
  { id: "night", label: "밤하늘", color: "#8c98bb", need: 14 },
];

export const FLOORS: readonly Option[] = [
  { id: "wood", label: "밝은 나무", color: "#e2b67e", need: 0 },
  { id: "walnut", label: "호두나무", color: "#a8744a", need: 3 },
  { id: "tatami", label: "다다미", color: "#d3d792", need: 7 },
];

export type RoomStyle = { wall: string; floor: string };
export const DEFAULT_ROOM_STYLE: RoomStyle = { wall: "hanji", floor: "wood" };

export function parseRoomStyle(value: unknown): RoomStyle | null {
  if (!value || typeof value !== "object") return null;
  const { wall, floor } = value as Record<string, unknown>;
  if (!WALLS.some((o) => o.id === wall) || !FLOORS.some((o) => o.id === floor))
    return null;
  return { wall: wall as string, floor: floor as string };
}

// 고른 벽지·바닥이 지금 출석일로 열려 있는가
export function isRoomStyleUnlocked(style: RoomStyle, days: number) {
  const need = (list: readonly Option[], id: string) =>
    list.find((o) => o.id === id)?.need ?? Infinity;
  return need(WALLS, style.wall) <= days && need(FLOORS, style.floor) <= days;
}

export function wallColor(style: RoomStyle) {
  return (WALLS.find((o) => o.id === style.wall) ?? WALLS[0]).color;
}

export function floorColor(style: RoomStyle) {
  return (FLOORS.find((o) => o.id === style.floor) ?? FLOORS[0]).color;
}

// 벽에 거는 액자 수: 차 칼럼 1편, 3편, 10편에 하나씩
export function frameCount(columns: number) {
  return [1, 3, 10].filter((n) => columns >= n).length;
}

// 다기 단계: 0 없음, 1 찻잔(1회), 2 찻주전자(5회), 3 무쇠 주전자(20회)
export function teaLevel(sessions: number) {
  return [1, 5, 20].filter((n) => sessions >= n).length;
}
