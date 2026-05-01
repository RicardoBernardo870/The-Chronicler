# Research: Library Page Overhaul (019)

## D1 — Genre field missing from `get_library_with_progress` RPC

**Decision**: Extend the Supabase `get_library_with_progress` SQL function to `SELECT` the `genre` column from the `books` table, update the `LibraryBookEntry` TypeScript type to include `genre: string | null`, and update `_libraryFetcher` in `src/stores/books.ts` to map `e.genre` instead of the current hardcoded `genre: null`.

**Rationale**: The `LibraryBookEntry` type (line 108–121 of `src/types/index.ts`) has no `genre` field; the `_libraryFetcher` explicitly sets `genre: null` for every book regardless of what the DB stores. Fixing this at the RPC source is one change that propagates the fix everywhere the RPC is consumed. No new queries are needed — genre is a column on the same `books` row already joined by the RPC.

**Alternatives considered**:
- Fetch genre separately from the `books` table after the RPC call — rejected; introduces a second round-trip and the N+1 problem the RPC was designed to eliminate.
- Patch only the mapper without fixing the RPC — rejected; the data is never returned, so the mapper receives nothing to map.

---

## D2 — ISBN silently discarded on book edit

**Decision**: Three surgical changes in tandem:
1. Add `isbn: string | null` to the `changes` parameter type of `updateBook` in `src/stores/books.ts` and include `...(changes.isbn !== undefined && { isbn: changes.isbn })` in the Supabase `.update()` payload.
2. Update `BookEditDialog.vue` to pass `isbn: data.isbn` to `updateBook`, and update the `onSave` data shape to include `isbn`.
3. Update `BookForm.vue` to include `isbn` in its `initial` prop so the existing value is pre-populated when the edit dialog opens.

**Rationale**: The `updateBook` signature in `books.ts` (line 157) lists `title | author | totalPages | genre | coverUrl` but not `isbn`. `BookEditDialog.vue` (line 24) calls `updateBook` without forwarding `isbn`. `BookForm.vue` already has an ISBN field and submits it — the data is collected but then discarded at the dialog-to-store boundary.

**Alternatives considered**:
- Add a dedicated `updateIsbn(id, isbn)` store action — rejected; ISBN is just another book field; a dedicated action fragments the mutation surface unnecessarily.

---

## D3 — Section headers with collapsible Archives

**Decision**: Replace the single flat `<TransitionGroup>` in `LibraryPage.vue` with three named sections: `LibrarySectionHeader` (new reusable child component under `src/components/library/`) + three `LibrarySection` wrappers — one each for Currently Reading, The Queue, and The Archives. Archives uses a `ref<boolean> archivesExpanded` toggled by the header. `LibrarySectionHeader` renders the section name + book count badge; the Archives header additionally renders a chevron icon indicating collapsed/expanded state. Use PrimeVue `Chip` for the count badge and `pi pi-chevron-down` / `pi pi-chevron-up` for the toggle icon.

**Rationale**: No PrimeVue component maps cleanly to a collapsible list-section header with a count badge. `Accordion` is intended for content panels with header+body pairs, not for wrapping a scrollable list. A thin custom `LibrarySectionHeader` component is the right unit of decomposition — it is small, single-responsibility, and justifiable under Constitution VI (no PrimeVue component covers this exact pattern).

**Alternatives considered**:
- PrimeVue `Accordion` — rejected; forces its own DOM structure (`AccordionPanel`, `AccordionHeader`, `AccordionContent`) that conflicts with the existing `TransitionGroup` + `BookCard` list structure.
- PrimeVue `Panel` with `toggleable` prop — rejected; panel's toggle is at the panel level, not integrated with a count badge; also adds padding/border chrome not wanted for section headers.

---

## D4 — Days-remaining estimate from reading velocity

