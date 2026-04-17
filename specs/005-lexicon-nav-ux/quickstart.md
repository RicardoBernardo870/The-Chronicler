# Quickstart / Manual Test Guide: Lexicon & Navigation UX Improvements

**Feature**: 005-lexicon-nav-ux
**Date**: 2026-04-17

---

## Prerequisites

- An account with ≥ 2 books in the library (e.g., "Book A", "Book B")
- At least one book with reading progress set
- Node.js / Vite dev server running locally

---

## Scenario 1: Add Word from Lexicon page — no book filter active

**Goal**: Verify explicit book selection is required when "All Books" is active.

1. Navigate to `/lexicon`
2. Confirm the filter shows "All Books"
3. Click **Add Word**
4. Confirm the dialog shows a **Book** selector (required, no default)
5. Enter a term ("ephemeral") — definition auto-fetches
6. Click **Save** without selecting a book → Confirm validation error "Please select a book"
7. Select "Book A" from the Book selector
8. Click **Save** → success
9. In the Lexicon page, filter to "Book A" → confirm the new word appears
10. Filter to "Book B" → confirm the word does NOT appear

**Acceptance criteria**: FR-001, FR-002, FR-004, SC-001

---

## Scenario 2: Add Word from Lexicon page — book filter active

**Goal**: Verify pre-selection when a book filter is set.

1. Navigate to `/lexicon`
2. Set the filter to "Book B"
3. Click **Add Word**
4. Confirm the dialog shows "Book B" pre-selected in the Book selector (but editable)
5. Save without changing the book → entry saved to Book B
6. Filter to Book B → entry visible; filter to Book A → not visible

**Acceptance criteria**: FR-002, FR-004, SC-001

---

## Scenario 3: Add Word from Book Detail page

**Goal**: Verify in-context capture with locked book and default page.

1. Navigate to a book detail page for "Book A" (with reading progress on page 150)
2. Find the **Add Word** button in the progress section
3. Click it → dialog opens; confirm no Book selector (book is locked to "Book A")
4. Confirm `pageFound` input is pre-filled with 150 (current progress page)
5. Enter term and definition, clear the page field → Save → `page_found` saved as null (allowed)
6. Repeat but keep page 150 → Save → entry saved with `page_found = 150`
7. Navigate to `/lexicon?bookId=<id>` → new word appears under "Book A"
8. Return to Book Detail → word count badge shows correct count (e.g. "2 words saved") and links to Lexicon

**Acceptance criteria**: FR-003, FR-004, FR-005, FR-006, SC-001, SC-002

---

## Scenario 4: Word of the Day — stable within a day

**Goal**: Verify same-day stability.

1. Ensure ≥ 1 entry with `next_review_at ≤ today` in any book
2. Navigate to Dashboard → Word of the Day card shows the entry
3. Navigate away and back (multiple times within the same browser session and after reload)
4. Confirm the same entry is shown each time (not a different random word each visit)

**Acceptance criteria**: FR-007, SC-003

---

## Scenario 5: Word of the Day — fallback when nothing is due

**Goal**: Verify non-empty card when all entries are future-dated.

1. Mark all existing entries as reviewed (advance all to box 5 so `next_review_at` is in the future)
2. Navigate to Dashboard
3. Confirm the Word of the Day card is still visible (not hidden)
4. Confirm a subtle label like "Coming up" or "Preview" appears on the card
5. Confirm the displayed word matches the entry with the soonest `next_review_at`

**Acceptance criteria**: FR-008 (fallback branch), SC-004

---

## Scenario 6: Word of the Day — advance triggers next word

**Goal**: Verify immediate re-selection after advancing.

1. Ensure ≥ 2 entries are due today (box 1, `next_review_at ≤ today`)
2. Note the term shown as Word of the Day
3. Click the advance button (arrow → icon)
4. Confirm the card immediately shows a different word (next due entry)
5. Confirm the first word does NOT reappear on the same day

**Acceptance criteria**: FR-009, SC-003

---

## Scenario 7: Word of the Day — accurate "from: <book>" line

**Goal**: Verify book association accuracy.

1. Add a word to "Book A" from the Lexicon page (explicitly selecting Book A)
2. Add a word to "Book B" from Book B's detail page
3. Navigate to Dashboard → Word of the Day card
4. Confirm the "from: <title>" line matches the entry's actual book (not some other book)

**Acceptance criteria**: FR-010, SC-001

---

## Scenario 8: Bottom navigation — structure and active states

**Goal**: Verify nav structure and active highlighting.

1. Open the app as an authenticated user on a mobile viewport (375×812)
2. Confirm the top header is **gone** (no "Chronicler" brand bar at the top)
3. Confirm a floating bottom nav with 4 items is visible: Home, Library, Lexicon, More
4. Tap each tab → route changes; active tab is visually distinct
5. Confirm no `pi-book` icon is used in nav items
6. Confirm Home uses house icon, Library uses grid icon, Lexicon uses language/letter icon

**Acceptance criteria**: FR-012, FR-013, FR-014, FR-015, SC-005

---

## Scenario 9: Bottom navigation — content clearance

**Goal**: Verify page content is not clipped by nav.

1. Navigate to Library with many books (scroll content)
2. Scroll to the very bottom of the page
3. Confirm the last card/element is fully readable and not hidden behind the nav bar
4. Rotate device to landscape → confirm nav stays floating, content still accessible

**Acceptance criteria**: FR-016, SC-006

---

## Scenario 10: Bottom navigation — More sheet preserves header actions

**Goal**: Verify no actions lost from removed top header.

1. Tap "More" (ellipsis icon) in the bottom nav
2. Confirm a sheet/popover appears with at minimum:
   - **Add Book** → navigates to `/books/add`
   - **Dark/Light mode toggle** → toggles theme
   - **Sign out** → signs out
3. Confirm all three work correctly

**Acceptance criteria**: FR-019, SC-008

---

## Scenario 11: Tap targets (accessibility)

**Goal**: Verify 44px minimum tap target compliance.

1. Open browser DevTools → Accessibility audit or manual measurement
2. Inspect each bottom nav item: computed height and width both ≥ 44px
3. Inspect "Add Word" button on Book Detail page: tap target ≥ 44px

**Acceptance criteria**: FR-017, SC-007
