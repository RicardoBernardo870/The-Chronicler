# Feature Specification: Session Persistence & Dashboard Polish

**Feature Branch**: `002-session-dashboard-polish`  
**Created**: 2026-04-16  
**Status**: Draft  
**Input**: User description: "Phase 2 adjustments — persistent login, dashboard in-progress/completed sections, library sort order, recap accordion UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistent Login Session (Priority: P1)

A user opens the app, logs in, then refreshes the page or closes and reopens the browser tab. They expect to still be authenticated without having to log in again. Currently the app loses the session on every page refresh, forcing repeated logins and destroying the reading-companion experience.

**Why this priority**: Authentication state is foundational. Every other story depends on the user being recognised. A broken session makes the app feel unreliable and actively discourages use.

**Independent Test**: Open the app, log in, hit refresh — user should land on their Dashboard still authenticated. Delivers immediate retention value independently of all other stories.

**Acceptance Scenarios**:

1. **Given** a user has previously logged in, **When** they refresh the page, **Then** they remain on the Dashboard without being redirected to the login screen.
2. **Given** a user has previously logged in, **When** they close the tab and reopen the app within the same browser session, **Then** they are still logged in.
3. **Given** a user explicitly signs out, **When** they visit the app again, **Then** they are presented with the login screen.
4. **Given** a user's session has genuinely expired, **When** they visit the app, **Then** they are redirected to login with a clear message.

---

### User Story 2 - Dashboard Reading Overview (Priority: P2)

A user opens the Dashboard and immediately sees the full picture of their reading activity: their current active read (the last-updated book), a list of all books still in progress below it, and a "Completed" section showing their most recently finished books. The layout gives them everything they need to decide what to do next without visiting the Library.

**Why this priority**: The Dashboard is the home screen. Without this overview it is just a single card with no context. This story makes the home screen genuinely useful and is the highest-value UX change after login persistence.

**Independent Test**: Add 3+ books with varying progress percentages including at least one at 100%. Open the Dashboard — all three sections (active read, in-progress list, completed list) must render correctly with accurate data.

**Acceptance Scenarios**:

1. **Given** a user has books with progress between 1–99%, **When** they open the Dashboard, **Then** all in-progress books appear in a list section labelled implicitly as continuing reads, above the Completed section.
2. **Given** a user has books at exactly 100% progress, **When** they open the Dashboard, **Then** up to 2 of the most recently completed books appear in a "Completed" section below the in-progress list.
3. **Given** a user has more than 2 completed books, **When** they view the Completed section, **Then** only the 2 most recent are shown, plus a hint directing them to the Library to see all completed books.
4. **Given** a user has no completed books, **When** they open the Dashboard, **Then** the Completed section is not shown at all.
5. **Given** a user has no in-progress books, **When** they open the Dashboard, **Then** the in-progress list section is not shown.
6. **Given** the currently active read reaches 100%, **When** the Dashboard is viewed, **Then** it moves out of the "active read" card and into the Completed section.

---

### User Story 3 - Library Sort Order (Priority: P3)

A user visits the Library and finds books sorted by reading priority: in-progress books appear first ordered from least to most complete (so the book they are furthest behind on is nearest the top), and fully completed books appear at the bottom.

**Why this priority**: A sorted Library reduces the cognitive effort of deciding what to read next. It is a single-query change with high daily-use impact.

**Independent Test**: Add books at 0%, 35%, 80%, and 100% progress. Open the Library — verify order is 0% → 35% → 80% → 100%.

**Acceptance Scenarios**:

1. **Given** a user has books at various progress levels, **When** they open the Library, **Then** books are displayed in ascending order of completion percentage (least complete first).
2. **Given** books with identical progress percentages, **When** displayed in the Library, **Then** they are ordered by most recently updated (most recent first) as a tie-breaker.
3. **Given** a user completes a book (reaches 100%), **When** they view the Library, **Then** that book moves to the bottom of the list.

---

### User Story 4 - Recap Accordion UI (Priority: P4)

A user generates an AI recap and sees the three sections — Memory Jogger, Concept Watchlist, and Thematic Bridge — presented as collapsible accordion panels rather than always-expanded cards. Each panel can be individually opened or closed. By default all three open on generation so the user can read through them, then collapse what they have absorbed.

**Why this priority**: Accordion panels reduce visual clutter on smaller screens and let users focus on one section at a time. It is a contained UI change that does not affect any data or logic.

**Independent Test**: Generate a recap. Verify three accordion panels appear, all open by default. Click each panel header to collapse and expand it independently.

