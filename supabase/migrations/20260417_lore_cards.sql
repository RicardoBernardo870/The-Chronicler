-- ─────────────────────────────────────────────────────────────
-- Migration: 20260417_lore_cards
-- Feature:   007 Lore Chronoscope
-- ─────────────────────────────────────────────────────────────

-- ── Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lore_cards (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id               UUID        NOT NULL REFERENCES books(id)      ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  content               TEXT        NOT NULL,
  type                  TEXT        NOT NULL CHECK (type IN ('History', 'Myth', 'Geography')),
  linked_entities       TEXT[]      NOT NULL DEFAULT '{}',
  unlocked_at_page      INTEGER     NOT NULL,
  unlocked_at_milestone INTEGER     NOT NULL CHECK (unlocked_at_milestone IN (10,20,30,40,50,60,70,80,90)),
  seen                  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Constraints ───────────────────────────────────────────────

-- One lore card per milestone per book per user (cost guard + dedup at DB level).
ALTER TABLE lore_cards
  ADD CONSTRAINT lore_cards_unique_milestone
  UNIQUE (user_id, book_id, unlocked_at_milestone);

-- ── Index ─────────────────────────────────────────────────────

-- Powers the primary read query (fetch by user + book) and the unseen-count check.
CREATE INDEX IF NOT EXISTS lore_cards_user_book_idx
  ON lore_cards (user_id, book_id);

-- ── Row-Level Security ────────────────────────────────────────

ALTER TABLE lore_cards ENABLE ROW LEVEL SECURITY;

-- SELECT: users may only read their own lore cards.
CREATE POLICY "lore_cards_select_own"
  ON lore_cards FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users may only insert rows that belong to themselves.
CREATE POLICY "lore_cards_insert_own"
  ON lore_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users may only update their own rows (used for seen flag).
CREATE POLICY "lore_cards_update_own"
  ON lore_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users may only delete their own rows (primarily used via cascade).
CREATE POLICY "lore_cards_delete_own"
  ON lore_cards FOR DELETE
  USING (auth.uid() = user_id);
