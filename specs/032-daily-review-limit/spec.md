# Feature Specification: Daily Review Limit & Backlog Smoothing

**Feature Branch**: `032-daily-review-limit`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "After a multi-day absence, all overdue vocabulary becomes due at once and is surfaced as one giant unbounded queue (e.g. 147 words on the Word of the Day card), which is overwhelming and breaks the daily habit. There is no daily review cap today. Bound the review workload to an achievable DAILY amount so neither the dashboard Word of the Day card nor the Anki flashcard session ever asks the reader to grind through a huge backlog at once, while still draining the backlog steadily and never losing or skipping words. Daily limit N = 20; soft cap (surface top-N, non-destructive); priority lowest Leitner box first, tie-break most overdue; include a 'review more' escape hatch. Both surfaces share one capped 'today's review set'; counts reflect the capped set; words beyond the limit roll into following days; mastered words remain excluded (031); anchored to the reader's local day; new and review words share one combined cap."

## Clarifications

### Session 2026-06-17

- Q: How is the daily limit counted/enforced (so it actually caps the day rather than just showing 20 at a time)? → A: Per-day review tally — every word reviewed today (a Word of the Day advance, or an Anki "Knew it"/"Didn't know") counts 1 toward the 20; remaining = 20 − reviewed-today; a word reviewed today does not reappear later the same day; once the tally hits 20 the day is "done" and only "review more" surfaces additional due words.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning after an absence is not overwhelming (Priority: P1)

A reader who has been away for several days opens the dashboard. Instead of being told they have 147 words to grind through, they see an achievable daily set of at most 20 words. They work through that set on the Word of the Day card, finish it in a few minutes, and feel caught up for the day — even though more overdue words remain in the backlog, to be surfaced over the coming days.

**Why this priority**: This is the entire point of the feature — eliminating the demoralizing pileup that breaks the habit. Without it the problem persists.

**Independent Test**: With far more than 20 words due (e.g., 147), open the dashboard and confirm the Word of the Day card presents at most 20 words to walk through, the count reads as an achievable daily target (not 147), and reaching the end shows the caught-up state while the remaining backlog is untouched and not lost.

**Acceptance Scenarios**:

1. **Given** many more than 20 words are due, **When** the reader opens the Word of the Day card, **Then** it walks through at most 20 words for the day and the count reflects that capped set (e.g., "X of 20"), not the full backlog.
2. **Given** the reader has worked through today's 20-word set, **When** they advance the last one, **Then** the card shows the caught-up state for the day (no remaining-count), even if more overdue words exist.
3. **Given** overdue words beyond the daily limit, **When** today ends and a new day begins, **Then** those words become eligible in the next day's set — nothing is deleted, dropped, or permanently skipped.
4. **Given** fewer than 20 words are due, **When** the reader opens the card, **Then** the real (sub-20) count is shown and behavior is unchanged.

---

### User Story 2 - The flashcard session honors the same daily set (Priority: P1)

When the reader starts the Anki flashcard session, it draws from the **same** capped daily set as the Word of the Day card — not a separate pile and not the whole backlog. The position indicator and any "due" prompt reflect the capped set, so the two surfaces tell a consistent story about how much is left for today.

**Why this priority**: If the two surfaces used different or uncapped pools, the reader would still be confronted with the backlog in the session, defeating the purpose. Consistency between surfaces is required for the cap to actually bound the daily workload.

**Independent Test**: With more than 20 due, open the flashcard session and confirm its deck is drawn from the shared daily set (at most 20), and that progressing it also progresses the dashboard's sense of "today's remaining."

**Acceptance Scenarios**:

1. **Given** more than 20 words are due, **When** the flashcard session builds its deck, **Then** it is drawn from the same shared today's-set (at most 20), not the entire due backlog.
2. **Given** the reader reviews words in the session, **When** they return to the dashboard, **Then** the Word of the Day remaining-count reflects the words already handled today.

---

### User Story 3 - Most fragile words come first (Priority: P2)

When there are more due words than the daily limit, the reader reviews the words most at risk of being forgotten first: the system fills today's set with the lowest-stage (most fragile) due words first, breaking ties by the most overdue. This makes the limited daily review the most valuable for retention.

**Why this priority**: A cap is only as good as what it prioritizes; surfacing the most fragile words first protects retention while the backlog drains.

**Independent Test**: With a mix of low- and high-stage overdue words exceeding the limit, confirm today's set is filled with the lowest-stage words first, ties broken by most overdue.

**Acceptance Scenarios**:

1. **Given** due words span low and high spaced-repetition stages and exceed the limit, **When** today's set is selected, **Then** the lowest-stage due words are included first.
2. **Given** two due words at the same stage, **When** the set is selected, **Then** the more overdue one is preferred.

---

### User Story 4 - Power readers can keep going (Priority: P3)

A motivated reader who finishes today's 20-word set and wants to keep clearing the backlog can choose to **review more**, voluntarily continuing beyond the daily limit in that sitting. The limit is a default daily target, not a hard wall.

**Why this priority**: It respects engaged users and lets them drain the backlog faster, without imposing that effort on everyone by default.

**Independent Test**: Finish today's set, choose "review more," and confirm additional due words (still prioritized) are presented beyond the daily limit.

**Acceptance Scenarios**:

1. **Given** the reader has finished today's set and more words remain due, **When** they choose "review more", **Then** additional due words are surfaced beyond the daily limit, in the same priority order.
2. **Given** no more words are due at all, **When** the reader is caught up, **Then** no "review more" action is offered (or it indicates nothing remains).

