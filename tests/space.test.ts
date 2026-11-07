import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLook, parseLook } from "@/lib/space/look";
import { isWalkable, PROPS, SEATS, SPAWN } from "@/lib/space/map";
import { findPath, isValidPath, nearestWalkable } from "@/lib/space/path";

test("찻집 맵: 입구와 모든 방석에 갈 수 있다", () => {
  assert.ok(isWalkable(SPAWN.x, SPAWN.y));
  for (const seat of SEATS) {
    assert.ok(isWalkable(seat.x, seat.y), `${seat.id} 방석이 막혀 있음`);
    const path = findPath(SPAWN, seat);
    assert.ok(path, `${seat.id}까지 길이 없음`);
    assert.ok(isValidPath(SPAWN, path));
  }
});

test("경로: 가구를 돌아가고, 한 칸씩 이어지며, 최단 거리다", () => {
  // 긴 다탁(9~10, 6) 위쪽에서 아래쪽으로
  const path = findPath({ x: 9, y: 5 }, { x: 9, y: 7 })!;
  assert.ok(path.every((p) => isWalkable(p.x, p.y)));
  assert.ok(isValidPath({ x: 9, y: 5 }, path));
  assert.equal(path.length, 4); // 옆으로 한 칸 돌아서 2칸 내려오고 다시 한 칸
  assert.deepEqual(findPath(SPAWN, SPAWN), []);
});

test("경로: 벽·가구는 목적지가 될 수 없고, 가장 가까운 바닥으로 바꾼다", () => {
  const table = PROPS.find((p) => p.kind === "longtable")!;
  assert.equal(findPath(SPAWN, { x: table.x, y: table.y }), null);
  const near = nearestWalkable({ x: table.x, y: table.y }, SPAWN)!;
  assert.ok(isWalkable(near.x, near.y));
  assert.equal(Math.abs(near.x - table.x) + Math.abs(near.y - table.y), 1);
  assert.equal(findPath(SPAWN, { x: 0, y: 0 }), null);
});

test("받은 경로 검증: 순간이동·벽 통과·이상한 값은 거부", () => {
  assert.equal(isValidPath(SPAWN, [{ x: SPAWN.x, y: SPAWN.y - 2 }]), false);
  assert.equal(isValidPath({ x: 1, y: 3 }, [{ x: 1, y: 2 }]), false); // 책장
  assert.equal(isValidPath(SPAWN, "x"), false);
  assert.equal(isValidPath(SPAWN, [{ x: 1.5, y: 2 }]), false);
});

test("캐릭터 꾸미기 값: 허용 값만 통과, 기본값은 사용자마다 같게", () => {
  const look = defaultLook("2f5b7d2c-0000-4000-8000-000000000001");
  assert.deepEqual(parseLook(look), look);
  assert.deepEqual(defaultLook("2f5b7d2c-0000-4000-8000-000000000001"), look);
  assert.equal(parseLook({ ...look, skin: 99 }), null);
  assert.equal(parseLook({ ...look, hat: "crown" }), null);
  assert.equal(parseLook({ ...look, top: "1" }), null);
  assert.equal(parseLook(null), null);
  // 남는 키는 버린다
  assert.deepEqual(parseLook({ ...look, extra: "<script>" }), look);
});
