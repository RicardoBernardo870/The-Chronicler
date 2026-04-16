# ============================================================
# Create GitHub Issues for Reading Suite v3
# Prerequisites: gh CLI installed and authenticated (gh auth login)
# Run from repo root: pwsh -ExecutionPolicy Bypass -File specs/003-reading-suite-v3/create-github-issues.ps1
# ============================================================

$REPO = "RicardoBernardo870/The-Chronicler"

# Create labels first
Write-Host "Creating labels..." -ForegroundColor Cyan
gh label create "phase:setup"       --color "0075ca" --description "Phase 1 - Migrations & Types"       --repo $REPO --force
gh label create "phase:foundation"  --color "e4e669" --description "Phase 2 - Blocking Prerequisites"   --repo $REPO --force
gh label create "US1"               --color "d93f0b" --description "Library & Dashboard UX"             --repo $REPO --force
gh label create "US2"               --color "e99695" --description "ISBN Field Merge"                   --repo $REPO --force
gh label create "US3"               --color "0e8a16" --description "The Lexicon"                        --repo $REPO --force
gh label create "US4"               --color "1d76db" --description "Reading Pulse"                      --repo $REPO --force
gh label create "US5"               --color "6f42c1" --description "Milestone Recapping"                --repo $REPO --force
gh label create "US6"               --color "f9a825" --description "Reading Odyssey"                    --repo $REPO --force
gh label create "polish"            --color "cccccc" --description "Polish & Cross-Cutting"             --repo $REPO --force
gh label create "parallel"          --color "bfd4f2" --description "Can run in parallel"                --repo $REPO --force
gh label create "migration"         --color "fef2c0" --description "Supabase DB migration"              --repo $REPO --force

Write-Host "Creating issues..." -ForegroundColor Cyan

# ── Phase 1: Setup ──────────────────────────────────────────
gh issue create --repo $REPO --title "T001 [Setup] Apply migration: add page_snapshot to recaps" --label "phase:setup,migration" --body "## Task T001 — Phase 1: Setup

