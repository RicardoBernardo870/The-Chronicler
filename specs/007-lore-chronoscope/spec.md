# Feature Specification: Lore Chronoscope

**Feature Branch**: `007-lore-chronoscope`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "Create a background-generation system that provides 'Deep Lore' and 'World History' cards based on the user's current reading progress, using existing summaries as a spoiler shield. Rename Lexicon to The Great Library and group Lexicon + Lore Cards into a tabbed view."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unlock Deep Lore at Reading Milestones (Priority: P1)

As a reader progressing through a book, each time I cross a 10% reading milestone the system silently generates a "Lore Card" — a short, spoiler-safe piece of deep world-building (history, myth, or geography) drawn only from what I have already read. The card is stored permanently so I can revisit it any time.

**Why this priority**: This is the core value proposition of the feature. Without automatic, spoiler-safe generation tied to progress, none of the downstream surfaces (library, discovery card, notifications) have anything to display. Everything else is a presentation layer on top of this.

**Independent Test**: Set reading progress to a milestone (e.g., 20%) on a book that has at least one prior recap. Within a short delay, a new lore card is persisted for that book tagged with that milestone. Verify the card content does not reference any character, location, or event absent from the reader's existing recaps.

**Acceptance Scenarios**:

1. **Given** a reader with reading progress at 18% and a recap covering pages up to 17%, **When** the reader saves progress at 20%, **Then** a new lore card is created for that book at the 20% milestone, drawing only from story content the reader has seen.
2. **Given** a lore card already exists for the 20% milestone of a book, **When** the reader revisits 20%, **Then** no new card is generated and no duplicate cost is incurred.
3. **Given** a reader has no qualifying recaps (only a page-0 blurb exists), **When** they cross a milestone, **Then** no lore card is generated and the system silently waits for the next milestone after a real recap is made.
4. **Given** a reader jumps forward multiple milestones in one save (e.g., 8% → 27%), **When** progress is saved, **Then** a single lore card is generated for the most recently crossed milestone (20%) to avoid AI spam and cost explosion.

---

### User Story 2 - The Great Library: One Home for All Book Knowledge (Priority: P1)

As a reader who has been collecting vocabulary words and now lore cards, I want one cohesive place to browse everything I've unlocked for each book — words in one tab, lore in another — without a new item cluttering my bottom navigation.

**Why this priority**: Without a browsing surface, lore cards are invisible and ungratifying. This is also the only safe way to introduce the feature without breaking the existing Lexicon experience or the crowded bottom nav.

**Independent Test**: Open the app and navigate to what was previously "Lexicon" from the bottom navigation. It is now labelled "The Great Library" with the same entry point. Inside, two tabs — "Lexicon" and "Lore Cards" — allow switching between saved vocabulary and unlocked lore for the selected book. The existing Lexicon functionality is unchanged within its tab.

**Acceptance Scenarios**:

1. **Given** the user was previously using the Lexicon tab, **When** they open the app after this feature ships, **Then** the bottom-nav entry now reads "Great Library" and tapping it opens a view with Lexicon and Lore Cards tabs.
2. **Given** the user is viewing the Great Library for a specific book, **When** they switch between tabs, **Then** vocabulary entries and lore cards for that same book are each shown in their own tab without losing the book filter.
3. **Given** the user has no unlocked lore for a selected book yet, **When** they open the Lore Cards tab, **Then** they see an empty-state message explaining that lore unlocks as they read further.
4. **Given** a user clicks on any individual lore card in the Lore Cards tab, **Then** they see the full card content (title, body, type, linked entities) in a readable layout.

---

### User Story 3 - Discovery Card on the Book Detail Page (Priority: P2)

When I open a book's detail page I want to see a small, elegant "Lore Chronoscope" card surfacing a piece of lore I've already unlocked for this book — a nudge of delight that rewards my reading and invites me deeper. I can refresh to cycle through other snippets or tap the card to jump into the Great Library.

**Why this priority**: This is the emotional payoff layer that makes the feature feel alive in the reader's daily flow. It's not required for the feature to work but is the single most visible place the feature shines.

