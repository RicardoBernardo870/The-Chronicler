# Quickstart: Dashboard State Refactor Smoke Tests

**Feature**: 011-dashboard-state-refactor
**Target**: Manual QA on development build

## Prerequisites

- Logged-in test user with at least 3 in-progress books (mix of pages/progress).
- At least one completed book in history.
- At least one recorded reading session within the last 24h.

## US1 — Progress state leak fix

1. Ensure Book A is the hero (320/320 after you mark complete). Note progress bar = full.
2. From Book A's details (or wherever completion is triggered), mark Book A complete.
3. Return to Dashboard without reload.
4. **Expected**: Hero card now shows Book B (next in-progress). Progress bar fills to Book B's actual % (e.g., 9%). Page counter reads Book B's "X / Y".
5. **FAIL if**: Counter still reads "320 / 320" or progress bar is full.

## US2a — Up Next swap (no navigation)

1. On Dashboard, note current URL.
2. Tap any Up Next entry.
3. **Expected**: Hero card updates to that book. URL is unchanged. The previously-active book now appears in Up Next; the newly-active book is no longer listed there.

## US2b — View Book still navigates

1. On the now-active swapped book's hero card, click "View Book".
2. **Expected**: Router navigates to BookDetailsPage for that book.

## US2c — Completion promotion respects explicit swap

1. Swap hero to Book B (Book A remains "in progress" in the library).
2. From Book A's details page, mark Book A complete.
3. Return to Dashboard.
4. **Expected**: Hero is still Book B. Book A is no longer in Up Next. No unexpected hero change.

## US2d — Completion of current hero promotes next

1. Hero is Book B. Mark Book B complete (from its details or wherever).
2. Return to Dashboard.
3. **Expected**: Hero auto-promotes to the next in-progress book (e.g., Book C).

## US3a — VelocityBadge with no sessions

1. Add a fresh book with zero sessions. Swap it into hero.
2. **Expected**: VelocityBadge shows fallback chip ("—" or "Calculating…"). No "NaN".

## US3b — Sub-minute session

1. Record a session under 60 seconds for a book.
2. **Expected**: VelocityBadge for that book shows fallback. Refresh → still fallback.

## US3c — Normal session

1. Record a session ≥ 60s with ≥ 1 page delta.
2. **Expected**: VelocityBadge shows `"{int} pages/hr"`.

## US4a — Last Session card populated

1. After a real reading session, return to Dashboard.
2. **Expected**: Last Session card visible near "Your Reading". Shows: book title, recency phrase (e.g., "2 hours ago"), "{n} pages", VelocityBadge.

## US4b — Last Session card hidden when empty

1. Brand-new user with zero sessions.
2. **Expected**: No Last Session card rendered. No placeholder text.

## Regression — Rapid swap memory leak check

1. Open Vue devtools → Performance panel.
2. Tap 10 Up Next entries rapidly.
3. **Expected**: No growing watcher count, no console warnings about detached effect scopes.

## Regression — Cache reuse on swap

1. Swap to a book whose progress was previously loaded within SWR TTL.
2. **Expected**: Hero card renders immediately. No loading skeleton frame visible.

## Regression — Liquid-glass aesthetic

1. Visual diff the Dashboard against feature 010 reference screenshots.
2. **Expected**: Same card radius, glass backdrop, typography. New Last Session card matches the existing card family.
