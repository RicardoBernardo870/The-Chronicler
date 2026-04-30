# Phase 0 Research — Reader Profile Page

All Technical Context items had concrete defaults from prior features and the constitution; no `NEEDS CLARIFICATION` markers were carried into this plan. The following decisions consolidate the design choices that drive Phase 1.

## Decision 1 — Vocabulary words reuse `lexicon_entries`, not a new table

- **Decision**: Auto-extracted vocabulary words are stored in the existing `public.lexicon_entries` table. The table is extended with one new column, `source text not null default 'manual'`, where allowed values are `'manual' | 'auto'`. A separate `public.vocabulary_extractions` ledger table records each extraction *event* (one row per capture-extraction call) for dedup, retry, and observability.
- **Rationale**: FR-018 requires dedup against the user's existing Lexicon and FR-019 requires words to flow into the existing Leitner system. Both are free if the entries live in the same table that already powers Leitner. The `lexicon_entries` shape (`book_id`, `page_found`, `definition`, `context_sentence`, `leitner_box`) already covers FR-022a (source attribution) and FR-017 (in-context definition).
- **Alternatives considered**:
  - *New `vocabulary_words` table* — rejected. Would force a UNION query in every Lexicon view and re-implement Leitner promotion against two tables.
  - *No event ledger* — rejected. Without it, retry-deduplication on a re-captured page (edge case in spec) becomes a full Lexicon scan.

## Decision 2 — Reading DNA is one row per user, replaced on regeneration

- **Decision**: `public.reading_dna` is keyed by `user_id` (PK = `user_id`). Regeneration overwrites the row. The previous DNA is not archived in v1.
- **Rationale**: FR-010 requires reuse on revisit; FR-011 ties regeneration to a threshold; nothing in the spec asks for DNA history. Single-row-per-user keeps reads trivial and zero-AI-call on revisit (SC-005).
- **Alternatives considered**: append-only history table (too much cost for a feature with no history UI in v1).

## Decision 3 — Threshold gating lives in the client; the edge function is dumb

- **Decision**: The client's `readingDna` store decides whether to invoke `generate-reading-dna`. The decision is: invoke if (no row exists AND `booksFinished ≥ 3`) OR (row exists AND (`booksFinishedSinceGen ≥ 3` OR `daysSinceGen ≥ 90`)). The edge function itself always generates when called.
- **Rationale**: FR-011 + FR-012 — generation must NOT be triggered automatically on every load. Putting the gate in the client avoids paying an edge-function cold start just to return "not yet."
- **Alternatives considered**: server-side gating returning 304-style no-op — rejected as needless network round-trip.

## Decision 4 — Vocabulary extraction is a non-awaited HTTP call from the client

- **Decision**: After `capturesStore.saveCapture()` resolves, the client calls `extract-vocabulary` *without awaiting* the response. Errors are logged to console only, never surfaced. The composable wraps the call so callers don't have to remember.
- **Rationale**: FR-020 + SC-004 — capture latency must not regress more than 50 ms. Fire-and-forget guarantees this. SC-003 allows up to 30 s for words to appear, so async is acceptable to the user.
- **Alternatives considered**:
  - *Database trigger on `page_captures` insert* — rejected. Triggers can't call external HTTP; would need pg_net or a Postgres → edge function bridge. Higher complexity for no UX gain.
  - *Edge function called server-side from `ocr-page`* — rejected. Couples two concerns, slows OCR confirmation.

## Decision 5 — Stats computed client-side from existing Pinia stores

- **Decision**: Lifetime stats, top themes, and library breakdown are derived in client composables from `useBooksStore`, `useProgressStore` (uses `progress_history`), `useRecapsStore`, `useLoreCardsStore`, `useCapturesStore`. No materialized views or summary tables.
- **Rationale**: FR-006 is explicit. SC-001 (2 s render) is achievable because all stores are already loaded for other pages and shared via SWR cache.
- **Alternatives considered**: server-side `profile_summary` view — rejected; spec disallows new persistent storage for derivable values.

## Decision 6 — Top Themes corpus = recaps + lore card titles/summaries

