# Feature Specification: Lexicon & Navigation UX Improvements

**Feature Branch**: `005-lexicon-nav-ux`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description:
"- in lexicon page i want to be able to add words which already works BUT i need to choose the book! currently i just create the word and dont know which book it gets associated
- on the BookDetailPage there can be also an add word button, user can add a word there directly and doesnt need to choose the book since he is already in the book page, i leave the decision of showing the added words there or not to you
- review the whole lexicon system make sure the logic is well written for word of the day feature
- instead of having a nav bar up top lets try and have at the bottom, much like the one that exists now, floating, make sure when the user scrolls he sees all the content on the page (follow most modern app layout), remove the book icon and replace the home, library and lexicon with equivalent icons."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explicit book association when adding words from the Lexicon page (Priority: P1)

A reader opens the Lexicon page to capture a new word. Today the "Add Word" dialog silently attaches the entry to whichever book is "active" (falling back to the first book in the library when no filter is set). This causes entries to be mis-associated and makes the Word of the Day source line ("from: <book>") misleading. The reader must be able to explicitly pick the book the word belongs to before saving.

**Why this priority**: Data integrity — without explicit book selection, every entry added from the Lexicon page is potentially mis-attributed, which degrades downstream features (Word of the Day source, per-book filtering, Book Passport vocabulary counts).

**Independent Test**: With two or more books in the library, open the Lexicon page with the "All Books" filter active, add a new word, confirm the entry is attached to the book the user picked (not the first book alphabetically or by recency) by verifying it under the correct per-book filter.

**Acceptance Scenarios**:

1. **Given** I am on the Lexicon page with ≥2 books in my library and the filter set to "All Books", **When** I click "Add Word", **Then** the dialog shows a required "Book" selector listing all my books with no default selection.
2. **Given** the Add Word dialog is open with no book selected, **When** I click "Save" with a valid word and definition, **Then** the save is blocked and a validation message requests a book.
3. **Given** I am on the Lexicon page with the filter set to a specific book, **When** I click "Add Word", **Then** the Book selector is pre-selected to that book (but still editable before saving).
4. **Given** I save a word with book B chosen, **When** I re-filter the Lexicon page to book B, **Then** the new entry appears; filtering to any other book does NOT show it.

---

### User Story 2 - In-context "Add Word" on Book Detail page (Priority: P1)

A reader is on the detail page for a specific book and wants to capture a word they just encountered. They should not have to navigate to the Lexicon, open a dialog, and then pick the book from a dropdown — the book context is already implicit from the page they are on.

**Why this priority**: This is the primary reading-flow capture path. Adding words while in the middle of a book is the most common use-case for the vocabulary vault and must be frictionless. It also eliminates the mis-association risk entirely for this entry point (book is locked by context, not selected by user).

**Independent Test**: Navigate to any book's detail page, use the Add Word affordance, save a word, then verify it appears in the Lexicon page under that book's filter and nowhere else.

**Acceptance Scenarios**:

1. **Given** I am on the Book Detail page for a specific book, **When** I look at the primary actions, **Then** I can see an "Add Word" affordance clearly available.
2. **Given** I tap "Add Word" on the Book Detail page, **When** the dialog opens, **Then** the book is fixed to the current book and is NOT changeable from within the dialog (no book selector visible, or selector shown as read-only context).
3. **Given** I save a word from Book Detail, **When** I return to the same Book Detail page, **Then** a lightweight indicator shows how many words I have saved for this book, linking through to the Lexicon page filtered to this book.
4. **Given** I save a word from Book Detail without specifying a page number, **When** the entry is created, **Then** the `pageFound` defaults to the reader's current progress page for that book (so the word links back to where the reader was).

---

### User Story 3 - Trustworthy Word of the Day behavior (Priority: P2)

A reader sees the Word of the Day card on the dashboard and expects it to surface the most deserving word to review — i.e., one that is genuinely due under the Leitner schedule, across all their books, with a stable and predictable pick for the current day.

