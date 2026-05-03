# Feature Specification: Reading Circles

**Feature Branch**: `024-reading-circles`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Add private Reading Circles with spoiler-safe page-gated reactions. Private groups for a book, up to 10 members, followed-reader invites, owner/member roles, short page reactions, server-side membership/blocking/page visibility enforcement, realtime-safe updates, and edition-aware spoiler safety because book versions differ in page number."

## Clarifications

### Session 2026-05-03

- Q: How should Reading Circles handle members using different book editions with different page counts? -> A: Different editions are allowed; reaction visibility is gated by normalized percent-through-book.
- Q: Can members create reactions ahead of their own current progress? -> A: No. Reactions can only be added at or behind the author's current progress.
- Q: How should adding readers to a private Reading Circle work? -> A: Owners send invitations; readers become members only after accepting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create A Private Circle (Priority: P1)

As a reader, I want to create a private Reading Circle for a book and invite followed readers, so a small group can read together without making the circle public.

**Why this priority**: Circle creation and membership are the foundation for every later reaction and spoiler-safety behavior.

**Independent Test**: Can be fully tested by creating a circle for a book, inviting followed readers, accepting an invitation, and confirming only accepted eligible members can see the circle.

**Acceptance Scenarios**:

1. **Given** a signed-in reader has a book in their library and follows at least one eligible reader, **When** they create a private circle for that book and invite followed readers, **Then** the circle is created with the creator as owner and pending invitations for selected readers.
2. **Given** an invited eligible reader receives a circle invitation, **When** they accept it, **Then** they become a member and can see the circle details and eligible reactions.
3. **Given** a circle already has 10 accepted members including the owner, **When** an invited reader tries to accept another invitation, **Then** the system rejects the acceptance without changing membership.
4. **Given** the owner tries to invite a reader they do not follow or cannot interact with, **When** they submit the invitation list, **Then** no invitation is created for that reader.

---

### User Story 2 - Add Page-Specific Reactions (Priority: P1)

As a circle member, I want to leave a short reaction pinned to my current book location, so other members can encounter it when they reach the same safe area.

**Why this priority**: Page-specific reactions are the core Reading Circle interaction.

**Independent Test**: Can be tested by having a member add a reaction with valid content and page placement, then confirming the reaction is stored and visible to eligible members.

**Acceptance Scenarios**:

1. **Given** a circle member is reading the circle book, **When** they add a reaction with 280 or fewer characters at a valid page, **Then** the reaction is saved for that circle and page.
2. **Given** a member submits a reaction over 280 characters, **When** they try to save it, **Then** the system rejects it and preserves the existing reactions.
3. **Given** a member submits a reaction at page 0, a negative page, beyond the relevant book's total page count, or ahead of their own current progress, **When** they try to save it, **Then** the system rejects it.

---

### User Story 3 - Protect Spoilers Across Progress And Editions (Priority: P1)

As a circle member, I only want to see reactions at or behind my own current location, even when members use different book editions with different page counts, so the circle never spoils content ahead of me.

**Why this priority**: Spoiler safety is the differentiator and the highest-risk requirement; it must be correct before the feature is useful.

**Independent Test**: Can be tested by creating reactions ahead of and behind a member's progress, including members on different total-page editions, and confirming visibility follows the viewer's normalized reading location.

**Acceptance Scenarios**:

1. **Given** a member is behind another member's reaction location, **When** they open the circle, **Then** the reaction is not visible through the UI or direct backend access.
2. **Given** that member later progresses to the reaction's gated location, **When** they refresh or receive circle updates, **Then** the reaction becomes visible.
3. **Given** circle members have different total-page editions of the same work, **When** reactions are evaluated for visibility, **Then** the system compares normalized progress location rather than raw page numbers alone.

---

### User Story 4 - Manage Membership And Blocking (Priority: P2)

As a circle owner or member, I want circle membership to respect leaving, owner removal, and blocks, so unsafe or unwanted member combinations cannot persist.

