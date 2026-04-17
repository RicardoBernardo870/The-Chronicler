# Feature Specification: AI Recap & Progress Tracking Fixes

**Feature Branch**: `004-ai-recap-fixes`  
**Created**: 2026-04-17  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reliable Progress History Recording (Priority: P1)

A reader saves their page number and expects the app to silently record each reading session so that velocity badges, BookPassport stats, and recap quality all work correctly. Currently, zero rows are ever written to `progress_history` because the insert call is never executed — meaning every downstream feature that depends on it (velocity, days-to-finish, peak-day) produces blank results.

**Why this priority**: Every other feature in this spec depends on `progress_history` having data. Nothing works without it.

**Independent Test**: Save a page number on any book. Query `progress_history` directly — a row must appear. Repeat for several page updates; each must produce a distinct row.

**Acceptance Scenarios**:

1. **Given** a logged-in reader, **When** they save any page number, **Then** a new row is inserted into `progress_history` with the correct book ID, user ID, page, and timestamp.
2. **Given** a reader who saves progress multiple times, **When** they save each time, **Then** each save produces its own distinct row (history is append-only, not upserted).
3. **Given** the reader is offline, **When** they save progress, **Then** the history insert is attempted when connectivity is restored (best-effort, silent failure allowed offline).

---

### User Story 2 — Reliable AI Recap Output (Priority: P1)

A reader requests a recap and expects a properly structured three-part briefing (Memory Jogger, Concept Watchlist, Thematic Bridge). Currently recaps sometimes return an "incomplete recap received" error because: (a) cached fragments with empty or truncated content are passed as context to the AI, causing it to produce empty JSON fields; (b) the AI response can exceed the current token limit and be truncated mid-JSON; (c) a race condition allows a second recap request to start while the first is still streaming.

**Why this priority**: The recap is the primary AI feature. Unreliable output breaks trust.

**Independent Test**: Generate a recap for a book at any progress level three times in a row — every attempt must return a fully populated three-part briefing with no empty fields and no error state.

**Acceptance Scenarios**:

1. **Given** a recap is requested, **When** the AI responds, **Then** all three fields (memory_jogger, concept_watchlist, thematic_bridge) are non-empty strings.
2. **Given** a fragment cache exists for the book but some fragments contain empty or raw-fallback content, **When** a recap is generated, **Then** only valid, structured fragments are passed as context; invalid ones are silently skipped.
3. **Given** a recap generation is already in progress (streaming), **When** the user tries to trigger another recap, **Then** the button is disabled and unclickable until the current stream completes.
4. **Given** the AI produces a response larger than the previous token limit, **When** the edge function processes it, **Then** the response is not truncated mid-JSON (token budget increased sufficiently).

---

### User Story 3 — Incremental (Range-Based) Recaps (Priority: P2)

A reader who reads in sessions (page 0→30 one day, 30→60 another day) wants each recap to cover only what they have read *since their last recap*, not the entire book from the start. This gives them a true "what happened since I last picked this up" experience rather than a summary they have already seen.

**Why this priority**: High-value UX improvement that makes recaps actionable; does not block other stories.

**Independent Test**: Generate a recap at page 30, then advance to page 60 and generate again. The second recap's Memory Jogger must not repeat events from the first recap's coverage range and must specifically cover page 30–60 content.

**Acceptance Scenarios**:

1. **Given** a reader has a prior recap at page 30, **When** they generate a new recap at page 60, **Then** the AI is instructed to cover pages 30 to 60 only, not pages 1 to 60.
2. **Given** a reader has no prior recap, **When** they generate their first recap at any page, **Then** the AI covers pages 1 to that page (existing behaviour, unchanged).
3. **Given** a reader generates multiple recaps across a reading session, **When** each subsequent recap is generated, **Then** each covers only the delta from the previous recap page to the current page.
4. **Given** the incremental range is very small (e.g., only 5 pages), **When** a recap is generated, **Then** the recap is still generated and is relevant to that narrow range.

---

### User Story 4 — Book Completion Experience (Priority: P1)

When a reader finishes a book (reaches 100%), the experience must change: the standard AI Recap button must disappear (the story is over; there is nothing left to summarise incrementally), and the Book Passport becomes the sole AI destination. Any attempt to run a standard recap on a completed book produced confusing errors and a spoiler-constrained output — both must be eliminated.

**Why this priority**: The current behaviour is actively broken at the most celebratory moment in reading.

**Independent Test**: Set a book to 100%. Verify the AI Recap section is fully hidden. Navigate to BookPassportPage and verify the full story summary is present and narrative in form.

