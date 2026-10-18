# 01 · Library & Books — Business Rules
> **Prefix:** LIB · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-19 (BC-01 and BC-02 shipped)

## Overview

This area covers how books get into a reader's library and how the library is shown and maintained:

- **Add paths:** Google Books search → details page, ISBN barcode scan, typed ISBN, manual form, Goodreads/StoryGraph CSV import (spec 034).
- **Maintenance:** edit metadata, hard delete (server cascade), the Up Next queue order, the DNF ("Did Not Finish") shelf.
- **Views:** Library list and grid, client-side library search, finish-date forecast on reading cards.
- **Ebooks (spec 033):** "Upload image" in the page-capture prompt. There is no per-book format.

Reading sessions, page saves and completion effects belong to [02 · Reading sessions](02-reading-sessions.md). This file states how they show up in the library. Product name: **The Chronicler**; "BookHero" is the internal code name (D-03).

| Web route (name) | Page / surface | Purpose |
|---|---|---|
| `/library` (`library`) | `src/pages/LibraryPage.vue` | List/grid views, sticky search, queue reorder, swipe Edit/Delete (touch only), header DNF icon |
| `/library/dnf` (`library-dnf`) | `src/pages/DnfListPage.vue` | DNF shelf with per-row Resume |
| `/books/add` (`add-book`) | `src/pages/AddBookPage.vue` | Add hub: Scan ISBN, Add Manually, Google Books search, "Import from Goodreads or StoryGraph" |
| `/books/add/details/:source/:key(.*)` (`add-book-details`) | `src/pages/BookSearchDetailPage.vue` | Search-result detail: duplicate notice, description, recommendations, "Edit details", initial status, "Add to Library" |
| `/books/:id` (`book-detail`) | `src/pages/BookDetailPage.vue` | DNF shelve/resume, description backfill, "View Reading Journey" gate (other panels belong to 02–06) |
| `/books/:id/passport` (`book-passport`) | `src/pages/BookPassportPage.vue` | Opened from "View Reading Journey" (passport rules: [02](02-reading-sessions.md)) |
| modal `BookEditDialog` | `src/components/books/BookEditDialog.vue` | Edit metadata (from swipe → Edit) |
| modal `LibraryImportDialog` | `src/components/import/LibraryImportDialog.vue` | CSV import (from Add hub and the Dashboard empty state) |
| Dashboard Up Next shelf | `src/pages/DashboardPage.vue` | Queue preview and hero swap (owned by [02](02-reading-sessions.md)) |

**Backend objects** (names only; shapes live in [backend contract](../backend-contract.md) §3 Tables, §8 RPC catalogue, §9 Triggers):

- **Tables:** `books`, `up_next_order`, and `reading_progress` (shared with 02).
- **RPCs:** `get_library_with_progress`, `get_reading_velocity`. Consumers of library data: `get_library_breakdown` and `get_reading_quest_summary` ([07](07-profile-stats-goals.md)).
- **Internal:** `normalize_isbn`. Triggers on `reading_progress`: `reading_progress_updated_at`, `page_captures_delete_on_completion`, `book_quizzes_delete_on_completion`. `books` has **no triggers**.
- **Edge functions:** none. The ebook upload reuses `ocr-page` ([04](04-capture-resume-quiz.md)).
- **External APIs:** Google Books v1 and the Open Library Books API, called directly by the client ([backend contract](../backend-contract.md) §11).
- **Storage:** nothing written. `recap-images/{uid}/{recapId}.png` objects are orphaned when a book is deleted.

---

## Rules

### Book record & validation

#### LIB-01 · One owner per book
Every `books` row belongs to exactly one user. `user_id` is NOT NULL with FK → `auth.users(id) ON DELETE CASCADE`. The single RLS policy "Users can manage their own books" is `ALL` with `auth.uid() = user_id` in both USING and WITH CHECK.
- **Enforced:** `server:db` (`books_user_id_fkey`, RLS policy on `books`)
- **Source:** live `pg_constraint`, `pg_policies`; `supabase/reference/live-baseline-2026-10-18.sql`
- **Note:** Deleting the auth user deletes every book and, through LIB-88, every per-book row ([08](08-platform-auth-account.md), D-10).

#### LIB-02 · Title and author length
`title` must be 1–500 characters and `author` 1–200 (DB CHECK on `char_length`). The web form only checks non-empty after `trim()` and sets no maximum. An over-long value is rejected by the database, and the form shows the generic "Failed to save book" (LIB-110). ⚠ LIB-D03
- **Enforced:** `server:db` (`books_title_check`, `books_author_check`); `client` (non-empty only: `src/components/books/BookForm.vue:63-64`)
- **Source:** live constraints; `src/pages/AddBookPage.vue:84-86`; `src/pages/BookSearchDetailPage.vue:162-164`
- **Note:** Every client should trim first and enforce the same maximums before writing.

#### LIB-03 · Page count
`total_pages` is NOT NULL and must be ≥ 1, with no upper bound. The form rejects an empty value or < 1 ("Enter a valid page count"). Its InputNumber limits input to 1–99,999.
- **Enforced:** `server:db` (`books_total_pages_check`); `client` (`src/components/books/BookForm.vue:65,127-135`)
- **Source:** live constraint

#### LIB-04 · ISBN storage format
`isbn` is nullable. When present it must match `^\d{9}[\dX]$|^\d{13}$`: 10 characters (9 digits plus a digit or **uppercase** X) or 13 digits. Hyphens, spaces and lowercase `x` are rejected. Nothing validates a checksum, and nothing converts ISBN-10 ↔ 13. ⚠ LIB-D02
- **Enforced:** `server:db` (`books_isbn_check`)
- **Source:** live constraint; no checksum or conversion code anywhere in `src/`
- **Target:** Before insert/update, normalise (strip hyphens/spaces, uppercase X), validate the checksum, and convert ISBN-10 → 13 server-side (e.g. a BEFORE INSERT/UPDATE trigger on `books`, or inside the add/import RPC), so existing PWA builds stop failing on hyphenated input (D-05 · BC-15, recommended).

#### LIB-05 · Client ISBN normalisation (form)
`BookForm` emits `isbn.trim().toUpperCase()`, with an empty value → `null`. Hyphens and spaces are **not** stripped, so `978-0-261-10235-4` reaches the database and fails LIB-04. ⚠ LIB-D02
- **Enforced:** `client` (`src/components/books/BookForm.vue:87`)
- **Source:** `src/components/books/BookForm.vue:79-91`
- **Target:** The server normalises (LIB-04). Clients still strip `[^0-9Xx]`, uppercase, and check length 10/13 plus the checksum before sending, so they can show a field error (BC-15, recommended).

#### LIB-06 · Form fields
Required: Title, Author, Total Pages. Optional: Genre, ISBN, Cover URL, and Description. Description is shown only when `showDescription` is set, which only the search-details editor does.
- **Enforced:** `client` (`src/components/books/BookForm.vue:61-76,175-215`)
- **Source:** same

#### LIB-07 · Blank genre persists as an empty string
The form's `genre` defaults to `''`. The prefill watcher keeps `''` when the incoming genre is `null` (`val.genre ?? genre.value`). As a result, a manual add, a save from the edit dialog, or "Edit details → Done" on the search-details page can write `genre = ''` instead of `NULL`. Genre is never trimmed. Cards hide an empty genre, and `get_library_breakdown` maps blank to "Uncategorized" via `nullif(trim(genre),'')`. The live DB currently holds 0 rows with `genre = ''`, so the leak is latent. ⚠ LIB-D07
- **Enforced:** `client` (`src/components/books/BookForm.vue:35,50-59,84`; `src/components/books/BookEditDialog.vue:24-31`; `src/pages/BookSearchDetailPage.vue:103-124`)
- **Source:** + live `get_library_breakdown`
- **Note:** Clients must send `NULL` for blank genre, cover and description.

#### LIB-08 · `source`
`source` is NOT NULL, default `'manual'`, with **no CHECK** on its values. It is written as `'manual'` (the default) by every interactive add path, because `addBook` never sends `source`, and as `'goodreads'` / `'storygraph'` by CSV import. "Imported" means `source <> 'manual'`. No path ever changes `source` after insert.
- **Enforced:** `server:db` (column default); `client` (`src/stores/books.ts:188-199,310`)
- **Source:** live column; `src/types/index.ts:16`
- **Note:** `source` drives quest/XP exclusion (LIB-85) and the journey gate (LIB-86). An imported book the reader later finishes in-app stays "imported".

#### LIB-09 · `page_count_estimated`
NOT NULL, default `false`. It is `true` only for imported rows that had no usable page count (placeholder 100, LIB-66). It is cleared to `false` by the **client** whenever `updateBook` receives `totalPages` (user edit or enrichment). No DB trigger does this.
- **Enforced:** `client` (`src/stores/books.ts:299-311,388-392`)
- **Source:** same; live (no trigger on `books`)

#### LIB-10 · Who writes `description`
`description` (nullable plain text) is written by search-and-add, by the details page "Edit details" editor, and by the Book Detail backfill (LIB-42). It is never written by manual/scan add (`useIsbn` always returns `description: null`), by `BookEditDialog`, or by import (always `null`).
- **Enforced:** `client`
- **Source:** `src/stores/books.ts:198,309`; `src/composables/useIsbn.ts:26,54`; `src/components/books/BookEditDialog.vue:24-31`

#### LIB-11 · Cover URL
`cover_url` is a hot-linked external URL and is never copied to Supabase Storage. Users may paste any URL, and nothing validates or trims it. Clearing the field in the edit dialog saves `cover_url = ''` rather than `NULL`. Every `v-if="coverUrl"` treats `''` as "no cover". ⚠ LIB-D07
- **Enforced:** `client` (`src/components/books/BookForm.vue:37,86,207-215`; `src/components/books/BookEditDialog.vue:29`)
- **Source:** same

#### LIB-12 · No uniqueness
Nothing stops a user from holding duplicate books by title or ISBN. `books_normalized_isbn_user_idx` on `(normalize_isbn(isbn), user_id, id)` (partial, `isbn IS NOT NULL`) is **non-unique** and serves community matching only. Duplicate handling is client-side (LIB-24, LIB-75).
- **Enforced:** none (`server:db` has no unique index)
- **Source:** live `pg_indexes`
- **Note:** Policy is open: LIB-Q02.

#### LIB-117 · `normalize_isbn` semantics
`normalize_isbn(p)` = `nullif(upper(regexp_replace(coalesce(p,''), '[^0-9X]', '', 'g')), '')` (IMMUTABLE). Because the regex runs **before** `upper`, a lowercase `x` is deleted rather than kept. It is used only by community/circle functions (`circle_book_matches`, `get_also_reading_for_book`) and by the functional index in LIB-12. No client calls it. ⚠ LIB-D32
- **Enforced:** `server:db` (function `normalize_isbn`)
- **Source:** live `pg_get_functiondef`
- **Target:** One shared normalisation (uppercase first, then strip) used by the insert path and by `normalize_isbn` (BC-15, recommended).

### Add paths & initial status

#### LIB-13 · Initial status options
`InitialBookStatus` has three values:
- `queued`: "Want to read" (the default).
- `currentlyReading`: "Reading now".
- `completed`: "Already finished" in `BookForm`, "Finished" in `LibraryStatusSelector` (search-details page).
- **Enforced:** `client`
- **Source:** `src/types/index.ts:65`; `src/components/books/BookForm.vue:39-45`; `src/components/books/LibraryStatusSelector.vue:12-16`

#### LIB-14 · "Reading now" page bound (form)
`currentlyReading` requires a current page in `[1, totalPages − 1]`. The error is "Enter a page between 1 and {max}". When `totalPages = 1` the error is "Use Already finished for one-page books".
- **Enforced:** `client` (`src/components/books/BookForm.vue:66-73`)
- **Source:** same

#### LIB-15 · "Reading now" page bound (search details)
The details page validates against `maxCurrentPage = max(1, totalPages − 1)`, so a 1-page book accepts page 1 ("Enter a current page between 1 and 1."). LIB-16 then stores it as finished. This is inconsistent with LIB-14. ⚠ LIB-D06
- **Enforced:** `client` (`src/pages/BookSearchDetailPage.vue:43,129-134`)
- **Source:** same

#### LIB-16 · Initial page written
`normalizeInitialPage` sets:
- `queued` → 0, and **no `reading_progress` row** is written;
- `completed` → `totalPages`;
- `currentlyReading` → `max(1, min(currentPage ?? 1, max(0, totalPages − 1)))`.
- **Enforced:** `client` (`src/stores/books.ts:214-221,230-234`)
- **Source:** same
- **Target:** The initial status is written through a server RPC that never trusts a client page outside `[0, total_pages]` (BC-04).

#### LIB-17 · Initial progress write is quiet
`setInitialProgress` upserts `reading_progress {book_id, user_id, current_page = clamp(page, 0, totalPages), session_start_at: null}` with `onConflict: 'book_id,user_id'`. It deliberately bypasses `updateProgress`, so it produces no `progress_history` row, session-ended event, capture prompt, lore, recap or passport. The completion triggers do fire on this INSERT; they are a no-op for a new book. With no baseline history row, the first real session after adding at page N counts the N starting pages as read in stats. ⚠ LIB-D34
- **Enforced:** `client` (`src/stores/progress.ts:419-466`)
- **Source:** same; live triggers `page_captures_delete_on_completion`, `book_quizzes_delete_on_completion`
- **Target:** When a book is added mid-way, write a baseline history row that marks the starting page as "not read", so stats count only pages read afterwards (D-08 · BC-04, recommended). Whether an "Already finished" add counts as a completion for XP, quest and passport is open (LIB-Q01). The server owns its effects either way (BC-05).

#### LIB-18 · Post-add navigation
After a successful add, `currentlyReading` → `/` (Dashboard); every other status → `/library`. This applies to both the manual/scan and the search-details paths.
- **Enforced:** `client` (`src/pages/AddBookPage.vue:83`; `src/pages/BookSearchDetailPage.vue:161`)
- **Source:** same

#### LIB-19 · Barcode scan acceptance
Quagga2 LiveStream settings:
- rear camera (`facingMode: 'environment'`), ideal 1280×720;
- readers `ean_reader` + `ean_8_reader`, with `locate: true`.

A detection is accepted when the mean of the defined `decodedCodes[].error` values is < 0.15. That is a **single** read: the code comment "2 consistent reads" is wrong. The first accepted code stops scanning. Nothing checks for the 978/979 Bookland prefix, so an EAN-8 or a non-book EAN-13 is accepted, and an 8-digit code later fails LIB-04. ⚠ LIB-D25
- **Enforced:** `client` (`src/composables/useScanner.ts:12-51`; `src/components/books/IsbnScanner.vue:17-22`)
- **Source:** same
- **Note:** Camera/init failures are only `console.error`ed. `scanning = true` is set synchronously before Quagga's init callback runs, so the "Aim at the barcode" reticle shows over an empty viewport and the error panel with Retry is unreachable. `Quagga.onDetected` is registered on every start and never removed: `Quagga.stop()` in quagga2 1.12.1 does not unsubscribe `detected` listeners (verified in the library source), so handlers accumulate across visits to the scan step. The runtime effect of stale handlers was not reproduced.

#### LIB-20 · Prefill after scan / typed lookup
After a scan or a typed lookup, the form opens prefilled with the metadata, or empty when the lookup returns `null`. The form's ISBN is the **raw** scanned/typed value (typed input is only `trim()`med). The lookup itself uses the stripped value (LIB-39). "Metadata found! Review and save." shows only when the prefill is non-empty.
- **Enforced:** `client` (`src/pages/AddBookPage.vue:37-45,54-66,165-168`)
- **Source:** same

#### LIB-21 · Empty typed ISBN
In the scan step, "Look up" (or Enter) with an empty ISBN box behaves exactly like "Skip — enter details manually".
- **Enforced:** `client` (`src/pages/AddBookPage.vue:55-58`)
- **Source:** same

