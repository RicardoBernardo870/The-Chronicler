# Data Model — Reader Profile Page

This feature introduces **two new tables** and **one column extension** to an existing table. All other Profile-page data is derived client-side from existing stores (FR-006).

## 1. New table: `public.reading_dna`

One row per user. Replaced on regeneration.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK → `auth.users(id) on delete cascade` | One DNA per user. |
| `personality` | `text` | not null, length 50–800 | 2-3 sentence narrative voice. |
| `mood_tone` | `text` | not null, length 1–40 | Single descriptor (e.g. "contemplative"). |
| `mood_emojis` | `text[]` | not null, length 1–5 | Compact mood signature glyphs. |
| `suggestions` | `jsonb` | not null | Array of `{ title: string, author: string, reason: string }`, length 3–5. |
| `books_finished_at_generation` | `int` | not null, ≥ 0 | Snapshot of `count(completedBooks)` at generation time — used by client to compute the "3 more books" threshold. |
| `generated_at` | `timestamptz` | not null, default `now()` | Used by client for the 90-day threshold. |

**Indexes**: PK on `user_id` is sufficient (single-row reads).

**RLS**: `using (auth.uid() = user_id)` for select/update; `with check (auth.uid() = user_id)` for insert.

**State transitions**:
- *None exists* → INSERT on first crossing of `≥ 3 books finished`.
- *Exists* → UPDATE (replace all columns) when user crosses `+3 books finished` OR `90 days since generated_at`.
- *Failure during regeneration* → row is NOT modified; previous DNA preserved (FR-014).

## 2. New table: `public.vocabulary_extractions`

One row per extraction *attempt* (per page-capture). Used as an idempotency ledger so a re-captured page doesn't double-extract.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | not null, FK → `auth.users(id) on delete cascade` | |
| `capture_id` | `uuid` | not null, FK → `public.page_captures(id) on delete cascade` | One ledger row per capture. |
| `book_id` | `uuid` | not null, FK → `public.books(id) on delete cascade` | Denormalized for query convenience. |
| `page` | `int` | not null, ≥ 0 | Snapshot of capture page. |
| `words_added` | `int` | not null, default 0, ≤ 5 | How many entries actually inserted into `lexicon_entries`. |
| `status` | `text` | not null, check `status in ('pending','succeeded','failed','skipped')` | `skipped` = OCR text empty or all candidates duplicates. |
| `error_message` | `text` | nullable | Captured for telemetry only; never surfaced to user (FR-021). |
| `created_at` | `timestamptz` | not null, default `now()` | |

**Indexes**:
- Unique `(capture_id)` — enforces "one extraction per capture" (idempotency for re-captures of the same page-version).
- B-tree on `(user_id, created_at desc)` — fast "latest extractions" lookup.

**RLS**: `using (auth.uid() = user_id)` for all operations.

**State transitions**:
- INSERT with `status='pending'` at edge-function entry.
- UPDATE to `'succeeded'` (with `words_added`) on success.
- UPDATE to `'failed'` (with `error_message`) on AI/network error.
- UPDATE to `'skipped'` when AI returns 0 candidates or all candidates dedupe.

## 3. Extended table: `public.lexicon_entries`

Add one column. No data migration required (default backfills existing rows to `'manual'`).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `source` | `text` | not null, default `'manual'`, check `source in ('manual','auto')` | NEW. `'auto'` = inserted by `extract-vocabulary` edge function. |

**Existing columns satisfying FR-022a (source attribution to user)**:
- `book_id` — already FK to `books`. Used for "from *Title*".
- `page_found` — already exists. Used for "p. 143".
- `context_sentence` — already exists. Used to render the in-passage anchor in Lexicon detail view.
- `definition` — already exists. The in-context definition from FR-017 lives here.

**No other lexicon_entries changes**. `entry_type` stays `'dictionary' | 'lore'`; auto-extracted entries always use `'dictionary'` (Decision 10 in research.md).

