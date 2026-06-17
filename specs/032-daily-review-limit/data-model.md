# Phase 1 Data Model: Daily Review Limit & Backlog Smoothing

**Feature**: 032-daily-review-limit | **Date**: 2026-06-17

## 1. Persisted schema change

### `lexicon_entries` (existing table — one additive column)

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `last_reviewed_at` | `timestamptz` | YES | **NEW.** Set to "now" whenever the word is reviewed (Word of the Day advance, or Anki "Knew it"/"Didn't know"/master). Null = never reviewed. Powers the per-day tally and the "don't reshow today" exclusion. |

All other columns unchanged (including `mastered` from 031). Existing owner RLS governs the new column — **no policy change**. **No index** (the tally and selection are computed client-side over the user's already-loaded entries).

### Migration `supabase/migrations/20260618_lexicon_last_reviewed.sql`

- `alter table public.lexicon_entries add column if not exists last_reviewed_at timestamptz;`
- Idempotent, forward-only. Nullable, no default → metadata-only add; existing rows are `null` (treated as "not reviewed today").

> Supabase best-practice notes: nullable column → metadata-only lock (`lock-`); no index on a client-filtered column (`query-`/`schema-`); existing RLS reused (`security-`).

## 2. TypeScript type changes (`src/types/index.ts`)

| Type | Change |
|------|--------|
| `LexiconEntry` | add `lastReviewedAt: string \| null` |
| `LexiconEntryRow` | add `last_reviewed_at: string \| null` |
| `mapLexiconEntry(row)` | map `lastReviewedAt: row.last_reviewed_at ?? null` |
| `LexiconSearchResult` | inherits automatically (extends `LexiconEntry`) |

## 3. Derived state (lexicon store — not persisted)

Local `today` = device-local midnight.

| Name | Definition |
|------|------------|
| `DAILY_REVIEW_LIMIT` | constant `20` |
| `reviewedTodayCount` | count of entries whose `lastReviewedAt` ≥ local midnight |
| `dailyRemaining` | `max(0, DAILY_REVIEW_LIMIT − reviewedTodayCount)` |
| `eligibleReviewWords` | entries that are **due** (`nextReviewAt ≤ today`) **and** `!mastered` **and** not reviewed today, sorted by `leitnerBox` asc, then `nextReviewAt` asc (lowest box → most overdue) |
| `todaysReviewSet` | `eligibleReviewWords.slice(0, dailyRemaining)` |
| `reviewMore` | boolean flag (default false); set via `enableReviewMore()`; resets on new local day / reload |
| `activeReviewWords` | `reviewMore ? eligibleReviewWords : todaysReviewSet` |
| `extraAvailable` | `eligibleReviewWords.length > todaysReviewSet.length` (is there anything behind the cap?) |

Consumers:
- **Word of the Day**: picks `activeReviewWords[0]`; remaining-count = `activeReviewWords.length`; "caught up for today" (with "review more") when `todaysReviewSet` is empty but `extraAvailable`; "all caught up" when no eligible words at all.
- **Anki session** (`dueCards`): `activeReviewWords` re-ordered **highest box first** (031), `slice(0, 20)`.

## 4. Review-action effects (state transitions)

Every review action now also stamps `last_reviewed_at = now` (in the same optimistic update + `UPDATE`):

| Action | Surface | Effect |
|--------|---------|--------|
| Advance | Word of the Day arrow; (Great Library card buttons were removed in 031) | box +1 (max 5), `next_review_at` pushed out, `last_reviewed_at = now` → leaves today's eligible set, tally +1 |
| Didn't know (reset) | Anki | box → 1, `next_review_at = today`, `last_reviewed_at = now` → excluded from today's eligible (reviewed today), tally +1; eligible again tomorrow |
| Knew it (master) | Anki | `mastered = true`, `last_reviewed_at = now` → excluded permanently (mastered) + counts toward today's tally |

No action alters another word's schedule; overflow words keep their `next_review_at` (FR-006).

## 5. Validation / invariants

- `reviewedTodayCount` and the cap are derived only — never persisted as a counter.
- `todaysReviewSet.length ≤ dailyRemaining ≤ 20`.
- A word with `lastReviewedAt` within the local day MUST NOT appear in `eligibleReviewWords` (no same-day repeat).
- Mastered words MUST NOT appear in any review set (031).
- The Word of the Day card and the Anki session MUST derive from the same `activeReviewWords` (consistency).
- Enabling `reviewMore` MUST NOT change any word's `next_review_at`.
