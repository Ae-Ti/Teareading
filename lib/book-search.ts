// 도서 검색: 카카오 키(KAKAO_REST_API_KEY)가 있으면 카카오, 없으면 키가 필요 없는 Open Library.
// 한국 책 표지는 카카오가 훨씬 많다. 서버에서만 호출한다 (키가 브라우저로 나가지 않게).

export type BookHit = {
  title: string;
  author: string;
  coverUrl: string | null;
};

// DB의 books.cover_url 제약과 같은 기준
const COVER_URL =
  /^https:\/\/(covers\.openlibrary\.org|[a-z0-9-]+\.(kakaocdn|daumcdn)\.net)\//;
export const isAllowedCover = (url: string) =>
  url.length <= 1000 && COVER_URL.test(url);

const MAX_RESULTS = 6;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const names = (v: unknown) =>
  Array.isArray(v) ? v.map(text).filter(Boolean).slice(0, 3).join(", ") : "";

function cover(url: string) {
  // 카카오 이미지 주소가 http로 올 때가 있어 https로 맞춘다
  const secure = url.replace(/^http:\/\//, "https://");
  return isAllowedCover(secure) ? secure : null;
}

// 표지가 있는 결과를 먼저 보여 준다
function finish(hits: BookHit[]) {
  return hits
    .filter((h) => h.title)
    .sort((a, b) => Number(!!b.coverUrl) - Number(!!a.coverUrl))
    .slice(0, MAX_RESULTS);
}

export function parseKakao(json: unknown): BookHit[] {
  const docs = (json as { documents?: unknown[] } | null)?.documents;
  if (!Array.isArray(docs)) return [];
  return finish(
    docs.map((d) => {
      const doc = d as {
        title?: unknown;
        authors?: unknown;
        thumbnail?: unknown;
      };
      return {
        title: text(doc.title),
        author: names(doc.authors),
        coverUrl: cover(text(doc.thumbnail)),
      };
    }),
  );
}

export function parseOpenLibrary(json: unknown): BookHit[] {
  const docs = (json as { docs?: unknown[] } | null)?.docs;
  if (!Array.isArray(docs)) return [];
  return finish(
    docs.map((d) => {
      const doc = d as {
        title?: unknown;
        author_name?: unknown;
        cover_i?: unknown;
      };
      return {
        title: text(doc.title),
        author: names(doc.author_name),
        coverUrl:
          typeof doc.cover_i === "number"
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : null,
      };
    }),
  );
}

export async function searchBooks(query: string): Promise<BookHit[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  const signal = AbortSignal.timeout(6000);
  if (key) {
    const url = new URL("https://dapi.kakao.com/v3/search/book");
    url.searchParams.set("query", query);
    url.searchParams.set("size", "10");
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal,
    });
    if (!res.ok) throw new Error(`kakao ${res.status}`);
    return parseKakao(await res.json());
  }
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("fields", "title,author_name,cover_i");
  const res = await fetch(url, {
    headers: { "User-Agent": "Teareading/1.0" },
    signal,
  });
  if (!res.ok) throw new Error(`openlibrary ${res.status}`);
  return parseOpenLibrary(await res.json());
}
