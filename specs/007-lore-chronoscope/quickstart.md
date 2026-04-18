# Quickstart: Lore Chronoscope

Manual smoke-test playbook. Each smoke is a concrete, reproducible scenario that proves a slice of the feature works end to end. Run before merging.

---

## Prerequisites

- A test account with at least one book imported.
- On that book, generate ≥ 1 regular recap at some page (progress > 0%). This populates the spoiler-wall context.
- Supabase migration `20260417_lore_cards.sql` applied (new table + RLS).
- Edge function `generate-lore` deployed (`supabase functions deploy generate-lore`).
- Environment variable `GEMINI_API_KEY` set in Supabase project settings.

---

## Smoke 1 — First milestone unlocks a lore card (US1)

1. Open the app, navigate to a book with total pages = 300 and at least one existing recap covering ≥ 10% progress.
2. Save progress from 0% (page 0) to 30 pages (10%).
3. **Expected**: Within 30 seconds, a toast appears: "New Lore Unlocked — <book title>". In the browser DevTools Network tab, one `POST /functions/v1/generate-lore` request is visible.
4. Navigate to the book detail page.
5. **Expected**: A "Lore Chronoscope" card is visible with the newly generated lore content. Content references only characters/places mentioned in the existing recap.

---

## Smoke 2 — Second milestone on same book unlocks a second card

1. Continue the same book. Save progress from 31 to 61 pages (20%).
2. **Expected**: Another toast fires after a short delay.
3. Open the Book Detail Page → Chronoscope card → tap refresh icon.
4. **Expected**: The displayed lore changes. Tap again — cycles. With only two cards, alternation between the two is visible.

---

## Smoke 3 — Duplicate-milestone cost guard (FR-003)

1. On the same book, save progress back to 61 pages (still at 20%).
2. **Expected**: No toast. No `POST /functions/v1/generate-lore` in the Network tab.
3. **Expected**: Lore Cards in the DB for this book remain at exactly 2 entries.

---

## Smoke 4 — Multi-milestone jump collapses to latest (FR-010)

1. On a fresh book at 0%, save progress directly to 250/300 pages (83%).
2. **Expected**: Exactly one toast fires after generation. One POST request to `generate-lore`.
3. Check DB: `SELECT unlocked_at_milestone FROM lore_cards WHERE book_id = ?` returns exactly one row with `unlocked_at_milestone = 80` (the latest crossed).

---

## Smoke 5 — No recap → no generation (FR-004)

1. Create or reset a book such that it has zero recaps with `progress_snapshot > 0`.
2. Save progress past a 10% milestone.
3. **Expected**: No toast. No `POST /functions/v1/generate-lore` request. No new lore row inserted.

---

## Smoke 6 — Silent failure (FR-008)

1. Temporarily unset `GEMINI_API_KEY` in the Supabase project (or point the edge function at a broken URL).
2. Cross a milestone on a book with qualifying recaps.
3. **Expected**: No error toast appears. `console.error` logs the failure in DevTools. No new lore row. The UI remains fully responsive.

---

## Smoke 7 — The Great Library rename (US2)

1. Open the app. Look at the bottom nav.
2. **Expected**: The "Lexicon" slot now reads "Great Library". Icon and position unchanged.
3. Tap it. **Expected**: URL stays at `/lexicon`. The page header reads "Great Library". Two tabs: "Lexicon" and "Lore Cards".
4. In the Lexicon tab, existing vocabulary functionality works identically — add, edit, delete, Leitner advance all function as before.

---

## Smoke 8 — Tabs preserve book filter (FR-014)

1. In Great Library, use the book-filter dropdown to select a specific book.
2. Switch from Lexicon tab to Lore Cards tab.
3. **Expected**: Filter remains on the same book. Lore list shows only that book's lore.
4. Switch back to Lexicon. **Expected**: Filter is still the same book. Words list unchanged.

---

## Smoke 9 — Lore Cards tab empty state (FR-017)

1. Select a book with no unlocked lore.
2. Switch to Lore Cards tab.
3. **Expected**: Empty-state message: "Keep reading to unlock your first lore card." No spinner, no error.

---

## Smoke 10 — Chronoscope card deep link into Library (FR-023)

1. On a book with ≥ 1 lore card, open the Book Detail Page.
2. Click the Chronoscope card body (NOT the refresh icon).
3. **Expected**: Navigates to `/lexicon?bookId=<this-book>&tab=lore`. Lore Cards tab is open. Filter is the correct book.

---

## Smoke 11 — New-lore chip appears on Library card (FR-026)

1. Close any open Book Detail Page. Navigate to Library.
2. Cross a milestone for a book (do the save from the Dashboard or another surface, not the book's own detail page).
3. **Expected**: Toast fires. Within a few seconds, the Library card for that book shows a "New Lore" chip in the corner.
4. Tap the chip. **Expected**: Navigates to the Book Detail Page. Chip disappears.
5. Navigate back to Library. **Expected**: Chip is gone and stays gone across page reloads.

---

## Smoke 12 — Session / device switch (FR-028, FR-031)

1. On Device A, generate lore, do NOT open Book Detail Page (chip remains).
2. On Device B (same account), open the Library.
3. **Expected**: Chip appears on Device B as well (seen flag is server-side).
4. On Device B, open the Book Detail Page — chip disappears.
5. Return to Device A, refresh. **Expected**: Chip has disappeared on Device A too.

---

## Smoke 13 — Sign out clears cached lore (FR-031)

1. With lore fetched and visible, sign out.
2. **Expected**: All Pinia state is cleared (including lore). The app returns to the auth screen.
3. Sign in as a different user.
4. **Expected**: The new user sees only their own lore. Previous user's cards are not visible anywhere.

---

## Smoke 14 — Book deletion cascade (FR-032)

1. On a book with unlocked lore, delete the book from the Library.
2. **Expected**: The book vanishes. Subsequent queries for its lore return zero rows.
3. Verify in Supabase Studio: `SELECT COUNT(*) FROM lore_cards WHERE book_id = <deleted-book-id>` returns 0.

---

## Smoke 15 — Return-navigation instant render (SC-005)

1. Open a book with ≥ 1 lore card → Book Detail Page. Note the Chronoscope card.
2. Navigate away to Library or Dashboard.
3. Navigate back to the same Book Detail Page.
4. **Expected**: Chronoscope card renders immediately. No skeleton flash. No visible loading state.

---

## Regression checklist (must still pass)

- All 10 smokes from feature 006 (`specs/006-swr-data-caching/quickstart.md`) still pass.
- `generate-recap` edge function behaviour is unchanged — blurb, full recap, delta recap, passport summary all still work.
- `rg "useCache|swr\(|mutate\(|invalidate\(" src/stores/recaps.ts` — streaming paths still untouched.
- Lighthouse PWA score ≥ 90 (constitution gate V).
- Bundle size delta for `dist/assets/*.js` < 10 KB gzipped.

---

## Unit test targets (`tests/unit/`)

- `masterRecap.spec.ts`: build function handles empty list, single item, multi-item, correctly excludes `progress_snapshot = 0`, correctly filters by `page_snapshot > currentPage`, sorts ascending.
- `milestoneDetect.spec.ts`: crossing detection returns correct milestone for all edge cases (0→5, 5→10, 18→22, 8→35, 95→100, negative moves, same-value saves).

Both must run under `npx vitest run` with zero failures before merge.