#### LIB-22 · ISBN passed to the add
The ISBN sent to `addBookWithInitialStatus` is `data.isbn ?? resolvedIsbn`, i.e. the form value, falling back to the scanned/typed value. Clearing the field makes the form emit `null`, so the raw scanned/typed value is re-applied: **the user cannot remove a scanned or typed ISBN.** A hyphenated typed ISBN therefore still reaches the insert and fails LIB-04. ⚠ LIB-D05
- **Enforced:** `client` (`src/pages/AddBookPage.vue:78-82`; `src/components/books/BookForm.vue:87`)
- **Source:** same

#### LIB-23 · Back / Cancel steps
Back and Cancel move: form → its origin step (`home` or `scan`); scan → home; home → `/library`.
- **Enforced:** `client` (`src/pages/AddBookPage.vue:90-98`)
- **Source:** same

#### LIB-24 · Duplicate notice (search details only)
Duplicate detection during an interactive add runs **only** on the search-details page. It is non-blocking: "This book is already in your library. You can still add it." A candidate matches when either:
- (a) its normalised ISBN (strip `[^0-9X]` case-insensitively, uppercase) equals that of a library book; or
- (b) failing that, its trimmed title **and** author equal a library book's, compared case-insensitively with `toLocaleLowerCase`.

An empty candidate title never matches. The ISBN-10 and ISBN-13 of the same edition do not match. The manual and scan paths have no duplicate check.
- **Enforced:** `client` (`src/utils/duplicateBook.ts:7-29`; `src/pages/BookSearchDetailPage.vue:93-100`)
- **Source:** same
- **Note:** Policy is open: LIB-Q02. Once BC-15 stores ISBN-13 only, the 10/13 mismatch disappears.

#### LIB-25 · Library warm-up for the duplicate check
The details page starts a background `fetchLibraryWithProgress()` so the duplicate check has data. The notice appears reactively once that data lands.
- **Enforced:** `client` (`src/pages/BookSearchDetailPage.vue:60-61`)
- **Source:** same

#### LIB-26 · Details-page add validation
"Add to Library" refuses to proceed:
- without title and author: "Title and author are required — tap “Edit details”.";
- without a page count, or with 0 pages: "This book needs a page count — tap “Edit details” to add it.".

Both messages appear as a warn Message, not a field error.
- **Enforced:** `client` (`src/pages/BookSearchDetailPage.vue:126-136`)
- **Source:** same

#### LIB-110 · Database errors surface as generic copy
supabase-js (postgrest-js 2.103.2) returns `error` as a **plain object** `{message, details, hint, code}`, not an `Error` instance. Every library catch block uses `e instanceof Error ? e.message : fallback`, so a CHECK violation (LIB-02/LIB-04), RLS rejection or network failure is shown as the fallback string:

| Path | Copy shown |
|---|---|
| Add hub save | "Failed to save book" |
| Search-details add | "Failed to save book" |
| CSV import | "Import failed." |

Only errors the stores throw themselves (`new Error('Not authenticated')`, `'Book not found'`) show their own message. The user is never told which field is wrong. ⚠ LIB-D03
- **Enforced:** `client` (`src/pages/AddBookPage.vue:84-86`; `src/pages/BookSearchDetailPage.vue:162-164`; `src/composables/useLibraryImport.ts:146-149`)
- **Source:** `node_modules/@supabase/postgrest-js@2.103.2/dist/index.mjs` (`processResponse` returns `JSON.parse(body)`; `PostgrestError` is thrown only with `throwOnError`)
- **Note:** Clients should map PostgREST codes (e.g. `23514` check_violation → field message) and validate before writing.

#### LIB-111 · Interactive add is not atomic
`addBookWithInitialStatus` first commits `books.insert(...).select().single()`, then (for reading/finished) upserts `reading_progress`. No transaction or rollback wraps the two writes. If the progress write fails, a queued book remains and the form shows "Failed to save book". Retrying creates a **duplicate**. ⚠ LIB-D04
- **Enforced:** `client` (`src/stores/books.ts:223-245`)
- **Source:** same
- **Target:** One server call creates the book and its initial progress atomically (BC-04 / BC-15, recommended).

### External book metadata (Google Books / Open Library)

#### LIB-27 · Search endpoint
Search uses Google Books only: `GET https://www.googleapis.com/books/v1/volumes?q={encoded}&startIndex={(page−1)·20}&maxResults=20&printType=books[&langRestrict={lang}][&key={VITE_GOOGLE_BOOKS_API_KEY}]`.
- **Enforced:** `client` (`src/services/bookSearchService.ts:20-26,93-111`)
- **Source:** same
- **Target:** Metadata calls go through a server-side book-search proxy that hides the key, caches and rate-limits, shared by web, iOS and Android (BC-15, recommended).

#### LIB-28 · Search language
`lang = navigator.language.slice(0,2)` (default `'en'`), evaluated once at module load. It is applied to free-text searches and recommendations, and **omitted** for ISBN queries.
- **Enforced:** `client` (`src/services/bookSearchService.ts:28-34,107-110,273`)
- **Source:** same
- **Note:** Open question LIB-Q13.

#### LIB-29 · ISBN-shaped queries
A query is treated as an ISBN when, after removing `-` and whitespace, it matches `^(?:\d{9}[\dX]|\d{13})$` (case-insensitive). It is then sent as `q=isbn:{stripped}`. Only `-` and whitespace are removed and case is preserved, so a trailing lowercase `x` is sent as-is.
- **Enforced:** `client` (`src/services/bookSearchService.ts:37-38,106-107`)
- **Source:** same

#### LIB-30 · Live search pacing
Search fires when the trimmed query has ≥ 2 characters. It is debounced 300 ms with a 1000 ms maxWait, and each new search aborts the previous in-flight request. Below 2 characters the results reset.
- **Enforced:** `client` (`src/composables/useBookSearch.ts:13,43-56,106`)
- **Source:** same

#### LIB-31 · Pagination
`hasMore` is true when 20 rows remain after per-page de-duplication by volume `id`, so it is under-reported when Google repeats an id on the same page. Duplicates across pages are not removed. "Load more" requests `page+1`, is **not** abortable, and can append results of an older query to a newer one. ⚠ LIB-D26
- **Enforced:** `client` (`src/services/bookSearchService.ts:117-124`; `src/composables/useBookSearch.ts:62,79-98`)
- **Source:** same

#### LIB-32 · Search error semantics
| Outcome | What the user sees |
|---|---|
| Non-OK HTTP (403/429/5xx) | `[]` → "No books found. Try a different title, author, or ISBN." |
| Thrown network error | "Search failed. Check your connection and try again." with Retry |
| Load-more failure | "Could not load more results. Please try again." |

So quota and server errors look like an empty result. ⚠ LIB-D26
- **Enforced:** `client` (`src/services/bookSearchService.ts:112,126-129`; `src/composables/useBookSearch.ts:64-70,93-95`; `src/components/books/BookSearchSection.vue:46-59`)
- **Source:** same

#### LIB-33 · Search state is a module singleton
The query, results and page live in a module singleton, so returning from the details page restores the results. The DNA recommendation fallback seeds `query` directly. The state is not reset on sign-out or user switch: the next user sees the previous query.
- **Enforced:** `client` (`src/composables/useBookSearch.ts:6-24`; `src/components/profile/DnaRecommendationsScroller.vue:34-37`)
- **Source:** same; see [11 · Cross-domain](11-cross-domain.md) (sign-out)

#### LIB-34 · Search result mapping
`mapGoogleVolume`:
- `key` = volume id; `title` = `title ?? 'Untitled'`; `author` = `authors[0] ?? null`.
- Cover = `thumbnail ?? smallThumbnail`, with the first `http:` replaced by `https:`.
- `isbn` = the first `ISBN_13` identifier, else `ISBN_10`, else `null`.
- `firstPublishYear` = the first 4 characters of `publishedDate`, when finite and > 0.
- **Enforced:** `client` (`src/types/index.ts:403-433`)
- **Source:** same

#### LIB-35 · Detail draft
`getBookDetail` calls `GET volumes/{id}[?key=]` and builds the draft from:
- title, first author (default `'Unknown Author'`), cover (LIB-34) and `pageCount`;
- primary genre = the first `/`-segment of `categories[0]`;
- `cleanDescription(description)` and the ISBN (LIB-34);
- `subjects` derived from all categories (LIB-37).

A failed or non-OK Google response leaves a blank draft (`title ''`, `author 'Unknown Author'`). The function never throws except on abort, so the page's load-error state ("Could not load this book. Please go back and try again.") is unreachable, and the user lands on an "Untitled" / "Unknown Author" draft that forces "Edit details". The `source` route param is ignored. ⚠ LIB-D27
- **Enforced:** `client` (`src/services/bookSearchService.ts:139-176,42-45`; `src/pages/BookSearchDetailPage.vue:71-73`)
- **Source:** same

#### LIB-36 · Open Library gap-fill (detail)
Gap-fill runs only when the draft has an ISBN **and** is either incomplete (no cover, no pages, no genre, or author `'Unknown Author'`) or has no specific subjects. Call: `GET https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`.
- Google values win.
- Open Library fills author (`authors[0].name`), cover (`large ?? medium ?? small`), pages (`number_of_pages`) and genre (first segment of `subjects[0].name`), and merges subjects.
- Open Library **never** supplies a description.
- **Enforced:** `client` (`src/services/bookSearchService.ts:180-224`)
- **Source:** same

#### LIB-37 · Subject derivation
Each Google category is split on `/` and its segments reversed (deepest first), followed by the Open Library subjects. Two kinds of label are dropped:
- labels in `GENERIC_SUBJECTS`: fiction, nonfiction, non-fiction, general, literature, books, ebook, juvenile fiction, juvenile nonfiction, young adult fiction;
- case-insensitive duplicates.
- **Enforced:** `client` (`src/services/bookSearchService.ts:49-88`)
- **Source:** same

#### LIB-38 · Recommendations
1. **Queries:** up to 3 `subject:"{s}"` queries from `subjects`. If there are none, use `subject:"{genre}"`. If there is no genre either, use `inauthor:"{author}"`. If none is possible, return `[]`.
2. **Request:** `startIndex = random 0..7`, `maxResults = 24`, `printType=books`, `orderBy=relevance`, plus `langRestrict` and the key. Queries run sequentially until 12 results are collected.
3. **Filters:** drop the same volume key; entries without a cover; duplicate normalised titles (the set is seeded with the current title); and, for subject/genre queries only, entries whose first author equals the current author (case-insensitive).
4. **Failures:** a failed query (non-OK or thrown, including an abort) skips to the next query and keeps what was collected. The result is `[]` only when every query fails or none was possible. On abort the page discards the result.
5. **Heading:** `More {subjects[0] ?? genre} books`, else "You might also like". The section is hidden when empty.
- **Enforced:** `client` (`src/services/bookSearchService.ts:228-293`; `src/pages/BookSearchDetailPage.vue:66-70,88-91`; `src/components/books/BookRecommendationsScroller.vue:20`)
- **Source:** same

#### LIB-39 · ISBN lookup (scan, typed ISBN, import)
`useIsbn.lookup`:
1. Strip `[^0-9X]` case-insensitively; a lowercase `x` survives.
2. Query Google `volumes?q=isbn:{clean}[&key]` (no `printType`, no `langRestrict`) and take `items[0]`:
   - first author (default `'Unknown Author'`) and `pageCount`;
   - `thumbnail` only (no `smallThumbnail` fallback), with http → https;
   - genre = the **raw** `categories[0]`, not segment-split.
3. Google returns nothing → full fallback to Open Library: `authors[0].name ?? 'Unknown Author'`, `number_of_pages`, `cover.large ?? medium ?? small`, `subjects[0].name`.
4. Google is complete (cover, pages, genre, author ≠ Unknown) → return it without calling Open Library.
5. Otherwise Open Library fills the gaps field by field. Title always comes from Google, and description is always `null`.

Internally the variable names are inverted (`olResult` holds the Google result). ⚠ LIB-D37
- **Enforced:** `client` (`src/composables/useIsbn.ts:8-103`)
- **Source:** same

#### LIB-40 · Description cleaning
`cleanDescription` applies, in order:
1. `<br>` → newline; `</p>` → blank line; strip every remaining tag.
2. Decode `&amp; &quot; &#39; &apos; &lt; &gt; &nbsp;`.
3. Remove `([source][N])`, markdown reference-definition lines `[N]: …`, a trailing `Source(s): …` line and a bare trailing URL.
4. Collapse runs of 3+ newlines to 2, then trim. An empty result → `null`.
- **Enforced:** `client` (`src/utils/cleanDescription.ts:7-42`)
- **Source:** same

#### LIB-41 · Description display
The details page clamps text longer than 280 characters behind "Read more" / "Read less" and shows "No description available." when empty. The Book Detail header always clamps when a description exists, with the toggle "Read more" / "Show less".
- **Enforced:** `client` (`src/components/books/BookDescription.vue:10-30`; `src/components/book/BookDetailHeader.vue:39-52`)
- **Source:** same

#### LIB-42 · Description backfill on Book Detail
When `book.description` is falsy, Book Detail runs a backfill on **every visit** (nothing records a failed attempt):
1. `searchBooks(isbn ?? "{title} {author}", 1)`. An ISBN uses the `isbn:` operator; title text uses `langRestrict`.
2. Take the first result's key and call `getBookDetail`.
3. If that returns a description, `updateBook({description})`.

It fails silently. When an ISBN search finds nothing, there is no title/author fallback. The backfill is the last step of a sequential `onMounted` chain, so it is skipped for that visit if an earlier await throws. A title search can attach **another edition's** description. The code comment says "once per book", which is true only after a success. ⚠ LIB-D28
- **Enforced:** `client` (`src/pages/BookDetailPage.vue:86-114`)
- **Source:** same
- **Target:** The backfill runs through the book-search proxy, which caches negative results (BC-15, recommended).

#### LIB-43 · Rate limiting and key exposure
There is no client-side rate limiter beyond the debounce (LIB-30) and import enrichment throttling (LIB-66), and no retry or backoff on 429. The optional Google API key ships in the JS bundle (`VITE_` env var). A **literal key value is committed in `.env.example`**. ⚠ LIB-D30
- **Enforced:** `client` (`src/services/bookSearchService.ts:25-26`; `src/composables/useIsbn.ts:38`)
- **Source:** same; `.env.example:18` (value not reproduced here)
- **Target:** Rotate and restrict the key now. Move all metadata traffic behind the server-side proxy with caching and rate limits (BC-15, recommended).

#### LIB-103 · Add-hub search result row
Each result row shows:
- the cover at 44×64 (`object-fit: cover`), or a `pi-book` icon;
- the title on one line with ellipsis;
- the author and `firstPublishYear`, only when present;
- a trailing chevron.

Tapping a row pushes `add-book-details` with `{source, key: encodeURIComponent(result.key)}`. The key is percent-encoded into one path segment and matched by `:key(.*)`, so deep-link and universal-link handlers must decode it the same way.
- **Enforced:** `client` (`src/components/books/BookSearchResultCard.vue:18-39`; `src/components/books/BookSearchSection.vue:18-23`)
- **Source:** same

#### LIB-105 · Search-details hero
- Genre pill (CSS-uppercased), shown only when `draft.genre` is set.
- Title falls back to "Untitled". Author is always rendered and may be empty.
- Meta line = `"{totalPages} pages"` and/or `"ISBN {isbn}"`, joined by `"  ·  "`, omitted when both are empty.
- Tapping the cover opens a full-screen preview. With no cover, a book-icon placeholder shows.
- **Enforced:** `client` (`src/components/books/SearchBookHero.vue:11-39`)
- **Source:** same

