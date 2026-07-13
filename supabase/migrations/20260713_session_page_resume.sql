-- =====================================================================
-- Migration: 20260713_session_page_resume.sql
-- Feature : Session-start page resume
-- Purpose : Store a small AI-generated warm-up ("resume") on each page
--           capture: up to 3 one-sentence bullets, up to 3 characters,
--           and 1 tension line — grounded ONLY in the capture's own text.
--           Stored on the page_captures row so the completion-cleanup
--           triggers (20260513) purge it together with the OCR text.
--           No changes to recaps tables or recap edge functions.
-- =====================================================================

alter table public.page_captures
  add column if not exists resume jsonb null,
  add column if not exists resume_generated_at timestamptz null;

comment on column public.page_captures.resume is
  'Session-start warm-up derived from this capture''s text only: { bullets: text[] (<=3, one sentence each), characters: text[] (<=3), tension: text }. Deleted with the row on book completion.';
comment on column public.page_captures.resume_generated_at is
  'When the resume was last generated. Informational only — regeneration is gated client-side by resume being null.';

-- RLS: existing owner select/insert/update/delete policies on page_captures
-- already cover the new columns; the client writes the resume onto its own
-- row after the stateless edge function returns it.

-- =====================================================================
-- End of migration
-- =====================================================================
