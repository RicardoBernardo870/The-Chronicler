# Feature Specification: Dashboard State Logic Refactor

**Feature Branch**: `011-dashboard-state-refactor`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "Dashboard State Logic Refactor & New Component Implementation — fix book progress state leak, enable Current Book swapping via Up Next, audit VelocityBadge for edge cases, add Last Session card"

## Clarifications

### Session 2026-04-20

- Q: When a completion event fires for a book that is not the current hero, should the hero change? → A: Only promote on completion if the completed book is the current hero. Explicit swap wins in all other cases.
- Q: Does the hero book appear in Up Next while it is the hero? → A: Hide the current hero from Up Next entirely. Up Next shows in-progress books excluding the hero.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix Book Progress State Leak (Priority: P1)

A reader finishes their current book, marking it complete. The next "In Progress" book from the library is automatically promoted to the Dashboard hero card, but the progress bar and page counter are stuck showing the prior book's final values (e.g., "320 / 320"), misrepresenting the new book's actual reading state.

**Why this priority**: This is a visible correctness bug on the primary Dashboard surface. It undermines trust in every numeric indicator on the page and must be fixed before any feature work layered on top of book switching.

**Independent Test**: Complete a book whose progress is 100%. Without refresh, confirm the newly promoted hero book shows its own currentPage and percentage — not the completed book's values.

**Acceptance Scenarios**:

1. **Given** Book A (completed, 320/320) is the hero and Book B (in progress, 47/500) is next, **When** the reader marks Book A complete and Book B becomes the hero, **Then** the progress bar fills to 9% (47/500) and the page counter reads "47 / 500".
2. **Given** the user switches between two in-progress books on the Dashboard, **When** the active book changes, **Then** the progress bar and page counter update reactively within one render frame.
3. **Given** the hero book has no progress record yet, **When** it is displayed, **Then** the counter shows "0 / [totalPages]" and the bar is empty (no stale values from a previous book).

---

### User Story 2 - Current Book Swapping from Up Next (Priority: P1)

A reader wants to glance at a different book from their "Up Next" list without leaving the Dashboard. Tapping an Up Next entry should swap that book into the main "Your Reading" hero card — not navigate away. The existing "View Book" button inside the hero card remains the only path to the Book Details page.

**Why this priority**: The Dashboard is the daily-use surface. Forcing full-page navigation to preview any other book breaks flow for multi-book readers and makes the Up Next list feel punitive.

**Independent Test**: Tap any entry in the Up Next list. The hero card must update in place to show that book; URL must not change; "View Book" button must still navigate to BookDetailsPage for the now-active book.

**Acceptance Scenarios**:

1. **Given** the Dashboard shows Book A as hero and Book B in Up Next, **When** the reader taps Book B's Up Next entry, **Then** Book B becomes the hero and Book A moves into the Up Next list; no route change occurs.
2. **Given** the hero card is showing Book B after a swap, **When** the reader clicks "View Book", **Then** the app navigates to the BookDetailsPage for Book B.
3. **Given** the reader marks the current hero book complete, **When** the promotion logic runs, **Then** the next in-progress book from the library auto-fills the hero slot (existing behavior preserved).
4. **Given** the reader reloads the page after swapping, **When** the Dashboard remounts, **Then** the hero selection is predictable (either persisted selection or default promotion rule — see Assumptions).

---

### User Story 3 - VelocityBadge Audit & Hardening (Priority: P2)

A reader with very limited session history (first-time read, ultra-short session, or zero elapsed time) should still see a sensible VelocityBadge — never "NaN pages/hr", "Infinity", or a broken string.

**Why this priority**: Cosmetic and data-integrity concern. Incorrect velocity output appears on multiple surfaces and erodes perceived quality, but does not block core reading flows.

**Independent Test**: Create a book with a single session of <1 minute, and a book with no session history. The badge in each case must render a fallback (e.g., hidden, "—", or "Calculating…") — never a malformed numeric string.

**Acceptance Scenarios**:

1. **Given** a book with no reading sessions yet, **When** the VelocityBadge renders, **Then** it shows a defined fallback state and does not display "NaN" or "Infinity".
2. **Given** a session shorter than the minimum duration threshold, **When** pages/hr would divide by near-zero time, **Then** the badge suppresses the numeric output and shows the fallback.
3. **Given** valid session data ≥ the threshold, **When** the badge renders, **Then** it shows a rounded integer pages-per-hour figure.

---

### User Story 4 - Last Session Dashboard Card (Priority: P2)

A reader lands on the Dashboard and wants a quick pulse on their most recent reading activity: how long ago it was, how much they read in that specific session, and how fast.

**Why this priority**: High-value at-a-glance signal that reinforces habit momentum. Blocked by US1 (state correctness) and US3 (badge hardening) to avoid shipping with stale/NaN output.

**Independent Test**: Finish a reading session, return to Dashboard. A new card near "Your Reading" shows a recency label ("2 hours ago"), a pages-read figure for that session, and a VelocityBadge.

**Acceptance Scenarios**:

1. **Given** the user's most recent session ended 2 hours ago with 15 pages read, **When** the Dashboard mounts, **Then** the Last Session card displays "2 hours ago", "15 pages", and the VelocityBadge for that session.
2. **Given** the most recent session was yesterday, **When** the card renders, **Then** the recency label reads "Yesterday" (or equivalent human-friendly phrasing).
3. **Given** the user has no sessions at all, **When** the Dashboard mounts, **Then** the Last Session card shows an empty/onboarding state or is hidden (see Assumptions) — no broken values.
4. **Given** the hero book changes (via swap or completion), **When** the card re-evaluates, **Then** the Last Session card continues to show the reader's latest session across the library (not filtered to the hero book) — unless scoped otherwise in Assumptions.

