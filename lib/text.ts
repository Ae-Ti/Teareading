// 보이지 않는 글자 처리. DB의 has_visible_text, has_hidden_chars와 같은 기준이다.
const INVISIBLE =
  /[\s\u00A0\u00AD\u115F\u1160\u1680\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2800\u3000\u3164\uFEFF\uFFA0]/g;
const HIDDEN =
  /[\u00AD\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]/;

// 공백·보이지 않는 글자를 빼고 남는 글자가 있는가
export const hasVisibleText = (v: string) =>
  v.replace(INVISIBLE, "").length > 0;

// 폭이 0인 문자·채움 문자가 섞였는가 (닉네임·모임 이름 흉내 방지)
export const hasHiddenChars = (v: string) => HIDDEN.test(v);
