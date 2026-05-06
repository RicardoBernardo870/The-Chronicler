# Feature Specification: Anki Flashcard Review

**Feature Branch**: `026-anki-flashcard-review`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "Anki card system that uses the current lexicon. Word of the Day continues to exist, but every few days a button appears redirecting the user to a dedicated review page with Tinder-style swipe cards (swipe right = knew it, swipe left = didn't know). Separate from the daily Leitner-driven Word of the Day flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Periodic Review Prompt on Dashboard (Priority: P1)

A reader opens the app and, because enough time has passed since their last review session (default: every 3 days) and they have a minimum number of lexicon entries, the Word of the Day card slot is replaced entirely by an Anki review prompt card. The prompt card invites them to start a flashcard session. Tapping it navigates them to the dedicated review page. Once they complete the session (or exit having reviewed ≥1 card), they return to the dashboard and the Word of the Day card is restored.

**Why this priority**: Without the trigger mechanism, the entire feature is unreachable. This is the entry point that connects the existing dashboard to the new review experience.

**Independent Test**: Can be verified by checking the dashboard after the review interval elapses — the Word of the Day card should be replaced by the Anki prompt card. Tapping it should navigate to the review page. After the session, the Word of the Day card should reappear.

**Acceptance Scenarios**:

1. **Given** a user has ≥5 lexicon entries and has not completed a review session in 3+ days, **When** they open the dashboard, **Then** the Word of the Day card slot shows the Anki review prompt card instead of the daily word.
2. **Given** a user completed a review session today, **When** they open the dashboard, **Then** the Word of the Day card appears normally with no Anki prompt.
3. **Given** a user has fewer than 5 lexicon entries, **When** they open the dashboard, **Then** the Word of the Day card appears normally regardless of time elapsed.
4. **Given** the user completes or exits an Anki session (≥1 card reviewed), **When** they return to the dashboard, **Then** the Word of the Day card is restored in place of the Anki prompt.

---

### User Story 2 — Tinder-Style Flashcard Review Session (Priority: P1)

The reader lands on the review page and sees a stack of flashcards. Each card shows a word on the front. The reader mentally guesses the definition, then taps/swipes to reveal it. They swipe right (or tap a "Knew it" button) if they knew the answer, or swipe left (or tap a "Didn't know" button) if they didn't. The card animates off-screen and the next card appears. This continues until all cards in the session are exhausted.

**Why this priority**: This is the core experience — without the swipe interaction, there is no feature.

**Independent Test**: Tap the review prompt on the dashboard. Verify cards appear, can be flipped, and swiped in both directions with appropriate animations.

**Acceptance Scenarios**:

1. **Given** the user opens the review page, **When** the page loads, **Then** a card is displayed showing a word term on the front face.
2. **Given** a card is showing, **When** the user taps the card, **Then** the card flips to reveal the definition, context sentence (if available), and the source book.
3. **Given** a flipped card is showing, **When** the user swipes right or taps "Knew it", **Then** the card animates off-screen to the right and the next card appears.
4. **Given** a flipped card is showing, **When** the user swipes left or taps "Didn't know", **Then** the card animates off-screen to the left and the next card appears.
5. **Given** a card stack, **When** the user has not yet flipped the card, **Then** swiping is disabled (the user must see the answer before judging).

---

### User Story 3 — Review Results Update Vocabulary Knowledge (Priority: P1)

When the user marks a word as "Knew it", the system advances that word's review scheduling (moves it further out so it appears less frequently). When the user marks a word as "Didn't know", the system resets that word so it appears sooner in future reviews. These updates use the existing Leitner box system already in the lexicon.

**Why this priority**: Without updating the spaced repetition state, the review session has no lasting effect on the user's learning.

**Independent Test**: Complete a review session, then check that words marked "Knew it" have been advanced in their Leitner box and words marked "Didn't know" have been reset to box 1.

**Acceptance Scenarios**:

