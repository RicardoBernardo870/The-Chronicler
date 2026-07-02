# Features

Last updated: 2026-07-02

This page documents the main user-facing features and the implementation areas behind them. Backend surface: [`docs/backend-contract.md`](../backend-contract.md).

## Library Management

Readers can add books four ways — **search**, ISBN scan, manual entry, or **CSV import** (Goodreads/StoryGraph) — plus view, edit, and delete.

Technical implementation:

- Store: `src/stores/books.ts`
- Pages/components: `src/pages/LibraryPage.vue`, `src/pages/AddBookPage.vue`, `src/pages/BookSearchDetailPage.vue`, `src/components/books/*`, `src/components/library/*`
- Data: `books` (incl. `description`, `source`, `page_count_estimated`), `reading_progress`, `get_library_with_progress`
- ISBN tooling: `src/composables/useIsbn.ts`, `src/composables/useScanner.ts`

### Search & Add (030)

The Add Book screen leads with "Scan ISBN" and "Add Manually" buttons plus a search bar. Search uses **Google Books as the primary source** with **Open Library gap-filling** missing cover/pages/genre; selecting a result opens a refresh-safe, pre-filled, editable details page (with cleaned description, duplicate notice, and best-effort "similar books" recommendations). Scan and Manual flows are unchanged.

- Service: `src/services/bookSearchService.ts`; composable: `src/composables/useBookSearch.ts`
- Components: `src/components/books/BookSearchSection.vue`, `SearchBookHero.vue`, `BookDescription.vue`, `BookRecommendationsScroller.vue`

**ISBN-aware search:** when the search query is a bare ISBN-10/13, `searchBooks` switches to the Google Books `isbn:` operator and **drops the `langRestrict` filter** (an ISBN identifies one specific-language edition, so the language filter would otherwise hide it and return nothing). Free-text title/author searches keep `langRestrict=<browser language>` to suppress IP-geolocated local-market editions.

### Library Import (034)

Readers can populate BookHero in one step by uploading a **Goodreads or StoryGraph CSV export**. The app auto-detects the format by its header signature, maps read-status (`read` → completed at 100%; `to-read` / `currently-reading` / `did-not-finish` / unknown → "Want to read"), de-duplicates against the existing library (ISBN-first, else case-insensitive title+author) and within the file, and **bulk-creates the books quietly** — no recaps, lore, vocabulary, quest XP, or completion passports. Missing cover/genre/page metadata is filled in afterward in the background by reusing the book-search service (ISBN-prioritized). Books with no discoverable page count import with a flagged placeholder (`page_count_estimated`) the reader can correct. Entry points: the Add Book screen and the empty-library/onboarding state.

- Parsers/utils: `src/utils/import/csvFormat.ts`, `goodreadsParser.ts`, `storygraphParser.ts`, `shared.ts`
- Orchestration: `src/composables/useLibraryImport.ts` (offline-guarded parse → dedupe → bulk insert → throttled enrichment)
- Store action: `booksStore.importBooks` (chunked insert + batched quiet `reading_progress` upsert for completed rows)
- Components: `src/components/import/LibraryImportDialog.vue`, `ImportSummaryPanel.vue` (PrimeVue `Dialog`/`FileUpload`/`ProgressBar`); lazy-loaded with `papaparse`
- Data: `books.source` (`manual`/`goodreads`/`storygraph`), `books.page_count_estimated`

Business rules:

- **Imported = `source <> 'manual'`.** Imported "read" books count toward **lifetime** library composition (total finished, genre breakdown, Reading DNA) but are **excluded** from current-period metrics — the yearly reading goal, streaks, and pages/sessions-this-month (`get_reading_quest_summary` and `get_reading_stats.totalPagesRead` filter them out; all other stat fields derive from `progress_history`, which imports never write).
- Import is idempotent — re-running the same file creates zero duplicates.
- Enrichment is best-effort and never blocks or fails the import.

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
- UI: `src/components/recap/*`, `src/pages/RecapHistoryPage.vue`; recap images also surface in the profile's Recap memories carousel (`src/components/profile/RecapImagesCarousel.vue` via `useRecapGallery`)

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
- Review: `src/composables/useAnkiSession.ts`, `src/stores/ankiSession.ts`, `src/composables/useLeitner.ts`
- Pages/components: `src/pages/GreatLibraryPage.vue`, `src/pages/AnkiReviewPage.vue`, `src/components/lexicon/*`, `src/components/anki/*`
- Data: `lexicon_entries` (incl. `mastered`, `last_reviewed_at`), `vocabulary_extractions`, `anki_review_sessions`

Business rules:

- **Leitner system** (5 boxes, intervals 1/2/4/8/16 days). The Word of the Day card advances words through the boxes; the Anki session is where graduation happens.
- **Graduation (031):** answering "Knew it" in the Anki session marks a word **Mastered** (terminal) regardless of box — it leaves all review queues but stays in the Great Library with a "Mastered" badge. The WotD arrow never masters; "Didn't know" resets to box 1.
- **Daily review limit (032):** a shared, non-destructive **20-words/day** cap (per-day tally via `last_reviewed_at`), most-fragile-first (lowest box, then most overdue), with a "Review more" escape hatch that grants another batch of 20. Both surfaces draw from the same capped set.

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

The profile is **identity-first** and fits roughly one screen: an identity header (avatar wrapped in the yearly-goal progress ring, reader-level badge, name — tap opens profile customization), a compact Reading DNA signature strip (tap opens the full analysis in a bottom sheet), a one-row strip of DNA book-recommendation covers (tap → add-book flow), stat pills (books / pages / hours / streak), a Trophy Room entry, and a **Recap memories** carousel of the reader's generated recap images (one near-full-width image per snap; empty state invites the reader to generate recaps).

