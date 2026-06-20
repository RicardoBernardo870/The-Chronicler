# Contract: Frontend interfaces

## `useLibraryImport()` composable (`src/composables/useLibraryImport.ts`)

```ts
interface UseLibraryImport {
  phase: Ref<ImportPhase>           // idle | parsing | importing | enriching | done | error
  processed: Ref<number>            // books inserted so far (drives "N of M")
  total: Ref<number>                // total data rows
  summary: Ref<ImportSummary | null>
  errorMessage: Ref<string | null>
  startImport: (file: File) => Promise<void>  // offline-guarded; parse → dedupe → insert → enrich
  reset: () => void
}
```

- `startImport` is best-effort on enrichment: it resolves `done` with a summary even if every
  enrichment call fails (FR-006). It rejects to `error` only on a fundamentally bad file (FR-010) or a
  failed insert.
- Offline: if `navigator.onLine === false`, set `error` with a "needs connection" message and write
  nothing.

## `booksStore.importBooks(rows)` (new action)

```ts
importBooks(rows: ImportRow[]): Promise<{ insertedIds: string[]; summary: ImportSummary }>
```

- Dedupes `rows` against `books.value` + within the batch (R4).
- Chunked `books` insert (≤100/req) with `source` + `page_count_estimated` set.
- For `completed` rows, batched `reading_progress` upsert (`current_page = total_pages`,
  `session_start_at = null`) — the quiet path, no `progress_history`.
- Invalidates SWR keys once at the end: `books`, `library`, `libraryBreakdown`, `readingQuest`
  (prefix), `readingStats`, `progress`.
- Never triggers recap/lore/vocabulary/quest/passport side effects (SC-005).

## Components (`src/components/import/`)

### `LibraryImportDialog.vue`
- Props: `visible: boolean` (v-model). Emits: `update:visible`, `done: [summary: ImportSummary]`.
- PrimeVue `Dialog` → `FileUpload` (custom `:auto="false"`, `accept=".csv"`) → `ProgressBar`
  (`:value` from processed/total during importing/enriching) → `ImportSummaryPanel`.
- Lazy-loaded via `defineAsyncComponent` from its entry points.

### `ImportSummaryPanel.vue`
- Props: `summary: ImportSummary`. Renders imported / skipped-duplicate / failed counts (PrimeVue
  `Message` + `Tag`); failed rows listed with reasons. Includes a link to the TBR shelf and a "Fix page
  counts" hint when any `page_count_estimated` books were created.

## Entry points

- `AddBookPage.vue` home step: new `Button label="Import library" icon="pi pi-file-import"` opening the
  dialog (alongside Scan / Add Manually / Search) — FR-015.
- `DashboardEmptyState.vue` (`variant='empty'`): secondary `Button` "Import library" emitting a new
  `import` event the dashboard maps to opening the dialog — FR-015.

## TBR shelf (FR-012)

- `LibraryListView.vue` **queue** tab already lists `queuedBooks` (`LibraryBookEntry[]`). Ensure each
  card exposes a prominent "Start reading" action wired to the existing start flow (writes initial
  progress → book becomes active). Imported queued books appear here with no extra work beyond the
  badge.
- Imported books optionally show a small `Tag` ("Imported") sourced from `LibraryBookEntry.source`.
