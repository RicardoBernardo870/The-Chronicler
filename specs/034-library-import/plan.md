# Implementation Plan: Library Import (Goodreads & StoryGraph)

**Branch**: `034-library-import` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/034-library-import/spec.md`

## Summary

Let a reader populate BookHero in one step by uploading a Goodreads or StoryGraph CSV export. The
app detects the format, parses the rows, maps read-status (read → completed; everything else → "Want
to read"), de-duplicates against the existing library, and bulk-creates the books **quietly** (no
recaps, lore, vocabulary, quest XP, or completion passports). Missing cover/genre/page metadata is
filled in afterward in the background by reusing the existing book-search service; books with no
discoverable page count import with a flagged placeholder the reader can fix. Imported "Want to read"
books surface in the existing TBR ("Want to read") shelf with a "Start reading" action.

**Key backend insight** (verified against the live DB): imported completed books are written through
the existing quiet path (`progressStore.setInitialProgress`), which **never inserts `progress_history`
rows**. Every current-period metric in `get_reading_stats` (`pagesThisWeek/Month`, `sessionsThisMonth`,
`currentStreakDays`, `longestStreakDays`, `totalReadingHours`, `allTimeVelocityPph`) is derived from
`progress_history`, so imported books contribute **zero** to them automatically — no filter needed.
The only surfaces that *would* be inflated read `reading_progress` directly:
`get_reading_quest_summary` (yearly goal `completed_books_year` + all XP sources) and the
`totalPagesRead` field of `get_reading_stats`. Those are the two places FR-014/SC-007 require us to
exclude imported books, gated on a new `books.source` marker. Library-composition surfaces
(`get_library_breakdown`, `get_library_with_progress`, Reading DNA) intentionally keep including
imported books.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`); SQL for one
Supabase migration.

**Primary Dependencies**: Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4, VueUse, existing SWR
cache primitive (`src/composables/useCache.ts`), existing `bookSearchService` (Google Books + Open
Library). **One new npm package**: `papaparse` (+ `@types/papaparse`) for robust CSV parsing —
justified in Complexity Tracking.

**Storage**: Supabase PostgreSQL. New columns on existing `books` table: `source text not null
default 'manual'` and `page_count_estimated boolean not null default false`. No new tables. Updates to
two existing SECURITY DEFINER RPCs (`get_reading_quest_summary`, `get_reading_stats`) and one read RPC
(`get_library_with_progress`) to surface the marker. CSV files are transient (parsed in-browser, never
uploaded to Storage).

**Testing**: vitest (`npm test`), typecheck via `vue-tsc -b`. No lint script.

**Target Platform**: Installable PWA (iOS/Android/desktop); mobile-first, one-handed.

**Project Type**: Single-project Vue PWA + Supabase BaaS (frontend-led feature with a thin backend
migration).

**Performance Goals**: A ≈100-book import is usable in < 2 min of attention (SC-001); books appear
before enrichment finishes. UI stays responsive for 300–1000 rows (chunked insert, throttled
enrichment); progress shown as "N of M".

**Constraints**: Quiet import (0 AI/gamification side effects, SC-005); idempotent/re-runnable dedupe
(0 duplicates, SC-004); imported read books add 0 to current-period stats (SC-007); enrichment is
best-effort and never blocks or fails the import (FR-006). Offline guard: import requires connectivity
(insert + enrichment are network ops).

**Scale/Scope**: Low-thousands of rows upper bound; single-user, client-driven. ~6 new frontend files,
2 type extensions, 1 store action, 1 migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **I. Memory Continuity** — Not impacted. Import generates no recaps; quiet path guarantees no
  spoiler/recap side effects (FR-005). ✅
- **II. Physical-to-Digital Bridge** — Reinforces it: import is another on-ramp for physical-book
  readers; page counts stay edition-aware; the flagged placeholder (FR-007) keeps manual correction
  available exactly as Principle II requires for failed metadata lookups. ✅
- **III. AI-First Recap Engine** — Not invoked by import (quiet). ✅
- **IV. Data Integrity & Synchronization** — Inserts are synchronous before UI confirms; dedupe makes
  re-runs idempotent so a refresh/interruption never duplicates or loses books (FR-013). ✅
