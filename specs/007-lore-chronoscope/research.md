# Phase 0 Research: Lore Chronoscope

All major technical decisions that inform the data model, contracts, and tasks. Each entry is a Decision + Rationale + Alternatives triad.

---

## Decision 1 — Separate edge function `generate-lore` instead of extending `generate-recap`

**Decision**: Create a new edge function at `supabase/functions/generate-lore/index.ts`. Do **not** add a fifth mode to `generate-recap`.

**Rationale**:
- `generate-recap` already carries four modes (full, delta, passport_summary, blurb). Adding a fifth would push it past the complexity budget — the file would grow by another ~40 lines and the mode-dispatch nesting deepens.
- The lore prompt has a fundamentally different contract (JSON shape, no two-pass extraction, different system role). Mixing it in forces a conditional for every shared code path and increases the risk of regressions in recap paths.
- Keeping FR-009 from feature 006 clean: the AI-exclusion grep audit (`rg "useCache" supabase/functions/`) must continue to return zero matches for `generate-recap`. A separate function keeps that contract trivially verifiable.
- Separate functions allow independent quotas / observability / redeploys.

**Alternatives considered**:
- **Extend `generate-recap` with a `mode: 'lore'`** — rejected; complexity cost > perceived DRY benefit. The shared helpers (CORS headers, JWT decode) are ~20 lines and can be duplicated without shame.
- **Call Gemini directly from the frontend** — rejected; leaks the API key, no server-side rate limit, breaks constitution III (AI layer is server-mediated).

---

## Decision 2 — Milestone detection lives in `progress.ts:updateProgress`, not in a page component

**Decision**: After `syncToSupabase` confirms a progress write, `updateProgress` computes whether the save crossed a 10% milestone (previous-milestone vs new-milestone comparison) and calls `loreCardsStore.maybeUnlockForMilestone(bookId, milestone)` as fire-and-forget.

**Rationale**:
- `progress.ts` already houses the same pattern for Book Passport auto-generation (lines 150–157). Using the same seam keeps the progress-side-effect surface in one predictable place.
- Triggering from a page component (Dashboard Hero Card) is fragile: users can update progress from three different surfaces (Dashboard, Book Detail, Lexicon quick-save). Centralising means all entry points work identically.
- Milestone crossing is a domain concern (progress-save semantics), not a view concern.
- Keeps background work off the critical path: the UI shows the updated percentage immediately; lore generation fires in parallel.

**Milestone-crossing logic**:
```
previousMilestone = floor(previousPercentage / 10) * 10  // e.g., 18 → 10
newMilestone      = floor(newPercentage / 10) * 10       // e.g., 22 → 20
if (newMilestone > previousMilestone && newMilestone >= 10 && newMilestone <= 90) {
  trigger(newMilestone)  // FR-010: most recent crossed milestone only
}
```

**Alternatives considered**:
- **Check in the Dashboard Hero Card's save handler** — rejected; only one entry point is covered.
- **Database trigger (PostgreSQL)** — rejected; would need an AI call from a DB trigger or a webhook, adding moving parts. The edge function / fetch model is simpler and already used everywhere else.
- **Manual "Generate Lore" button** — rejected; contradicts the spec's "background, delightful surprise" framing.

---

## Decision 3 — Master Recap assembly rule

**Decision**: The Master Recap is built client-side inside `loreCardsStore.maybeUnlockForMilestone()` from the already-fetched `recapsByBook[bookId]` state. The filter is:

```
qualifying = recapsByBook[bookId]
  .filter(r => r.pageSnapshot <= currentPage && r.progressSnapshot > 0)
  .sort((a, b) => (a.pageSnapshot ?? 0) - (b.pageSnapshot ?? 0))

masterRecap = qualifying
  .map(r => `Memory jogger: ${r.memoryJogger}\nConcept watchlist: ${r.conceptWatchlist}\nThematic bridge: ${r.thematicBridge}`)
  .join('\n\n---\n\n')
```

**Rationale**:
- Existing `useRecapsStore.fetchRecapsForBook(bookId)` already populates this map via the SWR cache. No new server round-trip is needed.
- `progress_snapshot > 0` excludes page-0 blurbs per FR-002.
- Sorting by `page_snapshot` ascending produces a chronological narrative for the AI — easier for the model to follow.
- Joining with `---` separators gives the AI clear boundaries between per-milestone recaps without risking token-level ambiguity.

**Edge case — zero qualifying recaps**: Short-circuit in the store before any network call. Return early. FR-004 satisfied.

**Alternatives considered**:
- **Assemble server-side inside the edge function** — rejected; would require passing either raw recap rows (bloated payload) or a new Supabase query inside the edge function (duplicate logic, RLS complications). Client-side assembly reuses the SWR cache.
- **Send recap IDs and have the edge function fetch them** — rejected; adds a DB round-trip inside the edge function for no benefit.

---

## Decision 4 — Gemini model + prompt strategy (single-pass)