**Why this priority**: The current `wordOfTheDay` computed picks the lowest-box, earliest `nextReviewAt` entry but recomputes on every render and stops surfacing anything once all entries are post-dated. Readers report it feels inconsistent. After reviewing the logic holistically, the Word of the Day should (a) remain stable within a calendar day, (b) fall back gracefully when no entry is strictly due, (c) never return the same word twice in a row if alternatives exist, and (d) respect the book-association fix from Stories 1 & 2 so the "from: <book>" line is accurate.

**Why this priority**: It polishes an already-working feature rather than adding capability, so it lands after the data-integrity and in-context capture fixes.

**Independent Test**: Seed a test account with ≥5 lexicon entries across ≥2 books with varying Leitner boxes and `nextReviewAt` dates (some due, some not). Visit the dashboard multiple times within the same day and across day boundaries; verify the selected word is stable within a day, rotates across days, and the displayed source book matches the entry's actual book.

**Acceptance Scenarios**:

1. **Given** I have at least one entry with `nextReviewAt ≤ today`, **When** I view the dashboard, **Then** the Word of the Day card shows an entry that is genuinely due (lowest Leitner box first, oldest `nextReviewAt` as tiebreaker).
2. **Given** the Word of the Day is displayed, **When** I reload the dashboard or navigate away and back during the same calendar day, **Then** the same word is shown (deterministic per-day selection).
3. **Given** no entries are strictly due (`nextReviewAt > today` for all), **When** I view the dashboard, **Then** the Word of the Day still surfaces an entry — the one closest to being due — with a subtle label indicating it is a preview rather than a "due" review.
4. **Given** I mark the current Word of the Day as reviewed (advance), **When** another entry in my lexicon is still due today, **Then** the card immediately shows that next due entry (not blank).
5. **Given** the Word of the Day card is shown, **When** I read the "from: <book>" source line, **Then** it reflects the actual book association set when the entry was created (not a guessed or defaulted book).

---

### User Story 4 - Bottom floating navigation bar (Priority: P2)

The app currently has a sticky top navigation bar ("Chronicler" brand + Home / Library / Lexicon + icon actions). The reader wants to replace that with a modern mobile-style bottom floating navigation bar containing three icon-only destinations (Home, Library, Lexicon). The top bar is removed. Actions (theme toggle, add book, sign out) are relocated so that no functionality is lost but the viewport is maximized for content.

**Why this priority**: UX consistency with modern reading/mobile apps; it materially increases vertical content space on small screens (where BookHero is primarily used) and makes the three top-level destinations reachable with a thumb.

**Independent Test**: On a mobile viewport, confirm no top header is visible, a floating bottom bar with three icons is always visible, the active route is visually highlighted, and when scrolling a long page (e.g. Library with many books) the bottom bar stays visible while all page content remains reachable (nothing clipped behind the bar).

**Acceptance Scenarios**:

1. **Given** I open the app as an authenticated user, **When** any page renders, **Then** the previous top header is gone and a floating bottom navigation bar with exactly three destinations (Home, Library, Lexicon) is visible.
2. **Given** the bottom nav is visible, **When** I look at each destination, **Then** each uses an icon appropriate to its function — Home uses a house/home icon, Library uses a stack/bookshelf icon, Lexicon uses a dictionary/letter icon — and the previous book icon is no longer used anywhere in the chrome.
3. **Given** I am on the Library page, **When** I look at the bottom nav, **Then** the Library icon is visually marked as active (distinct from the other two).
4. **Given** I scroll to the bottom of a long page, **When** the page reaches its end, **Then** the final content is fully visible — not visually clipped, covered, or obscured by the floating nav bar.
5. **Given** the top header is removed, **When** I look for the previous header actions (theme toggle, add book, sign out), **Then** each action is still reachable from somewhere in the app (decision on placement documented in Assumptions), and no action is lost.
6. **Given** I am on a touch device, **When** I tap any destination in the bottom nav, **Then** the tap target is at least 44×44 CSS pixels and the route changes without mis-tap on adjacent destinations.

