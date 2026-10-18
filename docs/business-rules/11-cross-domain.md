# 11 · Cross-Domain Interactions — Business Rules
> **Prefix:** XD · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-18

## Overview

This file covers what happens **across** domains when one action changes a book's or a reader's state: deleting a book, completing one (six different paths), shelving and resuming (DNF), importing a CSV library, signing out or switching accounts, editing `total_pages` or `current_page` outside a session, and deleting the account. No single domain file states these consequences in full. The domain files own the detail of each effect; this file owns the **matrices**: which effects fire on which path, what survives, what goes stale, and what each client has to purge.

**Today:** the server reacts only through FK cascades on delete, the completion purge triggers on `reading_progress`, the capture XP/purge trigger on `page_captures`, and the `updated_at` stamp (XD-01). Every other lifecycle effect runs inside the web client that made the write, and only on some paths: the history row, passport, Insight, capture prompt, cache invalidation, achievements and DNA. **Target (D-06):** BC-04 (atomic `save_progress` and the DNF/session RPCs) and BC-05 (one server owner for completion and lifecycle effects, a job queue and lifecycle triggers) make these effects identical for web, iOS, offline replays and imports. BC-11 adds account deletion and BC-13 adds Storage hygiene.

| Web route / surface | Purpose | Rules |
|---|---|---|
| `/library` list and search cards → swipe → **Delete** (touch only) | Delete a book | XD-03…XD-12 |
| `/` hero page sheet, `/books/:id` page sheet, Focus mode "End Session" | Complete a book with an online or offline save (paths 1–3) | XD-13…XD-24 |
| `/books/add` (manual, scan, search details) → status "Already finished" | Complete a book on add (path 4) | XD-14 |
| Import dialog (hosted by `/books/add` and the Dashboard empty state) | CSV import; "read" rows complete books (path 5) | XD-33…XD-40 |
| `/library` swipe → **Edit** (`BookEditDialog`); import enrichment | `total_pages` and metadata edits (path 6) | XD-47…XD-50, XD-53 |
| `/` hero pencil; `/books/:id` progress-panel pencil | `current_page` correction outside a session | XD-51, XD-52 |
| `/books/:id` "Didn't finish it? Shelve this book" | Mark DNF | XD-25…XD-30, XD-32 |
| `/books/:id` "Start reading again"; `/library/dnf` "Resume" | Resume a DNF book | XD-31, XD-32 |
| Bottom nav **More** sheet → "Sign out"; any account switch | Sign out / user switch | XD-41…XD-46 |
| None today. Target: Settings → "Delete account" on web and iOS | Delete account | XD-54…XD-57 |

