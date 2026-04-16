# Quickstart Test Scenarios: Reading Suite v3

## Scenario 1 — Library Grid View & Sort

1. Open Library with at least 3 books at different progress percentages
2. Verify: most recently updated book appears at top (no label needed)
3. Tap the grid toggle button
4. Verify: books display as a cover grid with title overlay and progress bar
5. Tap the list toggle to return
6. Verify: view preference remembered after page refresh

**Pass criteria**: Sort is correct, grid renders covers, list/grid toggle persists.

---

## Scenario 2 — Edit & Delete Book

1. In Library list view, tap the `⋮` overflow menu on any book
2. Select "Edit book"
3. Modify the title and tap Save
4. Verify: title updates immediately in the library
5. Tap `⋮` again → "Remove book" → confirm
6. Verify: book disappears from library; navigating to BookDetail for that ID shows 404/redirect

**Pass criteria**: Edit persists, delete removes all associated data.

---

## Scenario 3 — Up Next & Drag Reorder

1. Add 2 books with 0% progress
2. Open Dashboard → scroll to "Up Next" section
3. Verify: both books appear
4. Drag the second book above the first
5. Refresh the page
6. Verify: reordered position persists

**Pass criteria**: Up Next shows 0%-books, drag order saves across sessions.

---

## Scenario 4 — ISBN Field Merge

1. Find an ISBN known to have no cover in Open Library (test: ISBN 9780375831003)
2. Add the book via ISBN scan
3. Verify: cover image is shown (sourced from Google Books fallback)
4. Verify: title/author from Open Library are preserved (not overwritten by Google Books)

**Pass criteria**: Cover comes from secondary source; other fields from primary source intact.

---

## Scenario 5 — Lexicon Word + Word of the Day

1. Navigate to Lexicon (bottom nav icon)
2. Tap "+ Add Word", type "ephemeral", wait for definition to auto-fill
3. Paste a context sentence, enter page 47, tap Save
4. Verify: card appears in the list for the current book
5. Tap the card → verify it flips to show definition + context + page
6. Tap "I know this" → verify card updates Leitner state
7. Return to Dashboard
8. Verify: "Word of the Day" widget shows a word from your saved list

**Pass criteria**: Word saves, flip animation works, Word of the Day appears on Dashboard.

---

## Scenario 6 — Reading Velocity & Continuity Score

1. Add a book and set progress to page 50 (note the timestamp)
2. Wait a few seconds, update progress to page 120
3. Open BookDetailPage
4. Verify: "X pages/hr" velocity badge is visible
5. Verify: Finish Line prediction is shown ("~X hours to finish")
6. Simulate 3+ days without an update (set `updated_at` to 3 days ago in DB for testing)
7. Open Dashboard
8. Verify: Hero card shows amber warning state with "Memory Jogger" suggestion

**Pass criteria**: Velocity visible with ≥2 updates; hero card warns after 2.7+ days.

---

## Scenario 7 — Milestone Recap Lock

1. Generate a recap for a book at page 100 (50%)
2. Update progress to page 105 (only 2.5% more)
3. Open BookDetailPage
4. Verify: "Get Recap" button is locked with "Read X more pages to unlock" message
5. Update progress to page 120 (10% milestone crossed)
6. Verify: "Get Recap" button is now unlocked
7. Generate recap
8. Verify: recap generates successfully

**Pass criteria**: Lock shows correct page count; unlocks exactly at 10% threshold.

---

## Scenario 8 — Recap History Shows Page Number

1. Generate a recap at page 150
2. Navigate to Recap History for that book
3. Verify: each recap entry shows both "X%" and "page Y"

**Pass criteria**: Both percentage and page number visible per recap entry.

---

## Scenario 9 — Book Passport

1. Update a book's progress to 100% (final page)
2. Verify: BookPassport generation triggers (loading state visible)
3. On BookDetailPage, verify a "View Journey" button appears
4. Tap it → BookPassportPage opens
5. Verify: total days, peak day, vocabulary count, and AI summary are all shown

**Pass criteria**: Passport auto-generates at 100%, all stats correct, AI summary streams.

---

## Scenario 10 — iOS Gradient Fix

1. Open the app on an iPhone (Safari or PWA)
2. Scroll to the top of any page
3. Verify: background gradient is visible behind the status bar notch area with no blank stripe
4. Verify: in light mode, the light gradient also fills the status bar area

**Pass criteria**: No bare/white stripe above the app content on any iOS device.