**Acceptance Scenarios**:

1. **Given** a recap has been generated, **When** the result is displayed, **Then** three accordion panels are shown: "Memory Jogger" (expanded by default), "Concept Watchlist" (collapsed by default), and "Thematic Bridge" (collapsed by default).
2. **Given** an accordion panel is expanded, **When** the user taps/clicks the panel header, **Then** the panel collapses smoothly.
3. **Given** an accordion panel is collapsed, **When** the user taps/clicks the panel header, **Then** the panel expands showing its content.
4. **Given** multiple panels are open, **When** the user closes one, **Then** the others remain in their current state (panels are independent, not mutually exclusive).
5. **Given** a recap is viewed in the recap history, **Then** the same accordion layout applies to historical recaps in RecapCard.

---

### Edge Cases

- What happens if the user refreshes mid-recap generation? Session must be preserved and the stream should fail gracefully (not hang indefinitely).
- What if a book's progress is exactly 0%? It counts as in-progress and appears in the in-progress list (not completed, not hidden).
- What if the user has only one book and it is completed? Only the Completed section appears on the Dashboard; in-progress section is hidden.
- What if the session token expires while the user has the app open? The next authenticated action should redirect to login with a clear explanation.
- What if there are no books at all? The Dashboard shows a prompt to add a first book; no in-progress or completed sections are rendered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST restore a valid user session automatically when the page is loaded or refreshed, without requiring the user to log in again.
- **FR-002**: The app MUST redirect to the login screen only when no valid session exists or the session has genuinely expired.
- **FR-003**: The Dashboard MUST display all books with progress between 1% and 99% in an "in-progress" list section, ordered by most recently updated.
- **FR-004**: The Dashboard MUST display a "Completed" section showing the 2 most recently completed books (100% progress), ordered by completion date descending.
- **FR-005**: When more than 2 completed books exist, the Dashboard MUST show a dismissible hint directing the user to the Library to view all completed books.
- **FR-006**: The Dashboard in-progress section MUST NOT appear if there are no in-progress books.
- **FR-007**: The Dashboard Completed section MUST NOT appear if there are no completed books.
- **FR-008**: The Library MUST display books sorted in ascending order of reading progress percentage (0% first, 100% last).
- **FR-009**: When multiple books share the same progress percentage, the Library MUST use last-updated date as a tie-breaker (most recently updated first).
- **FR-010**: The AI Recap result MUST display its three sections (Memory Jogger, Concept Watchlist, Thematic Bridge) as individually collapsible accordion panels.
- **FR-011**: Only the "Memory Jogger" accordion panel MUST be expanded by default when a recap is first generated or viewed; "Concept Watchlist" and "Thematic Bridge" MUST be collapsed by default.
- **FR-012**: Accordion panels in the recap MUST operate independently — collapsing one must not affect the others.
- **FR-013**: The accordion layout MUST apply consistently to both freshly generated recaps and historical recaps viewed from recap history.

### Key Entities

- **Session**: Represents the authenticated user's identity token persisted across page loads; has a validity window and expiry state.
- **Book**: Has a `progress_percentage` (0–100) and a `last_updated` timestamp, both used for sorting and section assignment.
- **Recap**: Has three named content sections (memory_jogger, concept_watchlist, thematic_bridge) rendered as accordion panels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of page refreshes for an authenticated user result in the user remaining logged in without a login prompt.
- **SC-002**: The Dashboard correctly categorises all books into the right sections (in-progress vs completed) in 100% of cases.
- **SC-003**: Completed section never shows more than 2 books; overflow hint appears whenever the count exceeds 2.
- **SC-004**: Library book order matches ascending progress percentage in 100% of render cases.
- **SC-005**: All three recap accordion panels are independently togglable with no panel state affecting another.
- **SC-006**: Users can reach any section of the Dashboard overview within 1 tap/scroll from the home screen.

## Assumptions

- The existing authentication system uses token-based sessions that can be stored and retrieved client-side; no server-side session storage changes are required.
- "Last edited book" on the Dashboard (the hero card) continues to show the most recently updated book regardless of its completion status, unless it is 100% complete — in which case the hero card shows the most recently updated in-progress book instead.
- Books with 0% progress are treated as in-progress (not "not started" as a separate category) for the purposes of this feature.
- The "Completed" section on the Dashboard is sorted by most recently completed (the date progress reached 100%), not alphabetically or by date added.
- Recap history cards in the history page use the same accordion component as the live recap stream result.
- No new backend schema changes are required for this feature; all sorting and filtering is done on data already available from existing queries.
