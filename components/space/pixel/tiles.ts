// 찻집 바닥·벽·가구 픽셀 그림. 모두 이 코드로 그린 원본이다 (외부 이미지 없음).

import {
  groundAt,
  TILE,
  type GameMap,
  type Ground,
  type Prop,
} from "@/lib/space/map";
import {
  floorColor,
  frameCount,
  teaLevel,
  wallColor,
  type RoomStats,
  type RoomStyle,
} from "@/lib/space/room";
import { OUTLINE, shade, tint } from "./color";

// 내 방에서만 쓰는 꾸밈 값
export type Decor = { style: RoomStyle; stats: RoomStats };
type At = (x: number, y: number) => Ground;

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// 칸마다 일정한 의사 난수 (같은 칸은 항상 같은 무늬)
function rand(x: number, y: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const WOOD_LIGHT = "#e2b67e";
const TATAMI = "#d3d792";
const RUG = "#e88a73";
const PLASTER_LIGHT = "#f4e7c9";
const DARK_WOOD = "#6e4a33";
const MID_WOOD = "#a8703f";

function wood(
  ctx: Ctx,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  WOOD: string,
) {
  px(ctx, WOOD, ox, oy, TILE, TILE);
  for (let plank = 0; plank < 4; plank++) {
    const y = oy + plank * 4;
    px(ctx, tint(WOOD, 0.22), ox, y, TILE, 1);
    px(ctx, shade(WOOD, 0.22), ox, y + 3, TILE, 1);
    const seam = Math.floor(rand(tx, ty * 4 + plank) * 14) + 1;
    px(ctx, shade(WOOD, 0.3), ox + seam, y, 1, 3);
    if (rand(tx, ty, plank + 9) > 0.86)
      px(ctx, shade(WOOD, 0.15), ox + ((seam + 6) % 15), y + 1, 2, 1);
  }
}

function tatami(
  ctx: Ctx,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  at: At,
) {
  px(ctx, TATAMI, ox, oy, TILE, TILE);
  for (let y = 1; y < TILE; y += 2)
    px(ctx, shade(TATAMI, 0.08), ox, oy + y, TILE, 1);
  // 다다미 한 장 = 가로 2칸. 장 사이 이음매
  if (tx % 2 === 1) px(ctx, shade(TATAMI, 0.2), ox, oy, 1, TILE);
  // 가장자리 천(헤리)
  const edge = "#5b7a46";
  const edgeHi = "#7fa05f";
  if (at(tx, ty - 1) !== "tatami") {
    px(ctx, edge, ox, oy, TILE, 2);
    px(ctx, edgeHi, ox, oy, TILE, 1);
  }
  if (at(tx, ty + 1) !== "tatami") px(ctx, edge, ox, oy + 14, TILE, 2);
  if (at(tx - 1, ty) !== "tatami") px(ctx, edge, ox, oy, 2, TILE);
  if (at(tx + 1, ty) !== "tatami") px(ctx, edge, ox + 14, oy, 2, TILE);
}

function rug(ctx: Ctx, ox: number, oy: number, tx: number, ty: number, at: At) {
  px(ctx, RUG, ox, oy, TILE, TILE);
  const cream = "#f6e2c4";
  const deep = "#c96a57";
  const top = at(tx, ty - 1) !== "rug";
  const left = at(tx - 1, ty) !== "rug";
  const right = at(tx + 1, ty) !== "rug";
  if (top) px(ctx, cream, ox, oy + 1, TILE, 1);
  if (left) px(ctx, cream, ox + 1, oy, 1, TILE);
  if (right) px(ctx, cream, ox + 14, oy, 1, TILE);
  // 마름모 무늬
  for (let i = 0; i < 4; i++) {
    px(ctx, deep, ox + 7 - i, oy + 4 + i);
    px(ctx, deep, ox + 8 + i, oy + 4 + i);
    px(ctx, deep, ox + 7 - i, oy + 11 - i);
    px(ctx, deep, ox + 8 + i, oy + 11 - i);
  }
  px(ctx, "#f2cd4f", ox + 7, oy + 7, 2, 2);
}

function wall(ctx: Ctx, ox: number, oy: number, ty: number) {
  px(ctx, DARK_WOOD, ox, oy, TILE, TILE);
  px(ctx, tint(DARK_WOOD, 0.18), ox, oy, TILE, 2);
  px(ctx, shade(DARK_WOOD, 0.3), ox, oy + 14, TILE, 2);
  if (ty === 0) {
    // 대들보
    px(ctx, shade(DARK_WOOD, 0.2), ox, oy + 7, TILE, 1);
    px(ctx, tint(DARK_WOOD, 0.1), ox, oy + 8, TILE, 1);
  }
}

function wallFace(
  ctx: Ctx,
  ox: number,
  oy: number,
  tx: number,
  PLASTER: string,
) {
  px(ctx, PLASTER, ox, oy, TILE, 11);
  for (let i = 0; i < 3; i++) {
    const r = rand(tx, i, 3);
    px(ctx, shade(PLASTER, 0.06), ox + Math.floor(r * 15), oy + 2 + i * 3);
  }
  px(ctx, shade(PLASTER, 0.12), ox, oy, TILE, 1);
  // 징두리 나무판
  px(ctx, shade(MID_WOOD, 0.25), ox, oy + 11, TILE, 1);
  px(ctx, MID_WOOD, ox, oy + 12, TILE, 3);
  px(ctx, tint(MID_WOOD, 0.2), ox, oy + 12, TILE, 1);
  if (tx % 2 === 0) px(ctx, shade(MID_WOOD, 0.2), ox, oy + 12, 1, 3);
  px(ctx, DARK_WOOD, ox, oy + 15, TILE, 1);
}

function door(ctx: Ctx, ox: number, oy: number) {
  px(ctx, "#3b2b25", ox, oy, TILE, TILE);
  px(ctx, MID_WOOD, ox, oy, TILE, 2);
  // 현관 매트
  px(ctx, "#7a8f5a", ox + 1, oy + 4, 14, 9);
  px(ctx, "#5f7346", ox + 1, oy + 12, 14, 1);
  for (let x = 0; x < 14; x += 3) px(ctx, "#93a86e", ox + 1 + x, oy + 5, 1, 7);
}

const CUSHION = ["#8cc56b", "#ee9b86", "#f2cd4f", "#d98c55"];

function cushion(ctx: Ctx, ox: number, oy: number, i: number) {
  const c = CUSHION[i % CUSHION.length];
  px(ctx, "rgba(44,36,48,0.18)", ox + 3, oy + 4, 12, 11);
  px(ctx, OUTLINE, ox + 2, oy + 2, 12, 12);
  px(ctx, c, ox + 3, oy + 3, 10, 10);
  px(ctx, tint(c, 0.3), ox + 3, oy + 3, 10, 1);
  px(ctx, shade(c, 0.2), ox + 3, oy + 12, 10, 1);
  px(ctx, shade(c, 0.2), ox + 12, oy + 3, 1, 10);
  px(ctx, shade(c, 0.35), ox + 7, oy + 7, 2, 2);
}

const GRASS = "#a9d67c";

function grass(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, GRASS, ox, oy, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rand(tx, ty, i * 3 + 20) * 14);
    const y = Math.floor(rand(tx, ty, i * 3 + 21) * 14);
    px(
      ctx,
      i % 2 ? tint(GRASS, 0.3) : shade(GRASS, 0.16),
      ox + x,
      oy + y,
      2,
      1,
    );
    px(ctx, shade(GRASS, 0.16), ox + x + 1, oy + y - 1);
  }
}