**Decision**: Use `gemini-2.5-flash`, single-pass (no extraction step), temperature 0.6, `maxOutputTokens: 2048`. Response format: strict JSON matching the contract `{ title, content, type, linked_entities }`. Parse in the edge function; return the parsed JSON to the client (non-streaming).

**Rationale**:
- The lore output is short (~150–300 words), so streaming adds UX noise without value. A single POST-and-wait call with JSON response is simpler and matches what the `loreCards` store and UI want.
- Temperature 0.6 is a balance between creativity (needed — lore is flavour) and grounded-ness (needed — must stick to Master Recap).
- The recap system already uses Gemini 2.5 Flash. Reusing it keeps the AI cost profile predictable and the integration surface minimal.

**Prompt structure (system instruction)**:
```
You are the Chronicler Historian. Your task is to surface a single piece of deep world-building —
a myth, legend, historical figure, or geographic lore — that enriches the reader's current journey
through "{title}" by {author}.

CRITICAL GUARDRAIL:
You will receive a "Master Recap" summarising everything the reader has encountered so far.
You MUST NOT reference any character, place, event, or detail that does not appear in the
Master Recap. If the Master Recap does not mention a given entity, treat it as unknown to the
reader and do not include it.

TASK:
Identify a reference in the Master Recap (a name, song, artefact, place, tradition) that has
historical or mythological depth in this book's world. Explain that deep-lore context —
who/what/when — without spoiling any future plot.

Focus on the HISTORY of the world, not the FUTURE of the plot. Do not speculate about
what comes next. Do not introduce characters or places absent from the Master Recap.

FORMAT (respond with a single raw JSON object only — no markdown, no code fences):
{
  "title": "<short evocative title, 3–8 words>",
  "content": "<150–300 words of lore, written in an inviting, immersive tone>",
  "type": "<one of: History, Myth, Geography>",
  "linked_entities": ["<names of entities from the Master Recap that this lore touches, up to 5>"]
}
```

**User message (per call)**:
```
Book: "{title}" by {author}
Current reading progress: {currentPage}/{totalPages} pages ({percentage}%) — milestone {milestone}%

Master Recap (everything the reader has seen so far):
{masterRecap}
```

**Alternatives considered**:
- **Two-pass like recaps** — rejected; Master Recap is already a distilled summary, not raw book text. No extraction step needed.
- **Stream the response** — rejected; lore is ≤ 300 words, streaming overhead > benefit.
- **Temperature 0.8+** — rejected; too creative → risk of hallucinating outside Master Recap.

---

## Decision 5 — `lore_cards` table schema and RLS

**Decision**: New table `lore_cards` in Supabase with per-user RLS identical to the existing `recaps` table pattern. Unique constraint `(user_id, book_id, unlocked_at_milestone)` to enforce the "one card per milestone per book" rule at the DB level (FR-001, FR-003).

**Schema**:
```sql
CREATE TABLE lore_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id               UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  content               TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('History', 'Myth', 'Geography')),
  linked_entities       TEXT[] NOT NULL DEFAULT '{}',
  unlocked_at_page      INTEGER NOT NULL,
  unlocked_at_milestone INTEGER NOT NULL CHECK (unlocked_at_milestone IN (10,20,30,40,50,60,70,80,90)),
  seen                  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id, unlocked_at_milestone)
);

ALTER TABLE lore_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own lore cards"
  ON lore_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lore cards"
  ON lore_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lore cards"
  ON lore_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lore cards"
  ON lore_cards FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_lore_cards_user_book ON lore_cards (user_id, book_id);
```

**Rationale**:
- `ON DELETE CASCADE` on `book_id` satisfies FR-032 (lore deleted when book deleted) without any app-level code.
- Unique `(user_id, book_id, unlocked_at_milestone)` means duplicate-generation attempts are rejected at the DB level — the store's pre-check is an optimisation, not the safety net.
- `seen BOOLEAN` supports the "New Lore" chip (FR-026 / FR-028): flipped to TRUE when the user navigates to the book detail page after unlock. Defaulting to FALSE means the chip shows by default on newly inserted rows.
- `type` CHECK constraint mirrors the AI output contract.
- `linked_entities TEXT[]` uses PG's native array type — simpler than a JSON column for a flat string list.

**Alternatives considered**:
- **Store lore on the `recaps` table** — rejected; different lifecycle, different shape, would bloat recaps with optional columns.
- **Use JSONB for the whole card body** — rejected; we want to filter/index by `type` and query by milestone; typed columns are cleaner.
- **Soft-delete** — rejected; v1 scope explicitly allows cascade delete to mirror existing behaviour.

---

## Decision 6 — Client cache key + SWR integration

**Decision**: Add `cacheKeys.lore(uid, bookId)` to the `useCache` primitive. The store's `fetchLoreForBook(bookId)` uses `swrStatus` / `swrRun` with TTL 120 000 ms (2 min).

