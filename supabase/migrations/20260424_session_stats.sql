-- Migration: 013-session-stats-card
-- Adds explicit session tracking columns to reading_progress and progress_history.
-- All existing rows remain valid (both columns nullable, no backfill required).

ALTER TABLE public.reading_progress
  ADD COLUMN IF NOT EXISTS session_start_at TIMESTAMPTZ NULL;

ALTER TABLE public.progress_history
  ADD COLUMN IF NOT EXISTS session_start_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS session_note     TEXT         NULL
    CHECK (char_length(session_note) <= 160);
