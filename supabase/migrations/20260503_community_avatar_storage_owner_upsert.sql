-- ============================================================================
-- File   : 20260503_community_avatar_storage_owner_upsert.sql
-- Purpose: Use JWT subject folder checks and allow owner upserts for avatars.
-- ============================================================================

drop policy if exists community_avatars_owner_insert on storage.objects;
create policy community_avatars_owner_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

drop policy if exists community_avatars_owner_select on storage.objects;
create policy community_avatars_owner_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

drop policy if exists community_avatars_owner_update on storage.objects;
create policy community_avatars_owner_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  )
  with check (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

drop policy if exists community_avatars_owner_delete on storage.objects;
create policy community_avatars_owner_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