1. **Given** a word is in Leitner box 2, **When** the user swipes right ("Knew it"), **Then** the word moves to box 3 and its next review date is updated accordingly.
2. **Given** a word is in Leitner box 3, **When** the user swipes left ("Didn't know"), **Then** the word resets to box 1 with next review date set to today.
3. **Given** a word is in box 5 (maximum), **When** the user swipes right, **Then** the word stays in box 5 and its review date is pushed out by the box-5 interval (16 days).

---

### User Story 4 — Session Summary (Priority: P2)

After the user finishes all cards in the review session, a summary screen appears showing how many words they reviewed, how many they knew vs. didn't know, and a motivational message. The user can return to the dashboard from this screen.

**Why this priority**: Provides closure and feedback on the session, reinforcing the learning loop. Not strictly required for the feature to function.

**Independent Test**: Complete a full review session and verify the summary screen displays correct counts and a return-to-dashboard action.

**Acceptance Scenarios**:

1. **Given** the user has swiped through all cards, **When** the last card is dismissed, **Then** a summary screen appears showing total reviewed, number known, and number unknown.
2. **Given** the summary screen is showing, **When** the user taps the return button, **Then** they are navigated back to the dashboard.

---

### User Story 5 — Word of the Day Restored After Review (Priority: P2)

The Word of the Day card slot has three states: normal (shows the daily word), review due (shows the Anki prompt, replacing the daily word), and all caught up (existing green checkmark). Once the user completes or exits an Anki session, the review due state clears and the Word of the Day card returns to normal. Words reviewed in an Anki session update the Leitner state, so the WOTD queue naturally reflects any advances made during the session.

**Why this priority**: Ensures the Word of the Day is never permanently displaced and returns cleanly after every session.

**Independent Test**: After completing a review session, open the dashboard and verify the Word of the Day card reappears and advances normally.

**Acceptance Scenarios**:

1. **Given** the review conditions are met, **When** the user opens the dashboard, **Then** the Anki prompt card occupies the Word of the Day slot and no daily word is shown.
2. **Given** the user has just returned from an Anki session (≥1 card reviewed), **When** they view the dashboard, **Then** the Word of the Day card is visible in place of the Anki prompt.
3. **Given** a word was marked "Knew it" in a review session, **When** the Word of the Day resolves, **Then** that word's updated Leitner state is respected (it won't appear as WOTD until its new review date).

---

### Edge Cases

- What happens when the user navigates away mid-session? Leitner updates for already-swiped cards are preserved (applied immediately per card). The 3-day prompt timer resets only if ≥1 card was reviewed — exiting after 0 cards does not count as a session.
- What happens when a new lexicon entry is added while a review session is in progress? The new entry is not added to the current session — it will appear in the next session.
- What happens when the user has exactly 0 words due for review? The review page shows a "You're all caught up!" message with a return button.
- The review page is mobile-only and only reachable via the dashboard review prompt — direct URL access is not supported.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST track the date of the user's last completed review session to determine when to show the review prompt.
- **FR-002**: System MUST replace the Word of the Day card slot with an Anki review prompt card when the user has ≥5 lexicon entries AND ≥3 days have passed since their last review session.
- **FR-003**: Tapping the Anki review prompt card MUST navigate the user to the dedicated review page (new route). The review page is only accessible via this card — no direct URL navigation is supported.
- **FR-003a**: After the user completes or exits an Anki session (≥1 card reviewed), the Word of the Day card MUST be restored in place of the Anki prompt.
- **FR-004**: The review page MUST display flashcards one at a time in a stacked presentation.
- **FR-005**: Each flashcard MUST show the word term on the front and definition, context sentence (if present), and source book on the back.
- **FR-006**: Users MUST be able to flip a card (tap) to reveal the answer before rating.
- **FR-007**: Users MUST be able to swipe right or tap "Knew it" to mark a word as known.
- **FR-008**: Users MUST be able to swipe left or tap "Didn't know" to mark a word as unknown.
- **FR-009**: Swiping MUST be disabled until the card has been flipped (answer revealed).
- **FR-010**: Marking "Knew it" MUST advance the word's Leitner box (existing `advanceBox` logic).
- **FR-011**: Marking "Didn't know" MUST reset the word's Leitner box to 1 (existing `resetBox` logic).
- **FR-012**: Leitner updates MUST be applied immediately per card (not batched), so mid-session exits preserve progress.
- **FR-013**: The review session MUST select words that are due or overdue for review (nextReviewAt ≤ today) from the user's entire lexicon across all books, ordered by Leitner box ascending (lower boxes first), capped at 20 cards per session.
- **FR-014**: After all cards are reviewed, the system MUST display a session summary (total, known count, unknown count).
- **FR-015**: The summary screen MUST provide navigation back to the dashboard.
- **FR-016**: System MUST persist the last review session date in a dedicated Supabase table (one row per user, upserted) so the prompt interval is consistent across devices. The timestamp is recorded when ≥1 card is reviewed (full session completion is not required).
- **FR-017**: The Word of the Day feature MUST resume functioning normally after each review session — the Anki prompt card is a temporary replacement, not a permanent override.
- **FR-018**: The review page MUST support swipe gestures (touch) as the primary interaction. Tap-button controls ("Knew it" / "Didn't know") are visible as an alternative for users who prefer not to swipe.