function pathTile(
  ctx: Ctx,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  at: At,
) {
  const c = "#e7cf9d";
  px(ctx, c, ox, oy, TILE, TILE);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand(tx, ty, i + 40) * 15);
    const y = Math.floor(rand(tx, ty, i + 50) * 15);
    px(ctx, i % 2 ? shade(c, 0.12) : tint(c, 0.3), ox + x, oy + y);
  }
  const edge = shade(c, 0.28);
  if (at(tx, ty - 1) !== "path") px(ctx, edge, ox, oy, TILE, 1);
  if (at(tx, ty + 1) !== "path") px(ctx, edge, ox, oy + 15, TILE, 1);
  if (at(tx - 1, ty) !== "path") px(ctx, edge, ox, oy, 1, TILE);
  if (at(tx + 1, ty) !== "path") px(ctx, edge, ox + 15, oy, 1, TILE);
}

function flower(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  grass(ctx, ox, oy, tx, ty);
  const petals = ["#f6a5c0", "#fff0a0", "#f4efe4", "#ee9b86"];
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(rand(tx, ty, i + 60) * 11);
    const y = 2 + Math.floor(rand(tx, ty, i + 70) * 11);
    const c = petals[Math.floor(rand(tx, ty, i + 80) * petals.length)];
    px(ctx, "#5fa35a", ox + x, oy + y + 2, 1, 2);
    px(ctx, c, ox + x - 1, oy + y, 3, 1);
    px(ctx, c, ox + x, oy + y - 1, 1, 3);
    px(ctx, "#e3a93b", ox + x, oy + y);
  }
}