#### LIB-106 · Recommendations scroller
The section is hidden when the list is empty. Default heading "You might also like" (overridable, LIB-38). Layout: horizontal snap scroller; posters 104×156; title clamped to 2 lines and author to 1. Tapping a poster pushes a new details route. `firstPublishYear` is carried but unused.
- **Enforced:** `client` (`src/components/books/BookRecommendationsScroller.vue:5-45`)
- **Source:** same

#### LIB-107 · Add-hub search section copy
| Element | Copy / behaviour |
|---|---|
| Label | "Search for a book" |
| Placeholder | "Title, author, or ISBN" |
| Loading | "Searching…" with a spinner |
| Error | warn message + "Retry" |
| Empty | "No books found. Try a different title, author, or ISBN." — only after a search has run |
| Load more | "Load more" (outlined, full width, spinner while loading), only when `hasMore` |
- **Enforced:** `client` (`src/components/books/BookSearchSection.vue:28-77`)
- **Source:** same

### Library views, status & ordering

#### LIB-44 · Server status derivation
`get_library_with_progress` derives `status` (first match wins):
1. `dnf_at IS NOT NULL` → `'dnf'`
2. `coalesce(current_page,0) = 0` → `'unread'`
3. `current_page ≥ total_pages AND total_pages > 0` → `'finished'`
4. otherwise → `'reading'`

A book without a `reading_progress` row is `'unread'`. `dnf_at` is read by **no other function**: stats, quest, breakdown and the public profile all ignore it.
- **Enforced:** `server:rpc` (`get_library_with_progress`)
- **Source:** live function body
- **Note:** `current_page` has no CHECK, so a negative page would derive as `'reading'` with a negative percentage. Clients must clamp to `[0, total_pages]` (LIB-63).

#### LIB-45 · Percentage (server vs client)
The server computes `least(100, round(current_page / total_pages × 100, 2))`, or 0 when `total_pages ≤ 0`. The web client (`mapReadingProgress`, `updateProgress`) computes `Math.round(cp/tp × 10000)/100` **uncapped**, so a client-computed value can exceed 100 %. Progress bars use `width: {pct}%` with no clamp. ⚠ LIB-D08
- **Enforced:** `server:rpc`; `client` (`src/types/index.ts:435-444`; `src/stores/progress.ts:503-505`)
- **Source:** same; `src/components/books/BookCard.vue:87`; `src/components/books/BookGridCard.vue:49`; `src/components/library/ReadingWideCard.vue:64`
- **Note:** Clients derive the percentage at use time from `(current_page, total_pages)` and cap it at 100.

#### LIB-46 · Client status for optimistic snapshots
`applyProgressSnapshot` derives: `dnf` (if `dnfAt`) → `finished` (`percentage ≥ 100`) → `reading` (`currentPage > 0`) → `unread`. A snapshot that omits `dnfAt` keeps the entry's current DNF state.
- **Enforced:** `client` (`src/stores/books.ts:139-175`)
- **Source:** same

#### LIB-47 · Library order
The RPC orders rows by `coalesce(rp.updated_at, b.created_at) DESC` with **no tiebreaker**. `reading_progress.updated_at` is bumped by the BEFORE UPDATE trigger on **any** update (page save, session start/pause/resume/clear, DNF mark/resume), and every one of those moves the book to the top. Ties are common: all rows of one import insert chunk share `created_at` (transaction `now()`), and all rows of one status-upsert chunk share `updated_at`. Imported books therefore have arbitrary relative order (Completed tab, unordered Queue). ⚠ LIB-D09
- **Enforced:** `server:rpc` (`get_library_with_progress`); `server:db` (`reading_progress_updated_at` → `set_updated_at`)
- **Source:** live; `src/stores/books.ts:296-352`
- **Note:** Native clients add a deterministic secondary key (`title`, then `id`) until the RPC does.

#### LIB-48 · List view sections
- **Now Reading:** status `'reading'`, in RPC order, always visible with a count badge. Empty copy: "No books in progress."
- **Queue tab:** status `'unread'`, sorted by Up Next order (LIB-55).
- **Completed tab:** status `'finished'`, in RPC order. Empty copy: "No finished books yet."
- DNF entries appear in neither tab.
- **Enforced:** `client` (`src/pages/LibraryPage.vue:55-74`; `src/components/library/LibraryListView.vue:62-163`)
- **Source:** same

#### LIB-49 · Grid view tiers use a different source
Grid tiers come from the **progress-store percentages**, not the RPC status:
- Reading: `0 < pct < 100`, sorted by `progress.updatedAt` desc.
- Queue: `pct === 0`, sorted by Up Next order; unordered books keep their incoming order.
- Completed: `pct ≥ 100`, sorted by `updatedAt` desc.

The grid iterates `booksStore.books`, excludes books whose progress row has `dnfAt`, and does not render empty sections. A 0-page book with an active session is "Queue" here but in progress (possibly the hero) on the Dashboard. ⚠ LIB-D11
- **Enforced:** `client` (`src/pages/LibraryPage.vue:82-107`; `src/components/library/LibraryGridView.vue:25-36,67,94,133`)
- **Source:** same
- **Note:** Native clients use the RPC `status` as the single source for both layouts.

#### LIB-50 · Grid collapse persistence
Collapse state is stored in `localStorage['library-grid-collapsed']` as JSON `{reading, queue, archive}`. A missing or garbled value means all sections are expanded. Spec 019 FR-002 asked for Archives collapsed by default; this was never implemented.
- **Enforced:** `client` (`src/components/library/LibraryGridView.vue:42-60`)
- **Source:** same

#### LIB-51 · List tab persistence
The active tab is stored in `localStorage['library-active-tab']` (`'queue'|'completed'`, default `'queue'`). Changing tab exits reorder mode. The stored value is cast without validation, so an unexpected string shows the Completed content. ⚠ LIB-D35
- **Enforced:** `client` (`src/components/library/LibraryListView.vue:27-34`)
- **Source:** same

#### LIB-52 · Sticky layout
- Search wrapper: `top: 0.5rem; z-index 60`.
- List pill-tab strip: `top: 3.6rem; z-index 50`.
- Grid queue header row: `top: 3.6rem; z-index 40`. Grid section headers are also sticky.
- **Enforced:** `client` (`src/pages/LibraryPage.vue:334-338`; `src/components/library/LibraryListView.vue:288-303`; `src/components/library/LibraryGridView.vue:176-183,245`)
- **Source:** same

#### LIB-53 · Library search
**Normalisation:** `normalize('NFD')`, strip U+0300–U+036F, `toLocaleLowerCase()`, `trim()`.

**Match:** the normalised title **or** author `includes` the normalised query. The search covers every status, DNF included.

**Results:**
- Groups in order Now Reading → Queue → Completed → Did Not Finish, each in RPC order. Empty groups are hidden.
- Empty copy: `No books match “{query}”.`
- Search results replace the active list or grid view.
- **Enforced:** `client` (`src/utils/searchText.ts:2-7`; `src/pages/LibraryPage.vue:41-51,270-278`; `src/components/library/LibrarySearchResults.vue:47-87`)
- **Source:** same

#### LIB-54 · DNF header icon
The Library header shows the DNF (ban) icon only when at least one `libraryEntries` row has status `'dnf'`. It links to `/library/dnf`.
- **Enforced:** `client` (`src/pages/LibraryPage.vue:76-78,187-196`)
- **Source:** same

#### LIB-104 · Library search bar
- Placeholder "Search your library…"; aria-label "Search your library by title or author".
- A clear (×) button appears only when the query is non-empty and resets it to `''`.
- Input hints: `autocomplete=off`, `autocapitalize=off`, `spellcheck=false`, `enterkeyhint=search`.
- Filtering is an instant computed value with no debounce. The query is component state and is lost on navigation.
- The bar shows only when the library is not loading and is non-empty.
- **Enforced:** `client` (`src/components/library/LibrarySearchBar.vue:10-29`; `src/pages/LibraryPage.vue:41-51,227-232`)
- **Source:** same

#### LIB-109 · Empty, loading and not-found states
| State | Copy / behaviour |
|---|---|
| Empty library | "Your library is empty" / "Scan an ISBN or add a book manually to start tracking your reading." + "Add your first book"; search bar hidden |
| Empty queue tab | bookmark icon, "Your Want-to-read shelf is empty. Import your Goodreads or StoryGraph library, or search for your next read." + "Add or import books" → `/books/add` (opens the hub, not the import dialog) |
| Loading | 3-row skeleton on Library, 2-row on the DNF page, hero skeleton on search details |
| Book not found | "Book not found." + "Back to Library" when the id is not in the store after `fetchLibrary()` and nothing is loading |

`EmptyState` (optional icon, required title, optional description, `action` slot) renders the Library and DNF empty states.
- **Enforced:** `client` (`src/pages/LibraryPage.vue:252-266`; `src/components/library/LibraryListView.vue:143-160`; `src/pages/BookDetailPage.vue:253-257`; `src/components/shared/EmptyState.vue`)
- **Source:** same

#### LIB-112 · Library load failure falls through to the empty state
If `get_library_with_progress` fails, `booksStore.error` is set but **never rendered** on Library or the DNF page:
- When `books` is empty, the page shows "Your library is empty" with an add CTA.
- When `books` still holds older data, the stale list shows with no error indicator.

The Dashboard does surface the same failure as its "Some things didn't load" notice. ⚠ LIB-D10
- **Enforced:** `client` (`src/stores/books.ts:123-133`; `src/pages/LibraryPage.vue:252-266`)
- **Source:** same; `src/pages/DashboardPage.vue:161-165`

#### LIB-113 · Book Detail fallback loader
When a book is not in the store (deep link, reload), Book Detail calls `fetchLibrary()`: an un-paginated `books.select('*').order('created_at', desc)`. The progress store likewise falls back to an un-paginated `reading_progress.select(...)` and maps it with the uncapped client percentage. The first render runs before `onMounted` sets `loading`, so "Book not found." flashes briefly on a cold deep link. ⚠ LIB-D36
- **Enforced:** `client` (`src/stores/books.ts:35-75`; `src/stores/progress.ts:135-147`; `src/pages/BookDetailPage.vue:86-88,253`)
- **Source:** same
- **Note:** Table GETs are subject to the PostgREST `max_rows` cap (1000 by default on Supabase), so a library of more than 1000 books would be truncated on this path. The project's actual `max_rows` setting cannot be read through SQL [UNVERIFIED].

#### LIB-114 · Two population paths for the book list
`books.value` is filled either by `fetchLibrary` (select `*`, real `createdAt`) or by the RPC mapping. The RPC mapping sets `createdAt: ''`, because the RPC does not return `created_at`, so the grid fallback `new Date('')` is `NaN`. `libraryEntries` (RPC) and `books` can disagree after an edit (LIB-64). Neither array is reset when the signed-in user changes: the previous user's library shows until the next fetch, and an import started in that window de-duplicates against the previous user's books. ⚠ LIB-D38
- **Enforced:** `client` (`src/stores/books.ts:28-29,35-42,83-106`)
- **Source:** same; [08 · Platform](08-platform-auth-account.md) (user switch)

#### LIB-116 · Library RPC contract and authorization
`get_library_with_progress(p_user_id uuid) → json` (LANGUAGE sql, STABLE, **SECURITY DEFINER**, `search_path=public`):
- **Grants:** EXECUTE for `authenticated` and `service_role`, not `anon`.
- **Authorization:** since 2026-10-19 (BC-01) the function raises `not_allowed` (`42501`) unless `p_user_id = auth.uid()`; the parameter is kept, and the PWA calls it with `{p_user_id: auth.user.id}`. `get_reading_velocity`, `get_library_breakdown` and `get_last_session` have the same guard.
- **Response:** one JSON array (`[]` when empty), with no pagination, ordered per LIB-47. Each element is `{id, title, author, coverUrl, totalPages, genre, isbn, description, source, pageCountEstimated, currentPage, percentage, status, lastReadAt, sessionStartAt, dnfAt, progressId}`.
  - `percentage` is numeric, 2 dp, capped at 100.
  - `lastReadAt` = `reading_progress.updated_at`, bumped by any progress update, not only page saves.
  - `progressId` is null when there is no progress row.
  - `created_at` and `session_paused_at` are **not** returned.
  - The `coalesce`s on `source` / `page_count_estimated` are dead code, because both columns are NOT NULL.
- **Enforced:** `server:rpc` (`get_library_with_progress`)
- **Source:** live `pg_get_functiondef`, `has_function_privilege`; migration `20261018120000_bc01_security_hardening.sql`; `src/stores/books.ts:86-88`
- **Target:** A delta / paginated variant (`changed_since`) is added for large libraries and multi-device sync (BC-14, recommended).

### Up Next queue

#### LIB-55 · Queue order
The queue is ordered by `up_next_order.sort_position` asc (`fetchOrder`). Queued books sort by their index in that list. Books **without** a row sort after all ordered books and keep the incoming (RPC) order among themselves.
- **Enforced:** `client` (`src/stores/upNext.ts:13-23,88`; `src/pages/LibraryPage.vue:59-70`)
- **Source:** same

#### LIB-56 · New books are unordered
Adding a book (any path, including import) creates **no** `up_next_order` row. A new book therefore appears behind every manually ordered book. Among unordered books the RPC order applies, so the newest is first.
- **Enforced:** `client` (`src/stores/books.ts:184-245` — no up-next write)
- **Source:** same
- **Note:** Open question LIB-Q03.

#### LIB-57 · Reorder persistence
`saveOrder(bookIds)` runs on **every drop**:
1. Optimistically replace the local `upNextOrder` with `bookIds` mapped to `sortPosition = index`, giving dense positions 0…n−1.
2. Upsert `{user_id, book_id, sort_position: index, updated_at: clientNow}` for exactly the currently queued books (`onConflict: 'user_id,book_id'`).
3. On error, revert to the previous array and rethrow. The page shows the toast "Reorder failed" / "Could not save the new queue order. Try again." for 3 s.

Rapid drops race, and the last write wins.
- **Enforced:** `client` (`src/stores/upNext.ts:45-86`; `src/pages/LibraryPage.vue:149-160`)
- **Source:** same

#### LIB-58 · Up Next rows are never cleaned up
`up_next_order` rows are **never deleted** when a book starts, completes, is shelved or is re-queued. The only removal is the FK cascade on book delete. Consequences:
- A book returning to the queue regains its stale position, which can collide with another book's index. Nothing enforces unique `(user_id, sort_position)`, and the live DB already has collisions.
- The Library Queue and the Dashboard Up Next shelf consider only `unread` / 0 % books, so stale rows do not affect them.
- **`useActiveBook.sortedInProgress`, which infers the Dashboard hero, ranks in-progress books by their `up_next_order` index first and only then by `updatedAt` desc.** A book once at the top of the queue keeps winning hero inference over a more recently read book.
- After a successful `saveOrder` the local array holds only the queued ids while the DB keeps the stale rows. The two re-converge on the next `fetchOrder` (TTL 60 s), so hero inference can change with no user action.

⚠ LIB-D12
- **Enforced:** `client` (`src/stores/upNext.ts:53-64`; `src/composables/useActiveBook.ts:43-70`)
- **Source:** live `up_next_order_book_id_fkey`; live aggregates (stale rows and position collisions present)
- **Note:** Hero rules: [02 · Reading sessions](02-reading-sessions.md) (SES-59). Open question LIB-Q03.

#### LIB-59 · `up_next_order` constraints
- `UNIQUE(user_id, book_id)`; `sort_position integer NOT NULL DEFAULT 0`; `updated_at DEFAULT now()`.
- RLS `up_next_order_select_own` / `_insert_own` / `_update_own` / `_delete_own` (BC-01): `user_id = (select auth.uid())`.
- FKs to `auth.users` and `books`, both `ON DELETE CASCADE`.
- Read with `select * where user_id = uid order by sort_position asc`. Written only by `saveOrder`.

