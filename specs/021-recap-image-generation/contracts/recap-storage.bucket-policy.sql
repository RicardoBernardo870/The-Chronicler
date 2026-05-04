-- =============================================================================
-- Contract: recap-images bucket + RLS policies
-- Feature: 021 — Recap Image Generation
--
-- This file is the canonical SQL for the storage layer of feature 021.
-- It is mirrored verbatim into supabase/migrations/20260503_recap_image_columns.sql
-- (sections 2 and 3) so that running the migration is sufficient to bootstrap
-- the storage layer.
--
-- Independent verification: applying ONLY this file to a fresh Supabase project
-- must produce a bucket where authenticated user A can read/write objects under
-- '<A.uid>/...' but cannot read or write objects under '<B.uid>/...'.
-- =============================================================================

-- 1. Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recap-images',
  'recap-images',
  false,                                   -- private; no public reads
  524288,                                  -- 512 KB cap per object
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do nothing;

-- 2. Policies
-- Path convention: {user_id}/{recap_id}.<ext>
-- storage.foldername(name)[1] returns the first path segment, which we constrain
-- to equal the JWT subject. This delegates ownership entirely to the path.
create policy "recap-images: owner can select"
  on storage.objects for select
  using (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recap-images: owner can insert"
  on storage.objects for insert
  with check (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recap-images: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Verification queries (manual, run in Supabase SQL editor)
-- Replace <A_UID> with a real UUID to dry-run the policy:
--
--   set local "request.jwt.claims" = '{"sub":"<A_UID>"}';
--   select * from storage.objects where bucket_id = 'recap-images';   -- empty
--
-- Then upload a test object and re-run; should return one row.
