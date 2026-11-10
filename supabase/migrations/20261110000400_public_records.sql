-- ─────────────────────────────────────────────
-- 공개 프로필: 완독한 책과 차 칼럼 (소유: 웅싯)
-- 표의 RLS는 그대로 "본인만"으로 둔다. 내 기록 목록이 RLS에 기대고 있어서,
-- 다른 사람에게 보여 줄 값만 함수로 내보낸다. 독서기록과 읽는 중·보류 책은 내보내지 않는다.
-- ─────────────────────────────────────────────

create or replace function public.public_finished_books(p_user_id uuid)
returns table (id uuid, title text, author text, cover_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.title, b.author, b.cover_url
  from public.books b
  where b.user_id = p_user_id and b.status = 'done'
  order by b.updated_at desc, b.id
  limit 50;
$$;

create or replace function public.public_tea_columns(p_user_id uuid)
returns table (
  id uuid,
  title text,
  excerpt text,
  tea_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.title, left(c.body, 120), c.tea_type, c.created_at
  from public.tea_columns c
  where c.user_id = p_user_id
  order by c.created_at desc, c.id
  limit 50;
$$;

create or replace function public.public_tea_column(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  body text,
  tea_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.user_id, c.title, c.body, c.tea_type, c.created_at
  from public.tea_columns c
  where c.id = p_id;
$$;

revoke execute on function public.public_finished_books(uuid) from public, anon;
revoke execute on function public.public_tea_columns(uuid) from public, anon;
revoke execute on function public.public_tea_column(uuid) from public, anon;
grant execute on function public.public_finished_books(uuid) to authenticated;
grant execute on function public.public_tea_columns(uuid) to authenticated;
grant execute on function public.public_tea_column(uuid) to authenticated;