Since 2026-10-19 (BC-01) INSERT and UPDATE also require `book_id` to belong to the caller (`42501` otherwise).
- **Enforced:** `server:db` (`up_next_order_user_id_book_id_key`, FKs, RLS)
- **Source:** live; migration `20261018120000_bc01_security_hardening.sql`

#### LIB-60 · Dashboard Up Next shelf
The shelf shows books with `percentageForBook = 0` that are not DNF: ordered books first by index, then the rest in `booksStore.books` order. It does **not** exclude the current hero, so a 0-page book with an active session can be both the hero and on the shelf. Tapping a shelf book calls `setActive`, which swaps the hero without starting a session. ⚠ LIB-D11
- **Enforced:** `client` (`src/pages/DashboardPage.vue:202-215,432`; `src/composables/useActiveBook.ts:43-68`)
- **Source:** same; see [02](02-reading-sessions.md) (SES-64)

### Edit

#### LIB-61 · Edit dialog shows status controls it ignores
`BookEditDialog` uses `BookForm` **without** `metadataOnly`. It therefore shows the "Library status" radios and, for "Reading now", a required current-page field, even though both are ignored on save. Choosing "Reading now" without a page blocks Save. The description field is not shown. ⚠ LIB-D13
- **Enforced:** `client` (`src/components/books/BookEditDialog.vue:54-66`; `src/components/books/BookForm.vue:139-173`)
- **Source:** same

#### LIB-62 · Fields saved by edit
Edit saves `title`, `author`, `genre`, `cover_url`, `isbn` and `total_pages`. `total_pages` is always present because the form validates it ≥ 1. Saving the dialog therefore **always** clears `page_count_estimated`, even when the placeholder value was left untouched. ⚠ LIB-D13
- **Enforced:** `client` (`src/components/books/BookEditDialog.vue:21-31`; `src/stores/books.ts:389-392`)
- **Source:** same
- **Note:** Open question LIB-Q05.

#### LIB-63 · Page-count edits bypass completion
A `total_pages` change does not touch `reading_progress`: `current_page` is not clamped, and status and percentage re-derive on the next RPC read.

**Lowering to ≤ `current_page`** makes the book "finished" **without** completion effects:
- The capture/quiz purge triggers fire only on `reading_progress` `INSERT OR UPDATE OF current_page`.
- The passport is generated only inside `updateProgress`.
- There is no history row, completion prompt or Insight.
- `get_reading_quest_summary` counts a manual book complete whenever `current_page ≥ total_pages` and dates the completion by `reading_progress.updated_at` with **UTC** year bounds. A pages-edit completion is credited to the year the progress row was last touched, possibly a past year, and adds +25 XP immediately.
- History-derived "finish" facts (monthly finishes, records) are recomputed against the new total.

**Raising above `current_page`** on a finished book silently un-completes it (−25 XP). Its captures and quiz are already gone, and the passport row remains with "View Reading Journey" now hidden.

⚠ LIB-D15
- **Enforced:** `client` (`src/stores/books.ts:376-411`); `server:db` (triggers on `reading_progress` only; no trigger on `books`)
- **Source:** live triggers `page_captures_delete_on_completion`, `book_quizzes_delete_on_completion`; live `get_reading_quest_summary`; `src/stores/progress.ts:616-624`
- **Target:**
  - "Finished this year" uses a first-completion timestamp `reading_progress.completed_at` stamped by the server (BC-04).
  - Completion effects have one server owner regardless of path (BC-05).
  - Whether a page-count edit may complete or un-complete a book is open: LIB-Q04.

#### LIB-64 · Stale local state after edit
After an edit the store replaces the `books` entry, touches `books:{uid}` and invalidates `library`, `libraryBreakdown` and `readingQuest*`. `libraryEntries` and the progress map are not updated locally.

A later RPC fetch does not fix the progress map. `progressStore._fetcher` keeps the existing entry whenever `existing.updatedAt >= derived.updatedAt`, and a `total_pages` edit never changes `reading_progress.updated_at`, so the stale percentage survives until a full reload. Effects:
- List section membership updates, because it uses the RPC `status`.
- Card bars and "%" (`BookCard`, `ReadingWideCard`, `BookGridCard`) and grid tiers (LIB-49) keep the old value.
- The next save's milestone and completion detection compares a stale `prevPct` with the new total ([11 · Cross-domain](11-cross-domain.md)).
- Velocity is not invalidated (LIB-108).

⚠ LIB-D15
- **Enforced:** `client` (`src/stores/books.ts:403-410`; `src/stores/progress.ts:105-128`)
- **Source:** same
- **Note:** Native clients derive the percentage at use time and never compare `updatedAt` with `>=` to decide freshness.

#### LIB-65 · Edit failure handling
The dialog wraps the save in `try/finally` with no `catch`. A failure becomes an unhandled rejection, the dialog stays open, and nothing is shown. Two related behaviours:
- `:initial` is an inline object literal, so a re-render (toggling `saving`) re-triggers `BookForm`'s `watch(() => props.initial)` and re-applies the **original** book values. This is probable from Vue semantics but not reproduced in a browser [UNVERIFIED]. `AddBookPage` has the same pattern (`:initial="{ ...prefill, isbn: resolvedIsbn }"`).
- Cancel and mask-click close without a dirty check, so unsaved edits are discarded silently.

⚠ LIB-D13
- **Enforced:** `client` (`src/components/books/BookEditDialog.vue:21-42,52-63`; `src/components/books/BookForm.vue:50-59`; `src/pages/AddBookPage.vue:171-175`)
- **Source:** same

### CSV import (spec 034)

#### LIB-66 · Import constants and throttling
- Insert chunk = 100 rows; status-upsert chunk = 100 rows.
- Placeholder `total_pages` = **100**.
- Enrichment runs 3 books in parallel per batch, with 150 ms between batches (not after the last).
- Each enriched book can make up to **5** external HTTP calls plus one Supabase `PATCH`: `lookup(isbn)` (Google + Open Library) → on a miss, `searchBooks` → `lookup(hit.isbn)` (Google + Open Library).
- **Enforced:** `client` (`src/stores/books.ts:253-254,346`; `src/composables/useLibraryImport.ts:14-17,55-91`)
- **Source:** same
- **Target:** An atomic, idempotent server import RPC owns the writes and dedupe. Enrichment goes through the book-search proxy (BC-15, recommended).

#### LIB-67 · Offline guard
When `navigator.onLine === false`, the phase becomes `error` with "You are offline. Reconnect to import your library." Nothing is parsed.
- **Enforced:** `client` (`src/composables/useLibraryImport.ts:96-100`)
- **Source:** same

#### LIB-68 · File acceptance
PrimeVue FileUpload `accept=".csv,text/csv"` takes the first selected file, with no size limit. papaparse (lazy-loaded) runs with `header: true, skipEmptyLines: true`. Row-level parse warnings (`res.errors`) are ignored; only a file-level error rejects.
- **Enforced:** `client` (`src/components/import/LibraryImportDialog.vue:39-42,79-87`; `src/composables/useLibraryImport.ts:43-53`)
- **Source:** same

#### LIB-69 · Format detection
Detection compares `trim()`med header names:
- **Goodreads:** has `Book Id` AND `Exclusive Shelf` AND `My Rating`.
- **StoryGraph:** has `Read Status` AND `Star Rating` AND NOT `Exclusive Shelf`.
- Anything else: "Unrecognized file. Upload a Goodreads or StoryGraph CSV export." with no writes.
- **Enforced:** `client` (`src/utils/import/csvFormat.ts:6-17`; `src/composables/useLibraryImport.ts:106-111`)
- **Source:** same

#### LIB-70 · Goodreads row mapping
- `title` = `Title.trim()`; empty → failure "no title".
- `author` = `(Author ?? 'Author l-f' ?? '').trim() || 'Unknown Author'`. `Author l-f` is used only when the `Author` column is absent, not when it is empty.
- `isbn` = `cleanIsbn(ISBN13) ?? cleanIsbn(ISBN)`.
- `totalPages` = `parsePages(Number of Pages)`.
- Status from `Exclusive Shelf` (LIB-74).
- **Enforced:** `client` (`src/utils/import/goodreadsParser.ts:13-34`)
- **Source:** same

#### LIB-71 · StoryGraph row mapping
- `title` from `Title` (empty → "no title").
- `author` = the first entry of `Authors` split on `,` or `;`, else `'Unknown Author'`.
- `isbn` = `cleanIsbn(ISBN/UID)`; pages from `Number of Pages`; status from `Read Status`.
- **Enforced:** `client` (`src/utils/import/storygraphParser.ts:7-29`; `src/utils/import/shared.ts:42-45`)
- **Source:** same

#### LIB-72 · `cleanIsbn`
`cleanIsbn` processes a raw value as follows:
1. Strip a leading `="` / `=` and a trailing `"` (the Goodreads Excel guard).
2. Keep `[0-9Xx]` and uppercase. An X is kept anywhere, not only last.
3. Accept when **length ≥ 10**, else `null`.

Lengths 11, 12 and 14+ pass this check and then fail `books_isbn_check` (LIB-04), which aborts the whole chunk (LIB-83). A StoryGraph non-ISBN UID of ≥ 10 digits/X is treated as an ISBN. ⚠ LIB-D02
- **Enforced:** `client` (`src/utils/import/shared.ts:4-10`)
- **Source:** same
- **Target:** The same server normalisation and checksum as LIB-04. Invalid ISBNs become `NULL` instead of aborting (BC-15, recommended).

#### LIB-73 · `parsePages`
`parsePages` strips every non-digit, then `parseInt`. A finite value > 0 is used; anything else is `null` (→ placeholder, LIB-77).
- **Enforced:** `client` (`src/utils/import/shared.ts:13-17`)
- **Source:** same

#### LIB-74 · Status mapping
On `lower(trim(status))`:
- `read` → `completed`;
- `did-not-finish` | `did not finish` | `dnf` → `dnf`;
- everything else (`to-read`, `currently-reading`, custom shelves, empty) → `queued`.
- **Enforced:** `client` (`src/utils/import/shared.ts:20-29`)
- **Source:** same
- **Note:** The `currently-reading` mapping is open: LIB-Q07.

#### LIB-74a · Columns read vs ignored
**Read:** Title; Author (or `Author l-f`) / Authors; ISBN13 / ISBN or ISBN/UID; Number of Pages; Exclusive Shelf / Read Status.

**Dropped by design** (spec 034: ratings, reviews and read dates are out of scope): ratings, review text, Date Read / Date Added, Bookshelves (non-exclusive tags), publisher, year, binding, read count, owned copies.

As a result, an imported completed book has no completion date, and `dnf_at` gets the import time (LIB-95).
- **Enforced:** `client` (`src/utils/import/goodreadsParser.ts:13-34`; `src/utils/import/storygraphParser.ts:7-29`)
- **Source:** `specs/034-library-import/spec.md`
- **Note:** Open question LIB-Q08.

#### LIB-74b · CSV parsing edge cases
- **Headers.** Header names are trimmed only for detection. Field lookups use exact keys (`raw['Title']`), so a header with stray whitespace passes detection but maps every row to "no title". papaparse 5.5 strips a UTF-8 BOM from the header row.
- **Page counts.** `parsePages` deletes every non-digit, so `"300.0"` → 3000 and `"1,234"` → 1234. There is no upper bound: a value above 2^31−1 overflows the `integer` column and aborts the 100-row chunk (LIB-83).
- **Failed-row titles.** A failed row reports `raw['Title'].trim()`, or `null`.

⚠ LIB-D20
- **Enforced:** `client` (`src/utils/import/csvFormat.ts:7`; `src/utils/import/shared.ts:13-17`; `src/composables/useLibraryImport.ts:116-120`)
- **Source:** same; papaparse 5.5.4

#### LIB-75 · Dedupe key
The key is `isbn:{cleanIsbn}` when an ISBN is present, else `ta:{title.trim().toLowerCase()} {author.trim().toLowerCase()}` (no accent folding). The seen-set is seeded from `booksStore.books` using `cleanIsbn(b.isbn)` and then collapses duplicates within the file. Each skip increments `skippedDuplicate`. A row with an ISBN never matches an existing book without one, and vice versa. ⚠ LIB-D19
- **Enforced:** `client` (`src/utils/import/shared.ts:32-39`; `src/stores/books.ts:265-280`)
- **Source:** same

#### LIB-76 · Dedupe seed depends on the in-memory library
The dedupe seed is whatever `booksStore.books` holds at import time. `AddBookPage` never loads the library, so after a cold load or refresh of `/books/add` the seed is empty and a re-import duplicates the whole library. The Dashboard entry point loads the library first. After a user switch, the seed is the **previous** user's library (LIB-114). ⚠ LIB-D19
- **Enforced:** `client` (`src/pages/AddBookPage.vue` — no fetch; `src/stores/books.ts:266-269`; `src/pages/DashboardPage.vue:160`)
- **Source:** same
- **Target:** Dedupe runs server-side inside the import RPC (BC-15, recommended).

#### LIB-77 · Insert payload
Each row is inserted as `{user_id, title, author, isbn, cover_url: null, total_pages: totalPages ?? 100, genre: null, description: null, source, page_count_estimated: totalPages == null}`, with `.select('id, total_pages')`. The code maps returned rows to chunk rows **by position**.
- **Enforced:** `client` (`src/stores/books.ts:296-323`)
- **Source:** same

#### LIB-78 · Quiet status writes
Status rows are collected during the inserts and upserted **after all insert chunks** (`onConflict book_id,user_id`, chunks of 100):

| Imported status | `reading_progress` row |
|---|---|
| `completed` | `{current_page: inserted total_pages (incl. placeholder 100), session_start_at: null, dnf_at: null}` |
| `dnf` | `{current_page: 0, session_start_at: null, dnf_at: importStartISO}` |
| `queued` | none |

No `progress_history` is written, so the import produces no recap, lore, quest XP, passport or vocabulary side effects. The completion triggers fire on the completed rows; they are a no-op because a new book has no captures.
- **Enforced:** `client` (`src/stores/books.ts:282-352`)
- **Source:** same; live triggers
- **Target:** Statuses are written in the same transaction as the books (BC-15, recommended). Imports stay quiet (spec 034 FR-005).

#### LIB-79 · Post-insert refresh
After the inserts the client touches `books`, invalidates `progress`, `library`, `libraryBreakdown`, `readingStats`, `readingQuest*` and `velocity`, then awaits `fetchLibraryWithProgress()`.
- **Enforced:** `client` (`src/stores/books.ts:354-362`)
- **Source:** same

#### LIB-80 · Import summary
- `imported` = inserted count.
- `skippedDuplicate` = rows skipped by dedupe.
- `failed` = parse failures, reported as `row = dataIndex + 2` (the header is row 1).
- `total` = all parsed data rows.
- `estimatedPageCounts` = placeholders counted **at insert time** and never decremented by enrichment, so the number is overstated once enrichment runs. ⚠ LIB-D22

When there are zero usable rows, the copy is "No usable rows — every row was missing a title." (if any row failed) or "No book rows found in this file.".
- **Enforced:** `client` (`src/composables/useLibraryImport.ts:113-140`; `src/stores/books.ts:364-373`)
- **Source:** same

#### LIB-81 · Enrichment
**Targets:** inserted books with no cover OR no genre OR `pageCountEstimated` — in practice every imported book, because cover and genre are always null.

**Per book:**
1. If the book has an ISBN, call `lookup(isbn)`.
2. If that returns nothing (no ISBN, or a lookup miss), search `"{title} {author}"` page 1 with `langRestrict`. If the first hit has an ISBN, call `lookup(hit.isbn)`; else, if it has a cover, use the cover only.
3. Apply the cover only if missing, the genre (first `/` segment) only if missing, and `totalPages` only if `pageCountEstimated`.

Enrichment never writes a description or an ISBN, and per-book errors are swallowed.

