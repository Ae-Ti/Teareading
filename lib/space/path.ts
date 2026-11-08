import { isWalkable, type Dir, type GameMap, type Point } from "./map";

const STEPS: [number, number][] = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
];

// 4방향 A*. 시작 칸은 빼고 도착 칸까지의 칸 목록을 돌려준다. 갈 수 없으면 null.
export function findPath(map: GameMap, from: Point, to: Point): Point[] | null {
  if (!isWalkable(map, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const key = (p: Point) => p.y * map.cols + p.x;
  const h = (p: Point) => Math.abs(p.x - to.x) + Math.abs(p.y - to.y);
  const open: Point[] = [from];
  const came = new Map<number, Point>();
  const g = new Map<number, number>([[key(from), 0]]);
  const f = new Map<number, number>([[key(from), h(from)]]);
  const closed = new Set<number>();

  while (open.length > 0) {
    // 맵이 작아 우선순위 큐 없이 선형 탐색으로 충분하다
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (f.get(key(open[i]))! < f.get(key(open[best]))!) best = i;
    }
    const cur = open.splice(best, 1)[0];
    const ck = key(cur);
    if (cur.x === to.x && cur.y === to.y) {
      const path: Point[] = [];
      let p: Point | undefined = cur;
      while (p && key(p) !== key(from)) {
        path.unshift(p);
        p = came.get(key(p));
      }
      return path;
    }
    closed.add(ck);

    for (const [dx, dy] of STEPS) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      const nk = key(n);
      if (closed.has(nk) || !isWalkable(map, n.x, n.y)) continue;
      const score = g.get(ck)! + 1;
      if (score >= (g.get(nk) ?? Infinity)) continue;
      came.set(nk, cur);
      g.set(nk, score);
      f.set(nk, score + h(n));
      if (!open.some((o) => key(o) === nk)) open.push(n);
    }
  }
  return null;
}

// 가구·벽을 눌렀을 때: 그 칸에서 가장 가까운 갈 수 있는 칸 (같은 거리면 from에 가까운 칸)
export function nearestWalkable(
  map: GameMap,
  target: Point,
  from: Point,
): Point | null {
  if (isWalkable(map, target.x, target.y)) return target;
  let best: Point | null = null;
  let bestScore = Infinity;
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (!isWalkable(map, x, y)) continue;
      const d = Math.abs(x - target.x) + Math.abs(y - target.y);
      const score = d * 100 + Math.abs(x - from.x) + Math.abs(y - from.y);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

export function dirBetween(a: Point, b: Point): Dir {
  if (b.x > a.x) return "right";
  if (b.x < a.x) return "left";
  if (b.y < a.y) return "up";
  return "down";
}

// 네트워크로 받은 경로 검증: 칸이 맵 안이고, 갈 수 있고, 한 칸씩 이어져야 한다
export function isValidPath(
  map: GameMap,
  from: Point,
  path: unknown,
): path is Point[] {
  if (!Array.isArray(path) || path.length > map.cols * map.rows) return false;
  let prev = from;
  for (const p of path) {
    if (
      !p ||
      typeof p !== "object" ||
      !Number.isInteger(p.x) ||
      !Number.isInteger(p.y) ||
      !isWalkable(map, p.x, p.y) ||
      Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) !== 1
    ) {
      return false;
    }
    prev = p;
  }
  return true;
}
