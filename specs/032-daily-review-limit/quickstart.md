# Quickstart & Validation: Daily Review Limit & Backlog Smoothing

**Feature**: 032-daily-review-limit | **Date**: 2026-06-17

A run/validation guide proving the feature end-to-end. Implementation detail lives in `tasks.md` and the source.

## Prerequisites

- Deps installed (`npm install`); `.env` with Supabase vars.
- Migrations applied: **031** `20260617_lexicon_mastered.sql` (this feature builds on it) and **032** `20260618_lexicon_last_reviewed.sql`.
- A signed-in user with **far more than 20** vocabulary words due (e.g., simulate an absence so ~100+ are overdue), spanning a mix of Leitner boxes.

## Setup

```bash
npm install
# apply both migrations via your usual Supabase workflow (CLI push or MCP apply_migration)
npm run dev
```

## Validation scenarios

### V1 — No overwhelming pile (US1 / FR-001..FR-005)
1. With ~100+ words due, open the dashboard.
2. Expect the Word of the Day card to show an achievable count framed as the daily target (e.g. "20 left" / "X of 20"), **not** the full backlog (no "147").

### V2 — Daily tally actually caps the day (FR-013 / clarification)
1. Advance through 20 words on the Word of the Day card.
2. Expect the card to reach a **"caught up for today"** state after 20 — it does **not** keep handing you a 21st as part of the daily set.
3. Confirm a reviewed word does **not** reappear later the same day.

### V3 — Backlog rolls forward, non-destructive (FR-006 / SC-003)
1. After clearing today's 20, note that the remaining overdue words still exist.
2. Simulate the next local day (or use test data dated accordingly); expect a fresh set of up to 20 — the previously deferred words now surface, with their due dates unchanged.

### V4 — Shared set across surfaces (US2 / FR-003, SC-004)
1. With >20 due, open the Anki session; expect its deck drawn from the same capped today's-set (not the whole backlog).
2. Review some words in the session, return to the dashboard; expect the Word of the Day remaining-count to reflect those (consistent tally).

### V5 — Priority: most fragile first (US3 / FR-004)
1. With low- and high-box overdue words exceeding the limit, inspect today's set.
2. Expect lowest-box (most fragile) words selected first; ties broken by most overdue.
3. (031 still holds) within the Anki session, the selected words are presented highest-box-first.

### V6 — Fewer than the limit due (FR-007)
1. With fewer than 20 due, open the dashboard.
2. Expect the real sub-20 count and unchanged behavior.

### V7 — "Review more" escape hatch (US4 / FR-011)
1. Finish today's 20, then choose **"Review more"** (on the card or in the session).
2. Expect additional due words surfaced beyond the limit, in the same priority order.
3. With nothing left eligible at all, expect no "review more" (or an indication nothing remains).

### V8 — Mastered still excluded (FR-008, depends on 031)
1. Master a word in the Anki session.
2. Expect it absent from every review set and from the daily count, while visible (badge) in the Great Library.

### V9 — "Didn't know" counts once per day (Edge case)
1. Answer "Didn't know" on a word in the session.
2. Expect it to count toward today's tally and **not** reappear today; it becomes eligible again on a later day.

## Automated checks

```bash
npm test
npx vue-tsc -b
```

Targeted unit tests to add (see `tasks.md`):
- `reviewedTodayCount` / `dailyRemaining` from `lastReviewedAt` vs local midnight.
- `eligibleReviewWords` excludes mastered + reviewed-today and sorts lowest-box→most-overdue.
- `todaysReviewSet` caps at `dailyRemaining`; `activeReviewWords` ignores the cap when `reviewMore` is on.

## Definition of Done

- V1–V9 pass.
- `npm test` and `vue-tsc -b` green.
- Both migrations applied; reviewing a word stamps `last_reviewed_at`, the dashboard never shows the raw backlog, and the day caps at 20 (with "review more" to exceed on demand).
