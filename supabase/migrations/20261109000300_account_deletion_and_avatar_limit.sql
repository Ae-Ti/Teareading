-- ─────────────────────────────────────────────
-- 회원 탈퇴와 아바타 저장 개수 제한 (소유: 웅싯)
-- ─────────────────────────────────────────────

-- 회원 탈퇴: 호출한 본인 계정만 지운다.
-- auth.users를 지우면 profiles와 모든 기록·메시지·모임(모임장인 모임 포함)·차단·찻집 기록이 cascade로 지워지고,
-- events는 user_id만 비워져 통계로 남는다.
-- Storage 파일은 회원과 연결돼 있지 않으므로 앱 서버가 이 함수를 부르기 전에 Storage API로 먼저 지운다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 아바타: 본인 폴더에 이미 있는 파일 수 (업로드 정책에서 쓴다)
create or replace function public.my_avatar_file_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text;
$$;

revoke execute on function public.my_avatar_file_count() from public, anon;
grant execute on function public.my_avatar_file_count() to authenticated;

-- 업로드는 본인 폴더에 최대 2개까지만 (교체할 때 새 파일을 올린 뒤 이전 파일을 지우므로 잠깐 2개가 된다).
-- Storage API로 직접 올려 앱 서버의 재인코딩을 우회하더라도 한 사람이 쌓을 수 있는 양을 2MB × 2로 묶는다.
drop policy "본인 아바타 파일 업로드" on storage.objects;
create policy "본인 아바타 파일 업로드"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
  and public.my_avatar_file_count() < 2
);
