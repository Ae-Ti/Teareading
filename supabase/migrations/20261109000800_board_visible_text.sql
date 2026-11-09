-- ─────────────────────────────────────────────
-- 게시판: 보이지 않는 문자만 넣은 글·댓글 금지 (소유: 웅싯, 태일 D6 점검 10장 6번)
-- 전각 공백, 한글 채움 문자, 폭 없는 문자 등. lib/board.ts의 hasVisibleText와 같은 기준이다.
-- 이미 저장된 글은 검사하지 않는다 (not valid). 새 글과 고치는 글부터 적용된다.
-- ─────────────────────────────────────────────
create or replace function public.has_visible_text(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    p_value,
    '[\s ­ᅟᅠ ᠎ -‏ -  -⁤　ㅤ﻿ﾠ]',
    '',
    'g'
  ) <> '';
$$;

alter table public.posts
  add constraint posts_title_visible check (public.has_visible_text(title)) not valid,
  add constraint posts_body_visible check (public.has_visible_text(body)) not valid;

alter table public.post_comments
  add constraint post_comments_body_visible check (public.has_visible_text(body)) not valid;
