-- ============================================================================
-- File   : 20260428_reader_profile.sql
-- Feature: 016 — Reader Profile Page (Reading DNA + Auto-Vocabulary Extraction)
-- Purpose: Add reading_dna table, vocabulary_extractions ledger table, and a
--          source column on lexicon_entries to differentiate manual vs auto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lexicon_entries.source extension
-- ----------------------------------------------------------------------------

alter table public.lexicon_entries
  add column if not exists source text not null default 'manual'
  check (source in ('manual','auto'));

comment on column public.lexicon_entries.source is
  '''manual'' = user-added; ''auto'' = inserted by extract-vocabulary edge function';

-- ----------------------------------------------------------------------------
-- 2. reading_dna — one persisted DNA per user; replaced on regeneration
-- ----------------------------------------------------------------------------

create table public.reading_dna (
  user_id                       uuid        primary key references auth.users(id) on delete cascade,
  personality                   text        not null check (char_length(personality) between 50 and 800),
  mood_tone                     text        not null check (char_length(mood_tone) between 1 and 40),
  mood_emojis                   text[]      not null check (array_length(mood_emojis, 1) between 1 and 5),
  suggestions                   jsonb       not null,
  books_finished_at_generation  int         not null check (books_finished_at_generation >= 0),
  generated_at                  timestamptz not null default now()
);

comment on table public.reading_dna is
  'One persisted Reading DNA per user; replaced on threshold-driven regeneration.';
comment on column public.reading_dna.personality is
  '2-3 sentence narrative-voice literary personality summary (50-800 chars).';
comment on column public.reading_dna.mood_tone is
  'Single mood descriptor, e.g. "contemplative".';
comment on column public.reading_dna.mood_emojis is
  '1-5 emoji glyphs forming the mood signature.';
comment on column public.reading_dna.suggestions is
  'JSON array of {title, author, reason}; length 3-5.';
comment on column public.reading_dna.books_finished_at_generation is
  'Snapshot of completed-books count at generation time; used by the client to compute the 3-book threshold.';

alter table public.reading_dna enable row level security;

create policy reading_dna_select on public.reading_dna
  for select using (auth.uid() = user_id);

create policy reading_dna_insert on public.reading_dna
  for insert with check (auth.uid() = user_id);

create policy reading_dna_update on public.reading_dna
  for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. vocabulary_extractions ledger
-- ----------------------------------------------------------------------------

create table public.vocabulary_extractions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  capture_id    uuid        not null unique references public.page_captures(id) on delete cascade,
  book_id       uuid        not null references public.books(id) on delete cascade,
  page          int         not null check (page >= 0),
  words_added   int         not null default 0 check (words_added between 0 and 5),
  status        text        not null check (status in ('pending','succeeded','failed','skipped')),
  error_message text        null,
  created_at    timestamptz not null default now()
);

comment on table public.vocabulary_extractions is
  'One row per extract-vocabulary invocation. Idempotent by capture_id.';

create index vocabulary_extractions_user_recent_idx
  on public.vocabulary_extractions (user_id, created_at desc);

alter table public.vocabulary_extractions enable row level security;

create policy vocabulary_extractions_select on public.vocabulary_extractions
  for select using (auth.uid() = user_id);

create policy vocabulary_extractions_insert on public.vocabulary_extractions
  for insert with check (auth.uid() = user_id);

create policy vocabulary_extractions_update on public.vocabulary_extractions
  for update using (auth.uid() = user_id);