**Independent Test**: Open the detail page of a book that has at least two unlocked lore cards. The Chronoscope surface displays one of them at random. Tapping a refresh icon swaps it for another unlocked card. Tapping the card body navigates to the Great Library pre-filtered to that book's Lore Cards tab.

**Acceptance Scenarios**:

1. **Given** a book has ≥1 unlocked lore cards, **When** the user opens its detail page, **Then** the Chronoscope card displays one of them immediately on first render (no loading flash on return visits).
2. **Given** the user taps the refresh icon, **When** more than one card exists, **Then** a different card is shown; when only one exists, the refresh is disabled or produces no change.
3. **Given** the user taps the card itself, **Then** they are navigated to the Great Library with the Lore Cards tab open for that specific book.
4. **Given** a book has no unlocked lore, **When** the user opens its detail page, **Then** the Chronoscope card is either hidden or shows a subtle "keep reading to unlock your first lore" state.

---

### User Story 4 - New Lore Unlocked: Proactive Notification (Priority: P2)

When lore finishes generating in the background, I want a gentle cue — a toast at the moment it lands, and/or a small chip on the book's dashboard progress card — so I know something new is waiting without having to dig through menus. Tapping the chip takes me to the book's detail page and the chip clears.

**Why this priority**: Without proactive surfacing, users may never discover the feature exists. This completes the discovery loop.

**Independent Test**: While looking at a screen other than the triggering book's detail page, save progress that crosses a 10% milestone. A toast appears saying new lore has been unlocked. The corresponding book card in the dashboard page shows a "New Lore" chip or badge including the library page. Tapping the chip navigates to the book detail page and the chip disappears (and does not reappear for that same milestone).

**Acceptance Scenarios**:

1. **Given** the user is on the Library page and crosses a milestone for a book, **When** generation completes, **Then** a toast announces "New Lore Unlocked for [book title]" and a chip appears on that book's card.
2. **Given** a book card shows a "New Lore" chip, **When** the user taps the chip (or the card), **Then** they are navigated to the book detail page and the chip is dismissed permanently for that milestone.
3. **Given** lore generation fails in the background, **When** the failure is detected, **Then** no error toast is shown to the user (silent degradation); the system may retry on the next milestone crossing.
4. **Given** the user receives multiple lore unlocks across different books, **When** each completes, **Then** each produces its own chip on its own book card (no chip is lost or collapsed).

---

### Edge Cases

- **No prior recaps exist**: Milestone crossed but no qualifying recaps (progress_snapshot > 0) available — generation is skipped silently, retried at next milestone.
- **Only a blurb recap exists (page 0 / progress_snapshot = 0)**: Treated as no usable context; generation is skipped.
- **User rewinds progress** (e.g., corrects an accidental save from page 120 back to page 80): Previously unlocked lore cards are preserved; no regeneration happens; chips for already-unlocked lore are not re-shown.
- **User deletes a book**: Associated lore cards are deleted alongside recaps and lexicon entries.
- **User switches accounts**: All cached lore is cleared; next user sees only their own lore.
- **Generation latency**: AI call takes 10–30 seconds; UI never blocks; the user may close the book and continue elsewhere while lore is being generated in the background.
- **Duplicate chip avoidance**: If the user is already viewing the book detail page when lore lands, the chip never appears there; toast still fires.
- **Multiple milestones crossed in a single save** (e.g., 9% → 35%): Only one card is generated (for the 30% milestone — the most recent crossed); earlier skipped milestones are not backfilled.
- **Book completed before ever reaching a milestone**: No lore generation for very short books where the user jumps straight to 100%.
- **Offline at the moment of milestone crossing**: Generation is deferred until connectivity returns; chip/toast fires on success post-reconnect.

## Requirements *(mandatory)*

### Functional Requirements

**Lore generation & spoiler safety**