**Further behaviour:**
- Targets come from `booksStore.bookById(id)` after the post-insert refetch. If that RPC failed, the list is empty, enrichment silently does nothing, and the dialog still reaches `done`.
- Each `updateBook` re-invalidates `library`, `libraryBreakdown` and `readingQuest*`.
- The loop **cannot be cancelled**. Navigating away unmounts the dialog, but the promise chain keeps writing `books` rows.

⚠ LIB-D21
- **Enforced:** `client` (`src/composables/useLibraryImport.ts:19-23,55-91,134-143`; `src/stores/books.ts:362`)
- **Source:** same

#### LIB-82 · Placeholder demotion
An imported "read" book with a placeholder (`current_page = total_pages = 100`) whose enrichment finds a real page count above 100 is demoted to `reading` (e.g. 100/350 = 28.6 %), because only `total_pages` changes. The stale local percentage then survives until reload (LIB-64). ⚠ LIB-D18
- **Enforced:** `client` (`src/stores/books.ts:325-332`; `src/composables/useLibraryImport.ts:71-72`)
- **Source:** same; see [02](02-reading-sessions.md) (SES-29)

#### LIB-83 · Import is not transactional
A failing insert chunk aborts the import. Causes include a title > 500 or author > 200 characters, a bad ISBN (LIB-72) and integer overflow (LIB-74b). The dialog shows the generic "Import failed." (LIB-110). Effects:
- Earlier chunks persist.
- **No status upserts run**, so already-inserted read/DNF books stay queued.
- A re-import skips those books as duplicates, so they stay wrong.

⚠ LIB-D17
- **Enforced:** `client` (`src/stores/books.ts:315-352`; `src/composables/useLibraryImport.ts:146-149`)
- **Source:** same
- **Target:** An all-or-nothing, idempotent import RPC that reports failed rows individually (BC-15, recommended).

#### LIB-84 · Import dialog phases and copy
| Phase | Copy / UI |
|---|---|
| `parsing` | "Reading your file…" |
| `importing` | "Adding books to your library…" (indeterminate bar) |
| `enriching` | "Filling in covers & details… {processed} of {total}" (determinate) |
| `done` | headline "Import complete" (check icon); chips "{n} imported" (success), "{n} already in library" (warn, if > 0), "{n} skipped" (warn, if failures); info "{n} book(s) need(s) a page count — open a book to set the real number."; collapsible "Show skipped rows", each `Row {n}` + ` — “{title}”` (if any) + `: {reason}` |

Other dialog behaviour:
- **Busy:** the dialog cannot be closed while busy.
- **Footer:** "Try another file" (error), "View library" (done → `/library`), and Close/Cancel.
- **Idle hint:** "Read books become finished; to-read and currently-reading land in your Want-to-read shelf." It omits the DNF mapping.
- **`done` event:** emitted, but neither host listens for it.

The page-count note cannot be followed: Book Detail has no edit action, and edit is touch-swipe-only (LIB-102). ⚠ LIB-D22 ⚠ LIB-D14
- **Enforced:** `client` (`src/components/import/LibraryImportDialog.vue:24-131`; `src/components/import/ImportSummaryPanel.vue:14-53`)
- **Source:** same

#### LIB-85 · Imported books in stats
| Imported books are **excluded** from | Imported books are **included** in |
|---|---|
| yearly quest and XP (`get_reading_quest_summary.progress_rows` filters `coalesce(source,'manual') = 'manual'`) | `get_library_breakdown` |
| `get_reading_stats.totalPagesRead` | `get_library_with_progress` |
| | profile "books finished" / Book Lengths (progress store) |
| | Reading DNA input |

Because `source` never changes, an imported book read later in-app stays excluded from pages and completion XP. Its history rows still count toward session XP, streaks and charts.
- **Enforced:** `server:rpc` (`get_reading_quest_summary`, `get_reading_stats`)
- **Source:** live function bodies; `supabase/migrations/20260619_library_import.sql`
- **Note:** Profile-side rules: [07](07-profile-stats-goals.md) (PRO-97). Open question LIB-Q16.

#### LIB-86 · "View Reading Journey" gate
The passport button is offered only when `source === 'manual'` **and** the book is complete. Nothing checks whether a passport exists. As a result:
- Manual books completed without `updateProgress` show the button and land on the endless "Your passport is being generated. Check back in a moment." state. This covers the "Already finished" add (LIB-17) and the page-count edit (LIB-63). ⚠ LIB-D16
- Imported books never show the button, even after an in-app finish generated a passport. The completion prompt's "View Journey" still routes there.
- **Enforced:** `client` (`src/pages/BookDetailPage.vue:123`; `src/components/book/BookProgressPanel.vue:137-143`)
- **Source:** same; `src/pages/BookPassportPage.vue:23-32,85-90`
- **Target:** The passport job is server-owned at completion (BC-05). The gate is open: LIB-Q09.

### Delete

#### LIB-87 · Delete confirmation
| Element | Value |
|---|---|
| Header | "Remove Book" |
| Message | `Remove "{title}" and all its data? This cannot be undone.` |
| Buttons | "Cancel" / "Remove" (danger) |
| Failure toast | "Remove failed" / "Could not remove the book. Try again." (3 s) |

There is no undo and no soft delete. Delete is reachable only by swipe on touch devices (LIB-102).
- **Enforced:** `client` (`src/pages/LibraryPage.vue:124-145`)
- **Source:** same
- **Note:** Open question LIB-Q12.

#### LIB-88 · Delete cascade
`removeBook` issues one statement, `books.delete().eq('id', id)`, and relies on RLS. FK cascades do the rest in that statement:

| Effect | Objects |
|---|---|
| **ON DELETE CASCADE** | `reading_progress`, `progress_history`, `recaps`, `lexicon_entries` (incl. mastered), `book_passports`, `lore_cards`, `page_captures` (incl. resumes), `vocabulary_extractions`, `up_next_order`, `book_quizzes`, `circle_reactions` (this book), `reading_circles` anchored on this book |
| Second level | `reading_circles` → `circle_invitations`, `circle_members`, `circle_reactions`: a circle built on the book is wiped **for all members** (community is dormant, [10](10-community-circles.md)). A member's own reactions are keyed to *their* `book_id`, so deleting that member's book removes only their reactions. `page_captures` → `vocabulary_extractions.capture_id` is SET NULL, but those rows go anyway through their own `book_id` cascade |
| **ON DELETE SET NULL** | `reading_quest_events.book_id`: only the **page-capture** XP (+5 each) survives |
| XP recomputed live | `get_reading_quest_summary` computes `pages_read + 25·completed + 10·history rows + 5·capture events + 20·recaps + 15·lore`. Deleting a book removes its pages, completion, session, recap and lore XP, and can lower the reader's level and yearly quest count |
| Kept | `achievements`, `reading_dna` (`books_finished_at_generation` not lowered), `reading_goals`, `anki_review_sessions`, `user_settings` |
| **Not cleaned up** | Storage `recap-images/{uid}/{recapId}.png` (orphaned) ⚠ LIB-D24 |

A delete that matches 0 rows (already deleted elsewhere) returns no error, so the UI removes the card and reports success. supabase-js does not retry the DELETE on network errors.
- **Enforced:** `server:db` (FKs listed; no trigger on `books`); `client` (`src/stores/books.ts:413-418`)
- **Source:** live `pg_constraint` (FKs referencing `books`, `reading_circles`, `page_captures`); live `get_reading_quest_summary`; `supabase/functions/generate-recap/utils/storage.ts:11`
- **Target:** Recap images for the deleted recaps/book are purged by an edge function, because `storage.protect_delete` blocks SQL deletes; an orphan sweep backs this up (BC-13, recommended). Delete policy (undo, circles, XP) is open: LIB-Q12, LIB-Q15.

#### LIB-89 · Client state after delete
**Updated:**
- Removed from local `books`, `libraryEntries` and the progress map.
- `books` touched.
- Invalidated: `progress`, `library`, `libraryBreakdown`, `readingQuest*`, `lexicon:{uid}*`, `recaps:{uid}:{id}`, `bookPassport:{uid}:{id}`.

**Left stale:**
- **Not** invalidated: `readingStats`, `lastSession` (the Last Session card can still show the deleted book), `readingRecords`, `velocity`, `lore:*`, `recaps:all:{uid}`, `upNext`. The local up-next array keeps the id, which is harmless.
- In-memory per-book stores (lexicon, recaps, passport, captures, lore, quiz, recap gallery) are not purged.
- In-flight AI jobs for the book are not cancelled and fail after being paid for.
- A queued offline save for the book fails on every drain.

⚠ LIB-D24
- **Enforced:** `client` (`src/stores/books.ts:420-434`)
- **Source:** same; full matrix in [11 · Cross-domain](11-cross-domain.md) (delete a book)

### DNF shelf

#### LIB-90 · Who can be shelved
DNF can be marked only from Book Detail, via the link "Didn't finish it? Shelve this book". It is offered only when the book is not complete (`percentage < 100`) and not already DNF.

| Element | Copy |
|---|---|
| Confirm header | "Didn't finish?" |
| Confirm message | "Shelve this book as Did Not Finish? Your progress and words are kept, but sessions, recaps and insights are paused until you resume." |
| Buttons | "Shelve it" / "Keep reading" |
| Error | "Could not shelve the book. Try again." (inline in the progress panel) |
- **Enforced:** `client` only. The DB has no constraint against shelving a finished book or starting a session on a shelved one.
- **Source:** `src/components/book/BookProgressPanel.vue:181-188`; `src/pages/BookDetailPage.vue:223-240`
- **Note:** Open question LIB-Q11.

#### LIB-91 · Shelving write
`markDnf` upserts `reading_progress {current_page: local ?? 0, dnf_at: clientNowISO, session_start_at: null, session_paused_at: null}` (`onConflict book_id,user_id`). This creates the row for a never-started book and ends any running session **without** a history row: no session XP, no capture prompt. `progress_history` is untouched.

Two problems follow from writing `current_page` from the **local** progress map:
- **Rollback:** the upsert's `DO UPDATE` overwrites the server page with whatever this device last saw, rolling back a page saved on another device.
- **Zeroing:** when the local entry is missing, `0` is written.

Because `current_page` is in the SET list, the completion triggers re-evaluate; they are a no-op unless the book is complete. `dnf_at` comes from the client clock (UTC ISO). `updated_at` is bumped, which moves the book to the top of the RPC order and resets the recap idle clock ([03](03-recaps.md)). ⚠ LIB-D23
- **Enforced:** `client` (`src/stores/progress.ts:350-388`)
- **Source:** same; see [02](02-reading-sessions.md) (SES-75, SES-87)
- **Target:** A server DNF RPC sets `dnf_at` on the server clock, clears the session columns and **never sends `current_page`**. It inserts page 0 only when no row exists (BC-04).

#### LIB-92 · Resume
`resumeDnf` runs `update {dnf_at: null}` matched on book and user, then `.single()`, so it requires an existing row. Status returns to the percentage-derived value. Page, percentage and Up Next row are untouched, `updated_at` is bumped (LIB-47), and no completion trigger fires because `current_page` is not sent.

| Surface | Success | Failure |
|---|---|---|
| DNF page ("Resume") | toast "Back on the shelf" / "The book is back in your reading list." | toast "Resume failed" / "Could not resume the book. Try again." |
| Book Detail ("Start reading again") | no toast | inline "Could not resume the book. Try again." |

The Book Detail shelved notice reads "Shelved as Did Not Finish · {formatRelativeToNow(dnfAt)}".
- **Enforced:** `client` (`src/stores/progress.ts:390-417`; `src/pages/DnfListPage.vue:39-59`; `src/pages/BookDetailPage.vue:242-248`; `src/components/book/BookProgressPanel.vue:86-98`)
- **Source:** same
- **Target:** A server resume RPC on the server clock (BC-04).

#### LIB-93 · Where DNF books are excluded
**Excluded:**
- Library list sections (status filter) and grid tiers (`!dnfAt`);
- `progressStore.inProgressBooks`;
- `useActiveBook.sortedInProgress` and hero revalidation;
- the Dashboard Up Next shelf and `useDashboardOnboardingState.queuedBooks`;
- `startSession`, which throws "This book is shelved as Did Not Finish. Resume it first.";
- Book Detail: Memory Check, the capture prompt, Lore Chronoscope/Insights, the recap section, the page-edit pencil, session controls and the Codex/Words chips are hidden.

**Not excluded:**
- `progressStore.completedBooks` (no DNF filter) ⚠ LIB-D33;
- `get_library_breakdown`, which counts a DNF book as reading or unread ⚠ LIB-D33;
- Library search, which deliberately shows a DNF group;
- every server stat (LIB-44).
- **Enforced:** `client` (`src/pages/LibraryPage.vue:55-85`; `src/stores/progress.ts:280-282,679-699`; `src/composables/useActiveBook.ts:46-49,98-114`; `src/pages/DashboardPage.vue:202-207`; `src/composables/useDashboardOnboardingState.ts:21-26`; `src/pages/BookDetailPage.vue:286-304`; `src/components/book/BookProgressPanel.vue:76,87-188`)
- **Source:** same; live `get_library_breakdown`

#### LIB-94 · DNF list rows
- Rows are sorted by `dnfAt` desc.
- Detail line: `stopped at p. {currentPage} · {round(pct)}%` when `currentPage > 0`, plus `shelved {formatRelativeToNow(dnfAt)}`, joined with " · ". `formatRelativeToNow` returns "Just now" under 120 s, else date-fns `formatDistanceToNow` with a suffix.
- Imported DNF rows at page 0 (`source !== 'manual' && currentPage === 0`) show **no** detail line.
- Tapping a row opens Book Detail.
- Empty state: "Nothing shelved" / "Books you mark as Did Not Finish will land here — you can pick them back up anytime."
- **Enforced:** `client` (`src/pages/DnfListPage.vue:17-37,91-105`; `src/utils/date.ts:20-25`)
- **Source:** same

#### LIB-95 · Imported DNF timestamp
Imported DNF books get the **import time** as `dnf_at`, not their original shelving date.
- **Enforced:** `client` (`src/stores/books.ts:286,339`)
- **Source:** same
- **Note:** Open question LIB-Q08.

### Ebook support (spec 033)

#### LIB-96 · No book format
No per-book format exists: no `format` column, type or UI. This matches spec 033 FR-012 ("MUST NOT model or store a per-book format"). Progress is always tracked in **pages**; there is no percentage or location mode.
- **Enforced:** by absence (live `information_schema.columns`; `src/types/index.ts:5-18`; `BookForm`)
- **Source:** `specs/033-ebook-support/spec.md` FR-012
- **Note:** Open question LIB-Q14.

#### LIB-97 · Ebook = "Upload image" in the capture prompt
The page-capture prompt offers "Upload image" beside "Take photo", via a hidden `<input type="file" accept="image/*">`. `imageNormalize` decodes the file, downscales it so the long edge is ≤ 2000 px, and re-encodes it as JPEG at quality 0.85.
- A decode failure (`'not-an-image'`) or canvas failure (`'canvas-unavailable'`) becomes the capture error state, with no `ocr-page` call.
- Offline → the `'offline'` state.
- The image is never persisted.
- **Enforced:** `client` (`src/utils/imageNormalize.ts:7-55`; `src/composables/useCapture.ts:195-222`; `src/components/session/SessionCaptureField.vue:45,69,238`)
- **Source:** same; OCR rules: [04](04-capture-resume-quiz.md)
- **Target:** On iOS, on-device Apple Vision text recognition runs first, with the `ocr-page` (Gemini) edge function as the low-confidence fallback. The Gemini-calibrated 0.90 / 0.70 thresholds must be recalibrated for Vision (D-15).

#### LIB-98 · No ebook detection
Ebook detection from Google or Open Library metadata is intentionally not attempted, and adding a book never asks about format.
- **Enforced:** by absence
- **Source:** `specs/033-ebook-support/spec.md` FR-004, Assumptions

### Display, forecast & interaction details

