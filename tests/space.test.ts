import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLook, parseLook } from "@/lib/space/look";
import { doorAt, isWalkable, MAPS } from "@/lib/space/map";
import { findPath, isValidPath, nearestWalkable } from "@/lib/space/path";
import {
  frameCount,
  isRoomStyleUnlocked,
  parseRoomStyle,
  teaLevel,
} from "@/lib/space/room";

const teahouse = MAPS.teahouse;
const SPAWN = teahouse.spawn;

for (const map of Object.values(MAPS)) {
  test(`${map.title}: 입구에서 모든 자리와 문에 갈 수 있고, 문은 올바른 곳으로 이어진다`, () => {
    assert.ok(isWalkable(map, map.spawn.x, map.spawn.y));
    for (const row of map.base) assert.equal(row.length, map.cols);
    for (const seat of map.seats) {
      const path = findPath(map, map.spawn, seat);
      assert.ok(path, `${seat.id}까지 길이 없음`);
      assert.ok(isValidPath(map, map.spawn, path));
    }
    assert.ok(map.doors.length > 0);
    for (const door of map.doors) {
      assert.ok(findPath(map, map.spawn, door), `${door.to} 문까지 길이 없음`);
      const next = MAPS[door.to];
      assert.ok(isWalkable(next, door.at.x, door.at.y), `${door.to} 도착 칸`);
      assert.equal(
        doorAt(next, door.at.x, door.at.y),
        undefined,
        "도착 칸이 문이면 바로 되돌아간다",
      );
    }
  });
}

test("맵 연결: 마을에서 찻집·서재·내 방으로 가고 돌아올 수 있다", () => {
  assert.deepEqual(MAPS.town.doors.map((d) => d.to).sort(), [
    "library",
    "room",
    "teahouse",
  ]);
  for (const id of ["teahouse", "library", "room"] as const)
    assert.ok(MAPS[id].doors.every((d) => d.to === "town"));
  assert.equal(MAPS.room.shared, false, "내 방은 혼자 쓰는 공간");
  assert.ok(MAPS.teahouse.shared && MAPS.town.shared && MAPS.library.shared);
});

test("경로: 가구를 돌아가고, 한 칸씩 이어지며, 최단 거리다", () => {
  const path = findPath(teahouse, { x: 9, y: 5 }, { x: 9, y: 7 })!;
  assert.ok(path.every((p) => isWalkable(teahouse, p.x, p.y)));
  assert.ok(isValidPath(teahouse, { x: 9, y: 5 }, path));
  assert.equal(path.length, 4); // 옆으로 한 칸 돌아서 2칸 내려오고 다시 한 칸
  assert.deepEqual(findPath(teahouse, SPAWN, SPAWN), []);
});

test("경로: 벽·가구는 목적지가 될 수 없고, 가장 가까운 바닥으로 바꾼다", () => {
  const table = teahouse.props.find((p) => p.kind === "longtable")!;
  assert.equal(findPath(teahouse, SPAWN, { x: table.x, y: table.y }), null);
  const near = nearestWalkable(teahouse, { x: table.x, y: table.y }, SPAWN)!;
  assert.ok(isWalkable(teahouse, near.x, near.y));
  assert.equal(Math.abs(near.x - table.x) + Math.abs(near.y - table.y), 1);
  assert.equal(findPath(teahouse, SPAWN, { x: 0, y: 0 }), null);
});

test("마을: 건물 벽과 연못은 지나갈 수 없다", () => {
  assert.equal(isWalkable(MAPS.town, 5, 7), false, "찻집 벽");
  assert.equal(isWalkable(MAPS.town, 7, 7), true, "찻집 문");
  assert.equal(isWalkable(MAPS.town, 5, 14), false, "연못");
});

test("받은 경로 검증: 순간이동·벽 통과·이상한 값은 거부", () => {
  assert.equal(
    isValidPath(teahouse, SPAWN, [{ x: SPAWN.x, y: SPAWN.y - 2 }]),
    false,
  );
  assert.equal(isValidPath(teahouse, { x: 1, y: 3 }, [{ x: 1, y: 2 }]), false); // 책장
  assert.equal(isValidPath(teahouse, SPAWN, "x"), false);
  assert.equal(isValidPath(teahouse, SPAWN, [{ x: 1.5, y: 2 }]), false);
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

test("내 방: 허용 값 검사, 출석일에 따른 잠금, 기록 수에 따른 장식", () => {
  assert.equal(parseRoomStyle({ wall: "gold", floor: "wood" }), null);
  assert.deepEqual(parseRoomStyle({ wall: "matcha", floor: "wood", x: 1 }), {
    wall: "matcha",
    floor: "wood",
  });
  assert.equal(isRoomStyleUnlocked({ wall: "hanji", floor: "wood" }, 0), true);
  assert.equal(
    isRoomStyleUnlocked({ wall: "matcha", floor: "wood" }, 2),
    false,
  );
  assert.equal(isRoomStyleUnlocked({ wall: "matcha", floor: "wood" }, 3), true);
  assert.equal(
    isRoomStyleUnlocked({ wall: "hanji", floor: "tatami" }, 6),
    false,
  );
  assert.deepEqual([0, 1, 3, 10].map(frameCount), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 5, 20].map(teaLevel), [0, 1, 2, 3]);
});
