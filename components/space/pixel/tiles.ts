// 찻집 바닥·벽·가구 픽셀 그림. 모두 이 코드로 그린 원본이다 (외부 이미지 없음).

import {
  COLS,
  groundAt,
  PROPS,
  ROWS,
  SEATS,
  TILE,
  type Prop,
} from "@/lib/space/map";
import { OUTLINE, shade, tint } from "./color";

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

const WOOD = "#e2b67e";
const TATAMI = "#d3d792";
const RUG = "#e88a73";
const PLASTER = "#f4e7c9";
const DARK_WOOD = "#6e4a33";
const MID_WOOD = "#a8703f";

function wood(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
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

function tatami(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, TATAMI, ox, oy, TILE, TILE);
  for (let y = 1; y < TILE; y += 2)
    px(ctx, shade(TATAMI, 0.08), ox, oy + y, TILE, 1);
  // 다다미 한 장 = 가로 2칸. 장 사이 이음매
  if ((tx - 7) % 2 === 0) px(ctx, shade(TATAMI, 0.2), ox, oy, 1, TILE);
  // 가장자리 천(헤리)
  const edge = "#5b7a46";
  const edgeHi = "#7fa05f";
  if (groundAt(tx, ty - 1) !== "tatami") {
    px(ctx, edge, ox, oy, TILE, 2);
    px(ctx, edgeHi, ox, oy, TILE, 1);
  }
  if (groundAt(tx, ty + 1) !== "tatami") px(ctx, edge, ox, oy + 14, TILE, 2);
  if (groundAt(tx - 1, ty) !== "tatami") px(ctx, edge, ox, oy, 2, TILE);
  if (groundAt(tx + 1, ty) !== "tatami") px(ctx, edge, ox + 14, oy, 2, TILE);
}

function rug(ctx: Ctx, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, RUG, ox, oy, TILE, TILE);
  const cream = "#f6e2c4";
  const deep = "#c96a57";
  const top = groundAt(tx, ty - 1) !== "rug";
  const left = groundAt(tx - 1, ty) !== "rug";
  const right = groundAt(tx + 1, ty) !== "rug";
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

function wallFace(ctx: Ctx, ox: number, oy: number, tx: number) {
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

function door(ctx: Ctx, ox: number, oy: number, tx: number) {
  px(ctx, "#3b2b25", ox, oy, TILE, TILE);
  px(ctx, MID_WOOD, ox, oy, TILE, 2);
  // 현관 매트
  px(ctx, "#7a8f5a", ox + (tx === 9 ? 2 : 0), oy + 4, 14, 9);
  px(ctx, "#5f7346", ox + (tx === 9 ? 2 : 0), oy + 12, 14, 1);
  for (let x = 0; x < 14; x += 3)
    px(ctx, "#93a86e", ox + (tx === 9 ? 2 : 0) + x, oy + 5, 1, 7);
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

// 바닥·벽·방석을 한 장으로 미리 그린다 (매 프레임 다시 그리지 않음)
export function drawGround(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ox = tx * TILE;
      const oy = ty * TILE;
      const g = groundAt(tx, ty);
      if (g === "wood") wood(ctx, ox, oy, tx, ty);
      else if (g === "tatami") tatami(ctx, ox, oy, tx, ty);
      else if (g === "rug") rug(ctx, ox, oy, tx, ty);
      else if (g === "wall") wall(ctx, ox, oy, ty);
      else if (g === "wallface") wallFace(ctx, ox, oy, tx);
      else door(ctx, ox, oy, tx);
    }
  }
  // 벽 아래 그늘
  ctx.fillStyle = "rgba(60,36,20,0.18)";
  ctx.fillRect(TILE, 2 * TILE, (COLS - 2) * TILE, 3);
  ctx.fillRect(TILE, 2 * TILE, 2, (ROWS - 3) * TILE);
  ctx.fillRect((COLS - 1) * TILE - 2, 2 * TILE, 2, (ROWS - 3) * TILE);

  SEATS.forEach((s, i) => cushion(ctx, s.x * TILE, s.y * TILE, i));
  // 벽에 붙은 창문도 바닥 그림에 넣는다
  for (const p of PROPS) if (p.kind === "window") windowProp(ctx, p);
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

function shelf(ctx: Ctx, p: Prop) {
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
      if (bx + bw > x + w - 3) break;
      const c = BOOKS[Math.floor(rand(p.x + i, row, 7) * BOOKS.length)];
      if (rand(p.x + i, row, 8) > 0.88) {
        bx += 2; // 빈 칸
      } else {
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

function table(ctx: Ctx, p: Prop) {
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

// 가구 하나를 그리는 함수와 앞뒤 정렬 기준(바닥에 닿는 y)
export const TALL_PROPS = PROPS.filter((p) => p.kind !== "window").map((p) => ({
  sortY: (p.y + 1) * TILE,
  draw: (ctx: Ctx) => {
    if (p.kind === "shelf") shelf(ctx, p);
    else if (p.kind === "plant") plant(ctx, p);
    else if (p.kind === "counter") counter(ctx, p);
    else table(ctx, p);
  },
}));