**Acceptance Scenarios**:

1. **Given** a book's progress is at 100%, **When** the reader views BookDetailPage, **Then** the AI Recap section (button, hint, history link) is not visible.
2. **Given** a book's progress is at 100%, **When** the reader views BookDetailPage, **Then** a "View Reading Journey" button is the only AI-related call to action, and it navigates to BookPassportPage.
3. **Given** a book is at 100%, **When** BookPassportPage loads, **Then** the AI summary is a flowing narrative paragraph covering the full arc, themes, and memorable moments — not a three-field JSON structure.
4. **Given** the Recap History shows past recaps, **When** the book reaches 100%, **Then** the history link is also hidden (past recaps remain stored but are not surfaced in BookDetail at completion).

---

### User Story 5 — BookPassport Stats Accuracy (Priority: P1)

A reader who completes a book expects the BookPassport to show correct reading statistics: total days taken, the peak reading day and its page count, and vocabulary words saved. Currently all stat fields are null because they depend on `progress_history` being populated (which is broken by US1) and because there is no fallback when history is sparse.

**Why this priority**: Directly tied to US1 fix; once history records correctly, stats must compute correctly.

**Independent Test**: Complete a book after saving progress on at least two different calendar days. BookPassportPage must show a non-null total_days, a non-null peak_day date, and a non-null peak_day_pages count.

**Acceptance Scenarios**:

1. **Given** `progress_history` has at least two rows on different calendar days, **When** a BookPassport is generated, **Then** `total_days` equals the number of days between first and last recorded session.
2. **Given** `progress_history` has rows, **When** a BookPassport is generated, **Then** `peak_day` is the calendar date on which the most pages were read, and `peak_day_pages` is the page count for that day.
3. **Given** `progress_history` has only one row (book completed in one session), **When** a BookPassport is generated, **Then** `total_days` is 1 and the single day is also the peak day.
4. **Given** a BookPassport was previously generated with null stats (due to the bug), **When** the reader regenerates it, **Then** the new passport reflects correct stats.

---

### User Story 6 — ISBN Context for AI (Priority: P3)

When a book has an ISBN stored, it should be passed to every AI call (recaps, fragment extraction, passport generation) so the AI can more precisely identify the edition and produce more accurate chapter-level content. Currently the ISBN is often null because it is not stored when books are added manually, and even when present, it is not always forwarded to the edge function.

**Why this priority**: Quality improvement; does not break anything if absent. Lowest impact of all stories.

**Independent Test**: Add a book via ISBN scan. Trigger a recap. Verify the edge function receives the `isbn` field in its request payload. Verify the resulting recap references book-specific details not guessable from title alone.

**Acceptance Scenarios**:

1. **Given** a book has an ISBN in the database, **When** any AI call (recap, fragment, passport) is made, **Then** the ISBN is included in the request payload sent to the edge function.
2. **Given** a book has no ISBN (added manually), **When** any AI call is made, **Then** the ISBN field is omitted or null and the call succeeds without error.
3. **Given** the Add Book form, **When** a user enters a book manually, **Then** an optional ISBN field is available so they can supply it for better AI context.

---

### User Story 7 — Velocity Badge Visibility (Priority: P2)

The reading velocity badge (pages/hour + finish-line prediction) must appear on BookDetailPage whenever there is enough reading history to compute a meaningful speed. Currently it never appears because `progress_history` is always empty (US1 dependency).

**Why this priority**: Depends entirely on US1; once history records, this must work automatically.

**Independent Test**: Save progress twice with a short gap. Reload BookDetailPage. The velocity badge must appear showing a pages/hour figure.

**Acceptance Scenarios**:

1. **Given** `progress_history` has at least two entries for a book within a single session, **When** the reader opens BookDetailPage, **Then** the velocity badge shows a pages/hour figure and a finish-line estimate.
2. **Given** `progress_history` has only one entry (no session to compute from), **When** the reader opens BookDetailPage, **Then** the velocity badge is hidden (existing null-guard behaviour, unchanged).
3. **Given** a book is at 100% and a BookPassport exists, **When** the reader opens BookDetailPage, **Then** the velocity badge is hidden (reading is complete).

---

### Edge Cases

