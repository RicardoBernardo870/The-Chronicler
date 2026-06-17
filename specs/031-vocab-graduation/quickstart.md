# Quickstart & Validation: Vocabulary Review Progress & Word Graduation

**Feature**: 031-vocab-graduation | **Date**: 2026-06-17

A run/validation guide proving the feature end-to-end. Implementation detail lives in `tasks.md` and the source.

## Prerequisites

- Deps installed (`npm install`); `.env` with Supabase vars.
- Migration `supabase/migrations/20260617_lexicon_mastered.sql` applied to the target Supabase project (adds `lexicon_entries.mastered`).
- A signed-in user with several vocabulary words across different Leitner boxes, including some **due today**.

## Setup

```bash
npm install
# apply the new migration via your usual Supabase workflow (CLI push or MCP apply_migration)
npm run dev
```

## Validation scenarios

### V1 — Remaining-count on the Word of the Day card (FR-001..FR-004)
1. With N words due today, open the dashboard. Expect the Word of the Day card (single-word state) to show a remaining-count reflecting due-today words.
2. Tap the advance arrow repeatedly. Expect the count to decrease by one each tap as the next due word appears.
3. After the last due word, expect the "All caught up" state with **no** count shown.
4. Open the dashboard when already caught up → no count in the preview state.

### V2 — Anki position indicator (FR-005)
1. With ≥5 due words, open the flashcard session from the dashboard CTA.
2. Expect the header to read a human position, e.g. "1 / 15" on the first card and "15 / 15" on the last (not "0 / 15").

### V3 — Graduation via Anki "Knew it" (FR-006..FR-009, FR-013)
1. In the flashcard session, on any card (any box), tap "Knew it".
2. Expect that word to become Mastered: it no longer appears in the Word of the Day card, the flashcard session, or any due count.
3. Confirm in the DB: `select mastered from lexicon_entries where id = …` is `true`.

### V4 — Box independence (FR-007)
1. Pick a word known to be in a **low** box (e.g. box 1 or 2) that is due.
2. Review it in the flashcard session and tap "Knew it".
3. Expect it to be Mastered immediately despite the low box.

### V5 — Word of the Day never masters (FR-008)
1. Advance a word all the way via the Word of the Day arrow until it reaches box 5.
2. Expect it to keep recurring on schedule and **never** become Mastered from the card.

### V6 — "Didn't know" unchanged (FR-012)
1. In the flashcard session, tap "Didn't know" on a non-mastered word.
2. Expect it reset to box 1 and due again today (not mastered, not deleted).

### V7 — Anki deck orders later boxes first (FR-010 / US3)
1. With due words across low and high boxes, open the flashcard session.
2. Expect higher-box (more mature) words to be presented before lower-box ones.

### V8 — Mastered words in the Great Library (FR-011)
1. Open the Great Library. Expect mastered words to appear **inline** in the default list, each with a "Mastered" badge, and their "I know this / Review again" actions hidden.
2. Confirm mastered words remain searchable/filterable by book.

### V9 — No reward on mastery (FR-016)
1. Note XP / reader level / Book-Passport vocabulary count before mastering.
2. Master a word in the flashcard session.
3. Expect **no** change to XP, level, or vocabulary-count stats.

## Automated checks

```bash
npm test
npx vue-tsc -b   # typecheck (no `lint` script in this project)
```

Targeted unit tests to add (see `tasks.md`):
- `getDueWord` excludes mastered words.
- `useAnkiSession` `dueCards` excludes mastered and orders highest-box first; `onKnew` masters (not advances).
- `dueTodayCount` counts only non-mastered due-today entries.

## Definition of Done

- V1–V9 pass.
- `npm test` and `vue-tsc -b` are green.
- Migration applied; a mastered word has `mastered = true` and is absent from every review surface while visible (badged) in the Great Library.
