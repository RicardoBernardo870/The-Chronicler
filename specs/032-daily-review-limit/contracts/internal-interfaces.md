# Contract: Internal interfaces

No external API. Below are the internal store / composable / UI seams that change. Builds on 031 (mastered exclusion already present in these files).

## Store — `src/stores/lexicon.ts` (modified)

New exported constant + computeds + flag:

```ts
DAILY_REVIEW_LIMIT: 20

reviewedTodayCount: ComputedRef<number>   // entries with lastReviewedAt >= local midnight
dailyRemaining:     ComputedRef<number>   // max(0, 20 - reviewedTodayCount)
eligibleReviewWords: ComputedRef<LexiconEntry[]> // due & !mastered & !reviewedToday, lowest-box→most-overdue
todaysReviewSet:    ComputedRef<LexiconEntry[]>  // eligibleReviewWords.slice(0, dailyRemaining)
activeReviewWords:  ComputedRef<LexiconEntry[]>  // reviewMore ? eligibleReviewWords : todaysReviewSet
extraAvailable:     ComputedRef<boolean>         // eligibleReviewWords.length > todaysReviewSet.length

reviewMore:        Ref<boolean>
enableReviewMore(): void   // lifts the cap for the rest of the day/session
```

Modified behavior:
- `updateLeitner(entryId, 'advance'|'reset')` — the `UPDATE` payload gains `last_reviewed_at: nowIso`, and the optimistic in-memory entry sets `lastReviewedAt = nowIso` (alongside box/next_review_at). Rollback restores the snapshot.
- `masterWord(entryId)` — the `UPDATE` payload gains `last_reviewed_at: nowIso`; optimistic entry sets it too.
- `resolveWordOfTheDay(userId)` — picks `activeReviewWords[0]` instead of `getDueWord(allEntries)`. The "preview/all caught up" branch distinguishes: **caught up for today** (`todaysReviewSet` empty but `extraAvailable`) vs **all caught up** (no eligible words).
- The Word of the Day remaining-count source becomes `activeReviewWords.length` (supersedes 031's raw `dueTodayCount` for display).

## Composable — `src/composables/useLeitner.ts` (modified, minor)

- `advanceBox` / `resetBox` unchanged.
- `getDueWord` is superseded by the store's `activeReviewWords` selection for the Word of the Day; it may be removed or left unused. (No behavior depends on it once `resolveWordOfTheDay` switches sources.)

## Composable — `src/composables/useAnkiSession.ts` (modified)

```ts
dueCards: ComputedRef<LexiconEntry[]>  // = lexiconStore.activeReviewWords, ordered highest-box-first, slice(0,20)
```
- Stops filtering/sorting raw `entries`; instead consumes the store's `activeReviewWords` (already capped + reviewed-today-excluded + mastered-excluded), re-ordered `b.leitnerBox - a.leitnerBox` and capped at 20 per session.
- `onKnew` → `masterWord` and `onDidntKnow` → `updateLeitner('reset')` unchanged (both now also stamp `last_reviewed_at` via the store).
- Exposes a way to trigger `lexiconStore.enableReviewMore()` for the "review more" affordance.

## UI — `src/components/dashboard/WordOfTheDay.vue` (modified)

- Remaining-count shows today's set size, framed as the daily target (e.g. `{{ activeReviewWords.length }} left` / "X of 20 today").
- New **"caught up for today"** state when `todaysReviewSet` is empty but `extraAvailable` is true: a friendly "You've done your 20 for today" with a **"Review more"** action (calls `enableReviewMore`).
- The existing **"all caught up"** state remains for when nothing is eligible at all.
- Advance behavior unchanged (still `updateLeitner('advance')`, which now also stamps the review time).

## UI — `src/pages/AnkiReviewPage.vue` (modified)

- The summary / empty state gains a **"Review more"** action when the session's capped set is done but `extraAvailable` is true (calls `enableReviewMore`, then rebuilds the deck).
- The 1-based "X / N" position indicator (from 031) is unchanged.

## Data flow summary

```text
review action (advance/reset/master)
        └─ store UPDATE … set last_reviewed_at = now ──┐
                                                        ▼
reviewedTodayCount ─▶ dailyRemaining ─▶ todaysReviewSet ─▶ activeReviewWords
        eligibleReviewWords (due & !mastered & !reviewed-today, lowest-box→most-overdue)
                                                        ├─▶ Word of the Day: activeReviewWords[0], count = length
                                                        └─▶ Anki dueCards: activeReviewWords, highest-box-first, ≤20
"Review more" ─▶ enableReviewMore() ─▶ reviewMore=true ─▶ activeReviewWords ignores the cap
```
