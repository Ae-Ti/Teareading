import { MAPS, type Dir, type MapId, type Point } from "@/lib/space/map";

// 찻집에서 다른 화면에 갔다 돌아왔을 때 이어서 있도록, 내 자리를 이 탭에 저장한다.
// '나가기'를 누르면 지운다. 다른 계정과 섞이지 않게 사용자별로 저장한다.
export type SpaceSnapshot = {
  mapId: MapId;
  pos: Point;
  dir: Dir;
  seat: string | null;
  message: string | null;
};

export const SPACE_MESSAGE_MAX = 30;

// 상태 메시지 정리: 앞뒤 공백 제거, 길이 제한. 다른 사람이 보낸 값에도 쓴다.
export function cleanMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = [...value.replace(/\s+/g, " ").trim()]
    .slice(0, SPACE_MESSAGE_MAX)
    .join("");
  return text || null;
}

const DIRS: readonly unknown[] = ["up", "down", "left", "right"];
const isPoint = (v: unknown): v is Point =>
  !!v && Number.isInteger((v as Point).x) && Number.isInteger((v as Point).y);

export function parseSnapshot(raw: string | null): SpaceSnapshot | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SpaceSnapshot>;
    if (typeof v.mapId !== "string" || !(v.mapId in MAPS)) return null;
    if (!isPoint(v.pos) || !DIRS.includes(v.dir)) return null;
    return {
      mapId: v.mapId,
      pos: v.pos,
      dir: v.dir as Dir,
      seat: typeof v.seat === "string" ? v.seat : null,
      message: cleanMessage(v.message),
    };
  } catch {
    return null;
  }
}

const keyOf = (userId: string) => `teareading:space:${userId}`;

export function readSnapshot(userId: string) {
  try {
    return parseSnapshot(sessionStorage.getItem(keyOf(userId)));
  } catch {
    return null;
  }
}

export function writeSnapshot(userId: string, snapshot: SpaceSnapshot) {
  try {
    sessionStorage.setItem(keyOf(userId), JSON.stringify(snapshot));
  } catch {
    // 저장소를 쓸 수 없으면(시크릿 모드 제한 등) 다음에 입구에서 시작한다
  }
}

export function clearSnapshot(userId: string) {
  try {
    sessionStorage.removeItem(keyOf(userId));
  } catch {
    // 위와 같다
  }
}