**Decision**: Add a `useReadingVelocity(bookId)` composable in `src/composables/useReadingVelocity.ts`. It queries `progress_history` for sessions belonging to the given book in the past 30 days, groups consecutive rows into sessions (a session = two adjacent rows where `session_start_at` on the later row is non-null, OR any two adjacent rows within the same date), computes an average pages-per-session rate, and returns `{ daysLeft: number | null }`. Returns `null` when fewer than 3 qualifying sessions exist. Books with 0 pages remaining or no `totalPages` also return `null`.

Since `progress_history` is already fetched per-book on `BookDetailPage`, the Library page must make a single efficient call. Use a new Supabase RPC `get_reading_velocity` (or a direct `.select` filtered by `book_id` and `recorded_at > now() - interval '30 days'`) per in-progress book. To avoid N+1 queries, fetch all history rows for `reading` status books in one query filtered to the past 30 days, then compute per-book in-memory.

**Rationale**: Computing velocity client-side from `progress_history` keeps the logic in TypeScript where it is testable. A separate composable keeps `LibraryPage.vue` clean. Batching the fetch avoids N queries for N in-progress books.

**Alternatives considered**:
- New Supabase RPC returning velocity per book — deferred; over-engineering for a single feature; the client-side calculation is straightforward given the data is already available.
- Use global `allTimeVelocityPph` from `get_reading_stats` — rejected; the spec requires per-book velocity from the past 30 days, not a global velocity in pages-per-hour.

---

## D5 — Swipe gesture actions (Edit / Delete)

**Decision**: Implement swipe-left as a new `SwipeableBookCard` wrapper component at `src/components/library/SwipeableBookCard.vue`. The component wraps the existing `BookCard` and uses `@touchstart` / `@touchmove` / `@touchend` native events (no new npm packages). A `translateX` CSS transform slides the card left, revealing two action buttons (Edit, Delete) painted behind the card using absolute positioning. The card snaps closed if the drag distance is less than a threshold (80px). On desktop (non-touch) viewports, the existing `BookCard` ⋯ menu already satisfies FR-005 — the swipe wrapper detects touch capability via `window.matchMedia('(hover: none)')` and is a no-op on mouse devices. Mutual exclusion (FR-006: only one card open at a time) is managed via a module-level `ref<string | null> openCardId` shared by all `SwipeableBookCard` instances.

**Rationale**: VueUse does not have a pre-built swipe-to-reveal-actions primitive. The native touch event approach is ~60 lines of straightforward logic and introduces no new runtime dependency. The desktop ⋯ menu already exists on `BookCard` and satisfies the desktop acceptance scenario from the spec.

**Alternatives considered**:
- `@vueuse/gesture` — rejected; adds ~30 KB to bundle for a feature that needs one gesture; Constitution V demands minimal bundle size.
- Rewrite `BookCard` to include swipe logic inline — rejected; bloats `BookCard` beyond a single responsibility; `SwipeableBookCard` as a thin wrapper keeps `BookCard` unchanged and reusable in the grid view.

---

## D6 — Optimistic drag-and-drop reorder in The Queue

**Decision**: Modify `useUpNextStore.saveOrder` to apply the new order to `upNextOrder.value` immediately (optimistic update) before the Supabase upsert, then revert to the prior order on failure and emit a toast notification. Remove the post-upsert `await _fetcher()` call (which was causing the snap-back by overwriting local state with the old server order before the upsert committed). Replace it with a direct `swrTouch` after the upsert succeeds.

The drag-and-drop component on the Library queue section calls `saveOrder(newBookIds)`. After the optimistic patch, the UI reflects the new order immediately; the upsert runs in the background. On failure, `upNextOrder.value` is restored to `previousOrder` and PrimeVue Toast shows a brief error message.

**Rationale**: The current `saveOrder` calls `await _fetcher()` after the upsert. `_fetcher` issues a new Supabase SELECT which returns the pre-upsert order until the write propagates, causing the visible flicker. Optimistic update eliminates this by separating the UI state update from the network round-trip.

**Alternatives considered**:
- Debounce the upsert and skip the refetch — achieves optimistic feel but risks losing the final order if the user navigates away before the debounce fires; rejected for reliability reasons.
- Server-Sent Events / Realtime subscription — over-engineered; the user is the only actor changing their own queue order.