Apply Supabase migration:
\`\`\`sql
ALTER TABLE recaps ADD COLUMN page_snapshot integer;
\`\`\`
Nullable, no default — existing rows keep NULL. New recaps will always populate it.

**File**: Supabase MCP \`apply_migration\`
**Checkpoint**: Migration applied, zero errors."

gh issue create --repo $REPO --title "T002 [Setup] Apply migration: create up_next_order table" --label "phase:setup,migration,parallel" --body "## Task T002 — Phase 1: Setup

Create the \`up_next_order\` table with RLS policy per \`specs/003-reading-suite-v3/contracts/supabase-schema.sql\`.

Stores user-defined ordering for 0%-progress books in the Up Next dashboard section.

**File**: Supabase MCP \`apply_migration\`"

gh issue create --repo $REPO --title "T003 [Setup] Apply migration: create progress_history table" --label "phase:setup,migration,parallel" --body "## Task T003 — Phase 1: Setup

Create the \`progress_history\` append-only table with index per \`specs/003-reading-suite-v3/contracts/supabase-schema.sql\`.

Every progress update will insert a row here to enable velocity & streak calculations.

**File**: Supabase MCP \`apply_migration\`"

gh issue create --repo $REPO --title "T004 [Setup] Apply migration: create lexicon_entries table" --label "phase:setup,migration,parallel" --body "## Task T004 — Phase 1: Setup

Create the \`lexicon_entries\` table with both indexes per \`specs/003-reading-suite-v3/contracts/supabase-schema.sql\`.

Stores dictionary + lore entries per book with Leitner spaced repetition state.

**File**: Supabase MCP \`apply_migration\`"

gh issue create --repo $REPO --title "T005 [Setup] Apply migration: create recap_fragments table" --label "phase:setup,migration,parallel" --body "## Task T005 — Phase 1: Setup

Create the \`recap_fragments\` table with index per \`specs/003-reading-suite-v3/contracts/supabase-schema.sql\`.

Stores background Pass-1 extraction results at milestone boundaries for token-efficient recap assembly.

**File**: Supabase MCP \`apply_migration\`"

gh issue create --repo $REPO --title "T006 [Setup] Apply migration: create book_passports table" --label "phase:setup,migration,parallel" --body "## Task T006 — Phase 1: Setup

Create the \`book_passports\` table per \`specs/003-reading-suite-v3/contracts/supabase-schema.sql\`.

One passport per completed book; stores total days, peak day, vocabulary count, and AI summary.

**File**: Supabase MCP \`apply_migration\`"

gh issue create --repo $REPO --title "T007 [Setup] Extend types/index.ts — pageSnapshot on Recap" --label "phase:setup" --body "## Task T007 — Phase 1: Setup

**File**: \`src/types/index.ts\`

- Add \`pageSnapshot: number | null\` to \`Recap\` interface
- Add \`page_snapshot: number | null\` to \`RecapRow\` interface
- Update \`mapRecap()\` to map \`row.page_snapshot\`"

gh issue create --repo $REPO --title "T008 [Setup] Extend types/index.ts — LexiconEntry types" --label "phase:setup,parallel" --body "## Task T008 — Phase 1: Setup

**File**: \`src/types/index.ts\`

Add:
- \`LexiconEntryType = 'dictionary' | 'lore'\`
- \`LexiconEntry\` interface (id, userId, bookId, term, definition, entryType, contextSentence, pageFound, leitnerBox, nextReviewAt, createdAt)
- \`LexiconEntryRow\` (snake_case DB shape)
- \`mapLexiconEntry()\` mapper"

gh issue create --repo $REPO --title "T009 [Setup] Extend types/index.ts — ProgressHistory, UpNextOrder, RecapFragment, BookPassport types" --label "phase:setup,parallel" --body "## Task T009 — Phase 1: Setup

**File**: \`src/types/index.ts\`

Add interfaces and mappers for:
- \`ProgressHistoryRow\`
- \`UpNextOrder\` + \`UpNextOrderRow\`
- \`RecapFragment\` + \`RecapFragmentRow\`
- \`BookPassport\` + \`BookPassportRow\`"

# ── Phase 2: Foundation ──────────────────────────────────────
gh issue create --repo $REPO --title "T010 [Foundation] progress.ts — insert progress_history on every update" --label "phase:foundation" --body "## Task T010 — Phase 2: Foundational

**File**: \`src/stores/progress.ts\`

After every successful \`updateProgress()\` call, fire-and-forget insert a row into \`progress_history\`:
\`\`\`typescript
supabase.from('progress_history').insert({ book_id, user_id, page: currentPage, recorded_at: new Date().toISOString() })
\`\`\`
Do NOT await — must not block the UI."

gh issue create --repo $REPO --title "T011 [Foundation] recaps.ts — store page_snapshot on recap insert" --label "phase:foundation" --body "## Task T011 — Phase 2: Foundational

**File**: \`src/stores/recaps.ts\`

In \`generateRecap()\`, add \`page_snapshot: currentPage\` to the Supabase insert call so every new recap records the exact page it was generated at."

gh issue create --repo $REPO --title "T012 [Foundation] router/index.ts — add /lexicon and /books/:id/passport routes" --label "phase:foundation" --body "## Task T012 — Phase 2: Foundational

**File**: \`src/router/index.ts\`

Add lazy-loaded routes:
- \`/lexicon\` → \`LexiconPage\`
- \`/books/:id/passport\` → \`BookPassportPage\`

Both require auth (\`meta.requiresAuth: true\`)."

# ── Phase 3: US1 ─────────────────────────────────────────────
gh issue create --repo $REPO --title "T013 [US1] index.html — iOS status bar meta tags for full-bleed gradient" --label "US1" --body "## Task T013 — US1: Library & Dashboard UX

**File**: \`index.html\`

Add:
\`\`\`html
<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">
<meta name=\"theme-color\" content=\"#0a0a14\" media=\"(prefers-color-scheme: dark)\">
<meta name=\"theme-color\" content=\"#f0f4ff\" media=\"(prefers-color-scheme: light)\">
\`\`\`

This allows web content to render behind the iOS status bar."

gh issue create --repo $REPO --title "T014 [US1] main.css — safe-area-inset-top for notch gradient" --label "US1,parallel" --body "## Task T014 — US1: Library & Dashboard UX

**File**: \`src/assets/styles/main.css\`

Add to \`html\` selector:
\`\`\`css
padding-top: env(safe-area-inset-top);
\`\`\`

Combined with the \`black-translucent\` status bar (T013), this ensures content clears the notch while the gradient fills the full screen area."

gh issue create --repo $REPO --title "T015 [US1] LibraryPage.vue — 4-tier sort + viewMode localStorage" --label "US1" --body "## Task T015 — US1: Library & Dashboard UX

**File**: \`src/pages/LibraryPage.vue\`

Replace \`sortedBooks\` computed with 4-tier sort:
1. Most-recently-updated in-progress book (pinned top)
2. Other in-progress books ascending by %
3. 0%-progress books in Up Next order
4. Completed books

Add \`viewMode\` ref persisted to \`localStorage['library-view-mode']\` (default \`'list'\`)."

gh issue create --repo $REPO --title "T016 [US1] Create BookGridCard.vue — cover grid card" --label "US1,parallel" --body "## Task T016 — US1: Library & Dashboard UX

**File**: \`src/components/books/BookGridCard.vue\`

- Cover image (aspect ratio 2:3, object-fit cover)
- Frosted glass gradient scrim at bottom
- 2-line clamped title, muted author text
- 3px indigo progress bar at bottom edge
- Placeholder with book icon + initials when no cover
- Tap → \`router.push({ name: 'book-detail', params: { id: book.id } })\`"

gh issue create --repo $REPO --title "T017 [US1] LibraryPage.vue — grid/list toggle and grid rendering" --label "US1" --body "## Task T017 — US1: Library & Dashboard UX

**File**: \`src/pages/LibraryPage.vue\`

- Add PrimeVue Button toggle (pi-list / pi-th-large icons)
- When \`viewMode === 'grid'\`: render CSS Grid (\`auto-fill minmax(140px,1fr)\`) of \`BookGridCard\`
- When \`viewMode === 'list'\`: render existing list view"

gh issue create --repo $REPO --title "T018 [US1] Create BookEditDialog.vue — pre-filled edit modal" --label "US1,parallel" --body "## Task T018 — US1: Library & Dashboard UX

**File**: \`src/components/books/BookEditDialog.vue\`

- PrimeVue \`Dialog\` wrapping existing \`BookForm\` component
- Pre-fill all form fields from \`book\` prop
- On save: call \`booksStore.updateBook(id, changes)\` then emit \`close\`"

gh issue create --repo $REPO --title "T019 [US1] BookCard.vue — overflow menu with Edit and Delete actions" --label "US1,parallel" --body "## Task T019 — US1: Library & Dashboard UX

**File**: \`src/components/books/BookCard.vue\`

Add \`⋮\` PrimeVue \`Menu\` button with:
- **Edit book** → opens \`BookEditDialog\`
- **Remove book** → PrimeVue \`ConfirmDialog\` (\"Remove this book and all its data? This cannot be undone.\") → on confirm: \`booksStore.removeBook(id)\`"

gh issue create --repo $REPO --title "T020 [US1] Create stores/upNext.ts — Up Next ordering store" --label "US1" --body "## Task T020 — US1: Library & Dashboard UX

**File**: \`src/stores/upNext.ts\`

Pinia setup-function store:
- \`upNextOrder: UpNextOrder[]\`
- \`fetchOrder()\`: loads from \`up_next_order\` ordered by \`sort_position\`
- \`saveOrder(bookIds: string[])\`: upserts all rows with new positions"

gh issue create --repo $REPO --title "T021 [US1] DashboardPage.vue — Up Next section with drag reorder" --label "US1" --body "## Task T021 — US1: Library & Dashboard UX

**File**: \`src/pages/DashboardPage.vue\`

- Add \`upNextBooks\` computed (books where \`percentageForBook(id) === 0\`, sorted by \`upNextStore.upNextOrder\`)
- Add \"Up Next\" section below Completed (hidden when empty)
- Each row: cover thumb (32×48), title, author
- Install \`vuedraggable\` for drag-to-reorder
- On drag end: call \`upNextStore.saveOrder(newBookIds)\`"

gh issue create --repo $REPO --title "T022 [US1] RecapCard.vue — display page_snapshot alongside percentage" --label "US1" --body "## Task T022 — US1: Library & Dashboard UX

**File**: \`src/components/recap/RecapCard.vue\`

Update the header/meta area to show:
\`page {{recap.pageSnapshot ?? '—'}} · {{recap.progressSnapshot}}%\`

Displayed next to the existing date."

gh issue create --repo $REPO --title "T023 [US1] RecapHistoryPage.vue — verify page number visible" --label "US1" --body "## Task T023 — US1: Library & Dashboard UX

**File**: \`src/pages/RecapHistoryPage.vue\` (or \`src/components/recap/RecapHistory.vue\`)

Verify the page number from T022 is visible in the history list. No layout changes required beyond the RecapCard update — just confirm the data flows through correctly."

# ── Phase 4: US2 ─────────────────────────────────────────────
gh issue create --repo $REPO --title "T024 [US2] useIsbn.ts — field-by-field merge from Google Books" --label "US2" --body "## Task T024 — US2: ISBN Field Merge

**File**: \`src/composables/useIsbn.ts\`

Replace current full-fallback logic with field-by-field merge:
1. Run Open Library first
2. If all 4 fields present (coverUrl, totalPages, genre, author) → return immediately
3. Otherwise identify missing fields, run Google Books, merge only missing fields
4. If Open Library returns null entirely → fall back to Google Books as before

Neither source's present fields should overwrite the other."

# ── Phase 5: US3 ─────────────────────────────────────────────
gh issue create --repo $REPO --title "T025 [US3] Create composables/useLexicon.ts — Free Dictionary API" --label "US3,parallel" --body "## Task T025 — US3: The Lexicon

**File**: \`src/composables/useLexicon.ts\`

\`lookupWord(term: string)\` fetches:
\`https://api.dictionaryapi.dev/api/v2/entries/en/{term}\`

Returns \`{ definition: string, phonetic: string | null }\` from \`meanings[0].definitions[0].definition\`.
Returns \`null\` on any error — no throws."

gh issue create --repo $REPO --title "T026 [US3] Create composables/useLeitner.ts — Leitner spaced repetition" --label "US3,parallel" --body "## Task T026 — US3: The Lexicon

**File**: \`src/composables/useLeitner.ts\`

Pure TypeScript (no AI):
- \`INTERVALS = [1, 2, 4, 8, 16]\` days for boxes 1–5
- \`advanceBox(entry)\` → returns updated \`{ leitnerBox, nextReviewAt }\`
- \`resetBox(entry)\` → returns box 1 + nextReviewAt = today
- \`getDueWord(entries)\` → entry with lowest box where \`nextReviewAt <= today\`; ties: earliest \`nextReviewAt\`"

gh issue create --repo $REPO --title "T027 [US3] Create stores/lexicon.ts — Lexicon Pinia store" --label "US3" --body "## Task T027 — US3: The Lexicon

**File**: \`src/stores/lexicon.ts\`

Pinia setup-function store:
- \`entriesByBook: Record<string, LexiconEntry[]>\`
- \`fetchEntriesForBook(bookId)\`
- \`addEntry(input)\` — calls Free Dictionary API via \`useLexicon\` if type is \`'dictionary'\`
- \`updateLeitner(entryId, action: 'advance' | 'reset')\`
- \`wordOfTheDay\` computed: \`useLeitner.getDueWord\` across all entries"

gh issue create --repo $REPO --title "T028 [US3] Create components/lexicon/LexiconCard.vue — flip card" --label "US3,parallel" --body "## Task T028 — US3: The Lexicon

**File**: \`src/components/lexicon/LexiconCard.vue\`

Glassmorphism flip card:
- **Front**: term, type badge (DICTIONARY teal / LORE amber), page number
- **Back**: definition, context sentence, \"✓ I know this\" + \"✗ Review again\" buttons
- CSS \`transform: rotateY(180deg)\` transition 0.5s
- Flip state via local \`ref<boolean>\`
- Buttons emit events to parent (lexiconStore.updateLeitner called in parent)"

gh issue create --repo $REPO --title "T029 [US3] Create components/lexicon/AddWordDialog.vue — add word form" --label "US3,parallel" --body "## Task T029 — US3: The Lexicon

**File**: \`src/components/lexicon/AddWordDialog.vue\`

PrimeVue \`Dialog\`:
- Word input: on blur, auto-fetch definition via \`useLexicon.lookupWord\`
- Type toggle: Dictionary / Lore (if Lore: definition field becomes editable)
- Context sentence (optional, textarea)
- Page number (optional, PrimeVue InputNumber)
- Save: calls \`lexiconStore.addEntry()\`"

gh issue create --repo $REPO --title "T030 [US3] Create pages/LexiconPage.vue" --label "US3" --body "## Task T030 — US3: The Lexicon

**File**: \`src/pages/LexiconPage.vue\`

- Book filter dropdown (All Books + each book with entries)
- Filtered list of \`LexiconCard\` components
- \"+ Add Word\" button → opens \`AddWordDialog\`
- Empty state with onboarding copy when no words saved
- \"I know this\" / \"Review again\" → \`lexiconStore.updateLeitner()\`"

gh issue create --repo $REPO --title "T031 [US3] DefaultLayout.vue — add Lexicon bottom nav item" --label "US3" --body "## Task T031 — US3: The Lexicon

**File**: \`src/layouts/DefaultLayout.vue\`

Add nav item to bottom navigation bar:
- Icon: \`pi pi-book\`
- Label: Lexicon
- Route: \`/lexicon\`"

gh issue create --repo $REPO --title "T032 [US3] Create components/dashboard/WordOfTheDay.vue" --label "US3" --body "## Task T032 — US3: The Lexicon

**File**: \`src/components/dashboard/WordOfTheDay.vue\`

Glassmorphism card widget:
- Shows: term, phonetic (if available), short definition, book name + page
- \"→\" button → marks as reviewed via \`lexiconStore.updateLeitner('advance')\`
- Tap card → navigate to \`/lexicon\`
- \`v-if=\"lexiconStore.wordOfTheDay !== null\"\`"

gh issue create --repo $REPO --title "T033 [US3] DashboardPage.vue — add Word of the Day widget" --label "US3" --body "## Task T033 — US3: The Lexicon

**File**: \`src/pages/DashboardPage.vue\`

- Add \`WordOfTheDay\` component above the In Progress section
- On mount: call \`lexiconStore.fetchEntriesForBook\` for all books in library to populate \`wordOfTheDay\`"

# ── Phase 6: US4 ─────────────────────────────────────────────
gh issue create --repo $REPO --title "T034 [US4] Create composables/useReadingPulse.ts — velocity, continuity, streak" --label "US4" --body "## Task T034 — US4: Reading Pulse

**File**: \`src/composables/useReadingPulse.ts\`

Accepts \`bookId\`. Functions:
- \`fetchHistory()\`: loads \`progress_history\` rows from Supabase
- \`velocity\`: group rows into sessions (gap > 2h = new session); average PPH across last 3; exclude outliers (< 1 or > 200 PPH); null if < 2 sessions
- \`finishPrediction(totalPages, currentPage)\`: human-readable string or null
- \`continuityScore\`: \`Math.max(0, 100 - daysSinceLastUpdate * 15)\`
- \`streak\`: count consecutive calendar days with progress_history rows ending today"

gh issue create --repo $REPO --title "T035 [US4] Create components/pulse/VelocityBadge.vue" --label "US4,parallel" --body "## Task T035 — US4: Reading Pulse

**File**: \`src/components/pulse/VelocityBadge.vue\`

Props: \`bookId: string, totalPages: number, currentPage: number\`

Shows: \`📈 Xpg/hr · ~Xh Xm to finish\`

- Uses \`useReadingPulse\` composable
- Hidden via \`v-if\` when velocity is null
- Glassmorphism badge styling"

gh issue create --repo $REPO --title "T036 [US4] BookDetailPage.vue — add VelocityBadge" --label "US4" --body "## Task T036 — US4: Reading Pulse

**File**: \`src/pages/BookDetailPage.vue\`

Import and render \`VelocityBadge\` below the progress section. Only renders when \`progressStore.progressForBook(bookId)\` exists."

gh issue create --repo $REPO --title "T037 [US4] DashboardPage.vue — hero card Continuity Score warning" --label "US4" --body "## Task T037 — US4: Reading Pulse

**File**: \`src/pages/DashboardPage.vue\`

For the hero book:
- Import \`useReadingPulse\` for the hero book's \`continuityScore\`
- When \`continuityScore < 40\`: apply amber warning CSS class + show text \"⚠ It's been a while — time for a Memory Jogger?\"
- Class removed when score ≥ 40"

gh issue create --repo $REPO --title "T038 [US4] BookCard.vue — reading streak indicator" --label "US4" --body "## Task T038 — US4: Reading Pulse

**File**: \`src/components/books/BookCard.vue\`

Below the progress bar, add:
\`🔥 X-day streak\` using \`useReadingPulse(book.id).streak\`

Hidden when streak === 0."

# ── Phase 7: US5 ─────────────────────────────────────────────
gh issue create --repo $REPO --title "T039 [US5] Create stores/recapFragments.ts — fragment store" --label "US5" --body "## Task T039 — US5: Milestone Recapping

**File**: \`src/stores/recapFragments.ts\`

Pinia setup-function store:
- \`fetchFragmentsForBook(bookId)\`: loads from \`recap_fragments\`
- \`saveFragment(bookId, page, percentage, json)\`: inserts to \`recap_fragments\`
- \`fragmentsForBook(bookId)\`: getter returns sorted array"

gh issue create --repo $REPO --title "T040 [US5] progress.ts — milestone detection and background fragment extraction" --label "US5" --body "## Task T040 — US5: Milestone Recapping

**File**: \`src/stores/progress.ts\`

After successful \`updateProgress()\`:
- Check if new percentage crossed a 10% milestone since last recap: \`Math.floor(newPct/10) > Math.floor(lastRecapPct/10)\`
- If yes: fire-and-forget call to \`recapService.extractFragment(bookId, page, pct)\`"

gh issue create --repo $REPO --title "T041 [US5] recapService.ts — add extractFragment() for background extraction" --label "US5" --body "## Task T041 — US5: Milestone Recapping

**File**: \`src/services/recapService.ts\`

Add \`extractFragment(request: RecapRequest)\`:
- Calls \`generate-recap\` edge function with \`mode: 'extract_only'\`
- Stores Pass-1 JSON result via \`recapFragmentsStore.saveFragment()\`
- Returns void — fire-and-forget safe (no throws to caller)"

gh issue create --repo $REPO --title "T042 [US5] BookDetailPage.vue — recap button lock state with page countdown" --label "US5" --body "## Task T042 — US5: Milestone Recapping

**File**: \`src/pages/BookDetailPage.vue\`

Compute \`pagesUntilUnlock\`:
- \`lastRecapPercentage\` = \`recapsStore.latestRecapForBook(bookId)?.progressSnapshot ?? 0\`
- \`unlockThresholdPage\` = \`Math.ceil((lastRecapPercentage + 10) / 100 * totalPages)\`
- \`isLocked\` = \`currentPage < unlockThresholdPage && lastRecapPercentage > 0\`

When locked: disabled button showing \"🔒 Read X more pages to unlock\"
When unlocked / first recap: normal button"

gh issue create --repo $REPO --title "T043 [US5] generate-recap edge function — add mode support and fragment stitching" --label "US5" --body "## Task T043 — US5: Milestone Recapping

**File**: \`supabase/functions/generate-recap/index.ts\`

Add \`mode\` field to request body:
- \`'extract_only'\`: run Pass 1 only, return raw JSON (no streaming)
- \`'full_summary'\`: skip spoiler constraint, full book summary (for Reading Odyssey)
- default (undefined): existing two-pass streaming behaviour

If \`fragments: RecapFragment[]\` provided in request body: Pass 2 uses merged fragment content instead of running Pass 1.

**Deploy after changes.**"

# ── Phase 8: US6 ─────────────────────────────────────────────
gh issue create --repo $REPO --title "T044 [US6] Create stores/bookPassport.ts — passport store" --label "US6" --body "## Task T044 — US6: Reading Odyssey

**File**: \`src/stores/bookPassport.ts\`

Pinia setup-function store:
- \`passportByBook: Record<string, BookPassport>\`
- \`fetchPassport(bookId)\`: loads from \`book_passports\`
- \`generatePassport(bookId)\`: computes stats from \`progress_history\` (total days, peak day/pages), reads lexicon word count, calls \`generate-recap\` with \`mode: 'full_summary'\`, streams AI summary, inserts to Supabase"

gh issue create --repo $REPO --title "T045 [US6] progress.ts — trigger Book Passport at 100%" --label "US6" --body "## Task T045 — US6: Reading Odyssey

**File**: \`src/stores/progress.ts\`

In \`updateProgress()\`, after progress saved:
- If \`newPercentage >= 100\` AND no existing passport: call \`bookPassportStore.generatePassport(bookId)\` (fire-and-forget)"

gh issue create --repo $REPO --title "T046 [US6] Create pages/BookPassportPage.vue — reading journey celebration" --label "US6,parallel" --body "## Task T046 — US6: Reading Odyssey

**File**: \`src/pages/BookPassportPage.vue\`

Celebratory layout (emerald/amber gradient, distinct from normal app background):
- Header: \"✦ Reading Journey: {title} ✦\"
- Stat cards: 📅 total days, ⚡ peak day + pages, 📖 vocab count
- PrimeVue Divider
- Streaming AI summary (reuse \`RecapStream\` states)
- \"Share Journey\" button: Web Share API (\`navigator.share\`), fallback to clipboard copy"

gh issue create --repo $REPO --title "T047 [US6] BookDetailPage.vue — View Reading Journey button for completed books" --label "US6" --body "## Task T047 — US6: Reading Odyssey

**File**: \`src/pages/BookDetailPage.vue\`

When book is 100% complete:
- Show \"✦ View Reading Journey\" PrimeVue Button → navigate to \`/books/:id/passport\`
- On mount: call \`bookPassportStore.fetchPassport(bookId)\` to check for existing passport"

# ── Phase 9: Polish ──────────────────────────────────────────
gh issue create --repo $REPO --title "T048 [Polish] CLAUDE.md — update Recent Changes for 003-reading-suite-v3" --label "polish,parallel" --body "## Task T048 — Phase 9: Polish

**File**: \`CLAUDE.md\`

Add to Recent Changes for branch \`003-reading-suite-v3\`:
- Lexicon (Free Dictionary API, Leitner System)
- Reading Pulse (velocity, continuity score, streak)
- Milestone Recap (fragment caching, 10% lock)
- Reading Odyssey (Book Passport)"

gh issue create --repo $REPO --title "T049 [Polish] Run all 10 quickstart scenarios and fix issues" --label "polish" --body "## Task T049 — Phase 9: Polish

Run all 10 test scenarios from \`specs/003-reading-suite-v3/quickstart.md\` manually:

1. Library grid view & sort
2. Edit & delete book
3. Up Next drag reorder
4. ISBN field merge
5. Lexicon word + Word of the Day
6. Reading velocity & continuity score
7. Milestone recap lock
8. Recap history page number
9. Book passport
10. iOS gradient fix

Fix any failures found."

Write-Host ""
Write-Host "Done! Created 49 issues in $REPO" -ForegroundColor Green
Write-Host "View them at: https://github.com/$REPO/issues" -ForegroundColor Cyan