---

### Edge Cases

- Hero book changes mid-render (promotion races with user swap tap) — the last action wins; no duplicate hero cards.
- A non-hero book is marked complete (e.g., from Book Details while viewing another book as hero) — hero selection remains unchanged; the completed book simply leaves the Up Next list.
- Up Next list is empty (user has only one in-progress book, which is the hero) — Up Next section renders an empty-state or is hidden.
- VelocityBadge when `totalPages === 0` or `currentPage > totalPages` — must not crash the finish prediction.
- Watchers tied to the old bookId must be torn down when the hero swaps to prevent memory leaks or stale reactivity.
- User switches books rapidly in succession — only the most recent selection's data is shown; no flashes of intermediate stale values.
- Cache hits: swapping to a book whose progress is already cached must render immediately from cache; a cache miss must show a skeleton, not a stale value from the previous hero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST derive the Dashboard hero card's progress bar and page counter from the currently-active bookId, with no residual state carried over from a previously-active book.
- **FR-002**: System MUST reset or re-derive all book-scoped local state (progress percentage, current page, lock state, velocity references) whenever the active bookId changes.
- **FR-003**: Users MUST be able to tap any entry in the Up Next list to promote that book into the hero card without any route navigation. The Up Next list MUST exclude the currently-active hero.
- **FR-004**: System MUST preserve the "View Book" button inside the hero card as the sole trigger for navigating to the Book Details page.
- **FR-005**: System MUST auto-promote the next in-progress book into the hero slot **only when the completed book is the current hero**. Completion events for non-hero books MUST NOT change the hero selection (explicit user swap wins).
- **FR-006**: VelocityBadge MUST NOT render "NaN", "Infinity", or any malformed numeric output under any session-data condition; it MUST render a fallback label instead.
- **FR-007**: VelocityBadge MUST treat sessions below a minimum duration threshold as insufficient data and display the fallback.
- **FR-008**: System MUST render a new "Last Session" card on the Dashboard, positioned near the "Your Reading" hero section, showing recency, pages read in that session, and a VelocityBadge.
- **FR-009**: Recency in the Last Session card MUST be human-friendly (relative phrasing such as "2 hours ago", "Yesterday", "3 days ago").
- **FR-010**: All introduced watchers MUST be cleaned up on component unmount and on bookId change to prevent memory leaks during rapid book switching.
- **FR-011**: System MUST reuse existing cached progress, recap, and pulse data where available when swapping the hero book; new fetches MUST only fire on cache miss or staleness.
- **FR-012**: Visual styling of new and modified surfaces MUST maintain the Chronicler aesthetic established by prior Dashboard features.

### Key Entities

- **Active Hero Book**: The book currently displayed in the Dashboard "Your Reading" card. Derived from a combination of auto-promotion (completion event) and explicit user selection (Up Next tap).
- **Up Next List**: Ordered collection of in-progress books **excluding the active hero**. The hero is never shown in Up Next. Each entry becomes interactive (promotes on tap).
- **Last Session**: The most recent reading session event across the user's library, with a timestamp, pages-delta, and derived velocity.
- **Velocity Reading**: Pages-per-hour derived from session duration and pages read, with a fallback state for insufficient data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero cases of stale progress values after a hero-book change in manual QA across 10 consecutive book-completion and swap events.
- **SC-002**: 100% of Up Next taps update the hero card without triggering route navigation, measured via acceptance tests covering every Up Next slot.
- **SC-003**: VelocityBadge renders a defined fallback (and never "NaN"/"Infinity") across all tested data conditions: zero sessions, sub-minimum session, normal session, extreme-value session.
- **SC-004**: Last Session card is visible and populated within one render frame of Dashboard mount when at least one qualifying session exists.
- **SC-005**: No memory-leak or watcher-retention warnings appear in console during 20 consecutive hero swaps in development mode.
- **SC-006**: Cached hero-book data renders without a loading skeleton on swap when the cache is fresh (measured by observing no skeleton frame).

## Assumptions

- **Hero persistence**: User's explicit Up Next selection is ephemeral — not persisted across full page reloads. On reload, the auto-promotion rule (first in-progress book by whatever the existing library order uses) reapplies. If persistence is needed it can be added as a follow-up.
- **Last Session scope**: The Last Session card reflects the **most recent session across the entire library**, not the hero book specifically. Rationale: it is a habit/momentum signal, not a book-scoped metric.
- **Empty state**: When the user has zero sessions recorded, the Last Session card is hidden rather than showing an onboarding placeholder (can be revisited later).
- **Minimum velocity session threshold**: A session must be at least 60 seconds with at least 1 page read to qualify for pages-per-hour calculation; below that, fallback text is shown.
- **Relative time phrasing**: Uses coarse buckets — minutes, hours, "Yesterday", days, weeks — no exact timestamps on the card.
- **VelocityBadge surfaces**: The audit and hardening apply to every existing usage of VelocityBadge, not only the new Last Session card.
- **Cache reuse**: Existing SWR cache composable (`useCache.ts`) is reused for progress/recap/pulse lookups when swapping books — no new storage layer introduced.
- **Aesthetic**: The Chronicler visual language (typography, chip styles, card borders) already codified in prior Dashboard features is reused without modification.
