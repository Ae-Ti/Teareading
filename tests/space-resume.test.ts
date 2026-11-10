import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanMessage,
  parseSnapshot,
  SPACE_MESSAGE_MAX,
} from "../lib/space/resume";

test("상태 메시지는 공백을 정리하고 길이를 제한한다", () => {
  assert.equal(cleanMessage("  데미안\n  읽는 중 "), "데미안 읽는 중");
  assert.equal(cleanMessage("   "), null);
  assert.equal(cleanMessage(123), null);
  assert.equal(
    [...cleanMessage("🍵".repeat(SPACE_MESSAGE_MAX + 5))!].length,
    SPACE_MESSAGE_MAX,
  );
});

test("저장된 찻집 상태를 검사한다", () => {
  const good = {
    mapId: "teahouse",
    pos: { x: 3, y: 4 },
    dir: "up",
    seat: "a",
    message: " 안녕 ",
  };
  assert.deepEqual(parseSnapshot(JSON.stringify(good)), {
    ...good,
    message: "안녕",
  });
  for (const bad of [
    null,
    "not json",
    JSON.stringify({ ...good, mapId: "moon" }),
    JSON.stringify({ ...good, pos: { x: "a", y: 1 } }),
    JSON.stringify({ ...good, dir: "north" }),
  ])
    assert.equal(parseSnapshot(bad), null);
});
