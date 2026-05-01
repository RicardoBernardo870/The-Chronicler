# Quickstart Verification: Library Page Overhaul (019)

Manual smoke-test scenarios to verify each user story independently after implementation.

---

## Story 1 — Book Edit & Genre Display

**Pre-condition**: App running, at least one book in the library.

1. Open Library. Tap the ⋯ menu on any book card → tap **Edit book**.
2. In the edit dialog, change the ISBN field to `9780743273565` and change the genre to `Fiction`. Save.
3. **Verify**: The genre chip on the book card now shows "Fiction". The dialog does not reopen with a blank ISBN.
4. Reopen the edit dialog for the same book. **Verify**: The ISBN field pre-fills with `9780743273565`.
5. Clear the ISBN field and save. Reopen the edit dialog. **Verify**: The ISBN field is blank.
6. Add a new book with a genre set. Navigate to Library. **Verify**: The genre chip appears on the card without requiring a page reload.

---

## Story 2 — Section Headers with Counts and Collapsible Archives

**Pre-condition**: Library has at least one book in each status (reading, unread, finished).

1. Open the Library page.
2. **Verify**: Three section headers are visible:
   - "Currently Reading (N)" — where N = number of in-progress books.
   - "The Queue (N)" — where N = number of unread/queued books.
   - "The Archives (N)" — where N = number of finished books.
3. **Verify**: The Archives section is collapsed on first load — no finished books are visible.
4. Tap the Archives header. **Verify**: The finished books list expands smoothly.
5. Tap the Archives header again. **Verify**: The list collapses.
6. Navigate away from Library and return. **Verify**: The Archives section is collapsed again (state not persisted).
7. Remove all books from one section. **Verify**: The header for that section still shows with count 0.

---

## Story 3 — Page Count and Days-Remaining Estimate

**Pre-condition**: At least one in-progress book with `totalPages > 0`. For the days estimate, the book needs ≥ 3 reading sessions in the past 30 days.

1. Open Library. Find an in-progress book card.
2. **Verify**: Below the progress bar, the text "Page X of Y" appears where X = current page and Y = total pages.
3. **Verify (with ≥ 3 sessions)**: A "~N days left" estimate appears next to the page count.
4. **Verify (with < 3 sessions or no history)**: Only the page count is shown — no days estimate.
5. Open Library with a book where `totalPages` is 0 or unknown. **Verify**: No "Page X of Y" text appears for that book.
6. Open a finished book in The Archives. **Verify**: No days estimate is shown.

---

## Story 4 — Swipe Left to Edit or Delete

**Pre-condition**: Mobile viewport (or Chrome DevTools touch emulation enabled).

1. On the Library page, swipe left on any book card.
2. **Verify**: "Edit" (blue) and "Delete" (red) action buttons slide in from the right.
3. Tap **Edit**. **Verify**: The book edit dialog opens pre-filled with the book's current data.
4. Swipe left on a card again, then tap **Delete**. **Verify**: A confirmation dialog appears before any deletion. Tap Cancel. **Verify**: The book is still in the list.
5. Swipe left on a card, then swipe right on the same card. **Verify**: The card snaps back to its default position.
6. Swipe left on card A. Then swipe left on card B. **Verify**: Card A snaps back automatically before card B reveals its actions.
7. On desktop (mouse viewport), hover over any book card. **Verify**: The ⋯ icon is visible; clicking it reveals Edit and Delete options.

---

## Story 5 — Optimistic Drag-and-Drop in The Queue

**Pre-condition**: At least two books in The Queue.

1. On the Library page, open The Queue section.
2. Drag a book to a new position in the list.
3. **Verify**: The card settles in the new position immediately with no visible snap-back.
4. Navigate away from Library and return. **Verify**: The queue is in the reordered state.
5. (Network failure simulation) Enable offline mode in DevTools, then drag a book to a new position. **Verify**: The order updates visually. Re-enable network. **Verify**: A toast error appears briefly and the queue reverts to the pre-drag order.

---

## Cross-Cutting: Empty States and Edge Cases

1. Library with zero books: **Verify** the empty state is shown (existing behaviour unchanged).
2. Days estimate of 0 or negative: **Verify** "Finish today!" text appears instead of "~0 days left".
3. Swipe left on a book in grid view: **Verify** swipe actions do NOT appear in grid view (grid view is unaffected by swipe; Edit/Delete accessible via the ⋯ menu).
