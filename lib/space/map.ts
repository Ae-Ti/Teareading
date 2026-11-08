// 메타버스 맵 정의 (docs/taeil/space-pixel-prd.md 4·13장). 화면 그리기와 경로 찾기가 같이 쓴다.
// 좌표는 칸 단위. x: 0(왼쪽)~cols-1, y: 0(위)~rows-1.

export const TILE = 16;

export type Dir = "down" | "up" | "left" | "right";
export type Point = { x: number; y: number };
export type MapId = "teahouse" | "town" | "library" | "room";

export type Ground =
  | "wall"
  | "wallface"
  | "wood"
  | "tatami"
  | "rug"
  | "door"
  | "grass"
  | "path"
  | "flower"
  | "water"
  | "hedge";

// 바닥 글자: # 벽(위·옆), = 벽면, . 나무 바닥, m 다다미, r 깔개, d 출입문
//            g 풀밭, p 흙길, f 꽃밭, w 연못, h 울타리 나무
const GROUND: Record<string, Ground> = {
  "#": "wall",
  "=": "wallface",
  ".": "wood",
  m: "tatami",
  r: "rug",
  d: "door",
  g: "grass",
  p: "path",
  f: "flower",
  w: "water",
  h: "hedge",
};
const WALKABLE = new Set<Ground>([
  "wood",
  "tatami",
  "rug",
  "grass",
  "path",
  "flower",
]);

export type PropKind =
  | "shelf"
  | "window"
  | "counter"
  | "table"
  | "longtable"
  | "plant"
  | "tree"
  | "lamp"
  | "bench"
  | "teahouse-front"
  | "library-front"
  | "house-front"
  | "roomshelf"
  | "frames"
  | "bed"
  | "desk"
  | "teaset";

// 가구. (x, y)는 가구가 바닥에 닿는 맨 왼쪽 칸. w칸 너비, h칸 깊이(기본 1, 위쪽으로 늘어난다).
export type Prop = {
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  h?: number;
  doorX?: number;
};

// 벽에 붙은 장식은 바닥 칸을 막지 않는다
const NOT_BLOCKING = new Set<PropKind>(["window", "frames"]);

export type Seat = { id: string; x: number; y: number; face: Dir };
// 밟으면 to 맵의 at 칸으로 간다
export type Door = { x: number; y: number; to: MapId; at: Point; face: Dir };
export type Place = { x: number; y: number; text: string };

export type GameMap = {
  id: MapId;
  title: string;
  shared: boolean; // false면 혼자 쓰는 공간 (실시간 채널을 열지 않는다)
  outdoor: boolean;
  cols: number;
  rows: number;
  base: readonly string[];
  props: Prop[];
  seats: Seat[];
  doors: Door[];
  places: Place[];
  spawn: Point;
  blocked: Set<string>;
};

function defineMap(
  def: Omit<GameMap, "cols" | "rows" | "blocked" | "places"> & {
    places?: Place[];
  },
): GameMap {
  const blocked = new Set<string>();
  for (const p of def.props) {
    if (NOT_BLOCKING.has(p.kind)) continue;
    for (let j = 0; j < (p.h ?? 1); j++)
      for (let i = 0; i < p.w; i++) blocked.add(`${p.x + i},${p.y - j}`);
  }
  return {
    places: [],
    ...def,
    cols: def.base[0].length,
    rows: def.base.length,
    blocked,
  };
}

// 칠하기 도구: 긴 야외 맵을 글자로 다 적지 않게 한다
function paint(cols: number, rows: number, fill: string) {
  const g = Array.from(
    { length: rows },
    () => Array(cols).fill(fill) as string[],
  );
  return {
    rect(x: number, y: number, w: number, h: number, c: string) {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) g[j][i] = c;
    },
    rows: () => g.map((r) => r.join("")),
  };
}

const TOWN_BACK = { x: 7, y: 8 };
const LIBRARY_BACK = { x: 20, y: 8 };
const ROOM_BACK = { x: 14, y: 16 };

const teahouse = defineMap({
  id: "teahouse",
  title: "찻집",
  shared: true,
  outdoor: false,
  base: [
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
  ],
  props: [
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
  ],
  seats: [
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
  ],
  doors: [
    { x: 9, y: 13, to: "town", at: TOWN_BACK, face: "down" },
    { x: 10, y: 13, to: "town", at: TOWN_BACK, face: "down" },
  ],
  spawn: { x: 9, y: 12 },
});

const library = defineMap({
  id: "library",
  title: "서재",
  shared: true,
  outdoor: false,
  base: [
    "################",
    "#==============#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#......rr......#",
    "#......rr......#",
    "#######dd#######",
  ],
  props: [
    { kind: "shelf", x: 1, y: 2, w: 2 },
    { kind: "shelf", x: 3, y: 2, w: 2 },
    { kind: "shelf", x: 5, y: 2, w: 2 },
    { kind: "window", x: 7, y: 1, w: 2 },
    { kind: "shelf", x: 9, y: 2, w: 2 },
    { kind: "shelf", x: 11, y: 2, w: 2 },
    { kind: "shelf", x: 13, y: 2, w: 2 },
    { kind: "longtable", x: 4, y: 6, w: 2 },
    { kind: "longtable", x: 10, y: 6, w: 2 },
    { kind: "plant", x: 1, y: 10, w: 1 },
    { kind: "plant", x: 14, y: 10, w: 1 },
  ],
  seats: [
    { id: "w-n1", x: 4, y: 5, face: "down" },
    { id: "w-n2", x: 5, y: 5, face: "down" },
    { id: "w-s1", x: 4, y: 7, face: "up" },
    { id: "w-s2", x: 5, y: 7, face: "up" },
    { id: "e-n1", x: 10, y: 5, face: "down" },
    { id: "e-n2", x: 11, y: 5, face: "down" },
    { id: "e-s1", x: 10, y: 7, face: "up" },
    { id: "e-s2", x: 11, y: 7, face: "up" },
  ],
  doors: [
    { x: 7, y: 11, to: "town", at: LIBRARY_BACK, face: "down" },
    { x: 8, y: 11, to: "town", at: LIBRARY_BACK, face: "down" },
  ],
  spawn: { x: 7, y: 10 },
});

