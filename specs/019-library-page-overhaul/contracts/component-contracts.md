# Component Contracts: Library Page Overhaul (019)

## LibrarySectionHeader

**File**: `src/components/library/LibrarySectionHeader.vue`  
**Purpose**: Renders a section title, book count badge, and optional collapse toggle.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| title | string | yes | — | Section label, e.g. "Currently Reading" |
| count | number | yes | — | Number of books in the section |
| collapsible | boolean | no | false | Whether a chevron toggle is shown |
| expanded | boolean | no | true | Current expanded/collapsed state (used only when `collapsible=true`) |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| toggle | — | Emitted when the user clicks a collapsible header |

### Slots

None.

### Behaviour

- Always renders the title and count.
- When `collapsible=true`, renders a chevron icon (`pi pi-chevron-up` / `pi pi-chevron-down`) and the entire header is clickable, emitting `toggle`.
- When `collapsible=false`, header is not interactive.

---

## SwipeableBookCard

**File**: `src/components/library/SwipeableBookCard.vue`  
**Purpose**: Wraps `BookCard` with a swipe-left gesture that reveals Edit and Delete action buttons. On non-touch viewports it is a transparent pass-through (the existing ⋯ menu on `BookCard` handles Edit/Delete on desktop).

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| book | Book | yes | The book to render |
| section | 'reading' \| 'unread' \| 'finished' | yes | Section context (used to suppress swipe on grid view) |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| edit | book: Book | User tapped the Edit action; parent should open `BookEditDialog` |
| delete | book: Book | User tapped the Delete action; parent should prompt confirmation |

### Behaviour

- On touch viewports (`window.matchMedia('(hover: none)').matches`): activates swipe logic.
- `translateX` CSS transform on `@touchstart`/`@touchmove`/`@touchend`.
- Snap-close threshold: 80 px. If drag < 80 px, card returns to 0.
- Action buttons rendered absolutely behind the card at a fixed width (160 px total: 80 px Edit + 80 px Delete).
- Mutual exclusion: reads/writes the module-level `openCardId` ref. When this card opens, any previously open card is signalled to close.
- Swipe-right or tap outside closes the card.

---

## useReadingVelocity

**File**: `src/composables/useReadingVelocity.ts`  
**Purpose**: Returns a `daysLeft` estimate for a set of in-progress book ids, derived from `progress_history`.

### Signature

```typescript
const useReadingVelocity = (bookIds: Ref<string[]>) => ({
  velocityMap: Ref<Record<string, number | 'today' | null>>,
  loading: Ref<boolean>,
  fetch: () => Promise<void>,
})
```

### Behaviour

- `velocityMap` is keyed by `bookId`.
- Value is:
  - A positive integer — estimated days remaining.
  - `'today'` — 0 or negative days (book should be finishable today).
  - `null` — insufficient sessions (< 3 in the past 30 days) or `totalPages` unknown.
- `fetch()` performs a single `progress_history` SELECT for all provided book ids filtered to `recorded_at > now() - 30 days`.
- Computation is purely in-memory (see data-model.md for algorithm).

---

## BookEditDialog *(contract amendment)*

**File**: `src/components/books/BookEditDialog.vue`  
**Change**: `onSave` must forward `isbn` from the `BookForm` submission to `updateBook`.

### Updated `onSave` data shape

```typescript
{
  title: string
  author: string
  totalPages: number | null
  genre: string | null
  coverUrl: string | null
  isbn: string | null   // NEW — was silently dropped before
}
```

---

## updateBook *(store contract amendment)*

**File**: `src/stores/books.ts`  
**Change**: The `changes` partial type gains `isbn`.

```typescript
const updateBook = async (
  id: string,
  changes: Partial<Pick<Book, 'title' | 'author' | 'totalPages' | 'genre' | 'coverUrl' | 'isbn'>>
) => { ... }
```

The Supabase `.update()` payload must include:
```typescript
...(changes.isbn !== undefined && { isbn: changes.isbn })
```

---

## get_library_with_progress *(RPC contract amendment)*

**SQL function**: `get_library_with_progress(p_user_id uuid)`  
**Change**: Add `b.genre` to the SELECT list and return it as `"genre"` in the result set.

### Updated return row shape

```sql
SELECT
  b.id,
  b.title,
  b.author,
  b.cover_url      AS "coverUrl",
  b.total_pages    AS "totalPages",
  b.genre,                          -- NEW
  rp.current_page  AS "currentPage",
  ...
```

TypeScript `LibraryBookEntry` gains:
```typescript
genre: string | null  // NEW
```
