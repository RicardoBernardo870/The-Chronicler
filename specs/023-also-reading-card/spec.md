# Feature Specification: Also Reading Card

**Feature Branch**: `023-also-reading-card`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Add the Also Reading community awareness card to BookHero book detail pages. Show followed readers currently reading the same canonical book or ISBN, respect privacy and blocks server-side, provide reusable read contract, and keep the card ambient and hidden when there are no visible matches."

## Clarifications

### Session 2026-05-03

- Q: How should the feature define the "same area" relative progress label? -> A: Within 10% of the viewer's progress.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Followed Readers On The Same Book (Priority: P1)

As a signed-in reader viewing a book detail page, I want to see a small "Also Reading" card when people I follow are currently reading the same book, so I feel ambient community presence without leaving the book context.

**Why this priority**: This is the core value of the feature and the first community surface that makes follows feel useful during reading.

**Independent Test**: Can be fully tested by setting up one reader who follows another visible reader on the same book, opening the book detail page, and confirming the card appears with the followed reader's public profile summary.

**Acceptance Scenarios**:

1. **Given** the viewer follows one or more readers who are currently reading the same canonical book, **When** the viewer opens that book detail page, **Then** the page shows an "Also Reading" card listing those followed readers.
2. **Given** the viewer follows one or more readers whose current book has a matching ISBN for the viewed book, **When** the viewer opens the book detail page, **Then** the card includes those readers and indicates the match is for the same work even if the internal book record differs.
3. **Given** visible followed readers are found, **When** the card appears, **Then** it shows only a compact default set and provides a way to view any additional visible readers.

---

### User Story 2 - Preserve Privacy And Blocking (Priority: P1)

As a reader, I want my current-reading and progress privacy settings, plus my block relationships, to control whether I appear in another reader's "Also Reading" card, so community awareness never leaks private reading data.

**Why this priority**: The feature is only acceptable if privacy and blocking are enforced before data reaches the viewer.

**Independent Test**: Can be fully tested by changing followed readers' privacy settings and block relationships, opening the same book detail page, and verifying hidden or blocked readers never appear.

**Acceptance Scenarios**:

1. **Given** a followed reader has current-reading visibility set so the viewer is not allowed to see it, **When** the viewer opens the same book detail page, **Then** that reader does not appear in the card.
2. **Given** a followed reader has current-reading visibility visible but progress visibility hidden from the viewer, **When** the viewer opens the same book detail page, **Then** that reader may appear without page, percentage, or relative progress details.
3. **Given** either the viewer or a followed reader has blocked the other, **When** the viewer opens the same book detail page, **Then** the blocked relationship removes that reader from the results entirely.

---

### User Story 3 - Understand Relative Progress When Allowed (Priority: P2)

As a reader, I want to see whether followed readers are ahead, behind, or in roughly the same area when progress is visible, so I can understand shared momentum without comparing exact reading histories unnecessarily.

**Why this priority**: Relative progress is valuable context, but it depends on the core matching and privacy behavior being correct first.

**Independent Test**: Can be tested by setting viewer and followed-reader progress to different points in the same book, allowing progress visibility, and confirming the card displays the correct relative label.

**Acceptance Scenarios**:

1. **Given** both the viewer's and followed reader's progress are visible for the same matched book, **When** the followed reader is meaningfully further along, **Then** the card labels that reader as ahead.
2. **Given** both progress values are visible, **When** the followed reader is meaningfully earlier in the book, **Then** the card labels that reader as behind.
3. **Given** both progress values are visible, **When** the followed reader is near the viewer's current area, **Then** the card labels that reader as in the same area.

---

### User Story 4 - Open A Public Reader Profile (Priority: P3)

As a reader, I want to open a listed person's public profile from the card, so I can learn more about a followed reader when I choose to.

**Why this priority**: This makes the card navigable and connected to the existing community profile system, but the ambient awareness still works without this interaction.

**Independent Test**: Can be tested by selecting a visible reader in the card and confirming the viewer lands on that reader's public profile.

**Acceptance Scenarios**:

1. **Given** the card lists a followed reader with a public profile, **When** the viewer selects that reader, **Then** the viewer is taken to the reader's public profile.
2. **Given** a listed reader's profile summary is visible in the card, **When** the viewer opens it, **Then** the profile page applies its own privacy rules independently of the card.

### Edge Cases

