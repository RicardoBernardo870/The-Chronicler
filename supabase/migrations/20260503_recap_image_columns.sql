-- =============================================================================
-- File   : 20260503_recap_image_columns.sql
-- Feature: 021 - Recap Image Generation
-- Purpose: Extend recaps with image metadata and create a private storage
--          bucket for per-user recap images.
-- =============================================================================

alter table public.recaps
  add column if not exists image_path text,
  add column if not exists image_status text,
  add column if not exists image_generated_at timestamptz;

alter table public.recaps
  drop constraint if exists recaps_image_status_check;

alter table public.recaps
  add constraint recaps_image_status_check
  check (
    image_status is null
    or image_status in (
      'pending',
      'succeeded',
      'failed_safety',
      'failed_transient',
      'skipped'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recap-images',
  'recap-images',
  false,
  524288,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recap-images: owner can select" on storage.objects;
drop policy if exists "recap-images: owner can insert" on storage.objects;
drop policy if exists "recap-images: owner can delete" on storage.objects;

create policy "recap-images: owner can select"
  on storage.objects for select
  using (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "recap-images: owner can insert"
  on storage.objects for insert
  with check (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "recap-images: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create index if not exists recaps_image_status_idx
  on public.recaps (image_status)
  where image_status is not null;