function water(
  ctx: Ctx,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  at: At,
) {
  const c = "#7cc4e4";
  px(ctx, c, ox, oy, TILE, TILE);
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(rand(tx, ty, i + 90) * 11);
    const y = 2 + Math.floor(rand(tx, ty, i + 95) * 11);
    px(ctx, tint(c, 0.5), ox + x, oy + y, 4, 1);
    px(ctx, shade(c, 0.14), ox + x + 2, oy + y + 2, 3, 1);
  }
  const bank = "#c7ab74";
  if (at(tx, ty - 1) !== "water") {
    px(ctx, bank, ox, oy, TILE, 3);
    px(ctx, OUTLINE, ox, oy + 3, TILE, 1);
  }
  if (at(tx, ty + 1) !== "water") {
    px(ctx, OUTLINE, ox, oy + 12, TILE, 1);
    px(ctx, bank, ox, oy + 13, TILE, 3);
  }
  if (at(tx - 1, ty) !== "water") {
    px(ctx, bank, ox, oy, 3, TILE);
    px(ctx, OUTLINE, ox + 3, oy, 1, TILE);
  }
  if (at(tx + 1, ty) !== "water") {
    px(ctx, OUTLINE, ox + 12, oy, 1, TILE);
    px(ctx, bank, ox + 13, oy, 3, TILE);
  }
}

function hedge(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  const c = "#4f9150";
  px(ctx, shade(c, 0.35), ox, oy, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const cx = 2 + (i % 2) * 8 + Math.floor(rand(tx, ty, i + 100) * 3);
    const cy = 3 + (i >> 1) * 7;
    circle(ctx, ox + cx + 2, oy + cy + 1, 4, c);
    px(ctx, tint(c, 0.32), ox + cx, oy + cy - 2, 3, 1);
  }
}

// 바닥·벽·방석을 한 장으로 미리 그린다 (매 프레임 다시 그리지 않음)
export function drawGround(map: GameMap, decor?: Decor): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = map.cols * TILE;
  canvas.height = map.rows * TILE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const at: At = (x, y) => groundAt(map, x, y);
  const plaster = decor ? wallColor(decor.style) : PLASTER_LIGHT;
  const floor = decor ? floorColor(decor.style) : WOOD_LIGHT;
  const tatamiFloor = decor?.style.floor === "tatami";
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const ox = tx * TILE;
      const oy = ty * TILE;
      const g = at(tx, ty);
      if (g === "wood") {
        // 방 전체가 다다미면 칸마다 테두리가 생기지 않게 나무 바닥도 다다미로 본다
        if (tatamiFloor)
          tatami(ctx, ox, oy, tx, ty, (x, y) =>
            at(x, y) === "wood" ? "tatami" : at(x, y),
          );
        else wood(ctx, ox, oy, tx, ty, floor);
      } else if (g === "tatami") tatami(ctx, ox, oy, tx, ty, at);
      else if (g === "rug") rug(ctx, ox, oy, tx, ty, at);
      else if (g === "wall") wall(ctx, ox, oy, ty);
      else if (g === "wallface") wallFace(ctx, ox, oy, tx, plaster);
      else if (g === "door") door(ctx, ox, oy);
      else if (g === "grass") grass(ctx, ox, oy, tx, ty);
      else if (g === "path") pathTile(ctx, ox, oy, tx, ty, at);
      else if (g === "flower") flower(ctx, ox, oy, tx, ty);
      else if (g === "water") water(ctx, ox, oy, tx, ty, at);
      else hedge(ctx, ox, oy, tx, ty);
    }
  }
  if (!map.outdoor) {
    // 벽 아래 그늘
    ctx.fillStyle = "rgba(60,36,20,0.18)";
    ctx.fillRect(TILE, 2 * TILE, (map.cols - 2) * TILE, 3);
    ctx.fillRect(TILE, 2 * TILE, 2, (map.rows - 3) * TILE);
    ctx.fillRect((map.cols - 1) * TILE - 2, 2 * TILE, 2, (map.rows - 3) * TILE);
  }

  map.seats.forEach((s, i) => cushion(ctx, s.x * TILE, s.y * TILE, i));
  // 벽에 붙은 장식도 바닥 그림에 넣는다
  for (const p of map.props) {
    if (p.kind === "window") windowProp(ctx, p);
    if (p.kind === "frames") frames(ctx, p, decor?.stats.columns ?? 0);
  }
  return canvas;
}

