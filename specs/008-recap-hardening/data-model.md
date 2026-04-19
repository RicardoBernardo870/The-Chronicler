# Phase 1 Data Model: Bulletproof Recap Generation

**Feature**: 008-recap-hardening
**Date**: 2026-04-19

This feature is stateless (no database schema changes). The "data model" below documents the **in-memory TypeScript types** and their relationships, which live in `supabase/functions/generate-recap/types.ts`.

## Types

### `Mode`

```ts
type Mode = 'blurb' | 'recap' | 'passport_summary'
```

- Derived by `router.ts` from the request body:
  - `mode === 'passport_summary'` → `passport_summary`
  - `currentPage === 0` → `blurb`
  - otherwise → `recap`

### `RequestBody`

```ts
interface RequestBody {
  title:        string
  author:       string
  isbn?:        string
  currentPage:  number      // absolute page, 0 for blurb mode
  totalPages:   number
  percentage:   number      // 0..100; may be redundant with currentPage/totalPages
  mode?:        'passport_summary'
  from_page?:   number      // delta start (0 = full-book recap)
}
```

**Validation (FR-019-style; mirrors current function)**:
- `title`, `author`, `totalPages`, `percentage` required → 400 if missing
- No other mutation to existing 400/401/503 error shape

### `ExtractionResult`

```ts
interface ExtractionResult {
  chapters_covered:   string[]
  key_events:         string[]
  active_characters:  string[]
  current_conflicts:  string
  mood:               string
  confidence_level:   'high' | 'medium' | 'low'
}
```

**Produced by**: `extraction/runExtraction.ts` (mid-book Recap mode only).
**Consumed by**: `prompts/recap.ts` + `handlers/recap.ts` composer call.
**Validation**: `confidence_level` MUST be one of the three literals; any other value is treated as `low` and triggers a retry (Decision 5 in research.md).

### `RecapPayload`

```ts
interface RecapPayload {
  memory_jogger:     string    // ≤ 600 chars, 2–4 sentences
  concept_watchlist: string    // comma-separated, ≤ 13 items
  thematic_bridge:   string    // 1–2 sentences
}
```

**Produced by**: streaming composer call in `handlers/recap.ts` (also the shape returned by `handlers/blurb.ts`).
**Consumed by**: frontend (`src/services/recapService.ts` and recap stores) — **unchanged contract**.

### `PassportPayload`

The Passport Summary mode returns a streaming **plain text paragraph** (300–500 words) — no JSON wrapper. Kept as a plain `string` stream for client compatibility.

### `RetryPolicy`

```ts
const retryPolicy = {
  MAX_ATTEMPTS: 2,        // additional attempts after the initial call
  PAGE_BUFFER:  5,        // pages to subtract per retry
  TEMPERATURE:  0.3,      // constant across attempts
} as const
```

**State transitions** (in `handlers/recap.ts`):

```
attempt=0 → runExtraction(currentPage)
  ├── confidence_level == 'high' | 'medium' → proceed to composer
  ├── confidence_level == 'low' && attempt < MAX_ATTEMPTS → attempt++ → re-run with adjustedPage
  └── attempt == MAX_ATTEMPTS && still low → return graceful error
```

`adjustedPage = max(currentPage - PAGE_BUFFER * attempt, fromPage + 1, 1)`
Abort retries if `adjustedPage <= fromPage`.

### `StageLogEntry`

```ts
interface StageLogEntry {
  stage:          'extractor' | 'recap' | 'blurb' | 'passport'
  attempt:        number
  finishReason?:  string
  blockReason?:   string | null
  safetyRatings?: unknown
  usage?:         unknown
  rawTextLength?: number
  rawTextPreview?: string   // ≤ 500 chars
}
```

Emitted via `console.error(JSON.stringify(entry))`. Satisfies FR-018.

## Relationships

```
RequestBody ──▶ router.ts ──▶ Mode
                                │
   ┌────────────┬───────────────┼────────────────┐
   ▼            ▼               ▼                ▼
blurb handler  passport handler recap handler (extraction → retry → composer)
   │            │               │
   ▼            ▼               ▼
RecapPayload  PassportPayload  ExtractionResult → RecapPayload
 (stream)      (stream)         (internal)        (stream)
```

No persistent entities, no DB relations — this feature's "model" is purely runtime data flow.