**Owning objects** (names only; shapes are in [backend contract §4 Cascades & lifecycle effects](../backend-contract.md#4-cascades--lifecycle-effects), §3 Tables, §7 Storage, §9 Triggers, §10 Edge functions):

| Kind | Objects |
|---|---|
| Tables written by these actions | `books`, `reading_progress`, `progress_history`, plus every per-book child: `recaps`, `lore_cards`, `book_passports`, `page_captures`, `book_quizzes`, `lexicon_entries`, `vocabulary_extractions`, `up_next_order`, `reading_quest_events`, `circle_reactions`, `reading_circles` (dormant) |
| Triggers | `page_captures_delete_on_completion`, `book_quizzes_delete_on_completion` (AFTER INSERT OR UPDATE OF `current_page` ON `reading_progress`); `page_capture_quest_event_after_save` (AFTER INSERT OR UPDATE ON `page_captures`); `reading_progress_updated_at` (BEFORE UPDATE). **None on `books`.** |
| RPCs whose results change | `get_library_with_progress`, `get_reading_quest_summary`, `get_reading_stats`, `get_monthly_reading`, `get_reading_calendar`, `get_reading_records`, `get_library_breakdown`, `get_last_session`, `get_reading_velocity`, `get_book_passport_stats`, `get_public_profile_by_username`, `get_also_reading_for_book` |
| Edge functions involved | `generate-recap` (incl. `passport_summary`, `recap_image`), `generate-lore`, `extract-vocabulary`, `generate-page-resume`, `generate-reading-dna` |
| Storage | `recap-images/{uid}/{recapId}.png`, `community-avatars/{uid}/…` |
| Planned (Phase 0) | BC-04 `save_progress`, `start_session`/`pause_session`/`resume_session`/`cancel_session`, `mark_dnf`, `resume_dnf`, `set_initial_status`, `reading_progress.completed_at`, `progress_history.kind`; BC-05 `background_jobs` + `process-jobs`, lifecycle triggers `a10_reading_progress_before`, `a10_reading_progress_lifecycle`, `a10_books_lifecycle`, `request_dna_refresh`; BC-11 `delete-account`; BC-13 `private.storage_cleanup_queue`; BC-14 `deleted_records`, `get_library_changes`; BC-15 `import_library` (recommended) |

**Related domains:** [01 · Library](01-library.md) (delete, import, edit, DNF write paths), [02 · Reading Sessions](02-reading-sessions.md) (save order, completion, passport, offline), [03 · Recaps](03-recaps.md) (lock clocks, images), [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md) (purges), [05 · Codex & Lexicon](05-codex-lexicon.md), [06 · Insights](06-insights.md), [07 · Profile, Stats & Goals](07-profile-stats-goals.md) (XP, quest, DNA, achievements), [08 · Platform, Auth & Account](08-platform-auth-account.md) (sign-out, offline queue, account), [09 · Database invariants](09-database-invariants.md) (cascades BE-72/BE-73), [10 · Community & Circles](10-community-circles.md), [12 · Client-logic register](12-client-logic-register.md). Work packages: [backend consolidation plan](../backend-consolidation-plan.md).

**Live snapshot (2026-10-18, aggregates only):**

| Measure | Value |
|---|---|
| FKs referencing `books` | 13: 12 `ON DELETE CASCADE`, 1 `SET NULL` (`reading_quest_events_book_id_fkey`). `reading_circles` → 3 child FKs CASCADE |
| Triggers on `books` | 0 |
| Complete progress rows (`current_page ≥ total_pages`) | 63: 49 imported (`goodreads`, none with history or passport); 14 manual, of which 6 have **no** history row (path 4 or path 6 completions) and 5 have no passport |
| `recap-images` objects with no matching `recaps.image_path` | 3 (orphans from deletes) |
| `reading_quest_events` detached by a book delete (`book_id IS NULL`) | 1 |
| Progress rows pointing at another user's book | 0 |
| Zombie sessions (session open on a complete book) | 0 |
| DNF rows at ≥ 100 % | 0 |
| Captures on complete books | 0 |
| `supabase_realtime` publication tables | 0 |

---

## Rules

### Shared foundations

#### XD-01 · Lifecycle effects are split between the database and the acting client
The server reacts to only four things today:
- FK cascades on delete;
- the completion purge triggers (captures and quiz, on any `reading_progress` write that lists `current_page` and reaches `total_pages`);
- the capture trigger (+5 XP event, then a purge if the book is already complete);
- the `updated_at` stamp on every `reading_progress` UPDATE.

Every other effect runs in the web client that made the write, and only on the paths that client's code covers: the history row, session end, capture prompt, passport, Insight, completion prompt, hero rotation, cache invalidation, achievements and DNA.
- **Enforced:** `server:db` (FKs, triggers listed in the Overview); everything else `client`.
- **Source:** live `pg_trigger` / `pg_constraint` (2026-10-18); `src/stores/progress.ts:495-665`; `src/stores/books.ts:413-435`.
- **Target:** one server owner for every lifecycle effect, whatever the client or path:
  - lifecycle triggers L-1 on `reading_progress` (completion, forward page change, DNF) and on `books` (`total_pages` change);
  - job queue J-1 (`background_jobs` + `process-jobs`) for the AI work;
  - F-1 flags switch each effect on only once the PWA stops doing it.

  Clients render state and presentation only (D-05 · D-06 · BC-04 · BC-05).

#### XD-02 · Percentage and status are derived from `(current_page, total_pages)` at use time
Server status precedence: `dnf` if `dnf_at` is set, else `unread` if `current_page = 0` or there is no row, else `finished` if `total_pages > 0 AND current_page ≥ total_pages`, else `reading`. Percentage = `least(100, round(current_page / total_pages × 100, 2))`. The web client also keeps a per-book percentage in its progress map. That copy is not capped and is **not refreshed** when `total_pages` changes (XD-50).
- **Enforced:** `server:rpc` (`get_library_with_progress`); `client` (progress map).
- **Source:** live `get_library_with_progress`; `src/types/index.ts:435-444`; `src/stores/progress.ts:105-128`.
- **Note:** every client must recompute the percentage from the current pair whenever it renders or compares one. A separately cached percentage is the root cause of XD-D24.

### Delete a book

#### XD-03 · Entry point and confirmation
Delete exists only as a touch swipe action on Library list and search cards (`pointer: coarse`). Book Detail has no delete, and a mouse or trackpad cannot reach it at all. The confirm dialog reads:
- header "Remove Book";
- message `Remove "{title}" and all its data? This cannot be undone.`;
- buttons "Cancel" and "Remove" (danger).

A failure shows the toast "Remove failed — Could not remove the book. Try again." (3 s). There is no undo and no soft delete.
- **Enforced:** `client`.
- **Source:** `src/pages/LibraryPage.vue:124-145`; `src/components/library/SwipeableBookCard.vue:7-84`; [LIB-87](01-library.md#lib-87--delete-confirmation), [LIB-102](01-library.md#lib-102--swipe-actions-touch-only).
- **Note:**
  - "All its data" overstates it: recap images, capture XP and badges survive (XD-05, XD-06).
  - Safeguards (active session, unsynced saves, AI job in flight, anchored circle) are [LIB-Q12](01-library.md).
  - Where Edit/Delete live on every client is LIB-Q06.

#### XD-04 · One delete, server-side cascade
The client sends one `DELETE FROM books WHERE id = :id` (RLS owner policy), and the FKs remove every per-book row:
- **CASCADE:** `reading_progress`, `progress_history`, `recaps`, `lexicon_entries` (mastered words included), `lore_cards`, `book_passports`, `page_captures` (with their resumes), `book_quizzes`, `up_next_order`, `vocabulary_extractions`, the reader's `circle_reactions` on that book, and any `reading_circles` anchored on the book, together with **all members'** `circle_invitations`, `circle_members` and `circle_reactions`.
- **SET NULL:** `reading_quest_events.book_id`.

No trigger exists on `books`. A delete that matches 0 rows (already deleted elsewhere) returns no error, so the UI reports success. supabase-js does not retry a DELETE after a network error.
- **Enforced:** `server:db` (FKs `*_book_id_fkey`, `circle_*_circle_id_fkey`); `client`.
- **Source:** `src/stores/books.ts:413-418`; live `pg_constraint` (verified 2026-10-18); [LIB-88](01-library.md#lib-88--delete-cascade), [BE-72](09-database-invariants.md#be-72--deleting-a-book), [PLT-75](08-platform-auth-account.md#plt-75--book-deletion-is-a-hard-cascade-summary).
- **Target:** the cascade itself is unchanged. Additions:
  - queued and running jobs for the book cascade through `background_jobs.book_id` (D-06 · BC-05);
  - an `AFTER DELETE` trigger on `recaps` (it also fires for cascades) enqueues Storage cleanup (BC-13, recommended);
  - an `AFTER DELETE` trigger on `books` writes a tombstone for delta sync (BC-14, recommended).

#### XD-05 · What survives a book delete
These are kept:
- `reading_quest_events` rows, detached (`book_id → NULL`), so the +5 XP per captured page survives;
- `achievements` (insert-only ledger; badges never regress);
- `reading_dna` (its `books_finished_at_generation` is not lowered, so "finished since generation" can go negative and DNA then waits for the 90-day rule);
- `reading_goals`, `anki_review_sessions` aggregates, `user_settings`;
- the book's recap images in Storage (XD-06).
- **Enforced:** `server:db` (`reading_quest_events_book_id_fkey ON DELETE SET NULL`; the other tables have no FK to `books`).
- **Source:** live `pg_constraint`; [BE-22](09-database-invariants.md#be-22--ledgers-survive-deletion-of-their-source); [PRO-93](07-profile-stats-goals.md#pro-93--book-delete); [PRO-05](07-profile-stats-goals.md#pro-05--pagecaptures-counts-unique-captured-pages-and-survives-deletions).
- **Note:** whether a delete should keep or remove XP is [LIB-Q15](01-library.md) / PRO-Q18. Keeping the book's lexicon words is LEX-Q20.

#### XD-06 · Recap images are orphaned in Storage
`recap-images/{uid}/{recapId}.png` objects stay after their `recaps` rows cascade away. No client or server code deletes them, and `storage.protect_delete` blocks SQL deletes. Live: 3 orphans. ⚠ XD-D01
- **Enforced:** none (`server:db` cannot delete Storage objects).
- **Source:** [BE-71](09-database-invariants.md#be-71--the-database-never-deletes-storage-objects); [REC-63](03-recaps.md#rec-63--book-delete); live `storage.objects` (2026-10-18).
- **Target:** an `AFTER DELETE` trigger on `recaps` queues `{bucket, path}` in `private.storage_cleanup_queue` (no user FK, so entries survive the cascade). `process-jobs` deletes the objects through the Storage API within 5 minutes, and a daily orphan sweep is the safety net (BC-13 · recommended).

#### XD-07 · Aggregates recompute on the next read, so XP and level can drop
Every aggregate is computed on read, so a delete changes these retroactively:
- **XP and level.** The book's pages, its +25 completion, +10 per history row, +20 per recap and +15 per lore card all vanish. The +5 per captured page remains.
- **Reading activity.** The yearly quest `completedBooks`, streaks, calendar days, monthly bars, records (`bestDay`, `fastestFinish`, `longestSession`, `nightOwl`), sessions, hours and velocity.
- **Library and community.** The library breakdown, and the public profile stats and `currentlyReading` ([COM-29](10-community-circles.md#com-29--currentlyreading-gated-by-currentlyreading-not-by-progress)).

Badges already earned stay.
- **Enforced:** `server:rpc` (`get_reading_quest_summary`, `get_reading_stats`, `get_monthly_reading`, `get_reading_calendar`, `get_reading_records`, `get_library_breakdown`, `get_public_profile_by_username`).
- **Source:** live function bodies; [PRO-01](07-profile-stats-goals.md#pro-01--xp-formula), [PRO-93](07-profile-stats-goals.md#pro-93--book-delete).

#### XD-08 · Client cache invalidation after delete (web)
On success the client:
- filters `books` and `libraryEntries`;
- removes the progress-map entry;
- touches `books`;
- invalidates `progress`, `library`, `libraryBreakdown`, `readingQuest:*`, `lexicon:{uid}*`, `recaps:{uid}:{id}` and `bookPassport:{uid}:{id}`.

It does **not** invalidate `readingStats` (120 s), `lastSession` (30 s; the Last Session card can still show the deleted book), `readingRecords` (120 s), `velocity` (365-day TTL), `lore:*`, `recaps:all:{uid}` or `upNext`. The calendar and monthly module caches are never refreshed. ⚠ XD-D02
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:420-434`; [LIB-89](01-library.md#lib-89--client-state-after-delete), [SES-98](02-reading-sessions.md#ses-98--book-delete--session-domain-effects).

#### XD-09 · Per-book client artefacts kept after delete
These stay in memory or storage until a reload or refetch:
- **Stores.** `lexicon.entriesByBook` (Word of the Day can resolve to "(removed book)", [LEX-93](05-codex-lexicon.md#lex-93--book-delete)), `recaps.recapsByBook`, `bookPassport.passportByBook`, `captures.capturesByBook` (no SWR key), and `loreCards.loreByBook`. The all-books lore fetch assigns per-book keys and never removes missing ones, so the deleted book's cards stay in Codex "All Books" ([INS-33](06-insights.md#ins-33--book-delete-cascade)).
- **Module caches.** `useBookQuiz.quizByBook`, and the Codex results cache `_resultsCache`.
- **Recap gallery.** It is fetched once per user per app session. Its 1 h signed URLs keep rendering the deleted book's images, and a tap opens the recap history of a book that no longer exists.
- **Word of the Day cache.** `localStorage["bookhero_wotd_{uid}"]` can point at a deleted entry.
- **Hero.** `activeBookId` is not cleared. The next `initializeIfNeeded` finds no book and re-infers ([SES-60](02-reading-sessions.md#ses-60--keeping-or-replacing-the-hero)).
- **Inert keys.** The `sessionPausedAt` and `lastPageSavedAt` keys, and the local Up Next order (filtered at render).

⚠ XD-D02
- **Enforced:** `client`.
- **Source:** `src/stores/loreCards.ts:74-86,224-225`; `src/composables/useRecapGallery.ts:44`; `src/composables/useBookQuiz.ts:33`; `src/composables/useGreatLibrarySearch.ts:42`; `src/composables/useActiveBook.ts:98-119`; `src/stores/progress.ts:36,44`.
- **Target:** purge the gallery items of a deleted book (BC-13 · recommended). The delta library RPC reports `deletedBookIds`, so every device can purge (BC-14 · recommended).

#### XD-10 · Queued offline saves for a deleted book never drain
A queued `progress_update` for the deleted book fails on `reading_progress_book_id_fkey` (23503) at every drain. It is never dropped: `retries` is never incremented and there is no dead letter. ⚠ XD-D03
- **Enforced:** `client` (`flushQueue` leaves failed records in place).
- **Source:** `src/composables/useOfflineSync.ts:76-88`; [SES-78](02-reading-sessions.md#ses-78--replay-is-a-bare-progress-upsert).
- **Target:** queued records carry `userId`, `idempotencyKey` and `occurredAt` and replay through `save_progress`. A `book_not_found` response tells the client to drop the record (D-08 · BC-04).

#### XD-11 · AI work in flight for a deleted book is paid, then lost or orphaned
**Reachable paths.** The user can open Back → Library and swipe-delete before any of these calls finishes:
- the Book Detail recap stream has no `AbortSignal` (only the Dashboard aborts on unmount);
- Insight and passport generation are fire-and-forget after a save;
- vocabulary extraction and resume generation are fire-and-forget after a capture.

Inferred recaps can take tens of seconds.

**After the cascade:**
- the client inserts into `recaps`, `lore_cards`, `book_passports`, `lexicon_entries` and `vocabulary_extractions` fail with 23503. They are logged or swallowed; the passport upsert failure is silent;
- the resume `UPDATE` matches 0 rows;
- the `recap_image` job updates with `.update().eq(id).eq(user_id)` and never checks affected rows. It still calls OpenAI and uploads `recap-images/{uid}/{recapId}.png`, an orphan object.

The AI cost is incurred every time. ⚠ XD-D04
- **Enforced:** `client` (no cancellation); `server:edge` (no existence check).
- **Source:** `src/pages/BookDetailPage.vue:185-189` vs `src/pages/DashboardPage.vue:131-133`; `src/stores/progress.ts:617-632`; `src/stores/captures.ts:115-140`; `src/stores/bookPassport.ts:181-184`; `supabase/functions/generate-recap/handlers/image.ts:22-34,143`. Code-verified, not executed.
- **Target:**
  - server jobs cascade with the book;
  - `process-jobs` re-checks that the book or recap still exists and belongs to the job's user before any AI call or write (BC-05 acceptance 05-5);
  - the `recap_image` handler verifies the recap before calling the provider (BC-13);
  - `generate-recap` persists the recap itself and returns it (BC-07).

  Clients cancel their per-book tasks on delete (D-06 · BC-05 · BC-07 · BC-13).

#### XD-12 · Deleting a book that anchors a reading circle deletes the circle for everyone
Deleting the owner's anchor book removes the circle and every member's invitations, memberships and reactions in it. A member deleting **their own** copy removes only their own reactions on that book; the membership stays. The feature is dormant in every client (D-13). ⚠ XD-D05
- **Enforced:** `server:db` (`reading_circles_book_id_fkey` CASCADE → `circle_*_circle_id_fkey` CASCADE).
- **Source:** live `pg_constraint`; [BE-72](09-database-invariants.md#be-72--deleting-a-book).
- **Note:** cascade and ownership semantics must be decided before the Community phase (BE-Q07).

### Complete a book

#### XD-13 · Completion: state vs event
A book is **complete** when `books.total_pages > 0` and `reading_progress.current_page ≥ total_pages`. The server stores only that state. The **event** "completed now" is detected only by the web client, inside an online `updateProgress`:
- the test is `prevPct < 100 ≤ newPct`;
- `prevPct` is the in-memory percentage;
- `newPct = round(page / total × 10000) / 100`.

The completion prompt instead compares the unrounded `page / total × 100`. DNF has precedence in the library status: a DNF book at ≥ 100 % shows as `dnf`, yet the quest, XP, the purge triggers and the client's `completedBooks` treat it as complete (XD-30).
- **Enforced:** `server:db` (trigger predicates); `server:rpc` (`get_library_with_progress`); `client` (event).
- **Source:** `src/stores/progress.ts:502-505,617`; `src/pages/DashboardPage.vue:278-287`; `src/utils/completionPrompt.ts:6-9`; [SES-04](02-reading-sessions.md#ses-04--completion-means-current_page--total_pages).
- **Target:** `save_progress` detects completion from the **stored** previous page and total. It stamps `reading_progress.completed_at` once, at the first completion (server clock, or the accepted occurred time of an offline replay), and never clears it; `completed_at` drives "finished this year". The response carries `completion.completedNow` for client presentation (D-06 · D-08 · BC-04).

#### XD-14 · Six completion paths fire six different effect subsets
Only paths 1–2 run the client side effects. The other paths run only what the database does.

| # | Path | Purge triggers | `progress_history` row | Session ended | Completion prompt | Passport | Insight (≤ 90 %) | Hero re-infer | +25 XP / quest credit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Online page save on the Dashboard hero | yes | yes | yes (un-awaited) | yes | generated if no row | if a bucket below 90 is crossed | immediate (`onBookCompleted`) | manual books only; quest year = UTC year of `updated_at` |
| 2 | Online page save on Book Detail | yes | yes | yes (un-awaited) | yes | generated if no row | same | next Dashboard mount or signature watch | same |
| 3 | Offline save → later drain | at drain time | **no** | **no** (zombie, XD-21) | yes, at save time | **no** | **no** | yes (Dashboard) | dated at **drain** time |
| 4 | Add book as "Already finished" | yes (INSERT; nothing to delete) | no | n/a | no | no ("View Journey" shown → endless "being generated") | no | n/a | yes (manual), dated now |
| 5 | CSV import "read" | yes (no-op) | no | n/a | no | no (button hidden) | no | n/a | **no** (imported) |
| 6 | `total_pages` lowered to ≤ `current_page` | **no** (no trigger on `books`) | no | **no**: a running session survives | no | no | no | at next re-infer | yes, retroactive, possibly a past year |

⚠ XD-D06
- **Enforced:** `server:db` + `client` as listed.
- **Source:** `src/pages/DashboardPage.vue:242-297`; `src/pages/BookDetailPage.vue:132-183`; `src/stores/progress.ts:425-466,495-665`; `src/stores/books.ts:223-245,325-352,376-411`; `src/composables/useOfflineSync.ts:76-88`; live triggers; [SES-95](02-reading-sessions.md#ses-95--completion-paths-fire-different-effect-subsets).
- **Target:** every path, including an iOS save and an offline replay, produces the same server effects (BC-05 acceptance 05-1):
  - `completed_at` stamped and the session ended;
  - a passport row with frozen stats plus a `passport_summary` job;
  - achievement evaluation, DNA eligibility and Insight evaluation;
  - the deferred `capture_purge` job.

  Offline replays go through `save_progress` with their original timestamp. Import status writes (`write_source = 'import'`) run no AI effects. The prompt and hero rotation stay client presentation, driven by `completion.completedNow` (D-06 · D-08 · BC-04 · BC-05).
- **Note:** which quiet completions (paths 4–6) get a passport is SES-Q06 / [LIB-Q09](01-library.md) / OP-05.2 (recommended: none without reading history). Path 6 behaviour is XD-48 (OP-05.4).

#### XD-15 · Completion purge: captures, resumes and quiz
Any `reading_progress` INSERT, or UPDATE that lists `current_page`, deletes **all** the book's `page_captures` (with their stored resumes) and its `book_quizzes` row when the page reaches `total_pages`. This holds even when the value is unchanged. The ownership match is book id **and** user id.
- **Writes that fire it:** page saves, start-session upserts that resend `current_page`, DNF upserts, initial-status inserts, CSV status upserts and offline replays.
- **Writes that do not:** pause, resume, the session clear, `resumeDnf`, and any `books.total_pages` edit.

Purged data never comes back when the book is un-finished.
- **Enforced:** `server:db` (`page_captures_delete_on_completion` → `delete_page_captures_on_book_completion`; `book_quizzes_delete_on_completion` → `delete_book_quizzes_on_book_completion`).
- **Source:** live `pg_get_triggerdef` / `pg_get_functiondef` (2026-10-18); [CAP-42](04-capture-resume-quiz.md#cap-42--completion-purge-from-the-progress-side), [CAP-44](04-capture-resume-quiz.md#cap-44--completion-can-be-undone-the-purge-cannot), [BE-19](09-database-invariants.md#be-19--completion-deletes-the-books-page-captures), [BE-19a](09-database-invariants.md#be-19a--update-of-current_page-fires-even-when-the-value-is-unchanged), [BE-23](09-database-invariants.md#be-23--un-finishing-restores-nothing).
- **Target:** completion enqueues a `capture_purge` job. It runs once no non-terminal Insight job remains for the book, and **no later than 24 h after completion**, so the Insight capture fallback can still read the captures. The immediate triggers are dropped when the `deferred_purge` flag turns on. The privacy invariant becomes "captures are deleted within 24 h of completion" (D-06 · D-12 · BC-05). Purge timing is CAP-Q03.

#### XD-16 · A capture saved on a completed book is deleted in the same statement
Book Detail still shows the capture prompt for a just-completed book; it checks only `!isDnf`. The Dashboard hides it because the hero switches. If the reader captures anyway:
1. the row is inserted;
2. `record_page_capture_quest_event` upserts the +5 XP event and then deletes **every** capture of the book;
3. PostgREST still returns the row, so the client toasts success and keeps a ghost capture in `capturesByBook`;
4. the vocabulary-ledger insert fails with 23503 (logged), and the resume `UPDATE` matches 0 rows.

Updating any capture of a complete book (for example writing `resume`) also purges all of them. ⚠ XD-D07
- **Enforced:** `server:db` (`page_capture_quest_event_after_save`, AFTER INSERT OR UPDATE ON `page_captures`); `client` (prompt not gated by completion).
- **Source:** live `pg_get_functiondef(record_page_capture_quest_event)`; `src/pages/BookDetailPage.vue:55-61,293-299`; `src/stores/captures.ts:103-112`; [CAP-43](04-capture-resume-quiz.md#cap-43--completion-purge-from-the-capture-side), [LEX-94](05-codex-lexicon.md#lex-94--book-completion-leaves-lexicon-entries-alone-but-kills-extraction-for-completion-captures), [PRO-05](07-profile-stats-goals.md#pro-05--pagecaptures-counts-unique-captured-pages-and-survives-deletions), [BE-21](09-database-invariants.md#be-21--capture-writes-record-xp-then-purge-if-the-book-is-complete).
- **Target:** `save_progress` returns `effects.captureAllowed = false` on the completing save, and every client suppresses the prompt (D-06 · BC-04). Whether a capture on a complete book is rejected (`book_complete`, no XP; recommended) or keeps today's insert-then-purge is CAP-Q02 / OP-05.3.
- **Note:** a capture saved after completion never survives the completion cleanup: the live trigger deletes it immediately.

#### XD-17 · Passport generation runs only on an online in-app crossing
On paths 1–2, `fetchPassport` runs fire-and-forget. If no row exists, `generatePassport` follows:
1. the stats RPC with the **device** time zone;
2. `generate-recap` `mode: 'passport_summary'` (stream);
3. a `book_passports` upsert `onConflict book_id`.

Failure handling:
- `fetchPassport().then()` has no `.catch`;
- a failed generation leaves no row and is never retried, so "View Journey" lands on "Your passport is being generated." forever;
- an empty stream is stored as `ai_summary = ''`.

Stats are recomputed, and rewritten, on every passport view in the viewer's time zone. The "View Reading Journey" gate:
- imported books completed in-app get a passport, but the button is hidden (`source ≠ 'manual'`);
- manual path 4 and path 6 completions show the button and have no passport.

⚠ XD-D06
- **Enforced:** `client`; `server:edge` (`generate-recap` passport mode).
- **Source:** `src/stores/progress.ts:617-624`; `src/stores/bookPassport.ts:55-103,113-190`; `src/pages/BookDetailPage.vue:123`; [SES-46](02-reading-sessions.md#ses-46--when-the-passport-is-generated-today), [SES-48](02-reading-sessions.md#ses-48--passport-stats-are-live-and-rewritten-on-view), [LIB-86](01-library.md#lib-86--view-reading-journey-gate).
- **Target:** at the first completion of a book with reading history, the server:
  - creates the passport row with **frozen** stats (`private.passport_stats` in the reader's stored time zone);
  - enqueues a retried `passport_summary` job with `summary_status` (`pending` · `succeeded` · `failed`).

  Clients stop rewriting stats on view and show "View Reading Journey" whenever a passport row exists (D-06 · D-07 · BC-05 · BC-06).

#### XD-18 · Insight at completion
`detectCrossedMilestone(prevPct, newPct)` runs on paths 1–2:
- reaching 100 % from ≥ 90 % unlocks nothing;
- a jump from below 90 % to 100 % attempts the 90 % card (if none exists), with `unlocked_at_page = total_pages`, and runs in parallel with the passport.

It needs a non-empty master recap. The captures are already purged when it runs.
- **Enforced:** `client`.
- **Source:** `src/utils/milestoneDetect.ts:21-43`; `src/stores/loreCards.ts:99-185`; [INS-06](06-insights.md#ins-06--completion-can-unlock-the-90--card).
- **Target:** the server evaluates the crossed milestone and the backlog on every save, including replays. Generation falls back from recap to captures to spoiler-guarded metadata. The deferred purge (XD-15) keeps the captures readable for the fallback (D-06 · D-12 · BC-05 · BC-08).

#### XD-19 · XP and quest credit at completion
`get_reading_quest_summary` grants:
- +25 XP per completed **manual** book;
- page XP clamped to `total_pages`;
- yearly quest credit when `reading_progress.updated_at` falls inside the **UTC** year.

That date moves on every later write to the row. As a result:
- an offline completion is credited at drain time;
- path 4 is credited now;
- imports are never credited;
- a `total_pages` edit is credited retroactively, by the row's last `updated_at`.

The history-based finish facts (`get_monthly_reading.booksFinished`, `get_reading_records.fastestFinish`) use the first history row with `page ≥` the **current** `total_pages`, so paths 3–6 never produce one. Live: 6 of 14 complete manual books have no history at all. ⚠ XD-D06
- **Enforced:** `server:rpc`.
- **Source:** live `get_reading_quest_summary`, `get_monthly_reading`, `get_reading_records`; [PRO-09](07-profile-stats-goals.md#pro-09--the-quest-year-is-a-utc-window-and-membership-is-decided-by-updated_at), [PRO-99](07-profile-stats-goals.md#pro-99--offline-saves-write-no-history).
- **Target:** quest credit counts `completed_at` within the reader's local year (D-07 · BC-04 · BC-06). An offline replay credits the year of its occurred time (BC-05 acceptance 05-7). Which non-session completions earn XP is PRO-Q02 / [LIB-Q01](01-library.md).

#### XD-20 · Achievements and Reading DNA are not evaluated at completion
- **Achievements** are computed and upserted only when the Trophy Room mounts, so `earned_at` is the time of that visit.
- **DNA** is evaluated on the next Profile mount, which blocks first paint. The threshold is 2 books, Δ2 books, or 90 days. "Books finished" is the client `completedBooks.length`, which includes imports and DNF-at-100 %.

⚠ XD-D09
- **Enforced:** `client`.
- **Source:** `src/pages/TrophyRoomPage.vue:28-37`; `src/composables/useAchievements.ts:69-97`; `src/pages/ProfilePage.vue:48`; `src/stores/readingDna.ts:21-22,60-68`; `src/composables/useReadingProfile.ts:73`; [PRO-51](07-profile-stats-goals.md#pro-51--achievement-sync-runs-only-on-trophy-room-mount), [PRO-57](07-profile-stats-goals.md#pro-57--dna-is-evaluated-only-on-profile-mount).
- **Target:**
  - achievements are evaluated server-side on lifecycle events, with a server-authoritative `earned_at` (D-06 · BC-09);
  - completion evaluates DNA eligibility and enqueues one deduplicated `dna` job, and `request_dna_refresh` replaces client generation (D-06 · BC-05).

  The canonical "books finished" is PRO-Q01 / OP-05.5.

#### XD-21 · The session ends with the completing save, except on offline and stale paths
- **Online (paths 1–2):** the save clears `session_start_at` / `session_paused_at` with an un-awaited update.
- **Offline (path 3):** the completing save leaves the session set locally and on the server.
- **Stale device:** a pencil completion from a device unaware of another device's session leaves that session in place.
- **Path 6:** a `total_pages` edit never touches the session.

Once a book is complete, Book Detail hides every session control and a complete book is never the hero, so **no UI can cancel the zombie**. It keeps appearing as `sessionStartAt` in `get_library_with_progress`. Live: 0 zombies. ⚠ XD-D10
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:586-605,656-664`; `src/components/book/BookProgressPanel.vue:102,111,121`; [SES-89](02-reading-sessions.md#ses-89--a-zombie-session-can-survive-on-a-completed-book).
- **Target:** the `reading_progress` BEFORE trigger clears the session on completion, whatever the write path (D-06 · BC-04 · BC-05). Stale-session reporting is OP-04.7 / SES-Q16.

#### XD-22 · What a completed book shows and hides
**Where it moves:**
- it leaves In Progress (`< 100`) and joins Completed (sorted by `updatedAt` desc);
- it moves to the Library "Completed" tab or archive tier;
- it is never the hero;
- the Dashboard onboarding state can flip to `completedOnly`, `oneQueued` or `empty`.

**Hidden:** Start Session, the pencil, End Session, Focus mode, the DNF link, the Memory Check chip, and "Get Recap" (≥ 100 %).

**Kept:** the Codex and Words chips, the Insights card, the recap carousel and history, and "View Reading Journey" (manual books).

No UI path lowers the page of a complete book; the only way back is a `total_pages` edit (XD-49).
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:679-699`; `src/components/book/BookProgressPanel.vue:76,102,111,121,137-143,170,182`; `src/pages/BookDetailPage.vue:123,307`; `src/composables/useDashboardOnboardingState.ts:38-85`; [SES-42](02-reading-sessions.md#ses-42--what-a-completed-book-shows-and-hides).
- **Note:** an explicit "Read again" flow is SES-Q04 and is not part of Phase 0.

#### XD-23 · What completion leaves untouched
- **Lexicon:** entries stay in review and Word of the Day ([LEX-94](05-codex-lexicon.md#lex-94--book-completion-leaves-lexicon-entries-alone-but-kills-extraction-for-completion-captures)).
- **AI artefacts:** recaps and their images, lore cards and the passport row (if any) are kept ([REC-64](03-recaps.md#rec-64--completion), [INS-35](06-insights.md#ins-35--completion-dnf-and-edits-have-no-database-effect-on-cards)).
- **Up Next:** the `up_next_order` row is never removed ([SES-43](02-reading-sessions.md#ses-43--up_next_order-rows-are-never-removed-by-reading)). The queue shows only 0 % books, so this is harmless.
- **Community:** the reader leaves "also reading" and public `currentlyReading` (both require `0 < page < total`), but nothing is deleted ([COM-97](10-community-circles.md#com-97--completion-dnf-and-page-edits-have-no-community-triggers)).
- **Book Lengths:** the card updates at once from the progress store ([PRO-43](07-profile-stats-goals.md#pro-43--book-lengths)).
- **Enforced:** `server:db` (no cascade); `client`.
- **Source:** live triggers; `src/pages/DashboardPage.vue:202-215`.

#### XD-24 · Cache effects of a completing online save
**Invalidated:** `library`, `lastSession`, `readingStats`, `readingQuest:*`, and `velocity` (only if a session was active).

**Not invalidated:**
- `libraryBreakdown` (stale for up to 120 s);
- `readingRecords`;
- the calendar and monthly module caches (stale until reload);
- the recap gallery;
- `quizByBook`, which keeps an entry for the deleted quiz;
- `capturesByBook` / `loadedBookIds`, which still list the purged captures until reload.

⚠ XD-D08
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:549-605`; `src/composables/useBookQuiz.ts:33`; `src/stores/captures.ts:18-19`.

### DNF / resume

#### XD-25 · Shelving: the write and its side effects
"Didn't finish it? Shelve this book" appears only on Book Detail, and only for a book that is neither complete nor already DNF. Confirming ("Didn't finish?" → "Shelve it" / "Keep reading") upserts `{current_page: local ?? 0, dnf_at: <device clock>, session_start_at: null, session_paused_at: null}`. Side effects:
- the upsert creates a row if none exists;
- `updated_at` is bumped;
- no history row is written;
- a **running session is discarded without history**: no session XP, no capture prompt, and the reading time is lost;
- the local `current_page` can rewind the server page, or write 0 when no local entry exists;
- the completion triggers are re-evaluated (a no-op unless the book is complete).

⚠ XD-D11
- **Enforced:** `client` (gate, write).
- **Source:** `src/pages/BookDetailPage.vue:223-240`; `src/stores/progress.ts:351-388`; [LIB-91](01-library.md#lib-91--shelving-write), [SES-75](02-reading-sessions.md#ses-75--shelving-ends-a-session-without-history-resuming-touches-only-dnf_at), [SES-87](02-reading-sessions.md#ses-87--the-start-upsert-also-overwrites-current_page-from-the-local-cache).
- **Target:** `mark_dnf(p_book_id)` inserts with `current_page = 0` if no row exists. Otherwise it updates **only** `dnf_at = now()` (server clock) and the session columns. It never sends `current_page`, raises `book_complete` for a complete book, and writes no history (D-06 · BC-04). What happens to a running session is XD-Q03 (OP-04.4).

#### XD-26 · DNF exclusions are client-only
A DNF book is excluded from:
- hero inference;
- In Progress and Up Next;
- the Library grid tiers and list sections (search keeps a DNF group).

The Library header shows a ban icon when the DNF count is > 0, linking to `/library/dnf`. On Book Detail:
- **hidden:** Start Session, the pencil, the Codex/Words chips, Memory Check, the capture prompt, the Insights card and the recap section;
- **shown:** "Shelved as Did Not Finish · {relative}" with "Start reading again";
- `startSession` throws "This book is shelved as Did Not Finish. Resume it first."
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:48,102`; `src/stores/progress.ts:280-282,682`; `src/pages/DashboardPage.vue:203-207`; `src/pages/LibraryPage.vue:76-78,84-86,187-196`; `src/components/book/BookProgressPanel.vue:76,87-99,102,155`; `src/pages/BookDetailPage.vue:286-304`; [LIB-93](01-library.md#lib-93--where-dnf-books-are-excluded).
- **Target:** `start_session` and `save_progress` raise `book_dnf` server-side (D-06 · BC-04).

#### XD-27 · The server ignores DNF everywhere except the library RPC
`dnf_at` is read only by `get_library_with_progress`. Everything else treats a DNF book like any other:
- XP still counts its pages, and the quest is unaffected;
- `get_library_breakdown` counts it as in progress or unread, while the client's `booksInProgress` excludes it;
- velocity does not exclude it;
- public `currentlyReading` and "also reading" include it ([COM-97](10-community-circles.md#com-97--completion-dnf-and-page-edits-have-no-community-triggers)).

⚠ XD-D12
- **Enforced:** `server:rpc` (by omission).
- **Source:** live `pg_get_functiondef … ilike '%dnf_at%'` (only `get_library_with_progress`); [PRO-95](07-profile-stats-goals.md#pro-95--dnf-is-ignored-by-every-stats-rpc), [BE-18](09-database-invariants.md#be-18--library-breakdown-ignores-dnf).
- **Note:** making DNF a server-wide status is BE-Q04 / [LIB-Q11](01-library.md).

#### XD-28 · DNF keeps all data and has no server cascade
Shelving deletes nothing and keeps:
- captures, resumes and the quiz ([CAP-46](04-capture-resume-quiz.md#cap-46--dnf-purges-nothing));
- recaps ([REC-65](03-recaps.md#rec-65--dnf)) and lore cards (still listed in the Codex);
- lexicon entries, which stay in review and can be picked as Word of the Day ([LEX-95](05-codex-lexicon.md#lex-95--dnf-has-no-effect-on-entries-or-review));
- the `up_next_order` row and achievements.

No trigger reacts to `dnf_at`.
- **Enforced:** `server:db` (no trigger).
- **Source:** live trigger list; [BE-23a](09-database-invariants.md#be-23a--dnf-and-add-with-status-writes-have-no-server-cascade).
- **Target:** a DNF set ends the session and cancels **queued** (not running) Insight jobs for the book. Nothing is purged (D-06 · BC-05; OP-05.6).

#### XD-29 · Shelving and resuming restart the recap idle clock and reorder the book
Both writes bump `reading_progress.updated_at`. That restarts the 72 h recap idle-grant clock ([REC-07](03-recaps.md#rec-07--any-reading_progress-update-resets-the-idle-clock)) and moves the book in every `updated_at`-ordered list: In Progress, hero recency and the library `lastReadAt`.
- **Enforced:** `server:db` (`reading_progress_updated_at`).
- **Source:** [SES-06](02-reading-sessions.md#ses-06--updated_at-moves-on-every-update), [BE-14](09-database-invariants.md#be-14--reading_progressupdated_at-moves-on-every-update).
- **Note:** which writes should move "last read" and the idle clock is XD-Q01 (REC-Q04, SES-Q15).

#### XD-30 · A DNF book at ≥ 100 % counts as finished in some places
The client's `completedBooks` has no DNF filter. A DNF book whose page reaches the total therefore:
- counts as finished for the Profile pill, Book Lengths and DNA gating;
- counts as completed for the quest and XP;
- has its captures and quiz purged, but only when the total is reached through a `current_page` write. A `total_pages` edit fires no trigger (XD-48);
- still shows as DNF in the Library.

The UI blocks shelving a complete book. This state is still reached in three ways: lowering `total_pages` on a shelved book, an offline replay, or a save from another device that has not seen the shelving. Saves never clear `dnf_at`. Live: 0 rows. ⚠ XD-D12
- **Enforced:** `client` (`completedBooks`); `server:rpc` (quest); `server:db` (purge).
- **Source:** `src/stores/progress.ts:690-699`; [BE-17](09-database-invariants.md#be-17--library-status-derivation).
- **Note:** XD-Q04 decides the precedence.

#### XD-31 · Resuming a DNF book
Entry points:
- **Book Detail "Start reading again":** no success toast; a failure shows inline "Could not resume the book. Try again.".
- **DNF list "Resume":** toasts "Back on the shelf — The book is back in your reading list." / "Resume failed — Could not resume the book. Try again.".

Both run `update {dnf_at: null}` filtered by book and user with `.single()`, so a row must exist. No `current_page` is sent, so no completion trigger fires; no history is written; `updated_at` is bumped. The status is re-derived:
- **`unread`:** back into Up Next at its old `up_next_order` index, or appended;
- **`reading`:** **top** of In Progress (recency);
- **`finished`:** stays finished.

The book becomes hero-eligible again, but it replaces the current hero only if there is none or the current hero is no longer readable.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:390-417`; `src/pages/DnfListPage.vue:39-59`; `src/composables/useActiveBook.ts:98-119`; [LIB-92](01-library.md#lib-92--resume).
- **Target:** `resume_dnf(p_book_id)` requires an existing row and raises `not_dnf` otherwise. It sets `dnf_at = null` and nothing else (D-06 · BC-04).

#### XD-32 · DNF and resume barely invalidate caches
Both writes touch `progress` and invalidate `library`. Neither invalidates `readingStats`, `libraryBreakdown`, `readingQuest:*`, `lastSession` or `velocity`. ⚠ XD-D13
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:386-387,415-416`.

### CSV import (Goodreads / StoryGraph)

#### XD-33 · Import pipeline and guards
`useLibraryImport.startImport` runs these steps in order:
1. offline guard ("You are offline. Reconnect to import your library."; nothing is parsed);
2. papaparse;
3. format detection;
4. per-row mapping;
5. `booksStore.importBooks`;
6. enrichment.

Parsing, mapping, dedupe keys and dialog copy are owned by [01 · Library](01-library.md) (LIB-66…LIB-84).
- **Enforced:** `client`.
- **Source:** `src/composables/useLibraryImport.ts:93-150`; `src/stores/books.ts:256-374`.

#### XD-34 · Import writes are not atomic
1. **Books.** Inserted in chunks of 100 with `source = goodreads|storygraph`, `cover_url`, `genre` and `description` null, `total_pages = parsed ?? 100` and `page_count_estimated = (parsed == null)`.
2. **Statuses.** The `reading_progress` status upserts run only **after all chunks**:
   - `read` → `current_page = total_pages` (placeholder included);
   - DNF shelf → `current_page 0` + `dnf_at` = import time;
   - anything else → no row (= Up Next).

A failing chunk (title > 500, author > 200, bad ISBN, page overflow) aborts the run. Earlier chunks persist, and the status upserts never run, so read and DNF books stay queued. A re-import skips them as duplicates. ⚠ XD-D14
- **Enforced:** `client`; `server:db` (CHECKs abort a whole chunk).
- **Source:** `src/stores/books.ts:296-352`; [LIB-78](01-library.md#lib-78--quiet-status-writes), [LIB-83](01-library.md#lib-83--import-is-not-transactional).
- **Target:**
  - import status writes are tagged `app.write_source = 'import'`. `completed_at` keeps the value given by the import (CSV "Date Read") or stays null, so the book is excluded from "finished this year". BC-05 then runs no AI effects (D-06 · BC-04 · BC-05);
  - recommended (not yet decided): BC-15 `import_library`, one idempotent transaction per call with ISBN normalisation, full-library dedupe, statuses and baseline rows.

#### XD-35 · Import runs no reading-domain side effects
Import writes no `progress_history` and emits no `lastSessionEnded`. It produces no passport, Insight, recap, achievement, DNA, lexicon or quest-XP effect. The completion triggers fire on the "read" status upserts, but they are no-ops because the new books have no captures. Imported DNF books carry the import time as `dnf_at` ([LIB-95](01-library.md#lib-95--imported-dnf-timestamp)).
- **Enforced:** `client` (bypasses `updateProgress`); `server:db` (triggers no-op).
- **Source:** `src/stores/books.ts:247-252,282-352`; [INS-08](06-insights.md#ins-08--quiet-writes-never-trigger), [SES-33](02-reading-sessions.md#ses-33--initial-status-on-add-book-and-import-is-a-quiet-write).

#### XD-36 · Enrichment rewrites books and can un-complete them
Enrichment runs 3 books at a time with 150 ms gaps. Each hit calls `updateBook`:
- the cover only if missing;
- the first genre segment only if missing;
- the real `total_pages` only if the count is estimated, which clears `page_count_estimated`.

Every call invalidates `library`, `libraryBreakdown` and `readingQuest:*`. A book costs up to 5 external calls on the shared Google key. Enrichment cannot be cancelled and keeps writing after navigation. A real count above 100 on a placeholder "read" book **demotes it to `reading`** (for example 100/350 = 28.6 %). The book then enters In Progress and the hero after a reload, and its stale percentage survives until reload. Live: 0 demoted rows. ⚠ XD-D15
- **Enforced:** `client`.
- **Source:** `src/composables/useLibraryImport.ts:14-15,55-91`; `src/stores/books.ts:389-410`; [LIB-81](01-library.md#lib-81--enrichment), [LIB-82](01-library.md#lib-82--placeholder-demotion), [SES-29](02-reading-sessions.md#ses-29--a-completed-book-cannot-be-lowered-from-the-ui-page-count-edits-can-un-complete-it).
- **Target:** the `a10_books_lifecycle` trigger re-evaluates completion when `total_pages` changes (D-06 · BC-05). Recommended outcome (OP-05.4): a completed book stays complete and `current_page` follows the new total. A server enrichment proxy is recommended in BC-15.

#### XD-37 · Imported books across domains
Imported books (`source ≠ 'manual'`) are **excluded** from:
- XP pages and completions;
- the yearly quest;
- the `first_book` / `books_*` achievements;
- `get_reading_stats.totalPagesRead`.

They are **included** in:
- the library breakdown;
- the Profile "books finished" (progress store);
- Book Lengths (100-page placeholders included);
- **DNA gating**: a large import can trigger a `generate-reading-dna` AI call with the imported titles on the next Profile visit.
- **Enforced:** `server:rpc` (`source = 'manual'` filters); `client` (Profile, Book Lengths, DNA).
- **Source:** live `get_reading_quest_summary`, `get_reading_stats`; `src/stores/readingDna.ts:60-80`; [LIB-85](01-library.md#lib-85--imported-books-in-stats), [PRO-97](07-profile-stats-goals.md#pro-97--imported-books-in-this-domain), [PRO-43](07-profile-stats-goals.md#pro-43--book-lengths).
- **Note:** how imports count, including toward DNA, is [LIB-Q16](01-library.md) / PRO-Q05 / OP-05.5.

#### XD-38 · Imported books later read in-app
`books.source` never changes. An imported book read in the app therefore:
- **counts** its history rows toward streaks, calendar, monthly bars, records and session XP (+10 per row), plus recap and lore XP;
- **never counts** toward pages, completion XP or the quest;
- gets a passport auto-generated on an online completion, but "View Reading Journey" stays hidden (`source ≠ 'manual'`). The completion prompt's "View Journey" still opens it.

⚠ XD-D17
- **Enforced:** `server:rpc`; `client` (gate).
- **Source:** live `get_reading_quest_summary`; `src/pages/BookDetailPage.vue:123`; [SES-52](02-reading-sessions.md#ses-52--view-reading-journey-requires-a-manual-book).
- **Target:** the gate becomes "a passport row exists" (D-06 · BC-05; OP-05.2). Counting organic progress after an import is OP-15.5 / LIB-Q16.

#### XD-39 · Import dedupe seeds from in-memory state
The seen-set starts from `booksStore.books`:
- on a cold `/books/add` it is empty, so a re-import duplicates the whole library;
- right after an account switch it holds the previous user's library.

ISBN keys and title + author keys never cross-match. ⚠ XD-D16
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:266-269`; [LIB-75](01-library.md#lib-75--dedupe-key), [LIB-76](01-library.md#lib-76--dedupe-seed-depends-on-the-in-memory-library).
- **Note:** recommended fix: server-side dedupe against the full library (BC-15).

#### XD-40 · Import cache and UI effects
After the inserts the client:
- touches `books`;
- invalidates `progress`, `library`, `libraryBreakdown`, `readingStats`, `readingQuest:*` and `velocity`;
- awaits `fetchLibraryWithProgress()`.

Records and calendar are not refreshed; they are unaffected anyway, because there is no history. UI consequences:
- imported to-read books are appended to Up Next after the ordered ones, in `books` order;
- rows inserted in the same chunk share `created_at`, and there is no tie-break ([LIB-47](01-library.md#lib-47--library-order));
- the Dashboard onboarding state can jump from `empty` to `completedOnly`, `oneQueued` or `standard`;
- descriptions are back-filled lazily the first time each Book Detail opens, and every success calls `updateBook` again.
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:355-362`; `src/pages/DashboardPage.vue:202-215`; `src/pages/BookDetailPage.vue:99-114`.

### Sign-out / user switch

#### XD-41 · Sign-out sequence
1. More sheet → "Sign out".
2. `supabase.auth.signOut()` with the default **global** scope, which revokes the user's refresh tokens on every device.
3. `onAuthStateChange` runs `clearAll()` on the SWR cache because the user id changed, and removes the `bookhero-auth-user` snapshot.
4. `router.push('/login')`.

There is no page reload; the `online` and service-worker message listeners stay attached. **Offline**, `signOut` throws, the handler has no `catch`, and the user stays signed in with no feedback. auth-js treats a server 401/403/404 on logout as success. ⚠ XD-D21
- **Enforced:** `client`.
- **Source:** `src/components/shared/AppBottomNav.vue:36-40`; `src/stores/auth.ts:82-92,139-148`; `src/App.vue:40-48`; [PLT-13](08-platform-auth-account.md#plt-13--swr-metadata-is-cleared-on-every-identity-change), [PLT-14](08-platform-auth-account.md#plt-14--sign-out-is-global-and-fails-silently-offline).
- **Note:** sign-out scope and the handling of unsynced saves are PLT-Q01 / OP-11.2. Deleting the device's push token on sign-out comes with BC-14 (recommended).

#### XD-42 · Sign-out clears almost nothing locally
| Item | Cleared? | What the next user sees |
|---|---|---|
| Supabase session (`sb-<ref>-auth-token`), `bookhero-auth-user` snapshot | yes | new |
| SWR metadata and refocus revalidators | **yes** (`clearAll`) | every key reloads |
| `books`, `libraryEntries` | no | the old library flashes on pages that render before the library RPC lands |
| Progress map, `sessionPausedAt`, `lastPageSavedAt`, `lastSessionEnded`, `pendingSync` | no | map replaced on fetch; the rest is inert (book-id keyed) |
| `upNextOrder`, `recapsByBook`, `passportByBook`, `capturesByBook` / `loadedBookIds`, `quizByBook` | no | inert (different book ids) |
| `lexicon.entriesByBook`, WotD refs, `extraAllotment` | no | per-book keys overwritten; stale keys remain |
| Anki totals | no | **can be written into the new user's row** (XD-44) |
| `loreByBook`, `generatingBookIds` | no | **old user's cards in Codex "All Books"**; the banner can persist over `/login` |
| Achievements `_earned` / `_earnedLoaded` | no | **never reloaded** (XD-44) |
| Hero `activeBookId` | no | re-inferred (book not found) |
| Add Book search state | no | the old query and results on `/books/add` |
| Stats, records, breakdown, last-session and velocity refs | no | old values visible until the SWR refetch |
| Offline queue (IndexedDB `chronicler-offline/progress_queue`) | **no, and not user-scoped** | **drained as the new user** (XD-43) |
| Background Sync tag `progress-sync` | no | the SW posts `FLUSH_PROGRESS_QUEUE` to whoever is signed in |
| In-flight AI jobs | **not cancelled** | results written under the new identity (XD-44) |

⚠ XD-D18
- **Enforced:** `client`.
- **Source:** `src/stores/auth.ts:89`; `src/composables/useCache.ts:132-138`; store and composable files listed in [PLT-15](08-platform-auth-account.md#plt-15--sign-out-clears-almost-nothing-locally) and [SES-97](02-reading-sessions.md#ses-97--sign-out-leaves-session-domain-state-behind).
- **Note:** every client must wipe **all** per-user state on any user-id change: caches, stores, module singletons, the offline queue, in-flight tasks, and (native) widgets and Live Activities. This stays client-side ([consolidation plan §5](../backend-consolidation-plan.md#5-what-stays-client-side)).

#### XD-43 · The offline queue is drained as the next user
Queued records carry no user id and are flushed under whichever user is signed in next; `syncToSupabase` stamps the **current** `user_id`. RLS checks only `user_id`, so the upsert succeeds. The result is an orphan `reading_progress` row that points at the previous user's `book_id`:
- it is invisible to both libraries;
- the completion triggers are a no-op, because their ownership match fails.

While nobody is signed in, drains throw "Not authenticated" and the records stay queued. Live: 0 such rows. ⚠ XD-D19
- **Enforced:** `client`; `server:db` (RLS without a book-ownership check).
- **Source:** `src/composables/useOfflineSync.ts:12-13,76-88`; `src/stores/progress.ts:52-79`; [PLT-46](08-platform-auth-account.md#plt-46--replay-is-a-fifo-bare-upsert-as-the-current-user).
- **Target:**
  - queued records carry `userId`, `idempotencyKey` and `occurredAt`, and replay through `save_progress`, which validates book ownership (D-08 · BC-04);
  - the client drains only the current user's records and drops or flags the rest (BC-01 PWA change);
  - child-table RLS checks book ownership (BC-01).

#### XD-44 · Cross-user leaks from surviving client state
- **Achievements.** `_earned` and `_earnedLoaded` are module singletons that are never reset. The next user sees the previous user's earned dates, and `sync()` skips keys the old map already holds, so some new badges may never persist.
- **Anki.** Totals can be written into the new user's `anki_review_sessions` row if a session is saved before `fetchSession` runs (LEX-D09).
- **Lore.** Codex "All Books" merges the old user's lore cards. An in-flight Insight job reads the identity at insert time, so it can insert a card owned by the **new** user against the old user's book (RLS checks only `user_id`) ([INS-58](06-insights.md#ins-58--account-switch-mid-generation)).
- **Import.** Dedupe seeds from the old library (XD-39).

⚠ XD-D20
- **Enforced:** `client`; `server:db` (RLS without a book-ownership check).
- **Source:** `src/composables/useAchievements.ts:19-20`; `src/stores/ankiSession.ts:9-13`; `src/stores/loreCards.ts:24,28,152-168`; [INS-55](06-insights.md#ins-55--user-change-keeps-lore-state), [LEX-96](05-codex-lexicon.md#lex-96--account-deletion-and-sign-out).
- **Target:**
  - achievements are server-evaluated (D-06 · BC-09);
  - Insights are server-generated and bound to the job's user and book (D-06 · BC-08);
  - child-table RLS checks book ownership (BC-01);
  - recommended: atomic Anki session aggregates through BC-10.

#### XD-45 · State that resets itself on a user change
These singletons check the user id and reset when it differs:
- community identity;
- the Codex search results cache (cleared on the first search by a different uid);
- the recap gallery;
- the calendar months and monthly years caches;
- the DNA store (on the next `fetchDna`);
- the DNA recommendation covers (signature mismatch).

The WotD cache key is per user. Device preferences persist across users **by design**: `bookhero_theme`, `library-view-mode`, `library-active-tab`, `library-grid-collapsed`.
- **Enforced:** `client`.
- **Source:** `src/composables/useCommunityIdentity.ts:55-75`; `src/composables/useGreatLibrarySearch.ts:150-155`; `src/composables/useRecapGallery.ts:44`; `src/composables/useReadingCalendar.ts:27-32`; `src/composables/useMonthlyReading.ts:26-30`; `src/stores/readingDna.ts:36-39`; `src/composables/useDnaRecommendations.ts:29-32`.

#### XD-46 · Multi-tab and remote session loss
Auth events are broadcast to every tab of the origin. Each tab then clears its SWR cache and sets `user = null`, which hides the nav. There is no reactive redirect, so each tab stays on its current page until the next navigation hits the guard. The same happens when another device's global sign-out revokes the refresh token.
- **Enforced:** `client` (supabase-js `BroadcastChannel`).
- **Source:** [PLT-16](08-platform-auth-account.md#plt-16--no-reactive-redirect-on-session-loss), [PLT-17a](08-platform-auth-account.md#plt-17a--auth-state-is-shared-across-tabs).

### Edits outside a session

#### XD-47 · `total_pages` edit: entry points and write
Entry points:
- Library swipe → Edit → `BookEditDialog`. The form validates ≥ 1, and it shows status radios that are ignored on save;
- import enrichment (XD-36).

The write is `books.update {…, total_pages, page_count_estimated: false}`, so every dialog save clears the placeholder flag. No trigger exists on `books`, and `current_page` is neither clamped nor rewritten.
- **Enforced:** `client` (validation, flag clearing); `server:db` (`books_total_pages_check ≥ 1`).
- **Source:** `src/components/books/BookEditDialog.vue:21-37`; `src/stores/books.ts:376-411`; [LIB-62](01-library.md#lib-62--fields-saved-by-edit).

#### XD-48 · Lowering `total_pages` to ≤ `current_page` completes the book silently
The RPC status becomes `finished` (percentage capped at 100), with **no** completion effects:
- no capture or quiz purge;
- no history row, passport, prompt or Insight.

The consequences:
- **Retroactive XP and quest credit (manual books).** The quest +25 XP is credited retroactively, dated by the progress row's last `updated_at` (possibly a past UTC year), and page XP clamps to the new total.
- **Retroactive history facts.** `get_monthly_reading.booksFinished` and `get_reading_records.fastestFinish` are recomputed against the new total, so a finish can appear in a past month.
- **Dead-end passport.** A manual book shows "View Reading Journey", which lands on "being generated" forever.
- **Zombie session.** A running session survives (XD-21).

⚠ XD-D22
- **Enforced:** `client` (no server reaction).
- **Source:** `src/stores/books.ts:376-411`; live trigger list; [LIB-63](01-library.md#lib-63--page-count-edits-bypass-completion), [SES-96](02-reading-sessions.md#ses-96--page-count-edits-change-completion-silently), [CAP-47](04-capture-resume-quiz.md#cap-47--lowering-total_pages-does-not-purge), [PRO-96](07-profile-stats-goals.md#pro-96--a-total_pages-edit-changes-completion-retroactively).
- **Target:** `a10_books_lifecycle` (AFTER UPDATE OF `total_pages` on `books`) re-evaluates completion. The recommended outcome (OP-05.4) runs the full completion pipeline for an unfinished book, including `completed_at`, the session end and the deferred purge (D-06 · BC-05). The direction rules are [LIB-Q04](01-library.md) / SES-Q05.

#### XD-49 · Raising `total_pages` above `current_page` un-completes a finished book
Effects:
- the status becomes `reading`, and a manual book loses its +25 XP;
- the book leaves Completed and is hero-eligible again;
- its captures, quiz and resumes are already gone ([CAP-44](04-capture-resume-quiz.md#cap-44--completion-can-be-undone-the-purge-cannot));
- the passport row stays, but "View Journey" is hidden (`isComplete` is false);
- lore and recap snapshots are not recomputed ([INS-35](06-insights.md#ins-35--completion-dnf-and-edits-have-no-database-effect-on-cards)).

Import enrichment does this automatically (XD-36). ⚠ XD-D23
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:376-411`; [SES-29](02-reading-sessions.md#ses-29--a-completed-book-cannot-be-lowered-from-the-ui-page-count-edits-can-un-complete-it).
- **Target:** under the recommended OP-05.4 outcome, a book with `completed_at` **stays complete** and `current_page` follows the new total. Un-completing a book needs an explicit "Read again" action, which is outside Phase 0 (SES-Q04) (D-06 · BC-05).

#### XD-50 · Client state after a `total_pages` edit
The client replaces `books[idx]`, touches `books`, and invalidates `library`, `libraryBreakdown` and `readingQuest:*`. It does **not** invalidate:
- `progress`, `readingStats`, `readingRecords` or `lastSession`;
- the calendar and monthly caches;
- `velocity`, so "finish by ~{date}" keeps using the old total until the next session end or a reload.

**Stale percentage.** The progress-map percentage stays stale **even after a refetch**: the merge keeps the local entry when `updatedAt` is equal, and a book edit never touches `reading_progress.updated_at`.

**Values that update at once** (they are derived from `books.totalPages`):
- "N pages left" and "N pages to your next Insight";
- the recap `unlockPage`;
- the page-sheet bounds;
- the next save's `newPct`.

The hero line and the % bar can therefore disagree. The next save compares the stale `prevPct` with the new `newPct`. Example: the total is raised 200 → 400 at page 150 (37.5 % real, 75 % stale). A save at page 170 (42.5 %) looks backward, so the 40 % Insight is never attempted. In the other direction, a stale `prevPct` can trigger or suppress the completion prompt wrongly.

**Downstream.** Passport stats re-clamp to the new total on the next view and are rewritten ([SES-48](02-reading-sessions.md#ses-48--passport-stats-are-live-and-rewritten-on-view)). Dormant circle reactions keep their frozen `source_total_pages`. ⚠ XD-D24
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:403-410`; `src/stores/progress.ts:105-128,502-505,626-632`; `src/composables/useReadingVelocity.ts:25`; `src/utils/milestoneDetect.ts:50-61`; `src/composables/useRecapLock.ts:49-53`; [LIB-64](01-library.md#lib-64--stale-local-state-after-edit), [LIB-108](01-library.md#lib-108--velocity-cache-scope).
- **Target:** completion and milestone detection run on the server from stored state (D-06 · BC-04 · BC-08). Clients derive the percentage at use time (XD-02).

#### XD-51 · A `current_page` correction (pencil) is a full online save
**Visibility and validation.** The pencil shows on the hero only when no session is active, and on the Book Detail panel only when the book is not complete and not DNF. The value must be `0 … total_pages`; an unchanged value is blocked ("That's already your current page."), and the value is clamped again before saving.

The online `updateProgress` is identical to a session end except `session_start_at = null`:
1. **Upsert.** The completion triggers fire if the page is ≥ total. `updated_at` is bumped, which moves In Progress order, hero recency, the 72 h recap idle clock and the quest year.
2. **History row.** One is written even for **backward** corrections. Today it earns +10 XP and a streak day, and turns the Last Session card into the untimed "Last Update". A backward-then-forward pair is re-counted by the lag-delta stats, but not by the passport (high-water mark).
3. **`lastPageSavedAt = now`.** This **starts the 6 h recap cooldown** and **resets the 48 h Memory Check "away" clock**.
4. **Capture prompt.** `lastSessionEnded` raises it, even for corrections.
5. **Insight.** A forward bucket crossing triggers an attempt. An existing card deduplicates it; backward edits never trigger one.
6. **Completion.** Crossing to 100 % runs the full completion path 2 (XD-14).
7. **Recap side effects.** A backward edit re-locks the recap by pages. Going below the latest recap's `page_snapshot` empties the capture window and forces the "Inferred recap" confirm. The quiz is regenerated at the next session start once `current_page > page_snapshot`.
8. **Cache.** Invalidated: `library`, `lastSession`, `readingStats`, `readingQuest:*`. Not invalidated: `libraryBreakdown`, `readingRecords`, `velocity`, calendar, monthly.

⚠ XD-D08 · XD-D25
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:201-209`; `src/components/book/BookProgressPanel.vue:76`; `src/utils/pageSave.ts:14-30`; `src/pages/DashboardPage.vue:245-248`; `src/pages/BookDetailPage.vue:134`; `src/stores/progress.ts:495-632`; [SES-28](02-reading-sessions.md#ses-28--pencil-corrections-happen-only-outside-a-session), [SES-32](02-reading-sessions.md#ses-32--every-online-save-writes-a-history-row), [SES-37](02-reading-sessions.md#ses-37--the-capture-prompt-follows-any-online-save-that-wrote-history), [REC-04](03-recaps.md#rec-04--cooldown-6-h-option-b-anchor), [CAP-61](04-capture-resume-quiz.md#cap-61--away-means-at-least-48-h-since-the-last-page-save).
- **Target:** under the D-08 counting contract, a pencil save is a `kind = 'update'` history row:
  - **forward:** it counts pages, a streak day and the calendar, but earns no session XP and gives no `sessions_50/100` progress;
  - **backward:** it creates no reading day and no pages;
  - it is never the Last Session card;
  - an unchanged page raises `page_unchanged`.

  (D-08 · BC-04 · BC-06). Whether the capture prompt, recap cooldown and away clock follow the same rule is XD-Q01.

#### XD-52 · A pencil correction made offline
The correction is queued: no history row, prompt, Insight or passport. `lastPageSavedAt` is still set optimistically and never reverted, so the recap cooldown and the 48 h away clock reset locally. The replay later re-fires the completion purge if the page reaches the total.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:529,656-664`; [SES-77](02-reading-sessions.md#ses-77--what-an-offline-save-does-and-skips).
- **Target:** the replay goes through `save_progress` with its original occurred time and runs the full pipeline (D-08 · BC-04).

#### XD-53 · Metadata edits leave derived artefacts frozen
Editing title, author, genre, cover, ISBN or description patches only `books`. Derived AI artefacts are never regenerated or flagged: the passport summary, Insights, recaps and the DNA input built from old titles. Lexicon entries are unaffected ([LEX-97](05-codex-lexicon.md#lex-97--book-edit)). Invalidation follows XD-50.
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:376-411`.
- **Note:** decision [LIB-Q17](01-library.md) / REC-Q16 / INS-Q12 (recommended: leave frozen).

### Delete account

#### XD-54 · No account deletion exists today
No client path, edge function or RPC deletes an account. Data export, password reset and password change are also missing. This blocks App Store Guideline 5.1.1(v) and GDPR erasure. ⚠ XD-D26
- **Enforced:** none.
- **Source:** grep over `src/` (no `deleteUser`, `resetPasswordForEmail`, `updateUser`); [PLT-72](08-platform-auth-account.md#plt-72--no-account-deletion-export-reset-or-credential-change-exists).

#### XD-55 · What an `auth.users` delete cascades today (dashboard only)
Every user-owned public table cascades: 26 tables, 24 directly and 2 through `community_profiles`. That includes:
- `books` and the whole XD-04 chain;
- `reading_dna`, `reading_goals`, `reading_quest_events`, `achievements`, `anki_review_sessions`, `user_settings`;
- `community_profiles` → `community_profile_privacy` and `community_follow_counts`;
- `follows` and `blocks` on either side (the counter triggers decrement the other user);
- circle invitations on both sides, memberships and authored reactions;
- `reading_circles` where the user is `owner_id` **or** `created_by`, which deletes the whole circle for everyone.

Storage objects under `recap-images/{uid}/` and `community-avatars/{uid}/` survive, and `storage.protect_delete` blocks SQL deletes. ⚠ XD-D26
- **Enforced:** `server:db` (`*_user_id_fkey` CASCADE).
- **Source:** live `pg_constraint`; [PLT-73](08-platform-auth-account.md#plt-73--deleting-the-auth-user-cascades-every-user-table), [PLT-74](08-platform-auth-account.md#plt-74--storage-objects-are-not-cascaded), [BE-73](09-database-invariants.md#be-73--deleting-a-user), [CAP-45](04-capture-resume-quiz.md#cap-45--book-and-account-deletion), [INS-34](06-insights.md#ins-34--account-delete-cascade), [PRO-105](07-profile-stats-goals.md#pro-105--account-deletion-and-profile-data).

#### XD-56 · Target: immediate hard delete through `delete-account`
Not implemented. Decided flow:
- **Where:** web and iOS, from Settings.
- **Confirmation copy** lists what is deleted, including any (dormant) circles the user owns.
- **Re-auth:** the client re-authenticates first (password, fresh Sign in with Apple credential, or OTP). The function requires the newest authentication timestamp in the token's `amr` claim to be within the last 5 minutes (`iat` is not enough, because every silent token refresh resets it) and otherwise returns `401 {"error":"reauth_required"}`.
- **Call:** `POST delete-account` with `{"confirm":"DELETE"}`, `verify_jwt = true` + `requireUser`.

Steps:
1. List and remove `recap-images/{uid}/` and `community-avatars/{uid}/` through the Storage API (paginated, service role). If this fails, abort **before** deleting the user, so a retry is safe.
2. If an Apple identity exists, revoke its token with Apple.
3. `auth.admin.deleteUser(uid)` (hard delete); the FK cascades remove every row (XD-55).
4. Return `{"deleted": true}`.

It is idempotent: an already-deleted user gets 200. A failed `deleteUser` returns a retryable 500. After success the client wipes all local state (XD-42 note) and returns to the auth screen.
- **Enforced:** `server:edge` (planned).
- **Source:** [consolidation plan BC-11](../backend-consolidation-plan.md#bc-11--account-lifecycle--auth).
- **Target:** as above (D-10 · D-11 · BC-11). Edge cases (re-auth window, Apple revocation failure, owned circles with other members) are PLT-Q16.

#### XD-57 · Completeness invariant for account deletion
To keep D-10 complete, every table added in Phase 0 that stores a `user_id` must either FK `auth.users ON DELETE CASCADE` or be purged by `delete-account`. Affected tables include `progress_write_requests`, `background_jobs`, `entitlements`, `ai_usage` and `device_tokens`. New columns on existing tables (for example `user_settings.time_zone` and `ai_consent_at`) are already covered by those tables' cascade. The exception is `private.storage_cleanup_queue` (BC-13), which deliberately has no user FK so that cleanup entries survive the cascade.
- **Enforced:** none yet (planned `server:db`).
- **Source:** [consolidation plan BC-04, BC-05, BC-12, BC-13, BC-14](../backend-consolidation-plan.md#3-work-packages).
- **Target:** follows from D-10 (BC-11). Which ledgers may be retained is XD-Q05.
- **Note:**
  - **Other devices (derived, not tested).** After `deleteUser`, other devices fail on their next token refresh and must treat that as a sign-out with a full wipe. Until their access token expires (≤ 3600 s), reads return nothing and inserts fail with 23503 on `user_id`.
  - **Offline queue.** Queued saves for the deleted user must be dropped, not replayed.

---

## Flows

### F-1 · Per-book lifecycle (as the server sees it)

```
            add (no row) ───────────────────────────────► QUEUED (no reading_progress row)
            add "reading at p" (row p ∈ [1,total−1]) ─────► READING
            add "already finished" (row = total) ─────────► FINISHED   (path 4)
QUEUED ──save p>0 / start session (row page 0)──────────► READING / QUEUED-with-session
READING ──save p ≥ total (online | replay)──────────────► FINISHED   (paths 1–3; purge triggers)
READING ──total_pages edit ≤ current_page───────────────► FINISHED   (path 6; NO triggers)
FINISHED ──total_pages edit > current_page──────────────► READING    (captures/quiz already gone)
QUEUED|READING ──mark DNF───────────────────────────────► DNF (dnf_at set; session cleared; no history)
DNF ──resume───────────────────────────────────────────► status re-derived from pages (QUEUED | READING | FINISHED)
any ──delete book──────────────────────────────────────► (gone; FK cascade; Storage objects orphaned)
any ──delete user──────────────────────────────────────► (gone; FK cascade; Storage objects orphaned)
```

Persisted at each transition: see XD-04, XD-14, XD-25, XD-31, XD-47 and XD-55. The status shown is always `get_library_with_progress` precedence (XD-02).

### F-2 · An online completing save (paths 1–2): numbered effects

Effects E1…E19 run in this order. The **Target** column states the decided Phase 0 behaviour.

| # | Effect today | Owner rules | Target |
|---|---|---|---|
| E1 | **Progress row.** Upsert `current_page` only; `updated_at = now()` (the quest-year credit); purge triggers delete the captures, resumes and quiz | SES-30, XD-15 | `save_progress` transaction; `completed_at` stamped once; deferred `capture_purge` (BC-04, BC-05) |
| E2 | **History row.** Device-clock `recorded_at`; +10 XP, a streak/calendar day; first-finish fact for `booksFinished` / `fastestFinish` | SES-32, PRO-04 | Server clock; `kind`; D-08 counting (BC-04, BC-06) |
| E3 | **Session.** Un-awaited clear of the session columns; `velocity` invalidated | SES-30 | Same transaction; trigger clears the session on completion (BC-04) |
| E4 | **Local state.** Library entry → `finished`; the book leaves `inProgressBooks`, joins `completedBooks`; onboarding state can flip; Library "Completed" tab | XD-22 | Unchanged (render server status) |
| E5 | **SWR.** Invalidates `library`, `lastSession`, `readingStats`, `readingQuest:*`; misses `libraryBreakdown`, `readingRecords`, calendar/monthly, gallery | XD-24 | Close the gaps (client) |
| E6 | **Capture prompt.** `lastSessionEnded` emitted; Book Detail shows the field; a capture is inserted, earns +5 XP and is deleted (ghost client capture) | XD-16 | Suppressed by `effects.captureAllowed = false` (BC-04); CAP-Q02 |
| E7 | **Completion dialog.** "Finished: {title}" ("this book" if blank); "View Journey" / "Continue"; unrounded percentage vs the stored previous one | SES-41 | Driven by `completion.completedNow` |
| E8 | **Passport.** Fire-and-forget fetch → generate → upsert; no catch, no retry; also for imported books (button hidden) | XD-17 | Server row with frozen stats + `passport_summary` job (BC-05) |
| E9 | **Insight.** 90 % card when jumping from below 90 %; needs a master recap | XD-18 | Server evaluation, fallback, backfill (BC-08) |
| E10 | **Recap.** "Get Recap" hidden at ≥ 100 %; a complete book is never the hero; history and images kept | REC-64 | Unchanged (REC-Q07) |
| E11 | **Memory Check / Resume.** Chip hidden; quiz deleted server-side but `quizByBook` keeps it; resumes gone with the captures | CAP-42 | Client purges local copies |
| E12 | **Session controls.** Start, pencil, End Session, Focus and DNF hidden; only a `total_pages` edit leads back; offline completion can leave a zombie | XD-21, XD-22 | Zombie impossible (trigger) |
| E13 | **Up Next.** Unaffected (0 %-only queue); `up_next_order` row never removed | SES-43 | LIB-Q03 / SES-Q14 |
| E14 | **XP / quest.** +25 XP (manual only), pages clamped, new level/status on the next quest read | XD-19 | Quest by `completed_at` in the reader's local year (BC-04, BC-06) |
| E15 | **Achievements.** Not evaluated; Trophy Room mount stamps `earned_at` | XD-20 | Server evaluation (BC-09) |
| E16 | **Reading DNA.** Next Profile mount; blocks first paint | XD-20 | Eligibility + `dna` job (BC-05) |
| E17 | **Lexicon.** Unchanged; words stay in review and WotD | LEX-94 | Unchanged |
| E18 | **Community.** Leaves "also reading" / `currentlyReading`; nothing deleted | COM-97 | Unchanged (dormant) |
| E19 | **Book Lengths card.** Updates immediately from the progress store | PRO-43 | Unchanged |

**Failure paths (today):**
- **Upsert fails (E1):** the client rolls back its optimistic state and the error is shown. Nothing else runs.
- **History insert fails (E2):** swallowed. The page is saved and the session is still cleared, but no prompt appears and the session is lost from stats.
- **Session clear fails (E3):** the server keeps an active session on a now-complete book (a zombie).
- **Passport (E8) or Insight (E9) fails:** nothing is persisted and nothing is retried.

**Offline (path 3):**
- local optimistic state is kept, the save is queued and the completion prompt shows;
- E2, E3, E6, E8 and E9 never run;
- E1 runs at drain time, with the quest credited to the drain date.

**Target:** one `save_progress` transaction does E1–E3. The response carries `completion` and `effects`, and BC-05 jobs do E8, E9, E15 and E16 for every path. A failed AI job is retried, and its final state is `summary_status = 'failed'`, never a permanent "being generated".

### F-3 · Delete a book

1. Swipe → Delete → confirm (XD-03). Cancel writes nothing.
2. `DELETE books WHERE id` (one request, no retry on a network error).
   - **Error:** toast "Remove failed"; local state untouched.
   - **0 rows matched:** treated as success.
3. The server cascade runs (XD-04). Survivors: XD-05 and XD-06.
4. The client filters `books` and `libraryEntries`, removes the progress entry and invalidates its keys (XD-08). Leftovers: XD-09 and XD-10.
5. In-flight AI calls finish against a missing book (XD-11).

**Target sequence:**
1. One server call.
2. Jobs cascade, and `process-jobs` re-checks existence before any AI call or write.
3. A recap-delete trigger enqueues Storage cleanup, and the objects are gone within 5 minutes (BC-13).
4. A tombstone is written for delta sync (BC-14).
5. Every client then:
   - purges the per-book artefacts (XD-09);
   - cancels the book's tasks;
   - drops queued operations for the book;
   - ends any Live Activity and reloads widgets;
   - invalidates stats, quest, last session, records, velocity, lore and gallery.

### F-4 · DNF shelve and resume

```
not complete & not DNF ──"Shelve this book"──► confirm ──Shelve it──► upsert {current_page: local??0, dnf_at, session null}
                                   │                                     ├─ ok: status dnf; excluded everywhere client-side (XD-26)
                                   └─ Keep reading: nothing              └─ error: "Could not shelve the book. Try again."
DNF ──"Start reading again" | DNF list "Resume"──► update {dnf_at: null} (.single())
                                                    ├─ ok: status re-derived (XD-31)
                                                    └─ error / no row: "Could not resume the book. Try again."
```

Persisted: only `reading_progress` (`dnf_at`, the session columns, and today `current_page` on shelve). No history row. `updated_at` is bumped both ways. **Target:** `mark_dnf` and `resume_dnf` RPCs on the server clock, never touching `current_page` (BC-04).

### F-5 · CSV import

```
idle ──file──► offline? ──yes──► error "You are offline. Reconnect to import your library." (nothing parsed)
               └─no──► parsing ──unrecognised──► error (no writes)
                       └─► importing: dedupe (seed = in-memory books) → books INSERT ×100/chunk
                              ├─ chunk error ─► error (earlier chunks persisted; NO status writes) ⚠ XD-D14
                              └─► status upserts (read → total, DNF → 0 + dnf_at) → invalidate → fetchLibraryWithProgress
                                   └─► enriching (3 parallel, 150 ms gaps; updateBook per hit; may demote "read" books) ──► done
```

Persisted by step:
- **importing:** `books` rows;
- **status upserts:** `reading_progress` rows for read and DNF books;
- **enriching:** cover, genre and `total_pages` updates on `books`.

Nothing is written to history or to the AI tables. Enrichment keeps running after the dialog unmounts. **Target:** quiet import writes are tagged `import`, and the `books` trigger keeps completed books complete (BC-04 · BC-05); recommended: the BC-15 `import_library` RPC.

### F-6 · Sign-out and user switch

**Today:**
1. More → "Sign out".
2. `signOut()` (global scope).
   - **Network error:** the promise rejects, the user stays signed in, and no feedback is shown.
3. `onAuthStateChange` runs `clearAll()` (SWR only) and removes the snapshot.
4. `/login`.
5. The next user signs in: SWR refetches everything, and the leftovers of XD-42 leak (XD-43, XD-44).

**Required client sequence (every client):**
1. Before signing out, flush or explicitly discard this user's queued operations (PLT-Q01).
2. Cancel in-flight per-user tasks.
3. Sign out (on a network failure, sign out locally anyway; recommended in PLT-Q01).
4. Wipe every per-user cache, store, singleton and the queue.
5. Native: end Live Activities, reload widgets with an empty state, and remove the user's local notifications and Spotlight items.
6. Route to the auth screen.

### F-7 · `total_pages` edit and pencil correction

**`total_pages` edit:** `updateBook`.
- **Error:** an unhandled rejection; the dialog stays open and its fields may revert (LIB-65).
- **Success:**
  - status re-derived on the next library read: silent finish (XD-48) or un-finish (XD-49);
  - partial invalidation and a stale local percentage (XD-50).
- **Target:** the `books` trigger evaluates completion (BC-05).

**Pencil:** sheet (edit mode) → validate → clamp → `updateProgress`. The online path is XD-51; offline is XD-52.

### F-8 · Delete account (target, D-10)

```
Settings ─► "Delete account" ─► confirmation (lists data, owned circles) ─► re-auth (password | Apple | OTP)
   ─► POST delete-account {"confirm":"DELETE"}
        ├─ 401 reauth_required ─► re-auth again
        ├─ storage purge fails ─► 5xx, user NOT deleted ─► retry is safe
        ├─ Apple revoke ─► (failure handling: PLT-Q16)
        ├─ deleteUser fails ─► retryable 500
        └─ 200 {"deleted":true} (or 200 when already deleted) ─► full local wipe ─► auth screen
other devices: next token refresh fails ─► treat as sign-out + full wipe
```

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| Completion predicate | `total_pages > 0 AND current_page ≥ total_pages` | Purge-trigger and status condition | live triggers; `get_library_with_progress` |
| Client completion event | `prevPct < 100 ≤ newPct` | Passport and Insight trigger on an online save | `src/stores/progress.ts:617` |
| Insight milestone cap | 90 | 100 % never unlocks an Insight | `src/utils/milestoneDetect.ts:21-43` |
| XP per completed manual book | +25 | Lost on delete or un-finish | live `get_reading_quest_summary` |
| XP per history row / recap / lore card / captured page | +10 / +20 / +15 / +5 | Only the +5 survives a book delete | live `get_reading_quest_summary` |
| Import chunk size | 100 rows | Insert and status-upsert chunks | `src/stores/books.ts:253` |
| Import placeholder page count | 100 | When the CSV has no page count; `page_count_estimated = true` | `src/stores/books.ts:254` |
| Enrichment concurrency / gap | 3 / 150 ms | Per batch; ≤ 5 external calls per book | `src/composables/useLibraryImport.ts:14-15` |
| SWR TTL `lastSession` | 30 s | Last Session card can show a deleted book this long | `src/composables/useLastSession.ts:40` |
| SWR TTL `readingStats`, `libraryBreakdown`, `readingRecords`, lore | 120 s | Staleness after delete, completion or DNF | `src/composables/useReadingRecords.ts:19`; `src/stores/loreCards.ts:19` |
| SWR TTL `velocity` | 365 days | Invalidated only by a session end, add or import | `src/composables/useReadingVelocity.ts:25` |
| Gallery signed-URL lifetime | 3 600 s | Deleted books' images keep rendering | `src/composables/useRecapGallery.ts:12` |
| Recap idle grant / cooldown | 72 h / 6 h | Reset by DNF and resume (`updated_at`) / started by a pencil save | `src/composables/useRecapLock.ts:6-8` |
| Memory Check away threshold | 48 h | Reset by any history-producing save | `src/composables/useBookQuiz.ts:28` |
| DNA thresholds | 2 books / Δ2 books / 90 days | Imports and DNF-at-100 % count | `src/stores/readingDna.ts:21-22` |
| Access-token lifetime | 3 600 s | Window after account deletion on other devices | DB GUC `app.settings.jwt_exp` |
| Target: deferred capture purge | ≤ 24 h after completion | BC-05 privacy invariant | consolidation plan BC-05 |
| Target: Storage cleanup after a delete | ≤ 5 min | BC-13 acceptance 13-1 | consolidation plan BC-13 |
| Target: offline replay window | 30 days back, +5 min skew | `save_progress` occurred-time acceptance (OP-04.5) | consolidation plan BC-04 |
| Target: delete-account re-auth window | 5 min (newest `amr` authentication, not `iat`) | Else `401 reauth_required` | consolidation plan BC-11 |

---

## Data touchpoints

| Object | Read / write | By whom (today → target) | Contract |
|---|---|---|---|
| `books` | delete; update (`total_pages`, metadata); insert (import) | PWA direct → PWA/iOS; trigger `a10_books_lifecycle` (BC-05); tombstones (BC-14) | [§3](../backend-contract.md#3-tables), [§4](../backend-contract.md#4-cascades--lifecycle-effects) |
| `reading_progress` | upsert (save, start, DNF, import, replay); update (resume, clear) | PWA direct → BC-04 RPCs only | [§4](../backend-contract.md#4-cascades--lifecycle-effects) |
| `progress_history` | insert on online saves only | PWA direct → `save_progress` | [§3](../backend-contract.md#3-tables) |
| `page_captures`, `book_quizzes` | deleted by completion triggers | DB trigger → deferred `capture_purge` job | [§9](../backend-contract.md#9-triggers--internal-functions) |
| `reading_quest_events` | upsert by capture trigger; detached on delete | DB trigger | [§9](../backend-contract.md#9-triggers--internal-functions) |
| `book_passports`, `lore_cards`, `reading_dna`, `achievements` | inserted or upserted after completion | PWA client → BC-05/BC-08/BC-09 server | [§3](../backend-contract.md#3-tables) |
| `recaps` + `recap-images` Storage | cascade-deleted rows; orphaned objects | none → BC-13 cleanup queue | [§7](../backend-contract.md#7-storage) |
| IndexedDB `chronicler-offline/progress_queue` | enqueue; drain | PWA → user-scoped, replays via `save_progress` | [08 · Platform](08-platform-auth-account.md) |
| `auth.users` | delete | dashboard only → `delete-account` (BC-11) | [§4](../backend-contract.md#4-cascades--lifecycle-effects), [§10](../backend-contract.md#10-edge-functions) |

---

## Client-side logic & server migration

| Rule a client implements today | Rules | Moves server-side under | Stays client-side |
|---|---|---|---|
| Completion event detection (`prevPct < 100 ≤ newPct`) and the effect list of F-2 | XD-13, XD-14 | BC-04 (`completion.completedNow`), BC-05 (effects) | Prompt copy, hero rotation |
| Passport generation and stats refresh | XD-17 | BC-05 | Rendering `summary_status` |
| Insight milestone detection at completion and on pencil saves | XD-18, XD-51 | BC-08 | "New Insight" chip, banner |
| Achievement and DNA evaluation after lifecycle events | XD-20 | BC-09, BC-05 | Trophy rendering, `request_dna_refresh` call |
| Session end on completion / DNF | XD-21, XD-25 | BC-04 trigger and `mark_dnf` | — |
| DNF and complete guards on session start and save | XD-26 | BC-04 typed errors | UI hiding |
| Never send `current_page` with session or DNF writes | XD-25 | BC-04 RPCs make it impossible | — |
| Completion re-evaluation after a `total_pages` edit | XD-48, XD-49 | BC-05 `a10_books_lifecycle` | — |
| Import quiet-write contract (no history, no AI effects) | XD-34, XD-35 | BC-04/BC-05 `write_source = 'import'`; BC-15 RPC (recommended) | CSV parsing |
| Import dedupe | XD-39 | BC-15 (recommended) | — |
| Capture prompt suppression on the completing save | XD-16 | BC-04 `effects.captureAllowed` | Reading the flag |
| Storage cleanup on book and account delete | XD-06, XD-56 | BC-13, BC-11 | — |
| Per-book purge of local artefacts and task cancellation on delete | XD-08…XD-11 | — | **Stays client** (each client's own caches) |
| Full per-user wipe on identity change; queue scoped per user | XD-42, XD-43 | Queue replay semantics via BC-04 | **Stays client** |
| Percentage derived at use time | XD-02 | — | **Stays client** |
| Mutation → invalidation matrix (see below) | XD-08, XD-24, XD-32, XD-40, XD-50, XD-51 | Realtime or delta sync helps (BC-14, recommended) | **Stays client** |

---

## Caching & offline

**Invalidation per lifecycle event (web today).** ✔ = invalidated or touched; ✘ = **gap** that every client must close; — = not applicable.

| Event | `progress` | `library` | `libraryBreakdown` | `readingStats` | `readingQuest:*` | `lastSession` | `readingRecords` | `velocity` | lore / gallery / quiz / captures | calendar & monthly |
|---|---|---|---|---|---|---|---|---|---|---|
| Delete book | ✔ | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Online completing save | ✔ (touch) | ✔ | ✘ | ✔ | ✔ | ✔ | ✘ | ✔ only if a session was active | ✘ | ✘ |
| Pencil save (online) | ✔ (touch) | ✔ | ✘ | ✔ | ✔ | ✔ | ✘ | ✘ | — | ✘ |
| Mark DNF / resume | ✔ (touch) | ✔ | ✘ | ✘ | ✘ | ✘ | — | ✘ | — | — |
| CSV import | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | — | — |
| Enrichment / `total_pages` edit | ✘ (stale % survives refetch) | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ | — | ✘ |
| Offline replay (drain) | — | — | — | — | — | — | — | — | — | — |
| Sign-out / user switch | SWR metadata cleared; stores and singletons **not** (XD-42) | | | | | | | | | |

**Offline behaviour per scenario:**

| Scenario | Offline today | Target |
|---|---|---|
| Delete a book | DELETE fails; toast "Remove failed" | Online-only (LIB-115); queue nothing |
| Complete (save) | Queued; prompt shown; no history, passport, Insight or session end; purge and quest credit at drain | Replay via `save_progress` at the occurred time; full pipeline (BC-04, BC-05) |
| DNF / resume | Request fails with an error | Online-only (`mark_dnf` / `resume_dnf`) |
| CSV import | Blocked up front | Unchanged |
| Pencil edit | Queued, like a save | As "Complete (save)" |
| Sign-out | `signOut` rejects; still signed in, no feedback | Sign out locally; handle the queue per PLT-Q01 |
| Delete account | Not available | Online-only; never queued |

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| XD-D01 | Book delete orphans `recap-images` objects (3 live); the confirm promises "all its data" (XD-06) | Data left behind; GDPR and App Store data-deletion expectations | BC-13 cleanup queue + orphan sweep |
| XD-D02 | After a delete, stats, last-session, records, velocity, lore, `recaps:all`, calendar and monthly caches are not invalidated; stores and singletons keep the book (gallery, Codex "All Books" lore, WotD, captures, quiz, Codex results) (XD-08, XD-09) | Ghost data in UI; tapping a gallery image opens a deleted book | Client per-book purge matrix; BC-14 `deletedBookIds` (recommended) |
| XD-D03 | Queued offline saves for a deleted book fail on the FK forever (XD-10) | Endless retries; queue never empties | Drop on `book_not_found` via BC-04 replay; drop queued ops on delete |
| XD-D04 | In-flight AI work for a deleted book is billed, then fails with 23503 or uploads an orphan image (XD-11) | Wasted AI spend; orphaned Storage | BC-05 job cascade + existence re-check; BC-13 image-job check; client task cancellation |
| XD-D05 | Book delete deletes an anchored reading circle for all members (XD-12) | None today (dormant); would destroy other users' data | Decide BE-Q07 before the Community phase |
| XD-D06 | Six completion paths fire different effects: no passport offline, on add-as-finished or after a failed generation; "View Journey" dead end; quest credit tied to `updated_at`; no purge on a page-count edit (XD-14, XD-17, XD-19) | Inconsistent journeys, XP and quest numbers across paths and clients | BC-04 `completed_at` + BC-05 single owner |
| XD-D07 | The capture prompt is offered after a completing save; the capture is deleted in the same statement while +5 XP is recorded; ghost capture client-side (XD-16) | Lost user effort; XP for deleted content | BC-04 `effects.captureAllowed`; CAP-Q02 / OP-05.3 |
| XD-D08 | Completion and pencil saves miss `libraryBreakdown`, `readingRecords`, calendar/monthly (and `velocity` for pencil); `quizByBook` and `capturesByBook` keep purged items (XD-24, XD-51) | Stale stats and ghost captures until reload | Close the invalidation gaps; purge local captures/quiz on completion |
| XD-D09 | Achievements and DNA are not evaluated at completion; `earned_at` = visit time; DNA blocks Profile paint (XD-20) | Wrong badge dates; slow Profile; cross-device races | BC-09; BC-05 `dna` job + `request_dna_refresh` |
| XD-D10 | Offline, stale-device or page-count-edit completions leave a zombie session that no UI can cancel (XD-21) | Stale `sessionStartAt` in every client (Live Activities, widgets) | BC-04/BC-05 trigger clears the session on completion |
| XD-D11 | Shelving discards a running session without history and upserts the local `current_page` (rewind or 0) (XD-25) | Lost reading time; cross-device page rollback | BC-04 `mark_dnf`; XD-Q03 |
| XD-D12 | DNF is ignored by every server aggregate (XP, breakdown, velocity, public profile, also-reading), and the client `completedBooks` counts DNF-at-100 % (XD-27, XD-30) | Counts disagree between Library, Profile and the server | Decide XD-Q04, BE-Q04, PRO-Q01 |
| XD-D13 | DNF and resume don't invalidate `readingStats`, `libraryBreakdown`, `readingQuest:*`, `lastSession` or `velocity` (XD-32) | Stale stats after shelving or resuming | Client invalidation |
| XD-D14 | Import is not atomic: statuses are written after all chunks, so one bad chunk leaves read/DNF books queued forever (XD-34) | Wrong statuses that a re-import cannot repair | BC-15 `import_library` (recommended); interim: write statuses per chunk |
| XD-D15 | Enrichment raises `total_pages` on placeholder "read" books and demotes them to reading (XD-36) | Finished books reappear in progress and as hero | BC-05 `books` trigger keeps completed books complete (OP-05.4) |
| XD-D16 | Import dedupe is seeded from the in-memory library: empty on a cold `/books/add`, the previous user's after a switch (XD-39) | Whole library duplicated on re-import | Server dedupe (BC-15); at minimum fetch the library first |
| XD-D17 | Imported books completed in-app have a passport but "View Journey" stays hidden (XD-38) | Paid passport never reachable from Book Detail | BC-05 gate = "a passport row exists" |
| XD-D18 | Sign-out wipes only SWR metadata; stores, singletons, the queue and in-flight jobs survive; no reload (XD-42) | Previous user's data in memory; leaks below | Full per-user wipe on every client |
| XD-D19 | The offline queue is drained as the next user, creating orphan progress rows on another user's book (XD-43) | Cross-user writes; lost offline progress | BC-04 user-scoped replay; BC-01 child-table RLS book ownership |
| XD-D20 | Cross-user leaks after a switch: achievements cache never reloaded; Anki totals written into the new user's row; old lore in Codex; an in-flight Insight inserted for the new user against the old user's book (XD-44) | Wrong badges and counters; foreign rows | BC-09, BC-08, BC-01; BC-10 (recommended); client wipe + cancellation |
| XD-D21 | Sign-out offline fails silently and leaves the user signed in (XD-41) | User believes they signed out (shared devices) | Local sign-out on network failure (PLT-Q01) |
| XD-D22 | Lowering `total_pages` to ≤ `current_page` completes the book with no purge, history, passport or Insight, and credits XP and quest retroactively (XD-48) | Silent finish; dead-end passport; wrong yearly numbers | BC-05 `a10_books_lifecycle` (OP-05.4) |
| XD-D23 | Raising `total_pages` on a finished book un-completes it (−25 XP) after its captures were purged (XD-49) | Silent un-finish; lost capture corpus | OP-05.4: completed books stay complete |
| XD-D24 | After a `total_pages` edit the progress-map percentage stays stale even after a refetch; velocity, stats and records are not invalidated; the stale `prevPct` can drop an Insight milestone or misfire the completion prompt (XD-50) | Wrong bars and forecasts; missed Insights | Derive the percentage at use time; server detection (BC-04, BC-08); invalidate |
| XD-D25 | A backward pencil correction writes a history row: +10 XP, a streak day, the capture prompt, a 6 h recap cooldown and a reset 48 h away clock; backward-then-forward is re-counted (XD-51) | Inflated stats and XP; corrections block recaps | D-08 counting contract (BC-04, BC-06); XD-Q01 |
| XD-D26 | No account deletion anywhere; a dashboard deletion leaves both Storage prefixes (XD-54, XD-55) | App Store 5.1.1(v) blocker; GDPR erasure gap | BC-11 `delete-account` (D-10) |

---

## Open decisions

Decisions owned by this file (cross-domain). Questions answered by D-01…D-17 appear as **Target** lines in the rules and are not repeated.

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| XD-Q01 | **One "reading event" rule for the side effects D-08 does not settle.** Which saves raise the capture prompt, anchor the 6 h recap cooldown, reset the 48 h Memory Check away clock, and which writes move the 72 h idle clock / "last read"? Consolidates CAP-Q01, REC-Q01, REC-Q04, SES-Q11 and SES-Q15. | Any online save with a history row (including backward corrections and completing saves) raises the prompt, starts the cooldown and resets the away clock. Any `reading_progress` UPDATE (session start, pause, cancel, DNF, resume) resets the idle clock and reorders lists. | Use the BC-04 history `kind`. A **forward** page change (`session` or `update` with delta > 0) raises the prompt (unless `captureAllowed = false`), anchors the cooldown and resets the away clock. Backward and zero-delta corrections, session-only writes and DNF writes do none of these. Anchor the idle clock and "last read" on the last forward page change (a dedicated column), not on `updated_at`. |
| XD-Q02 | **Cross-device sync:** Realtime subscriptions or refresh-on-foreground? Covers a session started on the web showing on the iPhone, a recap image finishing, and a book deleted on another device. Same decision as PLT-Q12, BE-Q06 and OP-14.1. | `supabase_realtime` has no tables; the PWA's `recaps` channel is dead code; 2 s image polling with no cap; other devices see changes only on refetch. | v1: refresh on foreground and on pull-to-refresh, and purge local artefacts for any book missing from the refreshed library. Bounded polling for image status. Publish `recaps` and `reading_progress` when Live Activities need cross-device updates (BC-14). |
| XD-Q03 | **DNF while a session is running** (OP-04.4) | The session is discarded with no history; the reading time is lost. | When a session is active, the shelve confirm offers "Save page & shelve" (`save_progress`, then `mark_dnf`) and "Discard session & shelve". `mark_dnf` itself stays history-free. |
| XD-Q04 | **DNF vs completion precedence.** What is a DNF book whose page count is lowered to ≤ `current_page` (or that reaches the total any other way)? Related to BE-Q04, LIB-Q11 and PRO-Q01. | Library shows `dnf`; quest, XP, the purge triggers and `completedBooks` treat it as complete. | DNF wins everywhere: the BC-05 completion pipeline and `completed_at` run only while `dnf_at` is null; `resume_dnf` re-evaluates completion; every aggregate excludes DNF books from "finished". `mark_dnf` already rejects complete books. |
| XD-Q05 | **Which Phase-0 ledgers survive account deletion?** Covers `ai_usage`, `entitlements`, `background_jobs`, `progress_write_requests`, `device_tokens` and `private.storage_cleanup_queue`. | Not applicable (none exist; every current table cascades). | Everything keyed to the user cascades with `auth.users` (D-10), except `private.storage_cleanup_queue`, which must outlive the cascade. The App Store or RevenueCat stays the system of record for purchases. If AI cost reporting is needed after deletion, keep only anonymised daily totals without `user_id`. |

**Owned elsewhere** (cross-domain, decided in the owning file):

| Topic | Owner |
|---|---|
| Delete safeguards (active session, unsynced saves, AI job in flight, anchored circle) | [LIB-Q12](01-library.md) |
| Should a book delete lower XP and level? | [LIB-Q15](01-library.md) / PRO-Q18 |
| Keep a deleted book's lexicon words | LEX-Q20 |
| Page-count edits and completion direction | [LIB-Q04](01-library.md) / SES-Q05 / OP-05.4 |
| Re-read / un-complete flow | SES-Q04 |
| Capture on a complete book (reject vs +5 XP) | CAP-Q02 / PRO-Q17 / OP-05.3 |
| Purge timing vs the completion jobs | CAP-Q03 / OP-05.6 |
| Which quiet completions get a passport; "View Journey" gate | SES-Q06 / [LIB-Q09](01-library.md) / OP-05.2 |
| Canonical "books finished" (DNA, Profile, breakdown) | PRO-Q01 / OP-05.5 |
| Imports: counting after in-app reading, DNA input, completion dates | [LIB-Q16](01-library.md) / PRO-Q05 / [LIB-Q08](01-library.md) / OP-15.5 |
| Title and author edits vs AI artefacts | [LIB-Q17](01-library.md) / REC-Q16 / INS-Q12 |
| Sign-out scope and unsynced saves | PLT-Q01 / OP-11.2 |
| Multiple accounts on one device | PLT-Q11 |
| Account-deletion edge cases (re-auth window, Apple revocation failure, owned circles) | PLT-Q16 |
| Where Storage cleanup runs | BE-Q05 |
| DNF as a server-wide status | BE-Q04 |
| Circle cascade semantics | BE-Q07 |

---

## Notes for native clients

**Platform-agnostic (iOS now, Android later):**
- **Thin client.** Once BC-04/BC-05 ship, call `save_progress`, `mark_dnf`, `resume_dnf` and `start_session`, and render what the server returns. Do not re-implement completion effects, passports, Insights, achievements or DNA (D-06). Before they ship, mirror the PWA's exact effects for paths 1–2 (F-2), knowing paths 3–6 differ (XD-14).
- **Percentages.** Derive the percentage from `(current_page, total_pages)` at use time; never cache it separately (XD-02).
- **Writes that must not touch the page.** Session, pause, cancel and DNF writes never send `current_page` (XD-25).
- **Capture prompt on completion.** Suppress it on the completing save, using `effects.captureAllowed` once available. Until then, suppress it whenever the saved page reaches `total_pages` (XD-16).
- **Book delete.** Make one server call. On success:
  - purge every per-book artefact: lexicon, lore, recaps, gallery, passport, captures, quiz, the WotD pointer, search results;
  - drop queued operations for the book;
  - cancel the book's in-flight tasks;
  - invalidate stats, quest, last session, records, velocity and lore (XD-08…XD-11).
- **Foreground reconciliation.** On every library refresh, purge local artefacts for any book id that no longer exists. Treat a session on a complete or DNF book as stale (XD-21, XD-Q02).
- **User change.** On any user-id change, wipe all per-user state: caches, stores, singletons, the offline queue and in-flight tasks. Scope the offline queue by user id and never replay another user's records (XD-42, XD-43).
- **Account deletion.**
  - Implement the confirm → re-auth → `delete-account` flow and handle `reauth_required`.
  - After success, wipe locally and return to the auth screen.
  - On other devices, treat a failed token refresh after deletion as a sign-out (XD-56, XD-57).
- **Import (if shipped natively).** Use `import_library` when it exists. Otherwise replicate the quiet-write contract exactly, and never demote a completed import when its page count changes (XD-34…XD-36).

**iOS-specific (iOS 26+, iPhone first, D-04):**
- **Per-book tasks.** Keep a per-book registry of Swift `Task`s (recap stream, passport, capture follow-ups) and cancel them on delete, sign-out and account deletion. Under BC-07, the server finishes and saves a paid recap even if the app is backgrounded, so a cancelled client task only stops the UI stream.
- **System surfaces.**
  - On delete, completion, DNF and sign-out: end the book's Live Activity (`Activity.end`), call `WidgetCenter.shared.reloadAllTimelines()`, remove the book's pending local notifications, and remove its Spotlight items (`CSSearchableIndex.deleteSearchableItems`).
  - On sign-out and account deletion: do this for every book of the user.
- **Local data.** Keep the local store (for example SwiftData) per user, or wipe it entirely on a user change. Clear user-scoped Keychain items and App Group caches shared with widgets.
- **Confirmations.** Book delete uses `.swipeActions` with a `.destructive` role plus a confirmation dialog with the same copy (XD-03). "Delete account" lives in Settings and must be reachable in-app (App Store Guideline 5.1.1(v)). Liquid Glass sheets follow D-04 and respect Reduce Transparency.
- **Sign in with Apple accounts.** Token revocation happens server-side in `delete-account` (D-11); the client only supplies a fresh Apple credential for re-auth.