- **Decision**: Theme frequency is computed by tokenizing `recaps.summary_text` (Memory Jogger + Concept Watchlist + Thematic Bridge) and `lore_cards.title` + `lore_cards.summary`. A small stop-word list is applied. Words are normalized to lowercase singular forms. Top 30 by frequency are surfaced as PrimeVue `Chip` elements with size scaled by frequency.
- **Rationale**: Spec assumption explicitly says recaps + lore are the corpus. Tokenizing client-side is fast (typical user has < 200 recaps × ~500 chars each).
- **Alternatives considered**: AI-summarized themes — rejected; introduces a third AI call per Profile load, breaking the "no AI on page load" intent of FR-012's spirit.

## Decision 7 — Streaks use local-timezone day buckets

- **Decision**: Current and longest streaks group `progress_history` rows by `recordedAt` formatted as `yyyy-MM-dd` in the user's local timezone (plain `toLocaleDateString` with `en-CA` formatter).
- **Rationale**: Spec assumption: "Reading streak ... user's local timezone."
- **Alternatives considered**: UTC bucketing — rejected; would mis-attribute late-night sessions across midnight UTC.

## Decision 8 — Reading DNA prompt uses Gemini 2.5 Flash with structured JSON output

- **Decision**: Prompt asks Gemini for a JSON object: `{ personality: string, moodSignature: { tone: string, emojis: string[] }, suggestions: [{ title, author, reason }] }`. Edge function validates with a typed parser and rejects malformed responses (returns 502, client preserves prior DNA).
- **Rationale**: Same model as `generate-recap` and `generate-lore` — minimizes new operational surface. JSON-mode parsing already proven in `generate-lore`.
- **Alternatives considered**: free-text Markdown → regex parse — rejected; lower fidelity, harder to surface mood signature.

## Decision 9 — Vocabulary extraction prompt asks for 0–5 words, never more

- **Decision**: Prompt instructs Gemini: "Select up to 5 words an educated adult literary reader would likely encounter rarely or want to remember. Return JSON: `{ words: [{ word, definition }] }`. The definition MUST reflect how the word is used in this exact passage. Exclude proper nouns. If the passage contains no qualifying words, return an empty array."
- **Rationale**: FR-029 specifies AI holistic judgment, FR-022 excludes proper nouns, FR-016 hard-caps 5. The prompt is the contract.
- **Alternatives considered**: External CEFR word-list filtering — rejected by FR-029 clarification.

## Decision 10 — Existing `lexicon_entries.entry_type` not reused for source flag

- **Decision**: We add a new `source` column rather than reusing `entry_type` (currently `'dictionary' | 'lore'`). Auto-extracted words still set `entry_type = 'dictionary'`; the new `source = 'auto'` is orthogonal.
- **Rationale**: `entry_type` describes *what kind of definition* the entry holds. `source` describes *how it got there*. Conflating them would force future decisions like "what `entry_type` is an auto-extracted lore term" — better to keep dimensions separate.
- **Alternatives considered**: extending `entry_type` enum to `'dictionary' | 'lore' | 'auto'` — rejected as muddled semantics.

## Decision 11 — Mood signature representation

- **Decision**: A small object `{ tone: 'contemplative' | 'urgent' | 'melancholy' | 'hopeful' | ..., emojis: string[3] }`. UI renders the 3 emojis as a `Chip` row beneath the personality paragraph.
- **Rationale**: Spec assumption deferred exact rendering to planning; smallest viable shape that's both AI-friendly (JSON) and instantly user-meaningful.
- **Alternatives considered**: per-axis numeric scores (energy/light/inward) — rejected as harder for user to interpret at a glance.

## Decision 12 — DNA threshold counts use existing `progress.completedBooks`

- **Decision**: "Books finished" is the length of `progressStore.completedBooks` (already a getter). "Books finished since last DNA generation" is `completedBooks.length − reading_dna.books_finished_at_generation`.
- **Rationale**: Single source of truth, already cached.
- **Alternatives considered**: separate counter column — rejected, wasteful.

---

**All NEEDS CLARIFICATION items resolved**: ✅ (none were carried in; spec clarifications had already locked in the three pending choices on FR-027, FR-028, FR-029, plus FR-004 genre source and FR-022a source-attribution UX in /speckit-clarify).
