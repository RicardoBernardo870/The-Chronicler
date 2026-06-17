# Feature Specification: Vocabulary Review Progress & Word Graduation

**Feature Branch**: `031-vocab-graduation`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "Fix 1 — Show how many words are left (progress) on the Word of the Day card; the card's arrow chains through the whole due queue, so show a live remaining-count (e.g. '3 left' / '2 / 7') that counts down to 'All caught up', reflecting words due today, hidden in the caught-up/preview state. Fix 2 — Let words graduate so the review pool is finite. Today nothing ever leaves: a box-5 word recurs every 16 days forever. Introduce a terminal 'learned/mastered' state. Words are ONLY mastered when the user answers 'Knew it' in the Anki flashcard session (the Word of the Day card only advances words through the Leitner boxes, never masters them). The Anki session should focus on words in the later Leitner boxes. Graduated words are excluded from both review queues (Word of the Day and the Anki session) but are not deleted — they stay in the Great Library with a Learned/Mastered indicator. 'Didn't know' is unchanged (reset to box 1) for non-graduated words."

## Clarifications

### Session 2026-06-17

- Q: Do Mastered words appear in the default Great Library list, or only behind a filter? → A: Shown inline in the default list, marked with a "Mastered" badge.
- Q: Does mastering a word grant a reward (XP / milestone / stat update)? → A: No — mastery is a pure review-state change with no XP, milestones, or other gamification reward.
- Q: Does graduation depend on the word's Leitner box? → A: No — any "Knew it" in the flashcard (Anki) session masters the word regardless of box; the Word of the Day card never masters (it only advances boxes).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how many words are left to review (Priority: P1)

A reader opens the dashboard and works through their due vocabulary on the Word of the Day card by tapping the advance arrow. Because each tap promotes the current word and reveals the next due word, the reader needs to know how many words remain so the task feels bounded rather than endless. A small remaining-count next to the card label counts down with each tap until the reader reaches "All caught up."

**Why this priority**: Today the reader taps into an invisible-length queue with no sense of how much is left, which feels like a chore with no end. A simple count makes the daily review feel finite and completable.

**Independent Test**: With several words due today, open the dashboard and confirm the card shows an accurate remaining count, that it decreases by one with each advance, and that it disappears when the reader is caught up.

**Acceptance Scenarios**:

1. **Given** N words are due today, **When** the Word of the Day card displays a due word, **Then** a remaining-count is shown reflecting how many due words remain to walk through.
2. **Given** the reader taps the advance arrow, **When** the next due word appears, **Then** the remaining-count decreases by one.
3. **Given** the reader advances the last due word, **When** the card updates, **Then** it shows the "All caught up" state with no remaining-count.
4. **Given** the reader is already caught up (the card is in its preview/"all caught up" state), **When** the card renders, **Then** no remaining-count is shown.
5. **Given** the multi-card flashcard (Anki) session is open, **When** a card is on screen, **Then** the session shows a clear position indicator (current card of total) that reads naturally (e.g., "5 of 15").

---

### User Story 2 - Words graduate so the review pool is finite (Priority: P1)

A reader who confirms they know a word **in the flashcard session** finishes it: answering "Knew it" there graduates the word to a terminal Mastered state and stops it appearing in any review queue, regardless of which Leitner box it was in. This makes the daily workload shrink as the reader learns, instead of growing forever.

**Why this priority**: Currently no word ever leaves the review pool — even fully-known words recur indefinitely — so with steady inflow the reader's review burden only grows. Graduation is what makes the system feel like progress rather than an ever-growing backlog.

**Independent Test**: Take any word in a flashcard session, answer "Knew it", and confirm it no longer appears in either the Word of the Day card or the flashcard session, while remaining visible (as Mastered) in the Great Library.

**Acceptance Scenarios**:

