# Feature Specification: Dashboard UX & Lore Sync

**Feature Branch**: `010-dashboard-ux-sync`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "Dashboard UX improvements — inline recap streaming, lore card collapsible parity, global New Lore notification sync"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Navigate Directly to Book Details (Priority: P1)

A reader on the Dashboard sees their currently-reading book in the "Your Reading" card. Instead of being sent to the library list, they want a single tap to jump directly to the full Book Details page.

**Why this priority**: The most frequent navigation action on the Dashboard. Removing the extra hop from Library → Book Detail reduces friction for every reading session start.

**Independent Test**: Change the button label and route; confirm it lands on the correct Book Details page for the active book.

**Acceptance Scenarios**:

1. **Given** the user has an active book, **When** they tap "View Book" on the "Your Reading" card, **Then** they are taken directly to the Book Details page for that book.
2. **Given** the "Your Reading" card is rendered, **When** the user looks at the action button, **Then** the label reads "View Book" (not "View Library").

---

### User Story 2 — Inline Recap Streaming on Dashboard (Priority: P1)

A reader on the Dashboard wants to generate and read an AI recap without leaving the home screen. The recap should appear below the "Your Reading" card, respect the same unlock rules as the Book Details page, and be saved to recap history when complete.

**Why this priority**: Core UX improvement. Users currently must navigate away to generate a recap, creating unnecessary friction.

**Independent Test**: Trigger recap generation on Dashboard; verify stream renders inline, recap is saved to history after completion, and state clears on navigation away.

**Acceptance Scenarios**:

1. **Given** the recap unlock conditions are met, **When** the user taps "Get Recap", **Then** the AI recap streams inline below the "Your Reading" card without any navigation.
2. **Given** the recap is actively streaming, **When** the user navigates away from the Dashboard, **Then** the stream state disappears from the Dashboard and the completed portion (if any) that was fully committed before navigation remains in recap history.
3. **Given** a fully completed recap stream, **When** the stream finishes, **Then** the recap is saved to recap history and viewable from Recap History.
4. **Given** the recap unlock conditions are NOT met (insufficient pages AND less than 3 days since last session), **When** the user views the Dashboard, **Then** the "Get Recap" button shows as locked with the number of pages remaining to unlock (matching the Book Details lock behavior).
5. **Given** the recap lock condition IS met by the 3-day time escape (≥3 days since last progress update), **When** the user views the Dashboard, **Then** the "Get Recap" button is unlocked even if page threshold hasn't been reached.
6. **Given** a mid-stream abort (user dismisses before completion), **When** the dismiss action occurs, **Then** no partial recap is saved to history.

---

### User Story 3 — Collapsible Lore Card on Book Details (Priority: P2)

A reader on the Book Details page can now expand and collapse lore cards inline rather than being redirected to the Great Library tab. When a new lore card is generated in the background, it appears immediately on the Book Details page without requiring a refresh or re-navigation.

**Why this priority**: Eliminates the need to navigate away to read lore. Reactivity fix ensures users who are actively reading their book details always see new lore as it arrives.

**Independent Test**: Open Book Details; verify lore card is collapsible with expand/collapse toggle; trigger a background lore generation; verify it appears without page navigation.

**Acceptance Scenarios**:

1. **Given** the user is on Book Details and lore cards exist, **When** they tap the lore card, **Then** it expands to show full content (mirrors the LoreCardList expandable pattern).
2. **Given** the lore card is expanded, **When** the user taps it again, **Then** it collapses back to the excerpt view.
3. **Given** multiple lore cards exist, **When** the user taps the Refresh/cycle button, **Then** a different card is shown (existing cycling behavior preserved).
4. **Given** the user is on Book Details and a new lore card is generated in the background, **When** generation completes, **Then** the new card appears in the lore section immediately without any page refresh or re-navigation.

---

### User Story 4 — Global "New Lore" Indicator Sync (Priority: P2)

When a user interacts with new lore content (either by navigating to Book Details or by viewing it inline on the Dashboard), the "New Lore" indicator disappears from all locations (Dashboard chip, Library card badge) without requiring a separate action.

**Why this priority**: Prevents stale "New Lore" indicators from appearing after the user has already seen the content, reducing notification noise.

**Independent Test**: Trigger lore generation; verify "New Lore" badge appears; interact with lore on either Dashboard or Book Details; verify badge disappears everywhere.

**Acceptance Scenarios**:

1. **Given** a "New Lore" indicator is showing on a book card (Dashboard or Library), **When** the user navigates to that book's Book Details page and the page mounts, **Then** the "New Lore" indicator disappears from all cards showing that book across the app.
2. **Given** a "New Lore" indicator is showing, **When** the user clicks the "New Lore" button/chip, **Then** they are navigated to Book Details and the indicator clears.
3. **Given** lore is being generated (the "generating" chip is visible), **When** generation completes, **Then** only the indicator for the specific book updates; other books are unaffected.

---

### Edge Cases

