# Interface Contract: generate-recap Edge Function

**Function**: `supabase/functions/generate-recap/index.ts`  
**URL**: `{SUPABASE_URL}/functions/v1/generate-recap`  
**Method**: `POST`  
**Auth**: Bearer token in `Authorization` header (JWT, manually decoded — `verify_jwt: false`)

---

## Request Payload

```typescript
{
  // ── Book identity (always required) ──────────────────────────
  title: string           // Book title
  author: string          // Book author
  isbn?: string | null    // Optional — improves AI accuracy (FR-009)

  // ── Progress context ─────────────────────────────────────────
  percentage: number      // Reader's current progress (0–100)
  currentPage: number     // Absolute page number
  totalPages: number      // Total pages in the book

  // ── Mode selector ─────────────────────────────────────────────
  mode?: 'recap' | 'extract_only' | 'passport_summary'
  // Default: 'recap'

  // ── Incremental recap range (recap mode only, Decision 3) ─────
  from_page?: number      // Start of delta range (default: 0 = full book)
  // When provided: AI covers pages from_page+1 → currentPage only

  // ── Fragment cache (REMOVED — Decision 1) ─────────────────────
  // fragments field is no longer accepted or processed
}
```

---

## Response by Mode

### `recap` (default)

Streaming NDJSON / plain text stream.  
On completion the accumulated text contains a valid JSON object:

```json
{
  "memory_jogger": "string — recent events summary",
  "concept_watchlist": "string — key figures and ideas",
  "thematic_bridge": "string — narrative vibe and themes"
}
```

**All three fields must be non-empty strings** (FR-001). Empty fields → client throws `'Incomplete recap received'`.

### `extract_only`

Non-streaming JSON response:

```json
{
  "key_events": ["string", "..."],
  "characters": ["string", "..."],
  "themes": ["string", "..."],
  "chapter_markers": ["string", "..."]
}
```

Used by `recapFragments.ts` for milestone caching. Client validates before saving (Decision 5):
- Must have `key_events` as non-empty array
- Must NOT have a `raw` key
- Invalid → silently discarded, no DB row written

### `passport_summary` *(new — Decision 4)*

Streaming plain-text response. No JSON structure.  
A single flowing narrative paragraph (200–400 words) covering the full arc, themes, and memorable moments of the book. Written for a completed reader — no spoiler constraints.

The accumulated stream is stored as-is in `book_passports.ai_summary`.  
The client renders it as plain text — no JSON parsing attempted.

---

## Authentication

`verify_jwt: false` is set in `config.toml`. The function manually decodes the JWT:

```typescript
const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
const userId = JSON.parse(atob(jwt.split('.')[1])).sub
```

Returns `401` if token is absent or cannot be decoded.

---

## Token Budget

| Pass       | Mode                        | `maxOutputTokens` |
|------------|-----------------------------|-------------------|
| Pass 1     | `recap`, `extract_only`     | 8192 (Decision 8) |
| Pass 2     | `recap` only                | 4096              |
| Narrative  | `passport_summary`          | 4096              |

---

## Error Responses

| Status | Body                              | Cause                        |
|--------|-----------------------------------|------------------------------|
| 400    | `{ "error": "Missing fields" }`   | Required fields absent       |
| 401    | `{ "error": "Unauthorized" }`     | Token absent or undecodable  |
| 500    | `{ "error": "..." }`              | AI provider error            |

---

## Changed vs Prior Contract

| Before | After |
|--------|-------|
| `verify_jwt: true` — gateway validates ES256 JWT → 401 error | `verify_jwt: false` + manual decode — works with any JWT algorithm |
| `fragments` array accepted as Pass 1 cache | `fragments` field removed — fresh Pass 1 always runs |
| `full_summary` mode for passport (returns 3-field JSON) | `passport_summary` mode returns streaming narrative text |
| Pass 1 `maxOutputTokens: 4096` → truncation at large books | Pass 1 `maxOutputTokens: 8192` |
| No `from_page` — recap always starts from page 0 | `from_page` scopes AI to delta range |
