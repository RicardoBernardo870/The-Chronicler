# Feature Specification: Reader Profile Page with Reading DNA and Auto-Vocabulary Extraction

**Feature Branch**: `016-reader-profile-page`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Reader Profile Page with Reading DNA and Auto-Vocabulary Extraction. Add a new dedicated Profile page combining: (1) Reading DNA — AI-generated 2-3 sentence literary personality summary + personalized BOOK SUGGESTIONS + a small mood signature, regenerated only on threshold (every X books finished or quarterly, never on page load). (2) Auto-Vocabulary Extraction — when a page capture happens, AI extracts up to 5 uncommon/advanced words (HARD CAP: 5 per capture), added to existing Lexicon with in-context definitions, deduplicated, flowing into existing Leitner system. Silent and non-blocking. (3) Profile page sections: DNA card hero, Vocabulary Garden, Lifetime stats grid, Reading heatmap, Top themes word cloud, Library breakdown."

## Clarifications

### Session 2026-04-28

- Q: Where does the genre data for the Library Breakdown come from? → A: From the existing `genre` column on the `books` table. No new schema, no AI inference, no external lookup.
- Q: Should the Profile page include a manual "Regenerate DNA" button? → A: No. Reading DNA regenerates only when the threshold (3 books OR 90 days) is crossed. There is no user-facing manual trigger.
- Q: Should auto-extracted vocabulary words display their source (book + page) in the UI? → A: Yes. Source book + page MUST be stored on each vocabulary word and surfaced everywhere the word appears (Vocabulary Garden recents, full Lexicon entry). This matches the convention of existing cards in the app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A Single Place to See My Reading Identity (Priority: P1)

A reader who has been using the app for some time wants one dedicated page where they can see, at a glance, *who they are as a reader*: how much they've read, how consistently they show up, and how they compare across books in their library. They land on the Profile page and immediately see lifetime stats, their current and longest reading streaks, and a breakdown of their library by genre, author, and pace.

**Why this priority**: This is the foundation of the entire feature. It can ship using only existing data already produced by the app (books, recaps, captures, progress history). It delivers immediate value even before any AI features land, and it gives the user a real "destination" page that previously did not exist.

**Independent Test**: A user with at least one finished book and one active book opens the Profile page from primary navigation, sees populated Lifetime Stats Grid, Library Breakdown, and Top Themes section without needing any AI generation, and can navigate back without errors.

**Acceptance Scenarios**:

1. **Given** a user with reading history (≥1 book, ≥1 logged session), **When** they open the Profile page, **Then** they see populated Lifetime Stats Grid (books finished, books in progress, total pages, total reading hours, all-time velocity, current streak, longest streak).
2. **Given** the same user, **When** they view the Library Breakdown section, **Then** they see genre distribution, total unique authors, and a pace comparison across their books.
3. **Given** a user who has never read anything, **When** they open the Profile page, **Then** they see a friendly empty state inviting them to start their first session.
4. **Given** a user with recaps and lore cards, **When** they view Top Themes, **Then** they see a word cloud or chip list derived from those concepts, with frequency-weighted prominence.

---

### User Story 2 — My Reading DNA Tells Me Who I Am as a Reader (Priority: P2)

After finishing several books, the reader wants a more reflective, personalized view of their taste. They open the Profile page and see, at the top, a Reading DNA card with a 2-3 sentence "literary personality" written in narrative voice, a short mood signature reflecting the emotional patterns across their books, and a small list of personalized book suggestions with one-line reasons describing why each book was chosen for them.

**Why this priority**: This is the headline differentiator of the feature, but it depends on having a meaningful corpus already (recaps, captures, lore cards) and on the Profile page existing. It introduces AI cost, so it ships after the static page is solid.

**Independent Test**: A user with at least the configured threshold of finished books taps the Profile page and sees a populated Reading DNA card with personality summary, mood signature, and 3 to 5 book suggestions; refreshing the page does not regenerate the DNA (it is read from storage); only crossing the regeneration threshold or explicit user action causes a new generation.

**Acceptance Scenarios**:

