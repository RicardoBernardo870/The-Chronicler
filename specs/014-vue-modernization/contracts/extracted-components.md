# Contract: Extracted Components

All components below are extracted from existing page files. They emit events up, accept props down, and own their scoped styles. No component accesses a Pinia store directly unless it already did so before extraction.

---

## `HeroBookCard` (`src/components/dashboard/HeroBookCard.vue`)

**Extracted from**: `DashboardPage.vue`  
**Responsibility**: Renders the currently-active hero book — cover, metadata, progress bar, page input/save row, session buttons, continuity warning, offline badge, and recap actions.

### Props

```typescript
defineProps<{
  book: Book
  progress: ReadingProgress | null
  saving: boolean
  justSaved: boolean
  saveError: string | null
  pageInput: number
  heroWarning: boolean
  pendingSync: boolean
  recapTriggered: boolean
  recapLocked: boolean
  pagesUntilUnlock: number
}>()
```

### Emits

```typescript
defineEmits<{
  'update:pageInput': [value: number]
  save: []
  getRecap: []
  viewBook: []
}>()
```

---

## `InProgressSection` (`src/components/dashboard/InProgressSection.vue`)

**Extracted from**: `DashboardPage.vue`  
**Responsibility**: Renders the "In Progress" list of other in-progress books (swap candidates).

### Props

```typescript
defineProps<{
  books: Book[]
}>()
```

### Emits

```typescript
defineEmits<{
  select: [bookId: string]
  viewBook: [bookId: string]
}>()
```

---

## `UpNextSection` (`src/components/dashboard/UpNextSection.vue`)

**Extracted from**: `DashboardPage.vue`  
**Responsibility**: Renders the drag-to-reorder "Up Next" section (0%-progress books).

### Props

```typescript
defineProps<{
  books: Book[]
}>()
```

### Emits

```typescript
defineEmits<{
  'update:books': [newOrder: Book[]]
  select: [bookId: string]
}>()
```

---

## `CompletedSection` (`src/components/dashboard/CompletedSection.vue`)

**Extracted from**: `DashboardPage.vue`  
**Responsibility**: Renders the completed books preview (first 2) + overflow hint.

### Props

```typescript
defineProps<{
  books: Array<{ book: Book; progress: ReadingProgress }>
  overflow: number
}>()
```

### Emits

```typescript
defineEmits<{
  viewBook: [bookId: string]
  viewLibrary: []
}>()
```

---

## `BookDetailHeader` (`src/components/book/BookDetailHeader.vue`)

**Extracted from**: `BookDetailPage.vue`  
**Responsibility**: Cover image, genre chip, title, author, ISBNs, total pages — the static metadata block at the top of the detail page.

### Props

```typescript
defineProps<{
  book: Book
}>()
```

### Emits

```typescript
defineEmits<{
  coverError: []
}>()
```

---

## `BookProgressPanel` (`src/components/book/BookProgressPanel.vue`)

**Extracted from**: `BookDetailPage.vue`  
**Responsibility**: Progress bar, current-page display, page input + save row, session start button, session note field, error message.

### Props

```typescript
defineProps<{
  book: Book
  progress: ReadingProgress | null
  currentPageInput: number
  progressLoading: boolean
  progressError: string | null
  showNoteField: boolean
  pendingHistoryRowId: string | null
}>()
```

### Emits

```typescript
defineEmits<{
  'update:currentPageInput': [value: number]
  save: []
  noteComplete: []
  sessionConflict: [startedAt: Date]
}>()
```

---

## `src/utils/date.ts` — Shared Date Utility

**Type**: Pure utility module (no Vue reactivity)  
**Depends on**: `date-fns`

```typescript
// Full public API

export const formatRelativeToNow: (date: Date | string) => string
// "Just now" for < 2 min, "3 minutes ago", "Yesterday", "2 days ago", "1 week ago"

export const formatShortDate: (isoStr: string) => string
// "Apr 24, 2026"

export const formatISODate: (date: Date) => string
// "2026-04-24"

export const diffInSeconds: (later: Date | string, earlier: Date | string) => number
// differenceInSeconds — positive when later > earlier

export const diffInHours: (later: Date | string, earlier: Date | string) => number
// differenceInHours

export const diffInDays: (later: Date | string, earlier: Date | string) => number
// differenceInDays

export const isSameCalendarDay: (a: Date | string, b: Date | string) => boolean
// isSameDay from date-fns

export const startOfCalendarDay: (date: Date) => Date
// startOfDay from date-fns

export const sortDescByDate: <T>(arr: T[], key: keyof T) => T[]
// sorts array descending by a date-string field using compareDesc
```

**Excluded**: `Date.now()` calls in `useCache.ts` — cache TTL timing is not date formatting; keep as-is.

---

## `src/utils/coverFallback.ts` — Shared Cover Error Handler

```typescript
export const coverFallback = (e: Event): void => {
  (e.target as HTMLImageElement).style.display = 'none'
}
```

**Replaces**: 4 identical inline definitions in `BookCard.vue`, `BookGridCard.vue`, `BookDetailPage.vue`, `DashboardPage.vue`.