- **V. PWA-First & Frictionless Portability** — Import dialog and `papaparse` are lazy-loaded
  (`defineAsyncComponent` + dynamic import) so the non-critical path doesn't grow the core bundle.
  Entry points are within two taps (Add Book screen / empty state). ✅
- **VI. Component Architecture & UI Standards (NON-NEGOTIABLE)** — PrimeVue-first: `Dialog`,
  `FileUpload` (custom mode), `ProgressBar`, `Message`, `Button`, `Tag`. Each new component has a
  single named responsibility under `src/components/import/`; orchestration logic lives in a
  composable (`useLibraryImport`). No bespoke widgets where a PrimeVue one exists. ✅

**Result**: PASS (no violations). One justified new dependency tracked below.

## Project Structure

### Documentation (this feature)

```text
specs/034-library-import/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── csv-formats.md            # Goodreads + StoryGraph column contracts + status mapping
│   ├── books-schema.md           # books.source / page_count_estimated columns
│   ├── rpc-changes.md            # get_reading_quest_summary / get_reading_stats / get_library_with_progress deltas
│   └── frontend-contracts.md     # useLibraryImport API + store action + component props/events
├── checklists/
│   └── requirements.md  # (existing) 16/16
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/
├── utils/
│   └── import/
│       ├── csvFormat.ts          # detect Goodreads vs StoryGraph by header signature
│       ├── goodreadsParser.ts    # row → ImportRow (status, isbn excel-guard, pages)
│       └── storygraphParser.ts   # row → ImportRow
├── composables/
│   └── useLibraryImport.ts       # orchestrate parse → dedupe → bulk insert → background enrich; reactive phase/progress/summary
├── stores/
│   └── books.ts                  # + importBooks() bulk action; extend mapBook/Book with source + pageCountEstimated
├── components/
│   └── import/
│       ├── LibraryImportDialog.vue   # PrimeVue Dialog: FileUpload → ProgressBar → summary
│       └── ImportSummaryPanel.vue    # imported / skipped-duplicate / failed counts (PrimeVue Message/Tag)
├── pages/
│   └── AddBookPage.vue           # + "Import library" entry button (home step)
├── components/
│   ├── dashboard/DashboardEmptyState.vue   # + "Import library" action (empty variant)
│   └── library/LibraryListView.vue         # ensure queue tab = first-class TBR shelf w/ "Start reading"
└── types/index.ts                # + source/pageCountEstimated on Book, BookRow, LibraryBookEntry; ImportRow/ImportSummary types

supabase/migrations/
└── 2026MMDD_library_import.sql   # add 2 columns; CREATE OR REPLACE the 3 RPCs (from live defs)
```

**Structure Decision**: Single-project Vue PWA. The feature is frontend-led (CSV parsing, dedupe,
bulk insert, and enrichment all run client-side reusing existing services), plus one additive,
backward-compatible migration. The migration is authored from the **live** function definitions
(captured during planning) so it cannot revert remote-only fixes — the same discipline that prevented
a regression in the recent stats work.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| New npm dependency `papaparse` | Goodreads exports use Excel-guard ISBN quoting (`="9780..."`), embedded commas, and quoted multi-line titles/notes; StoryGraph similarly quotes fields. A correct hand-rolled CSV parser is non-trivial and error-prone, directly threatening SC-002 (≥95% rows imported). | A naive `split(',')` parser silently corrupts ISBNs and any title containing a comma, dropping or mangling rows. `papaparse` is the de-facto standard, ~6KB gzipped, and lazy-loaded so it never touches the core bundle. |
| Two new `books` columns (vs one) | `source` drives stat exclusion (FR-014); `page_count_estimated` drives the "fix page count" prompt (FR-007). They answer different questions and both must survive the reader editing the book. | Overloading a sentinel page value (e.g. `total_pages = 1`) to mean "estimated" is ambiguous (a real 1-page book) and breaks the moment enrichment or the reader sets a real count. A boolean is unambiguous and self-documenting. |