1. **Given** a user who has finished at least the configured threshold of books, **When** they open the Profile page for the first time, **Then** the system generates their Reading DNA once and persists it; subsequent visits within the threshold display the persisted DNA.
2. **Given** the user has a persisted DNA from earlier, **When** they navigate to the Profile page, **Then** the DNA card renders without triggering any AI call.
3. **Given** the user has crossed the regeneration threshold (finished N more books OR the configured quarterly window has elapsed), **When** they next open the Profile page, **Then** the system regenerates the DNA in the background and replaces the previous version once ready.
4. **Given** the user has not yet finished enough books to meet the minimum threshold, **When** they open the Profile page, **Then** they see an explanatory empty-state card describing what their DNA will reveal once they finish more books, with a clear progress indicator (e.g., "1 of 3 books finished").
5. **Given** a generated DNA exists, **When** the user views their book suggestions, **Then** each suggestion shows the title, author, and a one-sentence reason connecting it to the user's reading history.

---

### User Story 3 — My Vocabulary Grows Automatically as I Read (Priority: P2)

When the reader captures a page during a session (existing behavior), the system silently identifies up to 5 uncommon or advanced words from that captured text and adds them to the user's existing Lexicon with definitions written based on how the words appear in the captured passage. Words already present in the Lexicon are skipped. The user later visits the Vocabulary Garden section of the Profile page and sees the new words alongside their progress through the existing Leitner review system.

**Why this priority**: This delivers compounding long-term value (every capture contributes to vocabulary growth) and integrates with two existing systems (page captures + Leitner). It can ship independently of Reading DNA and ranks alongside DNA in priority because both depend on the AI infrastructure.

**Independent Test**: A user captures a page from a book that contains advanced vocabulary; within seconds (asynchronously), up to 5 new words appear in their Lexicon with in-context definitions; the capture flow itself does not slow, error, or block on the extraction; capturing a page that contains only words already in the user's Lexicon results in zero new entries.

**Acceptance Scenarios**:

1. **Given** the user has just completed a page capture, **When** the OCR text is saved, **Then** an asynchronous vocabulary extraction is triggered and the user's capture flow completes immediately without waiting.
2. **Given** the captured text contains uncommon words, **When** vocabulary extraction completes, **Then** between 1 and 5 new word entries are added to the user's Lexicon, each with a definition phrased to match the in-passage meaning.
3. **Given** the captured text contains a word already in the user's Lexicon, **When** vocabulary extraction completes, **Then** that word is not duplicated and no error is shown.
4. **Given** vocabulary extraction fails (AI service error, timeout, etc.), **When** the user returns to the app, **Then** the capture is preserved, no error is surfaced to the user, and the system silently continues.
5. **Given** newly extracted words exist, **When** the user opens the Vocabulary Garden on the Profile page, **Then** they see total vocabulary count, distribution across Leitner review boxes, and a "Recently Learned" list of the latest 5 words with their context definitions.
6. **Given** a captured page contains many advanced words (e.g., 20+), **When** extraction runs, **Then** at most 5 are added — the AI selects the most useful or rare ones.

---

### Edge Cases

- A user with **zero books finished** opens the Profile page → all sections show empty states; DNA card explains threshold; Vocabulary Garden shows "Capture your first page to begin building your vocabulary."
- A user with **books but no captures** opens the Profile page → Vocabulary Garden shows zero state; other sections populate normally.
- A user **without any recaps or lore** opens the Profile page → Top Themes word cloud shows an empty placeholder; all other sections populate normally.
- DNA generation **fails partway** (AI down, malformed response) → system retains the previous DNA if one exists; otherwise leaves the slot empty with a "We'll try again later" placeholder; no error blocks the rest of the page.
- A vocabulary word the AI extracts is **a proper noun** (character name, place) → such words are excluded from extraction and not added.
- The user **deletes a book** that contributed to their DNA → next regeneration excludes that book; current persisted DNA is left as-is until the next threshold-driven regeneration.
- The user **manually adds the same word** to the Lexicon that the AI later finds in a capture → dedup logic applies; AI does not create a duplicate entry.
- A page capture is **redone for the same page** → vocabulary extraction runs only once for that page-version; subsequent re-captures of the same page do not re-run extraction unless the OCR text differs meaningfully.

## Requirements *(mandatory)*

### Functional Requirements

#### Profile Page (US1)