**Why this priority**: Membership control and blocking keep private circles safe and consistent with the community graph.

**Independent Test**: Can be tested by leaving a circle, removing a member as owner, and creating block relationships between members.

**Acceptance Scenarios**:

1. **Given** a non-owner member belongs to a circle, **When** they leave, **Then** they can no longer see circle details or reactions.
2. **Given** an owner removes a member, **When** the removal completes, **Then** the removed member can no longer see circle details or reactions.
3. **Given** two circle members become blocked in either direction, **When** circle membership is next evaluated, **Then** blocked users cannot remain together or view each other's reactions.

---

### User Story 5 - Receive Safe Live Reaction Updates (Priority: P3)

As a circle member viewing a circle, I want new eligible reactions to appear live or refresh quickly, so the circle feels active while still preserving spoiler safety.

**Why this priority**: Realtime makes the feature feel alive, but must use the same spoiler-safe visibility rules as normal reads.

**Independent Test**: Can be tested by opening a circle as one member, adding a reaction from another member, and confirming the viewer sees only eligible updates within 2 seconds.

**Acceptance Scenarios**:

1. **Given** a member is viewing a circle and another member adds a reaction at or behind the viewer's current location, **When** the reaction is saved, **Then** the viewer sees it live or after a safe refresh within 2 seconds.
2. **Given** another member adds a reaction ahead of the viewer's current location, **When** realtime activity occurs, **Then** the viewer does not receive readable reaction content ahead of their progress.
3. **Given** a member reaches a page with one or more visible reactions, **When** the app checks the current page, **Then** it can show a subtle indicator that reactions exist at that page.

### Edge Cases

- If the creator has no current progress for the circle book, the system still allows circle creation but cannot show page-gated reactions to that creator until progress exists.
- If a member uses a different edition with a different total page count, reaction visibility uses normalized percent-through-book and may show the member's local equivalent location rather than the author's raw page.
- If a member's book has no valid total page count, that member cannot add reactions or view gated reactions for the circle until the book metadata is corrected.
- If a reaction is exactly at the viewer's current normalized location, it is visible.
- If a member tries to post a reaction ahead of their own current normalized location, the system rejects it.
- If a member changes progress backward, reactions beyond the new current location are hidden again.
- If a circle owner leaves, ownership must either transfer to another member or the circle must close according to a deterministic rule.
- If a block occurs between two members, future reads and realtime updates must not leak hidden member or reaction data while cleanup/removal is completed.
- If realtime delivery cannot safely filter reaction content, realtime events must contain only non-sensitive IDs or invalidation signals and the client must refetch through the safe read contract.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a signed-in reader to create a private Reading Circle for a book they can read.
- **FR-002**: Each circle MUST have one book/work identity, a name, a creator, members, roles, and a created timestamp.
- **FR-003**: Circles MUST be private only in the first release; public discovery of circles is out of scope.
- **FR-004**: A circle MUST support at most 10 accepted members including the owner.
- **FR-005**: The system MUST enforce the 10-member limit server-side when invitations are accepted.
- **FR-006**: The system MUST allow owners to invite only followed readers who can interact with the owner during the first release.
- **FR-007**: Invited readers MUST become members only after accepting an invitation.
- **FR-008**: The system MUST prevent blocked users in either direction from being invited to, accepting, or remaining together in a circle.
- **FR-009**: Member roles MUST include owner and member.
- **FR-010**: Members MUST be able to leave a circle.
- **FR-011**: Owners MUST be able to remove members from a circle.
- **FR-012**: The system MUST define a deterministic outcome when the owner leaves or is removed from a circle.
- **FR-013**: Members MUST be able to add reactions pinned to a positive reading location for the circle book.
- **FR-014**: Reaction content MUST be limited to 280 characters.
- **FR-015**: Reaction location MUST be valid for the reacting member's book edition and total page count.
- **FR-016**: Reaction location MUST be at or behind the author's current normalized percent-through-book progress when it is created.
- **FR-017**: The system MUST allow circle members to use different book editions with different page counts.
- **FR-018**: The system MUST store enough location metadata to evaluate spoiler safety across different book editions, including normalized percent-through-book.
- **FR-019**: A member MUST see only reactions whose normalized percent-through-book location is at or behind that member's current normalized percent-through-book progress for the circle book.
- **FR-020**: The system MUST enforce membership, blocking, and reaction visibility server-side before returning reaction content.
- **FR-021**: The system MUST NOT rely on client-side filtering alone for page-gated reaction visibility.
- **FR-022**: The system MUST provide stable first-party read/write contracts for creating circles, inviting readers, accepting invitations, listing my circles, reading circle detail, reading visible reactions by location range, adding reactions, leaving a circle, and removing members.
- **FR-023**: The system MUST support live or near-live updates for eligible reactions while a circle view is open.
- **FR-024**: If live updates cannot safely filter readable content, the system MUST deliver only safe invalidation events and require clients to refetch visible reactions through the server-side visibility contract.
- **FR-025**: The app MUST be able to determine whether visible reactions exist at the member's current page/location for a subtle indicator.
- **FR-026**: Circle data contracts MUST be stable enough for future first-party mobile clients to reuse.

