# Feature Specification: Corpus-Grounded Delta Recaps

**Feature Branch**: `015-corpus-recaps`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Replace AI-inferred recaps with recaps generated from the actual text the user has captured from their book pages. Recaps are scoped to the delta between the last recap and the user's current progress, so each recap reads as the next chapter in a chronological story journal. Capture happens via camera + OCR (Gemini 2.5 Flash Vision multimodal) at the moment a session ends, replacing the existing session-note prompt on the Last Session card. Page numbers are NEVER auto-detected from the photo — they are always taken from the user's manually-tracked current_page (some editions, e.g. multi-volume LOTR sets, have inconsistent printed page numbers)."

## Clarifications

### Session 2026-04-26

- Q: Coverage threshold — what happens at exactly 30% capture coverage of the delta range? → A: ≥30% → corpus, <30% → inferred. Threshold is inclusive at the lower bound.
- Q: Are the photographed images persisted, or only the OCR text? → A: Discard the image after OCR completes; persist only OCR text + confidence score.
- Q: Maximum capture text size per page, and any per-user cap? → A: 10,000 characters per capture; no per-user cap in v1.
- Q: OCR confidence signaling on the verify screen — explicit warning, silent, or numeric? → A: Explicit warning below 0.7 confidence (yellow banner advising careful review); silent above threshold.
- Q: Can users explicitly delete captures, and through what mechanism? → A: No explicit delete UI in v1. Captures are removed only via cascade (book/account deletion) or re-capture overwrite.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Capture the last page after a reading session (Priority: P1)

After ending a reading session, the reader is offered an inline prompt on the Last Session card: *"📸 Capture this page"*. They tap it, point their phone at the page they just finished, and snap a photo. The app extracts the page text via OCR, shows it on a verify screen for review, and on confirm saves the text to a private per-book corpus — keyed against the page number the reader already entered when ending the session, never against any number printed on the photographed page.