function windowProp(ctx: Ctx, p: Prop) {
  const x = p.x * TILE + 2;
  const y = p.y * TILE - 6;
  const w = p.w * TILE - 4;
  const h = 16;
  px(ctx, OUTLINE, x - 1, y - 1, w + 2, h + 2);
  px(ctx, DARK_WOOD, x, y, w, h);
  // 바깥 풍경: 하늘과 나무
  px(ctx, "#a9dcf0", x + 2, y + 2, w - 4, h - 4);
  px(ctx, "#cdeefa", x + 2, y + 2, w - 4, 3);
  px(ctx, "#8cc56b", x + 2, y + h - 6, w - 4, 4);
  px(ctx, "#6aa45a", x + 2, y + h - 4, w - 4, 2);
  for (let i = 0; i < w - 4; i += 5)
    px(ctx, "#a8d98a", x + 3 + i, y + h - 7, 3, 1);
  // 창살
  px(ctx, "#f4ead6", x + Math.floor(w / 2) - 1, y + 2, 2, h - 4);
  px(ctx, "#f4ead6", x + 2, y + Math.floor(h / 2) - 1, w - 4, 1);
  // 햇빛 반사
  px(ctx, "#ffffff", x + 4, y + 4, 1, 1);
  px(ctx, "#ffffff", x + 5, y + 3, 1, 1);
  px(ctx, tint(DARK_WOOD, 0.25), x, y, w, 1);
  // 창틀 받침
  px(ctx, MID_WOOD, x - 2, y + h, w + 4, 2);
  px(ctx, OUTLINE, x - 2, y + h + 2, w + 4, 1);
}

// ─── 키 큰 가구 (캐릭터와 앞뒤를 맞춰 매 프레임 그린다) ───

const BOOKS = [
  "#c9544a",
  "#4f7fb8",
  "#e3b04b",
  "#6aa45a",
  "#8a5fa0",
  "#f0e6d0",
  "#d98c55",
];

function shelf(ctx: Ctx, p: Prop, limit = Infinity) {
  let shown = 0;
  const x = p.x * TILE;
  const top = (p.y - 1) * TILE - 4;
  const w = p.w * TILE;
  const h = 2 * TILE + 4;
  px(ctx, OUTLINE, x, top, w, h);
  px(ctx, MID_WOOD, x + 1, top + 1, w - 2, h - 2);
  px(ctx, tint(MID_WOOD, 0.2), x + 1, top + 1, w - 2, 1);
  px(ctx, shade(DARK_WOOD, 0.2), x + 3, top + 3, w - 6, h - 7);
  for (let row = 0; row < 3; row++) {
    const by = top + 3 + row * 10;
    let bx = x + 3;
    let i = 0;
    while (bx < x + w - 4) {
      const bw = 2 + Math.floor(rand(p.x * 10 + i, row, 5) * 2);
      const bh = 6 + Math.floor(rand(p.x * 10 + i, row, 6) * 3);
      if (bx + bw > x + w - 3 || shown >= limit) break;
      const c = BOOKS[Math.floor(rand(p.x + i, row, 7) * BOOKS.length)];
      if (limit === Infinity && rand(p.x + i, row, 8) > 0.88) {
        bx += 2; // 빈 칸
      } else {
        shown++;
        px(ctx, c, bx, by + 9 - bh, bw, bh);
        px(ctx, tint(c, 0.3), bx, by + 9 - bh, bw, 1);
        px(ctx, shade(c, 0.25), bx + bw - 1, by + 9 - bh, 1, bh);
        bx += bw;
      }
      i++;
    }
    // 선반 판
    px(ctx, tint(MID_WOOD, 0.1), x + 2, by + 9, w - 4, 1);
  }
  px(ctx, shade(MID_WOOD, 0.3), x + 1, top + h - 2, w - 2, 1);
}

