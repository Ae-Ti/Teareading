// 날짜는 모두 한국 시간(KST) 기준으로 다룬다. DB는 UTC, 출석 날짜는 KST.
const TZ = "Asia/Seoul";

// 'YYYY-MM-DD'
export function kstDate(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0 = 월요일 ... 6 = 일요일
export function weekdayIndex(day: string) {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 이번 주 월~일 날짜 목록
export function weekOf(day: string) {
  const monday = addDays(day, -weekdayIndex(day));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// 연속 출석 일수. 오늘 아직 출석 전이면 어제까지 이어진 기록을 센다.
export function streak(days: Set<string>, today: string) {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function formatKoreanDate(iso: string | Date, withWeekday = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    ...(withWeekday && { weekday: "long" }),
  }).format(new Date(iso));
}

export function formatKoreanDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
