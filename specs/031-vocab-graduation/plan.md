# Implementation Plan: Vocabulary Review Progress & Word Graduation

**Branch**: `031-vocab-graduation` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-vocab-graduation/spec.md`

## Summary

Two changes to the vocabulary/Leitner review loop:
1. **Progress visibility** — show a live remaining-count of words still due on the Word of the Day card (single-word state only), and fix the Anki session's position indicator to read as a human "X of N".
2. **Graduation** — add a terminal **Mastered** state to a lexicon word. Answering **"Knew it" in the Anki flashcard session masters the word regardless of its Leitner box**; mastered words are excluded from both review queues (`getDueWord` for the Word of the Day card, `dueCards` for the Anki session) but stay inline in the Great Library with a "Mastered" badge. The Word of the Day arrow keeps advancing boxes and never masters; "Didn't know" still resets to box 1. The Anki deck is reordered later-box-first. Mastery is a pure state change — no XP/rewards.

The only backend change is one additive boolean column on `lexicon_entries`.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2 (existing). No new packages.

**Storage**: Supabase PostgreSQL — `lexicon_entries` extended with one `mastered boolean not null default false` column. No new tables, no new indexes.

**Testing**: Vitest (`npm test`); typecheck via `vue-tsc -b` (project has no `lint` script).

**Target Platform**: Installable PWA, mobile-first.

**Project Type**: Web application (Vue front end + Supabase BaaS). Review scheduling is client-side (the lexicon store holds the user's entries and filters them in JS); the Great Library list is a server-side paginated query.

**Performance Goals**: No new network round-trips on the hot path; mastering reuses the store's existing optimistic-update + rollback pattern (one `UPDATE`).

**Constraints**: PrimeVue-first / small components (Principle VI); optimistic writes confirmed before UI relies on them (Principle IV). Mastery must not touch XP/Book-Passport systems (FR-016).

**Scale/Scope**: 1 migration; type + mapper extension; 2 composable edits; 1 store action + 1 computed; 3 component edits. No inflow/curation work (out of scope).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Memory Continuity** | N/A — no recap/spoiler surface touched. ✅ |
| **II. Physical-to-Digital Bridge** | N/A — no ISBN/metadata path. ✅ |
| **III. AI-First Recap Engine** | N/A — vocabulary extraction/edge functions untouched (inflow is out of scope). ✅ |
| **IV. Data Integrity & Sync** | Mastering writes through Supabase via the store's existing optimistic-apply + server-confirm + rollback pattern (mirrors `updateLeitner`). The new column is owned data under existing RLS. ✅ |
| **V. PWA-First & Frictionless** | No new routes or bundles; pure in-place edits to existing dashboard/review/lexicon surfaces. ✅ |
| **VI. Component Architecture & UI Standards** | Small, single-responsibility edits. The remaining-count and "Mastered" badge are tiny presentational additions. `LexiconCard` already uses a local pill-badge convention (`lc-badge`) rather than PrimeVue `Tag`; the Mastered badge follows that **existing local pattern** for visual consistency (documented deviation; no new component warranted). ✅ |

**Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/031-vocab-graduation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── internal-interfaces.md   # Phase 1 output (store/composable/UI contracts)
├── checklists/
│   └── requirements.md  # From /speckit-specify + /speckit-clarify
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── composables/
│   ├── useLeitner.ts          # MOD — getDueWord excludes mastered words
│   └── useAnkiSession.ts      # MOD — dueCards excludes mastered + orders later-box-first;
│                              #       onKnew masters (not advance); onDidntKnow unchanged
├── stores/
│   └── lexicon.ts             # MOD — new masterWord() action; dueTodayCount computed;
│                              #       WotD re-pick already excludes mastered via getDueWord
├── components/
│   ├── dashboard/
│   │   └── WordOfTheDay.vue   # MOD — remaining-count badge in the single-word state only
│   └── lexicon/
│       └── LexiconCard.vue    # MOD — "Mastered" badge (advance/reset buttons already removed)
├── pages/
│   └── AnkiReviewPage.vue     # MOD — 1-based "X of N" position indicator
└── types/
    └── index.ts               # MOD — LexiconEntry/Row + `mastered`; mapLexiconEntry

supabase/
└── migrations/
    └── 20260617_lexicon_mastered.sql   # NEW — add mastered column
```

**Structure Decision**: In-place edits to the existing vocabulary stack; no new pages, routes, or stores. All review-queue filtering stays where it already lives (`useLeitner`, `useAnkiSession`, lexicon store), so the change surface is minimal and localized.

## Key Design Decisions

1. **Terminal state = one boolean column.** `mastered boolean not null default false` on `lexicon_entries`. A boolean (not a nullable timestamp) is enough — the spec's badge needs no "mastered on" date, and FR-016 forbids stat tracking. Adding a `NOT NULL` column **with a constant default** is a metadata-only change in modern Postgres (no table rewrite), existing owner RLS covers it, and no index is needed because review filtering is client-side and the Great Library list doesn't filter on it (Supabase best practices: don't add an unused index).

2. **Graduation lives in the Anki session only.** `useAnkiSession.onKnew` switches from `updateLeitner('advance')` to a new `lexiconStore.masterWord(id)`. Box is irrelevant (FR-007). `onDidntKnow` keeps `updateLeitner('reset')`. The Word of the Day arrow (`updateLeitner('advance')`) and the Great Library card's "I know this" (advance) are untouched — they only promote, never master, preserving the asymmetry the spec requires.

3. **`masterWord` mirrors `updateLeitner`.** Same optimistic-apply → `UPDATE lexicon_entries set mastered = true` → touch caches → rollback-on-error flow, and the same "if this was the current Word of the Day, clear the daily cache and re-resolve" step so the card advances to the next due word immediately.

4. **Queue exclusion at the source.** `getDueWord` (drives WotD) and `dueCards` (drives Anki) both add a `!mastered` filter, so mastered words vanish from every review surface and every due count automatically (FR-009, FR-013). `dueCards` sort flips to **descending box** (later boxes first, FR-010/US3); `getDueWord` keeps its ascending order for the WotD walk-through.

5. **Remaining-count is derived, not stored.** A `dueTodayCount` computed (non-mastered entries with `nextReviewAt <= today`) feeds the WotD badge; it recomputes as advancing pushes words out of "due today," so it counts down to "All caught up." Shown only in the single-word state — hidden in the preview/"all caught up" and Anki-CTA states (FR-004).

6. **Mastered words in the Great Library.** `mapLexiconEntry` carries `mastered` through to `LexiconSearchResult` (the search already selects `*`), so no query change. `LexiconCard` shows a "Mastered" pill. (Its "I know this / Review again" buttons were removed entirely — review now happens only on the Word of the Day card and the Anki session — so there are no per-card review actions to hide.)

## Complexity Tracking

> No constitution violations — section intentionally empty.