function plant(ctx: Ctx, p: Prop) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  // 화분
  px(ctx, "rgba(44,36,48,0.2)", x + 3, y + 13, 11, 3);
  px(ctx, OUTLINE, x + 3, y + 7, 10, 8);
  px(ctx, "#c8714a", x + 4, y + 8, 8, 6);
  px(ctx, "#e08c5f", x + 3, y + 6, 10, 2);
  px(ctx, OUTLINE, x + 2, y + 6, 1, 2);
  px(ctx, OUTLINE, x + 13, y + 6, 1, 2);
  px(ctx, shade("#c8714a", 0.25), x + 10, y + 8, 2, 6);
  // 잎
  const leaves: [number, number, number][] = [
    [7, -6, 4],
    [4, -2, 4],
    [11, -2, 4],
    [7, 1, 4],
  ];
  for (const [cx, cy, r] of leaves) circle(ctx, x + cx, y + cy, r + 1, OUTLINE);
  for (const [cx, cy, r] of leaves) circle(ctx, x + cx, y + cy, r, "#5fa35a");
  for (const [cx, cy] of leaves) {
    px(ctx, "#8fd07a", x + cx - 2, y + cy - 2, 2, 1);
    px(ctx, "#4a8a4a", x + cx + 1, y + cy + 2, 2, 1);
  }
}

function circle(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

function counter(ctx: Ctx, p: Prop) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  const w = p.w * TILE;
  // 상판(벽 쪽으로 올라감) + 앞판
  px(ctx, OUTLINE, x, y - 7, w, 23);
  px(ctx, "#d9a46b", x + 1, y - 6, w - 2, 6);
  px(ctx, tint("#d9a46b", 0.25), x + 1, y - 6, w - 2, 1);
  px(ctx, MID_WOOD, x + 1, y + 1, w - 2, 14);
  px(ctx, shade(MID_WOOD, 0.3), x + 1, y, w - 2, 1);
  for (let i = 1; i < p.w; i++)
    px(ctx, shade(MID_WOOD, 0.3), x + i * TILE, y + 3, 1, 10);
  for (let i = 0; i < p.w; i++) {
    px(ctx, tint(MID_WOOD, 0.15), x + i * TILE + 3, y + 3, 10, 1);
    px(ctx, "#f2cd4f", x + i * TILE + 7, y + 7, 2, 1); // 손잡이
  }
  // 무쇠 주전자
  const kx = x + 5;
  const ky = y - 14;
  px(ctx, OUTLINE, kx, ky + 2, 12, 9);
  px(ctx, "#4a4650", kx + 1, ky + 3, 10, 7);
  px(ctx, "#6b6672", kx + 2, ky + 3, 4, 1);
  px(ctx, OUTLINE, kx + 4, ky, 4, 2);
  px(ctx, OUTLINE, kx + 11, ky + 4, 3, 1);
  px(ctx, "rgba(255,255,255,0.7)", kx + 13, ky - 3, 1, 2); // 김
  px(ctx, "rgba(255,255,255,0.5)", kx + 14, ky - 6, 1, 2);
  // 차통 셋
  const jars = ["#8cc56b", "#f2cd4f", "#ee9b86"];
  jars.forEach((c, i) => {
    const jx = x + 26 + i * 9;
    px(ctx, OUTLINE, jx, y - 15, 7, 10);
    px(ctx, c, jx + 1, y - 14, 5, 8);
    px(ctx, shade(c, 0.3), jx + 1, y - 14, 5, 2);
    px(ctx, "#f4ead6", jx + 2, y - 11, 3, 3);
  });
  // 찻잔
  for (let i = 0; i < 2; i++) {
    const cx = x + 56 + i * 8;
    px(ctx, OUTLINE, cx, y - 10, 6, 5);
    px(ctx, "#fbf6ea", cx + 1, y - 9, 4, 3);
    px(ctx, "#8cc56b", cx + 1, y - 9, 4, 1);
  }
}

