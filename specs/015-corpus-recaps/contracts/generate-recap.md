# Contract: `generate-recap` Edge Function (Extended)

**File**: `supabase/functions/generate-recap/index.ts` (modified)
**Method**: `POST` (unchanged)
**Auth**: Required (Supabase JWT — unchanged)

## Purpose

Existing edge function that streams a recap for a book at a given progress point. **This contract documents the extension only.** The request/response shape is unchanged from today's contract; the change is internal to the edge function: it now selects between **corpus mode** (new) and **inferred mode** (existing) based on capture coverage, and stores the chosen mode on the resulting recap row.

## Request (unchanged)

```http
POST /functions/v1/generate-recap
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{ "bookId": "uuid" }
```

The request body remains identical to today's contract. **No `mode` field is exposed to the client** — mode selection is an internal concern.

## Response (unchanged externally; new persisted column internally)

The streaming SSE response shape is unchanged. The terminal event still includes the persisted recap row, which now carries an additional `mode` field:

```json
{
  "type": "complete",
  "recap": {
    "id": "uuid",
    "bookId": "uuid",
    "userId": "uuid",
    "content": "...",
    "progressSnapshot": 47.2,
    "mode": "corpus",            // NEW — "corpus" | "inferred"
    "createdAt": "2026-04-26T18:30:00Z"
  }
}
```

Existing clients that ignore unknown fields are unaffected. New clients render the "📸 Generated from your captures" badge when `mode === "corpus"`.

## Mode Selection Logic

```text
Inputs (server-side, after auth):
  bookId        ← from request
  userId        ← from JWT
  currentPage   ← SELECT current_page FROM reading_progress WHERE user_id = $1 AND book_id = $2
  lastRecapPage ← SELECT progress_snapshot FROM recaps
                  WHERE user_id = $1 AND book_id = $2
                  ORDER BY created_at DESC LIMIT 1
                  (treat NULL as 0)
  
  rangeStart  = lastRecapPage     (exclusive lower bound)
  rangeEnd    = currentPage       (inclusive upper bound)
  rangePages  = rangeEnd - rangeStart   (integer)
  
  capturesInRange = SELECT count(*) FROM page_captures
                    WHERE user_id = $1 AND book_id = $2
                      AND page > rangeStart AND page <= rangeEnd
  
  coverage = capturesInRange / rangePages   (if rangePages > 0 else 0)

Decision:
  IF coverage >= 0.30 AND capturesInRange >= 1 AND rangePages > 0:
    mode = "corpus"
  ELSE:
    mode = "inferred"
```

Note: `lastRecapPage` is sourced from `progress_snapshot` on the most recent recap row for this `(user, book)`. The existing `progress_snapshot` column on `recaps` already holds the page percentage at recap time; the edge function multiplies by `total_pages` to recover the absolute page number, OR — preferred — extends the schema to also persist `progress_snapshot_page` for direct integer access. Implementation detail: see tasks.md.

## Corpus Mode Prompt

The corpus prompt strictly preserves the existing 3-tier output structure (Memory Jogger / Concept Watchlist / Thematic Bridge — Constitution Principle I) and adds a hard ground-only-in-text instruction:

```text
You are a spoiler-safe reading companion summarizing a stretch of {bookTitle} by
{bookAuthor} for the reader.

CRITICAL CONSTRAINTS:
- The reader has captured the actual text of pages {rangeStart + 1} to {rangeEnd}
  (the stretch since their last recap). Below is the complete captured text.
- Summarize ONLY events, characters, and themes that appear in this captured text.
- DO NOT infer plot from the book's title, author, or your training data.
- DO NOT speculate about events not present in the captured text.
- If a character is mentioned but their fate is unknown in the captured text,
  do not predict.
- Frame the summary as "what happened in this stretch" — NOT a story-so-far recap.

CAPTURED TEXT:
[Page {p1}]
{text_p1}

[Page {p2}]
{text_p2}

…

OUTPUT (Markdown, three sections):

## The Memory Jogger
A 3–5 sentence summary of the most important events in this stretch, in
narrative order. Quote a single memorable line if it anchors a moment.

## The Concept Watchlist
A bullet list of the key characters, places, or concepts that appeared or
gained significance in this stretch.

## The Thematic Bridge
A 1–2 sentence note on the emotional or thematic vibe of this stretch and how
it sets up where the reader is now.
```

Captured text blocks are sorted by page ascending and joined with a `[Page N]\n` marker so the model has explicit ordering.

## Inferred Mode Prompt (Unchanged)

The existing inferred-mode prompt is preserved verbatim. No changes to its 3-tier output, spoiler-safety instruction, or progress-clamping.

## Persisted Row

After streaming completes, the edge function inserts a row into `recaps` with:

```sql
INSERT INTO recaps (
  user_id, book_id, content, progress_snapshot, mode, created_at
) VALUES (
  $userId, $bookId, $accumulated_content, $progress_pct, $selected_mode, now()
)
```

The `mode` column is the only new write. All other columns are populated as today.

## Backward Compatibility

- Historical recap rows have `mode = 'inferred'` via the column DEFAULT in the migration.
- Clients that pre-date the badge feature simply ignore the `mode` field on the response.
- The corpus path NEVER runs without ≥30% coverage — a brand-new install behaves identically to today's app.

## First-Token Latency Budget

Constitution Principle III mandates that recap streaming begins within 3 seconds. The corpus-mode path adds:

- One DB count query (`capturesInRange`) — ~5ms
- One DB select query (captures text) — ~50ms for ≤200 rows
- Prompt assembly — ~1ms
- Gemini SSE first-byte — ~1.5–2.5s typical (same as inferred)

**Total budget**: comfortably under 3s. A timed log records elapsed time from request receipt to first SSE chunk for ongoing verification (research.md Decision 6).

## Telemetry (deferred to implementation)

Per request, suggested log fields:
- `user_id`, `book_id`
- `mode_selected` (`corpus` | `inferred`)
- `coverage_pct` (when corpus path was considered)
- `captures_in_range`, `range_pages`
- `first_token_latency_ms`
- `total_latency_ms`
- `outcome` (`success` | `gemini_error` | `db_error` | …)
