# Features

Last updated: 2026-05-17

This page documents the main user-facing features and the implementation areas behind them.

## Library Management

Readers can add books manually or through ISBN lookup, view their library, edit metadata, and delete books.

Technical implementation:

- Store: `src/stores/books.ts`
- Pages/components: `src/pages/LibraryPage.vue`, `src/pages/AddBookPage.vue`, `src/components/books/*`, `src/components/library/*`
- Data: `books`, `reading_progress`, `get_library_with_progress`
- ISBN tooling: `src/composables/useIsbn.ts`, `src/composables/useScanner.ts`

## Dashboard and Active Book

The dashboard highlights the active book, current reading state, up-next books, completed-only states, recent session information, and Word of the Day.

Technical implementation:

- Page: `src/pages/DashboardPage.vue`
- Components: `src/components/dashboard/*`
- Active book logic: `src/composables/useActiveBook.ts`
- First-run state: `src/composables/useDashboardOnboardingState.ts`

## Reading Sessions and Progress

Readers can start a session, save a current page, optionally attach a session note, and complete a book. Progress writes update `reading_progress` and append history to `progress_history`.

Technical implementation:

- Store: `src/stores/progress.ts`
- Timer: `src/composables/useReadingSession.ts`
- UI: `src/components/session/*`, `src/components/book/BookProgressPanel.vue`
- Offline queue: `src/composables/useOfflineSync.ts`, `src/sw.ts`

Business rules:

- A book is complete when progress reaches 100%.
- Page progress is clamped by book total pages.
- Starting a session should work even if the selected book has no previous progress row.
- Completing a book clears it from active reading candidates and makes the Book Passport journey available.

## Completion and Book Passport

When a reader completes a book, the app prompts them to view their Book Passport. The passport collects the book journey, reading stats, vocabulary count, peak day, and AI-generated summary.

Technical implementation:

- Page: `src/pages/BookPassportPage.vue`
- Store: `src/stores/bookPassport.ts`
- Prompt helper: `src/utils/completionPrompt.ts`
- Stats RPC: `get_book_passport_stats`
- Summary generation: `generate-recap` with `mode: passport_summary`

## Recaps

BookHero can generate:

- Pre-start blurbs when current page is `0`
- Mid-book recaps
- Corpus-grounded recaps from captured pages
- Completed-book passport summaries
- Recap images for completed recap memories

Technical implementation:

- Store: `src/stores/recaps.ts`
- Client: `src/services/recapService.ts`
- Edge function: `supabase/functions/generate-recap/*`
- UI: `src/components/recap/*`, `src/pages/RecapHistoryPage.vue`

Business rules:

- Mid-book recaps are gated by page progress and cooldown logic in `src/composables/useRecapLock.ts`.
- Corpus recaps use saved page captures when available.
- Captures are filtered client-side to the relevant page range before recap generation.

## Page Capture and OCR

Readers can capture a page with the camera, review OCR text, and save the text for recap grounding and vocabulary extraction.

Technical implementation:

- Store: `src/stores/captures.ts`
- Camera/OCR: `src/composables/useCapture.ts`
- Components: `src/components/capture/*`, `src/components/session/SessionCaptureField.vue`
- Edge function: `supabase/functions/ocr-page/index.ts`
- Data: `page_captures`

Business rules:

- Images are not persisted.
- Saved capture text is user-reviewed before storage.
- Completion cleanup deletes page captures when a book is completed.

## Lexicon and Review

Readers can collect terms, definitions, context sentences, and page references. The app also supports review flows inspired by spaced repetition.

Technical implementation:

- Store: `src/stores/lexicon.ts`
- Search: `src/composables/useGreatLibrarySearch.ts`
- Review: `src/composables/useAnkiSession.ts`, `src/stores/ankiSession.ts`
- Pages/components: `src/pages/GreatLibraryPage.vue`, `src/pages/AnkiReviewPage.vue`, `src/components/lexicon/*`, `src/components/anki/*`
- Data: `lexicon_entries`, `vocabulary_extractions`, `anki_review_sessions`

## Vocabulary Extraction

After saving a page capture, the app can trigger vocabulary extraction and add new terms to the lexicon.

Technical implementation:

- Composable: `src/composables/useVocabularyExtraction.ts`
- Edge function: `supabase/functions/extract-vocabulary/index.ts`
- Ledger: `vocabulary_extractions`

## Lore Chronoscope

Lore cards unlock at reading milestones and are generated from the master recap, keeping them spoiler-safe.

Technical implementation:

- Store: `src/stores/loreCards.ts`
- Client: `src/services/loreService.ts`
- Edge function: `supabase/functions/generate-lore/index.ts`
- UI: `src/components/lore/*`
- Data: `lore_cards`

Business rules:

- Milestones are percentage-based.
- Valid generation milestones are handled by the edge function.
- Existing topics are sent to reduce duplicate lore cards.

## Reader Profile and Reading Quest

The profile page summarizes lifetime reading stats, library breakdown, Reading DNA, yearly goal progress, XP, and reader level.

Technical implementation:

- Page: `src/pages/ProfilePage.vue`
- Stores: `src/stores/readingDna.ts`, `src/stores/readingQuest.ts`
- Composables: `src/composables/useReadingProfile.ts`, `src/composables/useLibraryBreakdown.ts`, `src/composables/useReadingVelocity.ts`
- Edge function: `supabase/functions/generate-reading-dna/index.ts`
- RPCs: `get_reading_stats`, `get_library_breakdown`, `get_reading_velocity`, `get_reading_quest_summary`

## Offline-Friendly Progress

If progress saving fails due to connectivity, the mutation is queued in IndexedDB and retried later.

Technical implementation:

- IndexedDB database: `chronicler-offline`
- Object store: `progress_queue`
- Queue helper: `src/composables/useOfflineSync.ts`
- Service worker: `src/sw.ts`

