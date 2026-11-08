// 픽셀 캐릭터 (16 × 26px). 손으로 찍은 도트 틀에 꾸미기 값으로 색을 입히고, 바깥 외곽선을 자동으로 두른다.
// 그림은 모두 이 파일의 도트 틀로 그린 원본이다 (외부 이미지 없음).

import type { Dir } from "@/lib/space/map";
import {
  BOTTOM_COLORS,
  HAIR_COLORS,
  lookKey,
  SKINS,
  TOP_COLORS,
  type Look,
} from "@/lib/space/look";
import { OUTLINE, shade, tint } from "./color";

export const CHAR_W = 16;
export const CHAR_H = 26;
// 틀의 0번 줄이 그림의 몇 번째 줄인지 (위쪽 2줄은 올림머리·비니 방울 자리)
const TOP = 2;

export type Pose = "stand" | "stepA" | "stepB" | "sit";
type View = "front" | "back" | "side";

// 글자 뜻: H 머리 h 머리 그늘 L 머리 윤기 / S 피부 s 피부 그늘 / E 눈 B 볼
//          T 윗옷 t 윗옷 그늘 / P 아래옷 p 아래옷 그늘 / O 신발
// 옆모습은 왼쪽을 보는 그림이고, 오른쪽은 좌우를 뒤집는다.

const HEAD: Record<View, string[]> = {
  front: [
    "................",
    ".....HHHHHH.....",
    "...HHHLLHHHHH...",
    "..HHHLLHHHHHHh..",
    "..HHLLHHHHHHHh..",
    "..HHHHHHHHHHHh..",
    "..HHHHHHHHHHhh..",
    "..HHhHHhHHhHhh..",
    "..HSSHSSSSHSSh..",
    "..hSSSSSSSSSSh..",
    "..hSESSSSSSESh..",
    "..hSESSSSSSESs..",
    "...SBSSSSSSBs...",
    "....ssSSSSss....",
  ],
  back: [
    "................",
    ".....HHHHHH.....",
    "...HHHLLHHHHH...",
    "..HHHLLHHHHHHh..",
    "..HHLLHHHHHHHh..",
    "..HHHHHHHHHHHh..",
    "..HHHHHHHHHHHh..",
    "..HHHHHHHHHHhh..",
    "..HHHHHHHHHHhh..",
    "..hHHHHHHHHHhh..",
    "..hhHHHHHHHhhh..",
    "...hhhHHHhhhh...",
    "...ShhhhhhhhS...",
    "....ssSSSSss....",
  ],
  side: [
    "................",
    ".....HHHHHH.....",
    "...HHHLLHHHHH...",
    "..HHHLLHHHHHHh..",
    "..HHLLHHHHHHHh..",
    "..HHHHHHHHHHHh..",
    "..HhHHHHHHHHhh..",
    "..HSHhHHHHHHhh..",
    "..SSSSSHHHHHhh..",
    "..SSSSSSsHHHhh..",
    "..SESSSSsHHHhh..",
    "..SESSSSShHhh...",
    "..SBSSSSShhh....",
    "...sSSSss.......",
  ],
};

// 몸통은 틀의 14번 줄부터 (앉으면 17번 줄부터)
const FRONT_BODY: Record<Pose, string[]> = {
  stand: [
    "....TTTTTTTT....",
    "...TTTTTTTTTt...",
    "...TtTTTTTTtt...",
    "...StTTTTTTtS...",
    "....tttttttt....",
    "....PPPPPPPp....",
    "....PPp..PPp....",
    "....PPp..PPp....",
    "....OOO..OOO....",
    "................",
  ],
  stepA: [
    "....TTTTTTTT....",
    "...TTTTTTTTTt...",
    "...TtTTTTTTtt...",
    "...StTTTTTTtt...",
    "....ttttttttS...",
    "....PPPPPPPp....",
    "....PPp..PPp....",
    "....OOO..PPp....",
    ".........OOO....",
    "................",
  ],
  stepB: [
    "....TTTTTTTT....",
    "...TTTTTTTTTt...",
    "...TtTTTTTTtt...",
    "...TtTTTTTTtS...",
    "...Stttttttt....",
    "....PPPPPPPp....",
    "....PPp..PPp....",
    "....PPp..OOO....",
    "....OOO.........",
    "................",
  ],
  sit: [
    "....TTTTTTTT....",
    "...TTTTTTTTTt...",
    "...TtTTTTTTtt...",
    "..PPSPPPPPPSPp..",
    "..PPPPPPPPPPPp..",
    "...pppppppppp...",
    "................",
  ],
};