#### LIB-99 · Cover placeholder and broken covers
The placeholder is the uppercased first letters of the first two title words.
- **Initials** appear only when `coverUrl` is null or `''`, and only on `BookCard`, `BookGridCard` and `ReadingWideCard`.
- **Book icon** is the no-cover placeholder everywhere else: `BookDetailHeader`, `QueueReorderList`, the DNF list, search results, `SearchBookHero`.
- **Broken URL:** on image error, `coverFallback` hides the `<img>`. **No surface falls back to initials.** `BookCard` and `BookGridCard` add `--hidden` (`display: none`) to their placeholder whenever `coverUrl` is truthy, so they show a blank box / tinted tile. `v-else` cards (`ReadingWideCard`, `BookDetailHeader`, `QueueReorderList`) show an empty box. The DNF list has no error handler and shows the browser's broken-image glyph.

⚠ LIB-D31
- **Enforced:** `client` (`src/utils/coverFallback.ts:1-3`; `src/components/books/BookCard.vue:31-37,63-72,144`; `src/components/books/BookGridCard.vue:36,92`; `src/components/library/ReadingWideCard.vue:50-52`; `src/components/book/BookDetailHeader.vue:24-28`; `src/components/library/QueueReorderList.vue:44-46`; `src/pages/DnfListPage.vue:117-125`)
- **Source:** same

#### LIB-100 · Card meta and badges
- "Page {current} of {total}" when `currentPage > 0`.
- "Set page count" when `pageCountEstimated` — a non-interactive label.
- "Imported" when `source !== 'manual'`.
- Days-left: "~{n} days left" (list) or "~{n}d left" (wide card), or "Finish today!" for `'today'`. Hidden at ≥ 100 %.

The badges appear only on Library list and search `BookCard`s: not on the Dashboard, grid tiles, wide cards or Book Detail.
- **Enforced:** `client` (`src/components/books/BookCard.vue:23-29,78-80,92-102`; `src/components/library/ReadingWideCard.vue:28-31`)
- **Source:** same

#### LIB-101 · Days-left forecast (`get_reading_velocity`)
`get_reading_velocity(p_user_id, p_book_ids) → table(book_id, days_left)` (SECURITY DEFINER, owner check since BC-01, LIB-116):
- **History window:** `progress_history` rows with `recorded_at > now() − 30 days`.
- **Session deltas:** `lag(page)` over **in-window rows only**, partitioned by book, ordered by `recorded_at`. Only rows with `session_start_at` set and a positive delta count. If at least 3 qualify, `avg` = their mean ("pages per session").
- **Day deltas:** otherwise, the delta for each `date_trunc('day', recorded_at)` in the DB time zone (**UTC**) is `max(page) − min(page)` within that day. If at least 3 days are positive, `avg` = their mean. A day with a single save contributes 0, so a once-a-day saver never qualifies.
- **Result:** `days_left = ceil((total − current) / avg)`, returned only when `avg > 0` and remaining > 0. It is therefore always ≥ 1, and the client's `'today'` branch is **unreachable**.

The per-session average is presented as days. The forecast is requested only for `status === 'reading'` ids. ⚠ LIB-D29
- **Enforced:** `server:rpc` (`get_reading_velocity`); `client` (`src/composables/useReadingVelocity.ts:45-56`; `src/pages/LibraryPage.vue:111-112`)
- **Source:** live function body
- **Target:**
  - Day boundaries in the reader's IANA time zone via a `p_timezone` parameter (D-07 · BC-06).
  - Untimed rows count for pages, but the session average uses only real timed sessions (D-08).

#### LIB-102 · Swipe actions (touch only)
Swipe activates only on `matchMedia('(pointer: coarse)')`. The drag is clamped to [−152 px, 0]; release beyond −72 px snaps open, otherwise closed. Spec 019 FR-005's desktop "⋯" alternative was never built, so **desktop users cannot edit or delete anywhere**. Further behaviour:
- `openCardId` is declared inside `<script setup>`, so despite the comment it is **per instance**, and several cards can be open at once.
- Tapping an open card closes it, but the inner `BookCard` `@click="navigate"` fires first (bubbling, nothing stops propagation), so the same tap also navigates to Book Detail.
- Touch listeners are passive, with no vertical-scroll lock.
- The action strip is `aria-hidden="true"`, so screen-reader users cannot reach Edit or Delete.

⚠ LIB-D14
- **Enforced:** `client` (`src/components/library/SwipeableBookCard.vue:7-116`; `src/components/books/BookCard.vue:39,50`)
- **Source:** same
- **Note:** Open question LIB-Q06.

#### LIB-108 · Velocity cache scope
Velocity results live in one module map under the single SWR key `velocity:{uid}`, with a 365-day TTL and no refocus revalidator. Each caller passes only *its* book ids, and the result **replaces** the whole map:
- The hero asks for 1 id; the Library asks for all reading ids. After the Dashboard runs first, the key is fresh, so Library cards for every non-hero book show no finish date.

The key is invalidated only when a session ends, a book is added with an initial status, or an import runs. It is **not** invalidated by a `total_pages` edit, so "finish by ~{date}" keeps the old total until the next session end or reload. A failed fetch empties the map. ⚠ LIB-D29
- **Enforced:** `client` (`src/composables/useReadingVelocity.ts:24-80`; `src/stores/progress.ts:603-604`; `src/stores/books.ts:242,361,407-410`)
- **Source:** same
- **Note:** Native clients key the forecast per book and refresh it after any save or page-count edit.

### Connectivity

#### LIB-115 · Library mutations are online-only
- Add, edit, delete, reorder, DNF shelve/resume and search have **no** offline handling and are never queued. They fail with the generic copy (LIB-110) or a toast.
- ISBN lookup silently returns `null` offline, so the form opens empty.
- Only CSV import checks `navigator.onLine` (LIB-67).
- Offline **table reads** take about 7 s to fail, because supabase-js retries GETs 3 times with 1/2/4 s backoff. The RPC (POST) fails immediately.
- Only page saves have an offline queue ([02](02-reading-sessions.md), [08](08-platform-auth-account.md)).
- **Enforced:** `client`
- **Source:** `src/composables/useLibraryImport.ts:96-100`; `src/composables/useIsbn.ts:27-29,55-57`; `@supabase/postgrest-js@2.103.2` retry (GET/HEAD/OPTIONS only)

---

## Flows

### F1 · Library load (`/library`)
1. `fetchLibraryWithProgress()` — key `library:{uid}`, TTL 60 s:
   - `fresh` → no call.
   - `background` → serve the cached data and revalidate silently.
   - `loading` (first visit, **or the first access after any `invalidate`**) → 3-row skeleton → RPC → `libraryEntries` + `books` (`createdAt ''`).
   - Failure → LIB-112.
2. `Promise.all([progress.fetchProgress(), upNext.fetchOrder()])`:
   - Progress derives its map from `libraryEntries` with no network call, keeps newer local entries, and drains the offline queue if online.
   - An up-next failure rejects the mount chain, so step 3 never runs.
3. `loreStore.fetchLoreForAllBooks()` (fire-and-forget) → `velocity.fetch()` for the reading ids.

Persisted: nothing (read-only).

### F2 · Scan / typed-ISBN / manual add
```
home ──Scan ISBN──▶ scan ──barcode / typed ISBN──▶ lookup (Google → OL) ──▶ form(prefill + raw isbn)
  │                  └──Skip / empty "Look up"──▶ form(empty)
  └──Add Manually──▶ form(empty)
form ──Save──▶ validate ─fail─▶ field errors (stay)
                         └ok──▶ books.insert().select().single() ──err──▶ "Failed to save book" (stay on form)
                                   │ok  [book row COMMITTED]
                                   ├─ queued: done
                                   └─ reading/finished: reading_progress upsert (quiet, LIB-17)
                                         └─err──▶ "Failed to save book"; orphan queued book remains; retry ⇒ duplicate (LIB-111)
                                   └──▶ route '/' (Reading now) or '/library'
```
- **Persisted:** the `books` row, then optionally `reading_progress`. No transaction.
- **Offline:** no guard. The lookup returns `null` (empty form); the insert fails with the generic copy.
- **Camera denied or missing:** LIB-19 (dead viewport). The manual ISBN box still works.
- **Target:** one server add call (book + initial progress + optional baseline history) (BC-04 / BC-15, recommended).

### F3 · Search & add
1. Typing ≥ 2 characters runs a debounced search: spinner "Searching…" → results / "No books found…" / warn error with Retry (LIB-30, LIB-32).
2. Selecting a result pushes `add-book-details` with `{source:'googlebooks', key: encodeURIComponent(volumeId)}`. The route is refresh-safe because everything is re-derived from `key`.
3. The details page aborts any previous load, resets state, warms the library (LIB-25), and runs `getBookDetail` (Google → Open Library gap-fill). Recommendations load in the background.
4. View mode shows the hero, duplicate notice, description, "Edit details", the status selector, and a current-page input for "Reading now".
5. "Edit details" opens a metadata-only `BookForm` with description. "Done" changes the draft only; nothing is written to the DB.
6. "Add to Library" validates (LIB-26) → `addBookWithInitialStatus` → routes (LIB-18). An error shows red text and the page stays.
7. Unmount aborts in-flight requests (`onBeforeUnmount`).

### F4 · CSV import
```
idle ─select file─▶ [offline?] ─yes─▶ error("You are offline…")
                      └no─▶ parsing ─unrecognized─▶ error
                                    ─0 usable rows─▶ error
                                    └─▶ importing: insert chunks(100) → status upserts(100) → library refetch
                                           ─throw─▶ error("Import failed.")  [earlier chunks persist; NO statuses written]
                                           └─▶ enriching: batches of 3, 150 ms gaps, per-book errors swallowed
                                                  └─▶ done → summary
error ─Try another file─▶ idle;   done ─View library─▶ /library;   dialog hide ─▶ reset
```
- **Persisted per step:** book rows per 100-chunk → progress rows for completed/DNF per 100-chunk → per-book `books` updates during enrichment.
- **Abort:** closing the tab mid-enrichment leaves books un-enriched, with no resume. Navigating away does **not** stop enrichment (LIB-81). The Book Detail backfill (LIB-42) only ever fills descriptions.
- **Target:** client parses → one idempotent server import RPC (dedupe, books, statuses in one transaction) → server or proxy enrichment job (BC-15, recommended).

### F5 · Edit
1. Swipe → Edit → dialog prefilled with title, author, totalPages, genre, coverUrl and isbn.
2. Save → `books.update({...}).eq('id').select().single()` → replace the local book, touch/invalidate (LIB-64) → close.
3. Error → unhandled; the dialog stays open with nothing shown (LIB-65). Cancel or a mask click closes without a dirty check.

### F6 · Delete
1. Swipe → Delete → confirm (LIB-87).
2. `books.delete().eq('id')` → FK cascades complete server-side in the same statement (LIB-88).
3. Local removal + partial invalidation (LIB-89). Error → toast.
- **Target order (native and future web):** cancel the book's AI tasks and queued offline ops → delete on the server → purge Storage objects (BC-13, recommended) → purge every per-book local artefact and invalidate stats, quest, last-session, velocity, lore and gallery caches.

### F7 · Queue reorder
1. Enter reorder mode: list = Queue tab with ≥ 2 books; grid = expanded queue with > 1 book.
2. Drag → drop → `saveOrder` (optimistic) → upsert:
   - success: touch `upNext:{uid}`;
   - failure: revert + toast.
3. "Done" or a tab switch exits reorder mode.

Reorder is not offered during search.

### F8 · DNF state machine
```
unread / reading ──markDnf (confirm)──▶ dnf      [upsert: local current_page, dnf_at=now(client), session cleared; no history]
dnf ──resumeDnf──▶ status re-derived from current_page: unread → back in Queue at its old up_next index (or appended)
                                                       reading → top of In Progress (updated_at bumped)
                                                       finished → stays finished
finished ──✗ (UI hides the action; DB would allow it)
```
- **Persisted:** one `reading_progress` write per transition; `updated_at` is bumped each time.
- **Failure:** inline error on Book Detail; toast on the DNF page (LIB-92).
- **Offline:** fails, nothing is queued.

### F9 · Book status lifecycle (as the Library sees it)
```
(no progress row) unread ─startSession─▶ unread (page 0, session active; Dashboard treats it as in progress)
unread ─save page > 0─▶ reading ─save page ≥ total─▶ finished            (02 owns saves and completion effects)
reading ─edit total_pages ≤ current─▶ finished   (no completion effects, LIB-63)
finished ─edit total_pages > current─▶ reading   (un-completed, −25 XP)
any non-finished ─markDnf─▶ dnf ─resume─▶ derived
imported 'read' with placeholder ─enrichment total > 100─▶ reading       (defect LIB-82)
```

### F10 · Description backfill (Book Detail)
`onMounted` chain: `fetchLibrary` (if needed) → `fetchProgress` (if needed) → recaps → passport → lexicon → mark lore seen → `backfillDescription()`. The backfill runs only when the description is falsy; LIB-42 gives the steps and failure behaviour. The only write is `updateBook({description})`.

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| books `TTL` | 60 000 ms | `books:{uid}` SWR freshness | `src/stores/books.ts:25` |
| `LIBRARY_TTL` | 60 000 ms | `library:{uid}` (RPC) freshness | `src/stores/books.ts:81` |
| upNext `TTL` | 60 000 ms | `upNext:{uid}` freshness | `src/stores/upNext.ts:8` |
| progress `TTL` | 30 000 ms | `progress:{uid}` freshness | `src/stores/progress.ts:20` |
| velocity `TTL_MS` | 365 days | velocity cached until explicitly invalidated | `src/composables/useReadingVelocity.ts:25` |
| `IMPORT_CHUNK` | 100 | rows per import insert/upsert request | `src/stores/books.ts:253` |
| `PLACEHOLDER_PAGES` | 100 | `total_pages` for imports without a page count | `src/stores/books.ts:254` |
| `ENRICH_CONCURRENCY` | 3 | parallel enrichments per batch | `src/composables/useLibraryImport.ts:14` |
| `ENRICH_DELAY_MS` | 150 ms | pause between enrichment batches | `src/composables/useLibraryImport.ts:15` |
| enrichment calls / book | ≤ 5 external + 1 PATCH | worst case per imported book | `src/composables/useLibraryImport.ts:55-72`; `src/composables/useIsbn.ts:86-103` |
| `cleanIsbn` min length | ≥ 10 chars | CSV ISBN acceptance | `src/utils/import/shared.ts:9` |
| failure row offset | +2 | CSV row number shown for skipped rows | `src/composables/useLibraryImport.ts:119` |
| `SEARCH_PAGE_SIZE` | 20 | Google results per page | `src/services/bookSearchService.ts:23` |
| `MIN_QUERY_LENGTH` | 2 | minimum characters to search | `src/composables/useBookSearch.ts:13` |
| search debounce / maxWait | 300 ms / 1000 ms | live search pacing | `src/composables/useBookSearch.ts:106` |
| `REC_LIMIT` | 12 | max recommendations | `src/services/bookSearchService.ts:228` |
| rec page size | 24 (`REC_LIMIT + 12`) | Google `maxResults` for recommendations | `src/services/bookSearchService.ts:273` |
| rec random offset | 0–7 | variety between visits | `src/services/bookSearchService.ts:270` |
| rec subject queries | ≤ 3 | specific subjects tried | `src/services/bookSearchService.ts:250` |
| `GENERIC_SUBJECTS` | 10 labels | excluded from recommendation subjects | `src/services/bookSearchService.ts:49-60` |
| `CLAMP_THRESHOLD` | 280 chars | "Read more" on the details page | `src/components/books/BookDescription.vue:10` |
| `ACTION_WIDTH` | 152 px | swipe action strip width | `src/components/library/SwipeableBookCard.vue:23` |
| `THRESHOLD` | 72 px | swipe distance to snap open | `src/components/library/SwipeableBookCard.vue:24` |
| scan acceptance | mean error < 0.15 | barcode accepted (single read) | `src/composables/useScanner.ts:48` |
| camera constraints | 1280×720 ideal, `environment` | scanner | `src/composables/useScanner.ts:17-21` |
| barcode readers | `ean_reader`, `ean_8_reader` | symbologies | `src/composables/useScanner.ts:24` |
| form page input | 1 – 99 999 | `BookForm` InputNumber bounds | `src/components/books/BookForm.vue:130-131` |
| "Reading now" page | 1 … total − 1 | in-progress add bound | `src/components/books/BookForm.vue:66-73`; `src/stores/books.ts:218-220` |
| DB title length | 1–500 | `books_title_check` | live |
| DB author length | 1–200 | `books_author_check` | live |
| DB total_pages | ≥ 1 | `books_total_pages_check` | live |
| DB isbn pattern | `^\d{9}[\dX]$\|^\d{13}$` | `books_isbn_check` | live |
| velocity window | 30 days | history considered | live `get_reading_velocity` |
| velocity min samples | ≥ 3 sessions, else ≥ 3 days | forecast eligibility | live `get_reading_velocity` |
| velocity / quest day boundary | UTC | `date_trunc('day', …)` and `make_timestamptz(…,'UTC')` | live `get_reading_velocity`, `get_reading_quest_summary` |
| quest XP per completed manual book | 25 | lost again on delete or un-completion | live `get_reading_quest_summary` |
| toast life | 3000 ms | Library/DNF toasts | `src/pages/LibraryPage.vue:140,157`; `src/pages/DnfListPage.vue:47,54` |
| "Just now" | < 120 s | DNF "shelved …" copy | `src/utils/date.ts:23` |
| `MAX_EDGE` | 2000 px | ebook screenshot downscale | `src/utils/imageNormalize.ts:7` |
| `JPEG_QUALITY` | 0.85 | ebook screenshot re-encode | `src/utils/imageNormalize.ts:8` |
| supabase-js auto-retry | 3 retries, 1/2/4 s | GET/HEAD/OPTIONS only, on network error or 503/520 | `@supabase/postgrest-js@2.103.2` |
| localStorage `library-view-mode` | `'list'`\|`'grid'` (default list) | view persistence | `src/pages/LibraryPage.vue:34-37` |
| localStorage `library-active-tab` | `'queue'`\|`'completed'` (default queue) | list tab persistence | `src/components/library/LibraryListView.vue:28-33` |
| localStorage `library-grid-collapsed` | JSON `{reading,queue,archive}` | grid collapse persistence | `src/components/library/LibraryGridView.vue:42-60` |

