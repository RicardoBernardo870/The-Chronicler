# API Documentation

Last updated: 2026-06-20

> **Canonical inventory:** [`docs/backend-contract.md`](../backend-contract.md) (generated from a live DB introspection) is authoritative for the full surface — 5 edge functions, **60+ functions**, and the Community/Reading-Circles RPCs not listed here. This page covers the AI edge functions and the core reading RPCs.

BookHero does not define a traditional REST backend server. The app talks directly to Supabase tables/RPCs through `supabase-js` and calls Supabase Edge Functions for AI/OCR workflows.

## Authentication

All Edge Function calls send a Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

> Auth nuance: `generate-recap`, `generate-lore`, and `ocr-page` are deployed with `verify_jwt: false` and **validate the token themselves** in-function; `extract-vocabulary` and `generate-reading-dna` use platform JWT verification. Either way, always send the user's access token. AI provider keys live only in function env — never in the client. (Entitlement/subscription checks, when added, belong here too.)

## Edge Functions

### `POST /functions/v1/generate-recap`

Generates blurbs, recaps, completed-book passport summaries, and recap images.

Mode resolution:

| Request | Mode |
| --- | --- |
| `mode: "recap_image"` | Recap image |
| `mode: "passport_summary"` | Book Passport summary |
| `currentPage === 0` | Pre-start blurb |
| Otherwise | Mid-book recap |

Request body for text modes:

```json
{
  "title": "Dune",
  "author": "Frank Herbert",
  "isbn": "9780441172719",
  "currentPage": 120,
  "totalPages": 688,
  "percentage": 17.44,
  "from_page": 80,
  "captures": [
    { "page": 110, "text": "Reviewed OCR text..." }
  ]
}
```

Passport request:

```json
{
  "mode": "passport_summary",
  "title": "Dune",
  "author": "Frank Herbert",
  "currentPage": 688,
  "totalPages": 688,
  "percentage": 100
}
```

Recap image request:

```json
{
  "mode": "recap_image",
  "recapId": "<recap-id>",
  "title": "Dune",
  "author": "Frank Herbert",
  "genre": "Science Fiction",
  "memoryJogger": "Short recap memory text",
  "fromPage": 1,
  "currentPage": 688
}
```

Text response:

The function streams generated text for blurb, recap, and passport modes.

Errors:

| Status | Meaning |
| --- | --- |
| `401` | Missing or invalid Supabase JWT. |
| `405` | Unsupported method. |
| `500` | AI/provider/storage failure or unhandled server error. |

### `POST /functions/v1/generate-lore`

Generates a spoiler-safe lore card for a reading milestone.

Request:

```json
{
  "title": "Dune",
  "author": "Frank Herbert",
  "isbn": "9780441172719",
  "currentPage": 344,
  "totalPages": 688,
  "percentage": 50,
  "milestone": 50,
  "masterRecap": "Known-safe recap context",
  "existingTopics": ["Arrakis", "spice"]
}
```

Response shape:

```json
{
  "title": "A spoiler-safe lore title",
  "content": "Generated lore content",
  "type": "Lore",
  "linked_entities": ["Arrakis"],
  "unlocked_at_page": 344,
  "unlocked_at_milestone": 50
}
```

Valid milestones are `10,20,30,40,50,60,70,80,90`.

### `POST /functions/v1/ocr-page`

Runs OCR-like extraction on an uploaded image payload.

Request:

```json
{
  "imageBase64": "<base64-image-data>",
  "mimeType": "image/jpeg"
}
```

Response:

```json
{
  "text": "Extracted page text",
  "confidence": 0.87,
  "wordCount": 142
}
```

Constraints:

- Supported MIME types: JPEG and PNG.
- Decoded image limit: 5 MB.
- Image bytes are not persisted by the app.

### `POST /functions/v1/extract-vocabulary`

Extracts vocabulary candidates from OCR text.

Request:

```json
{
  "ocrText": "A passage from a captured page..."
}
```

Response:

```json
{
  "words": [
    { "word": "calumny", "definition": "A false and defamatory statement." }
  ]
}
```

Notes:

- The client filters duplicates and proper-noun-looking candidates before inserting lexicon rows.
- If the Gemini key is missing, the function is designed to return an empty result rather than blocking capture save.

### `POST /functions/v1/generate-reading-dna`

Generates a reader identity profile from completed books.

Request:

```json
{
  "books": [
    { "title": "Dune", "author": "Frank Herbert" }
  ]
}
```

Response:

```json
{
  "personality": "Reflective world-builder",
  "moodSignature": {
    "tone": "Expansive and curious",
    "emojis": ["..."]
  },
  "suggestions": [
    { "title": "Foundation", "author": "Isaac Asimov", "reason": "..." }
  ],
  "booksFinishedAtGeneration": 3,
  "generatedAt": "2026-05-17T00:00:00.000Z"
}
```

## Supabase RPCs

| RPC | Purpose |
| --- | --- |
| `get_library_with_progress` | Library list enriched with progress and status. **034:** also returns `source` + `pageCountEstimated` per book. |
| `get_reading_stats` | Profile lifetime and recent reading stats. **034:** `totalPagesRead` excludes imported books (`source <> 'manual'`); other fields derive from `progress_history` (imports write none). |
| `get_last_session` | Most recent completed reading session summary. |
| `get_library_breakdown` | Genre, author, and completion breakdown. *Includes imported books (lifetime composition).* |
| `get_reading_velocity` | Reading speed and projection data for books. |
| `get_reading_quest_summary` | Yearly goal, XP, level, and source totals. **034:** excludes imported books so they add no XP and don't count toward the yearly goal. |
| `get_book_passport_stats` | Book Passport journey statistics (timezone-aware). |
| `get_retention_summary` | Vocabulary review/retention rollup (timezone-aware). |
| `upsert_weekly_goal` | Set the per-user weekly reading goal (`user_settings`). |

> Not listed: the **Community** and **Reading Circles** RPC sets (~40 functions — `follow/block/search/profile`, `create_reading_circle`, `get_visible_circle_reactions`, etc.). These power features currently used only on the PWA; see [`backend-contract.md`](../backend-contract.md) §6.

RPC response details are typed in `src/types/index.ts` and defined in `supabase/migrations` (note: migrations have drifted from prod — the live DB is canonical).

## External Data APIs (client-side)

Book metadata is fetched directly from public book APIs in the browser — no BookHero backend proxy. Used for search, ISBN lookup, and post-import enrichment.

| API | Used for | Notes |
| --- | --- | --- |
| **Google Books** (`googleapis.com/books/v1/volumes`) | Primary source for search, ISBN lookup, import enrichment, recommendations | Optional `VITE_GOOGLE_BOOKS_API_KEY` raises rate limits. |
| **Open Library** (`openlibrary.org/api/books`) | Gap-fills missing cover/pages/genre by ISBN | Secondary; best-effort, degrades silently. |

Key behaviors:

- **ISBN-aware search (`src/services/bookSearchService.ts`):** a bare ISBN-10/13 query uses the Google Books `isbn:` operator and **omits `langRestrict`** (an ISBN names one specific-language edition; the language filter would hide it). Free-text searches keep `langRestrict=<browser language>` to suppress IP-geolocated local-market editions.
- **Import enrichment (`src/composables/useLibraryImport.ts`):** ISBN-prioritized — `useIsbn().lookup(isbn)` first (Google Books then Open Library, both by ISBN), falling back to a title+author search only when no ISBN is available. Throttled (concurrency 3) and best-effort.

