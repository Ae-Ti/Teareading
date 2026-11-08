// 메시지마다 한 번 만드는 client_id (UUID v4). 재시도할 때 같은 값을 다시 보낸다.
// crypto.randomUUID는 https·localhost에서만 있으므로 같은 기기 테스트(LAN http)용 대체 구현을 둔다.
export function newClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