- **FR-001**: System MUST detect when a reader's progress crosses a 10% milestone (10, 20, 30, … 90) that has not yet produced a lore card for that book.
- **FR-002**: System MUST construct a "Master Recap" context by concatenating all recaps for the current book whose page_snapshot is ≤ the reader's current page AND whose progress_snapshot is > 0 (i.e., excluding page-0 blurbs).
- **FR-003**: System MUST NOT call the AI provider when a lore card for the triggered book+milestone pair already exists (cost-saving check).
- **FR-004**: System MUST NOT call the AI provider when the Master Recap context is empty (no qualifying recaps).
- **FR-005**: AI prompt MUST instruct the generator that it may only reference characters, places, and events present in the supplied Master Recap — the spoiler wall.
- **FR-006**: AI output MUST be validated to match the expected shape: title (string), content (string), type (one of: History, Myth, Geography), linked_entities (array of strings).
- **FR-007**: System MUST persist each successfully generated lore card, tagged with the book, the page at which it was unlocked, and the type.
- **FR-008**: If generation fails, the system MUST fail silently (no error surfaced to the user) and may retry at the next milestone.

**Milestone trigger & background execution**

- **FR-009**: Generation MUST run as a background task that does not block the progress-save UI or any other interaction.
- **FR-010**: If a reader jumps forward across multiple milestones in one progress update, the system MUST generate a lore card for the most recently crossed milestone only.
- **FR-011**: If a reader moves backwards in progress (corrections), the system MUST NOT regenerate or remove previously created lore cards.

**The Great Library (rename + tabs)**

- **FR-012**: The bottom-navigation entry previously labelled "Lexicon" MUST now read "Great Library" and open a view containing two tabs.
- **FR-013**: The two tabs MUST be labelled "Lexicon" (preserving all existing vocabulary functionality unchanged) and "Lore Cards".
- **FR-014**: Switching between tabs MUST preserve the currently selected book filter.
- **FR-015**: The Lore Cards tab MUST display all unlocked lore cards for the selected book, ordered by most recently unlocked first.
- **FR-016**: Each lore card in the list MUST show its title, type, and an excerpt of content; tapping MUST reveal the full content.
- **FR-017**: If the selected book has no unlocked lore, the Lore Cards tab MUST show an empty-state message inviting the reader to keep reading.
- **FR-018**: No new entry MUST be added to the bottom navigation.

**Discovery Card on Book Detail Page**

- **FR-019**: Book detail page MUST display a "Lore Chronoscope" card when the book has ≥1 unlocked lore card.
- **FR-020**: The Chronoscope card MUST show one unlocked lore card selected at random from the book's unlocked cards.
- **FR-021**: Returning to a book detail page MUST render the Chronoscope card without a loading flash if lore has been previously fetched for that book.
- **FR-022**: The Chronoscope card MUST include a "Refresh" affordance that cycles to a different unlocked card; with only one card the refresh is disabled or no-ops.
- **FR-023**: Tapping the Chronoscope card body MUST navigate to the Great Library, opened on the Lore Cards tab filtered to the current book.
- **FR-024**: When the book has no unlocked lore, the Chronoscope card MAY be hidden or show a subtle placeholder; it MUST NOT mislead the reader into thinking content is loading.

**Notifications and chips**

- **FR-025**: On successful background lore generation, the system MUST display a non-intrusive toast naming the book.
- **FR-026**: After a successful unlock, the corresponding book card on the Library page and dashboard page MUST display a "New Lore" visual indicator.
- **FR-027**: Tapping the indicator (or the book card while the indicator is present) MUST navigate to the book detail page and permanently dismiss the indicator for that milestone.
- **FR-028**: The indicator MUST NOT re-appear for the same milestone once dismissed, even across sessions.

**Persistence & caching**

- **FR-029**: Lore cards MUST be stored server-side and associated with both the book and the owning user.
- **FR-030**: The client MUST NOT re-fetch the lore card array for a book from the server unless the local cache has been invalidated (e.g., via user sign-out/account switch or an explicit cache clear event).
- **FR-031**: On user identity change (sign-in, sign-out, account switch), all locally cached lore cards MUST be cleared.
- **FR-032**: Deleting a book MUST also remove that book's lore cards from the user's data.

### Key Entities