- What if the AI returns valid JSON but with one or more empty string fields? The recap should be considered incomplete and the error state shown.
- What if the reader jumps more than one 10% milestone in a single save (e.g., 5% → 35%)? Multiple fragment extractions should be queued, one per crossed milestone.
- What if progress_history rows exist but all are on the same calendar day? `total_days` should be 1, not 0 or null.
- What if a BookPassport generation is still streaming when the reader navigates to BookPassportPage? The streaming state must be shown correctly and the page must not crash.
- What if fragments are available but all are invalid (raw/empty)? The recap should fall back to a full pass-1 extraction rather than producing an empty result.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST execute the `progress_history` insert on every successful page save while the user is online, using a method that guarantees the database call is dispatched (not silently dropped by a lazy promise).
- **FR-002**: The system MUST filter out invalid recap fragments (those with empty content or non-structured fallback data) before passing them to the AI recap generator.
- **FR-003**: The AI edge function MUST use a token budget sufficient to prevent JSON truncation during content extraction (minimum 8 000 output tokens for extraction pass).
- **FR-004**: The recap generation button MUST be disabled and non-interactive while any recap stream for the same book is in progress.
- **FR-005**: The AI recap for an incremental session MUST instruct the AI to cover only pages from the previous recap's end page to the current page, not from page 1.
- **FR-006**: When a book reaches 100% progress, the AI Recap section (button, hint, history link) MUST be hidden from BookDetailPage.
- **FR-007**: The BookPassport AI summary MUST be generated using a narrative prompt that produces a flowing story summary, not the three-field JSON recap structure.
- **FR-008**: The BookPassport stat fields (total_days, peak_day, peak_day_pages) MUST be computed from `progress_history` rows and stored correctly when the passport is generated.
- **FR-009**: When an ISBN is present on a book, it MUST be included in the payload for every AI call (recaps, fragments, passport).
- **FR-010**: The system MUST NOT allow a second recap request to be initiated while the first is still streaming for the same book.
- **FR-011**: The velocity badge MUST appear on BookDetailPage when at least two `progress_history` entries exist within a computable session window for that book.
- **FR-012**: Fragment extraction MUST NOT save a fragment record when the AI response is empty or cannot be parsed into a structured object.

### Key Entities

- **ProgressHistory**: An append-only log of page saves per user per book, with timestamp. Powers velocity, passport stats, and continuity score.
- **RecapFragment**: A cached AI extraction of book content up to a milestone page. Must contain valid structured JSON to be usable. Invalid fragments must be excluded from AI context.
- **Recap**: A three-part AI briefing (Memory Jogger, Concept Watchlist, Thematic Bridge) anchored to a page range — from the prior recap's end page to the current page.
- **BookPassport**: A completion trophy record containing computed reading stats and a narrative AI summary of the full book.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After saving progress on any book, a row appears in `progress_history` within 2 seconds — verified in 100% of test cases.
- **SC-002**: Recap generation produces a fully populated three-part briefing (all fields non-empty) on every attempt, with zero "incomplete recap" errors across 10 consecutive test runs.
- **SC-003**: A second recap at page 60 (after a first at page 30) references content from pages 30–60 only, with no repetition of events already covered in the first recap.
- **SC-004**: BookDetailPage with a 100% book shows no AI Recap section elements; 0 visible recap-related buttons or hints.
- **SC-005**: BookPassportPage for a book with multi-day reading history shows non-null values for total_days, peak_day, and peak_day_pages — verified for any book saved across at least 2 calendar days.
- **SC-006**: The BookPassport AI summary reads as a narrative paragraph with no JSON syntax characters (`{`, `"memory_jogger"`, etc.) visible to the user.
- **SC-007**: VelocityBadge appears on BookDetailPage within one page reload after two progress saves on the same book.
- **SC-008**: Recap button is unresponsive while a stream is active — no duplicate network requests are made regardless of how many times the button area is tapped.

---

## Assumptions

- The `progress_history` table schema and RLS policy are already correctly defined; only the client-side insert call needs to be fixed (confirmed: RLS policy `auth.uid() = user_id` is in place, table structure is correct).
- The ES256 JWT issue only affects server-side `auth.getUser()` calls, not client-side PostgREST RLS operations; fixing the insert call (not the JWT) is sufficient for US1.
- Increasing extraction `maxOutputTokens` to 8 000 is within Gemini 2.5 Flash's limits and will not meaningfully increase cost or latency.
- The `from_page` parameter for incremental recaps will be sourced from the most recent stored recap's `page_snapshot` for that book.
- For books with no ISBN, AI quality degrades gracefully; no error handling change is required.
- The manual Add Book form already exists; adding an optional ISBN field is a minor UI addition scoped to this spec.
- BookPassport regeneration (for users whose passport was generated with null stats) is out of scope for automated migration; users will regenerate manually by navigating to BookPassportPage.