- **FR-001**: The system MUST provide a dedicated Profile page accessible from the primary application navigation.
- **FR-002**: The Profile page MUST display a Lifetime Stats Grid containing: total books finished, total books currently in progress, total pages read, total reading hours, all-time average reading velocity, current reading streak (consecutive days), and longest reading streak.
- **FR-004**: The Profile page MUST display a Library Breakdown section showing genre distribution (sourced from the existing `genre` column on the books record — no new schema, no AI inference), total unique authors read, and a per-book pace comparison.
- **FR-005**: The Profile page MUST display a Top Themes section derived from concepts surfaced in the user's recaps and lore cards, weighted by frequency.
- **FR-006**: All stats that can be derived from existing user data (books, sessions, recaps, captures, lore cards) MUST be computed without introducing new persistent storage tables.
- **FR-007**: The Profile page MUST render a graceful empty state for any section that lacks the source data needed to populate it.

#### Reading DNA (US2)

- **FR-008**: The system MUST generate a Reading DNA artifact consisting of: a 2-3 sentence literary personality summary, a mood signature, and a list of 3 to 5 personalized book suggestions, each suggestion including the book title, author, and a one-sentence reason.
- **FR-009**: Reading DNA generation MUST consume the user's recaps, lore cards, and captured passages as the primary input corpus.
- **FR-010**: Reading DNA MUST be persisted after generation and reused on subsequent Profile page visits without re-invoking the AI.
- **FR-011**: Reading DNA regeneration MUST occur only when one of the following conditions is met: the user has finished at least N additional books since the last generation, OR a configurable time threshold has elapsed (e.g., quarterly).
- **FR-012**: Reading DNA generation MUST NOT be triggered automatically on every page load. Generation MUST occur only when the threshold defined in FR-011 is crossed. There is NO manual "Regenerate" button or any other user-facing trigger in this release.
- **FR-013**: When a user has not met the minimum book-count threshold to generate their first DNA, the system MUST display an explanatory state showing their progress toward the threshold.
- **FR-014**: When DNA generation fails, the system MUST preserve any previous DNA, leave the page usable, and avoid surfacing technical errors to the user.

#### Auto-Vocabulary Extraction (US3)

- **FR-015**: When a page capture is saved, the system MUST asynchronously analyze the captured text to identify uncommon or advanced vocabulary words.
- **FR-016**: Vocabulary extraction MUST add at most **5 new words** to the user's Lexicon per capture (hard cap), regardless of how much text was captured or how many candidate words were found.
- **FR-017**: Each extracted word MUST be stored with a definition that reflects its meaning **as used in the captured passage** rather than a generic dictionary lookup.
- **FR-018**: Extracted words MUST be deduplicated against the user's existing Lexicon — words already present (case-insensitively, lemma-aware where reasonable) MUST NOT be re-added.
- **FR-019**: Extracted words MUST flow into the user's existing Leitner review system as new Box-1 entries.
- **FR-020**: Vocabulary extraction MUST be **silent and non-blocking** — the page capture flow MUST NOT be slowed, blocked, or visibly affected by extraction success or failure.
- **FR-021**: When vocabulary extraction fails, the original capture MUST remain intact and no error MUST be surfaced to the user.
- **FR-022**: Vocabulary extraction MUST exclude proper nouns (character names, place names, brand names) from results.
- **FR-022a**: Each auto-extracted vocabulary word MUST persist its source attribution: the originating `book_id` and `page` of the capture it was extracted from. This source MUST be surfaced to the user in the Vocabulary Garden's "Recently Learned" list AND in the full Lexicon detail view, in the same convention used by existing cards in the app (e.g., "from *Title*, p. 143").

#### Vocabulary Garden Section (US3 + US1)

- **FR-023**: The Profile page MUST include a Vocabulary Garden section displaying: total vocabulary count, distribution across Leitner review boxes, and a "Recently Learned" list of the most recently added words with their in-context definitions and their source (book title + page number).
- **FR-024**: Tapping the Vocabulary Garden section MUST navigate the user to their full Lexicon / Leitner review experience.

#### Cross-Cutting

- **FR-025**: The Reading DNA card MUST display book suggestions that include title, author, and a one-sentence reason that connects to specific themes or patterns in the user's reading history.
- **FR-026**: All UI elements introduced for this feature MUST follow the project's PrimeVue-first principle (use the standard PrimeVue component for the use case unless none fits, in which case a custom component is permitted).
- **FR-027**: Book suggestions MUST be titles drawn from the AI's general literary knowledge (not the user's existing library and not from any external book catalog). The AI is responsible for proposing real, publicly known titles that fit the user's reading patterns; the system does not perform availability or in-print verification at this stage.
- **FR-028**: Reading DNA regeneration MUST trigger when **either** of the following is true since the last generation: (a) the user has finished **3 additional books**, or (b) **90 days** have elapsed. These thresholds are fixed defaults and are NOT user-configurable in this release.
- **FR-029**: The AI MUST select up to 5 words per capture using **holistic judgment** under the prompt directive "select up to 5 words an educated adult literary reader would likely encounter rarely or want to remember." The system does NOT enforce a frequency rank or CEFR-level rule — the model's literary judgment is the qualifying mechanism, bounded by the hard cap of 5 words and the proper-noun exclusion in FR-022.

