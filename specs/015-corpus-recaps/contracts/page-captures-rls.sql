-- =====================================================================
-- Migration: 20260426000000_corpus_recaps.sql
-- Feature : 015-corpus-recaps
-- Purpose : Add page_captures table + extend recaps with mode column
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New table: page_captures
-- ---------------------------------------------------------------------

create table public.page_captures (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  book_id     uuid        not null references public.books(id) on delete cascade,
  page        integer     not null check (page >= 0),
  text        text        not null check (char_length(text) > 0 and char_length(text) <= 10000),
  word_count  integer     not null check (word_count >= 0),
  confidence  numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  captured_at timestamptz not null default now(),
  source      text        not null default 'ocr' check (source in ('ocr', 'manual', 'import')),

  unique (user_id, book_id, page)
);

comment on table  public.page_captures is
  'Per-page OCR captures owned by one user, scoped to one book. Page number is sourced from reading_progress.current_page at capture time, never from OCR.';
comment on column public.page_captures.page       is 'Manually-tracked page number from reading_progress.current_page; NEVER OCR-detected.';
comment on column public.page_captures.text       is 'OCR text (post user-edit). 1–10000 chars.';
comment on column public.page_captures.confidence is 'Self-rated by Gemini multimodal (0.0–1.0). UI shows low-confidence warning below 0.7.';
comment on column public.page_captures.source    is 'Reserved for future sources. Always ''ocr'' in v1.';

-- ---------------------------------------------------------------------
-- 2. Index for delta-range fetch (recap generation hot path)
-- ---------------------------------------------------------------------

create index idx_page_captures_user_book_page
  on public.page_captures (user_id, book_id, page);

-- ---------------------------------------------------------------------
-- 3. Row-Level Security
-- ---------------------------------------------------------------------

alter table public.page_captures enable row level security;

create policy "page_captures_select_own"
  on public.page_captures
  for select
  using (auth.uid() = user_id);

create policy "page_captures_insert_own"
  on public.page_captures
  for insert
  with check (auth.uid() = user_id);

create policy "page_captures_update_own"
  on public.page_captures
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "page_captures_delete_own"
  on public.page_captures
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. Extend recaps table with mode column
-- ---------------------------------------------------------------------

alter table public.recaps
  add column if not exists mode text not null default 'inferred'
    check (mode in ('corpus', 'inferred'));

comment on column public.recaps.mode is
  'Generation path: ''corpus'' = generated from page_captures text; ''inferred'' = generated from book metadata + progress percentage.';

-- ---------------------------------------------------------------------
-- 5. (Optional but recommended) Add progress_snapshot_page for fast
--    integer access on the recap delta-fetch hot path. Existing recaps
--    use a percentage field; computing the page number requires the
--    book's total_pages, which is an extra join. Storing it directly
--    avoids that.
-- ---------------------------------------------------------------------

alter table public.recaps
  add column if not exists progress_snapshot_page integer
    check (progress_snapshot_page is null or progress_snapshot_page >= 0);

comment on column public.recaps.progress_snapshot_page is
  'Absolute page number at recap time. Populated for all recaps from feature 015 onward. Historical rows retain NULL and are computed on-the-fly from progress_snapshot × books.total_pages.';

-- ---------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------