const BODY: Record<View, Record<Pose, string[]>> = {
  front: FRONT_BODY,
  back: {
    // 뒷모습은 팔 흔들림이 앞모습과 반대
    stand: FRONT_BODY.stand,
    stepA: FRONT_BODY.stepB.slice(0, 5).concat(FRONT_BODY.stepA.slice(5)),
    stepB: FRONT_BODY.stepA.slice(0, 5).concat(FRONT_BODY.stepB.slice(5)),
    sit: [
      "....TTTTTTTT....",
      "...TTTTTTTTTt...",
      "...TtTTTTTTtt...",
      "...TtttttttTt...",
      "..PPPPPPPPPPPp..",
      "...OOpppppOO....",
      "................",
    ],
  },
  side: {
    stand: [
      ".....TTTTTt.....",
      ".....TTTTTt.....",
      ".....TtTTtt.....",
      ".....TtSTtt.....",
      ".....tttttt.....",
      ".....PPPPPp.....",
      ".....PPPPPp.....",
      ".....PPPPPp.....",
      "....OOOOOO......",
      "................",
    ],
    stepA: [
      ".....TTTTTt.....",
      ".....TTTTTt.....",
      ".....TtTTtt.....",
      ".....STTTtt.....",
      ".....tttttt.....",
      ".....PPPPPp.....",
      "....PPp.PPp.....",
      "...PPp...PPp....",
      "..OOO....OOO....",
      "................",
    ],
    stepB: [
      ".....TTTTTt.....",
      ".....TTTTTt.....",
      ".....TtTTtt.....",
      ".....TtTTSt.....",
      ".....tttttt.....",
      ".....PPPPPp.....",
      ".....PPpPp......",
      "....PPp.PPp.....",
      "...OOO..OOO.....",
      "................",
    ],
    sit: [
      ".....TTTTTt.....",
      ".....TTTTTt.....",
      ".....TSTTtt.....",
      "...PPPPPPPPp....",
      "..PPPPPPPPPp....",
      "..ppppppppOO....",
      "................",
    ],
  },
};

type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: CHAR_H }, () => Array(CHAR_W).fill("."));
}

function stamp(g: Grid, rows: string[], y0: number) {
  rows.forEach((row, j) => {
    for (let x = 0; x < CHAR_W; x++) {
      const c = row[x];
      if (c && c !== "." && g[y0 + j]) g[y0 + j][x] = c;
    }
  });
}

function put(g: Grid, x: number, y: number, c: string, w = 1, h = 1) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const row = g[y + j];
      if (row && x + i >= 0 && x + i < CHAR_W) row[x + i] = c;
    }
}

// 머리 모양 덧칠 (짧은 머리는 기본 틀 그대로)
function hairStyle(g: Grid, style: Look["hairStyle"], view: View, y: number) {
  if (style === "bob") {
    if (view === "front") {
      put(g, 1, y + 6, "H", 1, 7);
      put(g, 14, y + 6, "h", 1, 7);
      put(g, 2, y + 11, "H", 1, 2);
      put(g, 13, y + 11, "h", 1, 2);
      put(g, 3, y + 12, "h");
      put(g, 12, y + 12, "h");
    } else if (view === "back") {
      put(g, 1, y + 6, "H", 1, 7);
      put(g, 14, y + 6, "h", 1, 7);
      put(g, 2, y + 11, "h", 12, 2);
      put(g, 3, y + 13, "h", 10, 1);
    } else {
      put(g, 14, y + 6, "h", 1, 7);
      put(g, 9, y + 12, "h", 5, 2);
    }
  } else if (style === "long") {
    if (view === "front") {
      put(g, 1, y + 6, "H", 2, 12);
      put(g, 13, y + 6, "h", 2, 12);
      put(g, 2, y + 18, "h");
      put(g, 13, y + 18, "h");
    } else if (view === "back") {
      put(g, 1, y + 6, "H", 1, 8);
      put(g, 14, y + 6, "h", 1, 8);
      put(g, 2, y + 11, "H", 12, 6);
      put(g, 2, y + 16, "h", 12, 2);
      put(g, 3, y + 18, "h", 10, 1);
    } else {
      put(g, 14, y + 6, "h", 1, 10);
      put(g, 9, y + 11, "H", 5, 6);
      put(g, 9, y + 16, "h", 5, 2);
    }
  } else if (style === "bun") {
    const bx = view === "side" ? 8 : 6;
    put(g, bx + 1, y - 2, "H", 2, 1);
    put(g, bx, y - 1, "H", 4, 2);
    put(g, bx + 1, y - 1, "L");
    put(g, bx + 3, y - 1, "h", 1, 2);
  }
}

