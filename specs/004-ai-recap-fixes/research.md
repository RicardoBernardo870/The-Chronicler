# Research: AI Recap & Progress Tracking Fixes

## Decision 1 — Fragment cache removal from recap generation

**Decision**: Remove the `fragments` pass-through from the recap generation path entirely. Keep `extract_only` mode for milestone extractions, but the main recap will always run its own fresh Pass 1 over the relevant page range.

**Rationale**: The database confirms that 4 of 6 fragments for the test book contain `{raw: ""}` or truncated JSON. When these are passed as context to Pass 2, the AI receives garbage and produces empty JSON fields — causing the "incomplete recap received" error. Removing the cache is simpler and produces consistently better results. With incremental (range-based) recaps, Pass 1 covers only the delta pages (e.g., 30→60), so it is fast regardless; caching a full-book extraction is not needed.

**Alternatives considered**: Fix fragment validation and filter bad fragments before use. Rejected because even valid fragments (page 12% and page 78%) are full-book summaries, not delta summaries. Passing them to a recap that should only cover pages 30–60 would confuse the AI with out-of-scope content.

---

## Decision 2 — Supabase JS v2 lazy query execution

**Decision**: All fire-and-forget Supabase insert calls that currently have no `.then()` must be changed to `.then(() => {})`. This is the root cause of `progress_history` being globally empty.

**Rationale**: In Supabase JS v2, calling `.insert({...})` returns a `PostgrestFilterBuilder` (a thenable). The HTTP request is only dispatched when the promise is consumed — via `await`, `.then()`, or implicit resolution. Without any of these, the HTTP call is never made. The RLS policy and table schema are both correct; only the dispatch is missing.

**Alternatives considered**: Wrapping in `void supabase.from(...).insert(...)` — `void` only silences the TypeScript "unhandled promise" warning; it does not force execution. The `.then(() => {})` approach is required.

---

## Decision 3 — Incremental (range-based) recap via `from_page`

**Decision**: Add a `from_page` parameter to `RecapRequest` and the edge function. The value is sourced from `latestRecapForBook().pageSnapshot ?? 0`. Pass 1 extraction prompt is updated to cover only `from_page+1 → currentPage`.

**Rationale**: All five recaps in the database (`progress_snapshot` 18%, 31%, 46%, 57%, 100%) all start their summaries with "Bilbo Baggins was reluctantly pulled into an adventure..." — identical opening. The reader has already read this summary. Incremental recaps make each new recap genuinely new and useful.

**Alternatives considered**: Storing fragment boundaries as the basis for incremental recaps. Too complex and dependent on the cache system being removed. Direct `from_page` parameter is cleaner.

---

## Decision 4 — BookPassport narrative mode (`passport_summary`)

**Decision**: Add a new `passport_summary` mode to the edge function that bypasses Pass 1 entirely and uses a new narrative system prompt. The response is a streamed plain-text paragraph — no JSON structure.

**Rationale**: The current `full_summary` mode uses `buildRecapPrompt()` which instructs the AI to return `{"memory_jogger": ..., "concept_watchlist": ..., "thematic_bridge": ...}`. The database confirms the stored `ai_summary` is exactly this JSON string. `BookPassportPage` renders it as plain text and shows the user raw JSON. A narrative prompt produces the flowing summary the passport page expects.

**Alternatives considered**: Parse the existing JSON fields from `full_summary` and concatenate them into a paragraph on the client. Rejected — the passport deserves a purpose-written narrative, not stitched together JSON values.

---

## Decision 5 — Fragment validation gate

**Decision**: In `recapFragments.ts`, validate the returned JSON before saving: the object must have a `key_events` array with at least one entry and must NOT have a `raw` key. Invalid extractions are silently discarded — no row written to the database.

**Rationale**: The database shows `{raw: ""}` rows are already stored and will accumulate. Preventing future ones stops the problem. Existing bad rows in the database have no effect once the fragment cache is removed from recap generation.

**Alternatives considered**: Delete existing bad fragments. Not necessary since they are no longer used; simpler to leave them and stop creating new ones.

---

## Decision 6 — `totalDays` fix for single-session completions

**Decision**: Change the `histRows.length >= 2` guard to `>= 1` in `bookPassport.ts`. For a single row, `totalDays = 1`. For a single calendar day with multiple rows, `totalDays = 1`.

**Rationale**: A reader who completes a book in one sitting should see "1 day" not null. The current guard produces null whenever history has exactly one row.

---

## Decision 7 — Recap button lockout at 100% progress

**Decision**: Wrap the entire AI Recap `<section>` in `BookDetailPage.vue` with `v-if="!isComplete"`. The passport button (already added) is shown instead.

**Rationale**: At 100% the book is finished. There are no more "upcoming pages" to be spoiler-free about. The standard three-part recap format is not meaningful. The passport is the correct destination.

**Note**: Recap history already in the database is preserved; it just won't be surfaced from BookDetail once complete.

---

## Decision 8 — Token budget increase

**Decision**: Increase `maxOutputTokens` for Pass 1 from 4096 to 8192. Pass 2 stays at 4096 (the three-part recap is short).

**Rationale**: The fragment at page 100 (`31.25%`) is truncated mid-sentence — `"The Great Goblin:"` — because the extraction hit the 4096 token ceiling. The Hobbit has 320 pages; larger books will truncate even earlier. 8192 covers the extraction pass safely.
