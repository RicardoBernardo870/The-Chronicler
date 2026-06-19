# Contract: CSV Import Formats

Both formats parsed with `papaparse` (`header: true`, `skipEmptyLines: true`). Detection runs on the
parsed header row before mapping.

## Format detection

| Source | Required header signature (all present) |
|--------|------------------------------------------|
| Goodreads | `Book Id`, `Exclusive Shelf`, `My Rating` |
| StoryGraph | `Read Status`, `Star Rating` (and no `Exclusive Shelf`) |
| Unknown | none match → reject file with a clear message (FR-010), create nothing |

## Goodreads columns → ImportRow

| ImportRow field | Source column(s) | Transform |
|-----------------|------------------|-----------|
| title | `Title` | trim |
| author | `Author`, fallback `Author l-f` | trim |
| isbn | `ISBN13` else `ISBN` | strip Excel guard `="…"`; keep digits + trailing `X`; empty → null |
| totalPages | `Number of Pages` | parse int; ≤0 or blank → null |
| status | `Exclusive Shelf` | `read`→completed; else queued |

## StoryGraph columns → ImportRow

| ImportRow field | Source column(s) | Transform |
|-----------------|------------------|-----------|
| title | `Title` | trim |
| author | `Authors` | first author before comma/semicolon; trim |
| isbn | `ISBN/UID` | digits + trailing `X`; empty → null |
| totalPages | `Number of Pages` | parse int; ≤0 or blank → null |
| status | `Read Status` | `read`→completed; `to-read`/`currently-reading`/`did-not-finish`/other→queued |

## Row-level outcomes

- Empty `title` → **failed** row (`reason: 'no title'`), reported, not aborting (FR-009).
- Duplicate (within file or vs library) → **skippedDuplicate** (FR-004).
- `totalPages === null` after parse → imported with placeholder + `page_count_estimated=true` (FR-007);
  enrichment may later fill it.
- Ratings, reviews, read-dates, shelves/tags → **ignored** (Out of Scope).

## Validation

- Non-CSV / unparseable file → clear error, no writes (FR-010).
- A file that parses but matches no known signature → "Unrecognized export" message, no writes.
