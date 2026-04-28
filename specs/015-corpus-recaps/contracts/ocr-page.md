# Contract: `ocr-page` Edge Function

**File**: `supabase/functions/ocr-page/index.ts`
**Method**: `POST`
**Auth**: Required (Supabase JWT in `Authorization: Bearer <token>` header)

## Purpose

Accept a base64-encoded image from the client, send it to Gemini 2.5 Flash multimodal for text extraction, and return the extracted text plus a self-rated confidence score. **The image itself is never persisted** — it is held in memory only for the duration of the Gemini call.

## Request

```http
POST /functions/v1/ocr-page
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{
  "imageBase64": "<base64-encoded JPEG or PNG, no data: prefix>",
  "mimeType": "image/jpeg"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `imageBase64` | string | yes | Base64 encoding of the raw image bytes (no `data:` URL prefix). Max 5 MB decoded. |
| `mimeType` | string | yes | Either `"image/jpeg"` or `"image/png"`. Other types rejected with 400. |

**Note**: The request body deliberately does **not** include `bookId` or `page`. The OCR endpoint has no business with the book/page context — it is a pure image→text transformer. The client persists the result against the correct `(user, book, page)` after the verify step.

## Response

### 200 OK — Successful extraction

```json
{
  "text": "It was a bright cold day in April, and the clocks were striking thirteen.\n\nWinston Smith, his chin nuzzled into his breast in an effort to escape the vile wind…",
  "confidence": 0.94,
  "wordCount": 187
}
```

| Field | Type | Notes |
|---|---|---|
| `text` | string | Extracted text. Empty string is possible (returned as 200, not error) if the image was blank. |
| `confidence` | number | 0.0–1.0, self-rated by Gemini. ≥0.7 = no warning shown to user; <0.7 = verify screen displays low-confidence banner. |
| `wordCount` | integer | `text.split(/\s+/).filter(Boolean).length`. Computed server-side for consistency. |

### 400 Bad Request

Returned for malformed input (missing fields, unsupported mime type, decoded image >5MB).

```json
{ "error": "InvalidRequest", "message": "imageBase64 missing or invalid" }
```

### 401 Unauthorized

Returned when the JWT is missing, expired, or invalid.

### 502 Bad Gateway

Returned when the Gemini API call fails after retry (network error, model error, rate limit). Client surfaces this as "OCR temporarily unavailable; try again or add note instead."

```json
{ "error": "OcrUpstream", "message": "Gemini call failed after retry" }
```

### 504 Gateway Timeout

Returned if the Gemini call exceeds 10s. Client surfaces a retry option.

## Gemini Prompt (server-side)

The edge function sends Gemini a structured prompt that constrains it to return JSON:

```text
You are an OCR engine for a personal reading-tracking application. Extract all
visible text from the provided image of a book page. Preserve paragraph breaks
as \n\n and line breaks within paragraphs as single \n.

Do not include:
- Page numbers printed on the image (the application tracks page numbers separately)
- Headers/footers (chapter titles, running titles)
- Footnote markers
- Decorative ornaments or page-break symbols

Respond with a JSON object only, no markdown fences:

{
  "text": "<extracted text>",
  "confidence": <number 0.0-1.0 — your assessment of how legibly the text was captured>,
  "notes": "<optional: any caveats about the extraction, e.g. 'partial blur on right margin'>"
}

Confidence guidance:
- 0.95–1.00 = clean, no doubts
- 0.70–0.94 = good but minor uncertainty in some words
- 0.40–0.69 = significant uncertainty; user should review carefully
- 0.00–0.39 = poor capture; recommend retake
```

The function parses Gemini's JSON response and validates it. Malformed JSON triggers one retry, then 502.

## Error Handling

- **Single retry on transient Gemini errors** (5xx upstream, network glitch). Total budget: 10s including retry.
- **No retry on 400-class errors** from Gemini (e.g., content filter, malformed request) — surface immediately as 502 with a logged note.
- **Image size validation** happens before the Gemini call to fail fast.

## Privacy

- Image bytes are held in the edge function process memory and **not** written to disk, logs, or Storage.
- Gemini's privacy contract for the user's API key applies (no training on submitted content per current Gemini policy).
- The response (text + confidence) is the only artifact that may be persisted by the client.

## Performance

- Target p95 end-to-end latency: ≤5s for a 1080p book-page image.
- No streaming: the full response is returned once Gemini completes.
- Concurrent requests are not coordinated; Supabase edge function autoscaling handles concurrency.

## Telemetry (deferred to implementation)

Suggested log fields per request (no PII):
- `user_id` (for rate-limit accounting)
- `request_bytes` (decoded image size)
- `gemini_latency_ms`
- `confidence_returned`
- `retry_count`
- `outcome` (`success` | `bad_request` | `upstream_error` | `timeout`)