---

### Edge Cases

- **No books in library + opening Add Word from Lexicon page**: The dialog must prevent submission and prompt the user to add a book first (the book selector would otherwise be empty).
- **Book deleted while its entries still exist**: Word of the Day must not crash when it encounters an entry whose `bookId` no longer resolves; show "from: (removed book)" rather than an empty string, and still allow review.
- **All entries are future-dated**: Word of the Day should still pick one (the closest upcoming) rather than disappearing — today the card silently hides.
- **User advances Word of the Day, no more due**: Card should either show a friendly "all caught up" state or the next upcoming entry; must not flash empty and stay blank mid-day.
- **Very short device (landscape phone)**: Bottom nav must not overlap system gesture area on iOS/Android safe-insets; respect `env(safe-area-inset-bottom)`.
- **Scrollable content + bottom nav**: The last visible page element must remain fully readable; pages must reserve bottom padding equal to nav height + safe-area inset.
- **Add Word dialog on Book Detail for an unsaved/unknown book**: If the detail page is somehow opened with no valid book id, the Add Word button must be disabled — never silently attach to "some" book.

## Requirements *(mandatory)*

### Functional Requirements

**Lexicon — Book Association (Stories 1 & 2)**

- **FR-001**: The Add Word flow launched from the Lexicon page MUST require the user to explicitly choose a book before the entry can be saved.
- **FR-002**: The Book selector in the Lexicon-page Add Word dialog MUST be pre-filled with the currently filtered book when the Lexicon page filter is set to a specific book, and MUST be empty (requiring selection) when the filter is "All Books".
- **FR-003**: The Add Word flow launched from the Book Detail page MUST fix the book to that page's book and MUST NOT expose a book-selector control.
- **FR-004**: The system MUST persist the `book_id` chosen (Lexicon page) or inferred-from-context (Book Detail page) on every new `lexicon_entries` row; no silent fallback to "first book in library" is allowed.
- **FR-005**: When adding a word from Book Detail without an explicit page, the system MUST default `page_found` to the reader's current progress page for that book (or leave it null if no progress record exists).
- **FR-006**: The Book Detail page MUST show a small indicator of how many lexicon entries are saved for that book, linking to the Lexicon page pre-filtered to that book. Whether a full list is shown inline is left as a design choice (see Assumptions).

**Word of the Day (Story 3)**

- **FR-007**: The Word of the Day selection MUST be deterministic within a single calendar day for a given user — visiting the dashboard multiple times on the same day returns the same entry unless the user acts on it (advance/reset).
- **FR-008**: Selection order MUST be: (1) entries with `nextReviewAt ≤ today`, ordered by ascending `leitnerBox`, then ascending `nextReviewAt`, then stable tiebreaker (e.g. `createdAt`); (2) if none are due, the entry with the soonest future `nextReviewAt`, clearly labelled as a preview.
- **FR-009**: After the user advances or resets the current Word of the Day, the card MUST immediately re-select the next best candidate (not go blank until a full reload).
- **FR-010**: The "from: <book>" line on the Word of the Day card MUST display the real book associated with the entry; when the associated book no longer exists, the system MUST display a clear placeholder ("removed book") rather than an empty string.
- **FR-011**: The lexicon store MUST cache `wordOfTheDay` selection per calendar day (not per render) to guarantee stability and avoid unnecessary recomputation.

**Bottom Floating Navigation (Story 4)**