**Why this priority**: This is the foundational data layer for the entire feature. Without captures there is nothing for the recap engine to ground itself in. Building the capture flow alone — even before any recap changes ship — already delivers a tangible artifact to the reader (a private archive of the pages they've read) and validates the camera + OCR path end-to-end. The session-end moment is also the lowest-friction capture moment, because the book is still open in front of the user.

**Independent Test**: A reader can finish a session, complete a capture (snap → verify → save), close the app, reopen it, and see that the captured text persists against the correct (manually-entered) page number. The capture is private to that user and scoped to that book. No recap behavior is required for this story to deliver value.

**Acceptance Scenarios**:

1. **Given** a reader has just ended a session that recorded their progress at page 142, **When** they tap "📸 Capture this page" and confirm a clear OCR result, **Then** the captured text is persisted with `page = 142` regardless of any page number printed on the photographed page.
2. **Given** a reader is shown the verify screen with OCR'd text, **When** they edit the text to correct an OCR mistake and tap Confirm, **Then** the edited text (not the raw OCR text) is what persists.
3. **Given** a reader does not want to capture this session, **When** they tap Skip, **Then** no capture row is created, no note is created, and no error is shown.
4. **Given** a reader prefers to leave a note instead of capturing, **When** they tap "Add note instead", **Then** the existing session-note flow is presented and operates as before.
5. **Given** a reader denies camera permission, **When** they tap "📸 Capture this page", **Then** they see a clear permission-denied message with a one-tap fallback to "Add note instead".
6. **Given** a reader is on a previously-captured page and re-captures it, **When** they confirm, **Then** the new text overwrites the old text for that `(user, book, page)` tuple.

---

### User Story 2 — Get a corpus-grounded delta recap (Priority: P1)

When a reader has captured enough pages of a book and taps **Get Recap**, the recap they receive is generated from their actual captured text, scoped to the stretch of pages between their last recap and their current position. The recap reads as *"what happened in this stretch"*, not as a story-so-far summary, so it never repeats material from earlier recaps and never speculates about uncaptured pages.

**Why this priority**: This is the core value proposition. Today's recaps are inferred from book metadata and frequently hallucinate. Corpus-grounded recaps quote the reader's actual edition, never spoil, and — because they're delta-scoped — read as a continuous story journal in the Recap History. This is the differentiator vs every other reading app on the market.

**Independent Test**: A reader who has completed enough captures (≥30% coverage of the delta range) can tap Get Recap and verify (a) the recap content references events that appear in the captured text, (b) no events appear that come from beyond `current_page`, and (c) no events appear that were already covered in the prior recap. The Recap History page then reads chronologically as a journal of distinct stretches.

**Acceptance Scenarios**:

1. **Given** a reader has captured 18 pages between page 50 and page 100 (their current progress), and their last recap was generated at page 50, **When** they tap Get Recap, **Then** the new recap is generated from those 18 captured pages and covers only events that occurred in pages 51–100.
2. **Given** a reader has no prior recaps for a book, **When** they tap Get Recap with sufficient capture coverage from page 1 to current, **Then** the delta range starts at page 0 and the recap covers everything captured up to current.
3. **Given** a reader has accumulated multiple corpus recaps over time, **When** they open the Recap History page, **Then** the recaps appear in chronological order and each entry covers a distinct, non-overlapping stretch of the book.
4. **Given** a reader's captures cover less than 30% of pages in the delta range, **When** they tap Get Recap, **Then** the system silently falls back to today's inferred-mode recap and the existing user experience is preserved.
5. **Given** a recap was generated in corpus mode, **When** the reader views the recap card, **Then** a subtle "📸 Generated from your captures" badge is visible.
6. **Given** a corpus recap is generated, **When** the recap row is persisted, **Then** the row records `mode = 'corpus'` (and an inferred recap records `mode = 'inferred'`).

---

### User Story 3 — Graceful fallback when capture is unavailable or insufficient (Priority: P2)

A reader who is offline, has skipped many sessions, or simply cannot capture (camera broken, page is in a foreign script the OCR can't handle, etc.) still gets a working recap experience. The system never shows an error or empty state to the reader because corpus capture is unavailable — it transparently falls back to the existing inferred-mode recap pipeline.

**Why this priority**: Corpus capture is opt-in by definition (one tap per session). For the feature to be safe to ship, corpus mode must never become a hard dependency. This story protects the existing user experience: anyone who never captures still gets the same recap quality they get today.

**Independent Test**: A reader who has never captured a single page can tap Get Recap and receive a working inferred-mode recap, identical in shape and timing to today's behavior. Coverage thresholds, OCR failures, and camera-permission denials all funnel cleanly into the existing inferred path.

**Acceptance Scenarios**:

1. **Given** a reader has zero captures for a book, **When** they tap Get Recap, **Then** an inferred-mode recap is generated and `mode = 'inferred'` is persisted.
2. **Given** OCR returns an empty string or fails, **When** the verify screen is shown, **Then** the reader is offered Retake or Skip options and no garbage capture is saved.
3. **Given** a reader is offline at the moment they would capture, **When** they tap "📸 Capture this page", **Then** they see an offline notice and can defer capture to later or fall back to a note.
4. **Given** corpus coverage is below 30% of the delta range, **When** Get Recap is requested, **Then** inferred mode is selected. At exactly 30% coverage the threshold is met and corpus mode is selected.

---

### Edge Cases

- **OCR returns very low confidence or garbled text**: Verify screen displays the text as returned and lets the reader edit or retake before commit. Confidence score is persisted alongside the capture for future analytics, but the user sees only the text.
- **Reader photographs the wrong page** (different book, different volume, blank page): Page number is locked to `current_page`, so the wrong content is keyed to the right page slot. The reader can re-capture that page on a future session to overwrite. No automatic detection of wrong-page is attempted.
- **Reader's current_page has not been updated after a session** (legacy data): The capture is keyed to whatever `current_page` is at capture time. If `current_page` is 0, the capture is keyed to page 0 and is harmless.
- **Reader regenerates an already-existing recap**: A new recap row is created with the same delta range; both rows are kept. The history reads chronologically by `created_at`. This matches today's behavior.
- **Multiple captures attempted in a single session**: Out of scope for this feature — the prompt appears once per session-ended event and dismisses on confirm/skip. Subsequent captures of the same page are possible only via end-of-session prompts in future sessions.
- **A book is deleted while captures exist**: Cascade delete removes all captures for that book.
- **A user account is deleted**: Cascade delete removes all captures owned by that user.
- **A capture image fails to upload**: The capture is not committed; the verify screen shows a retry option.
- **Coverage = 0% but pages_in_range > 0**: Inferred mode fallback. Same as the no-captures-at-all case.
- **`last_recap_page > current_page`** (impossible, but defensive): Treat the delta as empty, fall back to inferred mode.

## Requirements *(mandatory)*

### Functional Requirements

#### Capture Flow

- **FR-001**: System MUST replace the post-session "Add session note" prompt in the Last Session card with a "📸 Capture this page" prompt as the primary action.
- **FR-002**: System MUST preserve the option to "Add note instead" as a secondary action that opens the existing session-note flow.
- **FR-003**: System MUST preserve the existing Skip behavior with no capture and no note created.
- **FR-004**: System MUST open the device camera and capture a single still image when the reader taps the capture action.
- **FR-005**: System MUST send the captured image to a server-side OCR endpoint and display a verify screen with the extracted text once OCR completes.
- **FR-006**: System MUST allow the reader to edit the OCR'd text on the verify screen prior to saving.
- **FR-006a**: System MUST display a visible low-confidence warning on the verify screen when OCR confidence is below 0.7, advising the reader to review the text carefully before saving. When confidence is at or above 0.7, no warning is shown.
- **FR-007**: System MUST NOT auto-detect the book page number from the photographed image. Page number is always sourced from the reader's current `reading_progress.current_page` at capture time.
- **FR-008**: System MUST persist a capture row containing the user, book, page, raw text, word count, confidence score, and timestamp.
- **FR-008a**: System MUST cap each capture's text at 10,000 characters. If OCR returns more, the verify screen presents the truncated text and the reader can edit before commit. No per-user aggregate cap is enforced in v1.
- **FR-009**: System MUST overwrite any existing capture for the same `(user, book, page)` tuple when a re-capture is committed.
- **FR-010**: System MUST handle camera-permission denials by surfacing a clear message and offering the "Add note instead" fallback.
- **FR-011**: System MUST handle OCR failures (timeout, empty text, network error) by allowing the reader to Retake or Skip without committing a partial capture.

#### Storage and Privacy

- **FR-012**: System MUST scope all capture data to the owning user via row-level security; no user can access another user's captures.
- **FR-013**: System MUST cascade-delete captures when the parent book or user is removed.
- **FR-014**: System MUST encrypt capture content at rest using the platform's standard encryption.
- **FR-015**: System MUST NOT use capture content for any purpose other than generating that user's own recaps.
- **FR-015a**: System MUST NOT persist the photographed image after OCR completes. Only the extracted text, confidence score, and metadata are retained. The image is processed in-memory by the OCR endpoint and discarded immediately upon response (or upon retake/skip).

#### Recap Generation

- **FR-016**: System MUST, when generating a recap, fetch all captures with `page > last_recap_page AND page <= current_page` for the requesting user and book.
- **FR-017**: System MUST treat `last_recap_page = 0` when no prior recap exists.
- **FR-018**: System MUST select corpus mode when captures cover at least 30% of the integer pages in the delta range (inclusive at the boundary: exactly 30% qualifies for corpus mode), and inferred mode otherwise.
- **FR-019**: System MUST, in corpus mode, instruct the AI to summarize only the provided captured text and not infer events from outside the provided pages.
- **FR-020**: System MUST, in inferred mode, use the existing recap-generation logic unchanged.
- **FR-021**: System MUST persist a `mode` attribute on every recap indicating which path produced it.
- **FR-022**: System MUST preserve the existing recap unlock rules (every +10% progress, or 3 days idle).
- **FR-023**: System MUST preserve recap streaming behavior in both corpus and inferred modes.

#### UX

- **FR-024**: System MUST display a "📸 Generated from your captures" badge on recap cards whose `mode = 'corpus'`.
- **FR-025**: System MUST present the Recap History page in chronological order, where each corpus-mode entry covers a distinct, non-overlapping stretch of the book.
- **FR-026**: System MUST surface the capture prompt only when a session has just ended (same trigger as today's note prompt).

### Key Entities

- **PageCapture**: A single captured page of a book, owned by one user. Holds the OCR-extracted text, the page number (always sourced from the user's tracked progress, never from the photographed page), the word count, the capture timestamp, and the OCR confidence score. **The photographed image itself is never persisted** — it is processed in-memory by the OCR endpoint and discarded once text extraction completes. Unique per `(user, book, page)`. Cascade-deleted with its parent book or user.
- **Recap (extended)**: The existing recap entity gains a `mode` attribute that records whether it was generated from captured text (`'corpus'`) or from inference (`'inferred'`). All other recap attributes (progress snapshot, content, timestamps, streaming fragments) remain unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader can complete a capture (open prompt → snap → verify → save) in under 30 seconds for 90% of attempts.
- **SC-002**: A corpus-mode recap contains zero plot points sourced from pages beyond the reader's `current_page` at the time of generation, verified by spot-check across at least 20 generated recaps.
- **SC-003**: A reader who has never captured a single page receives a working inferred-mode recap on every Get Recap tap, with timing and shape indistinguishable from today's behavior (verified by side-by-side test).
- **SC-004**: Capture data is fully isolated per user; an attempted cross-user fetch returns zero rows in 100% of authorization tests.
- **SC-005**: At least 60% of readers who complete one capture for a book complete a second capture within their next three sessions of that book (engagement signal).
- **SC-006**: For every recap card displaying the "📸 Generated from your captures" badge, the corresponding recap row has `mode = 'corpus'`, and vice versa (UI/data parity, verified by automated check).
- **SC-007**: At ≥30% delta-range coverage, corpus-mode recap generation completes in under the same latency budget as today's inferred mode (no perceived slowdown to the reader).

## Assumptions

- Readers have a device with a working camera and grant the camera permission. Tablet/desktop readers without a rear camera can use any camera available to the browser, or fall back to the existing note flow.
- Network connectivity is available at capture time. OCR is a remote multimodal AI call, not on-device.
- The existing AI provider (Gemini 2.5 Flash) supports multimodal text extraction with quality sufficient for printed book pages in Latin scripts. Non-Latin scripts and handwriting are out of scope for v1.
- The existing recap unlock rules, streaming pipeline, and authentication patterns are reused without modification.
- OCR cost is folded into the existing AI provider budget; no new billing relationship is introduced.
- Capture text is stored in plain UTF-8 in a relational text column; no specialized object storage tier is required for v1.
- Each session ends with at most one capture (no multi-page batch capture). Future features may extend this.
- Capture data is permanent until the user, book, or capture is explicitly deleted; no automatic retention/purge policy is introduced in v1.
- The 30% coverage threshold is a v1 default chosen to balance recap quality against capture friction; it may be tuned in a follow-up feature based on observed quality scores.
- Re-captures of the same page overwrite cleanly; no version history is retained for previous captures.
- "Pages" in the delta range are integers; fractional pages are not modeled.

## Out of Scope (v1)

- OCR-based page-number detection from the photographed page.
- Editing or deleting individual captures from a UI surface. Re-capture overwrite is the only mechanism for replacing a capture; bulk or cascade deletion (account/book removal) is the only mechanism for removing captures wholesale. No per-capture or per-book "delete captures" button is provided in v1.
- A dedicated "captures" page for browsing past captures.
- Highlights extraction, character/cast extraction, density analysis, or any feature beyond recaps that consumes the corpus.
- Audiobook capture (OCR is image-based only).
- Multi-page batch capture in a single session.
- Alternative OCR providers (Tesseract, Vision API, OCR.space). Gemini 2.5 Flash multimodal only.
- Automatic re-generation of historical inferred-mode recaps once corpus coverage retroactively reaches the threshold.
- Sharing or exporting capture data outside the application.
