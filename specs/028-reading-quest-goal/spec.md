# Feature Specification: Reading Quest Goal

**Feature Branch**: `028-reading-quest-goal`  
**Created**: 2026-05-12  
**Status**: Draft  
**Input**: User description: "Create a gamified Profile experience centered on a yearly reading goal, a Reading Quest card, and a lightweight reader level system."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set a Yearly Reading Goal (Priority: P1)

As a reader, I want to set and edit my book goal for the current year so the app can show whether my reading year is on track.

**Why this priority**: The yearly goal is the foundation for the Reading Quest experience. Without it, the profile can show stats but cannot compare progress against the user's personal target.

**Independent Test**: Can be fully tested by opening the Profile page with no current-year goal, setting a target number of books, refreshing the app, and confirming the saved goal and progress return.

**Acceptance Scenarios**:

1. **Given** the user has no goal for the current year, **When** they choose the Reading Quest action to set a goal and enter a valid target, **Then** the Profile page shows the saved goal for the current year.
2. **Given** the user already has a goal for the current year, **When** they edit the goal to a new valid target, **Then** the Reading Quest card updates to use the new target without changing historical reading activity.
3. **Given** the user enters an invalid target such as zero, a negative number, or a non-number, **When** they try to save, **Then** the app prevents saving and explains that the goal must be at least one book.

---

### User Story 2 - Track Reading Quest Progress (Priority: P1)

As a reader with a yearly goal, I want to see my completed books, goal progress, required pace, current pace, and projected year-end total in one calm card so I understand my reading year at a glance.

**Why this priority**: This is the central user-visible value of the feature. It turns a static goal into an actionable, motivating profile experience.

**Independent Test**: Can be fully tested by using a user account with a current-year goal and completed books, then verifying the Reading Quest card shows progress, percentage, pace comparison, projection, and a friendly status.

**Acceptance Scenarios**:

1. **Given** the user has a current-year goal and completed books in that same year, **When** the Profile page loads, **Then** the Reading Quest card shows completed books versus target and percent complete.
2. **Given** the user's projected year-end total meets or exceeds the target, **When** the Profile page loads, **Then** the card shows an encouraging status of "Ahead of pace" or "On track."
3. **Given** the user's projected year-end total is below the target, **When** the Profile page loads, **Then** the card shows a gentle status of "A little behind" or "Comeback arc available" without guilt-heavy language.
4. **Given** the user has insufficient recent reading history for a reliable projection, **When** the card loads, **Then** it still shows goal progress and required monthly pace while softening or hiding projection details.

---

### User Story 3 - See Reader Level Progress (Priority: P2)

As a reader, I want a lightweight level and XP display based on my real reading activity so the Profile page feels rewarding without requiring extra manual tracking.

**Why this priority**: The level system adds gamified delight after the goal experience is useful. It should reward existing behavior rather than become a separate task.

**Independent Test**: Can be fully tested by using an account with pages read, sessions, completed books, captures, recaps, and lore cards, then confirming XP, level title, and next-level progress reflect those activities.

**Acceptance Scenarios**:

1. **Given** the user has qualifying reading activity, **When** the Profile page loads, **Then** the level area shows total XP, current level title, and progress toward the next level.
2. **Given** the user earns more qualifying activity, **When** the Profile page is refreshed after that activity is saved, **Then** XP and level progress update without requiring manual XP entry.
3. **Given** the user has no qualifying activity, **When** the Profile page loads, **Then** the level area shows a starting level and clear progress from zero.

---

### User Story 4 - Preserve Existing Profile Experience (Priority: P3)

As a reader, I want the new gamified profile elements to fit naturally with my existing Reading DNA, lifetime stats, forecast, and library breakdown so the page remains useful and uncluttered.

**Why this priority**: The Profile page already contains several meaningful cards. The new feature must enhance the page without disrupting existing behavior.

**Independent Test**: Can be tested by loading the Profile page before and after enabling a goal and confirming all existing profile cards still load and remain readable.

**Acceptance Scenarios**:

1. **Given** the Profile page has existing cards, **When** the new Reading Quest and level elements appear, **Then** all existing cards still render and remain accessible.
2. **Given** the user has no yearly goal yet, **When** the Profile page loads, **Then** the new empty state invites action without blocking existing profile content.

---

### Edge Cases

