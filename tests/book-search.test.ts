import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedCover,
  parseKakao,
  parseOpenLibrary,
} from "../lib/book-search";

test("카카오 응답을 표지 있는 순으로 정리한다", () => {
  const hits = parseKakao({
    documents: [
      { title: "표지 없음", authors: ["가"], thumbnail: "" },
      {
        title: " 데미안 ",
        authors: ["헤르만 헤세", "역자", "셋째", "넷째"],
        thumbnail: "http://search1.kakaocdn.net/thumb/R120x174/?fname=x",
      },
      { title: "", authors: [], thumbnail: "" },
      {
        title: "낯선 표지",
        authors: [],
        thumbnail: "https://evil.example/a.jpg",
      },
    ],
  });
  assert.deepEqual(hits[0], {
    title: "데미안",
    author: "헤르만 헤세, 역자, 셋째",
    coverUrl: "https://search1.kakaocdn.net/thumb/R120x174/?fname=x",
  });
  assert.equal(hits.length, 3, "제목 없는 결과는 뺀다");
  assert.equal(hits[2].coverUrl, null, "허용되지 않은 표지 주소는 버린다");
});

test("Open Library 응답을 정리한다", () => {
  const hits = parseOpenLibrary({
    docs: [
      { title: "No cover", author_name: ["A"] },
      { title: "Demian", author_name: ["Hesse"], cover_i: 42 },
    ],
  });
  assert.equal(
    hits[0].coverUrl,
    "https://covers.openlibrary.org/b/id/42-M.jpg",
  );
  assert.equal(hits[1].coverUrl, null);
});

test("이상한 응답은 빈 목록이고, 표지 주소는 허용 목록만 통과한다", () => {
  for (const bad of [null, {}, { documents: "x" }, { docs: 1 }]) {
    assert.deepEqual(parseKakao(bad), []);
    assert.deepEqual(parseOpenLibrary(bad), []);
  }
  assert.ok(isAllowedCover("https://t1.daumcdn.net/lbook/image/1"));
  for (const url of [
    "http://covers.openlibrary.org/b/id/1-M.jpg",
    "https://kakaocdn.net.evil.example/a.jpg",
    "javascript:alert(1)",
  ])
    assert.equal(isAllowedCover(url), false, url);
});