---

## Data touchpoints

| Object | Read / write | By whom | Contract |
|---|---|---|---|
| `books` | R/W: insert (add, import), update (edit, enrichment, description backfill), delete | client (`src/stores/books.ts`) | [backend contract](../backend-contract.md) §3, §5 |
| `reading_progress` | W: initial status, import statuses, DNF mark/resume; R via RPC (fallback select on deep link) | client (`src/stores/progress.ts`, `src/stores/books.ts`) | §3, §9 (triggers) |
| `up_next_order` | R (`select * order by sort_position`); W (upsert on reorder) | client (`src/stores/upNext.ts`) | §3 |
| `progress_history` | R (velocity); cascade-deleted with the book | `get_reading_velocity` | §3, §8 |
| `get_library_with_progress` | R | Library, Dashboard, Profile, details page | §8, §12 (IDOR) |
| `get_reading_velocity` | R | Library cards, Dashboard hero | §8, §12 |
| `get_library_breakdown`, `get_reading_quest_summary`, `get_reading_stats` | R (affected by add, import, edit, delete, DNF) | Profile ([07](07-profile-stats-goals.md)) | §8 |
| `normalize_isbn`, `books_normalized_isbn_user_idx` | internal | community functions ([10](10-community-circles.md)) | §9 |
| Child tables of `books` (cascade) | deleted on book delete | DB FKs | §4 |
| Storage `recap-images/{uid}/` | orphaned on book delete | — | §7 |
| Google Books `volumes`, `volumes/{id}` | R | client (`bookSearchService.ts`, `useIsbn.ts`) | §11 |
| Open Library `api/books` | R | client (`bookSearchService.ts`, `useIsbn.ts`) | §11 |

---

## Client-side logic & server migration

Every client implements the "Today" column now. Items marked → server move under the named work package (D-06, D-05: backward compatible, the PWA migrates too).

| # | Logic | Rules | Today | Target owner |
|---|---|---|---|---|
| 1 | Owner isolation of library/velocity/breakdown RPCs | LIB-116, LIB-101 | caller passes own uid; the server asserts it (BC-01, shipped 2026-10-19) | server |
| 2 | ISBN normalisation, checksum, 10→13 | LIB-04/05/72/117 | partial client strip; DB rejects | → server normalises (BC-15); client pre-validates for field errors |
| 3 | Initial-status page clamp + quiet write | LIB-14–17 | client | → server add RPC with baseline history (BC-04; baseline recommended) |
| 4 | Interactive add atomicity | LIB-111 | none | → server (BC-04 / BC-15) |
| 5 | Duplicate detection | LIB-24, LIB-75/76 | client, needs full library loaded | import dedupe → server (BC-15); interactive notice per LIB-Q02 |
| 6 | CSV import writes, status mapping, dedupe | LIB-66–83 | client | → idempotent import RPC (BC-15); CSV parsing may stay client-side |
| 7 | Metadata search/merge, recommendations, enrichment, description backfill | LIB-27–43, LIB-81 | client, direct to Google/Open Library | → server book-search proxy (BC-15); merge rules ideally inside the proxy so clients are identical |
| 8 | `page_count_estimated` clearing | LIB-09/62 | client | client (or server trigger, LIB-Q05) |
| 9 | DNF / resume writes | LIB-90–92 | client upsert with local page | → server RPCs, server clock, no `current_page` (BC-04) |
| 10 | DNF guards (no DNF on finished, no session on DNF) | LIB-90, LIB-93 | client only | → server checks inside BC-04 session/DNF RPCs |
| 11 | Completion effects on add-as-finished / page-count edit | LIB-17, LIB-63, LIB-86 | none fire | → server owner (BC-05); scope per LIB-Q01/LIB-Q04 |
| 12 | "Finished this year" dating | LIB-63 | `updated_at` (UTC) | → `completed_at` stamped by server (BC-04) |
| 13 | Velocity day boundary | LIB-101 | UTC | → `p_timezone` (BC-06) |
| 14 | Delete Storage cleanup | LIB-88 | none | → edge function + sweep (BC-13) |
| 15 | Library delta / pagination | LIB-116 | full JSON array | → `changed_since` RPC (BC-14) |
| 16 | Up Next semantics (unordered last, dense positions, stale-row tolerance) | LIB-55–58 | client | client; row cleanup per LIB-Q03 (server trigger recommended) |
| 17 | Section/status derivation for optimistic UI | LIB-44/46 | client mirror (uncapped %) | client; mirror server precedence, cap at 100 |
| 18 | Single status source for list + grid | LIB-48/49 | two sources | client (use RPC `status`) |
| 19 | Library search normalisation and grouping | LIB-53, LIB-104 | client | client |
| 20 | Blank → NULL for genre/cover/description | LIB-07/11 | web leaks `''` | client (optionally a server CHECK/trigger) |
| 21 | `current_page` clamp to `[0, total_pages]` | LIB-44 | client | client + server RPC validation (BC-04) |
| 22 | Deterministic tie-break of library order | LIB-47 | none | client until the RPC adds `, b.id` |
| 23 | Journey gate | LIB-86 | `source === 'manual'` | per LIB-Q09 |
| 24 | Cover placeholder, swipe/context actions, view prefs | LIB-99/102, LIB-50/51 | client | client |

Full cross-domain register: [12 · Client logic register](12-client-logic-register.md).

---

## Caching & offline

**SWR primitive** (`src/composables/useCache.ts`): a module-singleton `Map<key, {fetchedAt, ttlMs, inflight, subscriberCount}>`.
- `swrStatus`: `fetchedAt === 0` → `'loading'`; within TTL → `'fresh'`; else `'background'`.
- `invalidate` sets `fetchedAt = 0`, so the next access is a **blocking `'loading'`** (skeleton), not the background revalidation the comment claims.
- `swrRun` dedupes concurrent fetchers. It stamps `fetchedAt` when the fetch *completes*, so an `invalidate` issued during an in-flight fetch is lost until the TTL expires.
- On tab refocus, stale keys with a registered revalidator (`books`, `library`, `progress`, `upNext`) refresh in the background. `velocity` has none.
- `clearAll()` runs when the auth user id changes. Pinia state (`books`, `libraryEntries`, `upNextOrder`) is **not** reset (LIB-114).

Platform-level details: [08](08-platform-auth-account.md).

**Keys used here:** `books:{uid}`, `library:{uid}`, `progress:{uid}`, `upNext:{uid}`, `libraryBreakdown:{uid}`, `readingStats:{uid}`, `readingQuest:{uid}*` (prefix), `velocity:{uid}`, `lexicon:{uid}*`, `recaps:{uid}:{bookId}`, `bookPassport:{uid}:{bookId}`.

**Invalidation matrix:**

| Action | touch | invalidate | Notably **not** invalidated |
|---|---|---|---|
| `addBook` | books | library, libraryBreakdown, readingQuest* | — |
| `addBookWithInitialStatus` | books, progress | progress, library, readingStats, libraryBreakdown, readingQuest*, velocity | — |
| `importBooks` | books | progress, library, libraryBreakdown, readingStats, readingQuest*, velocity; then awaits the library refetch | readingRecords (no history written anyway) |
| `updateBook` (edit, enrichment, backfill) | books | library, libraryBreakdown, readingQuest* | **progress, velocity, readingStats, readingRecords, lastSession** |
| `removeBook` | books | progress, library, libraryBreakdown, readingQuest*, lexicon*, recaps(book), bookPassport(book) | **readingStats, lastSession, readingRecords, velocity, lore*, recaps:all, upNext** |
| `saveOrder` (success) | upNext | — | — |
| `markDnf` / `resumeDnf` | progress | library | readingStats, libraryBreakdown, readingQuest, lastSession, velocity |

**Device preferences (localStorage):** `library-view-mode`, `library-active-tab`, `library-grid-collapsed`. They are not user-scoped and survive sign-out. Reads and writes are not wrapped in try/catch (only the grid JSON parse is), and the stored values are cast without validation. ⚠ LIB-D35

**Service worker:**
- `book-covers` (CacheFirst, 200 entries / 30 d, `covers.openlibrary.org`) probably stores nothing, because `<img>` responses are opaque.
- `isbn-api` (NetworkFirst, 100 / 7 d, `openlibrary.org/api/*`).
- Google Books API and Google thumbnails are not cached.

Details: [08](08-platform-auth-account.md).