- If no followed readers are visibly reading the same book, the book detail page does not show an empty "Also Reading" card.
- If the viewed book has no ISBN and no shared canonical match, only direct same-book matches are considered.
- If multiple ISBN formats exist for the same work, matching treats normalized ISBN values as equivalent where available.
- If a followed reader has multiple in-progress records that match the viewed book, that reader appears only once with their most relevant active progress.
- If the viewer has no current progress for the book, visible followed readers can still appear, but relative labels are omitted because comparison is not meaningful.
- If a followed reader has current-reading visibility enabled but profile summary visibility restricted or the profile is unavailable, that reader is omitted rather than shown with incomplete identity data.
- If card data is slow or unavailable, the book detail content remains usable and the card area fails silently or with a non-blocking retry state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show an "Also Reading" card on a book detail page only when at least one visible followed reader is currently reading the same book.
- **FR-002**: The system MUST identify same-book matches by shared canonical book identity when available.
- **FR-003**: The system MUST identify same-work matches by ISBN when canonical book identity is not shared and normalized ISBN data is available.
- **FR-004**: The system MUST include only readers the viewer follows.
- **FR-005**: The system MUST exclude any reader when either the viewer has blocked that reader or that reader has blocked the viewer.
- **FR-006**: The system MUST enforce current-reading visibility before returning any reader in the card results.
- **FR-007**: The system MUST enforce progress visibility before returning current page, percentage, or relative progress labels.
- **FR-008**: The system MUST return only card-ready fields: public profile summary, match metadata, visible progress details, and relative progress status when allowed.
- **FR-009**: The system MUST avoid returning hidden reading or progress data that the client would need to filter out.
- **FR-010**: The system MUST distinguish match type at a user-understandable level, such as same edition or same work, without exposing unnecessary internal identifiers.
- **FR-011**: The card MUST show a compact default list of visible readers and provide a way to view more when the result count exceeds the default display count.
- **FR-012**: The card MUST provide navigation from each listed reader to that reader's public profile.
- **FR-013**: The card MUST load independently from core book detail content so book details remain available while community data is loading.
- **FR-014**: The card MUST label a visible followed reader as in the same area when their progress is within 10% of the viewer's progress.
- **FR-015**: The shared read contract for this feature MUST be stable and documented enough for future first-party clients to request the same result shape.
- **FR-016**: The system MUST support efficient lookup for current readers by viewer, followed-reader relationship, book identity, ISBN, active reading status, privacy eligibility, and block relationships.
- **FR-017**: The card MUST omit relative progress labels when either side lacks comparable progress data or progress visibility does not allow comparison.

### Key Entities

- **Viewer**: The signed-in reader opening the book detail page; determines follow relationships, block relationships, and relative progress comparison.
- **Followed Reader**: A reader followed by the viewer who may be eligible to appear when privacy and blocking allow it.
- **Viewed Book**: The book detail record being opened; includes display metadata and any available canonical identity or ISBN values used for matching.
- **Active Reading Progress**: A reader's current in-progress state for a book, including status and optional page or percentage values.
- **Privacy Settings**: Reader-controlled visibility rules for current-reading presence and progress details.
- **Block Relationship**: A relationship in either direction that prevents community awareness between two readers.
- **Also Reading Result**: The card-ready summary for one visible followed reader, including profile summary, match type, optional progress details, and optional relative status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In test accounts where at least one followed reader is visibly reading the same canonical book, 100% of book detail visits show the "Also Reading" card.
- **SC-002**: In test accounts with no visible matches, 100% of book detail visits omit the card rather than showing an empty state.
- **SC-003**: For followed readers whose current-reading visibility does not include the viewer, 0 hidden readers appear in the card across privacy test cases.
- **SC-004**: For followed readers whose progress visibility does not include the viewer, 0 page, percentage, or relative progress values appear in the card.
- **SC-005**: For blocked relationships in either direction, 0 blocked readers appear in card results across block test cases.
- **SC-006**: At least 95% of book detail visits continue to show core book details before community card loading can affect the page.
- **SC-007**: In usability review with invite-only group participants, at least 80% describe the card as ambient or non-disruptive to reading.
- **SC-008**: The documented read contract contains every field needed by the web card and no private fields requiring client-side filtering.

## Assumptions

- The first version is limited to people the viewer already follows; broader discovery and recommendations are out of scope.
- "Currently reading" means an active in-progress reading state, not completed, abandoned, queued, or wishlist states.
- The default compact card shows up to three visible readers before offering a way to view more.
- "Same area" means the followed reader is within 10% of the viewer's progress for the viewed book.
- ISBN matching uses normalized ISBN values when available and does not require adding external book-matching services for this feature.
- Public profile navigation reuses the existing public profile availability rules.
- Reading Circles, reactions, notes, activity feed events, and notifications remain outside this feature even if the card leaves room for future expansion.
