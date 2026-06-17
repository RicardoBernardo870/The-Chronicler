# Phase 1 Data Model: Vocabulary Review Progress & Word Graduation

**Feature**: 031-vocab-graduation | **Date**: 2026-06-17

## 1. Persisted schema change

### `lexicon_entries` (existing table — one additive column)

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `mastered` | `boolean` | NO | `false` | **NEW.** Terminal "learned" flag. Set `true` only by mastering a word in the Anki session. Constant default → metadata-only `ADD COLUMN` (no rewrite). |

All existing columns (`id`, `user_id`, `book_id`, `term`, `definition`, `entry_type`, `context_sentence`, `page_found`, `leitner_box`, `next_review_at`, `created_at`, `source`) are unchanged. Existing owner RLS on `lexicon_entries` governs the new column — **no policy change**. **No index** (review filtering is client-side; the Great Library list does not filter on `mastered`).

### Migration `supabase/migrations/20260617_lexicon_mastered.sql`

- `alter table public.lexicon_entries add column if not exists mastered boolean not null default false;`
- Idempotent, forward-only, no data backfill needed (default applies to existing rows → all start non-mastered, FR-015).

> Supabase best-practice notes: `NOT NULL` + constant default keeps the lock metadata-only (`lock-`); no index on an un-queried column (`query-`/`schema-`); existing RLS reused (`security-`).

## 2. TypeScript type changes (`src/types/index.ts`)

| Type | Change |
|------|--------|
| `LexiconEntry` | add `mastered: boolean` |
| `LexiconEntryRow` | add `mastered: boolean` (DB row shape) |
| `mapLexiconEntry(row)` | map `mastered: row.mastered ?? false` |
| `LexiconSearchResult` | inherits `mastered` automatically (extends `LexiconEntry`); `mapSearchResult` already spreads `mapLexiconEntry` |

## 3. State model — Vocabulary Word (Lexicon Entry)

```text
                 ┌────────────────────────────────────────────┐
   add word →    │  In review (mastered = false)              │
                 │   leitner_box ∈ 1..5, next_review_at set   │
                 └────────────────────────────────────────────┘
       Word of the Day arrow / Great Library "I know this":
            advance box (max 5), push next_review_at        → stays in review
       Anki "Didn't know":
            reset to box 1, due today                       → stays in review
       Anki "Knew it" (ANY box):
            mastered = true                                 → ▼
                 ┌────────────────────────────────────────────┐
                 │  Mastered (mastered = true) — TERMINAL      │
                 │   excluded from getDueWord + dueCards +     │
                 │   all due counts; shown in Great Library    │
                 │   with a "Mastered" badge; never recurs     │
                 └────────────────────────────────────────────┘
```

- **Only** the Anki "Knew it" path sets `mastered = true` (FR-007).
- No transition deletes a word (FR-014). Un-mastering is out of scope.
- `leitner_box` / `next_review_at` of a mastered word are frozen and irrelevant (never re-scheduled).

## 4. Derived data (not persisted)

- **`dueTodayCount`** (lexicon store computed): number of entries where `mastered === false` **and** `nextReviewAt <= today`. Drives the Word of the Day remaining-count; recomputes as words are advanced out of "due today" or mastered.
- **Word of the Day pick** (`getDueWord`): lowest-box, earliest-due **non-mastered** due word.
- **Anki deck** (`dueCards`): non-mastered due words, **ordered highest-box first**, capped at 20.

## 5. Validation / invariants

- `mastered` is never `null` (DB `NOT NULL`).
- A mastered entry MUST NOT appear in `getDueWord`, `dueCards`, or `dueTodayCount`.
- Mastering MUST NOT modify XP, Book-Passport `vocabulary_count`, or any other stat (FR-016).
- The Word of the Day arrow and Great Library "I know this" MUST NOT set `mastered` (advance only).