- **FR-012**: The application MUST render a floating bottom navigation bar on all authenticated routes, replacing the existing top header.
- **FR-013**: The bottom bar MUST contain exactly three destinations in this order: Home, Library, Lexicon; each represented by a single icon (no text labels required, but labels may be shown at larger viewports or on active state).
- **FR-014**: The icon set MUST NOT include the book (pi-book) glyph anywhere in the primary chrome. Home must use a home/house icon, Library must use a stack/bookshelf icon, Lexicon must use a dictionary or letter icon.
- **FR-015**: The active destination MUST be visually distinguished from inactive destinations (e.g. filled vs. outlined, accent color, elevated state) with a contrast ratio meeting WCAG AA.
- **FR-016**: All pages MUST reserve bottom padding equal to the nav height plus `env(safe-area-inset-bottom)` so no page content is clipped or obscured by the nav.
- **FR-017**: Every destination tap target MUST be at least 44×44 CSS pixels.
- **FR-018**: The bar MUST remain visible while the user scrolls (not hide-on-scroll) to match the "existing floating nav" reference the user called out.
- **FR-019**: Actions previously in the top header (theme toggle, add book, sign out) MUST be preserved. Recommended placement: theme toggle and sign out move into a Settings/Profile affordance accessible from the Home (or an added fourth slot) — final placement to be decided during planning but no action may be dropped.
- **FR-020**: The bottom nav MUST be hidden on unauthenticated routes (e.g. the auth page) — it is an authenticated-chrome component.

### Key Entities *(include if feature involves data)*

- **LexiconEntry** (existing): `book_id` moves from "effectively optional" (silently backfilled) to "authoritatively set at creation time"; no schema change, but creation paths must validate.
- **ReadingProgress** (existing): read-only dependency for FR-005 (current page as default `page_found`).
- **Book** (existing): read-only dependency for book selector and Word of the Day source line.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created lexicon entries have a `book_id` that matches the book the user explicitly chose or the book whose detail page they were on — zero silent fallback associations.
- **SC-002**: A reader on a book detail page can capture a new word in ≤ 15 seconds from tapping "Add Word" to seeing a save-confirmation, without leaving the Book Detail page.
- **SC-003**: Word of the Day returns the same entry for 100% of same-day revisits (within a single calendar day, absent user action on the card).
- **SC-004**: Word of the Day is non-empty for any user who has ≥1 lexicon entry, across 100% of dashboard loads.
- **SC-005**: On mobile viewport (≤480px wide), bottom nav replaces the top header and frees ≥56px of vertical content space above the fold.
- **SC-006**: All page content on every route is fully reachable/visible when scrolled to the end — 0 reports of content clipped behind the bottom nav.
- **SC-007**: All three bottom-nav destinations pass a 44×44 CSS-pixel tap-target audit.
- **SC-008**: No functional regression: every action previously available in the top header (theme toggle, add book, sign out) remains reachable within at most 2 taps from any authenticated screen.

## Assumptions

- The inline word-list on the Book Detail page is **out of scope** for v1 — the page shows only a count + link-to-lexicon indicator. This keeps BookDetailPage visually lean and avoids duplicating the Lexicon page's list UI. Can be revisited later.
- Free Dictionary API auto-lookup behavior in the Add Word dialog is unchanged; only the book-selection UI and save-validation are new.
- Leitner intervals `[1, 2, 4, 8, 16]` days and 5-box advancement logic remain unchanged — Story 3 is a selection/caching review, not a spaced-repetition algorithm rewrite.
- "Modern app layout" is interpreted as iOS/Android-style bottom tab bar floating above content with glass surface (matching existing `.glass-surface` style), not edge-to-edge.
- Theme toggle, Add Book, and Sign Out placement after top-header removal is implementation detail resolved during `/speckit.plan` — this spec only requires they remain reachable.
- Icon choices are drawn from the existing PrimeIcons set already shipped with PrimeVue (e.g. `pi-home`, `pi-th-large` / `pi-server`, `pi-language` / `pi-bookmark`) — final glyph per destination is a design decision in planning, constrained by FR-014 (no `pi-book`).
- No database migration is required. `lexicon_entries.book_id` is already a non-null FK; the fix is client-side enforcement of explicit selection.