## 4. TypeScript shapes (added to `src/types/index.ts`)

```ts
// Reading DNA
export interface BookSuggestion {
  title: string
  author: string
  reason: string                       // one-sentence
}

export interface MoodSignature {
  tone: string                         // 1–40 chars
  emojis: string[]                     // 1–5 entries
}

export interface ReadingDna {
  userId: string
  personality: string                  // 50–800 chars
  moodSignature: MoodSignature
  suggestions: BookSuggestion[]        // 3–5
  booksFinishedAtGeneration: number
  generatedAt: string                  // ISO timestamp
}

export interface ReadingDnaRow {
  user_id: string
  personality: string
  mood_tone: string
  mood_emojis: string[]
  suggestions: { title: string; author: string; reason: string }[]
  books_finished_at_generation: number
  generated_at: string
}

export const mapReadingDna = (row: ReadingDnaRow): ReadingDna => ({
  userId: row.user_id,
  personality: row.personality,
  moodSignature: { tone: row.mood_tone, emojis: row.mood_emojis },
  suggestions: row.suggestions,
  booksFinishedAtGeneration: row.books_finished_at_generation,
  generatedAt: row.generated_at,
})

// Vocabulary extraction (ledger only — words live in lexicon_entries)
export type VocabularyExtractionStatus = 'pending' | 'succeeded' | 'failed' | 'skipped'

export interface VocabularyExtraction {
  id: string
  captureId: string
  bookId: string
  page: number
  wordsAdded: number
  status: VocabularyExtractionStatus
  createdAt: string
}

// Extension to existing LexiconEntry interface
export type LexiconEntrySource = 'manual' | 'auto'
// Add `source: LexiconEntrySource` to LexiconEntry + `source: LexiconEntrySource` (snake_case `source`) to LexiconEntryRow.
```

## 5. Migration file

Single migration `supabase/migrations/20260428_reader_profile.sql`:

```sql
-- ============================================================================
-- 016 Reader Profile Page — Reading DNA + Auto-Vocabulary Extraction
-- ============================================================================

-- 1. lexicon_entries.source extension
alter table public.lexicon_entries
  add column if not exists source text not null default 'manual'
  check (source in ('manual','auto'));

comment on column public.lexicon_entries.source is
  '''manual'' = user-added; ''auto'' = inserted by extract-vocabulary edge function';

-- 2. reading_dna
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

alter table public.reading_dna enable row level security;
create policy reading_dna_select on public.reading_dna for select using (auth.uid() = user_id);
create policy reading_dna_insert on public.reading_dna for insert with check (auth.uid() = user_id);
create policy reading_dna_update on public.reading_dna for update using (auth.uid() = user_id);

-- 3. vocabulary_extractions ledger
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

create index vocabulary_extractions_user_recent_idx
  on public.vocabulary_extractions (user_id, created_at desc);

alter table public.vocabulary_extractions enable row level security;
create policy vocabulary_extractions_select on public.vocabulary_extractions for select using (auth.uid() = user_id);
create policy vocabulary_extractions_insert on public.vocabulary_extractions for insert with check (auth.uid() = user_id);
create policy vocabulary_extractions_update on public.vocabulary_extractions for update using (auth.uid() = user_id);
```

## 6. Derived (non-persisted) view models

These are computed client-side and NOT part of the schema:

| Composable | Output Shape | Source |
|---|---|---|
| `useReadingProfile()` | `{ booksFinished, booksInProgress, totalPagesRead, totalReadingHours, allTimeVelocityPph, currentStreak, longestStreak }` | `progressStore.completedBooks`, `progressStore.inProgressBooks`, `progress_history` |
| `useTopThemes()` | `{ term: string, weight: number }[]` (top 30) | `recapsStore.recaps`, `loreCardsStore.cards` |
| `useLibraryBreakdown()` | `{ genres: { name, count }[], uniqueAuthors: number, paceComparison: { bookId, bookTitle, paceLabel }[] }` | `booksStore.books`, `progress_history` |
