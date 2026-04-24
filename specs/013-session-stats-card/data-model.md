# Data Model: Last Session Card (013-session-stats-card)

## Existing Tables Modified

### `reading_progress` (MODIFIED)

Add one nullable column. All existing columns and constraints remain unchanged.

```sql
ALTER TABLE public.reading_progress
  ADD COLUMN session_start_at TIMESTAMPTZ NULL;
```

| Column             | Type         | Nullable | Notes                                              |
|--------------------|--------------|----------|----------------------------------------------------|
| id                 | uuid PK      | NOT NULL | existing                                           |
| book_id            | uuid FK      | NOT NULL | existing                                           |
| user_id            | uuid FK      | NOT NULL | existing                                           |
| current_page       | integer      | NOT NULL | existing                                           |
| updated_at         | timestamptz  | NOT NULL | existing                                           |
| **session_start_at** | timestamptz | NULL   | NEW — set when "Start Session" is tapped; cleared to NULL when page is saved |

**Lifecycle of `session_start_at`**:
1. `null` → reader taps "Start Session" → set to `NOW()` via upsert
2. Non-null → reader saves pages → value copied to `progress_history.session_start_at`, then field reset to `null`
3. Non-null → reader taps "Start Session" again → user is warned; on confirmation, overwritten with `NOW()`

---

### `progress_history` (MODIFIED)

Add two nullable columns. All existing columns, constraints, and RLS policies remain unchanged.

```sql
ALTER TABLE public.progress_history
  ADD COLUMN session_start_at TIMESTAMPTZ NULL,
  ADD COLUMN session_note     TEXT         NULL CHECK (char_length(session_note) <= 160);
```

| Column              | Type         | Nullable | Notes                                                |
|---------------------|--------------|----------|------------------------------------------------------|
| id                  | uuid PK      | NOT NULL | existing                                             |
| book_id             | uuid FK      | NOT NULL | existing                                             |
| user_id             | uuid FK      | NOT NULL | existing                                             |
| page                | integer      | NOT NULL | existing                                             |
| recorded_at         | timestamptz  | NOT NULL | existing — the moment pages were saved (session end) |
| **session_start_at** | timestamptz | NULL    | NEW — copied from `reading_progress.session_start_at` at save time; null for legacy rows |
| **session_note**     | text        | NULL    | NEW — optional reader memo, max 160 chars; written in a separate PATCH after initial row insert |

**Backwards compatibility**: All existing rows have `session_start_at = null` and `session_note = null`. `mapProgressHistory` is extended to include optional fields; no changes required for existing callers that don't reference the new fields.

---

## Frontend Type Extensions

### `ProgressHistoryRow` (extended)

```typescript
export interface ProgressHistoryRow {
  id: string
  book_id: string
  user_id: string
  page: number
  recorded_at: string
  session_start_at: string | null  // NEW
  session_note: string | null      // NEW
}
```

### `ProgressHistory` (extended)

```typescript
export interface ProgressHistory {
  id: string
  bookId: string
  userId: string
  page: number
  recordedAt: string
  sessionStartAt: string | null  // NEW
  sessionNote: string | null     // NEW
}
```

### `ReadingProgressRow` (extended)

```typescript
export interface ReadingProgressRow {
  id: string
  book_id: string
  user_id: string
  current_page: number
  updated_at: string
  session_start_at: string | null  // NEW
}
```

### `ReadingProgress` (extended)

```typescript
export interface ReadingProgress {
  id: string
  bookId: string
  userId: string
  currentPage: number
  percentage: number
  updatedAt: string
  sessionStartAt: string | null  // NEW — non-null = active session in progress
}
```

### `LastSession` (extended in `useLastSession`)

```typescript
export interface LastSession {
  bookId: string
  bookTitle: string
  endedAt: Date
  startedAt: Date | null          // NEW — null for legacy rows
  pagesDelta: number
  startPage: number               // NEW — page at session start
  endPage: number                 // NEW — page at session end
  durationSeconds: number | null  // existing; now accurate when startedAt is non-null
  velocityPph: number | null      // existing; now precise
  completionDelta: number | null  // NEW — % of book read this session (null if totalPages unknown)
  finishPredictionSessions: number | null  // NEW — based on rolling avg velocity
  sessionNote: string | null      // NEW
}
```

---

## Derived Computations (read-time, not stored)

| Metric | Formula | Null condition |
|--------|---------|----------------|
| Duration | `recorded_at - session_start_at` (milliseconds → seconds) | `session_start_at IS NULL` |
| Velocity (pph) | `pagesDelta / (durationSeconds / 3600)`, rounded to int | duration < 60s OR pagesDelta < 1 OR duration null |
| Completion delta | `(pagesDelta / totalPages) * 100`, rounded to 1dp | `totalPages = 0 OR null` |
| Finish prediction | `ceil(pagesRemaining / rollingAvgVelocity)` sessions | velocity null OR pagesRemaining ≤ 0 |

**Rolling average velocity** = mean of `velocityPph` across the last ≤3 `progress_history` rows with non-null `session_start_at` for the same book.

---

## State Transitions

```
reading_progress.session_start_at:

[NULL]
   │  user taps "Start Session"
   ▼
[NOW()]  ← active session; timer displayed in UI
   │  user saves updated page
   ▼
[NULL]  ← session_start_at copied to progress_history row, then cleared
```