### Key Entities *(include if feature involves data)*

- **Reading DNA**: Per-user persisted artifact representing the user's literary personality at a point in time. Attributes: literary personality summary (short narrative text), mood signature (compact representation of emotional patterns), book suggestions (ordered list, each with title, author, reason), generation timestamp, books-finished count at time of generation. Belongs to one user. Replaced on regeneration.
- **Vocabulary Word**: An entry in the user's Lexicon contributed by auto-extraction. Attributes: word, in-context definition, source book reference, source page number, Leitner box, last reviewed timestamp, creation timestamp, source flag (auto vs. manual). The source book + page are user-facing (displayed in the Vocabulary Garden and Lexicon detail). Many-to-one with user; many-to-one with capture.
- **Profile Page View Model** *(derived, not persisted)*: An aggregation that the page renders from existing data sources — does not introduce new storage. Pulls from books, sessions, recaps, captures, lore cards, the new Reading DNA, and the new Vocabulary Words.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the Profile page and see all sections that are populatable from their data render fully within 2 seconds of page navigation under typical conditions.
- **SC-002**: A user who has finished at least the configured DNA threshold sees their Reading DNA on first Profile visit without an in-app error, in 100% of cases where the AI service is available.
- **SC-003**: After a page capture, the user sees up to 5 new words appear in their Lexicon within 30 seconds of the capture being saved, in at least 90% of captures that contain extractable advanced vocabulary.
- **SC-004**: Page capture latency (from "Save" tap to "Saved" confirmation) MUST NOT increase by more than 50 milliseconds compared to the pre-feature baseline, regardless of vocabulary extraction outcome.
- **SC-005**: Reading DNA regeneration MUST occur at most once per crossed threshold — repeated Profile page visits within a single threshold window MUST trigger zero additional AI calls.
- **SC-006**: 0% of vocabulary entries added by auto-extraction may be exact-duplicate matches of words already in the user's Lexicon at the time of insertion.
- **SC-007**: The Profile page MUST be operable for users with zero finished books, zero captures, and zero recaps — no section may render an error or crash, and every empty section MUST present a clear empty state.
- **SC-008**: Across the first month after launch, at least 70% of users who finish their first eligible book see a generated Reading DNA without manual intervention.

## Assumptions

- The application's existing constitution will be amended in a separate, parallel action to introduce a new principle requiring PrimeVue-first UI development. This feature's implementation will adhere to that principle once amended; the constitutional change itself is out of scope for this feature spec.
- The existing OCR-based page capture system, Lexicon, and Leitner review system are stable and exposed by APIs/stores that this feature can extend without architectural rework.
- The existing recaps and lore cards stores expose the data needed to compute Top Themes without introducing new tables.
- "Reading streak" is defined as the count of consecutive calendar days (in the user's local timezone) on which at least one reading session was logged.
- The Reading DNA's "mood signature" is a compact visual element (e.g., a sequence of small color or emoji indicators representing the emotional tone of the user's recent books). The exact visual representation is a design decision deferred to planning.
- Book suggestion AI output respects safety and licensing — only public, uncontroversial titles are surfaced; the system does not need to verify availability for purchase.
- Book suggestions are sourced exclusively from the AI's general literary knowledge (FR-027); no external book catalog integration is required for this release.
- Reading DNA regeneration thresholds are fixed at "3 books OR 90 days, whichever first" (FR-028) and are not exposed in user settings.
- Vocabulary qualifying rule is AI-holistic-judgment (FR-029); the prompt is the contract, not a hard frequency or CEFR list.
- The vocabulary extraction system trusts the captured OCR text as input; OCR-quality issues that produce nonsense words are tolerated by the AI's filter (it will skip non-words).
- User data privacy: all per-user content (recaps, captures, vocabulary, DNA) remains scoped to the owning user under existing row-level security policies.
- The Profile page is read-mostly. Edits to identity (display name, avatar) are out of scope for this feature unless trivially derivable from the existing auth profile.
