# API Documentation

Last updated: 2026-05-17

BookHero does not define a traditional REST backend server. The app talks directly to Supabase tables/RPCs through `supabase-js` and calls Supabase Edge Functions for AI/OCR workflows.

## Authentication

All Edge Function calls require a Supabase access token:

```http
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

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
| `get_library_with_progress` | Library list enriched with progress and status. |
| `get_reading_stats` | Profile lifetime and recent reading stats. |
| `get_last_session` | Most recent completed reading session summary. |
| `get_library_breakdown` | Genre, author, and completion breakdown. |
| `get_reading_velocity` | Reading speed and projection data for books. |
| `get_reading_quest_summary` | Yearly goal, XP, level, and source totals. |
| `get_book_passport_stats` | Book Passport journey statistics. |

RPC response details are typed in `src/types/index.ts` and defined in `supabase/migrations`.