### Key Entities *(include if feature involves data)*

- **Reading Circle**: A private group centered on one book/work; has a name, owner/creator, book/work identity, member count, and created timestamp.
- **Circle Invitation**: A pending request from a circle owner to an eligible followed reader; acceptance creates circle membership, while pending invitations do not grant access to reactions.
- **Circle Member**: A user in a circle with role owner or member; membership controls access to circle details and reactions.
- **Circle Reaction**: A short member-authored text item pinned to a reading location; has content, author, circle, source page, normalized percent-through-book, and timestamp.
- **Circle Book/Work Match**: The relationship between each member's local book edition and the circle's shared book/work, including enough metadata for edition-aware spoiler gates.
- **Reader Progress Location**: The viewer's current normalized percent-through-book location for the circle work, derived from their own edition and current progress.
- **Block Relationship**: A community safety relationship that prevents affected users from sharing circle membership or reaction visibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of eligible users in acceptance testing can create a private circle and invite up to 9 other eligible readers.
- **SC-002**: 100% of invitation acceptances that would exceed 10 accepted circle members are rejected without adding the extra member.
- **SC-003**: 100% of valid reactions with 280 or fewer characters at valid locations are saved for circle members.
- **SC-004**: 100% of reactions over 280 characters, outside the reacting member's valid book range, or ahead of the author's current progress are rejected.
- **SC-005**: 0 reactions ahead of a viewer's current normalized percent-through-book location are readable through the UI or direct backend access.
- **SC-006**: 100% of reactions become visible once the viewer reaches or passes the reaction's normalized percent-through-book location.
- **SC-007**: 0 blocked user pairs remain mutually visible in a circle after membership/blocking rules are evaluated.
- **SC-008**: Eligible viewers see live or refreshed visible reactions within 2 seconds in at least 95% of tested circle-view sessions.
- **SC-009**: Edition-mismatch tests with different total page counts preserve spoiler safety in 100% of tested cases.

## Assumptions

- A circle is associated with a shared work/book identity and each member may have a local edition with a different total page count.
- Pending invitations do not grant circle detail or reaction access until accepted.
- Normalized location means percent-through-book for the first release.
- Future canonical location maps may improve precision later, but v1 spoiler gating is based on percent-through-book.
- A reaction's original page is retained for the author/local edition, but visibility is determined by normalized percent-through-book.
- Circle creation may start from the creator's current book detail page or an existing also-reading/follow surface.
- Owner departure transfers ownership to the earliest remaining member by join time; if no members remain, the circle is closed or deleted.
- Realtime updates may be implemented as safe invalidation/refetch rather than direct readable payload delivery when that is safer.
- Subscription enforcement is out of scope unless a complete entitlement system already exists at implementation time.
