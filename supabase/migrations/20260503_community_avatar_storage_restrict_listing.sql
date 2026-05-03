-- ============================================================================
-- File   : 20260503_community_avatar_storage_restrict_listing.sql
-- Purpose: Avoid object-listing access for the public community avatar bucket.
-- ============================================================================

drop policy if exists community_avatars_public_select on storage.objects;
