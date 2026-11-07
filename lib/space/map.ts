// 찻집 맵 정의 (docs/taeil/space-pixel-prd.md 4장). 화면 그리기와 경로 찾기가 같이 쓴다.
// 좌표는 칸 단위. x: 0(왼쪽)~COLS-1, y: 0(위)~ROWS-1.

export const TILE = 16;

export type Dir = "down" | "up" | "left" | "right";
export type Point = { x: number; y: number };

// 바닥: # 벽(위·옆), = 벽면, . 나무 바닥, m 다다미, r 깔개, d 출입문
const BASE = [
  "####################",
  "#==================#",
  "#..................#",
  "#..................#",
  "#......mmmmmm......#",
  "#......mmmmmm......#",
  "#......mmmmmm......#",
  "#......mmmmmm......#",
  "#......mmmmmm......#",
  "#..................#",
  "#..................#",
  "#........rr........#",
  "#........rr........#",
  "#########dd#########",
] as const;

export const COLS = BASE[0].length;
export const ROWS = BASE.length;

export type Ground = "wall" | "wallface" | "wood" | "tatami" | "rug" | "door";
const GROUND: Record<string, Ground> = {
  "#": "wall",
  "=": "wallface",
  ".": "wood",
  m: "tatami",
  r: "rug",
  d: "door",
};

export function groundAt(x: number, y: number): Ground {
  return GROUND[BASE[y]?.[x] ?? "#"];
}

export type PropKind =
  "shelf" | "window" | "counter" | "table" | "longtable" | "plant";

// 가구. (x, y)는 가구가 바닥에 닿는 맨 왼쪽 칸. w칸 너비. solid면 그 칸들은 지나갈 수 없다.
export type Prop = { kind: PropKind; x: number; y: number; w: number };

export const PROPS: Prop[] = [
  { kind: "shelf", x: 1, y: 2, w: 2 },
  { kind: "shelf", x: 3, y: 2, w: 2 },
  { kind: "window", x: 7, y: 1, w: 2 },
  { kind: "window", x: 11, y: 1, w: 2 },
  { kind: "plant", x: 6, y: 2, w: 1 },
  { kind: "plant", x: 13, y: 2, w: 1 },
  { kind: "counter", x: 14, y: 2, w: 5 },
  { kind: "table", x: 3, y: 5, w: 1 },
  { kind: "longtable", x: 9, y: 6, w: 2 },
  { kind: "table", x: 16, y: 6, w: 1 },
  { kind: "table", x: 3, y: 9, w: 1 },
  { kind: "table", x: 16, y: 10, w: 1 },
  { kind: "plant", x: 1, y: 12, w: 1 },
  { kind: "plant", x: 18, y: 12, w: 1 },
];

// 벽에 붙은 장식(창문)은 바닥 칸을 막지 않는다
const BLOCKING: Record<PropKind, boolean> = {
  shelf: true,
  window: false,
  counter: true,
  table: true,
  longtable: true,
  plant: true,
};

export type Seat = { id: string; x: number; y: number; face: Dir };

// 방석. 앉으면 face 쪽(다탁)을 바라본다.
export const SEATS: Seat[] = [
  { id: "nook-l", x: 2, y: 5, face: "right" },
  { id: "nook-r", x: 4, y: 5, face: "left" },
  { id: "tea-n1", x: 9, y: 5, face: "down" },
  { id: "tea-n2", x: 10, y: 5, face: "down" },
  { id: "tea-s1", x: 9, y: 7, face: "up" },
  { id: "tea-s2", x: 10, y: 7, face: "up" },
  { id: "tea-w", x: 8, y: 6, face: "right" },
  { id: "tea-e", x: 11, y: 6, face: "left" },
  { id: "east-l", x: 15, y: 6, face: "right" },
  { id: "east-r", x: 17, y: 6, face: "left" },
  { id: "sw-l", x: 2, y: 9, face: "right" },
  { id: "sw-r", x: 4, y: 9, face: "left" },
  { id: "se-l", x: 15, y: 10, face: "right" },
  { id: "se-r", x: 17, y: 10, face: "left" },
];

export const SPAWN: Point = { x: 9, y: 12 };

const blocked = new Set<string>();
for (const p of PROPS) {
  if (!BLOCKING[p.kind]) continue;
  for (let i = 0; i < p.w; i++) blocked.add(`${p.x + i},${p.y}`);
}

export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  const g = groundAt(x, y);
  if (g !== "wood" && g !== "tatami" && g !== "rug") return false;
  return !blocked.has(`${x},${y}`);
}

export function seatAt(x: number, y: number): Seat | undefined {
  return SEATS.find((s) => s.x === x && s.y === y);
}

export function seatById(id: string | null | undefined): Seat | undefined {
  return id ? SEATS.find((s) => s.id === id) : undefined;
}