// K 모자 Q 모자 그늘 k 모자 장식 / F 꽃잎 Y 꽃술
function hat(g: Grid, kind: Look["hat"], view: View, y: number) {
  if (kind === "beanie") {
    put(g, 7, y - 1, "k", 2, 1);
    put(g, 5, y + 1, "K", 6, 1);
    put(g, 3, y + 2, "K", 10, 1);
    put(g, 2, y + 3, "K", 12, 3);
    put(g, 12, y + 2, "Q");
    put(g, 13, y + 3, "Q", 1, 3);
    put(g, 4, y + 3, "k", 1, 2);
    put(g, 2, y + 6, "k", 12, 1);
  } else if (kind === "cap") {
    put(g, 5, y + 1, "K", 6, 1);
    put(g, 3, y + 2, "K", 10, 1);
    put(g, 2, y + 3, "K", 12, 3);
    put(g, 13, y + 3, "Q", 1, 3);
    put(g, 7, y + 1, "k", 2, 1);
    if (view === "front") put(g, 2, y + 6, "Q", 12, 1);
    if (view === "side") put(g, 0, y + 6, "Q", 7, 1);
    if (view === "back") put(g, 2, y + 6, "K", 12, 1);
  } else if (kind === "flower") {
    const fx = view === "front" ? 11 : view === "side" ? 9 : 3;
    put(g, fx + 1, y + 3, "F");
    put(g, fx, y + 4, "F");
    put(g, fx + 1, y + 4, "Y");
    put(g, fx + 2, y + 4, "F");
    put(g, fx + 1, y + 5, "F");
  }
}

function build(look: Look, dir: Dir, pose: Pose): Grid {
  const view: View = dir === "down" ? "front" : dir === "up" ? "back" : "side";
  const sit = pose === "sit";
  const headY = TOP + (sit ? 3 : 0);
  const g = blank();
  // 긴 머리 뒷모습은 몸 위를 덮으므로 몸 → 머리 순서로 찍는다
  stamp(g, BODY[view][pose], TOP + (sit ? 17 : 14));
  stamp(g, HEAD[view], headY);
  hairStyle(g, look.hairStyle, view, headY);
  hat(g, look.hat, view, headY);
  if (dir === "right") for (const row of g) row.reverse();
  return g;
}

function colors(look: Look): Record<string, string> {
  const hair = HAIR_COLORS[look.hairColor];
  const skin = SKINS[look.skin];
  const top = TOP_COLORS[look.top];
  const bottom = BOTTOM_COLORS[look.bottom];
  const hat = look.hat === "cap" ? "#3f6fb5" : "#d9574b";
  return {
    H: hair,
    h: shade(hair, 0.3),
    L: tint(hair, 0.32),
    S: skin,
    s: shade(skin, 0.16),
    E: OUTLINE,
    B: "#f29a95",
    T: top,
    t: shade(top, 0.24),
    P: bottom,
    p: shade(bottom, 0.28),
    O: "#5a4636",
    K: hat,
    Q: shade(hat, 0.28),
    k: look.hat === "beanie" ? "#f4efe4" : tint(hat, 0.3),
    F: "#f6a5c0",
    Y: "#fff0a0",
  };
}

const HEADISH = new Set(["S", "s", "H", "h", "L", "B", "E"]);
const TOPISH = new Set(["T", "t"]);

function paint(g: Grid, palette: Record<string, string>) {
  const canvas = document.createElement("canvas");
  canvas.width = CHAR_W;
  canvas.height = CHAR_H;
  const ctx = canvas.getContext("2d")!;
  const at = (x: number, y: number) => g[y]?.[x] ?? ".";
  for (let y = 0; y < CHAR_H; y++) {
    for (let x = 0; x < CHAR_W; x++) {
      const c = at(x, y);
      let color: string | undefined;
      if (c === ".") {
        // 바깥 외곽선
        if (
          at(x - 1, y) !== "." ||
          at(x + 1, y) !== "." ||
          at(x, y - 1) !== "." ||
          at(x, y + 1) !== "."
        )
          color = OUTLINE;
      } else if (TOPISH.has(c) && HEADISH.has(at(x, y - 1))) {
        color = OUTLINE; // 턱과 옷깃 사이 선
      } else {
        color = palette[c];
      }
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

const cache = new Map<string, HTMLCanvasElement>();

export function characterSprite(
  look: Look,
  dir: Dir,
  pose: Pose,
): HTMLCanvasElement {
  const key = `${lookKey(look)}|${dir}|${pose}`;
  let c = cache.get(key);
  if (!c) {
    c = paint(build(look, dir, pose), colors(look));
    cache.set(key, c);
  }
  return c;
}