function table(ctx: Ctx, p: Prop, withCups = true) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  const w = p.w * TILE;
  px(ctx, "rgba(44,36,48,0.22)", x + 2, y + 12, w - 2, 4);
  px(ctx, OUTLINE, x + 1, y + 1, w - 2, 12);
  px(ctx, "#8a5a35", x + 2, y + 2, w - 4, 7);
  px(ctx, tint("#8a5a35", 0.25), x + 2, y + 2, w - 4, 1);
  px(ctx, shade("#8a5a35", 0.35), x + 2, y + 9, w - 4, 3);
  px(ctx, OUTLINE, x + 3, y + 12, 2, 3);
  px(ctx, OUTLINE, x + w - 5, y + 12, 2, 3);
  if (!withCups) return;
  // 찻잔 (긴 다탁은 찻주전자도)
  const cups = p.kind === "longtable" ? [4, w - 9] : [5];
  for (const cx of cups) {
    px(ctx, OUTLINE, x + cx, y + 2, 6, 5);
    px(ctx, "#fbf6ea", x + cx + 1, y + 3, 4, 3);
    px(ctx, "#8cc56b", x + cx + 1, y + 3, 4, 1);
  }
  if (p.kind === "longtable") {
    const tx = x + 12;
    px(ctx, OUTLINE, tx, y - 3, 9, 8);
    px(ctx, "#c8714a", tx + 1, y - 2, 7, 6);
    px(ctx, tint("#c8714a", 0.3), tx + 2, y - 2, 3, 1);
    px(ctx, OUTLINE, tx + 3, y - 5, 3, 2);
    px(ctx, OUTLINE, tx + 9, y - 1, 2, 1);
  }
}

function tree(ctx: Ctx, p: Prop) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  px(ctx, "rgba(44,36,48,0.22)", x + 1, y + 12, 14, 4);
  px(ctx, OUTLINE, x + 5, y + 4, 6, 11);
  px(ctx, "#8a5a35", x + 6, y + 4, 4, 11);
  px(ctx, shade("#8a5a35", 0.3), x + 9, y + 4, 1, 11);
  const leaves: [number, number, number][] = [
    [8, -12, 6],
    [3, -6, 5],
    [13, -6, 5],
    [8, -3, 6],
  ];
  for (const [cx, cy, r] of leaves) circle(ctx, x + cx, y + cy, r + 1, OUTLINE);
  for (const [cx, cy, r] of leaves) circle(ctx, x + cx, y + cy, r, "#5fa35a");
  for (const [cx, cy] of leaves) {
    px(ctx, "#8fd07a", x + cx - 3, y + cy - 3, 3, 1);
    px(ctx, "#8fd07a", x + cx - 4, y + cy - 2, 1, 2);
    px(ctx, "#4a8a4a", x + cx + 1, y + cy + 3, 3, 1);
  }
}

function lamp(ctx: Ctx, p: Prop) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  px(ctx, "rgba(44,36,48,0.22)", x + 4, y + 13, 8, 3);
  px(ctx, OUTLINE, x + 7, y - 6, 2, 21);
  px(ctx, OUTLINE, x + 3, y - 17, 10, 12);
  px(ctx, "#fff0a0", x + 4, y - 16, 8, 10);
  px(ctx, "#f2cd4f", x + 4, y - 10, 8, 4);
  px(ctx, DARK_WOOD, x + 2, y - 19, 12, 2);
  px(ctx, DARK_WOOD, x + 5, y + 13, 6, 2);
}

function bench(ctx: Ctx, p: Prop) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  px(ctx, OUTLINE, x + 1, y + 3, 14, 8);
  px(ctx, MID_WOOD, x + 2, y + 4, 12, 3);
  px(ctx, tint(MID_WOOD, 0.3), x + 2, y + 4, 12, 1);
  px(ctx, shade(MID_WOOD, 0.3), x + 2, y + 7, 12, 3);
  px(ctx, OUTLINE, x + 3, y + 11, 2, 4);
  px(ctx, OUTLINE, x + 11, y + 11, 2, 4);
}

type FrontStyle = {
  roof: string;
  wallColor: string;
  beam: string;
  curtain: string;
};
const FRONTS: Record<string, FrontStyle> = {
  "teahouse-front": {
    roof: "#4b4f5e",
    wallColor: "#f7efdc",
    beam: DARK_WOOD,
    curtain: "#ee9b86",
  },
  "library-front": {
    roof: "#4f7399",
    wallColor: "#e4d6bd",
    beam: "#7a5b45",
    curtain: "#6aa45a",
  },
  "house-front": {
    roof: "#c8714a",
    wallColor: "#fbf3df",
    beam: "#a8703f",
    curtain: "#f2cd4f",
  },
};

