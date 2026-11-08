-- 공개 프로필에 표시하는 아바타. URL을 아는 사람은 이미지를 열람할 수 있다.
-- 원본 파일은 앱 서버에서 검증·재인코딩하고 UUID 이름의 WebP만 저장한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp']);

-- 조회 권한은 본인 폴더만. public bucket의 개별 이미지 다운로드는 별도 공개 경로다.
create policy "본인 아바타 파일 조회"
on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "본인 아바타 파일 업로드"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
);

-- 기존 파일을 덮어쓰지 않는다. 새 파일 업로드와 프로필 갱신이 성공한 뒤 이전 파일을 삭제한다.
create policy "본인 아바타 파일 삭제"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
