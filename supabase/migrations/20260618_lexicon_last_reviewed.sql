-- =============================================================================
-- File   : 20260618_lexicon_last_reviewed.sql
-- Feature: 032 - Daily Review Limit & Backlog Smoothing
-- Purpose: Record when a vocabulary word was last reviewed, so the daily review
--          limit can be enforced as a per-account, per-day tally (and a word
--          reviewed today is not surfaced again the same day).
--
-- Notes (Supabase Postgres best practices):
--   * Nullable column → metadata-only ADD COLUMN (no rewrite); existing rows
--     are null ("not reviewed today").
--   * No index — the tally and today's-set selection are computed client-side
--     over the user's already-loaded entries.
--   * Existing owner RLS on public.lexicon_entries governs the new column.
-- =============================================================================

alter table public.lexicon_entries
  add column if not exists last_reviewed_at timestamptz;
