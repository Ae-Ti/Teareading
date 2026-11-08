import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MESSAGE_MAX,
  addPending,
  mergeMessages,
  messageKey,
  normalizeBody,
  removeLocal,
  setLocalStatus,
  startsGroup,
  type ChatItem,
  type ChatMessage,
} from "../lib/chat/core";
import { newClientId } from "../lib/chat/id";

const msg = (n: number, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  client_id: `c${n}`,
  sender_id: "other",
  body: `m${n}`,
  created_at: `2026-11-08T03:00:${String(n).padStart(2, "0")}.000001+00:00`,
  ...over,
});

test("본문은 앞뒤 공백을 지우고 빈 값·길이 초과를 거부한다", () => {
  assert.deepEqual(normalizeBody("  안녕\n"), { body: "안녕", error: null });
  assert.equal(normalizeBody(" \n\t ").body, null);
  // 이모지 하나는 코드 포인트 1개로 센다 (DB char_length와 같음)
  assert.equal(normalizeBody("🍵".repeat(MESSAGE_MAX)).error, null);
  assert.ok(normalizeBody("가".repeat(MESSAGE_MAX + 1)).error);
  // 가운데 줄바꿈은 유지
  assert.equal(normalizeBody("첫 줄\n둘째 줄").body, "첫 줄\n둘째 줄");
});

test("같은 메시지가 목록·실시간·재연결로 여러 번 와도 한 번만 남고 시간순이다", () => {
  let items: ChatItem[] = mergeMessages([], [msg(2), msg(1)]);
  items = mergeMessages(items, [msg(3)]);
  items = mergeMessages(items, [msg(3), msg(2)]);
  items = mergeMessages(items, [msg(0)]);
  assert.deepEqual(
    items.map((m) => m.body),
    ["m0", "m1", "m2", "m3"],
  );
  assert.ok(items.every((m) => m.status === "sent"));
});

test("내 대기 메시지는 저장 확인 시 실제 메시지로 바뀌고 맨 아래 순서를 지킨다", () => {
  const mine = { sender_id: "me", client_id: "a" };
  let items = mergeMessages([], [msg(1)]);
  items = addPending(items, { ...mine, body: "보냄", created_at: "x" });
  items = addPending(items, {
    sender_id: "me",
    client_id: "b",
    body: "두번째",
    created_at: "x",
  });
  // 같은 client_id를 다시 넣어도 하나
  items = addPending(items, { ...mine, body: "보냄", created_at: "x" });
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((m) => m.status),
    ["sent", "sending", "sending"],
  );

  // 다른 사람 메시지가 실시간으로 와도 대기 메시지는 아래에 남는다
  items = mergeMessages(items, [msg(5)]);
  assert.deepEqual(
    items.map((m) => m.body),
    ["m1", "m5", "보냄", "두번째"],
  );

  // 실패 → 재시도 → 저장 확인 (실시간과 응답이 둘 다 와도 하나)
  const key = messageKey(mine);
  items = setLocalStatus(items, key, "failed", "보내지 못했어요");
  assert.equal(items.find((m) => messageKey(m) === key)?.status, "failed");
  const saved = msg(6, { ...mine, body: "보냄" });
  items = mergeMessages(items, [saved]);
  items = mergeMessages(items, [saved]);
  assert.equal(items.filter((m) => messageKey(m) === key).length, 1);
  assert.equal(items.find((m) => messageKey(m) === key)?.status, "sent");
  assert.deepEqual(
    items.map((m) => m.body),
    ["m1", "m5", "보냄", "두번째"],
  );

  // 저장된 메시지는 실패 처리·삭제 대상이 아니다
  assert.deepEqual(setLocalStatus(items, key, "failed"), items);
  assert.equal(removeLocal(items, key).length, items.length);
  assert.equal(
    removeLocal(items, messageKey({ sender_id: "me", client_id: "b" })).length,
    items.length - 1,
  );
});

test("client_id는 보낸 사람별로 구분한다", () => {
  const items = mergeMessages(
    [],
    [
      msg(1, { client_id: "same" }),
      msg(2, { client_id: "same", sender_id: "me" }),
    ],
  );
  assert.equal(items.length, 2);
});

test("같은 사람이 5분 안에 이어 보낸 메시지는 묶는다", () => {
  const [a, b] = mergeMessages([], [msg(1), msg(2)]);
  assert.equal(startsGroup(undefined, a), true);
  assert.equal(startsGroup(a, b), false);
  const later = { ...b, created_at: "2026-11-08T03:10:00+00:00" };
  assert.equal(startsGroup(a, later), true);
  assert.equal(startsGroup(a, { ...b, sender_id: "me" }), true);
});

test("client_id는 UUID v4 형식이다", () => {
  const ids = new Set(Array.from({ length: 50 }, newClientId));
  assert.equal(ids.size, 50);
  for (const id of ids)
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
});
