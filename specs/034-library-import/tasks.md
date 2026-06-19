---
description: "Task list for Library Import (Goodreads & StoryGraph)"
---

# Tasks: Library Import (Goodreads & StoryGraph)

**Input**: Design documents from `specs/034-library-import/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: A small set of unit tests is included for the pure-logic pieces (CSV parsers, status
mapping, dedupe) because they have crisp contracts and the project already runs vitest. They are
OPTIONAL — skip the `[P] [test]` tasks if you want a thinner first pass; nothing else depends on them.

**Organization**: Grouped by user story. US1 is the MVP. US2 (enrichment) extends US1's composable.
US3 (TBR shelf) is independent and can be built any time after Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3
- All paths are repo-relative.

## Path Conventions

Single-project Vue PWA: source under `src/`, SQL under `supabase/migrations/`, tests under `tests/` /
co-located `*.spec.ts`. Matches the structure in [plan.md](plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pull in the one new dependency.

- [X] T001 Add `papaparse` and `@types/papaparse` to `package.json` (installed via `pnpm add` — project uses pnpm); confirmed `npm test` + `vue-tsc -b` green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + type layer that every story compiles against. **No story work can begin until
this phase is complete.**

**⚠️ CRITICAL**: The migration MUST be authored from the **live** function definitions captured during
planning (see [contracts/rpc-changes.md](contracts/rpc-changes.md)). Change only the documented lines;
keep `SECURITY DEFINER`, `SET search_path`, the auth guards, and all other CTEs byte-for-byte.

- [X] T002 Created `supabase/migrations/20260619_library_import.sql`: adds `books.source` (default `'manual'`) + `books.page_count_estimated` (default `false`).
- [X] T003 `CREATE OR REPLACE get_reading_quest_summary` — added `and coalesce(b.source,'manual') = 'manual'` to `progress_rows` only, from the live body. No other CTE altered.
- [X] T004 `CREATE OR REPLACE get_reading_stats` — added the source filter to `current_progress` only; `deltas`/`valid_sessions`/`streak_*` untouched.
- [X] T005 `CREATE OR REPLACE get_library_with_progress` — added `'source'` + `'pageCountEstimated'`; all books still returned.
- [X] T006 Applied via Supabase MCP (`apply_migration`); verified both columns exist and both stat functions carry the `coalesce(b.source` filter, and the library RPC exposes `pageCountEstimated`.
- [X] T007 Extended `src/types/index.ts`: `Book`/`BookRow`/`LibraryBookEntry` gain source + page-estimate fields; added `ImportSource`, `ImportPhase`, `ImportRow`, `ImportFailure`, `ImportSummary`.
- [X] T008 Updated `mapBook` + `_libraryFetcher` (`src/stores/books.ts`) to carry `source`/`pageCountEstimated`; fixed the synthetic `Book` in `LibraryListView.vue` and the `addBook` signature.

**Checkpoint**: Schema live, types compile, stats correctly exclude imports — stories can begin.

---

## Phase 3: User Story 1 — Import a library from a CSV (Priority: P1) 🎯 MVP

**Goal**: Upload a Goodreads or StoryGraph CSV → books appear in the library with correct shelf
status, de-duplicated, created quietly.

**Independent Test**: Import a real Goodreads CSV and (separately) a StoryGraph CSV; confirm correct
titles/authors/statuses, no duplicates against existing books, and no recap/lore/quest side effects.

### Tests for User Story 1 (OPTIONAL)

- [X] T009 [P] [US1] Unit test `tests/unit/importGoodreadsParser.spec.ts`: Excel-guard ISBN stripped, comma-in-title parsed, status mapping, no-title failure.
- [X] T010 [P] [US1] Unit test `tests/unit/importStorygraphParser.spec.ts`: first-author extraction, `Read Status` mapping incl. `did-not-finish`→queued, dedupe-key fallback.
- [X] T011 [P] [US1] Unit test `tests/unit/importCsvFormat.spec.ts`: Goodreads/StoryGraph signatures detected; unknown → `null`; whitespace-tolerant.
- [X] T012 [P] [US1] Unit test `tests/unit/importDedupe.spec.ts`: `cleanIsbn`/`makeDedupeKey` (ISBN-first + title+author fallback, two-file collapse), `parsePages`, `mapStatusToInitial`, `firstAuthor`.

### Implementation for User Story 1

- [X] T013 [P] [US1] Created `src/utils/import/csvFormat.ts` (+ shared `src/utils/import/shared.ts`): `detectImportSource` by header signature.
- [X] T014 [P] [US1] Created `src/utils/import/goodreadsParser.ts`: raw row → `ImportRow` with reason on failure.
- [X] T015 [P] [US1] Created `src/utils/import/storygraphParser.ts`: raw row → `ImportRow`.
- [X] T016 [US1] Added `importBooks` to `src/stores/books.ts`: two-pass dedupe, chunked insert (≤100, `source` + `page_count_estimated`), batched `reading_progress` upsert for completed (quiet path), single end-of-run SWR invalidation + rehydrate.
- [X] T017 [US1] Created `src/composables/useLibraryImport.ts`: offline guard → lazy `papaparse` → detect → map → `importBooks` → enrich; reactive `phase`/`processed`/`total`/`summary`/`errorMessage`/`startImport`/`reset`.
- [X] T018 [P] [US1] Created `src/components/import/ImportSummaryPanel.vue` (PrimeVue `Tag` + `Message`; failed-row details).
- [X] T019 [US1] Created `src/components/import/LibraryImportDialog.vue` (PrimeVue `Dialog` + `FileUpload` + `ProgressBar` + summary; v-model visible, `done` emit).
- [X] T020 [US1] Added "Import from Goodreads or StoryGraph" button to `AddBookPage.vue` home step, lazy-loading the dialog (FR-015).
- [X] T021 [US1] Added "Import library" to `DashboardEmptyState.vue` (`empty` variant, `import` emit) and wired it in `DashboardPage.vue` (FR-015).

**Checkpoint**: Books import quietly with correct status + dedupe; summary shown. MVP demoable.

---

## Phase 4: User Story 2 — Imported books get covers and details (Priority: P1)

**Goal**: After import, books missing cover/genre/pages are filled in in the background; unknown
page counts import with a flagged placeholder the reader can fix.

**Independent Test**: Import rows lacking cover/genre/pages → books appear immediately, then covers/
genres/pages populate unattended; a book with no page count anywhere imports flagged, not dropped.

### Implementation for User Story 2

- [X] T022 [US2] `importBooks` sets `page_count_estimated = true` + a `PLACEHOLDER_PAGES` (100) `total_pages` for null-page rows (FR-007); never dropped.
- [X] T023 [US2] Added throttled enrichment to `useLibraryImport.ts`: ISBN → `useIsbn().lookup`, else `searchBooks` best match; concurrency 3 + inter-batch delay; `phase='enriching'`, advances `processed`; best-effort (never rejects).
- [X] T024 [US2] Enrichment hits call `booksStore.updateBook` (cover/genre/pages); `updateBook` now clears `page_count_estimated` when `totalPages` is set.
- [X] T025 [US2] `BookCard.vue` shows a "Set page count" affordance when `pageCountEstimated` (and an "Imported" badge).
- [X] T026 [US2] `LibraryImportDialog` shows the `enriching` phase progress; `ImportSummaryPanel` notes books still needing a page count.

**Checkpoint**: Imported library looks complete unattended; flagged books are correctable, never lost.

---

## Phase 5: User Story 3 — See and start reading "Want to read" books (Priority: P2)

**Goal**: Imported queued books are browsable in the TBR shelf with a one-tap "Start reading".

**Independent Test**: After import, open the Want-to-read (queue) tab, confirm imported queued books
listed, tap "Start reading" → book becomes the active read.

### Implementation for User Story 3

- [X] T027 [US3] Confirmed the **queue** tab lists queued (Want-to-read) books; each `BookCard` taps through to book-detail where "Start reading" lives (one-tap start path, SC-006). Reused the existing flow rather than duplicating a button into the shared `SwipeableBookCard`.
- [X] T028 [P] [US3] Added an "Imported" badge to `BookCard.vue` when `source !== 'manual'`.
- [X] T029 [US3] Enriched the empty queue state in `LibraryListView.vue` with encouraging copy + an "Add or import books" action routing to `/books/add` (where import + search live).

**Checkpoint**: Imported backlog is browsable and one tap from a reading session.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Verified lazy-loading via `vite build`: `papaparse.min` (19 kB) and `LibraryImportDialog` (31 kB) emit as separate chunks, off the initial bundle (Principle V).
- [ ] T031 ⏳ **Manual in-app validation** — Quickstart Scenario 4 (stat integrity, SC-007): import N read books, confirm Reading Quest completed-this-year/XP and this-month stats unchanged while lifetime finished count + genre breakdown increase. (Backend filter verified statically in T006; end-to-end requires a signed-in import.)
- [ ] T032 ⏳ **Manual in-app validation** — remaining [quickstart.md](quickstart.md) scenarios (1–3, 5, 6): Goodreads + StoryGraph import, re-import dedupe, enrichment + placeholder, TBR start-reading, bad-input rejection.
- [X] T033 [P] Updated `docs/backend-contract.md`: documented `books.source` + `page_count_estimated` and the three RPC changes.
- [X] T034 Final gate: `npm test` (98 passing, incl. 4 new import suites) and `vue-tsc -b --force` green; arrow-function style throughout.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: no dependencies.
- **Foundational (T002–T008)**: depends on Setup. **Blocks all stories.** Within it: T002→(T003,T004,T005) edit the same migration file so author them sequentially; T006 after the migration is written; T007→T008 (types before store mapping); T006 and T007 are independent.
- **US1 (T009–T021)**: after Foundational. MVP.
- **US2 (T022–T026)**: after US1 (extends `importBooks` + `useLibraryImport`).
- **US3 (T027–T029)**: after Foundational; independent of US1/US2 (can run in parallel with US1).
- **Polish (T030–T034)**: after the desired stories.

### Within US1

- Parsers (T013–T015) and the optional parser tests (T009–T012) are parallel; `importBooks` (T016) before the composable (T017); `ImportSummaryPanel` (T018) before/independent of `LibraryImportDialog` (T019); dialog (T019) before the two entry points (T020, T021).

### Parallel Opportunities

- T009–T012 (tests) together; T013–T015 (three parser files) together; T018 alongside T016/T017.
- US3 (T027–T029) can be built by a second developer in parallel with US1 right after Foundational.
- T028, T030, T033 are [P].

---

## Parallel Example: User Story 1

```bash
# Optional pure-logic tests together:
Task: "Unit test goodreadsParser.spec.ts"
Task: "Unit test storygraphParser.spec.ts"
Task: "Unit test csvFormat.spec.ts"
Task: "Unit test dedupe spec"

# Then the three parser/format files together:
Task: "Create src/utils/import/csvFormat.ts"
Task: "Create src/utils/import/goodreadsParser.ts"
Task: "Create src/utils/import/storygraphParser.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. T001 (Setup) → T002–T008 (Foundational) → T013–T021 (US1 impl; tests T009–T012 optional).
2. **STOP and VALIDATE**: quickstart Scenarios 1, 2, 6 — import works, dedupe works, bad input rejected.
3. Demo: an empty BookHero becomes a populated library in one upload.

### Incremental Delivery

1. Setup + Foundational → schema + types ready (stats already exclude imports).
2. US1 → import + dedupe + quiet write (MVP).
3. US2 → background enrichment + placeholder correction.
4. US3 → TBR shelf + start reading.
5. Polish → bundle/lazy check, stat-integrity validation, backend-contract doc.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- The migration is the one irreversible step — author it from live defs, apply with Supabase tooling,
  and run the verification queries (T006) before building UI on top.
- Quiet-import guarantee (SC-005) rests entirely on routing completed status through the batched
  `reading_progress` upsert in `importBooks` — never through `updateProgress`.
- Use arrow functions throughout (project convention).