The analytical detail lives one tap deep in the **Trophy Room** (`/profile/stats`): yearly quest as a large progress ring with pace metrics (needed / current / forecast), reader level/XP strip, the **reading calendar**, lifetime stats grid, and library breakdown.

Technical implementation:

- Pages: `src/pages/ProfilePage.vue`, `src/pages/ProfileStatsPage.vue` (Trophy Room), `src/pages/ProfileEditPage.vue` (customization)
- Components: `src/components/profile/*` — `ProfileIdentityHeader`, `DnaSignatureStrip`, `DnaRecommendationsScroller`, `ProfileStatsNav`, `RecapImagesCarousel`, `QuestGoalHero`, `ReaderLevelStrip`, `ReadingCalendarCard`, `LifetimeStatsGrid`, `LibraryBreakdownCard`
- Stores: `src/stores/readingDna.ts`, `src/stores/readingQuest.ts`
- Composables: `useReadingProfile`, `useLibraryBreakdown`, `useReadingVelocity`, `useCommunityIdentity`, `useDnaRecommendations`, `useRecapGallery`, `useReadingCalendar`
- Edge function: `supabase/functions/generate-reading-dna/index.ts`
- RPCs: `get_reading_stats`, `get_library_breakdown`, `get_reading_velocity`, `get_reading_quest_summary`, `get_reading_calendar`, `get_my_community_profile`

Business rules:

- **Imported books (034)** are excluded from current-period surfaces (yearly goal, streaks, monthly activity, XP) via the `source <> 'manual'` filter in `get_reading_quest_summary` / `get_reading_stats`, but are **included** in lifetime composition (`get_library_breakdown`, Reading DNA) — so a large CSV import grows your library without inflating "this year".
- **Reading calendar** — `get_reading_calendar(p_user_id, p_month_start, p_timezone)` buckets `progress_history` rows by day **in the reader's IANA timezone**; each active day shows the cover of the book read (a "+n" badge for multiple), and tapping a day lists the books with the furthest page reached. Months are cached per session; forward navigation stops at the current month.
- **DNA recommendation covers** resolve sequentially via Google Books (gives the add-book-details volume key), with Open Library search as the cover fallback; a suggestion that resolves without a Google key still taps through to the normal add-book search flow with the query pre-seeded. Partially failed sets re-resolve on the next profile visit.
- **Recap memories** exchanges private `recap-images` paths for batch signed URLs (1 h TTL); only recaps with `image_status = 'succeeded'` appear; tapping an image opens that book's recap history.

### Profile customization (`/profile/edit`)

A community profile row is **not** created at sign-up — it exists only after the reader saves this page for the first time, so the empty state is a first-run setup ("Create your reader profile"), never an error. The reader picks a username (`^[a-z0-9_-]{3,30}$`, live availability check via `is_username_available`, pattern-safe suggestion pre-filled from the auth email), optional display name and bio (≤160, live counter), a public-profile toggle, and per-surface privacy (everyone / followers / nobody — defaults to nobody). Avatar upload accepts a phone photo, downscales client-side to ≤512 px JPEG, and uploads to `community-avatars/{userId}/avatar-{ts}.jpg` on save (timestamped to defeat CDN caching; older files cleaned up best-effort). Saving calls `upsert_my_community_profile`; its typed errors (`username_taken`, `bio_too_long`, …) map to inline copy.

## Community

Public reader profiles with a follow graph and blocking. Per-surface privacy controls (progress / currently-reading / lexicon / reader-DNA visible to everyone / followers / nobody). "Also reading" surfaces followers reading the same book.

Technical implementation:

- Data: `community_profiles`, `community_profile_privacy`, `follows`, `blocks`, `community_follow_counts`; public `community-avatars` storage bucket.
- RPCs: profile (`get_my_community_profile`, `upsert_my_community_profile`, `get_public_profile_by_username`, `is_username_available`), graph (`follow/unfollow/block/unblock_community_user`, `list_community_followers/following`, `list_my_blocked_users`), discovery (`search_community_readers`, `get_also_reading_for_book`), relationship (`get_community_relationship_state`, `can_community_users_interact`).
- See [`docs/community-design-notes.md`](../community-design-notes.md) and [`backend-contract.md`](../backend-contract.md) §3/§6.

## Reading Circles

Private, invite-only groups around a single book/work with **spoiler-safe, page-gated reactions** — you only see reactions at or before your own current page.

Technical implementation:

- Data: `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions`; enums `circle_status`, `circle_member_role`, `circle_invitation_status`.
- RPCs: `create_reading_circle`, `invite_reading_circle_members`, `respond_to_reading_circle_invitation`, `leave_reading_circle`, `remove_reading_circle_member`, `get_reading_circle_detail`, `list_my_reading_circles`, `add_circle_reaction`, `get_visible_circle_reactions` (enforces the page-gated spoiler safety).

> Community and Reading Circles are fully built on the backend. On the PWA, the **profile customization page** (`/profile/edit`, see Reader Profile above) is the first client surface consuming the community profile RPCs (`get_my_community_profile`, `upsert_my_community_profile`, `is_username_available`) and the `community-avatars` bucket; the social surfaces (follow graph, discovery, circles) have no PWA UI yet. The social layer is **deferred for the iOS v1** port (see [`docs/ios-implementation-plan.md`](../ios-implementation-plan.md)).

## Offline-Friendly Progress

If progress saving fails due to connectivity, the mutation is queued in IndexedDB and retried later.

Technical implementation:

- IndexedDB database: `chronicler-offline`
- Object store: `progress_queue`
- Queue helper: `src/composables/useOfflineSync.ts`
- Service worker: `src/sw.ts`