---

### Edge Cases

- **Huge backlog (147), limit 20** → exactly 20 are surfaced for the day; the other 127 wait for following days; the count never displays 147.
- **Exactly the limit due (20)** → all 20 surfaced; normal.
- **Fewer than the limit due** → the real count is shown; no capping behavior visible.
- **New captures added today** → due-today new words compete for the same single daily cap (no separate new-vs-review allotment).
- **All due words are mastered** → none surfaced (mastered already excluded); caught-up state.
- **Day rollover** → "today" is the reader's local day; a new day yields a fresh allotment.
- **Mid-day return** → today's set reflects the tally (remaining = 20 − reviewed-today); it does not re-expand back to a full fresh 20 after partial completion within the same day.
- **"Didn't know" word** → it counts toward today's tally and returns on a later day (or via "review more"), not repeatedly within the same day.
- **"Review more" then leaves and returns** → the daily target framing remains coherent; already-reviewed words don't reappear unless their schedule legitimately makes them due again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define a daily review limit of 20 words.
- **FR-002**: The system MUST construct a single shared "today's review set" of at most (daily limit − words already reviewed today), drawn from due, non-Mastered words not already reviewed today.
- **FR-003**: Both the Word of the Day card and the flashcard (Anki) session MUST draw from this same shared today's-set, not separate pools and not the full backlog.
- **FR-004**: When due words exceed the daily limit, the system MUST select the set by priority: lowest spaced-repetition stage first, ties broken by most overdue.
- **FR-005**: The Word of the Day remaining-count and the flashcard session MUST reflect today's capped set (e.g., "X of 20"), not the entire due backlog.
- **FR-006**: Words due beyond the daily limit MUST remain due and become eligible in subsequent days; the system MUST NOT delete, drop, or silently skip them, and MUST NOT reschedule/alter their review dates (soft cap, non-destructive).
- **FR-007**: When fewer than the daily limit are due, the system MUST show the real count and apply no visible capping.
- **FR-008**: Mastered words MUST remain excluded from the due pool and the daily set (consistent with feature 031).
- **FR-009**: The daily allotment MUST be anchored to the reader's local day boundary (a new local day yields a fresh allotment).
- **FR-010**: New (recently captured) words that are due MUST count against the same single daily limit as review words (no separate new-vs-review caps).
- **FR-011**: The system MUST provide a "review more" action that lets the reader voluntarily review due words beyond the daily limit within a sitting, preserving the priority order; the limit is a default target, not a hard block.
- **FR-012**: Partial completion within a day MUST NOT re-expand the day's set back to a full fresh limit (today's remaining reflects what is left of today's allotment).
- **FR-013**: The daily limit MUST be enforced as a per-day **tally**: each word reviewed today (a Word of the Day advance, or an Anki "Knew it"/"Didn't know") counts once toward the limit; today's remaining = daily limit − words reviewed today; once the tally reaches the limit, the day's set is empty and only "review more" surfaces additional due words. A word reviewed today MUST NOT be surfaced again later the same day.

### Key Entities *(include if data involved)*

- **Vocabulary Word (Lexicon Entry)**: Existing entry with a spaced-repetition stage, next-review date, and Mastered flag. No new stored fields are implied by the soft cap — selection is derived.
- **Today's Review Set**: A derived selection of due, non-Mastered words not yet reviewed today, capped at (daily limit − words reviewed today), ordered by priority (lowest stage, then most overdue). Transient — not persisted.
- **Daily Review Tally**: The count of words reviewed today (across the Word of the Day card and the Anki session), measured against the reader's local day. Drives "today's remaining = daily limit − tally."
- **Daily Review Limit**: The numeric cap (20) the tally is measured against.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Word of the Day card never presents more than 20 words to walk through in a day by default — a returning-after-absence reader never sees a "147"-style count.
- **SC-002**: A reader returning after days away can clear the default daily set in a few minutes (≤ ~5 minutes for 20 words).
- **SC-003**: With daily reviewing, the overdue backlog strictly decreases day over day (drains at up to the daily limit per day, minus re-failures), trending to zero.
- **SC-004**: The Word of the Day card and the flashcard session always agree on how many words remain for today (same shared set).
- **SC-005**: No vocabulary word is lost or permanently skipped as a result of the cap — every deferred word remains eligible on a later day.
- **SC-006**: A motivated reader can, on demand, review beyond the daily limit and continue draining the backlog in one sitting.

## Assumptions

- The existing Leitner-style spaced-repetition stages and intervals are unchanged; this feature only governs **how many** due words are surfaced per day and in **what order** — it does not change *when* a word becomes due.
- "Most fragile" maps to the lowest spaced-repetition stage; "most overdue" maps to the earliest next-review date among ties.
- The daily limit (20) is a fixed default for v1 (not user-configurable). User configuration is a possible later enhancement.
- The "review more" escape hatch surfaces additional **already-due** words in priority order; it does not pull words that are not yet due.
- This builds on feature 031 (Mastered exclusion). It assumes 031's behavior is present.
- The daily tally is measured against the reader's local day and is tracked per account, so today's remaining stays consistent across reloads and devices.

## Out of Scope

- Throttling or curating how words **enter** the lexicon (capture-time dedupe / pick-what-to-keep / common-word filtering).
- Changing Leitner interval values or the graduation logic.
- Actively rescheduling/load-balancing overdue words across future days (the chosen approach is a non-destructive soft cap).
- Making the daily limit user-configurable, or separate new-vs-review daily caps.
