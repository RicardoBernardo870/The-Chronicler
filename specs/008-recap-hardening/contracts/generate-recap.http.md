# Contract: `POST /functions/v1/generate-recap`

**Feature**: 008-recap-hardening
**Status**: FROZEN — must be byte-for-byte compatible with production.

## Request

```http
POST /functions/v1/generate-recap
Authorization: Bearer <supabase JWT>
Content-Type: application/json
```

Body:

```json
{
  "title":        "string",
  "author":       "string",
  "isbn":         "string (optional)",
  "currentPage":  0,
  "totalPages":   0,
  "percentage":   0,
  "mode":         "passport_summary (optional — string literal)",
  "from_page":    0
}
```

### Mode resolution (server-side)

| Condition | Mode |
|---|---|
| `mode === 'passport_summary'` | **passport** |
| `currentPage === 0` | **blurb** |
| otherwise | **recap** |

## Responses

### 200 — `blurb` mode

- `Content-Type: text/plain; charset=utf-8`
- Streamed body; when concatenated, parses as JSON:
  ```json
  {
    "memory_jogger":     "string (≤ 600 chars)",
    "concept_watchlist": "comma,separated,string",
    "thematic_bridge":   "string"
  }
  ```

### 200 — `recap` mode

- `Content-Type: text/plain; charset=utf-8`
- Same JSON shape as `blurb`. **Guaranteed** to be produced only after a successful extraction (confidence `high` or `medium`, OR confidence `low` reached on an intermediate retry that subsequently resolved). Never emitted on exhausted low-confidence retries.

### 200 — `passport` mode

- `Content-Type: text/plain; charset=utf-8`
- Streamed **plain paragraph**, 300–500 words, NOT JSON.

### 400 — Missing required fields

```json
{ "error": "Missing required fields" }
```

### 401 — Missing/invalid JWT

```json
{ "error": "No authorization header" }
```
or
```json
{ "error": "Unauthorized" }
```

### 500 — AI output invalid (new — retry budget exhausted)

```json
{
  "error":        "AI output invalid",
  "detail":       "Low extraction confidence after retries" | "No JSON block found in response",
  "finishReason": "string (optional)",
  "blockReason":  "string | null (optional)"
}
```

Emitted only after the retry budget is exhausted (FR-011/FR-013) OR on a provider safety block (FR-012, no retry).

### 503 — AI service not configured

```json
{ "error": "AI service not configured" }
```

## Headers

CORS headers identical to current production:

```
Access-Control-Allow-Origin:  *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
Access-Control-Allow-Methods: POST, OPTIONS
```

Streaming responses include `Cache-Control: no-cache`.

## Verification

After refactor, a byte-level equality test against production responses is NOT possible (Gemini output is non-deterministic). Instead:

1. **Shape check**: For each mode, 5 sample requests return the documented `Content-Type` and parseable body shape.
2. **Contract header check**: CORS preflight returns 200 with headers above.
3. **Error path check**: Missing-field + missing-auth requests return the documented 400/401 shapes.