// 건물 앞모습: 지붕 + 벽 + 창문 + 문. 문 칸(doorX)은 맵의 Door와 같은 위치다.
function front(ctx: Ctx, p: Prop) {
  const s = FRONTS[p.kind];
  const x = p.x * TILE;
  const w = p.w * TILE;
  const bottom = (p.y + 1) * TILE;
  const wallTop = bottom - 2 * TILE;
  const roofTop = wallTop - 2 * TILE;
  // 지붕: 처마는 넓게, 위로 갈수록 좁게
  const roofH = wallTop - roofTop + 3;
  px(ctx, "rgba(44,36,48,0.2)", x, bottom - 1, w, 4);
  for (let j = 0; j < roofH; j++) {
    const inset = Math.floor((1 - j / roofH) * 9);
    const y = roofTop + j;
    px(ctx, OUTLINE, x - 3 + inset, y, w + 6 - inset * 2, 1);
    const band =
      j % 5 === 4 ? shade(s.roof, 0.3) : j < 2 ? tint(s.roof, 0.25) : s.roof;
    px(ctx, band, x - 2 + inset, y, w + 4 - inset * 2, 1);
  }
  for (let i = x + 4; i < x + w; i += 8)
    px(ctx, shade(s.roof, 0.2), i, roofTop + 5, 1, roofH - 8);
  px(ctx, OUTLINE, x - 4, wallTop + 3, w + 8, 2); // 처마 끝
  // 벽
  px(ctx, OUTLINE, x, wallTop + 3, w, bottom - wallTop - 3);
  px(ctx, s.wallColor, x + 1, wallTop + 5, w - 2, bottom - wallTop - 6);
  px(ctx, shade(s.wallColor, 0.14), x + 1, wallTop + 5, w - 2, 2);
  px(ctx, s.beam, x + 1, bottom - 5, w - 2, 4);
  px(ctx, tint(s.beam, 0.2), x + 1, bottom - 5, w - 2, 1);
  for (let i = 0; i <= p.w; i += 3)
    px(
      ctx,
      s.beam,
      x + Math.min(i * TILE, w - 3),
      wallTop + 5,
      2,
      bottom - wallTop - 6,
    );
  // 창문 (문 칸과 그 옆은 비운다)
  const doorX = p.doorX ?? p.x;
  for (let t = p.x + 1; t < p.x + p.w - 1; t++) {
    if (Math.abs(t - doorX) < 2 || (t - p.x) % 2 === 0) continue;
    const wx = t * TILE + 1;
    const wy = wallTop + 10;
    px(ctx, OUTLINE, wx, wy, 14, 11);
    px(ctx, "#a9dcf0", wx + 1, wy + 1, 12, 9);
    px(ctx, "#cdeefa", wx + 1, wy + 1, 12, 3);
    px(ctx, s.beam, wx + 6, wy + 1, 2, 9);
    px(ctx, "#ffffff", wx + 2, wy + 2, 2, 1);
  }
  // 문과 포렴
  const dx = doorX * TILE;
  const dy = bottom - TILE - 6;
  px(ctx, OUTLINE, dx, dy, TILE, bottom - dy);
  px(ctx, "#3b2b25", dx + 1, dy + 1, TILE - 2, bottom - dy - 1);
  for (let i = 0; i < 3; i++) {
    px(ctx, s.curtain, dx + 1 + i * 5, dy + 1, 4, 9);
    px(ctx, shade(s.curtain, 0.25), dx + 4 + i * 5, dy + 1, 1, 9);
  }
  px(ctx, "#e7cf9d", dx + 1, bottom - 2, TILE - 2, 2);
}

// ─── 내 방 (기록 개수에 따라 달라진다) ───

function frames(ctx: Ctx, p: Prop, columns: number) {
  for (let i = 0; i < frameCount(columns); i++) {
    const x = (p.x + i) * TILE + 2;
    const y = p.y * TILE - 5;
    px(ctx, OUTLINE, x, y, 12, 14);
    px(ctx, MID_WOOD, x + 1, y + 1, 10, 12);
    px(ctx, "#fbf6ea", x + 2, y + 2, 8, 10);
    for (let l = 0; l < 3; l++)
      px(ctx, "#9b9385", x + 3, y + 4 + l * 2, 6 - l, 1);
  }
}