### Key Entities

- **Review Session Record**: Represents a completed Anki review session — stored in a new Supabase table with fields: `user_id`, `last_reviewed_at` (timestamp), `session_count` (total sessions), `known_count`, `unknown_count`. One row per user (upserted on session completion). Used to determine when the next review prompt should appear.
- **Lexicon Entry (existing)**: The existing vocabulary entry with Leitner box and next review date. No structural changes needed — the review feature reads and updates the same Leitner fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a full review session (20 cards) in under 5 minutes.
- **SC-002**: Review prompt appears on the dashboard within 1 second of page load when conditions are met.
- **SC-003**: Card flip and swipe animations complete in under 300ms, providing a fluid interaction.
- **SC-004**: 100% of "Knew it" / "Didn't know" actions persist correctly — no lost progress on mid-session exits.
- **SC-005**: Word of the Day continues to function identically for users who never interact with the review feature.

## Clarifications

### Session 2026-05-06

- Q: Where should the review session record be stored? → A: Supabase — new lightweight table (user_id, last_reviewed_at, session count, known_count, unknown_count)
- Q: Should the review session draw words from all books or only active books? → A: All books — entire lexicon regardless of reading status
- Q: What happens on the review page when no words are due, and is desktop navigation needed? → A: The review page is only reachable via the dashboard prompt (no direct URL navigation). The app is mobile-only — no desktop swipe fallbacks or button-only controls needed.
- Q: Where does the review prompt appear on the dashboard? → A: The Word of the Day card slot is replaced entirely by an Anki prompt card when review is due. After the session, the WotD card is restored.
- Q: What happens when the user exits mid-session via back navigation? → A: Exit to dashboard, keep all per-card Leitner progress; the 3-day prompt timer resets only if ≥1 card was reviewed.

## Assumptions

- This is a mobile-only feature. Touch/swipe is the primary interaction; button fallbacks are for user preference only, not desktop support.
- The existing Leitner system (5 boxes, intervals [1, 2, 4, 8, 16] days) is sufficient for the Anki review — no new spaced repetition algorithm is needed.
- The 3-day interval between review prompts and the 5-entry minimum are sensible defaults. These could be made configurable in a future iteration but are hardcoded for now.
- The session cap of 20 cards per session balances review depth with time commitment.
- Review session metadata (last session date, counts) is lightweight enough to store in a single new record per session.
- No separate backend structure is needed for flashcard content — the review draws directly from `lexicon_entries`.
- No automated/functional tests are required for this feature (per user request).
