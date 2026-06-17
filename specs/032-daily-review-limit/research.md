# Phase 0 Research: Daily Review Limit & Backlog Smoothing

**Feature**: 032-daily-review-limit | **Date**: 2026-06-17

No open `NEEDS CLARIFICATION` markers remained after `/speckit-clarify`. Decisions below are grounded in the existing review code and the resolved spec.

## R1 — How to count "reviews done today" (the per-day tally)

- **Decision**: Add a nullable `last_reviewed_at timestamptz` column to `lexicon_entries`, set on every review (advance / reset / master). Derive `reviewedTodayCount` = entries whose `last_reviewed_at` ≥ the reader's local midnight.
- **Rationale**: There is no existing per-day, per-account "reviews today" signal — `anki_review_sessions` only stores lifetime aggregates (`total_sessions`, `known/unknown_count`) and a single `last_reviewed_at` for the whole user, and `lexicon_entries.next_review_at` is the *future* due date (it can't reliably say a word was reviewed today; a box-1 advance and a yesterday-scheduled box-1 word can both land on the same date). A per-entry review timestamp answers both needs the spec has — the tally count **and** the "don't reshow a word reviewed today" exclusion — from one field, and is written in the same `UPDATE` the store already issues.
- **Alternatives considered**:
  - *localStorage day counter* — rejected: per-device, breaks the cross-device consistency assumption.
  - *A `daily_review_counts` table / counter on `anki_review_sessions`* — rejected: a counter alone still can't tell which specific words were reviewed today, so a just-failed (reset, still-due-today) word would reappear within the day. Per-entry timestamp solves both; a separate counter would be redundant.
  - *Inferring from `next_review_at`* — rejected: ambiguous (see above).

## R2 — Enforcing the cap so it actually bounds the day

- **Decision**: `dailyRemaining = max(0, 20 − reviewedTodayCount)`; `todaysReviewSet = eligibleReviewWords.slice(0, dailyRemaining)`. The set excludes words already reviewed today, so each review shrinks the remaining by one and the day ends at 20.
- **Rationale**: The clarification established that a naive "top-20 of currently-due" does **not** cap the day (a reviewed word leaves the due pool and the 21st slides in). Tying the cap to a per-day tally + reviewed-today exclusion makes the limit real and "X of 20" unambiguous (FR-013).
- **Alternatives considered**: Snapshotting 20 word-ids at day start (rejected at clarify — Option A/tally chosen); presentation-only cap (rejected — doesn't bound the day).

## R3 — Selection priority vs Anki deck ordering (interaction with 031)

- **Decision**: Selection of *which* words enter today's set = **lowest box first, then most overdue** (FR-004). The Anki session keeps 031's **highest-box-first** ordering, applied to that already-selected set. The Word of the Day card walks the set lowest-first.
- **Rationale**: These are different concerns — *selection* protects retention by admitting the most fragile words; *presentation order* in Anki concentrates the recall test / graduation on mature words. Both coexist without conflict.
- **Alternatives considered**: Forcing one global order (rejected — would either weaken selection or contradict 031's deck ordering).

## R4 — Shared "today's set" location

- **Decision**: Centralize selection in the lexicon store (computeds: `reviewedTodayCount`, `dailyRemaining`, `eligibleReviewWords`, `todaysReviewSet`, `activeReviewWords`, plus a `reviewMore` flag). Both the Word of the Day card and `useAnkiSession` consume it.
- **Rationale**: The store already owns the entries and the Word of the Day logic; one source of truth keeps the two surfaces consistent (FR-003) and the tally/cap in a single place. Avoids duplicating selection logic across `useLeitner` and `useAnkiSession`.
- **Alternatives considered**: A separate `useReviewQueue` composable (reasonable, but adds an abstraction for state the store already holds); per-surface selection (rejected — risks divergence).

## R5 — "Review more" escape hatch

- **Decision**: A store `reviewMore` flag (+ `enableReviewMore()`); when on, `activeReviewWords` ignores the `dailyRemaining` cap (still excludes mastered + reviewed-today). Either surface can enable it; both reflect it; it resets on a new local day / fresh load. The Anki session still presents ≤ 20 at a time.
- **Rationale**: Satisfies FR-011 (limit is a default target, not a hard wall) with minimal surface area and consistent behavior across the card and the session.
- **Alternatives considered**: Per-surface independent "review more" (rejected — inconsistent counts between surfaces).

## R6 — Local-day boundary

- **Decision**: Compare `last_reviewed_at` and `next_review_at` against the reader's **local** midnight (client-side, using the device timezone), consistent with how the existing store already derives "today" (`new Date().toISOString().slice(0,10)` / local Date math).
- **Rationale**: Review scheduling is entirely client-side; using local day matches reader expectation ("a new day, a fresh 20") and the existing code's conventions.
- **Alternatives considered**: UTC day (rejected — would roll over at a confusing local time).
