-- ============================================================
-- Reading Suite v3 — Supabase Migrations
-- Apply via Supabase MCP apply_migration tool
-- ============================================================

-- 1. Add page_snapshot to existing recaps table
ALTER TABLE recaps ADD COLUMN IF NOT EXISTS page_snapshot integer;

-- 2. Up Next ordering table
CREATE TABLE IF NOT EXISTS up_next_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  sort_position integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE up_next_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own up_next_order"
  ON up_next_order FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Progress history (append-only)
CREATE TABLE IF NOT EXISTS progress_history (
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
CREATE INDEX IF NOT EXISTS idx_progress_history_book_user
  ON progress_history(book_id, user_id, recorded_at DESC);

-- 4. Lexicon entries
CREATE TABLE IF NOT EXISTS lexicon_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id          uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  term             text NOT NULL CHECK (char_length(term) >= 1 AND char_length(term) <= 200),
  definition       text NOT NULL CHECK (char_length(definition) >= 1),
  entry_type       text NOT NULL DEFAULT 'dictionary'
                   CHECK (entry_type IN ('dictionary', 'lore')),
  context_sentence text,
  page_found       integer CHECK (page_found >= 1),
  leitner_box      integer NOT NULL DEFAULT 1 CHECK (leitner_box BETWEEN 1 AND 5),
  next_review_at   date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lexicon_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lexicon_entries"
  ON lexicon_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_lexicon_user_book
  ON lexicon_entries(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_lexicon_review
  ON lexicon_entries(user_id, next_review_at);

-- 5. Recap fragments (milestone-based event extraction cache)
CREATE TABLE IF NOT EXISTS recap_fragments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id                   uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_at_extraction        integer NOT NULL,
  percentage_at_extraction  numeric(5,2) NOT NULL,
  extracted_json            jsonb NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recap_fragments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recap_fragments"
  ON recap_fragments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_recap_fragments_book
  ON recap_fragments(book_id, user_id, percentage_at_extraction);

-- 6. Book passports (end-of-book wrap)
CREATE TABLE IF NOT EXISTS book_passports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id          uuid NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_days       integer,
  peak_day         date,
  peak_day_pages   integer,
  vocabulary_count integer NOT NULL DEFAULT 0,
  ai_summary       text,
  generated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE book_passports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own book_passports"
  ON book_passports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