**Rationale**:
- Lore changes rarely (only when a milestone is crossed), so a longer TTL than books (60 s) is justified and saves unnecessary revalidations on tab focus.
- Re-uses the battle-tested SWR layer from feature 006, including the auth-clear hook (`clearAll()` on user change) which satisfies FR-031 automatically.
- On successful `generate-lore` the store calls `swrTouch(cacheKeys.lore(uid, bookId))` with the new card appended to the local array — so the Chronoscope card on the Book Detail Page and the Great Library both render instantly without a refetch.

**Alternatives considered**:
- **No cache; direct fetch every visit** — rejected; regresses the instant-navigation UX from feature 006 and violates SC-005 (≤ 100 ms render on return).
- **IndexedDB persistence** — rejected; feature spec explicitly says "no offline requirement for lore"; SWR memory cache + server persistence is enough.

---

## Decision 7 — Route / nav label rename strategy

**Decision**: Keep the existing route path `/lexicon` and the route name `'lexicon'`. Rename only the bottom-nav **label** from "Lexicon" to "Great Library" and rename the **page component file** from `LexiconPage.vue` → `GreatLibraryPage.vue`. Inside the new page, wrap existing lexicon markup in a PrimeVue `<Tabs>` with two `<TabPanel>`s: "Lexicon" and "Lore Cards".

**Rationale**:
- Route path `/lexicon` is stable — any bookmarks, share links, or router history continue to work.
- Users only see the label text in the bottom nav (mobile PWA; URLs not visible).
- Renaming the file forces call-site updates (compile-time safety) — catches missed references.
- `<Tabs>` is already a PrimeVue component the app uses elsewhere; no new dependency.

**Tab implementation detail**: The tab component preserves the existing `?bookId=` query param — it drives both tabs. Switching tabs does not reset the book filter (FR-014).

**Alternatives considered**:
- **Redirect `/lexicon` → `/great-library`** — rejected; adds a router redirect that's a no-op improvement over keeping the URL. More moving parts for zero user-visible benefit.
- **Two separate routes (`/lexicon` and `/lore-cards`)** — rejected; breaks "single cohesive home for knowledge" goal from spec; also would require a new bottom-nav entry (FR-018 violation).

---

## Decision 8 — "New Lore" chip persistence model

**Decision**: The `seen BOOLEAN` flag on `lore_cards` is the single source of truth. Chip shows on any book that has `SELECT COUNT(*) FROM lore_cards WHERE user_id = ? AND book_id = ? AND seen = FALSE > 0`. When the user navigates to Book Detail Page, mark all of that book's unseen lore as seen via a single UPDATE.

**Rationale**:
- Server-side persistence means the chip is dismissed consistently across devices (FR-028).
- Single boolean avoids a separate "seen_at" timestamp; we don't need the when, only the what.
- Batch UPDATE (`WHERE user_id = ? AND book_id = ? AND seen = FALSE`) is one query regardless of how many unseen cards.
- Marking occurs on Book Detail Page mount (inside `onMounted`), not on chip click — covers the case where the user navigates via URL / back button / another path, not just the chip itself.

**Alternatives considered**:
- **localStorage flag** — rejected; doesn't sync across devices.
- **Per-card "viewed" timestamps** — rejected; over-engineering for v1.
- **`unseen_count` computed on the client only** — rejected; server-side is the only way to be consistent across session/device.

---

## Decision 9 — Toast system reuse

**Decision**: Reuse the existing PrimeVue `ToastService` (already wired up for recap errors / progress save confirmations). The `loreCardsStore.maybeUnlockForMilestone()` emits a `toast.add({ severity: 'success', summary: 'New Lore Unlocked', detail: book.title, life: 4000 })` on success.

**Rationale**:
- Zero new dependencies. Consistent visual style with other app toasts.
- 4-second life is long enough to read but doesn't block interactions.

**Alternatives considered**:
- **Custom floating banner** — rejected; creates visual inconsistency. Toast already used for similar events.
- **Push notification (service worker)** — rejected; out of scope for v1; requires user permission prompts.

---

## Decision 10 — Background generation error handling

**Decision**: Any error in `maybeUnlockForMilestone` (network, AI failure, JSON parse error, RLS rejection) is caught inside the store function and logged to `console.error`. No user-facing error. No retry attempt in the same session. Next milestone crossing triggers a fresh attempt for the new milestone (but not the failed one — keep it simple; we accept that a failed milestone produces no card ever for that reader).

**Rationale**:
- FR-008 explicitly requires silent failure.
- Retry logic introduces state management for "pending retry" which complicates the store for marginal benefit.
- A user who never gets lore for milestone 20 but gets it for 30, 40, 50 will still have 3 cards — plenty of lore. The product loss from one missed milestone is near-zero.

**Alternatives considered**:
- **Exponential backoff retry queue** — rejected; complexity outsized versus marginal reliability gain.
- **Log to Supabase errors table** — rejected; `console.error` is enough for v1; can be upgraded to Sentry later without spec change.

---

## Summary of unresolved items

**None.** All NEEDS CLARIFICATION markers from the spec were resolved either in the Assumptions section of the spec or the 10 decisions above. Ready for Phase 1 (data model + contracts + quickstart).
