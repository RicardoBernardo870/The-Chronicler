# Features

Last updated: 2026-10-18

**The Chronicler** is a mobile-first reading companion for physical books and ebooks: a Vue 3 PWA on one shared Supabase backend. "BookHero" is the internal code name for the repo, the Supabase project and code identifiers (D-03). A native iOS app (iOS 26+, iPhone first) comes next and Android later, and every client uses the same backend (D-05).

## How to read this page

This page is the **overview** of every user-facing feature (D-01). Each area has:

- **What it does today**: the behaviour of the web PWA (master @ `8d8701c`), checked against the live Supabase project on 2026-10-18.
- **Key rules**: the important rules in plain words. The IDs in brackets (for example `SES-67`) are stable rule IDs.
- **Implementation**: the main files and backend objects.
- **Rules:** a link to the matching file in the [business-rules catalog](../business-rules/README.md). That catalog is authoritative. It holds every numbered rule, the known defects (`<PREFIX>-Dnn`), the open decisions (`<PREFIX>-Qnn`) and the owner decisions log D-01…D-17.
- **Planned:** decided [Phase 0](../backend-consolidation-plan.md) backend work (`BC-xx`) that changes the feature. None of it is built yet.

Today most domain logic runs **only in the web client**: recap lock, Insight milestones, achievements, review scheduling and completion side effects. The database accepts other writes. Decision D-06 moves the core of it server-side before the iOS build. Table, RPC and edge-function shapes are in the [backend contract](../backend-contract.md). The live DDL snapshot is in [`supabase/reference/`](../../supabase/reference/README.md).

## Feature map

