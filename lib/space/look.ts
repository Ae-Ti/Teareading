// 캐릭터 꾸미기 값 (PRD 7장). 서버 검증·화면·Presence가 같이 쓴다.

export const SKINS = ["#f8d9bf", "#eebf98", "#d39a6f", "#9c6845"] as const;
export const HAIR_STYLES = ["short", "bob", "long", "bun"] as const;
export const HAIR_COLORS = [
  "#3b2a24",
  "#6b4026",
  "#a8642f",
  "#e3b55a",
  "#55627a",
  "#c96a7a",
] as const;
export const TOP_COLORS = [
  "#8cc56b", // 말차
  "#d98c55", // 호지차
  "#ee9b86", // 홍차
  "#f2cd4f", // 유자
  "#6a9bd1",
  "#f4efe4",
  "#7a6aa8",
  "#4a4a52",
] as const;
export const BOTTOM_COLORS = [
  "#4b5a78",
  "#6e5440",
  "#3f4a3c",
  "#d8cdb5",
  "#2f2d33",
] as const;
export const HATS = ["none", "beanie", "cap", "flower"] as const;

export type Look = {
  skin: number;
  hairStyle: (typeof HAIR_STYLES)[number];
  hairColor: number;
  top: number;
  bottom: number;
  hat: (typeof HATS)[number];
};

export const HAIR_STYLE_LABELS: Record<Look["hairStyle"], string> = {
  short: "짧은 머리",
  bob: "단발",
  long: "긴 머리",
  bun: "올림머리",
};
export const HAT_LABELS: Record<Look["hat"], string> = {
  none: "없음",
  beanie: "비니",
  cap: "모자",
  flower: "꽃핀",
};

// 저장 전 기본 캐릭터: 사용자 ID로 정해서 사람마다 다르게, 같은 사람은 항상 같게
export function defaultLook(userId: string): Look {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const pick = (n: number) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return h % n;
  };
  return {
    skin: pick(SKINS.length),
    hairStyle: HAIR_STYLES[pick(HAIR_STYLES.length)],
    hairColor: pick(HAIR_COLORS.length),
    top: pick(TOP_COLORS.length),
    bottom: pick(BOTTOM_COLORS.length),
    hat: "none",
  };
}

const index = (v: unknown, n: number) =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;

// 허용된 값만 통과시킨다. 아니면 null (서버 저장 전·네트워크로 받은 값 모두 검사)
export function parseLook(value: unknown): Look | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !index(v.skin, SKINS.length) ||
    !HAIR_STYLES.includes(v.hairStyle as Look["hairStyle"]) ||
    !index(v.hairColor, HAIR_COLORS.length) ||
    !index(v.top, TOP_COLORS.length) ||
    !index(v.bottom, BOTTOM_COLORS.length) ||
    !HATS.includes(v.hat as Look["hat"])
  ) {
    return null;
  }
  return {
    skin: v.skin as number,
    hairStyle: v.hairStyle as Look["hairStyle"],
    hairColor: v.hairColor as number,
    top: v.top as number,
    bottom: v.bottom as number,
    hat: v.hat as Look["hat"],
  };
}

export function lookKey(l: Look) {
  return `${l.skin}${l.hairStyle}${l.hairColor}${l.top}${l.bottom}${l.hat}`;
}
