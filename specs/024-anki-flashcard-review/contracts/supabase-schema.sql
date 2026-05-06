-- ============================================================
-- Feature 024: Anki Flashcard Review
-- New table: anki_review_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS anki_review_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_reviewed_at timestamptz NOT NULL DEFAULT now(),
  total_sessions   integer     NOT NULL DEFAULT 1,
  known_count      integer     NOT NULL DEFAULT 0,
  unknown_count    integer     NOT NULL DEFAULT 0,

  CONSTRAINT anki_review_sessions_user_id_key UNIQUE (user_id)
);

-- RLS
ALTER TABLE anki_review_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own review sessions"
  ON anki_review_sessions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for prompt-check query (user_id + last_reviewed_at)
CREATE INDEX IF NOT EXISTS idx_anki_review_sessions_user
  ON anki_review_sessions (user_id);
