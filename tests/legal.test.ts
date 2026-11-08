import assert from "node:assert/strict";
import { test } from "node:test";
import { LEGAL, missingLegalFields } from "../lib/legal";

// 출시 전 확인용: 약관·개인정보처리방침의 운영 정보가 모두 채워져야 통과한다.
test("약관·개인정보처리방침 운영 정보가 채워져 있다", () => {
  assert.deepEqual(
    missingLegalFields(),
    [],
    `lib/legal.ts에서 채워야 하는 값: ${missingLegalFields().join(", ")}`,
  );
  if (LEGAL.contactEmail)
    assert.match(LEGAL.contactEmail, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});
