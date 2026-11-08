// 픽셀 그림용 색 계산

export const OUTLINE = "#2c2430";

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]) {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const memo = new Map<string, string>();

// 어둡게: 그림자는 살짝 보랏빛으로 (따뜻한 색이 탁해지지 않게)
export function shade(hex: string, amount: number) {
  const k = `s${hex}${amount}`;
  let v = memo.get(k);
  if (!v) {
    const [r, g, b] = parse(hex);
    v = toHex([
      r * (1 - amount) + 40 * amount * 0.3,
      g * (1 - amount) + 20 * amount * 0.3,
      b * (1 - amount) + 70 * amount * 0.3,
    ]);
    memo.set(k, v);
  }
  return v;
}

export function tint(hex: string, amount: number) {
  const k = `t${hex}${amount}`;
  let v = memo.get(k);
  if (!v) {
    const [r, g, b] = parse(hex);
    v = toHex([
      r + (255 - r) * amount,
      g + (255 - g) * amount,
      b + (255 - b) * amount,
    ]);
    memo.set(k, v);
  }
  return v;
}
