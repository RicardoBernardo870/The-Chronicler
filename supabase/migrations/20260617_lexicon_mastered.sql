-- =============================================================================
-- File   : 20260617_lexicon_mastered.sql
-- Feature: 031 - Vocabulary Review Progress & Word Graduation
-- Purpose: Add a terminal "mastered" flag to vocabulary words. Set true only by
--          answering "Knew it" in the Anki flashcard session; mastered words are
--          excluded from all review queues but kept in the Great Library.
--
-- Notes (Supabase Postgres best practices):
--   * NOT NULL with a constant default → metadata-only ADD COLUMN (no rewrite),
--     and all existing rows default to non-mastered.
--   * No index — review filtering is client-side and the Great Library list does
--     not filter on this column.
--   * Existing owner RLS on public.lexicon_entries governs the new column.
-- =============================================================================

alter table public.lexicon_entries
  add column if not exists mastered boolean not null default false;