function bed(ctx: Ctx, p: Prop) {
  const x = p.x * TILE;
  const top = (p.y - 2) * TILE - 2;
  const w = p.w * TILE;
  const bottom = (p.y + 1) * TILE;
  px(ctx, OUTLINE, x, top, w, bottom - top - 1);
  px(ctx, MID_WOOD, x + 1, top + 1, w - 2, bottom - top - 3);
  px(ctx, "#fbf6ea", x + 3, top + 4, w - 6, 11);
  px(ctx, shade("#fbf6ea", 0.14), x + 3, top + 13, w - 6, 2);
  px(ctx, "#8cc56b", x + 2, top + 16, w - 4, bottom - top - 21);
  px(ctx, tint("#8cc56b", 0.3), x + 2, top + 16, w - 4, 2);
  px(ctx, shade("#8cc56b", 0.22), x + w - 5, top + 18, 3, bottom - top - 23);
}

function desk(ctx: Ctx, p: Prop, columns: number) {
  table(ctx, { ...p, kind: "table" }, false);
  const x = p.x * TILE;
  const y = p.y * TILE;
  // 쓴 칼럼이 있으면 책상에 원고를 쌓는다
  for (let i = 0; i < frameCount(columns); i++) {
    px(ctx, OUTLINE, x + 4, y + 1 - i * 2, 11, 7);
    px(ctx, "#fbf6ea", x + 5, y + 2 - i * 2, 9, 5);
    px(ctx, "#9b9385", x + 6, y + 4 - i * 2, 7, 1);
  }
  // 등
  px(ctx, OUTLINE, x + 23, y - 6, 2, 10);
  px(ctx, OUTLINE, x + 18, y - 11, 11, 7);
  px(ctx, "#f2cd4f", x + 19, y - 10, 9, 5);
}

function teaset(ctx: Ctx, p: Prop, sessions: number) {
  const level = teaLevel(sessions);
  table(ctx, { ...p, kind: "table" }, false);
  const x = p.x * TILE;
  const y = p.y * TILE;
  if (level >= 1) {
    px(ctx, OUTLINE, x + 2, y + 3, 6, 5);
    px(ctx, "#fbf6ea", x + 3, y + 4, 4, 3);
    px(ctx, "#8cc56b", x + 3, y + 4, 4, 1);
  }
  if (level === 2) {
    px(ctx, OUTLINE, x + 8, y - 2, 7, 8);
    px(ctx, "#c8714a", x + 9, y - 1, 5, 6);
    px(ctx, OUTLINE, x + 10, y - 4, 3, 2);
  }
  if (level >= 3) {
    px(ctx, OUTLINE, x + 7, y - 3, 8, 9);
    px(ctx, "#4a4650", x + 8, y - 2, 6, 7);
    px(ctx, "#6b6672", x + 9, y - 2, 3, 1);
    px(ctx, OUTLINE, x + 9, y - 5, 4, 2);
    px(ctx, "rgba(255,255,255,0.7)", x + 11, y - 9, 1, 3);
  }
}

// 그 맵의 가구를 그리는 함수와 앞뒤 정렬 기준(바닥에 닿는 y)
export function propsFor(map: GameMap, decor?: Decor) {
  const stats = decor?.stats;
  return map.props
    .filter((p) => p.kind !== "window" && p.kind !== "frames")
    .map((p) => ({
      sortY: (p.y + 1) * TILE,
      draw: (ctx: Ctx) => {
        if (p.kind === "shelf") shelf(ctx, p);
        else if (p.kind === "roomshelf") shelf(ctx, p, stats?.books ?? 0);
        else if (p.kind === "plant") plant(ctx, p);
        else if (p.kind === "counter") counter(ctx, p);
        else if (p.kind === "tree") tree(ctx, p);
        else if (p.kind === "lamp") lamp(ctx, p);
        else if (p.kind === "bench") bench(ctx, p);
        else if (p.kind in FRONTS) front(ctx, p);
        else if (p.kind === "bed") bed(ctx, p);
        else if (p.kind === "desk") desk(ctx, p, stats?.columns ?? 0);
        else if (p.kind === "teaset") teaset(ctx, p, stats?.teaSessions ?? 0);
        else table(ctx, p);
      },
    }));
}