| # | Area | Main screens (web route) | Rules |
|---|---|---|---|
| 1 | [Library](#1-library) — add, search, import, queue, edit/delete, DNF, ebooks | `/library`, `/library/dnf`, `/books/add`, `/books/add/details/:source/:key` | [01 · Library](../business-rules/01-library.md) (LIB) |
| 2 | [Dashboard & active book](#2-dashboard--active-book) | `/` | [02 · Reading sessions](../business-rules/02-reading-sessions.md) (SES) |
| 3 | [Reading sessions & progress](#3-reading-sessions--progress), Focus mode, offline queue | Dashboard hero, `/books/:id` | [02 · Reading sessions](../business-rules/02-reading-sessions.md) (SES) |
| 4 | [Completion & Book Passport](#4-completion--book-passport) | `/books/:id/passport` | [02](../business-rules/02-reading-sessions.md#book-passport), [03](../business-rules/03-recaps.md) |
| 5 | [Recaps](#5-recaps) | Hero, `/books/:id`, `/books/:id/recaps` | [03 · Recaps](../business-rules/03-recaps.md) (REC) |
| 6 | [Page capture & OCR](#6-page-capture--ocr) | Capture prompt after a save | [04 · Capture, Resume & Quiz](../business-rules/04-capture-resume-quiz.md) (CAP) |
| 7 | [Session Resume ("Previously")](#7-session-resume-previously) | Start Session | [04](../business-rules/04-capture-resume-quiz.md#i-session-resume-previously) |
| 8 | [Memory Check](#8-memory-check) | Start Session, "Memory check" chip | [04](../business-rules/04-capture-resume-quiz.md#k-memory-check--eligibility-and-generation) |
| 9 | [Codex: Lexicon, Word of the Day, Vocabulary Review](#9-codex--lexicon-word-of-the-day--vocabulary-review) | `/lexicon`, Dashboard, `/anki-review` | [05 · Codex & Lexicon](../business-rules/05-codex-lexicon.md) (LEX) |
| 10 | [Insights](#10-insights) | `/books/:id`, `/lexicon?tab=lore` | [06 · Insights](../business-rules/06-insights.md) (INS) |
| 11 | [Profile, Reading Quest, stats, achievements, DNA](#11-profile-reading-quest--stats) | `/profile`, `/profile/trophy-room`, `/profile/stats`, `/profile/edit` | [07 · Profile, Stats & Goals](../business-rules/07-profile-stats-goals.md) (PRO) |
| 12 | [Account & sign-in](#12-account--sign-in) | `/login` | [08 · Platform, Auth & Account](../business-rules/08-platform-auth-account.md) (PLT) |
| 13 | [App shell & platform](#13-app-shell--platform) | Bottom nav, theme, toasts, service worker | [08 · Platform, Auth & Account](../business-rules/08-platform-auth-account.md) (PLT) |
| 14 | [Community & Reading Circles (dormant)](#14-community--reading-circles-dormant) | none (backend only) | [10 · Community & Circles](../business-rules/10-community-circles.md) (COM) |
| 15 | [What happens when…](#15-what-happens-when-cross-domain-effects) (delete, complete, DNF, import, sign out) | — | [11 · Cross-domain](../business-rules/11-cross-domain.md) (XD) |
| — | What the database guarantees whatever the client · rules only the web enforces | — | [09 · Database invariants](../business-rules/09-database-invariants.md) (BE) · [12 · Client logic register](../business-rules/12-client-logic-register.md) (CL) |

---

## 1. Library

**What it does.** Readers add books four ways:

- Google Books **search**, which opens a details page;
- **ISBN barcode scan**, or a typed ISBN;
- a **manual** form;
- a Goodreads / StoryGraph **CSV import**.

They browse the library in a list or grid view, search it, reorder the Up Next queue, edit or delete books, and shelve books they did not finish (DNF).

**Key rules**

- **Book record.** The database enforces title 1–500 characters, author 1–200, and total pages ≥ 1. The form only checks for non-empty values, so an over-long value fails with the generic "Failed to save book". Books have no uniqueness constraint. (LIB-02, LIB-03, LIB-12)
- **Initial status on add.** Three options:
  - "Want to read" (the default): no progress row.
  - "Reading now": the page is clamped to 1…total − 1.
  - "Already finished": page = total.

  The write is quiet: no history row, no completion prompt, no passport. A manual "Already finished" book still counts at once toward XP pages, +25 completion XP and the yearly quest. After the add, "Reading now" lands on the Dashboard and everything else on the Library. (LIB-13…LIB-18, PRO-98)
- **Duplicates.** Only the search-details page warns, and the warning does not block: "This book is already in your library. You can still add it." A match is the same normalised ISBN, otherwise the same title and author (case-insensitive). Manual and scan adds are never checked. (LIB-24)
- **Status and order.** `get_library_with_progress` derives the status in this order: DNF → unread (page 0 or no progress row) → finished (page ≥ total) → reading. Books are sorted newest first by the last write to the progress row, which includes page saves, session start/pause and DNF; books without a row use their creation time. There is no tiebreaker. (SES-03, LIB-47)
- **Views.**
  - List view: a Now Reading panel plus Queue / Completed pill tabs.
  - Grid view: collapsible Reading / Queue / Completed sections.
  - Each device remembers the view mode, the active tab and the collapsed sections in localStorage (`library-view-mode`, `library-active-tab`, `library-grid-collapsed`).
  - DNF books appear in neither view. (LIB-48…LIB-51)
- **Library search.** A sticky, client-side search over title and author. It ignores accents and case and covers every status. Results are grouped Now Reading → Queue → Completed → Did Not Finish. (LIB-53)
- **Up Next queue.**
  - The order comes from `up_next_order`. A new book has no row and sorts after the ordered books.
  - "Reorder" mode shows drag handles and saves on every drop.
  - Queue rows are never cleaned up. A book that was once at the top of the queue keeps winning Dashboard hero inference (LIB-D12). (LIB-55…LIB-58)
- **Edit and delete need a touch swipe.** Swiping a list-view or search-result card reveals Edit and Delete. Neither action exists in the grid view, on Book Detail, on the DNF list or on desktop. (LIB-102)
- **Edit.**
  - Saves title, author, genre, cover URL, ISBN and total pages, and always clears the "estimated page count" flag.
  - A page-count change never touches progress. Lowering it to ≤ the current page makes the book finished **without** completion effects. Raising it un-completes a finished book. (LIB-62, LIB-63)
- **Delete** is immediate and permanent after the confirm "Remove "{title}" and all its data? This cannot be undone."
  - The cascade removes progress, history, recaps, Codex entries (mastered ones included), Insights, the passport, captures, the quiz, the queue row and any reading circle anchored on the book.
  - Capture XP survives. All other XP from the book disappears, so the level and the yearly quest can drop.
  - Recap image files stay in Storage as orphans. (LIB-87, LIB-88)
- **Days-left forecast** ("~N days left" on reading cards) comes from `get_reading_velocity`. It is the mean pages per timed session over the last 30 days, which needs ≥ 3 sessions; otherwise it falls back to per-UTC-day deltas, which need ≥ 3 positive days. The result is really "sessions left" and is always ≥ 1. (LIB-101)
- **Card details.** Initials replace the cover only when there is no cover URL. The "Imported" badge and the "Set page count" label (not tappable) appear only on list and search cards. (LIB-99, LIB-100)
- **Description backfill.** Book Detail fetches a missing description from Google Books on **every visit** until one is found, and the result can come from another edition. (LIB-42)
- **Online only.** Library mutations are never queued offline. Only CSV import checks connectivity up front. (LIB-115)

### Search & add (spec 030)

- **Sources.** Google Books is primary for search, ISBN lookup, volume detail, recommendations and import enrichment.
  - Open Library only fills a missing cover, page count, genre, author or subjects by ISBN.
  - It is the full fallback when Google has no ISBN hit.
  - It never supplies descriptions. (LIB-27, LIB-36, LIB-39)
- **Pacing and paging.** Live search starts at ≥ 2 characters, debounced 300 ms (max wait 1 s). It returns 20 results per page (`printType=books`) with "Load more". (LIB-30, LIB-31)
- **Language filter.** Free-text searches send `langRestrict=<browser language>`. A bare ISBN-10/13 query switches to the `isbn:` operator and drops `langRestrict`, because an ISBN names one specific-language edition. (LIB-28, LIB-29)
- **Errors.** A non-OK HTTP response shows as "No books found". (LIB-32)
- **Details page.** Selecting a result opens the refresh-safe page `/books/add/details/:source/:key(.*)`, with:
  - an editable draft and a cleaned description;
  - the duplicate notice;
  - "similar books": up to 3 subject queries, else the genre, else the author; at most 12 results, each with a cover. (LIB-35, LIB-38)
- **Scan.** Quagga2 reads EAN-13/EAN-8. "No camera? Enter the ISBN manually" opens the typed-ISBN lookup. (LIB-19…LIB-21)

### Library import (spec 034)

- **Entry points.** The Add Book hub ("Import from Goodreads or StoryGraph") and the Dashboard empty state ("Import library"). The Library's empty-queue call to action leads to the Add Book hub.
- **Format detection.** The format is detected from the header signature. An unrecognised file or an offline device is refused before any write. (LIB-67, LIB-69)
- **Status mapping:**
  - `read` → finished (page = total);
  - `did-not-finish`, `did not finish` or `dnf` (StoryGraph status or Goodreads shelf) → the DNF shelf (page 0, `dnf_at` = import time);
  - everything else, including `to-read` and `currently-reading` → "Want to read". (LIB-74)
- **Dedupe and insert.**
  - Rows are de-duplicated by ISBN, else by lower-cased title + author, within the file and against the library in memory.
  - Books are bulk-inserted quietly in chunks of 100: no history, recaps, Insights, passports, quest XP or achievements.
  - Each book gets `source` = `goodreads` or `storygraph`. A missing page count becomes a **100-page placeholder** with `page_count_estimated`. (LIB-75, LIB-77, LIB-78)
- **Enrichment.**
  - Runs in the background, 3 books at a time with 150 ms gaps, and cannot be cancelled.
  - Fills the cover, the genre (first segment) and the real page count (placeholders only).
  - Never writes a description or an ISBN. (LIB-66, LIB-81)
- **Imported books in stats.**
  - Excluded from XP pages and completion XP, the yearly quest, the `first_book` / `books_*` achievements and the lifetime "pages read" total.
  - Included in the library breakdown, the Profile "Books" pill, Book Lengths and the Reading DNA input.
  - Once read in-app, their history rows count for streaks, the calendar, the charts and session XP. (LIB-85, PRO-97)
- **Caveats (known defects).**
  - **Idempotent only with the library loaded.** A cold load or refresh of `/books/add` has an empty dedupe seed, so a re-import duplicates everything. An ISBN row never matches an existing book without an ISBN, and vice versa. (LIB-75, LIB-76)
  - **Not transactional.** A failing chunk (for example a title over 500 characters, or a bad ISBN) aborts the import. Earlier chunks stay, and **no status writes run**, so read and DNF books stay in "Want to read". A re-import then skips them as duplicates. (LIB-83)
  - **Placeholder demotion.** A "read" placeholder book whose enrichment finds more than 100 pages is silently demoted to reading (for example 100/350). (LIB-82, SES-29)
  - **Unfollowable hint.** The summary line "N books need a page count — open a book to set the real number" is counted at insert time. It cannot be followed: Book Detail has no edit, and edit is touch-swipe-only. (LIB-80, LIB-84)
  - **No journey button.** "View Reading Journey" is hidden for imported books (manual books only). (SES-52)

### DNF — Did Not Finish

- **Shelve.** From Book Detail only: the link "Didn't finish it? Shelve this book" shows when the book is neither complete nor DNF, and a confirm follows. (LIB-90)
- **Resume.** "Start reading again" on Book Detail, or "Resume" on the DNF list. Resume clears only `dnf_at`. (LIB-92)
- **While shelved:**
  - Book Detail hides session controls, the pencil, the Codex / Words / Memory check chips, the capture prompt, the Insights card and the recap section;
  - the book leaves the hero, In Progress, Up Next and the library sections and grid;
  - Library search still shows it under "Did Not Finish". (LIB-93)
- **DNF list.** The Library header shows a DNF icon only when at least one book is shelved. It opens `/library/dnf`, sorted by shelving date, with rows like "stopped at p. X · Y% · shelved N days ago". (LIB-54, LIB-94)
- **What shelving writes.**
  - It stamps `dnf_at`.
  - It ends a running session **without a history row**: no session credit and no capture prompt.
  - It also re-sends this device's cached page, which can roll back a page saved on another device (LIB-D23). (LIB-91, SES-75)
- **What stays.** History and stats, Codex entries (still reviewed), captures, the quiz, recaps and Insights. Server stats ignore DNF: pages still count toward XP, and the library breakdown counts the book as reading or unread. (LIB-93, PRO-95)

### Ebooks (spec 033)

There is no book-format field, and progress is tracked in pages only. Ebook support means **"Upload image"** in the capture prompt, for a screenshot.

- The image is normalised client-side: long edge ≤ 2000 px, re-encoded as JPEG at quality 0.85.
- `ocr-page` accepts up to 5 MB.
- In-app ebook reading is not supported. (LIB-96…LIB-98, CAP-15)

**Implementation:**

- Pages: `src/pages/LibraryPage.vue`, `AddBookPage.vue`, `BookSearchDetailPage.vue`, `DnfListPage.vue`, `BookDetailPage.vue`.
- Components:
  - `src/components/library/*`: `LibrarySearchBar`, `LibrarySearchResults`, `LibraryListView`, `LibraryGridView`, `SwipeableBookCard`, `QueueReorderList`, `ReadingWideCard`;
  - `src/components/books/*`: `BookForm`, `BookEditDialog`, `BookSearchSection`, `SearchBookHero`, `BookRecommendationsScroller`, `IsbnScanner`, `LibraryStatusSelector`;
  - `src/components/import/*`.
- Stores: `src/stores/books.ts` (incl. `importBooks`), `upNext.ts`, `progress.ts` (`markDnf`, `resumeDnf`).
- Search and ISBN: `src/services/bookSearchService.ts`, `src/composables/useBookSearch.ts`, `useIsbn.ts`, `useScanner.ts`, `src/utils/searchText.ts`, `duplicateBook.ts`, `cleanDescription.ts`.
- Import: `src/composables/useLibraryImport.ts`, `src/utils/import/*`; `papaparse` is lazy-loaded.
- Data: `books` (incl. `description`, `source`, `page_count_estimated`), `reading_progress` (`dnf_at`), `up_next_order`; RPCs `get_library_with_progress` and `get_reading_velocity`.

**Planned:**

- Owner checks on `get_library_with_progress` and `get_reading_velocity`, which today accept any user id (BC-01).
- DNF/resume RPCs that never send `current_page` (BC-04).
- Recap-image purge on delete (BC-13).
- ISBN normalisation, a server book-search proxy and an atomic, idempotent import RPC (BC-15, recommended).

**Rules:** [01 · Library](../business-rules/01-library.md): [CSV import](../business-rules/01-library.md#csv-import-spec-034), [Delete](../business-rules/01-library.md#delete), [DNF shelf](../business-rules/01-library.md#dnf-shelf), [Known defects](../business-rules/01-library.md#known-defects).

---

## 2. Dashboard & active book

**What it does.** The Dashboard (`/`) renders, in order:

1. a time-of-day greeting;
2. a state-dependent body: hero book card → Word of the Day → Last Session → In Progress → Up Next cover shelf → Completed row.

**Key rules**

- **Greeting.** The salutation depends on the device-local hour: < 5 "Up late", < 12 "Good morning", < 18 "Good afternoon", otherwise "Good evening".
  - The date follows, with the name and avatar (the avatar links to `/profile`). The name falls back from display name → username → email local part → "Reader".
  - A reader with no community profile sees one "Set up your reader profile" button instead. (SES-57)
- **Onboarding states.** These decide what renders (SES-55, SES-56):

  | State | When | Body |
  |---|---|---|
  | `empty` | no books | "Build your library" with "Add a book" and "Import library" |
  | `oneQueued` | 1 unread book, nothing reading or completed | "Ready when you are", no hero |
  | `oneInProgress` | 1 reading book, nothing queued | Hero, Word of the Day, Last Session, Completed row if any (no Up Next) |
  | `completedOnly` | only completed books | "Library started", no hero |
  | `standard` | everything else | Full Dashboard |

  The Word of the Day slot renders only in `standard` and `oneInProgress` (LEX-53).
- **Hero ("active book").**
  - **Candidates:** books under 100 % that are not DNF and are either above 0 % or have a running session.
  - **Ranking:** books with an `up_next_order` row come first, by position; the rest follow by most recent progress update.
  - **Explicit choice:** tapping an In Progress row or an Up Next cover makes that book the hero explicitly.
  - **Memory only:** the hero is kept in memory, not persisted, and a reload re-infers it.
  - **Completion:** completing a book moves the hero only if that book was the hero. (SES-58…SES-62)
- **Hero forecast line** (`SES-67`).
  - If the next Insight milestone is ≤ 15 pages away **and** more than 15 pages remain: "N pages to your next Insight".
  - Otherwise: "N pages left", plus "· finish by ~{MMM d}" when a velocity estimate exists. The date is today + `days_left`, and `days_left` is really sessions-left (SES-70).
  - The nudge does not check whether an Insight can actually unlock, which needs a qualifying recap (section 10).
- **Hero actions.**
  - Idle: Start Session and Get Recap. A locked Get Recap shows its lock label ("N more pages" / "Recap in N hours").
  - During a session: timer (pause · stop · count), End Session and "Focus mode".
  - The pencil next to "Page X of Y" corrects the page outside a session.
  - The hero card also hosts the post-save capture prompt, the last session note, the "New Lore" chip and the offline tag "Progress will sync when you're back online". (SES-66)
- **In Progress** lists the other reading books by recency (not queue order), with % and "New Lore" chips. (SES-63)
- **Up Next shelf.** Shown in `standard` only. It holds every book at exactly 0 % that is not DNF, queue order first. Tapping a cover makes it the hero without starting a session. The hero itself is not excluded from the shelf. Reordering happens on the Library page. (SES-64)
- **Completed row.** The completed count plus the 3 most recent covers, as one link to the Library. (SES-65)
- **Last Session card** (`get_last_session`).
  - It shows the most recent history row across **all** books.
  - A timed session renders "Last Session": distance, minutes, pages/hr and "At this pace ~N more sessions".
  - A pencil correction renders "Last Update".
  - The session note is shown on the hero card, not here. (SES-72, SES-73, SES-36)

**Implementation:**

- Page: `src/pages/DashboardPage.vue`.
- Components: `src/components/dashboard/*` (`DashboardGreeting`, `DashboardEmptyState`, `CompletedOnlyState`, `HeroBookCard`, `WordOfTheDay`, `LastSessionCard` / `LastTimedSessionCard` / `LastUpdateCard`, `InProgressSection`, `UpNextSection`, `CompletedSection`).
- Logic: `src/composables/useActiveBook.ts`, `useDashboardOnboardingState.ts`, `useReadingVelocity.ts`, `useLastSession.ts`; `pagesToNextInsight` in `src/utils/milestoneDetect.ts`.

**Planned:**

- The Last Session card is built from the latest **timed** session only (D-08 · BC-04).
- The forecast uses the reader's time zone (BC-06).
- The Insight nudge becomes truthful once Insights have a fallback source (D-12 · BC-08).

**Rules:** [02 · Reading sessions — Dashboard composition and hero](../business-rules/02-reading-sessions.md#dashboard-composition-and-hero), [Finish-date forecast and Insight nudge](../business-rules/02-reading-sessions.md#finish-date-forecast-and-insight-nudge), [Last Session card](../business-rules/02-reading-sessions.md#last-session-card).

---

## 3. Reading sessions & progress

**What it does.**

- **Start.** The reader taps **Start Session**, from the hero or the Book Detail progress panel. A pre-start dialog may come first (sections 7 and 8). The live timer then runs, with pause and resume.
- **End.** **End Session** opens the page sheet "Where did you stop?", with a −/+ stepper and a numeric input. Saving records the page.
- **Correct.** Outside a session, the pencil opens the same sheet as "Update your page" for quiet corrections.
- **After a save.** The reader is offered "Capture this page", or a note.

**Book Detail** (`/books/:id`) is the per-book hub. From top to bottom:

1. A centered-cover hero with the description clamped under it ("Read more").
2. The progress panel: progress bar, "Page X of Y" with the pencil, the session controls, the chips Codex (add word) / Words N / Memory check, "View Reading Journey" (finished manual books only), and the DNF link or the shelved notice.
3. The inline capture prompt.
4. The Insights card.
5. "Recap memories": Get Recap, the image carousel and the history link.

Book Detail has no edit or delete action.

**Key rules**

- **Online only.**
  - Start, pause and resume need a connection: "You appear to be offline. Start Session requires a connection." (SES-09)
  - The client refuses to start a complete, DNF or unknown book; the database would accept the write. (SES-10)
  - A start works even if the book has no progress row yet. (SES-11)
- **Pre-start gate order.**
  1. Memory Check, if eligible.
  2. Otherwise the "Previously" resume, if one exists and is not suppressed.
  3. Otherwise start immediately.

  `session_start_at` is written only when the reader confirms ("Begin reading" / "Skip to reading"). Dismissing the dialog aborts the start and writes nothing. (SES-14, SES-15)
- **Pause / resume.**
  - Pausing stamps `session_paused_at`.
  - Resuming shifts `session_start_at` forward by the paused span, so every duration computed as `recorded_at − session_start_at` excludes paused time.
  - Saving while paused applies the shift first.
  - Pause state survives reloads and devices. (SES-17…SES-21)
- **Cancel.** The stop icon or "Cancel session — no progress saved" opens the confirm "Cancel session?". Cancelling clears the session and writes no history. (SES-22)
- **Page validation.**
  - The page must be 0…total and different from the stored page. An unchanged page shows "You're still on page {n}. Update it to finish the session."
  - The cancel link is always present in end mode.
  - Backward corrections are allowed.
  - The range check is client-side only; the database has no CHECK on `current_page`. (SES-24, SES-05)
- **Pencil.** It shows only when no session is active, so corrections are always untimed. (SES-28)
- **What an online save writes** (three separate calls, not atomic):
  1. `reading_progress.current_page`;
  2. a `progress_history` row (device clock; timed only when it ends a session);
  3. a fire-and-forget clear of the session columns.

  Then come the capture prompt, the completion effects and the Insight milestone check. **Every online save writes a history row**, pencil and backward corrections included. History drives +10 XP per row, streaks, the calendar, the charts and records. (SES-30, SES-32)
- **Session note.**
  - At most 160 characters, trimmed and non-blank.
  - Reachable only through "Add note instead" in the capture prompt.
  - Shown on the hero card when the latest history row is the hero's book. (SES-34…SES-36)
- **Completion** means page ≥ total pages (section 4). (SES-04)

### Focus mode

- **When.** A "Focus mode" button appears only during a session, on the hero and the Book Detail panel. It opens a full-screen overlay: cover, big timer, pause and End Session. Opening or closing it never changes the session. (SES-79)
- **Screen Wake Lock.** Re-acquired when the page becomes visible again. Best-effort, and it needs a secure context: plain-HTTP LAN testing has no `navigator.wakeLock`. (SES-80)
- **Auto-dim.** After 30 s without a touch, a near-black layer fades in with the timer faintly visible. The first tap only wakes the screen. There is no dimming after "Time's up". (SES-81)
- **Reading goal.**
  - Chips 15 / 30 / 45 / 60 min start a display-only countdown from the tap. Tapping the active chip clears it.
  - The countdown pauses with the session.
  - At zero the screen wakes, three double-dings play (880 Hz, about 5 s), Android vibrates, the status becomes "Time's up", End Session pulses and the display counts overtime as `+M:SS`.
  - The session keeps running.
  - The goal is **not persisted**: closing Focus mode or reloading loses it. (SES-82, SES-83)

### Offline progress queue

- **When saves are queued.** Only when `navigator.onLine === false` **at save time**. A save that fails while the browser believes it is online is rolled back with an error, not queued. Only page saves are queued. (SES-76, PLT-43)
- **What an offline save does.** It keeps the optimistic page, stores `{bookId, currentPage}` in IndexedDB (`chronicler-offline` / `progress_queue`) and shows the hero's offline tag.
- **What it skips.**
  - The history row: the pages do not count toward streaks, the calendar or session XP today.
  - The session end: the session stays open.
  - The capture prompt, the passport and Insights.
  - The completion prompt still shows. (SES-77)
- **Replay.**
  - A bare `current_page` upsert as the signed-in user, in FIFO order, with no staleness check. An old queued page can overwrite a newer page saved elsewhere.
  - Triggers: the window `online` event, every progress fetch while online, and the Background Sync tag `progress-sync` (Chromium only), whose service worker asks open windows to flush.
  - Nothing flushes after the tab is closed. Records for deleted books never drain. (SES-78, PLT-47)

**Implementation:**

- Store: `src/stores/progress.ts` (`startSession`, `pauseSession`, `resumeSession`, `clearSession`, `updateProgress`).
- Timer: `src/composables/useReadingSession.ts`.
- UI: `src/components/session/SessionStartButton.vue` (the single session-start entry point for hero and Book Detail), `PageSaveSheet.vue`, `SessionNoteField.vue`, `FocusModeOverlay.vue`, `src/components/book/BookProgressPanel.vue`.
- Helpers: `src/composables/useWakeLock.ts`, `src/utils/pageSave.ts`.
- Offline: `src/composables/useOfflineSync.ts`, `src/sw.ts`.
- Data: `reading_progress` (`session_start_at`, `session_paused_at`), `progress_history` (`session_start_at`, `session_note`).

**Planned:**

- `start/pause/resume/cancel_session` and `save_progress(book, page, note, client_occurred_at, idempotency_key)` RPCs on the server clock. One atomic call writes progress, history and the session end and detects the first completion (D-06 · BC-04).
- Any forward page change counts for pages, streaks and charts, including offline saves replayed with their original time. Session XP, session-count badges and the Last Session card need a real timed session (D-08).
- With idempotency keys, native clients can also queue saves that fail mid-flight.

**Rules:** [02 · Reading sessions](../business-rules/02-reading-sessions.md): [Session start](../business-rules/02-reading-sessions.md#session-start), [Page save](../business-rules/02-reading-sessions.md#page-save-session-end-or-correction), [Focus mode](../business-rules/02-reading-sessions.md#focus-mode), [Offline progress queue](../business-rules/02-reading-sessions.md#offline-progress-queue); platform view in [08](../business-rules/08-platform-auth-account.md#offline-progress-queue).

---

## 4. Completion & Book Passport

**What it does.** When a save crosses 100 %, the reader sees "Finished: {title}" with **View Journey** or **Continue**. The Book Passport (`/books/:id/passport`) shows:

- days to finish, peak-day pages with its date, and words learned;
- an AI-written "Your Story So Far";
- a Share Journey button.

**Key rules**

- **Effects of an online completing save** (SES-39, SES-40):
  - the completion prompt;
  - on the Dashboard, hero re-inference;
  - passport generation when no passport row exists;
  - the capture prompt;
  - an Insight check: reaching 100 % never unlocks a card, but a jump from below 90 % unlocks the 90 % card.
  - In the database, triggers delete **all** of the book's page captures (with their resumes) and its Memory Check quiz.
- **Paths differ.**
  - Adding a book as "Already finished", importing a "read" book, an offline completion and a page-count edit each fire only some of these effects. None of them generates a passport.
  - An offline completion still shows the prompt. (SES-95, SES-46)
- **A completed book** leaves In Progress and the hero. It loses session controls, the pencil, Focus mode, the Memory Check chip, the DNF link and Get Recap. It keeps the Codex chips, Insights, the recap carousel and history. (SES-42)
- **Passport stats** (`get_book_passport_stats`, device time zone).
  - Days = elapsed time from the first to the last history row, at least 1.
  - Peak day = the local day with the most pages read, where pages are high-water-mark deltas.
  - Words learned = every Codex entry for the book, quotes included.
  - The stats are live: every Book Detail or passport view after 60 s re-runs them and rewrites the stored row. (SES-45, SES-48)
- **AI summary.**
  - 90–100 words, Gemini 2.5 Flash, temperature 0.8.
  - Built from title, author and ISBN only, never from the reader's captures or recaps.
  - Generated once, fire-and-forget, on the **first online in-app save that crosses 100 %**, and never regenerated.
  - If generation fails, nothing is stored and the page shows "Your passport is being generated." permanently. (SES-46, SES-49, SES-50)
- **Reaching the passport.** The Book Detail "View Reading Journey" button requires a **manual** book. An imported book completed in-app gets a passport but no button. A manual book added as "Already finished" gets a button that leads to the permanent "being generated" page. (SES-52)
- **Share text.** `I finished "{title}" by {author}! … #TheChronicler`, sent through the Web Share sheet or copied to the clipboard. (SES-51)

**Implementation:**

- UI: `src/pages/BookPassportPage.vue`, `src/utils/completionPrompt.ts`.
- Store: `src/stores/bookPassport.ts`.
- Backend: RPC `get_book_passport_stats`; edge function `generate-recap`, mode `passport_summary`; table `book_passports`.

**Planned:**

- One server owner for completion effects, whatever the client or path (D-06 · BC-05): stats frozen at completion in the reader's zone, an idempotent and retried passport job, the existing purge, Insight milestones, achievements and DNA eligibility.
- First completion is stamped as `reading_progress.completed_at` (BC-04).

**Rules:** [02 · Reading sessions — Completion](../business-rules/02-reading-sessions.md#completion) and [Book Passport](../business-rules/02-reading-sessions.md#book-passport); summary contract in [03 · Recaps](../business-rules/03-recaps.md#blurb--passport-summary).

---

## 5. Recaps

**What it does.** **Get Recap** produces a three-part briefing for the stretch read since the last recap:

- `memory_jogger`: an arc from where the reader left off to the strongest moment;
- `concept_watchlist` ("Keep an eye on", up to 5 names);
- `thematic_bridge`: the open thread.

It opens in a modal (`RecapDialog`) and is saved to the book's recap history. Each recap also gets a 1024×1024 illustration.

**Key rules**

- **Explicit only.** Generation is never automatic. (REC-01)
- **Where the button is.**
  - The hero card, for the active book; it is replaced by End Session during a session.
  - The Book Detail "Recap memories" section header. It shows below 100 %, stays visible during a session, and the whole section is hidden for DNF books. (REC-02)
- **Recap lock** (client-only today):

  | Rule | Detail |
  |---|---|
  | Page threshold | Unlocks at `ceil(min(100, lastRecap% + 5) / 100 × total)`, so a 300-page book with no recap unlocks at page 15. Label "N more pages". (REC-03) |
  | 6 h cooldown | Counted from the **later of the last recap and the last page save**. A page save therefore also locks Get Recap for 6 h. Label "Recap in N hours". (REC-04) |
  | 72 h idle grant | 72 h since **any** write to the progress row (session start, pause, DNF and offline flush included) **and** ≥ 6 h since the last recap. It overrides both locks and is one-shot: the recap it produces re-locks for 6 h. (REC-06, REC-07) |
  | Not live | The lock is not time-reactive. "Recap in N hours" does not count down, and an expired cooldown unlocks only on the next re-render. (REC-10) |
- **Modes** (chosen silently by the client).
  - **Corpus:** used when ≥ 1 saved page capture lies in the window that starts **two recaps back** and the reader has moved past the last recap. It sends up to the 3 highest-page captures, and the byline says "From your captures".
  - **Inferred:** used otherwise. A Gemini 2.5 **Pro** extraction with Google Search grounding (temperature 0, up to 3 calls) feeds a Gemini 2.5 Flash composer.
  - When no capture lies in the one-back stretch, an "Inferred recap" confirm warns that the recap may be less accurate or contain spoilers. (REC-13…REC-17)
- **Pre-start blurb.** There is no blurb button. At page 0 the button is page-locked. A blurb is produced only through the 72 h idle grant on Book Detail for a book with a page-0 progress row. It is stored as a normal recap: it earns XP and gets an image. (REC-32, REC-33)
- **Modal.**
  - A shimmer shows while generating; streamed tokens are never shown. The modal then renders the saved row in an image-first story layout: range chip ("pages 61–104"), "N days later" byline, arc prose, watchlist chips, open-thread quote, and "View history (N)" / "Done". While the image is pending, its slot shows a skeleton and "Illustrating this stretch…". A failed image shows a quiet gradient placeholder with no retry.
  - Closing it on the **Dashboard** aborts and discards the recap.
  - Closing it on **Book Detail** does not: the recap is still saved and illustrated. (REC-38, REC-51, REC-52, REC-55, REC-70)
- **Who writes the row.** The **client** parses the text (3 non-empty keys), inserts the `recaps` row and then requests the image. (REC-36, REC-37, REC-39)
- **Recap images.**
  - A background server job: a Gemini prompt refiner, then OpenAI `gpt-image-2` (1024×1024, quality low).
  - Status goes `pending` → `succeeded` | `failed_safety` | `failed_transient`, with one silent retry and no manual retry.
  - The client polls every 2 s while the status is pending. The Realtime subscription never fires, because no table is in the `supabase_realtime` publication.
  - Images live in the private `recap-images/{uid}/{recapId}.png` and are shown through signed URLs (60 s in the modal, 1 h in carousels). (REC-41…REC-48)
- **Where images show.**
  - The Book Detail carousel: this book's images, not tappable.
  - The Profile "Recap memories" gallery: the 12 newest images across books; a tap opens that book's history.
  - Recap History (`/books/:id/recaps`): the journal of all recaps, newest first. (REC-56, REC-57, REC-69)
- **Recaps feed other features.**
  - **Insights** need at least one mid-book recap at or below the current page (section 10).
  - The latest `memory_jogger` is passed to the resume and the quiz for name continuity.
  - A recap that covers the current page suppresses the resume and quiz prompts.
  - Each recap is worth +20 XP and unlocks the "Storyteller" achievement. (REC-58…REC-62)

**Implementation:**

- Store and client: `src/stores/recaps.ts`, `src/services/recapService.ts`, `src/composables/useRecapLock.ts`, `useRecapImage.ts`, `useRecapGallery.ts`, `src/utils/masterRecap.ts`.
- UI: `src/components/recap/RecapDialog.vue`, `RecapCard.vue`, `RecapHistory.vue`, `RecapImagePanel.vue`, `src/pages/RecapHistoryPage.vue`, `src/components/book/BookRecapCarousel.vue`, `src/components/profile/RecapImagesCarousel.vue`.
- Edge function: `supabase/functions/generate-recap/*` (deployed v84; modes `recap`, `blurb`, `passport_summary`, `recap_image`).
- Data: `recaps`, bucket `recap-images`.

**Planned:**

- `generate-recap` enforces the lock on the server clock, selects the corpus window, persists the validated row itself and returns it. Once generation is paid for, it finishes and saves even if the client goes away (D-06 · BC-07).
- Verified JWTs (BC-02).
- Stale `pending` images move to `failed_transient` and images are deleted with their recap (BC-13).
- Realtime or refresh-on-foreground for image status (BC-14).

**Rules:** [03 · Recaps](../business-rules/03-recaps.md): [Recap lock](../business-rules/03-recaps.md#recap-lock-client-only-today), [Mode selection](../business-rules/03-recaps.md#mode-selection--request-building-client-only-today), [Recap images](../business-rules/03-recaps.md#recap-images), [Recaps as context](../business-rules/03-recaps.md#recaps-as-context-for-other-features).

---

## 6. Page capture & OCR

**What it does.** After an online save, the reader can photograph the page (**Take photo**) or upload a screenshot (**Upload image**). The `ocr-page` edge function (Gemini 2.5 Flash) extracts the text. Captured text grounds corpus recaps, feeds vocabulary extraction, the "Previously" resume and the Memory Check.

**Key rules**

- **When the prompt appears.** After **any** online save that wrote a history row: session ends, pencil and backward corrections, and the completing save. Offline saves never show it.
  - The prompt shows on the hero card (Dashboard) or inline on Book Detail (hidden for DNF).
  - It is one-shot: Save, Skip or "Add note instead" consumes it, and a reload loses it. (CAP-01…CAP-06b)
- **Camera and upload.**
  - The camera prefers the rear lens at the highest resolution.
  - An upload accepts any image the browser can decode (HEIC only where the browser decodes it) and is normalised to ≤ 2000 px, JPEG 0.85.
  - The web always sends JPEG; the server limit is 5 MB.
  - **Images are never stored**, only the text.
  - Inline panels handle a denied or missing camera, offline and OCR errors, each with "Add note instead" / Skip. (CAP-08…CAP-18, CAP-90)
- **Save decision.**
  - Confidence ≥ **0.90** with non-empty text **auto-saves** with no review. A glass toast shows "Page captured".
  - Anything else, or a failed auto-save, opens the full-screen review: edit the text, then "Use Capture", "Retake" / "Re-upload", or close. Browser Back means retake.
  - Below **0.70** the review adds "OCR confidence is low. Review the text before saving."
  - The confidence is the model's self-rating. (CAP-20…CAP-26)
- **Stored capture.**
  - One capture per (book, page). The page comes from the reader's progress, never from the OCR.
  - Text is capped at 10 000 characters.
  - A re-capture keeps the same row and its **old** resume, and does not re-run extraction. (CAP-28…CAP-31)
- **XP.** +5 XP per **unique** captured page, ever; re-captures add nothing. Badges "Chronicler" (1 capture) and "Archivist" (50). The XP event survives deletion of the capture. (CAP-38, CAP-39)
- **Retention.**
  - No per-book cap: captures accumulate until the book is completed.
  - On completion, triggers delete all of the book's captures, their resumes and its quiz.
  - A capture saved on an **already-completed** book is deleted immediately by the database while its +5 XP is still recorded. The client briefly shows it as saved.
  - Book or account deletion cascades everything. DNF and page-count edits purge nothing. (CAP-41…CAP-47)
- **No capture management.** There is no capture list, edit or delete UI anywhere.

**Implementation:**

- UI: `src/components/session/SessionCaptureField.vue`, `src/components/capture/CaptureCameraView.vue`, `CaptureReviewViewport.vue`.
- Logic: `src/composables/useCapture.ts`, `src/utils/imageNormalize.ts`, `src/stores/captures.ts`; glass toast `src/composables/useGlassToast.ts`.
- Edge function: `supabase/functions/ocr-page/index.ts` (v2).
- Data: `page_captures`; trigger `page_capture_quest_event_after_save` → `reading_quest_events`.

**Planned:**

- `ocr-page` gets verified JWTs (BC-02).
- Dead pruning helpers are dropped or locked (BC-01).
- On iOS, on-device Apple Vision runs first with `ocr-page` as the fallback for low confidence. The 0.90 / 0.70 thresholds are Gemini-calibrated and must be recalibrated for Vision (D-15).

**Rules:** [04 · Capture, Resume & Quiz](../business-rules/04-capture-resume-quiz.md): [Save decision](../business-rules/04-capture-resume-quiz.md#e-save-decision-auto-save-or-review), [Retention & completion purge](../business-rules/04-capture-resume-quiz.md#h-retention-completion-purge-and-cascades).

---

## 7. Session Resume ("Previously")

**What it does.** Before a session starts, a "Previously" dialog can recap the reader's **highest-page capture**: up to 3 one-sentence bullets and one tension line, with a "page N" pill. The timer starts only on **Begin reading**. Dismissing the dialog aborts the start.

**Key rules**

- **Generation.** The resume is generated at **capture time**, fire-and-forget, by `generate-page-resume`. The input is only that capture's text, plus the latest recap's memory jogger for name continuity. It never uses book metadata.
  - A capture without a resume is back-filled when Start is tapped, and the tap waits for it.
  - A failed or "insufficient" result is not stored and is retried on every Start. "At most one AI call per capture" therefore holds only for successful generations. (CAP-48…CAP-50, CAP-55)
- **When it is skipped.** When Memory Check is eligible (it takes precedence), when there is no resume ("resume or nothing"), or when the latest recap already covers the current page (`pageSnapshot ≥ currentPage`). An unlocked but unused recap button never suppresses it. (CAP-51…CAP-56, SES-14)
- **Storage.** The resume lives on the capture row (`page_captures.resume`) and is purged with it on completion.
- **Recap lock.** Confirming the dialog writes `session_start_at`, which resets the recap's 72 h idle clock (REC-07). It does not affect the 6 h cooldown.

**Implementation:**

- `src/composables/usePageResume.ts`, `useSessionResume.ts`.
- `src/components/session/SessionResumeDialog.vue`, orchestrated by `SessionStartButton.vue`.
- Edge function: `supabase/functions/generate-page-resume/index.ts` (v3).

**Rules:** [04 · Session resume](../business-rules/04-capture-resume-quiz.md#i-session-resume-previously), [Session-start orchestration](../business-rules/04-capture-resume-quiz.md#j-session-start-orchestration).

---

## 8. Memory Check

**What it does.** A short recall quiz of 1–3 multiple-choice questions, each with exactly 3 options. It is built **only** from the reader's own page captures, plus the latest memory jogger for names, so it is spoiler-safe by construction. There are two entry points:

1. **Session start after time away.** When the book's last page save is **≥ 48 h** old (rolling), capture text exists, no fresh recap covers the position, and the quiz for this position has not been answered yet:
   - the pre-start slot shows an intro, "Quiz me" / "Skip to reading";
   - the AI call happens only on "Quiz me";
   - the timer starts only on begin or skip;
   - dismissing mid-quiz aborts the start.
2. **On demand.** A "Memory check" chip on the Book Detail panel. It shows whenever the book is neither complete nor DNF, including during a session and with zero captures; in that case the dialog invites a capture.

**Key rules**

- **Input.** The quiz uses the **6 highest-page** captures. Options are shuffled once on the server and reused on retakes. (CAP-68, CAP-77, CAP-87)
- **Answering.** Each answer gives instant feedback with "From your capture · page N". (CAP-71)
- **Summary.** "Perfect recall" / "Solid recall" / "It happens — memory fades". On a miss, a link reads "Feeling hazy? Read the full recap", shown when a recap exists. (CAP-74)
- **Saving.** The score is saved only on "See results"; abandoning mid-quiz saves nothing. (CAP-73)
- **Reuse.** One quiz row per book (`book_quizzes`). It is reused while its page snapshot ≥ the current page, so start → cancel → start never re-bills. A new quiz is generated only after the reader passes the snapshot. Retakes update the score. (CAP-63, CAP-67, CAP-69)
- **Suppression.** An on-demand quiz answered at this position also suppresses the session-start prompt. (CAP-66a)
- **Limits.** No XP and no quiz history. The quiz is deleted with the captures on completion. (CAP-76, CAP-78)

**Implementation:**

- `src/composables/useBookQuiz.ts`.
- `src/components/session/MemoryCheckDialog.vue` (intro → questions → summary), orchestrated by `SessionStartButton.vue`; chip in `BookProgressPanel.vue`.
- Edge function: `supabase/functions/generate-book-quiz/index.ts` (v1; a soft failure returns `{quiz: null}`).
- Data: `book_quizzes`, unique per (user, book).

**Rules:** [04 · Memory Check — eligibility and generation](../business-rules/04-capture-resume-quiz.md#k-memory-check--eligibility-and-generation), [answering and scoring](../business-rules/04-capture-resume-quiz.md#l-memory-check--answering-and-scoring).

---

## 9. Codex — Lexicon, Word of the Day & Vocabulary Review

**What it does.** The **Codex** (bottom-nav tab, route `/lexicon`, formerly "Great Library") is the reader's vocabulary vault, with two tabs: **Lexicon** and **Insights** (section 10).

- **Entries.** Each entry belongs to one book. **Words** (`dictionary`) are added by hand with an automatic dictionary lookup, or extracted automatically. **Quotes** (`quote`) are keepsake passages.
- **Review.** Words move through a 5-box Leitner schedule on two surfaces that share **one daily allotment of 20 words**: the Dashboard **Word of the Day** and the **Vocabulary Review** flashcard session (`/anki-review`).

**Key rules**

- **Adding.** "Add to Codex" (from the Codex, or the Book Detail "Codex" chip) switches between Word and Quote.
  - Leaving the Word field fills the definition from the Free Dictionary API (English only). Each lookup clears a definition the reader typed.
  - The database limits the term (and the quote passage) to **1–200 characters** and requires a non-empty definition. Because the note is stored as the definition, **a quote without a note cannot be saved** today, despite the "optional" label.
  - There is no edit, delete, un-master or move anywhere. (LEX-03, LEX-04, LEX-12, LEX-20, LEX-23)
- **Quotes are keepsakes.** They are excluded from Word of the Day, review, due counts, mastery and the header word count. (LEX-21)
- **Lexicon list.**
  - Server-side pagination, **10 per page** with infinite scroll.
  - Search over term and definition (debounced 300 ms), type chips All / Dictionary / Quotes, a book filter and a Newest ↔ A–Z sort.
  - Header "N words · M mastered", where N excludes quotes.
  - `?bookId=` in the URL (from the Book Detail "Words N" chip) pre-filters only the Insights tab, not the Lexicon (LEX-D06). (LEX-70…LEX-82)
- **Leitner schedule.** Intervals of 1 / 2 / 4 / 8 / 16 days by box.
  - Word of the Day "advance" moves a word up one box (+2 d at box 2 … +16 d at box 5). It never masters; a box-5 word is re-scheduled +16 d.
  - Review "Didn't know" resets the word to box 1, due today; it comes back tomorrow.
  - The 1-day interval is never actually applied. (LEX-24…LEX-27)
- **Mastery.** Only "Knew it" in Vocabulary Review masters a word, whatever its box. Mastery is terminal: the word leaves every review queue but stays in the Codex with a "Mastered" badge. The only way back is Undo of the last answer. (LEX-29…LEX-31)
- **Daily limit (spec 032).**
  - At most 20 words a day across both surfaces, counted through `last_reviewed_at`.
  - Eligible words are not quotes, not mastered, due, and not yet reviewed today. They are taken lowest box first, then most overdue.
  - "Review more" grants +20, in memory only (lost on reload). (LEX-34…LEX-41)
- **Word of the Day card.** States, first match wins:
  1. "Vocabulary Review — Ready for review" prompt;
  2. "Daily review done!" with "Review more";
  3. "All caught up! Next word due …";
  4. the word card with "N left" and an advance arrow;
  5. nothing.

  The daily pick is cached per user in `localStorage` (`bookhero_wotd_{uid}`) under the **UTC** date. (LEX-45, LEX-49)
- **Vocabulary Review prompt.** It replaces the Word of the Day when ≥ 3 days have passed since the last review session **and** today's capped set has ≥ 5 words. It is the only in-app entry to `/anki-review`; there is no entry from the Codex. (LEX-54, LEX-55, LEX-57)
- **Vocabulary Review session.**
  - The deck is today's set (≤ 20), shown highest box first.
  - Flip, swipe or buttons. Undo restores the exact pre-answer state, one level.
  - A progress bar, an `en-US` pronunciation button (Web Speech), and a summary with "Worth another look".
  - The session record is saved on the back arrow / "Back to dashboard", not when the reader leaves through the bottom nav after finishing (LEX-D08). (LEX-59…LEX-69)

### Vocabulary auto-extraction

- **Trigger.** Runs after **every** successful capture save, fire-and-forget and invisible. (LEX-83)
- **Ledger.** A `vocabulary_extractions` row per capture (`pending` → `succeeded` | `skipped` | `failed`) makes each capture extract at most once while it exists. (LEX-84)
- **Model.** `extract-vocabulary` (Gemini 2.5 Flash) returns up to 5 advanced words with in-context definitions. (LEX-86)
- **Client filtering.** The client drops likely proper nouns and de-duplicates case-insensitively against **all** of the reader's terms (no lemmatisation). (LEX-87, LEX-88)
- **Insert.** It inserts the rest as `source = 'auto'`, box 1, first review ≈ tomorrow (the UTC date of now + 24 h). (LEX-89)
- **Failures.** Never retried. A capture deleted by the completion purge cannot be extracted. (LEX-91, LEX-94)

**Implementation:**

- Pages: `src/pages/GreatLibraryPage.vue`, `src/pages/AnkiReviewPage.vue`.
- Components: `src/components/lexicon/AddWordDialog.vue`, `LexiconCard.vue`, `src/components/dashboard/WordOfTheDay.vue`, `src/components/anki/SwipeableFlashcard.vue`.
- Logic: `src/stores/lexicon.ts`, `ankiSession.ts`; `src/composables/useGreatLibrarySearch.ts`, `useLeitner.ts`, `useAnkiSession.ts`, `useVocabularyExtraction.ts`.
- Edge function: `supabase/functions/extract-vocabulary/index.ts` (v2).
- Data: `lexicon_entries` (incl. `mastered`, `last_reviewed_at`, `source`), `vocabulary_extractions`, `anki_review_sessions`.

**Planned:**

- A `review_lexicon_entry` RPC that returns box, next review and mastered state, plus the daily tally and due set computed in the reader's time zone, with undo (BC-10, recommended).
- The Word of the Day day follows the reader's time zone (D-07 · BC-06).

**Rules:** [05 · Codex & Lexicon](../business-rules/05-codex-lexicon.md): [Leitner scheduling](../business-rules/05-codex-lexicon.md#e-leitner-scheduling-and-review-outcomes), [Daily review limit](../business-rules/05-codex-lexicon.md#h-daily-review-limit), [Word of the Day](../business-rules/05-codex-lexicon.md#i-word-of-the-day), [Auto-extraction](../business-rules/05-codex-lexicon.md#m-vocabulary-auto-extraction).

---

## 10. Insights

**What it does.** Insight cards are short AI "lore" entries: a title, a 90–160-word body, a type (History, Culture, Geography, Technology or Lore) and up to 5 named entities. Each card gives canonical background for something the reader has already met. Cards unlock as the reader crosses 10 % milestones. "Insights" is the user-facing name; most copy and every internal name still say "lore" (`lore_cards`, `generate-lore`).

**Key rules**

- **Milestones.** 10, 20 … 90 %, never 100 %, so a book holds at most 9 cards. Detection is **client-side**, after an online, server-confirmed page save. A jump across several buckets attempts only the latest one. Offline saves and quiet writes never trigger. (INS-01…INS-08)
- **Recap prerequisite.**
  - A card is generated only if the book has **at least one mid-book recap** at or below the current page (the "Master Recap", the spoiler wall). A page-0 blurb does not count.
  - Because Get Recap is itself locked (+5 %, 6 h cooldown), the 10 % Insight is rare.
  - A milestone crossed without a qualifying recap is **skipped for good**. A recap generated later never back-fills it. (INS-12, INS-12a, REC-59)
- **Silent.** De-duplication allows one card per milestone. Failures are silent and never retried. A global banner "Chronicler is weaving new lore · {title}" shows only while the call runs. The **client** inserts the card. (INS-11, INS-17…INS-21)
- **"New Lore" chip.** Shown on the hero card, the Dashboard In Progress list and Library **list-view and search** cards (not the grid or the DNF list). Opening the book's Book Detail marks all its cards seen. (INS-38…INS-41)
- **Book Detail Insights card.** Collapsed, showing the highest milestone first. The refresh button cycles to a random other card. Hidden when there are no cards or the book is DNF. (INS-43, INS-44)
- **Codex Insights tab.** All books, newest first, with a searchable book filter that is independent of the Lexicon filter. (INS-45, INS-46)
- **XP.** +15 XP per card and the "Lorekeeper" achievement. Deleting a book removes its cards and that XP. (INS-52, INS-53, INS-33)
- **Model.** `generate-lore` deployed v18 (canonical, D-09): Gemini 2.5 Flash, temperature 0.35, accuracy-first prompt. The repo source still differs from the deployed one. (INS-26)

**Implementation:**

- Store and client: `src/stores/loreCards.ts`, `src/services/loreService.ts`, `src/utils/milestoneDetect.ts`, `src/utils/masterRecap.ts`.
- UI: `src/components/lore/LoreChronoscopeCard.vue`, `LoreCardList.vue`, `LoreCardDetail.vue`, `LoreGenerationBanner.vue` (mounted in `App.vue`).
- Edge function: `supabase/functions/generate-lore/index.ts`.
- Data: `lore_cards` (unique per user, book and milestone).

**Planned (D-12 · BC-08):**

- Milestones are detected on the server's save.
- Generation uses recap → captures → spoiler-guarded metadata as its source, so no recap is required.
- Skipped, offline-crossed and failed milestones are back-filled.
- The insert is `ON CONFLICT DO NOTHING`.
- Clients only list cards and mark them seen.
- Repo sources are synced to v18 (BC-03), and the function gets verified JWTs (BC-02).

**Rules:** [06 · Insights](../business-rules/06-insights.md): [Milestones & detection](../business-rules/06-insights.md#milestones--detection-client-only-today), [INS-12 recap prerequisite](../business-rules/06-insights.md#ins-12--recap-prerequisite-spoiler-wall).

---

## 11. Profile, Reading Quest & stats

**What it does.** `/profile` is an identity-first hub that fits about one screen:

- an identity header: avatar inside the yearly-goal ring, "Lv N" badge, name, level title;
- the Reading DNA strip, with the full analysis in a bottom sheet;
- "Your DNA suggests" covers;
- stat pills (Books / Pages / Hours / Streak), all leading to Stats;
- **Trophy room** and **Stats** entry cards;
- the **Recap memories** gallery.

Detail lives one tap deeper: **Trophy Room** (`/profile/trophy-room`) and **Reading Stats** (`/profile/stats`). Customization is at `/profile/edit`.

### Reading Quest, XP & levels

- **XP** = pages read × 1 + completed books × 25 + history rows × 10 + unique captured pages × 5 + recaps × 20 + Insight cards × 15. It is lifetime and recomputed on every read, so it can **drop** when rows are deleted. Pages and completions count **manual books only**. (PRO-01…PRO-06)
- **Levels** (0-based):

  | Level | XP | Title |
  |---|---|---|
  | 0 | 0 | Page Turner |
  | 1 | 1 500 | Chapter Seeker |
  | 2 | 4 000 | Margin Walker |
  | 3 | 8 000 | Lore Keeper |
  | 4 | 14 000 | Archive Runner |
  | 5 | 22 000 | Chapter Sage |
  | 6 | 34 000 | Library Legend |

  (PRO-07)
- **Yearly goal.** One goal per user per year (`reading_goals`), set or edited in the Trophy Room. (PRO-18…PRO-20)
- **Year membership.** A completed manual book counts toward the year in which its progress row was **last written**, using UTC year bounds. A later write can move it to another year. (PRO-09, PRO-10)
- **Pace and status.**
  - Pace metrics: needed / current / forecast per month.
  - Status: no goal · complete · no projection · ahead (≥ 110 %) · on track · behind (≥ 75 %) · comeback. (PRO-12, PRO-14)

### Trophy Room & achievements

- **Layout.** The quest ring with the pace row, the reader-level strip and the **achievements wall**: 17 badges. Earned badges are lit with a date; locked ones are dimmed with their hint visible. (PRO-47, PRO-49)
- **Catalog.** Defined in `src/utils/achievements.ts`. Keys are a persisted contract: `first_book`, `books_5`, `books_10`, `pages_1k`, `pages_10k`, `sessions_50`, `sessions_100`, `capture_first`, `captures_50`, `recap_first`, `insight_first`, `streak_7`, `streak_30`, `century_day`, `deep_dive`, `devoured`, `night_owl`.
- **Sync.** Conditions are evaluated **client-side, only when the Trophy Room mounts**. Newly met keys are written to the insert-only `achievements` ledger, and a badge never regresses. `earned_at` is therefore the time of that visit, not of the accomplishment. (PRO-50, PRO-51)

### Reading Stats

The page order is:

1. **monthly chart**: 12 bars of pages per month, headed by the year number, with a year selector and tap-a-bar detail (`get_monthly_reading`);
2. **reading calendar**: covers of the books read each day, with "+n" for several, and a tappable day list (`get_reading_calendar`);
3. **lifetime grid** (7 tiles, `get_reading_stats`);
4. **personal records**: best day, longest session (12 h cap), fastest finish, longest streak and the night-owl flag (`get_reading_records`);
5. **book lengths**: average, longest and shortest finished (client-side);
6. **library breakdown** with a segmented genre bar (`get_library_breakdown`).

**Time zones are mixed today.**

- The calendar, monthly chart, records and passport use the device's IANA zone.
- Streaks, "this month" and the quest year use **UTC**.
- So the same reading day can count differently across screens.
- **Any** history row marks a streak day, zero-page and backward corrections included. (PRO-23, PRO-24, PRO-32…PRO-35, PLT-62, PLT-63)

### Reading DNA & recommendations

- **Generation.** Automatic, on **Profile mount** only; there is no button.
  - The first generation needs **2 finished books**.
  - It regenerates after +2 finished books or 90 days.
  - "Finished" includes imported books. (PRO-55…PRO-57)
- **Model.** `generate-reading-dna` deployed v8 (canonical, D-09): Gemini 2.5 Flash **with Google Search grounding**. It returns a one-word tone, 3 emojis, a 2–3 sentence personality and 3–5 book suggestions. The client writes the `reading_dna` row. A failure keeps the previous DNA. (PRO-52, PRO-53, PRO-60…PRO-62)
- **Recommendation covers.**
  - Resolved one at a time: Google Books first, Open Library as the fallback.
  - Cached in `localStorage['bookhero:dna-covers']`.
  - A tap opens the add-book details page, or a pre-filled search. (PRO-64…PRO-68)

### Recap memories

The 12 newest **succeeded** recap images across books, through 1 h signed URLs. A tap opens that book's recap history. The gallery loads once per session, so new images appear after a reload. (PRO-69…PRO-72)

### Profile customization (`/profile/edit`)

- **No profile at sign-up.** No community profile exists after sign-up. The first save creates it, so the empty state is "Create your reader profile", not an error. (PRO-73)
- **Username.** `^[a-z0-9_-]{3,30}$`, unique case-insensitively, with a live availability check and a suggestion from the email. Reserved names: `admin`, `api`, `auth`, `bookhero`, `login`, `profile`, `u`. (PRO-74…PRO-77)
- **Other fields:**
  - display name: optional; the 60-character limit is client-only;
  - bio: optional, ≤ 160;
  - a public-profile toggle that is **on** by default for first-time setup;
  - four privacy selects (currently reading, progress, lexicon, DNA), each Everyone / Followers / Nobody, default Nobody. (PRO-80…PRO-83)
- **Avatar.** Downscaled client-side to ≤ 512 px JPEG and uploaded to `community-avatars/{uid}/avatar-{ts}.jpg` on save. Older avatar files are removed best-effort **before** the profile save. (PRO-85, PRO-86)
- **Save.** `upsert_my_community_profile` replaces every field. Typed errors (`username_taken`, `bio_too_long`, …) map to inline copy. (PRO-87, PRO-88, PRO-104)

**Implementation:**

- Pages: `src/pages/ProfilePage.vue`, `TrophyRoomPage.vue`, `ReadingStatsPage.vue`, `ProfileEditPage.vue`.
- Components: `src/components/profile/*` (`ProfileIdentityHeader`, `DnaSignatureStrip`, `MoodSignature`, `DnaRecommendationsScroller`, `ProfileStatsNav`, `RecapImagesCarousel`, `QuestGoalHero`, `ReadingGoalDialog`, `ReaderLevelStrip`, `AchievementsGrid`, `MonthlyReadingChart`, `ReadingCalendarCard`, `LifetimeStatsGrid`, `StatTile`, `RecordsCard`, `BookLengthCard`, `LibraryBreakdownCard`).
- Stores: `src/stores/readingQuest.ts`, `readingDna.ts`.
- Composables: `useReadingProfile`, `useLibraryBreakdown`, `useMonthlyReading`, `useReadingCalendar`, `useReadingRecords`, `useAchievements`, `useDnaRecommendations`, `useRecapGallery`, `useCommunityIdentity`.
- Catalog: `src/utils/achievements.ts`.
- RPCs: `get_reading_quest_summary`, `get_reading_stats`, `get_library_breakdown`, `get_reading_calendar`, `get_monthly_reading`, `get_reading_records`, `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available`.
- Data: `reading_goals`, `reading_quest_events`, `achievements`, `reading_dna`, `community_profiles`, `community_profile_privacy`; buckets `community-avatars` (public) and `recap-images` (private).
- Edge function: `generate-reading-dna`.

**Planned:**

- Every stats RPC takes the reader's time zone, which is also stored server-side (D-07 · BC-06).
- "Finished this year" uses `reading_progress.completed_at` (BC-04).
- Achievements are evaluated server-side with an authoritative `earned_at` (BC-09).
- Completion runs achievements and DNA eligibility server-side (BC-05).
- A NULL-safe guard in `get_reading_quest_summary` and an owner check in `get_library_breakdown` (BC-01).
- iOS v1 edits only the username, display name and avatar, and preserves the bio and privacy settings (D-13).
- The weekly goal (`user_settings`, `upsert_weekly_goal`, `get_retention_summary`) exists in the backend only and has no client.

**Rules:** [07 · Profile, Stats & Goals](../business-rules/07-profile-stats-goals.md): [XP & quest](../business-rules/07-profile-stats-goals.md#xp-levels-and-the-reading-quest), [Achievements](../business-rules/07-profile-stats-goals.md#achievements), [Reading DNA](../business-rules/07-profile-stats-goals.md#reading-dna), [Profile customization](../business-rules/07-profile-stats-goals.md#profile-customization-and-reader-identity).

---

## 12. Account & sign-in

**What it does.** `/login` offers **Sign in** and **Sign up** with email and password, plus "Sign in with magic link instead". Every other route requires a signed-in reader.

**Key rules**

- **Methods.** Email + password sign-in, email + password sign-up, and an email magic link. There is no OAuth, no Sign in with Apple and no MFA. Only the `email` provider has identities in the live project. (PLT-01)
- **Magic link.** A magic link for an unknown email **creates an account**. (PLT-02)
- **Sign-up.** Email confirmation is effectively off: sign-up lands straight on the Dashboard, and nothing else is created (no profile, settings or goal rows). (PLT-06, PLT-71)
- **Session restore.** On cold start, restore waits at most **3 s** for `getSession`, then falls back to the last-user snapshot (`bookhero-auth-user`), so the app boots offline. (PLT-10, PLT-11)
- **After sign-in.** The reader always lands on the Dashboard; a deep link opened while signed out is lost. (PLT-05)
- **Sign-out.**
  - More → "Sign out" revokes sessions on **every device** (global scope).
  - It clears little local state (the progress queue and the per-user caches stay).
  - It fails silently offline. (PLT-14, PLT-15)
- **Not available yet:** password reset or change, email change, **account deletion** and data export. App Store Guideline 5.1.1(v) requires in-app deletion. (PLT-72)
- **Deleting the auth user** (today only from the Supabase dashboard) cascades every user table. Storage files in `recap-images/{uid}/` and `community-avatars/{uid}/` are **not** removed. (PLT-73, PLT-74)

**Implementation:**

- `src/stores/auth.ts`, `src/pages/AuthPage.vue`, the router guard in `src/router/index.ts`.
- `src/services/supabase.ts`, with the retrying fetch.

**Planned:**

- **Sign in with Apple + email/password on web and iOS.** Password reset on both clients. Magic and reset links open through universal links. Existing email users can link an Apple ID from settings, which avoids duplicate empty Hide-My-Email accounts (D-11 · BC-11).
- **Account deletion** on web and iOS, immediate and permanent, after confirmation and re-authentication, through a new `delete-account` edge function. It purges both Storage prefixes, revokes the Apple token and calls `auth.admin.deleteUser`; FK cascades remove the rows (D-10 · BC-11).
- **Also in BC-11:** a custom SMTP provider for branded auth emails. **Still open:** whether to turn on email confirmation (PLT-Q02) and whether data export ships in v1 (PLT-Q07).

**Rules:** [08 · Platform — Authentication methods](../business-rules/08-platform-auth-account.md#authentication-methods), [Account lifecycle & data deletion](../business-rules/08-platform-auth-account.md#account-lifecycle--data-deletion).

---

## 13. App shell & platform

**Key rules**

- **Navigation.** A floating bottom bar: **Home · Library · Codex · Profile · More**.
  - More opens a sheet with Add Book, a Light/Dark mode toggle and Sign out.
  - Library stays highlighted on every `/books/*` route; `/anki-review` highlights no tab.
  - Every route except `/login` and the 404 page requires auth. (PLT-19, PLT-22)
- **Theme.** Dark by default, with a manual toggle stored per device in `bookhero_theme`. There is no "follow system" mode. (PLT-40)
- **Feedback.**
  - A top-centre **glass toast** (success / loading / warn) for capture feedback and load failures.
  - A bottom PrimeVue Toast for page-level outcomes.
  - A global confirm dialog.
  - The lore banner (section 10). (PLT-37, PLT-38)
- **Resilience.**
  - Every PostgREST (`/rest/v1/`) 401 is retried once after 400 ms; this covers the cold-start token race.
  - A persistent failure shows one "Some things didn't load — Reopen the app or refresh the page to try again." notice, at most once per 30 s.
  - The Dashboard shows the same notice when its library load fails. (PLT-33…PLT-36)
- **Caching.** An in-memory stale-while-revalidate freshness layer (`useCache`) sits over the Pinia stores, with TTLs and revalidation on tab refocus. Its metadata is cleared on every identity change; the store contents are not. There is no Realtime, so cross-device freshness depends on TTLs and refocus. (PLT-13, PLT-24…PLT-31, PLT-84)
- **PWA.**
  - Production builds precache the app shell with an SPA navigation fallback. Data is not cached offline.
  - A new deploy activates at once and reloads the page **once**, with no prompt.
  - The manifest ("The Chronicler", portrait, shortcuts "Current Read" and "Add Book") is **not linked** from `index.html`, so browsers ignore it. The iOS home-screen icon and status-bar meta tags are set. (PLT-50…PLT-56)
- **Naming.** Every user-facing surface says "The Chronicler"; "BookHero" appears only in identifiers and storage keys (D-03). (PLT-87)
- **Language.** English only. (PLT-70)

**Implementation:**

- `src/App.vue`, `src/main.ts`, `src/router/index.ts`, `src/layouts/DefaultLayout.vue`.
- `src/components/shared/AppBottomNav.vue`, `GlassToast.vue`.
- `src/composables/useAppTheme.ts`, `useCache.ts`, `useGlassToast.ts`, `useLoadFailureNotice.ts`.
- `src/services/retryingFetch.ts`, `src/sw.ts`, `vite.config.ts`.

**Planned:** realtime or refresh-on-foreground, a delta library RPC and device tokens for push (BC-14, recommended).

**Rules:** [08 · Platform, Auth & Account](../business-rules/08-platform-auth-account.md): [Routing & navigation](../business-rules/08-platform-auth-account.md#routing--navigation), [Service worker & PWA](../business-rules/08-platform-auth-account.md#service-worker--pwa), [Timezone, dates & formatting](../business-rules/08-platform-auth-account.md#timezone-dates--formatting).

---

## 14. Community & Reading Circles (dormant)

**Status.** The whole social layer is built in the backend but has **no client UI**: public profiles, per-surface privacy, follow / block, reader search, "also reading" and invite-only Reading Circles with spoiler-gated reactions. The only community surface in use is **profile customization** (section 11). Under D-13 the follow graph, discovery and circles belong to a much later Community phase, and that backend stays dormant.

**Facts for when the phase resumes**

- **"Also reading"** surfaces readers **you follow** (not your followers). Copies are matched by normalised **ISBN**, in-progress books only, and their privacy settings apply.
- **Circle reactions** are gated by the viewer's **normalised percentage position** in their own copy, not by raw page. Authors can post only at or behind their own saved position.
- **Fixes first.** Before any client ships, the backend needs `BC-01` fixes: an anon-executable `community_remove_pair_follows`, leaking helpers such as `circle_progress_location`, and a direct-insert bypass on `follows`. App Store Guideline 1.2 requires report and moderation tools as soon as profiles are user-visible.
- **No migrations.** None of the community or circle schema has a migration in the repo. It lives only in the live database and in [`supabase/reference/`](../../supabase/reference/README.md).
- **Old plan superseded.** The 2026-07 PWA social rollout plan (discovery → circles + invite links → following feed → clubs) is superseded by D-13. The background design notes are in [`docs/community-design-notes.md`](../community-design-notes.md).

**Implementation:**

- PWA: `src/composables/useCommunityIdentity.ts` (identity only), `src/pages/ProfileEditPage.vue`.
- Tables: `community_profiles`, `community_profile_privacy`, `community_follow_counts`, `follows`, `blocks`, `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions`.
- RPCs: 24 client RPCs, of which the PWA calls 3.

**Rules:** [10 · Community & Circles](../business-rules/10-community-circles.md).

---

## 15. What happens when… (cross-domain effects)

| Action | Main effects | Rules |
|---|---|---|
| **Delete a book** (swipe → Delete) | Hard cascade of every per-book row, including reading circles anchored on the book. Capture XP survives; other XP, the level, the quest count and stats are recomputed and can drop. Recap image files are orphaned. Some client caches (Last Session, gallery, Insights "All Books") keep showing the book until refresh. | [XD: Delete a book](../business-rules/11-cross-domain.md#delete-a-book); LIB-88, LIB-89 |
| **Complete a book** (online save) | Prompt, passport generation, capture and quiz purge, possible 90 % Insight, hero rotation, +25 XP for manual books. Achievements are evaluated only on the next Trophy Room visit, DNA on the next Profile visit. Codex entries stay in review. | [XD: Complete a book](../business-rules/11-cross-domain.md#complete-a-book); SES-39, SES-95 |
| **Mark DNF / resume** | Session ended without history. The book is hidden from every reading surface. Nothing is deleted. Server stats ignore DNF. Resuming re-derives the status: a reading book returns at the top of In Progress, a queued book returns to its old queue position. | [XD: DNF / resume](../business-rules/11-cross-domain.md#dnf--resume); LIB-90…LIB-95, SES-75 |
| **Import a CSV** | Quiet inserts, no history, no XP or quest for imports. Can trigger a Reading DNA generation on the next Profile visit. Enrichment can demote placeholder "read" books. | [XD: CSV import](../business-rules/11-cross-domain.md#csv-import-goodreads--storygraph); LIB-66…LIB-86 |
| **Edit total pages** | Can complete or un-complete a book with no completion effects. The quest year and XP change retroactively. The forecast stays stale until the next session end or a reload. | [XD: Edits outside a session](../business-rules/11-cross-domain.md#edits-outside-a-session); LIB-63, SES-96, PRO-96 |
| **Sign out / switch user** | Global sign-out. In-memory stores, the offline queue and some localStorage keys are not cleared, and no page reload happens. | [XD: Sign-out / user switch](../business-rules/11-cross-domain.md#sign-out--user-switch); PLT-14, PLT-15 |
| **Delete account** | Not available in-app today; planned under D-10 (section 12). | [XD: Delete account](../business-rules/11-cross-domain.md#delete-account); PLT-72 |

Full matrices: [11 · Cross-domain](../business-rules/11-cross-domain.md).

---

## 16. Phase 0 — what readers will notice

The backend work in the [consolidation plan](../backend-consolidation-plan.md) lands before the iOS build. It is client-agnostic and backward compatible: the PWA keeps working and moves to the new RPCs too (D-05).

| Package | User-visible effect |
|---|---|
| BC-01 Security hardening · BC-02 Edge-function auth | None visible. Readers can no longer read another reader's library or stats, and the AI functions reject forged tokens. |
| BC-04 Atomic progress & session RPCs | Saves are atomic and on the server clock. Offline saves count for streaks and charts at their original time. Session XP and the Last Session card come from real timed sessions only. |
| BC-05 Server-owned completion & lifecycle effects | The same completion effects on every client and path, including import, offline and "Already finished". The passport no longer gets stuck on "being generated". |
| BC-06 Timezone standardisation | Streaks, "this month", the quest year and the Word of the Day day follow the reader's own time zone. |
| BC-07 Recap eligibility & persistence server-side | The same recap lock everywhere. A paid recap is always saved, even if the modal is closed. |
| BC-08 Insights orchestration server-side + fallback | Insights no longer need a recap. Skipped milestones are back-filled. |
| BC-09 Achievements server-side | Badges are earned at the moment of the accomplishment, not on a Trophy Room visit. |
| BC-11 Account lifecycle & auth | Sign in with Apple, password reset, in-app account deletion. |
| BC-12 Entitlements & AI-usage foundation | No visible change while tiers are undecided (D-14); the check allows everything. |
| BC-10, BC-13, BC-14, BC-15 (recommended) | Review RPC; image clean-up and no stuck "pending" images; live image status; ISBN hygiene, a book-search proxy and a safe import. |
