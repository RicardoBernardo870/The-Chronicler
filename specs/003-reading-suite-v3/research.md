# Research: Reading Suite v3

## Decision 1: ISBN Field-by-Field Merge Strategy

**Decision**: Modify `useIsbn.ts` to merge fields from both sources rather than full-fallback. Run Open Library first, collect missing fields, then run Google Books only for those gaps.

**Rationale**: The current composable already imports both APIs but falls back entirely to Google Books if Open Library returns nothing. The new logic: if Open Library returns a partial result (e.g., has title/author but no cover), merge the missing fields from Google Books rather than discarding the Open Library result. This is a targeted change to one function.

**Implementation pattern**:
```typescript
const merge = async (isbn: string): Promise<BookMetadata | null> => {
  const ol = await fetchFromOpenLibrary(isbn)   // may have partial data
  const missingFields = ['coverUrl','totalPages','genre','author'].filter(
    f => ol?.[f as keyof BookMetadata] == null
  )
  if (!ol || missingFields.length === 0) return ol
  const gb = await fetchFromGoogleBooks(isbn)
  if (!gb) return ol
  return { ...gb, ...Object.fromEntries(
    Object.entries(ol).filter(([,v]) => v != null)
  )} as BookMetadata
}
```

**Alternatives considered**: Always run both in parallel — rejected because it doubles API calls even when Open Library has complete data.

---

## Decision 2: Library Sort Order

**Decision**: Sort order in `LibraryPage.vue` (client-side computed): most-recently-updated in-progress book first (pinned), then remaining in-progress ascending by %, then 0%-progress books in user-defined Up Next order, then completed books most-recently-completed first.

**Rationale**: This pins the active read without a label and naturally groups the library into meaningful sections. All data is already available client-side via `progressStore`.

**Alternatives considered**: Server-side ordering — rejected because it would require an additional Supabase query with a complex join.

---

## Decision 3: Grid View Implementation

**Decision**: New `BookGridCard.vue` component. Toggle state stored in `localStorage` key `library-view-mode`. Grid uses CSS Grid (`grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))`).

**UX details**:
- Cover image fills the card top (aspect ratio 2:3, object-fit cover)
- Title overlaid at the bottom with a frosted-glass gradient scrim
- Progress shown as a thin colored bar at the very bottom edge of the card
- Missing cover: placeholder with book icon + initials in muted indigo

**Rationale**: `auto-fill` + `minmax` gives responsive columns without breakpoints. 140px minimum fits 2 columns on 320px screens (iPhone SE) and 3–4 on larger phones.

---

## Decision 4: Up Next Ordering Storage

**Decision**: Store ordering in a new `up_next_order` Supabase table (`user_id`, `book_id`, `sort_position`). Use Vuedraggable (already a common Vue 3 DnD library) for drag-to-reorder.

**Rationale**: Server-side storage ensures order syncs across devices. A single upsert on drop handles persistence. Vuedraggable is the standard Vue 3 drag-and-drop solution and has no heavy dependencies.

**Alternatives considered**: `localStorage` only — rejected because it breaks multi-device sync (Principle IV). Array stored as JSONB in a user preferences table — rejected because it makes partial updates harder.

---

## Decision 5: iOS Background Gradient (Safe Area)

**Decision**: Add `<meta name="theme-color">` to `index.html` matching the dark background hex. Add CSS `env(safe-area-inset-top)` padding to the `html` element so the gradient extends behind the notch.

**Implementation**:
```css
html {
  padding-top: env(safe-area-inset-top);
  /* existing min-height/background... */
}
```
```html
<!-- index.html -->
<meta name="theme-color" content="#0a0a14" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f0f4ff" media="(prefers-color-scheme: light)">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

**Rationale**: `black-translucent` status bar style on iOS allows the web content to render behind the status bar. The gradient on `html` already covers the full document — the safe-area padding pushes content down so it isn't obscured, and the `theme-color` meta ensures the browser chrome matches.

---

## Decision 6: Recap History Page Number Storage

**Decision**: Add `page_snapshot INTEGER` column to the `recaps` table. Update `recaps.ts` store to pass `currentPage` on insert. Update `RecapCard.vue` and `RecapHistory.vue` to display it.

**Migration**: Simple `ALTER TABLE recaps ADD COLUMN page_snapshot integer;` — nullable to not break existing rows.

---

## Decision 7: Lexicon — Free Dictionary API

**Decision**: Use `https://api.dictionaryapi.dev/api/v2/entries/en/{word}` (Free Dictionary API, no key required). Parse `meanings[0].definitions[0].definition` as the primary definition.

