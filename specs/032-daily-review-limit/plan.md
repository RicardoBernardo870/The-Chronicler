# Implementation Plan: Daily Review Limit & Backlog Smoothing

**Branch**: `032-daily-review-limit` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-daily-review-limit/spec.md`

## Summary

Bound the daily vocabulary-review workload to **20 words/day** so a reader returning after an absence is never confronted with the full overdue backlog. A shared, derived **"today's review set"** feeds both the Word of the Day card and the Anki session: it contains the highest-priority due, non-mastered words **not yet reviewed today**, capped at `20 − (words reviewed today)`. The limit is enforced as a **per-day tally** (each review counts 1; reviewed words don't recur the same day), selection prioritizes **lowest box first, then most overdue**, overflow stays due and rolls into later days (non-destructive — due dates are not altered), and a **"review more"** affordance lets motivated readers continue past 20.

The only new state is a per-entry `last_reviewed_at` timestamp on `lexicon_entries` — it both powers the tally (count reviewed today) and prevents a reviewed word from reappearing the same day. Builds directly on **031-vocab-graduation** (mastered exclusion), whose changes are already on this branch.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2 (existing). No new packages.

**Storage**: Supabase PostgreSQL — `lexicon_entries` extended with one `last_reviewed_at timestamptz` column (nullable). No new tables, no new indexes.

**Testing**: Vitest (`npm test`); typecheck via `vue-tsc -b`.

**Target Platform**: Installable PWA, mobile-first.

**Project Type**: Web application (Vue front end + Supabase BaaS). Review scheduling/selection is client-side (the lexicon store holds the user's entries and derives the review set in JS).

**Performance Goals**: No new network round-trips on the hot path — `last_reviewed_at` is written in the same `UPDATE` that already records a review (advance/reset/master); the daily set is a client-side computed.

**Constraints**: Non-destructive soft cap (must not change `next_review_at`); per-account tally consistent across devices (server-persisted timestamp, not localStorage); local-day boundary; PrimeVue-first UI (Principle VI).

**Scale/Scope**: 1 migration; type + mapper extension; lexicon-store selection logic (the bulk); 2 composable touch-ups; 2 component edits (count + "review more"). Stacks on 031's queue builders.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Memory Continuity** | N/A — no recap/spoiler surface. ✅ |
| **II. Physical-to-Digital Bridge** | N/A — no ISBN/metadata path. ✅ |
| **III. AI-First Recap Engine** | N/A — extraction/edge functions untouched (inflow out of scope). ✅ |
| **IV. Data Integrity & Sync** | `last_reviewed_at` is written through the store's existing optimistic-apply + server-confirm + rollback path (same `UPDATE` as the review). The tally is derived from per-account server state, so it is consistent across devices/reloads. No schedule data is mutated. ✅ |
| **V. PWA-First & Frictionless** | No new routes/bundles; in-place edits to the dashboard card, the review composable, and the Anki page. ✅ |
| **VI. Component Architecture & UI Standards** | The remaining-count and "review more" are small presentational additions using PrimeVue primitives; selection logic lives in the store, not components. ✅ |

**Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/032-daily-review-limit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── internal-interfaces.md
├── checklists/
│   └── requirements.md  # From /speckit-specify + /speckit-clarify
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── stores/
│   └── lexicon.ts             # MOD — last_reviewed_at written on review; new derived
│                              #   reviewedTodayCount / dailyRemaining / eligibleReviewWords /
│                              #   todaysReviewSet / activeReviewWords + reviewMore flag;
│                              #   resolveWordOfTheDay + the WotD count consume today's set
├── composables/
│   ├── useLeitner.ts          # MOD (minor) — advanceBox/resetBox unchanged; getDueWord
│   │                          #   superseded by the store's today's-set selection
│   └── useAnkiSession.ts      # MOD — dueCards drawn from the store's today's-set (ordered
│                              #   highest-box-first per 031); honors reviewMore
├── components/
│   └── dashboard/
│       └── WordOfTheDay.vue   # MOD — count = today's remaining (X of 20); "caught up for
│                              #   today / review more" state distinct from "all caught up"
├── pages/
│   └── AnkiReviewPage.vue     # MOD — "review more" affordance when today's set is done
└── types/
    └── index.ts               # MOD — LexiconEntry/Row + lastReviewedAt; mapLexiconEntry

supabase/
└── migrations/
    └── 20260618_lexicon_last_reviewed.sql   # NEW — add last_reviewed_at column
```

**Structure Decision**: Centralize the daily-set selection in the lexicon store (it already owns the entries and the Word of the Day logic), and have both surfaces consume it. This keeps a single source of truth for the cap, the tally, and the "review more" toggle, and keeps the two review surfaces consistent (FR-003).

## Key Design Decisions

1. **`last_reviewed_at` per entry is the tally's backbone.** A nullable `timestamptz` set on every review (advance / reset / master). It answers both questions the spec needs: *how many were reviewed today* (count entries whose `last_reviewed_at` is within the local day) and *which words must not reappear today* (exclude those). It is set in the same `UPDATE` the store already issues for a review, so no extra round-trip. Stored server-side → per-account, cross-device consistent (vs localStorage). Metadata-only nullable column add (Supabase best practices), existing RLS, no index (filtering is client-side).

2. **Today's set is derived, capped, and shared.** New store computeds:
   - `reviewedTodayCount` = entries with `last_reviewed_at` ≥ local midnight.
   - `dailyRemaining` = `max(0, 20 − reviewedTodayCount)`.
   - `eligibleReviewWords` = due (`next_review_at ≤ today`) **and** not mastered **and** not reviewed today, sorted **lowest box first, then most overdue** (FR-004).
   - `todaysReviewSet` = `eligibleReviewWords.slice(0, dailyRemaining)`.
   - `activeReviewWords` = `reviewMore ? eligibleReviewWords : todaysReviewSet`.
   Both surfaces read `activeReviewWords`; the WotD remaining-count = its length (FR-005), and the day naturally ends when `dailyRemaining` hits 0 (FR-012/FR-013).

3. **Selection priority vs presentation order are separate.** 032 selects *which* words enter the 20 by **lowest box first** (most fragile, FR-004). 031 already orders the Anki *deck* **highest box first** (mature-first for graduation). Both hold: the store selects the set lowest-first; `useAnkiSession.dueCards` re-orders that same set highest-first for the session. The Word of the Day card walks the set in its natural lowest-first order.

4. **"Review more" is a store-level flag.** `reviewMore` (ref) + `enableReviewMore()`; when on, `activeReviewWords` ignores the `dailyRemaining` cap (still excludes mastered + reviewed-today). Either surface can enable it; both then reflect it. Resets on a new local day / fresh load. The Anki session still presents at most 20 at a time.

5. **Non-destructive.** Nothing changes `next_review_at`. Overflow words remain due; as today's reviewed words advance out and the day rolls over, the next day's `eligibleReviewWords` naturally surfaces the next 20 — the backlog drains ~20/day (FR-006, SC-003).

6. **Builds on 031.** `getDueWord`/`dueCards`/`dueTodayCount` already exclude mastered. 032 layers the cap + tally + reviewed-today exclusion on top; `dueTodayCount` (031's raw due count) is superseded for display by `todaysReviewSet.length`.

## Complexity Tracking

> No constitution violations — section intentionally empty.