- What happens when the user starts a recap stream on the Dashboard and then opens the same Book Details page in the same session? The recap stream should not duplicate or conflict — the shared store state must be consistent.
- What happens when the Book Details page is open and lore generation fails silently? The lore section should remain unchanged (no error state shown).
- What happens when there are no lore cards yet for the current book? The lore section renders its empty/skeleton state without errors.
- What happens when the recap lock unlock conditions change while the Dashboard is mounted (e.g., user saves progress from another tab)? The lock state should update reactively.
- What happens when the user dismisses an in-progress inline recap and immediately triggers another? The prior abort should complete before a new stream starts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The "Your Reading" card on the Dashboard MUST display a "View Book" button that navigates directly to the Book Details page for the active book.
- **FR-002**: The "Get Recap" button on the Dashboard MUST be locked (disabled with a page count hint) when: the user has not advanced at least the required threshold since the last recap AND fewer than 3 days have passed since the last progress update.
- **FR-003**: The "Get Recap" button on the Dashboard MUST be unlocked when at least one of the following is true: the page threshold has been reached since the last recap, OR 3 or more days have passed since the last progress update.
- **FR-004**: When "Get Recap" is tapped on the Dashboard, the AI recap stream MUST render inline below the "Your Reading" card — no navigation occurs.
- **FR-005**: A completed recap stream on the Dashboard MUST be persisted to recap history, identical to the behaviour in Book Details.
- **FR-006**: When a user navigates away from the Dashboard with an active or completed recap stream, the local stream state MUST reset (stream disappears from UI), while any already-persisted recap remains in history.
- **FR-007**: A mid-stream dismiss (user dismisses before stream completes) MUST abort the stream and MUST NOT write a partial recap to history.
- **FR-008**: The lore card on the Book Details page MUST support inline expand/collapse interaction, matching the card pattern used in LoreCardList (toggle on click, excerpt when collapsed, full content when expanded).
- **FR-009**: The lore card on the Book Details page MUST retain the ability to cycle through multiple lore cards for the same book via a Refresh/cycle button.
- **FR-010**: The lore section on the Book Details page MUST update reactively when a new lore card is generated in the background — the new card MUST appear without any page navigation or manual refresh.
- **FR-011**: When a user mounts the Book Details page for a book that has unseen lore cards, the system MUST mark those cards as seen, clearing the "New Lore" indicator for that book across the entire app.
- **FR-012**: Clicking the "New Lore" chip/button on the Dashboard MUST navigate to the corresponding Book Details page, and the "New Lore" indicator MUST clear upon arrival.
- **FR-013**: The recap lock logic MUST be sourced from a single shared location (composable or store helper) to ensure Dashboard and Book Details always apply identical rules.

### Key Entities *(include if feature involves data)*

- **Recap**: A generated AI summary associated with a book. Has a `progressSnapshot` (percentage at generation time), `pageSnapshot`, and `createdAt`. Persisted to history when the stream completes successfully.
- **LoreCard**: A generated world-building entry for a book. Has a `seen` boolean flag. Marking as seen clears "New Lore" indicators for that book.
- **ReadingProgress**: Tracks `currentPage` and `updatedAt` for the active book. Used to compute recap lock status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate from the Dashboard to their active Book Details page in 1 tap (down from 2+ taps via Library).
- **SC-002**: 100% of completed recap streams initiated from the Dashboard appear in recap history — zero loss of data.
- **SC-003**: The "New Lore" indicator is cleared within the same session interaction (no additional tap required) when the user visits Book Details for that book.
- **SC-004**: New lore cards generated while a user is on the Book Details page appear in under 1 second of generation completing (reactive update, no refresh).
- **SC-005**: The recap lock state on the Dashboard matches the lock state on Book Details 100% of the time for the same book (zero divergence).
- **SC-006**: Users can read a full lore card inline on Book Details without navigating to the Great Library tab (0 extra navigation steps).

## Assumptions

- The existing `recapsStore` and `loreCardsStore` Pinia stores are the single source of truth; no new backend tables or edge functions are required.
- The recap lock threshold (pages since last recap) is defined as: last recap's `progressSnapshot` + 5% of total pages. This is already implemented in `BookDetailsPage.vue` and will be shared via composable.
- The 3-day time escape hatch is based on `progress.updatedAt`, not `createdAt` of the last recap.
- A "mid-stream dismiss" is any user action that aborts the stream before the `streamRecap` promise resolves with a non-aborted result.
- The "New Lore" indicator uses the `seen` field on `LoreCard`. Marking seen is handled by calling `loreStore.markBookLoreSeen(bookId)`, which already exists.
- Lore card cycling on Book Details operates on locally cached cards in the store — no additional fetch is required per cycle.
- The shared recap lock logic will be extracted into a composable (`useRecapLock`) to be consumed by both Dashboard and Book Details, ensuring zero divergence.
- Existing styling (glass-surface cards, PrimeVue components, The Chronicler persona animations) is preserved unchanged.
- Mobile/responsive behaviour follows existing patterns — no new breakpoints needed.
