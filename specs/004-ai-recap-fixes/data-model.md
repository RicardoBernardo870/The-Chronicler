# Data Model: AI Recap & Progress Tracking Fixes

**Feature**: 004-ai-recap-fixes  
**Source**: spec.md entities + research.md decisions

---

## Entities

### ProgressHistory

Append-only log of page saves. One row per save event.

| Field        | Type      | Notes                                           |
|--------------|-----------|-------------------------------------------------|
| id           | uuid      | PK, auto-generated                              |
| book_id      | uuid      | FK → books.id                                   |
| user_id      | uuid      | FK → auth.users.id (RLS gate)                   |
| page         | integer   | Absolute page number at time of save             |
| recorded_at  | timestamp | ISO timestamp of the save                       |

**Write path fix**: The `supabase.from('progress_history').insert({...})` call must be followed by `.then(() => {})` to force HTTP dispatch in Supabase JS v2 (lazy execution bug — Decision 2).

**Validation rules**:
- One row per save event; never upserted
- RLS: `auth.uid() = user_id` already in place (no schema changes needed)

---

### RecapFragment

Cached AI extraction of book content up to a milestone page. Stored per 10% boundary crossed.

| Field       | Type    | Notes                                                    |
|-------------|---------|----------------------------------------------------------|
| id          | uuid    | PK                                                       |
| book_id     | uuid    | FK → books.id                                            |
| user_id     | uuid    | FK → auth.users.id                                       |
| milestone   | integer | Progress percentage milestone (e.g., 10, 20, 30…)       |
| page        | integer | Absolute page at milestone                               |
| raw_json    | jsonb   | AI extraction result — must have `key_events` array      |
| created_at  | timestamp |                                                        |

**Validation gate (Decision 5)**: Before writing a fragment row, validate:
- `raw_json` is parseable as an object
- `raw_json.key_events` exists and is a non-empty array
- `raw_json.raw` key does NOT exist (fallback indicator)

Invalid extractions are silently discarded — no row written.

**Fragment cache removal (Decision 1)**: Fragments are no longer passed as context to the recap generation path. The `extract_only` mode still writes fragments at milestones; they simply are not consumed during recap generation. The main recap runs a fresh Pass 1 over the delta page range.

---

### Recap

A three-part AI briefing anchored to a page range. Covers `from_page+1 → current_page`.

| Field             | Type      | Notes                                            |
|-------------------|-----------|--------------------------------------------------|
| id                | uuid      | PK                                               |
| book_id           | uuid      | FK → books.id                                    |
| user_id           | uuid      | FK → auth.users.id                               |
| progress_snapshot | numeric   | Progress % at time of recap                      |
| page_snapshot     | integer   | Current page at time of recap                    |
| from_page         | integer   | Starting page for this recap's range (new field) |
| memory_jogger     | text      | Recent events summary                            |
| concept_watchlist | text      | Key figures and ideas                            |
| thematic_bridge   | text      | Narrative vibe and themes                        |
| created_at        | timestamp |                                                  |

**Incremental source (Decision 3)**: `from_page` is sourced from `latestRecapForBook(bookId)?.pageSnapshot ?? 0`. The edge function uses it to instruct the AI to cover only pages `from_page+1 → page_snapshot`.

**No schema migration needed**: `from_page` is passed in the edge function request; existing recap rows without this field continue to work. The column may optionally be added for audit purposes but is not required for the fix.

---

### BookPassport

Completion trophy record. Auto-generated on first 100% completion.

| Field           | Type      | Notes                                                    |
|-----------------|-----------|----------------------------------------------------------|
| id              | uuid      | PK                                                       |
| book_id         | uuid      | FK → books.id                                            |
| user_id         | uuid      | FK → auth.users.id                                       |
| total_days      | integer   | Calendar days from first to last `progress_history` row  |
| peak_day        | date      | Date on which most pages were read                       |
| peak_day_pages  | integer   | Pages read on peak_day                                   |
| vocabulary_count| integer   | Lexicon entries for this book                            |
| ai_summary      | text      | Narrative paragraph (NOT JSON) from `passport_summary` mode |
| created_at      | timestamp |                                                          |

**Single-session fix (Decision 6)**: Guard changed from `histRows.length >= 2` to `>= 1`. For a single row: `totalDays = 1`, that row's date is both the first and peak day.

**Narrative mode (Decision 4)**: `ai_summary` is now generated via the new `passport_summary` edge function mode. The response is a streamed plain-text paragraph — no JSON structure. The existing `full_summary` mode is retired for passport use.

---

## State Transitions

### RecapGenerationStatus (in `recaps.ts`)

```
idle ──[generateRecap called]──► streaming ──[stream completes]──► idle
                                             └──[error]──────────► idle (error.value set)
```

**Lockout rule (FR-010)**: The `generateRecap` action must check `generationStatus.value === 'streaming'` and return early (or throw) if already streaming. The recap button in `BookDetailPage.vue` binds `:disabled="recapsStore.generationStatus === 'streaming'"`.

### Book Completion Gate

```
progress < 100%  →  AI Recap section visible, passport button hidden
progress = 100%  →  AI Recap section hidden (v-if="!isComplete"), passport button visible
```

---

## No Schema Migrations Required

All table schemas and RLS policies are already correct. All fixes are client-side call fixes or edge function updates. The `from_page` concept is passed as a request payload field, not a required database column.
