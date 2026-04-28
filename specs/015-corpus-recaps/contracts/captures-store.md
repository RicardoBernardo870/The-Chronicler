# Contract: `captures` Pinia Store

**File**: `src/stores/captures.ts` (new)

## Purpose

Front-end mirror of the `page_captures` table for the currently authenticated user. Provides cached read access (per book) and a single write path (`saveCapture`) that performs the upsert and refreshes local state.

## State

```ts
type PageCapture = {
  id: string
  bookId: string
  page: number
  text: string
  wordCount: number
  confidence: number
  capturedAt: Date
  source: 'ocr' | 'manual' | 'import'
}

state: () => ({
  capturesByBook: {} as Record<string, PageCapture[]>,    // keyed by bookId
  loadedBookIds:  new Set<string>(),                       // which books have been fetched
  saving:         false,
  lastError:      null as string | null,
})
```

## Getters

```ts
getters: {
  capturesForBook: (state) => (bookId: string): PageCapture[] =>
    state.capturesByBook[bookId] ?? [],

  capturesInRange: (state) => (bookId: string, fromPage: number, toPage: number): PageCapture[] =>
    (state.capturesByBook[bookId] ?? []).filter(c => c.page > fromPage && c.page <= toPage),

  coverageInRange: (state) => (bookId: string, fromPage: number, toPage: number): number => {
    const range = toPage - fromPage
    if (range <= 0) return 0
    const inRange = (state.capturesByBook[bookId] ?? []).filter(c => c.page > fromPage && c.page <= toPage).length
    return inRange / range
  },

  pageHasCapture: (state) => (bookId: string, page: number): boolean =>
    (state.capturesByBook[bookId] ?? []).some(c => c.page === page),
}
```

The `coverageInRange` getter is used by the front-end to **preview** whether a Get Recap tap would trigger corpus mode. The authoritative coverage check still runs server-side in `generate-recap` — the front-end value is for display purposes only (e.g., a future "ready for corpus recap" indicator).

## Actions

### `fetchCapturesForBook(bookId: string): Promise<void>`

Idempotent. Skips the network call if `bookId` is already in `loadedBookIds`. Otherwise:

```ts
const { data, error } = await supabase
  .from('page_captures')
  .select('id, book_id, page, text, word_count, confidence, captured_at, source')
  .eq('book_id', bookId)
  .order('page', { ascending: true })
```

On success: maps rows to `PageCapture[]`, stores in `capturesByBook[bookId]`, adds to `loadedBookIds`.
On error: sets `lastError` and re-throws.

### `saveCapture(input: SaveCaptureInput): Promise<PageCapture>`

```ts
type SaveCaptureInput = {
  bookId:     string
  page:       number          // sourced from reading_progress.current_page by the caller
  text:       string          // 1–10000 chars; pre-trimmed by caller
  confidence: number          // 0.0–1.0 from ocr-page response
  wordCount:  number
}
```

Implementation:

```ts
this.saving = true
this.lastError = null
try {
  const { data, error } = await supabase
    .from('page_captures')
    .upsert({
      user_id:    auth.user!.id,
      book_id:    input.bookId,
      page:       input.page,
      text:       input.text,
      word_count: input.wordCount,
      confidence: input.confidence,
      source:     'ocr',
    }, { onConflict: 'user_id,book_id,page' })
    .select()
    .single()

  if (error) throw error

  // Refresh local cache: replace the existing entry for this page or append.
  const list = this.capturesByBook[input.bookId] ?? []
  const idx = list.findIndex(c => c.page === input.page)
  const mapped = mapPageCaptureRow(data)
  if (idx >= 0) list[idx] = mapped
  else list.push(mapped)
  list.sort((a, b) => a.page - b.page)
  this.capturesByBook[input.bookId] = list

  return mapped
} catch (e) {
  this.lastError = e instanceof Error ? e.message : 'Failed to save capture'
  throw e
} finally {
  this.saving = false
}
```

### `clearCachedCaptures(bookId?: string): void`

Removes a single book's cache or wipes everything (used on auth change, mirroring the SWR cache-clear pattern from feature 006).

## SWR Integration

This store is **not** wrapped in `useCache.ts`. Captures are infrequently read (mostly on-demand for the captures preview) and the simple `loadedBookIds` flag is sufficient. If a future feature surfaces captures more aggressively, switch to the SWR primitive.

## Auth Lifecycle

The store registers an auth listener that calls `clearCachedCaptures()` on `signOut`/`userChange` events, matching the pattern used by other stores (books, progress, recaps).

## Out of Scope

- No realtime subscription — captures change only when the user explicitly saves; there's no multi-device collaboration scenario.
- No optimistic insert — capture saving is synchronous (the user is on the verify screen waiting for the round-trip).
- No `deleteCapture` action — v1 has no UI surface that triggers it (clarified Q5).
- No `useCapture()` action method here — the camera/OCR composable lives separately (`src/composables/useCapture.ts`); only the persistence path lives in this store.
