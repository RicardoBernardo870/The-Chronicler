-- ============================================================================
-- File   : 20260502_set_updated_at_search_path.sql
-- Purpose: Pin search_path for the shared updated-at trigger function.
-- ============================================================================

alter function public.set_updated_at() set search_path = public;
