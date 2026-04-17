# Data Model: Reading Suite v3

## Existing Tables (changes only)

### `recaps` — ADD column
```sql
ALTER TABLE recaps ADD COLUMN page_snapshot integer;
-- nullable: existing rows keep NULL, new rows always populate it
```

TypeScript change:
```typescript
// types/index.ts — Recap interface
export interface Recap {
  id: string
  bookId: string
  userId: string
  progressSnapshot: number  // percentage
  pageSnapshot: number | null  // NEW: exact page at time of generation
  memoryJogger: string
  conceptWatchlist: string
  thematicBridge: string
  createdAt: string
}
```

---

## New Tables

### `up_next_order`
Stores user-defined ordering of 0%-progress books in the "Up Next" dashboard section.

```sql
CREATE TABLE up_next_order (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id     uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  sort_position integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE up_next_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own up_next_order"
  ON up_next_order FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

TypeScript:
```typescript
export interface UpNextOrder {
  id: string
  userId: string
  bookId: string
  sortPosition: number
  updatedAt: string
}
```

---

### `progress_history`
Append-only log of every progress update. Enables velocity calculation and streak tracking.

```sql
CREATE TABLE progress_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page        integer NOT NULL CHECK (page >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE progress_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress_history"
  ON progress_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_progress_history_book_user ON progress_history(book_id, user_id, recorded_at DESC);
```

TypeScript:
```typescript
export interface ProgressHistoryRow {
  id: string
  bookId: string
  userId: string
  page: number
  recordedAt: string
}
```

---

### `lexicon_entries`
Vocabulary entries per book — both dictionary lookups and custom Lore entries.

```sql
CREATE TABLE lexicon_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id         uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  term            text NOT NULL CHECK (char_length(term) >= 1 AND char_length(term) <= 200),
  definition      text NOT NULL CHECK (char_length(definition) >= 1),
  entry_type      text NOT NULL CHECK (entry_type IN ('dictionary', 'lore')) DEFAULT 'dictionary',
  context_sentence text,                  -- optional: sentence from the book
  page_found      integer CHECK (page_found >= 1), -- optional: page where word was found
  leitner_box     integer NOT NULL DEFAULT 1 CHECK (leitner_box BETWEEN 1 AND 5),
  next_review_at  date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lexicon_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lexicon_entries"
  ON lexicon_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_lexicon_user_book ON lexicon_entries(user_id, book_id);
CREATE INDEX idx_lexicon_review ON lexicon_entries(user_id, next_review_at);
```

TypeScript:
```typescript
export type LexiconEntryType = 'dictionary' | 'lore'

export interface LexiconEntry {
  id: string
  userId: string
  bookId: string
  term: string
  definition: string
  entryType: LexiconEntryType
  contextSentence: string | null
  pageFound: number | null
  leitnerBox: number          // 1–5
  nextReviewAt: string        // ISO date
  createdAt: string
}
```

---

### `recap_fragments`
Stored Pass-1 event extraction results at milestone boundaries. Used to assemble recaps without re-running full extraction.

```sql
CREATE TABLE recap_fragments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id               uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_at_extraction    integer NOT NULL,
  percentage_at_extraction numeric(5,2) NOT NULL,
  extracted_json        jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recap_fragments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recap_fragments"
  ON recap_fragments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_recap_fragments_book ON recap_fragments(book_id, user_id, percentage_at_extraction);
```

TypeScript:
```typescript
export interface RecapFragment {
  id: string
  bookId: string
  userId: string
  pageAtExtraction: number
  percentageAtExtraction: number
  extractedJson: Record<string, unknown>
  createdAt: string
}
```

---

### `book_passports`
End-of-book wrap generated once per completed book.

```sql
CREATE TABLE book_passports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         uuid NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_days      integer,
  peak_day        date,
  peak_day_pages  integer,
  vocabulary_count integer NOT NULL DEFAULT 0,
  ai_summary      text,
  generated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE book_passports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own book_passports"
  ON book_passports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

TypeScript:
```typescript
export interface BookPassport {
  id: string
  bookId: string
  userId: string
  totalDays: number | null
  peakDay: string | null        // ISO date
  peakDayPages: number | null
  vocabularyCount: number
  aiSummary: string | null
  generatedAt: string
}
```

---

## Client-Side Derived State

### Continuity Score (computed in `useReadingPulse.ts`)
```typescript
// Not stored — always computed fresh
const continuityScore = (lastUpdateAt: string): number => {
  const days = (Date.now() - new Date(lastUpdateAt).getTime()) / 86_400_000
  return Math.max(0, Math.round(100 - days * 15))
}
// Warning state: score < 40 (~2.7 days since last update)
```

### Reading Velocity (computed in `useReadingPulse.ts`)
```typescript
// Derived from progress_history rows, not stored
// Groups rows into sessions (gap > 2h = session break)
// Returns PPH averaged across last 3 sessions, outliers removed
```

### Leitner / Word of the Day (computed in `useLeitner.ts`)
```typescript
// Reads lexicon_entries where next_review_at <= today
// Returns entry with lowest leitner_box (most overdue first)
// Updates leitner_box and next_review_at on review action
```
