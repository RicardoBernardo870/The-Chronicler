# Data Model: Lore Chronoscope

## Entities

### LoreCard (persisted)

**Table**: `lore_cards`
**Lifecycle**: Created by the `generate-lore` edge function after successful AI response. Never updated except for the `seen` flag. Deleted via cascade when the parent book is deleted.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | |
| `user_id` | UUID | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | RLS boundary. |
| `book_id` | UUID | NOT NULL, FK → `books(id)` ON DELETE CASCADE | Cascade satisfies FR-032. |
| `title` | TEXT | NOT NULL | 3–8 words, AI-generated. |
| `content` | TEXT | NOT NULL | 150–300 words of lore. |
| `type` | TEXT | NOT NULL, CHECK IN ('History','Myth','Geography') | Three fixed categories. |
| `linked_entities` | TEXT[] | NOT NULL, DEFAULT `'{}'` | Up to 5 names from Master Recap. |
| `unlocked_at_page` | INTEGER | NOT NULL | The page the user was on when the milestone triggered. |
| `unlocked_at_milestone` | INTEGER | NOT NULL, CHECK IN (10,20,...,90) | The 10% milestone that unlocked it. |
| `seen` | BOOLEAN | NOT NULL, DEFAULT FALSE | Cleared via batch UPDATE on Book Detail visit. |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `NOW()` | Ordering key. |

**Unique constraint**: `(user_id, book_id, unlocked_at_milestone)` — enforces one card per milestone per book per user at the DB level.

**Indexes**: `(user_id, book_id)` — powers the primary read query and the unseen-count calc.

**RLS policies**: SELECT / INSERT / UPDATE / DELETE all gated on `auth.uid() = user_id`, mirroring the `recaps` table.

---

### MasterRecap (derived, not persisted)

Computed client-side inside `loreCardsStore.maybeUnlockForMilestone()` just before calling the edge function. Never stored.

**Derivation**:
```
masterRecap(bookId, currentPage) =
  recapsByBook[bookId]
    .filter(r => r.pageSnapshot <= currentPage && r.progressSnapshot > 0)
    .sort((a, b) => a.pageSnapshot - b.pageSnapshot)
    .map(formatSingle)
    .join('\n\n---\n\n')
```

Where `formatSingle(r)` emits:
```
Memory jogger: {r.memoryJogger}
Concept watchlist: {r.conceptWatchlist}
Thematic bridge: {r.thematicBridge}
```

**Empty case**: If the filtered list is empty, the store short-circuits and does not call the edge function. This is the "no qualifying recaps" branch (FR-004).

---

### Milestone (conceptual, not persisted)

A 10% increment: `10, 20, 30, 40, 50, 60, 70, 80, 90`. Derived at the moment `updateProgress` commits via:

```
newMilestone      = floor(newPercentage / 10) * 10
previousMilestone = floor(previousPercentage / 10) * 10
crossedMilestone  = newMilestone > previousMilestone && newMilestone in [10, 90]
                      ? newMilestone
                      : null
```

Stored implicitly as `lore_cards.unlocked_at_milestone`. Not a DB table.

---

### NewLoreIndicator (derived UI state)

**Client-side computed**: A book has an active "New Lore" indicator when:
```
hasUnseenLore(bookId) = loreByBook[bookId]?.some(c => !c.seen) ?? false
```

**Cleared** by the Book Detail Page's `onMounted` hook, which:
1. Fetches lore for the book.
2. If any `seen === false` cards exist for this book, fires a single server-side `UPDATE lore_cards SET seen = TRUE WHERE user_id = ? AND book_id = ? AND seen = FALSE`.
3. On success, mutates the client-side `loreByBook[bookId]` in place (sets `seen = true` on all of them) and calls `swrTouch(cacheKeys.lore(uid, bookId))`.

---

## Relationships

```
auth.users 1 ──* lore_cards *── 1 books
                     │
                     └── derives context from ──→ recaps (filtered by page_snapshot, progress_snapshot)
```

- Deleting a user cascades and removes their lore (via `auth.users` FK).
- Deleting a book removes its lore (via `books` FK).
- Lore cards never reference recaps directly — the Master Recap is derived on-the-fly at generation time. Deleting recaps does **not** affect previously generated lore (the lore content is self-contained after generation).

---

## TypeScript types (new — added to `src/types/index.ts`)

```typescript
export type LoreType = 'History' | 'Myth' | 'Geography'

export interface LoreCardRow {
  id: string
  user_id: string
  book_id: string
  title: string
  content: string
  type: LoreType
  linked_entities: string[]
  unlocked_at_page: number
  unlocked_at_milestone: number
  seen: boolean
  created_at: string
}

export interface LoreCard {
  id: string
  userId: string
  bookId: string
  title: string
  content: string
  type: LoreType
  linkedEntities: string[]
  unlockedAtPage: number
  unlockedAtMilestone: number
  seen: boolean
  createdAt: string
}

export const mapLoreCard = (row: LoreCardRow): LoreCard => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  title: row.title,
  content: row.content,
  type: row.type,
  linkedEntities: row.linked_entities ?? [],
  unlockedAtPage: row.unlocked_at_page,
  unlockedAtMilestone: row.unlocked_at_milestone,
  seen: row.seen,
  createdAt: row.created_at,
})
```

---

## State transitions

### LoreCard (row lifecycle)

```
(nonexistent)
    │
    │ generate-lore succeeds + INSERT
    ▼
seen = FALSE  ────── user visits Book Detail Page ──────→ seen = TRUE  (terminal)
    │                                                          │
    │                                                          │
    │    book/user deleted                                     │  book/user deleted
    └────────────── (row removed via cascade) ─────────────────┘
```

Once `seen = TRUE`, the row never transitions back to `FALSE`. Lore itself is immutable.

### Milestone-trigger state (transient, in-memory)

```
updateProgress called
    │
    ▼
compute crossedMilestone
    │
    ├── null  ──→  done (no-op)
    │
    └── N in [10..90]
            │
            ▼
        store.maybeUnlockForMilestone(bookId, N)
            │
            ├── already exists for (user, book, N)?  ──→ done (no AI call)
            │
            ├── no qualifying recaps?                ──→ done (no AI call)
            │
            └── call generate-lore
                    │
                    ├── success ──→ INSERT row (seen=FALSE); update cache; toast; chip
                    │
                    └── error   ──→ console.error; swallow
```