- A user completes more books than the yearly target; the card shows the goal as complete while continuing to display the actual completed count.
- A user lowers the goal below the number of books already completed; the card immediately treats the goal as achieved.
- A user has completed books but no reliable completion timestamp; the system uses the best available progress update timestamp to decide whether the completion belongs to the current year.
- A user has books with missing or zero page counts; those books still count for completed-book goals but are excluded from page-based XP and pace calculations.
- A user has no current-year goal; the card shows an inviting empty state rather than a broken or zeroed progress card.
- A user has no recent reading history; projections are hidden or softened, but the saved goal and completed-book progress remain visible.
- The calendar year changes; the Profile page uses the new current year and does not carry over the prior year's goal as the active goal.
- Activity data changes after a book is edited or removed; goal progress and XP update to reflect the user's current saved library and activity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to set one yearly book goal for the current calendar year.
- **FR-002**: Users MUST be able to edit their current-year book goal after it has been created.
- **FR-003**: The system MUST persist yearly goals per user and per calendar year.
- **FR-004**: The system MUST prevent invalid goal targets, including values below one book.
- **FR-005**: The Profile page MUST show a Reading Quest card for the current calendar year.
- **FR-006**: If no current-year goal exists, the Reading Quest card MUST show an empty state with a clear action to set a goal.
- **FR-007**: The Reading Quest card MUST count books completed during the current calendar year toward the current-year goal.
- **FR-008**: The system MUST determine completion timing from the best available completion or progress timestamp when deciding whether a book counts for the current year.
- **FR-009**: The Reading Quest card MUST show completed books versus goal, percent complete, and a visual progress indicator.
- **FR-010**: The Reading Quest card MUST show required monthly pace to reach the goal.
- **FR-011**: The Reading Quest card MUST show the user's current monthly pace when enough reading history exists.
- **FR-012**: The Reading Quest card MUST show a projected year-end completed-book total when enough reading history exists.
- **FR-013**: The Reading Quest card MUST classify the user's goal status using friendly labels: "Ahead of pace," "On track," "A little behind," or "Comeback arc available."
- **FR-014**: The Reading Quest card MUST avoid guilt-heavy or punitive language in all goal states.
- **FR-015**: If pace history is insufficient, the Reading Quest card MUST still show goal progress and use supportive copy indicating that pace projections will unlock with more logged progress.
- **FR-016**: The system MUST compute reader XP from existing saved reading activity rather than requiring users to manually enter XP.
- **FR-017**: XP MUST include page progress, completed books, reading sessions, page captures, recaps, and lore cards when those activities exist.
- **FR-018**: The Profile page MUST show current reader level, level title, total XP, progress toward the next level, and a short next-level message.
- **FR-019**: Level titles MUST use a literary tone aligned with BookHero, including a progression similar to Page Turner, Chapter Seeker, Margin Walker, Lore Keeper, Archive Runner, Chapter Sage, and Library Legend.
- **FR-020**: Level thresholds MUST be deterministic so the same saved activity always produces the same XP, level, and next-level progress.
- **FR-021**: The new Reading Quest and level UI MUST preserve existing Profile page content and must not block existing profile cards from loading.
- **FR-022**: Goal progress and XP MUST update after relevant reading activity is saved, including progress updates, completions, captures, recaps, and lore unlocks.

### Key Entities *(include if feature involves data)*

- **Reading Goal**: A user's target number of books for a specific calendar year. Key attributes include owner, year, target book count, creation time, and last update time.
- **Reading Quest Summary**: The current-year display model combining goal target, books completed this year, percent complete, required monthly pace, current monthly pace, projected year-end total, and friendly status label.
- **Reader XP Summary**: The user's total XP derived from saved activity, current level number, level title, XP earned within the current level, XP required for the next level, and next-level message.
- **Qualifying Reading Activity**: Existing reading events and artifacts that contribute to XP or goal progress, including page progress, completed books, reading sessions, page captures, recaps, and lore cards.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no current-year goal can create a valid yearly goal from the Profile page in under 30 seconds.
- **SC-002**: A user with an existing current-year goal can edit the target and see updated progress on the Profile page without reloading manually.
- **SC-003**: For a user with known completed books in the current year, the Reading Quest card displays the correct completed count and percent progress in 100% of tested cases.
- **SC-004**: For users with sufficient pace history, the card displays required monthly pace, current monthly pace, and projected year-end total in a single Profile page load.
- **SC-005**: For users without sufficient pace history, the card still displays goal progress and a supportive no-projection state in a single Profile page load.
- **SC-006**: For a user with representative activity across pages, sessions, completed books, captures, recaps, and lore cards, the level area displays deterministic XP and next-level progress in 100% of repeated loads.
- **SC-007**: Existing Profile page cards remain visible and usable for users with no goal, an active goal, and an achieved goal.
- **SC-008**: At least 90% of first-time users in review can understand whether they are on track toward their yearly goal without additional explanation.

## Assumptions

- The active goal is always for the user's current calendar year in v1.
- A completed book counts once toward a yearly goal, even if later edits change the target goal.
- Completion date is determined from the best available saved completion/progress timestamp; if exact completion tracking is added later, it can replace this fallback.
- Reading pace projections use recent reading behavior when available and degrade gracefully when history is too sparse.
- XP is a derived score from saved activity in v1; users do not manually adjust XP.
- Vocabulary activity is excluded from v1 XP unless reliable review/addition counts are already available during planning.
- Goal sharing, friend leaderboards, and social competition are out of scope for v1.
