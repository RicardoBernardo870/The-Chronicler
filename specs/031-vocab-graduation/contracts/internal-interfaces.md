# Contract: Internal interfaces

This feature exposes no external API. Contracts below are the internal store / composable / UI seams that change.

## Store — `src/stores/lexicon.ts` (modified)

New action:

```ts
// Terminal: mark a word Mastered (removes it from all review queues). Mirrors
// updateLeitner's optimistic-apply → UPDATE → cache-touch → rollback flow, and
// re-resolves the Word of the Day if the mastered word was the current one.
masterWord(entryId: string): Promise<void>
```

New computed (exported from the store):

```ts
// Count of non-mastered entries whose nextReviewAt <= today (the words the
// Word of the Day arrow will walk through). Recomputes reactively.
dueTodayCount: ComputedRef<number>
```

Behavior:
- `masterWord` sets `mastered = true` optimistically in `entriesByBook`, writes `UPDATE lexicon_entries set mastered = true where id = :id`, touches `cacheKeys.lexicon(uid, bookId)` + `cacheKeys.lexiconAll(uid)`, rolls back the in-memory entry on error, and (if `_wotdEntryId === entryId`) clears the daily WotD cache and calls `resolveWordOfTheDay`.
- `updateLeitner` is unchanged (still used by advance/reset paths).

## Composable — `src/composables/useLeitner.ts` (modified)

```ts
getDueWord(entries: LexiconEntry[]): LexiconEntry | null
```
- Now filters `e => e.nextReviewAt <= today && !e.mastered` before sorting (ascending box, then earliest due). `advanceBox`/`resetBox` unchanged.

## Composable — `src/composables/useAnkiSession.ts` (modified)

```ts
dueCards: ComputedRef<LexiconEntry[]>   // non-mastered, due, ordered highest-box first, slice(0,20)
onKnew(): Promise<void>                 // → lexiconStore.masterWord(card.id)   (was: updateLeitner 'advance')
onDidntKnow(): Promise<void>            // → lexiconStore.updateLeitner(card.id, 'reset')  (unchanged)
```
- `dueCards` filter gains `&& !e.mastered`; sort changes from `a.leitnerBox - b.leitnerBox` to `b.leitnerBox - a.leitnerBox`.
- Session known/unknown counters and `onExit` (save session stats) are unchanged — "Knew it" still increments `sessionKnown`.

## UI — `src/components/dashboard/WordOfTheDay.vue` (modified)

- In the **normal single-word review state only**, render a remaining-count badge (e.g. `{{ dueTodayCount }} left` or `n / total`) next to the "Word of the Day" label.
- Not rendered in the "All caught up" / preview state or the "Vocabulary Review" CTA state (FR-004).
- No change to `markReviewed` (still `updateLeitner('advance')`) — the card never masters.

## UI — `src/pages/AnkiReviewPage.vue` (modified)

- Header position indicator changes to a 1-based, clamped reading: `{{ Math.min(currentIndex + 1, dueCards.length) }} / {{ dueCards.length }}` (renders "5 / 15"). Summary/empty states unchanged.

## UI — `src/components/lexicon/LexiconCard.vue` (modified)

- The "✓ I know this" / "✗ Review again" buttons (and the `advance`/`reset` emits) are **removed** — the card is now flip-to-define only. Parents `GreatLibraryPage.vue` and `LexiconPage.vue` drop the `@advance`/`@reset` bindings and their `onAdvance`/`onReset` handlers (and the now-unused `useLexiconStore` import in `GreatLibraryPage`).
- Add a "Mastered" pill (reusing the local `lc-badge` style) shown when `entry.mastered` is true.

## Data flow summary

```text
Anki "Knew it" ─▶ useAnkiSession.onKnew ─▶ lexiconStore.masterWord ─▶ UPDATE mastered=true
                                                          │
   getDueWord (WotD)  ◀── excludes mastered ──────────────┤
   dueCards  (Anki)   ◀── excludes mastered, later-box 1st┤
   dueTodayCount      ◀── excludes mastered ──────────────┘
   Great Library      ◀── mastered=true → "Mastered" badge, actions hidden
```
