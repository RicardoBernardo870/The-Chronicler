# Research: Lexicon & Navigation UX Improvements

**Feature**: 005-lexicon-nav-ux
**Date**: 2026-04-17

---

## Decision 1: AddWordDialog book-selection strategy

**Decision**: Make `bookId` prop optional on `AddWordDialog`. When the prop is absent (or empty string), the dialog renders a required `<Select>` for book; when the prop is provided, the book is locked and no selector is shown.

**Rationale**: Keeping a single dialog component avoids duplicating the save logic, validation, and Free Dictionary API lookup. The prop controls which "mode" the dialog operates in — context-free (Lexicon page, all-books filter) vs. context-bound (Book Detail page or Lexicon page with a book filter active). A single conditional block in the template is simpler than two separate dialog components.

**Alternatives considered**:
- Separate `AddWordDialogFree.vue` and `AddWordDialogBound.vue` — rejected: code duplication.
- Always show book selector but pre-select it when context is known — rejected: pre-selection creates the same silent-association risk if the user accidentally leaves the default; a locked/hidden selector for the bound case is safer and clearer.

---

## Decision 2: LexiconPage `activeBookId` replacement

**Decision**: Remove the `activeBookId` computed that falls back to `booksStore.books[0]`. Instead, pass `selectedBookId.value ?? undefined` directly to `AddWordDialog`'s optional `bookId` prop. When the filter is "All Books" (`selectedBookId === null`), the dialog shows its own selector. When a book is filtered, it is passed as the pre-locked context.

**Rationale**: The fallback to `books[0]` was the root cause of silent mis-association. Removing it entirely and delegating book selection to the dialog (when no filter is active) is the correct data-integrity fix.

---

## Decision 3: BookDetailPage "Add Word" affordance placement

**Decision**: Add a small ghost/outlined `"Add Word"` button to the Book Detail page's progress section, next to or below the existing controls. Show a `lexicon count` chip below the button that links to `/lexicon?bookId=<id>`. Default `pageFound` to `progress.currentPage` when the dialog saves.

**Rationale**: The progress section is already the reader's active-reading hub — it's where they update pages, get recaps, and check velocity. Adding "Add Word" here keeps capture frictionless and contextual. The word count chip provides light feedback that the vault is accumulating words for this book.

**Alternatives considered**:
- Add "Add Word" to the hero section — rejected: hero is static metadata, not an action area.
- Add a floating FAB on Book Detail — rejected: conflicts with the incoming floating bottom nav.
- Inline word list on Book Detail — explicitly declared out of scope in spec.

---

## Decision 4: Word of the Day — per-day caching

**Decision**: Store the current day's word selection in `localStorage` under key `wotd_<userId>` as `{ date: 'YYYY-MM-DD', entryId: string }`. In the lexicon store, expose a `resolveWordOfTheDay()` action that: (1) checks localStorage for today's date match, (2) if hit → look up the entry from `entriesByBook`, (3) if miss → run `getDueWord`, store result, return it. The `wordOfTheDay` computed stays but reads from a store-level `_wotdEntryId` ref instead of calling `getDueWord` on every render.

**Rationale**: `getDueWord` currently runs inside a `computed()` in the store, which re-evaluates on every reactive change to `entriesByBook`. For stability, the selection must be memoised to one per calendar day. `localStorage` is appropriate because: (a) the user is always logged in when the lexicon is used, (b) it persists across tab reloads without a DB round-trip, (c) it's per-device (acceptable — each device can show its own wotd until a revisit re-seeds).

**Fallback (no entries due)**: `getDueWord` currently returns `null` if nothing is due. The new logic replaces `null` with the entry having the soonest `nextReviewAt` among all entries (future-dated), with a boolean `isPreview` flag set to `true` so the UI can indicate "coming up soon". If there are zero entries at all, the card hides as before.

**Alternatives considered**:
- Server-side wotd record per user per day — overkill, no cross-device sync need identified.
- Vue `watchEffect` with a daily timestamp comparison — more complex, same outcome as localStorage with no advantage.

---

## Decision 5: Bottom navigation — layout strategy

**Decision**: 
1. Create `AppBottomNav.vue` as a new component replacing `AppHeader.vue` in `DefaultLayout.vue`.
2. `DefaultLayout.vue` removes `<AppHeader />`, uses `<AppBottomNav />` positioned fixed at bottom with `env(safe-area-inset-bottom)`.
3. Pages already have `padding-bottom: 4rem`; increase to `5.5rem` + safe-area to guarantee clearance.
4. Utility CSS variable `--nav-bottom-height: 4rem` set in global styles and referenced by pages.
5. Theme toggle + sign out move into a slim settings row on DashboardPage (or triggered from a gear icon in AppBottomNav as a 4th "more" slot — decided below).

**Decision 5b — 4th slot**: Add a 4th slot to the bottom nav: a "More" icon (`pi-ellipsis-h` or `pi-sliders-h`) that opens a small bottom sheet / popover containing theme toggle and sign out. This keeps the nav at 4 items max and doesn't scatter actions across pages.

**Rationale**: Most modern reading apps (Kindle, Libby, Apple Books) use 4–5 bottom tab items. A "More" slot is the conventional home for secondary actions. The Add Book action (`pi-plus`) moves from the header into the More sheet as well, or is surfaced as a FAB on the Library page only (where it is most contextually relevant).

**Alternatives considered**:
- 3-item nav only, actions moved to DashboardPage — rejected: sign out on Dashboard page only is a discoverability cliff.
- Collapsible header with scroll-up reveal — rejected: user explicitly requested bottom floating that stays visible.

---

## Decision 6: Icon set for bottom nav

**Decision**:
- **Home** → `pi-home` (house)
- **Library** → `pi-th-large` (grid of items / bookshelf metaphor)
- **Lexicon** → `pi-language` (language/vocabulary icon)
- **More** → `pi-ellipsis-h` (overflow / more actions)

`pi-book` is removed from the navigation chrome. It may still appear as a placeholder cover inside `book-detail__cover-placeholder` (the non-navigational decorative context) — that usage is fine since it's a content icon, not a nav icon.

**Rationale**: All icons are in PrimeIcons 7, already bundled with PrimeVue 4. No additional icon library dependency needed.

---

## Decision 7: `fetchEntriesForAll` entry point

**Decision**: Add `fetchEntriesForAllBooks()` action to the lexicon store that fetches entries across all books in a single Supabase query (without filtering by `book_id`). Used by DashboardPage and the Word of the Day seeding — avoids the current N+1 fetch pattern (one query per book on `LexiconPage` + Dashboard).

**Rationale**: The `wordOfTheDay` computed flattens all books' entries. If Dashboard mounts before LexiconPage, `entriesByBook` may be empty and `wordOfTheDay` returns `null` even though the user has words. A single `SELECT * FROM lexicon_entries WHERE user_id = $1` is simpler and more reliable than depending on the per-book fetch pattern.
