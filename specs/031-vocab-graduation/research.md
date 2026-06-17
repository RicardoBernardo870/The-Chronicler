# Phase 0 Research: Vocabulary Review Progress & Word Graduation

**Feature**: 031-vocab-graduation | **Date**: 2026-06-17

No open `NEEDS CLARIFICATION` markers remained after `/speckit-clarify`; all decisions below are grounded in the existing codebase and the resolved spec.

## R1 — How to represent the terminal "Mastered" state

- **Decision**: Add a single column `mastered boolean not null default false` to `lexicon_entries`. Thread it through `LexiconEntry`, `LexiconEntryRow`, and `mapLexiconEntry`.
- **Rationale**: The spec only needs a yes/no terminal flag (badge + queue exclusion); FR-016 explicitly forbids tracking stats, so a "mastered_at" timestamp would be unused. A `NOT NULL` column with a **constant** default is a metadata-only catalog change in modern Postgres (no full-table rewrite), and existing rows default to `false` (FR-015). The table's existing owner RLS governs the new column unchanged (Supabase `security-` guidance).
- **Alternatives considered**: `mastered_at timestamptz null` (rejected — implies date tracking we don't surface or need); a separate `mastered_words` table (rejected — 1:1 with the entry, needless join); encoding mastery as a sentinel `leitner_box = 6` (rejected — overloads the box meaning and breaks ordering/interval math).

## R2 — Where graduation is triggered, and the WotD vs Anki asymmetry

- **Decision**: Only `useAnkiSession.onKnew` masters a word (via a new `lexiconStore.masterWord(id)`), regardless of box. The Word of the Day arrow and the Great Library card's "I know this" keep calling `updateLeitner('advance')` (promote only). `onDidntKnow` keeps `updateLeitner('reset')`.
- **Rationale**: Matches the resolved spec exactly (FR-007/FR-008): the dashboard and library advance words through the Leitner system; only the Anki recall test graduates them. Box is irrelevant to mastery per the user's final correction.
- **Alternatives considered**: Master at box 5 only (rejected — the user explicitly removed the box condition); also mastering from the WotD arrow (rejected — breaks the intended asymmetry).

## R3 — Excluding mastered words from the two queues

- **Decision**: Add a `!mastered` filter in `useLeitner.getDueWord` (drives the WotD card) and in `useAnkiSession.dueCards` (drives the Anki deck). Flip the `dueCards` sort to descending box (later boxes first); keep `getDueWord` ascending for the WotD walk-through.
- **Rationale**: Filtering at the two queue builders guarantees mastered words disappear from every review surface and every due count (FR-009, FR-013) with no scattered checks. Descending order satisfies FR-010/US3 ("later boxes first") while both surfaces still draw from the same shared due pool (Q2 = C).
- **Alternatives considered**: Filtering inside each component (rejected — duplicated, error-prone); a server-side "due" RPC (rejected — review scheduling is already entirely client-side; adding an RPC is over-engineering for this scope).

## R4 — The remaining-count on the Word of the Day card

- **Decision**: Derive a `dueTodayCount` computed in the lexicon store = count of non-mastered entries with `nextReviewAt <= today`. Display it as a small badge next to the card label, **only** in the single-word review state.
- **Rationale**: The card already advances words by clearing the daily cache and re-resolving, so the due set shrinks as the user taps; a derived count recomputes and counts down to zero ("All caught up") with no extra state to keep in sync (FR-001–FR-004). The card already computes a `due` array for its Anki-CTA threshold, so the data is on hand.
- **Alternatives considered**: Persisting a counter (rejected — redundant, drift risk); counting the whole lexicon (rejected — must reflect due-today only, FR-002).

## R5 — Anki position indicator

- **Decision**: Change the header from `{{ currentIndex }} / {{ dueCards.length }}` to a 1-based, clamped `min(currentIndex + 1, total) / total` so it reads "5 of 15".
- **Rationale**: `currentIndex` is 0-based and increments after answering, so today it shows "answered / total" and never reaches the last position. A 1-based clamp makes it read as the human card position (FR-005).
- **Alternatives considered**: Leaving it as completed-count (rejected — the spec calls for a natural position indicator).

## R6 — Surfacing Mastered in the Great Library

- **Decision**: Carry `mastered` through `mapLexiconEntry` → `LexiconSearchResult` (search already `select('*')`), and in `LexiconCard` show a "Mastered" pill when `entry.mastered` is true. The card's "I know this / Review again" buttons are removed entirely (review happens only on the Word of the Day card and the Anki session), so there are no per-card review actions to conditionally hide. No change to the search query or default list composition.
- **Rationale**: Q1 = B (mastered shown inline with a badge, not hidden). Reusing the existing `lc-badge` styling keeps the card consistent; removing the buttons reflects that the Great Library is for browsing, not reviewing.
- **Alternatives considered**: A dedicated "Mastered" filter/tab (rejected — Q1 chose inline); a separate Mastered screen (rejected — out of scope).

## R7 — Optimistic write + rollback for mastering

- **Decision**: `masterWord` follows the same shape as `updateLeitner`: snapshot → optimistic set `mastered = true` in the in-memory store → `UPDATE lexicon_entries set mastered = true where id = …` → touch per-book + all-books SWR caches → rollback on error → if it was the current WotD, clear the daily cache and re-resolve.
- **Rationale**: Consistency with the established store pattern (Principle IV); the user sees the word leave the deck immediately, with correctness preserved on failure.
- **Alternatives considered**: Fire-and-forget write (rejected — violates the confirm-before-trust pattern); batching (unnecessary — one card at a time).
