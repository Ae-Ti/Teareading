-- ─────────────────────────────────────────────
-- 친구의 방 구경 (소유: 태일, docs/taeil/space-pixel-prd.md 13장)
-- 찻집은 공개 공간 그대로 두고, 내 방만 친구에게 공개한다.
-- 표의 RLS는 "본인만"으로 두고, 방을 그리는 데 필요한 값만 함수로 내보낸다.
-- 기록 내용은 내보내지 않고 개수만 준다. 친구가 아니거나 차단 관계면 null이다.
-- ─────────────────────────────────────────────
create or replace function public.friend_room(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null or auth.uid() = p_owner then null
    when public.is_blocked_between(auth.uid(), p_owner) then null
    when not exists (
      select 1 from public.friendships f
      where f.user_a = least(auth.uid(), p_owner)
        and f.user_b = greatest(auth.uid(), p_owner)
    ) then null
    else jsonb_build_object(
      'style', (select r.style from public.space_rooms r where r.user_id = p_owner),
      'books', (select count(*) from public.reading_logs l where l.user_id = p_owner),
      'columns', (select count(*) from public.tea_columns c where c.user_id = p_owner),
      'tea_sessions', (
        select count(*) from public.timer_sessions t
        where t.user_id = p_owner and t.status = 'completed' and t.activity = 'tea'
      ),
      'attendance_days', (
        select count(*) from public.attendance_days a where a.user_id = p_owner
      )
    )
  end;
$$;

revoke execute on function public.friend_room(uuid) from public, anon;
grant execute on function public.friend_room(uuid) to authenticated;