// 내 방: 지도는 모두 같고, 그리는 내용만 각자의 기록으로 달라진다 (lib/space/room.ts)
const room = defineMap({
  id: "room",
  title: "내 방",
  shared: false,
  outdoor: false,
  base: [
    "############",
    "#==========#",
    "#..........#",
    "#..........#",
    "#..........#",
    "#..........#",
    "#..........#",
    "#..........#",
    "#....rr....#",
    "#####dd#####",
  ],
  props: [
    { kind: "roomshelf", x: 1, y: 2, w: 3 },
    { kind: "window", x: 5, y: 1, w: 2 },
    { kind: "frames", x: 8, y: 1, w: 3 },
    { kind: "bed", x: 9, y: 4, w: 2, h: 3 },
    { kind: "teaset", x: 3, y: 6, w: 1 },
    { kind: "desk", x: 8, y: 7, w: 2 },
    { kind: "plant", x: 1, y: 8, w: 1 },
  ],
  seats: [
    { id: "tea-l", x: 2, y: 6, face: "right" },
    { id: "tea-r", x: 4, y: 6, face: "left" },
    { id: "desk", x: 8, y: 8, face: "up" },
  ],
  doors: [
    { x: 5, y: 9, to: "town", at: ROOM_BACK, face: "down" },
    { x: 6, y: 9, to: "town", at: ROOM_BACK, face: "down" },
  ],
  spawn: { x: 5, y: 8 },
});

const townGround = (() => {
  const g = paint(28, 20, "g");
  g.rect(0, 0, 28, 2, "h");
  g.rect(0, 18, 28, 2, "h");
  g.rect(0, 0, 1, 20, "h");
  g.rect(27, 0, 1, 20, "h");
  g.rect(1, 10, 26, 2, "p"); // 큰길
  g.rect(7, 8, 1, 2, "p"); // 찻집 앞
  g.rect(20, 8, 1, 2, "p"); // 서재 앞
  g.rect(9, 12, 2, 5, "p");
  g.rect(9, 16, 6, 2, "p"); // 하숙집 앞
  g.rect(12, 6, 4, 3, "f"); // 꽃밭
  g.rect(19, 13, 3, 2, "f");
  g.rect(3, 13, 5, 4, "w"); // 연못
  return g.rows();
})();

const town = defineMap({
  id: "town",
  title: "찻길 마을",
  shared: true,
  outdoor: true,
  base: townGround,
  props: [
    { kind: "teahouse-front", x: 3, y: 7, w: 9, h: 3, doorX: 7 },
    { kind: "library-front", x: 16, y: 7, w: 9, h: 3, doorX: 20 },
    { kind: "house-front", x: 11, y: 15, w: 7, h: 3, doorX: 14 },
    { kind: "tree", x: 13, y: 3, w: 1 },
    { kind: "tree", x: 15, y: 4, w: 1 },
    { kind: "tree", x: 2, y: 9, w: 1 },
    { kind: "tree", x: 25, y: 9, w: 1 },
    { kind: "tree", x: 19, y: 16, w: 1 },
    { kind: "tree", x: 22, y: 17, w: 1 },
    { kind: "tree", x: 25, y: 14, w: 1 },
    { kind: "tree", x: 2, y: 17, w: 1 },
    { kind: "lamp", x: 9, y: 9, w: 1 },
    { kind: "lamp", x: 18, y: 9, w: 1 },
    { kind: "bench", x: 23, y: 12, w: 1 },
  ],
  seats: [],
  doors: [
    { x: 7, y: 7, to: "teahouse", at: { x: 9, y: 12 }, face: "up" },
    { x: 20, y: 7, to: "library", at: { x: 7, y: 10 }, face: "up" },
    { x: 14, y: 15, to: "room", at: { x: 5, y: 8 }, face: "up" },
  ],
  places: [
    { x: 7, y: 3, text: "찻집" },
    { x: 20, y: 3, text: "서재" },
    { x: 14, y: 11.6, text: "내 방 🔒" },
  ],
  spawn: TOWN_BACK,
});

export const MAPS: Record<MapId, GameMap> = { teahouse, town, library, room };

export function groundAt(map: GameMap, x: number, y: number): Ground {
  return GROUND[map.base[y]?.[x] ?? "#"];
}

export function doorAt(map: GameMap, x: number, y: number): Door | undefined {
  return map.doors.find((d) => d.x === x && d.y === y);
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
  if (doorAt(map, x, y)) return true;
  return WALKABLE.has(groundAt(map, x, y)) && !map.blocked.has(`${x},${y}`);
}

export function seatAt(map: GameMap, x: number, y: number): Seat | undefined {
  return map.seats.find((s) => s.x === x && s.y === y);
}

export function seatById(
  map: GameMap,
  id: string | null | undefined,
): Seat | undefined {
  return id ? map.seats.find((s) => s.id === id) : undefined;
}