- **Lore Card**: A single atomic piece of in-universe knowledge unlocked at a reading milestone. Belongs to one book and one user. Attributes: title, content body, type (History | Myth | Geography), list of linked story entities it references, the reading page at which it was unlocked, the milestone percentage, and a creation timestamp. Lore cards are immutable once generated.
- **Master Recap** (derived, not persisted): The spoiler-safe context window for AI generation. Computed per-call as the ordered concatenation of a book's existing recap entries whose captured page is ≤ the reader's current page and whose progress snapshot is strictly greater than zero. Never stored; always re-derived from recap state.
- **Milestone**: A 10% increment (10, 20, 30, 40, 50, 60, 70, 80, 90) of reading progress that may have at most one lore card per book per user.
- **New-Lore Indicator** (transient UI state): A per-book, per-milestone flag held in client state and/or server state marking lore unlocked but not yet seen by the user. Cleared when the user lands on the book detail page or taps the indicator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of lore cards presented to readers contain only content derivable from their already-read recap context (zero spoiler leakage in spot-checks across 20 reader journeys).
- **SC-002**: Milestone-triggered generation completes in under 30 seconds from the moment the reader saves progress, with the UI remaining fully responsive throughout.
- **SC-003**: A book with N unlocked lore cards produces zero additional AI generation calls when the reader re-visits the same milestones (100% deduplication rate).
- **SC-004**: At least 70% of active readers who cross ≥ 3 milestones across any of their books interact with at least one lore card (open, refresh, or navigate via chip) within 7 days of the feature launching.
- **SC-005**: Returning to a previously visited Book Detail Page renders the Chronoscope card within 100 ms with no visible loading state in 100% of cases where lore has been fetched before in the session.
- **SC-006**: The bottom navigation item count remains unchanged after this feature ships.
- **SC-007**: Zero error toasts are shown to users for background lore generation failures; instead, 100% of failures are logged silently for operator review.
- **SC-008**: The "New Lore" indicator on a book card clears within 1 interaction after the reader opens that book's detail page, and never re-appears for the same milestone.

## Assumptions

- **Existing recap state is the authoritative spoiler boundary**: A reader who has generated no recaps yet has no safe context, so lore cannot be generated until at least one real recap (progress_snapshot > 0) exists for that book. This is by design — the feature rewards engagement with recaps.
- **One card per milestone per book**: The 10% milestone grid (10, 20, … 90) caps the total possible lore cards per book at 9. This keeps the feature economical and avoids overwhelming readers.
- **Multi-milestone jumps collapse to the latest crossed milestone only**: Readers who skip ahead get one card for the newest milestone, not a backfill burst. This caps AI cost spikes.
- **Silent failures over loud ones**: Because the feature is delight-layer, not mission-critical, generation errors must never interrupt reading flow. Failed milestones are retried implicitly on the next milestone crossing.
- **No lore for completed-on-add books**: Readers who import and immediately mark a book 100% complete receive no generated lore (no milestones were traversed as reading activity).
- **Rename is in-place; no data migration is needed for existing Lexicon entries**: Vocabulary data carries over unchanged into the Lexicon tab of the Great Library.
- **The Chronoscope card on the Book Detail Page is read-only discovery**: It does not allow editing, deleting, or creating lore — that is all automatic.
- **Toast + chip deduplication is per-milestone**: Once a milestone's chip is dismissed, dismissing is permanent for that milestone. Crossing the NEXT milestone produces a fresh chip.
- **AI provider and caching layer already exist**: This feature reuses the same AI infrastructure used by the existing recap system and the same client-side SWR caching primitive introduced in feature 006.
- **Book deletion cascade**: Deleting a book removes its lore cards as it removes its recaps and lexicon entries — the same trust model as existing per-book data.

## Dependencies

- Existing recap system (reads from the recaps table/state as the spoiler boundary).
- Existing reading-progress tracking (the milestone-detection trigger).
- Existing client-side SWR caching layer (for instant Chronoscope rendering on return navigation).
- Existing book-deletion cascade (to cover lore cards).
- Existing AI provider integration (reused for the Historian prompt; no new vendor).
- Existing authentication lifecycle (to trigger cache-clear on user identity change).

## Out of Scope

- User-authored lore cards or manual lore editing.
- Sharing lore cards publicly or across users.
- Lore for collections/series (lore is per-book only in v1).
- Translations or localised lore content.
- Export or print of lore cards.
- Reading-group / social features around lore.
- Audio narration of lore cards.
