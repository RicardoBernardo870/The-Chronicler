# Quickstart / Validation: Library Import

Prerequisites: app running (`npm run dev`), signed in, migration applied to the target Supabase project.
Have a real Goodreads export (`goodreads_library_export.csv`) and a StoryGraph export
(`storygraph_export.csv`) ready.

## Setup

1. Apply the migration (`supabase/migrations/2026MMDD_library_import.sql`): adds `books.source` +
   `books.page_count_estimated` and `CREATE OR REPLACE`s the three RPCs from their live definitions.
2. `npm install` (pulls in `papaparse` + `@types/papaparse`).
3. `npm test` and `vue-tsc -b` are green.

## Scenario 1 — Goodreads import (US1, FR-001/002/003/004/005)

1. Add Book → **Import library** → choose `goodreads_library_export.csv`.
2. Expect: format auto-detected; progress shows "N of M"; books appear in the library.
3. Verify mapping: `read` rows → Finished (100%); `to-read` + `currently-reading` → "Want to read".
4. Verify quiet: no recap/lore/quest toasts; `progress_history` gains **no** rows for imported books.
5. Summary panel shows imported / skipped / failed counts.

## Scenario 2 — StoryGraph import + dedupe (US1, FR-004, SC-004)

1. Import `storygraph_export.csv`. Then import the **same** file again.
2. Expect: second run reports all rows as skipped-duplicate; **zero** new books (SC-004).
3. Books overlapping the Goodreads set are matched by ISBN (else title+author) and skipped.

## Scenario 3 — Background enrichment + placeholder (US2, FR-006/007, SC-003)

1. Import a file with rows lacking cover/genre/pages.
2. Expect: books appear immediately; covers/genres/page counts populate shortly after, unattended.
3. A book with no page count anywhere imports with a flagged placeholder (`page_count_estimated`) and a
   "fix page count" affordance — it is **not** dropped.

## Scenario 4 — Stats integrity (FR-014, SC-007) — the key check

1. Note current Profile **Reading Quest** completed-books and **lifetime** finished count.
2. Import a Goodreads file containing N `read` books.
3. Expect:
   - Reading Quest "completed this year" and XP: **unchanged** (imports excluded).
   - "Pages/Sessions this month", streaks: **unchanged**.
   - Lifetime finished-book count and genre breakdown: **increased** by the imported read books.
4. SQL spot-check: `get_reading_quest_summary(uid, 2026)` quest.completedBooks unchanged;
   `get_library_breakdown(uid).booksFinished` +N.

## Scenario 5 — TBR shelf + start reading (US3, FR-012, SC-006)

1. Open Library → **Want to read** (queue) tab.
2. Expect imported queued books listed; tap **Start reading** → book becomes the active read.
3. Empty TBR shows an encouraging empty state with paths to import or search.

## Scenario 6 — Bad input (FR-009/010)

1. Upload a non-CSV / random file → clear error, **nothing** created.
2. Upload a CSV with some unparseable / title-less rows → those reported in the summary; the rest import.

## Failure-handling checks

- Navigate away mid-import → books already created persist; re-running is safe (dedupe).
- Enrichment source offline → books still import with CSV data; no blocking, no failure.
