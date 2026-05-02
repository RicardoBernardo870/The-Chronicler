-- ============================================================================
-- File   : 20260502_drop_redundant_community_indexes.sql
-- Purpose: Remove indexes already covered by primary keys.
-- ============================================================================

drop index if exists public.community_profiles_user_id_idx;
drop index if exists public.community_profile_privacy_user_id_idx;