1. **Given** any non-Mastered word in a flashcard session, **When** the reader answers "Knew it", **Then** the word becomes Mastered and is never scheduled for review again (regardless of its box).
2. **Given** a Mastered word, **When** any review queue is built (Word of the Day or flashcard session), **Then** the Mastered word is excluded.
3. **Given** a Mastered word, **When** the reader browses the Great Library, **Then** the word is still present and is identifiable as Mastered.
4. **Given** a word being advanced via the Word of the Day card's arrow, **When** it reaches the final stage, **Then** it is **not** mastered by that action — it continues to recur on its schedule until mastered through the flashcard session.
5. **Given** a non-Mastered word the reader answers "Didn't know" in the flashcard session, **When** the answer is recorded, **Then** the word returns to the earliest stage (unchanged from today's behavior).
6. **Given** Mastered words exist, **When** the remaining-count and "due" totals are computed, **Then** Mastered words are not counted.

---

### User Story 3 - The flashcard session surfaces mature words first (Priority: P2)

The reader's daily lightweight advancement happens on the Word of the Day card, while the flashcard (Anki) session is where the reader does deliberate recall — and where graduation happens. Both surfaces share the same pool of due words, but the flashcard session orders its deck so the later-stage (more mature) words come first, concentrating the recall effort and the moment of graduation on words closest to being learned.

**Why this priority**: It gives the two surfaces complementary emphases (quick promotion vs. final recall/graduation) without splitting the queue, so no due word is stranded out of reach of either surface.

**Independent Test**: With words spread across early and late stages, open the flashcard session and confirm the later-stage due words are presented first, and that graduation is reachable from there.

**Acceptance Scenarios**:

1. **Given** due words across early and late stages, **When** the flashcard session builds its deck, **Then** the later-stage due words are ordered ahead of earlier-stage ones.
2. **Given** due, non-Mastered words exist, **When** the flashcard session builds its deck, **Then** it includes those due words (Mastered words excluded) and the Word of the Day card draws from the same due pool.

---

### Edge Cases

- **Caught up:** when no words are due, the Word of the Day card shows "All caught up" with no count, and the flashcard session shows its empty state.
- **All remaining words are Mastered:** the reader is treated as caught up; Mastered words never resurface.
- **A word is only ever advanced on the Word of the Day card, never reviewed in the flashcard session:** it keeps recurring on schedule and never masters — mastery requires a "Knew it" in the flashcard session.
- **"Didn't know" on a near-final word:** it resets to the earliest stage and re-enters the normal queue (not mastered, not deleted).
- **Reader deletes a book:** its words (including Mastered ones) follow existing book-deletion behavior; mastery state must not cause errors.
- **Count accuracy across a session:** the remaining-count must stay correct as words are advanced, including when a word's advance pushes it out of "due today."
- **Existing libraries:** words that exist today must adopt a sensible default state (not Mastered) so nothing is unexpectedly removed from review.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Word of the Day card MUST display a remaining-count of words still due to walk through, shown alongside the card's label while a due word is displayed.
- **FR-002**: The remaining-count MUST reflect words due today (the set the advance arrow walks through), not the reader's entire vocabulary.
- **FR-003**: The remaining-count MUST decrease as the reader advances words and reach zero / disappear when the reader is caught up.
- **FR-004**: The Word of the Day card MUST NOT show a remaining-count in its "All caught up" / preview state.
- **FR-005**: The flashcard (Anki) session MUST show a position indicator of the current card within the session that reads as the human card position (e.g., "5 of 15") rather than a count of already-answered cards.
- **FR-006**: The system MUST support a terminal "Mastered" state for a vocabulary word, after which the word is never scheduled for review.
- **FR-007**: A word MUST become Mastered when the reader answers "Knew it" in the flashcard (Anki) session, **regardless of the word's current Leitner box**. The box does not matter — the only condition is that the "Knew it" judgment is made inside the flashcard session (the Word of the Day card never masters a word).
- **FR-008**: Advancing a word via the Word of the Day card's arrow MUST NOT master it; that action only promotes the word within the spaced-repetition stages (capped at the final stage) and the word continues to recur on schedule.
- **FR-009**: Mastered words MUST be excluded from the Word of the Day due selection and from the flashcard session deck.
- **FR-010**: The Word of the Day card and the flashcard session MUST draw from the **same** pool of due, non-Mastered words (the two queues are not mutually exclusive). The flashcard session MUST order its deck so later-stage words appear first (highest box first), concentrating recall and graduation on mature words, while the Word of the Day card walks through due words for lightweight advancement.
- **FR-011**: Mastered words MUST remain stored and MUST appear **inline in the default Great Library list**, each marked with a "Mastered" badge (they are not hidden behind a separate filter or view).
- **FR-012**: Answering "Didn't know" on a non-Mastered word in the flashcard session MUST reset it to the earliest stage (unchanged from current behavior).
- **FR-013**: Mastered words MUST be excluded from all "due"/remaining counts and review prompts.
- **FR-014**: No word MUST be deleted as a result of mastering or advancing; mastery is a state change only.
- **FR-015**: Existing vocabulary words MUST default to a non-Mastered state so the change does not silently remove words from review.
- **FR-016**: Mastering a word MUST NOT grant XP, milestones, or update other gamification/stat systems; mastery is purely a review-state change.

### Key Entities *(include if data involved)*

- **Vocabulary Word (Lexicon Entry)**: A collected term with its definition, source book, current spaced-repetition stage, next-review date, and a new **Mastered** indicator (terminal; excluded from review when set).
- **Review Queue (Word of the Day)**: The set of non-Mastered words due today that the dashboard card walks the reader through, with a remaining-count.
- **Flashcard Session Deck**: The set of non-Mastered due words presented for recall (ordered later-stage first), where answering "Knew it" triggers mastery regardless of the word's box.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A word can leave the review pool entirely — it is mastered as soon as the reader answers "Knew it" for it in a flashcard session, after which it never reappears in any queue.
- **SC-002**: For a reader who reviews regularly, the daily review burden trends down over time as words graduate, rather than growing without bound.
- **SC-003**: The Word of the Day card's remaining-count matches the actual number of due words 100% of the time, and reaches zero ("All caught up") when the reader finishes.
- **SC-004**: 100% of Mastered words are absent from both review surfaces and from due counts, while remaining findable in the Great Library.
- **SC-005**: Zero vocabulary words are deleted by advancing or mastering.
- **SC-006**: A reader can tell at a glance how many review words remain (dashboard) and their position in a flashcard session (e.g., "5 of 15").

## Assumptions

- The existing Leitner-style spaced-repetition model (five stages with increasing intervals) remains the scheduling mechanism; this feature adds a terminal Mastered state on top of it and does not change the interval values.
- In the flashcard session, "Knew it" now **masters** the word (regardless of box) rather than advancing it a stage; "Didn't know" still resets it to the earliest stage. The Word of the Day card's arrow keeps its advance-one-stage behavior.
- The Word of the Day card's arrow continues to act as a lightweight "advance one stage" control (treated as a successful recall) and is explicitly *not* a graduation path.
- Mastered words appear inline in the default Great Library list with a "Mastered" badge; they are not hidden, and no separate "Mastered" screen is required.
- Mastery is a pure state change — it deliberately does not award XP, milestones, or touch the Book Passport vocabulary count or other gamification systems.
- Un-mastering a word (manually returning it to review) is out of scope for this feature.
- Reducing vocabulary inflow (capture-time dedupe / curation) is a separate effort and is out of scope here.

## Out of Scope

- Throttling or curating how words enter the lexicon (capture-time dedupe, pick-what-to-keep, common-word filtering).
- A manual "un-master" / re-learn action.
- Changing the Leitner interval values or the per-session card cap.
- Any redesign of the Great Library beyond surfacing the Mastered indicator/filter.