**Lore entries**: Stored with `entry_type = 'lore'` and `definition` filled manually. No API call made.

**Flip card**: CSS 3D transform (`rotateY(180deg)`) on tap/click. Front: word + type badge. Back: definition + context sentence + page number. State managed with a local `ref<boolean>` per card.

---

## Decision 8: Leitner System (Spaced Repetition)

**Decision**: Implement a 5-box Leitner system in pure TypeScript in `useLeitner.ts`. State stored in Supabase (`lexicon_entries.leitner_box`, `lexicon_entries.next_review_at`).

**Box intervals**: Box 1 = 1 day, Box 2 = 2 days, Box 3 = 4 days, Box 4 = 8 days, Box 5 = 16 days. "Known" = move to next box; "Forgotten" = reset to Box 1.

**Word of the Day selection**: Query all entries where `next_review_at <= today`, pick the one with the lowest box number first (most overdue gets priority). If nothing is due, pick the entry with the earliest `next_review_at`.

**Rationale**: Storing in Supabase (not just IndexedDB) means the schedule syncs across devices. The offline queue handles updates when offline.

---

## Decision 9: Reading Pulse — Progress History

**Decision**: Add a `progress_history` table that inserts a new row on every progress update (instead of overwriting). The existing `reading_progress` table continues as the "current state" record. Every `updateProgress()` call also inserts into `progress_history`.

**Velocity calculation** (client-side):
```typescript
const velocity = (sessions: ProgressHistoryRow[]) => {
  // Group consecutive rows into sessions (gap > 2h = new session)
  // For each session: (endPage - startPage) / minutes
  // Average across last 3 sessions, discard outliers (< 1 PPH or > 200 PPH)
}
```

**Continuity Score**: `100 - Math.min(100, daysSinceLastUpdate * 15)`. Decays 15 points per day. Warning state (amber hero card) at score < 40 (roughly 2.7 days without reading).

**Streak**: Count distinct calendar days in `progress_history` where `book_id = X` and days are consecutive ending today.

---

## Decision 10: Milestone Fragment System

**Decision**: 
- Milestone = every 10% of progress since last recap (or since book start if no recap)
- On milestone detection (inside `updateProgress()`): fire-and-forget async call to a new `extract-fragment` edge function (same Pass 1 logic as current `generate-recap` index.ts)
- Fragment stored in new `recap_fragments` table with `book_id`, `page_at_extraction`, `percentage_at_extraction`, `extracted_json`
- When user requests a recap: if ≥1 fragment exists for book, `generate-recap` assembles from fragments; else falls back to standard two-pass

**Lock logic**: `lastRecapPercentage` from `recaps` table latest row. Button locked if `currentPercentage - lastRecapPercentage < 10`. First recap: always unlocked.

**Rationale**: Fire-and-forget keeps the UX smooth (user doesn't wait for extraction). The edge function is stateless and can be called independently.

---

## Decision 11: Reading Odyssey (Book Passport)

**Decision**: Trigger on `updateProgress()` when `percentage >= 100`. Generate passport data client-side (stats) then call `generate-recap` edge function with a special `mode: 'full_summary'` flag that skips the spoiler constraint (book is complete) and generates a full book summary.

**Passport data**:
- `total_days`: `(lastProgressUpdate - firstProgressUpdate)` in days
- `peak_day`: group `progress_history` by date, find max `(endPage - startPage)` per day
- `vocabulary_count`: `COUNT(*) FROM lexicon_entries WHERE book_id = X`
- `ai_summary`: streamed from edge function

Store result in new `book_passports` table. Accessible from `BookDetailPage` via a "View Journey" button on completed books.

---

## Decision 12: Navigation — New Lexicon Route

**Decision**: Add `/lexicon` as a top-level nav item in `DefaultLayout.vue` (bottom nav bar). Icon: `pi pi-book` (or `pi pi-list`). Lexicon page shows all words across all books by default, with a book filter at the top. Individual book's lexicon accessible from `BookDetailPage`.

**Rationale**: Lexicon is a primary feature deserving top-level navigation. Keeping it accessible from book detail also preserves contextual flow.
