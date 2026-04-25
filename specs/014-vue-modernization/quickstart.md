# Quickstart: Vue Modernization — Acceptance Scenarios

Each scenario verifies a specific refactoring outcome. All scenarios share the same precondition: the app is running locally with at least one in-progress book.

---

## Scenario 1 — Date output parity: relative times (US3)

1. Open the Dashboard. Note the "Last Session" card's relative time label (e.g., "3 hours ago").
2. Apply the `useRelativeTime.ts` → `date-fns` migration.
3. Reload the Dashboard.
4. **Expected**: The relative time label reads identically to step 1 (same bucket, same text).
5. Advance the system clock by 1 day. Reload.
6. **Expected**: The label now reads "Yesterday" — same as the pre-migration implementation for that bucket.

---

## Scenario 2 — Date output parity: short dates (US3)

1. Open the Recap History page. Note the date on any recap card (e.g., "Apr 24, 2026").
2. Open the Lexicon page. Note the "Next review" date on any word card.
3. Apply the `toLocaleDateString` → `formatShortDate` migration in `RecapCard.vue`, `LoreCardDetail.vue`, `WordOfTheDay.vue`.
4. Reload both pages.
5. **Expected**: Every date string reads identically to step 1/2.

---

## Scenario 3 — DashboardPage decomposition (US1)

1. Open the Dashboard. Verify all sections render: hero card, In Progress list, Up Next list, Completed list, Last Session card, Word of the Day.
2. Save a page update on the hero book.
3. **Expected**: "Saved!" confirmation appears; progress bar updates; no console errors.
4. Drag an "Up Next" book to reorder.
5. **Expected**: Order persists after page reload.
6. Click "Get Recap".
7. **Expected**: Inline recap panel appears; recap streams correctly.

---

## Scenario 4 — BookDetailPage decomposition (US1)

1. Navigate to any book's detail page.
2. Verify the header renders: cover, title, author, genre chip.
3. Update the page number and tap Save.
4. **Expected**: Progress bar updates, no errors.
5. Start a session, save pages, and confirm the note field appears.
6. **Expected**: Session note field slides in below the save confirmation.

---

## Scenario 5 — coverFallback shared utility (US4)

1. Add a book with a broken cover URL.
2. Open the Dashboard (hero card), the Library page, and the Book Detail page.
3. **Expected**: The broken image is hidden (display: none) on all three pages — verified by inspecting the DOM. No JavaScript error in console.

---

## Scenario 6 — PrimeVue genre chips (US2)

1. Open any book with a genre set (e.g., "Fantasy").
2. Check the Dashboard hero card, the Library page book grid, and the Book Detail header.
3. **Expected**: Genre text renders inside a `<div data-pc-name="chip">` element (PrimeVue Chip), matching the previous visual appearance (colour, size, spacing).

---

## Scenario 7 — PrimeVue Tag for status badges (US2)

1. Open the Dashboard with an offline connection (DevTools → Network offline).
2. **Expected**: The "Progress will sync when you're back online" indicator uses a `<div data-pc-name="tag">` element.
3. Re-enable network. Verify the badge disappears as before.

---

## Scenario 8 — Build clean after every increment (FR-010, SC-004)

After each completed refactoring task, run:

```bash
npm run build
```

**Expected**: Zero TypeScript errors, zero Vite warnings about unresolved imports. `✓ built in ...` confirmation in terminal output.

---

## Scenario 9 — No new custom card structures introduced (SC-002)

1. After the full refactor, search the `src/` directory for `class=".*-card"` and `class=".*glass-surface"` not already present in the pre-refactor baseline.
2. **Expected**: No new custom card/panel HTML structures have been introduced. All new UI wrappers use PrimeVue components or reuse existing glass-surface classes.

---

## Scenario 10 — LoreChronoscopeCard renders correctly (US1)

1. Navigate to a book with unlocked lore cards. Open the Book Detail page.
2. Click any lore card to expand it.
3. **Expected**: The card expands showing lore content, title, type badge — identical to pre-refactor. No visual regression.

---

## Scenario 11 — Last Session Card metrics (US3 + US2)

1. Complete a reading session (start session → save pages).
2. Open the Dashboard and observe the Last Session Card.
3. **Expected**:
   - Duration shows (e.g., "42 minutes") — derived from `date-fns` `diffInSeconds` in `useLastSession.ts`.
   - Relative time label (e.g., "Just now") uses `formatRelativeToNow` from `src/utils/date.ts`.
   - All five metrics render correctly (distance, time, velocity, completion, prediction).