**IndexedDB:** only the progress offline queue (`chronicler-offline/progress_queue`). Library mutations never use it (LIB-115).

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| LIB-D01 | `get_library_with_progress`, `get_reading_velocity`, `get_library_breakdown`, `get_last_session` are SECURITY DEFINER with no `auth.uid()` check (LIB-116, LIB-101) | Any signed-in user can read another user's library, progress, session state and DNF state by UUID | BC-01: assert `p_user_id = auth.uid()`, keep the param **Fixed 2026-10-19 (BC-01):** all four raise `42501 not_allowed` unless `p_user_id = auth.uid()`. |
| LIB-D02 | Client ISBN handling violates `books_isbn_check`: hyphens/spaces (manual and typed), lowercase x, EAN-8 scans, `cleanIsbn` lengths 11/12/14+; no checksum (LIB-04/05/19/72) | Add fails with generic copy; one bad CSV ISBN aborts a 100-row chunk | BC-15 server normalisation + client pre-validation; invalid import ISBN → NULL |
| LIB-D03 | DB errors (CHECK, RLS, network) surface as "Failed to save book" / "Import failed." because supabase-js errors are not `Error` instances (LIB-110) | Users cannot tell what to fix (e.g. a too-long title or a bad ISBN) | Map PostgREST codes to field messages; validate before writing |
| LIB-D04 | Interactive add is not atomic (LIB-111) | Orphan queued book; retry creates a duplicate | Single server add call (BC-04/BC-15), or delete the book on progress failure |
| LIB-D05 | Scanned/typed ISBN cannot be cleared (`data.isbn ?? resolvedIsbn`) (LIB-22) | User cannot fix a wrong or hyphenated ISBN | Use the form value as-is, including `null` |
| LIB-D06 | Search details allow "Reading now" at page 1 of a 1-page book, which saves as finished (LIB-15) | Inconsistent with BookForm; silent completion | Apply the LIB-14 rule in both places |
| LIB-D07 | Blank genre/cover saved as `''` instead of NULL (LIB-07/11) | Latent data inconsistency (breakdown, `v-if` checks) | Blank → NULL in all clients |
| LIB-D08 | Client percentage uncapped; bars overflow (LIB-45) | > 100 % shown until refresh | Cap at 100; derive at use time |
| LIB-D09 | Library order has no tiebreaker (LIB-47) | Arbitrary order among imported books | Add `, b.id` (or title, id) to the RPC `ORDER BY` |
| LIB-D10 | Library RPC failure renders "Your library is empty" or a stale list without error (LIB-112) | Users think their library is gone | Render an error state with Retry |
| LIB-D11 | Grid uses progress-store percentages, list uses RPC status; Dashboard Up Next shelf can include the hero (LIB-49/60) | Same book in different sections on different screens | Single status source (RPC); exclude the hero from the shelf |
| LIB-D12 | `up_next_order` rows never cleaned; position collisions; stale rows drive hero inference (LIB-58) | Re-queued books jump to old slots; wrong Dashboard hero | Delete the row when a book leaves the queue (server, with BC-04); decide LIB-Q03 |
| LIB-D13 | Edit dialog: ignored status radios block Save; no description; always clears `page_count_estimated`; errors unhandled; fields revert after a failed save; no dirty check (LIB-61/62/65) | Edits fail silently or lose data | Metadata-only mode, catch + toast, stable `initial`, clear the flag only when pages change |
| LIB-D14 | Edit/delete touch-only; actions `aria-hidden`; several cards open at once; a tap on an open card also navigates; import note "open a book to set the real number" cannot be followed (LIB-102, LIB-84) | Desktop and screen-reader users cannot edit or delete | Edit/Delete on Book Detail + context menu on every device (LIB-Q06) |
| LIB-D15 | `total_pages` edit: no completion effects, retroactive quest/XP by old `updated_at`, stale progress-map % survives refetch, stale velocity (LIB-63/64/108) | Silent finish/un-finish, wrong bars, wrong forecasts, missed Insight milestones | BC-04 `completed_at`, BC-05 server effects; derive % at use time; invalidate progress/velocity; decide LIB-Q04 |
| LIB-D16 | Manual books completed without `updateProgress` show "View Reading Journey" → endless "being generated" (LIB-86) | Dead-end screen | Gate on passport existence or generate it (BC-05, LIB-Q09) |
| LIB-D17 | Import statuses written only after all inserts; partial failure leaves read/DNF books queued forever (LIB-83) | Wrong statuses that re-import cannot repair | BC-15 atomic import RPC; interim: write statuses per chunk |
| LIB-D18 | Placeholder demotion: an imported "read" book becomes "reading" when enrichment sets the real page count (LIB-82) | Finished books reappear as in progress | When `total_pages` changes on a completed import, set `current_page = new total` |
| LIB-D19 | Import dedupe seeded from in-memory `books` (empty on a cold `/books/add`, previous user's after a switch); ISBN and title keys never cross-match (LIB-75/76) | Whole library duplicated on re-import | Server-side dedupe (BC-15); at minimum load a fresh library first |
| LIB-D20 | `parsePages` strips decimals and commas, no upper bound; header whitespace maps every row to "no title"; StoryGraph UIDs ≥ 10 chars treated as ISBN (LIB-72/74b) | Wrong page counts; aborted chunks; empty imports | Strict integer parser (1–99,999); trim header keys; validate ISBN checksum |
| LIB-D21 | Enrichment not cancellable; keeps writing after navigation; silent no-op if the refetch fails; ≤ 5 external calls/book on a shared key (LIB-81/66) | Background writes, quota exhaustion, un-enriched books | Server/proxy enrichment job (BC-15); cancellable task on native |
| LIB-D22 | Summary counts placeholders at insert time; `done` event unused; idle hint omits DNF mapping (LIB-80/84) | Overstated "needs a page count" note; misleading hint | Recount after enrichment; update the hint |
| LIB-D23 | `markDnf` upserts the local `current_page` (LIB-91) | Cross-device page rollback, or page 0 | BC-04 DNF RPC that never sends `current_page` |
| LIB-D24 | Delete orphans `recap-images` objects; stats/last-session/records/velocity/lore/gallery caches not invalidated; in-flight AI jobs keep running and get billed; queued offline saves stuck (LIB-88/89) | "All its data" is not deleted; ghost data in UI; wasted AI spend | BC-13 Storage cleanup; client purge and cancellation per [11](11-cross-domain.md) |
| LIB-D25 | Scanner: camera failure invisible (reticle over a dead viewport), Retry unreachable, `onDetected` handlers accumulate, no Bookland prefix filter, misleading "2 reads" comment (LIB-19) | Users stuck on a blank scanner; non-book barcodes accepted | Await the init callback before `scanning = true`; `offDetected`; 978/979 filter |
| LIB-D26 | Search: 403/429/5xx shown as "No books found"; load-more not abortable (can append stale results); `hasMore` under-reported (LIB-31/32) | Quota outages look like empty results; mixed result lists | Surface non-OK as errors; abort load-more on a new query |
| LIB-D27 | `getBookDetail` never throws: load-error state unreachable; failure shows a blank "Unknown Author" draft (LIB-35) | Confusing blank draft | Throw on non-OK and show the error state |
| LIB-D28 | Description backfill re-runs on every visit, has no negative cache, may attach another edition's text, has no fallback after an ISBN miss (LIB-42) | Repeated Google calls per open; wrong descriptions | Record attempts; route through the BC-15 proxy |
| LIB-D29 | Velocity: one cache key clobbered between callers; 365-day TTL; not invalidated by edits; `'today'` unreachable; UTC days; per-session average shown as days (LIB-101/108) | Missing or stale finish dates | Per-book cache; BC-06 `p_timezone`; label "sessions left" or compute per day |
| LIB-D30 | Google API key ships in the bundle, and a literal key is committed in `.env.example` (LIB-43) | Anyone can consume the shared quota | Rotate and restrict now; BC-15 proxy |
| LIB-D31 | Broken cover URLs render blank tiles everywhere; DNF list shows the broken-image glyph (LIB-99) | Poor visuals | Show the initials placeholder on load error on every surface |
| LIB-D32 | `normalize_isbn` deletes a lowercase `x` (regex before `upper`) (LIB-117) | Community ISBN matching misses some ISBN-10s | `regexp_replace(upper(p), '[^0-9X]', '', 'g')` (BC-15) |
| LIB-D33 | DNF books counted by `progressStore.completedBooks` (when ≥ 100 %) and by `get_library_breakdown` (as reading/unread) (LIB-93) | Profile/DNA counts disagree with the Library | Decide LIB-Q11; add DNF handling to both |
| LIB-D34 | Adding a book at page N writes no baseline history; the first session counts N pages as read (LIB-17) | Inflated weekly/monthly stats | BC-04 baseline history row (recommended) |
| LIB-D35 | localStorage access not guarded; values unvalidated (LIB-51, Caching) | Page crash where storage throws; wrong tab content | try/catch + validate against allowed values |
| LIB-D36 | Book Detail cold deep link flashes "Book not found."; un-paginated table selects may truncate at `max_rows` [UNVERIFIED] (LIB-113) | Flash of an error state; missing books for very large libraries | Loading state before the fetch; use the RPC / BC-14 |
| LIB-D37 | `useIsbn` variable names inverted; genre not segment-split and no `smallThumbnail` fallback, unlike the search path (LIB-39) | Maintenance confusion; inconsistent genres across paths | Rename; share one Google mapper |
| LIB-D38 | Library Pinia state not reset on user switch (LIB-114) | Previous user's library flashes; import dedupes against it | Reset all user-scoped stores on auth change ([08](08-platform-auth-account.md)) |

---

## Open decisions

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| LIB-Q01 | Do "Already finished" manual adds (and other non-session completions) count as completions for XP, the yearly quest, badges and passport? | Count immediately: +25 XP, `total_pages` pages, current UTC year; no history, no passport (journey button dead-ends); imports do not count | Treat as a backfill: count in the library and "books finished", but not toward XP or the quest; stamp `completed_at` at add time; no passport and no journey button |
| LIB-Q02 | Duplicate policy: block, warn on every add path, or warn only in search? Should import dedupe cross-match ISBN rows with title + author rows? | Warn only on search details; manual and scan have no check; import skips by key, with no cross-match | Non-blocking warning on every interactive path via a server check on normalised ISBN-13 + title/author; import skips with cross-matching (BC-15) |
| LIB-Q03 | Up Next lifecycle and hero inference: new books at the end or top? Delete `up_next_order` rows when a book leaves the queue? Should the hero prefer old queue positions? | New at end; rows never removed; hero ranks by stale queue index first | Keep append-at-end; delete the row server-side when a book starts, finishes, is shelved or is deleted; infer the hero by most recent reading only |
| LIB-Q04 | Editing `total_pages` to ≤ `current_page` (or above it on a finished book): complete with full effects, clamp, or block? | Silent finish/un-finish without effects; quest/XP retroactive | Allow with a confirm; lowering = a completion through the BC-05 server path; raising on a finished book keeps `completed_at` and asks whether to resume |
| LIB-Q05 | Clear "Set page count" only when the number actually changes? Make the badge tappable? | Every edit-dialog save clears it; badge is a label | Clear only on change (server-side if `total_pages` changes); badge opens a pages sheet |
| LIB-Q06 | Where do Edit/Delete live on every client (incl. web desktop)? | Touch swipe only on Library list/search cards | Add Edit/Delete to Book Detail and a context menu on every device; native swipe actions as an extra |
| LIB-Q07 | CSV `currently-reading` rows: keep mapping to Want to read? | → queued (spec 034) | Keep queued (exports have no current page) but list them first in Up Next |
| LIB-Q08 | Which timestamps do imported books get (`completed_at` under BC-04, `dnf_at`)? | No completion date; `dnf_at` = import time | `completed_at` from "Date Read" when present, else NULL (excluded from "finished this year"); keep `dnf_at` = import time |
| LIB-Q09 | "View Reading Journey" gate: `source`-based, or based on whether a passport exists? | Hidden for every imported book; shown for every complete manual book | Show iff a passport row exists (or is being generated server-side) |
| LIB-Q10 | Description policy: negative-cache the backfill? Fetch descriptions during import enrichment? Allow editing descriptions in the edit dialog? | Re-fetched every visit; enrichment skips descriptions; the dialog has no description field | Yes to all three, via the BC-15 proxy |
| LIB-Q11 | DNF scope: can completed books be shelved? Should DNF books be excluded from breakdown and "books finished"? | Completed: blocked in UI only; breakdown and `completedBooks` include DNF | Keep completed books non-shelvable (enforce server-side); add a DNF bucket to the breakdown and exclude DNF from `completedBooks` |
| LIB-Q12 | Delete semantics and safeguards: hard delete without undo? Warn or block when the book has an active session, unsynced saves, an AI job in flight, or an owned circle? Purge Storage synchronously or by sweep? | Hard delete, no undo, no warnings; circle deleted for all members; Storage orphaned | Keep hard delete with confirm + a short client-side undo window; warn on an active session or owned circle; synchronous purge via BC-13 with a sweep backup |
| LIB-Q13 | Free-text search restricted to the device language? | `langRestrict` = first 2 chars of the device language | Keep the default but add an "All languages" option; never restrict ISBN queries |
| LIB-Q14 | Ever support ebook percentage / location progress? | Pages only; no format (spec 033) | Not for v1 |
| LIB-Q15 | Should deleting a book lower the reader's XP and level? | Yes for everything except capture XP | Accept recompute-on-read for v1, or ledger book XP events like captures if level drops prove upsetting |
| LIB-Q16 | How do imported books count once they are read in-app (pages, completion XP, quest), and toward DNA eligibility? | Excluded from pages, completions and quest forever; history counts; included in DNA and "books finished" | Decide with [07](07-profile-stats-goals.md): count organic progress after import (baseline at import page) |
| LIB-Q17 | Should editing title or author regenerate or flag AI artefacts (passport, Insights, DNA input)? | Left frozen | Leave frozen; regenerate on demand only |

Items covered by a Phase 0 work package and therefore not repeated here: RPC authorization (BC-01, Required); baseline history for mid-way adds (BC-04, recommended); first-completion date for the quest (BC-04 `completed_at`); ISBN checksum and 10 → 13 (BC-15, recommended); Google quota / proxy (BC-15, recommended); import atomicity (BC-15, recommended); large-library pagination (BC-14, recommended). Keeping imported "read" books finished after enrichment is treated as a defect fix (LIB-D18).

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)
- **Backend prerequisites:** BC-01 (owner checks) shipped on 2026-10-19. Until BC-15 ships, a native client must re-implement LIB-27–43 and LIB-66–81 exactly, **minus** the defects. Every backend change stays backward compatible for the PWA (D-05).
- **Single source of truth:** keep one `LibraryBookEntry` store keyed by book id, refreshed from the RPC. Derive sections, cards and percentages from it, using RPC `status` for both list and grid. Replace local values with fresher server rows unless a pending local mutation exists. Never decide freshness with `updatedAt >=`: a `books` edit does not change it (LIB-64).
- **Decoding:** the RPC returns camelCase JSON. `percentage` is a decimal number. Timestamps are `timestamptz` with microseconds. `createdAt` and `sessionPausedAt` are absent: fetch `session_paused_at` separately on foreground and refresh ([02](02-reading-sessions.md)).
- **Optimistic status:** use the LIB-44 precedence and cap the percentage at 100. Clamp `current_page` to `[0, total_pages]` before every write.
- **Ordering:** add a deterministic tiebreak (`title`, then `id`) (LIB-47).
- **Writes:**
  - Send `NULL` for blank genre, cover and description.
  - Normalise ISBNs (strip `[^0-9Xx]`, uppercase, checksum, prefer ISBN-13) and never send hyphens.
  - Map PostgREST error codes to field messages instead of a generic string (LIB-110).
- **DNF:** never send `current_page` on shelve. Use `update {dnf_at, session_start_at: null, session_paused_at: null}` when the row exists, and insert page 0 only when none exists, until BC-04 RPCs land. Mirror every exclusion in LIB-93.
- **Edit/delete:** available on every device and from Book Detail.
  - The edit sheet is metadata-only, includes description, and clears `page_count_estimated` only when pages change (LIB-Q05).
  - Confirm deletes with the LIB-87 copy, and warn when the book anchors a circle the reader owns.
  - After a delete, purge every per-book artefact and cancel the book's tasks (F6).
- **Import:**
  - Parse RFC 4180 properly: quoted commas, quotes and newlines. Strip the BOM and the `="…"` guard.
  - Trim header keys; use a strict integer page parser (1–99,999).
  - Dedupe against a **fresh** library, or server-side.
  - Write statuses per chunk. Keep finished imports finished when enrichment changes the page count.
  - Make enrichment cancellable and resumable. Throttle 3-wide with 150 ms gaps (or slower).
  - Imports stay quiet: no history.
- **Search:** debounce 300 ms with cancellation per keystroke. Surface 403/429 as errors. Paginate with `startIndex`. Apply the language rule (LIB-28/LIB-Q13). Keep the http → https cover rewrite.
- **Velocity:** cache per book; refresh after saves and page-count edits (LIB-108).
- **Offline:** cache the library and up-next order locally. Library mutations are online-only in the PWA (LIB-115); decide explicitly before queueing any of them. Search, lookup and import need the network.
- **Privacy disclosures:** search queries and ISBNs go to Google Books and Open Library (Internet Archive). Disclose them as third-party data used for app functionality. Send a descriptive `User-Agent` to Open Library.
- **Android (later):** ML Kit barcode scanning (EAN-13), `ActivityResultContracts.OpenDocument` for CSV, and the same server contracts.

### iOS-specific (iOS 26+, iPhone first — D-04)
- **Barcode scan:** VisionKit `DataScannerViewController` with `.barcode(symbologies: [.ean13])`. Every iOS 26-capable iPhone (A13+) supports it, but still check `isSupported` / `isAvailable`, since the camera can be denied or restricted.
  - Filter to 978/979 and treat EAN-8 / UPC as "not an ISBN".
  - Provide `NSCameraUsageDescription`. On denial show a real error with a Settings deep link (`UIApplication.openSettingsURLString`); the web shows a dead viewport.
  - Add a success haptic on detection.
- **Library UI:**
  - `List` with sections (Now Reading / Queue / Completed). The grid is `LazyVGrid` in `LazyVStack(pinnedViews: [.sectionHeaders])` with `Section(isExpanded:)`.
  - `.searchable` with `.autocorrectionDisabled()` and `.textInputAutocapitalization(.never)`. Match with `folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)` + `contains`, to mirror LIB-53, and keep the four groups including DNF.
  - Persist view mode, tab and collapse state with `@AppStorage` (the same three key names).
  - Toolbars and search use system Liquid Glass (`.glassEffect` / `GlassEffectContainer` only for custom chrome); respect Reduce Transparency and Increase Contrast.
- **Edit / delete:**
  - `.swipeActions(edge: .trailing)` with Delete as `role: .destructive`. This gives one open row at a time, and tapping an open row only closes it.
  - Add `.contextMenu` and a Book Detail toolbar menu (Edit, Delete, "Didn't finish it?").
  - Use `.confirmationDialog` for delete and `.alert` for DNF.
  - Give every action an accessibility label.
- **Queue reorder:** `List` + `.onMove` in edit mode. Persist dense positions 0…n−1 in one debounced upsert, optimistic with revert. Add VoiceOver `accessibilityAction`s "Move up" / "Move down".
- **Import:** `.fileImporter(allowedContentTypes: [.commaSeparatedText, .plainText])` with `startAccessingSecurityScopedResource()`. Run as a cancellable `Task` tied to the import screen, or a resumable background job with `beginBackgroundTask` and a persisted pending-enrichment queue. Optionally add an "Open in The Chronicler" share/import target for exported CSVs (D-03).
- **Covers:** use a disk-cached image pipeline (configured `URLCache` or an image library), because `AsyncImage` has no disk cache. Show the initials placeholder on `.failure` and for `''`/`nil` URLs. Optionally add a zoom navigation transition from cover to detail.
- **Google key:** until BC-15, restrict the key to the iOS bundle (requires sending the `X-Ios-Bundle-Identifier` header). Never embed the key that is committed in `.env.example`.
- **Ebooks:** offer `PhotosPicker` (screenshots), `.fileImporter([.image])` and the camera as peers in the capture prompt. Decode HEIC natively, downscale to a 2000 px long edge, encode JPEG 0.85 (≤ 5 MB for `ocr-page`), and never persist the image. OCR is on-device Vision first, `ocr-page` fallback on low confidence, with thresholds recalibrated (D-15).
- **App Store:** in-app account deletion is required. It removes all books via `auth.users` cascade, and the delete-account edge function purges Storage (D-10 · BC-11). Camera purpose string; red, confirmed destructive actions; Dynamic Type on cards; VoiceOver labels such as "Cover of {title}".
