# Quickstart: Dashboard UX & Lore Sync

**Feature**: 010-dashboard-ux-sync  
**Date**: 2026-04-20

## Prerequisites

- Dev server running: `npm run dev`
- At least one book added with reading progress > 0%
- At least one prior recap generated for that book (to test lock state)
- A second lore card not yet generated (to test reactive arrival)

---

## Smoke Test 1 — View Book Navigation

**Goal**: "View Book" button takes user directly to Book Details.

1. Open Dashboard (`/`).
2. Locate the "Your Reading" hero card.
3. Verify the button label reads **"View Book"** (not "View Library").
4. Tap "View Book".
5. **Expected**: Navigated to `/books/:id` — the Book Details page for the hero book.

---

## Smoke Test 2 — Recap Lock Gate (locked state)

**Goal**: Lock gate shows correctly when conditions are not met.

1. Ensure the last recap was generated less than 3 days ago AND current page is less than `lastRecapPct + 5%` of total pages.
2. Open Dashboard.
3. Locate the recap button in the "Your Reading" hero card.
4. **Expected**: Button is **disabled** and displays `🔒 X more pages` (where X is pages until unlock).
5. Hover/tooltip should read: "You unlock a new recap every 5% of progress, or after 3 days away".

---

## Smoke Test 3 — Recap Lock Gate (unlocked by pages)

**Goal**: Lock releases when enough pages are read.

1. Advance reading progress past the unlock threshold (`lastRecapPct + 5%`).
2. Return to Dashboard.
3. **Expected**: "Get Recap" button is **enabled** (no lock icon).

---

## Smoke Test 4 — Inline Recap Streaming

**Goal**: Recap streams inline, no navigation.

1. With the recap unlocked, tap "Get Recap" on the Dashboard.
2. **Expected**: The recap stream panel appears **below the "Your Reading" card** — user remains on the Dashboard.
3. Stream completes (Memory Jogger, Concept Watchlist, Thematic Bridge visible).
4. Navigate to Recap History for the book.
5. **Expected**: The just-generated recap appears in history.

---

## Smoke Test 5 — Mid-Stream Dismiss (abort)

**Goal**: Dismiss during streaming aborts cleanly and saves no partial data.

1. Tap "Get Recap" on the Dashboard; wait 1–2 seconds for stream to start.
2. Tap the dismiss ("✕") button while the stream is still in progress.
3. **Expected**: Stream panel disappears immediately.
4. Navigate to Recap History.
5. **Expected**: NO new recap entry was added (partial recap discarded).

---

## Smoke Test 6 — Navigate Away Clears Stream

**Goal**: Navigating away from Dashboard resets stream state.

1. Tap "Get Recap"; let stream complete.
2. Navigate to `/library` or any other page.
3. Navigate back to Dashboard.
4. **Expected**: Recap stream panel is **not shown** (session state cleared).
5. The recap is still in history (persistence unaffected by navigation).

---

## Smoke Test 7 — Collapsible Lore Card on Book Details

**Goal**: Lore card expands/collapses inline.

1. Open Book Details for a book that has at least one lore card.
2. **Expected**: Lore card is visible and starts **expanded** (initial-collapsed=false).
3. Tap the lore card header.
4. **Expected**: Card collapses to excerpt view.
5. Tap again.
6. **Expected**: Card expands to full content.
7. If multiple lore cards exist: tap the cycle (↻) button.
8. **Expected**: A different lore card is shown; card remains expanded.

---

## Smoke Test 8 — Reactive Lore Arrival on Book Details

**Goal**: New lore card appears without page refresh.

1. Open Book Details for a book at a milestone near 10%, 20%, etc.
2. In a separate tab or via progress update, trigger a lore generation by crossing the milestone.
3. **Expected**: The lore card on Book Details updates to show the newly generated card **automatically** (within ~1s of store update) — no page refresh needed.

---

## Smoke Test 9 — "New Lore" Seen Sync

**Goal**: "New Lore" chip clears after visiting Book Details.

1. Trigger lore generation for the hero book (advance past a milestone).
2. Return to Dashboard.
3. **Expected**: "New Lore" chip is visible on the hero card.
4. Tap "View Book" (navigates to Book Details).
5. Wait for page to mount (lore is marked seen automatically).
6. Navigate back to Dashboard.
7. **Expected**: "New Lore" chip is **no longer visible** on the hero card.

---

## Regression Check 1 — Book Details recap behaviour unchanged

Verify that `BookDetailPage.vue` recap functionality is identical before and after this feature:
- Lock gate still works (same thresholds)
- "Get Recap" still streams inline on Book Details
- Recap History still shows all generated recaps

---

## Regression Check 2 — Lore generation banner / toast

Verify:
- "New Lore is being generated" chip/banner still shows while generation is in progress.
- **No toast** fires when generation completes (toast was removed in prior session).
