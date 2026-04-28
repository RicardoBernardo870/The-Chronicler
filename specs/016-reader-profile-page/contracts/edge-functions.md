# Edge Function Contracts

Two new Supabase edge functions live under `supabase/functions/`. Both follow the existing patterns established by `generate-recap`, `generate-lore`, and `ocr-page` (Gemini 2.5 Flash, JSON-mode response, prompt caching where available).

---

## 1. `generate-reading-dna`

Generates the user's Reading DNA from their corpus (recaps, lore, captures) and the books they've finished. **Always generates when called** — gating logic lives in the client (see research.md Decision 3).

### Endpoint
`POST /functions/v1/generate-reading-dna`

### Request
```json
{
  "userId": "uuid"           // must equal auth.uid() — verified server-side
}
```

The function reads the user's data server-side (recaps, lore_cards, page_captures, books, progress_history) using the user's JWT. Client doesn't ship corpus inline (would be too large; cleaner to read DB directly).

### Auth
Standard Supabase JWT via `Authorization: Bearer <token>`. Function verifies `auth.uid() === body.userId`.

### Response (200)
```json
{
  "personality": "string (50-800 chars, 2-3 sentences, narrative voice)",
  "moodSignature": {
    "tone": "string (1-40 chars, single descriptor)",
    "emojis": ["string", "string", "string"]
  },
  "suggestions": [
    { "title": "string", "author": "string", "reason": "string (one sentence)" }
  ],
  "booksFinishedAtGeneration": 7,
  "generatedAt": "2026-04-28T14:32:00.000Z"
}
```

The function MUST also UPSERT this payload into `public.reading_dna` keyed by `user_id` before returning. The client treats the response as authoritative.

### Errors
| Status | Body | Cause |
|---|---|---|
| `400` | `{ error: 'insufficient_corpus' }` | User has < 3 books finished. Client should not call in this case but the function defends. |
| `401` | `{ error: 'unauthorized' }` | JWT missing or `auth.uid() ≠ body.userId`. |
| `502` | `{ error: 'ai_unavailable' }` | Gemini call failed or returned malformed JSON after retry. **Client preserves prior DNA** (FR-014) — no UI error. |
| `500` | `{ error: 'internal' }` | Unexpected. Same client behavior as 502. |

### Latency budget
< 5 s p95 (a one-shot AI call). Not user-blocking — client shows a Skeleton while waiting.

### Prompt outline (full prompt in implementation; this is the spec contract)
- **System**: "You are a literary analyst writing a brief, intimate reader-personality summary..."
- **Constraints**: spoiler-free; the DNA must reflect what the user has *already read* (corpus is past-tense); 2–3 sentences; ≤ 5 emoji tokens; suggestions must be real, publicly-known titles drawn from your literary knowledge (FR-027); never recommend a book the user has already finished (caller passes the list of finished `{ title, author }`).
- **Output format**: strict JSON matching the response schema; reject text outside the JSON envelope.

---

## 2. `extract-vocabulary`

Extracts up to 5 uncommon words from a captured page's OCR text and inserts them into the user's Lexicon. **Fire-and-forget from the client** — the client never awaits.

### Endpoint
`POST /functions/v1/extract-vocabulary`

### Request
```json
{
  "captureId": "uuid",       // page_captures.id
  "userId": "uuid",          // must equal auth.uid()
  "bookId": "uuid",          // page_captures.book_id (denormalized for ledger)
  "page": 47,                // page_captures.page
  "ocrText": "string"        // page_captures.text (already user-edited)
}
```

### Auth
Same as above (JWT, `auth.uid() === userId`).

### Behavior
1. INSERT `vocabulary_extractions` row with `status='pending'`, idempotent by `unique(capture_id)`. If the unique constraint fires (re-capture of same capture_id), function returns 200 immediately (already processed) — handles spec edge case "page capture redone for same page".
2. Call Gemini 2.5 Flash with the prompt described in research.md Decision 9. Response shape: `{ words: [{ word, definition }] }`, length 0–5.
3. For each candidate word, in a single SQL roundtrip:
   - LOWER + lemma-trim and dedup against existing `lexicon_entries` for `(user_id, term)`.
   - Reject any candidate that looks like a proper noun (capitalized in OCR text AND not at sentence start). The AI is also instructed to filter these (FR-022); this is a defense-in-depth check.
4. INSERT survivors into `lexicon_entries` with:
   - `term = candidate.word`
   - `definition = candidate.definition`
   - `entry_type = 'dictionary'`
   - `context_sentence = <sentence from ocrText containing the word>`
   - `page_found = page`
   - `book_id = bookId`
   - `leitner_box = 1` (FR-019: enters at Box 1)
   - `next_review_at = now() + interval '1 day'` (consistent with existing manual entries)
   - `source = 'auto'`
5. UPDATE `vocabulary_extractions.status` to `'succeeded'` (or `'skipped'` if 0 inserted) with `words_added = <count>`.
6. On any failure (AI error, Postgres error): UPDATE `vocabulary_extractions.status = 'failed'`, set `error_message`, return `200` to client (so client doesn't retry — fire-and-forget).

### Response (200)
```json
{
  "captureId": "uuid",
  "wordsAdded": 3,
  "status": "succeeded"   // or "skipped" or "failed"
}
```

The client ignores this body in v1 (fire-and-forget). The shape is here for future telemetry.

### Errors
The function aims for `200` even on internal failure (so the client never retries). The only non-200 paths:

| Status | Body | Cause |
|---|---|---|
| `401` | `{ error: 'unauthorized' }` | JWT mismatch. |
| `400` | `{ error: 'invalid_input' }` | Missing required field. |

### Latency budget
< 30 s p95 (SC-003). Not in capture critical path.

### Prompt outline
- **System**: "You are a vocabulary tutor identifying words an educated adult literary reader would benefit from learning."
- **Instruction**: "From the passage below, select up to 5 uncommon, advanced, or distinctively literary words. EXCLUDE proper nouns (character names, places, brand names). For each, write a one-sentence definition that reflects how the word is used IN THIS PASSAGE — not a generic dictionary entry. If the passage contains no qualifying words, return an empty array."
- **Output format**: strict JSON `{ "words": [{ "word": string, "definition": string }] }`.

---

## Shared concerns

- Both functions live alongside existing edge functions and reuse the existing `supabase/functions/deno.json` import map.
- Both use the same Gemini API key env var (`GEMINI_API_KEY`) used by `generate-recap`.
- Logging: `console.log` JSON envelopes per function-invocation, captured by Supabase logs.
- No new secrets, no new buckets, no new third-party integrations.
