insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cpp-profile-photos',
  'cpp-profile-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cpp_profile_photos_select_own'
  ) then
    create policy "cpp_profile_photos_select_own"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'cpp-profile-photos'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cpp_profile_photos_insert_own'
  ) then
    create policy "cpp_profile_photos_insert_own"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'cpp-profile-photos'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cpp_profile_photos_update_own'
  ) then
    create policy "cpp_profile_photos_update_own"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'cpp-profile-photos'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      )
      with check (
        bucket_id = 'cpp-profile-photos'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cpp_profile_photos_delete_own'
  ) then
    create policy "cpp_profile_photos_delete_own"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'cpp-profile-photos'
        and (storage.foldername(name))[1] = ((select auth.uid()))::text
      );
  end if;
end
$$;
