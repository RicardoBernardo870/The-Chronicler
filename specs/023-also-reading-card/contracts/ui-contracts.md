# UI Contract: Also Reading Card

## Placement

`BookDetailPage.vue` mounts the community card after `BookProgressPanel` and before post-session
capture/lore/recap surfaces.

Rules:

- Core book detail content must render without waiting for the card request.
- The card hides entirely when the response has no visible items.
- The card never blocks progress updates, recap generation, lore, lexicon, or session capture.

## `AlsoReadingCard.vue`

**Responsibility**: Render a compact ambient summary of followed readers also reading the book.

**Props**:

```ts
interface AlsoReadingCardProps {
  bookId: string
  isbn: string | null
  viewerProgressPercentage: number | null
}
```

**Behavior**:

- Fetch first page through `useAlsoReading()` on mount and when `bookId` changes.
- Render up to 3 reader rows in the compact card.
- Show a "View more" action only when `nextCursor` exists or `totalVisible > items.length`.
- Navigate a reader row or action to `{ name: 'public-profile', params: { username } }`.
- Use hidden progress rows gracefully: show identity and "also reading" without page/relative
  label.
- Use PrimeVue primitives where suitable: Button, Avatar, Tag/Chip, Dialog, Skeleton.

**States**:

- `loading`: non-blocking skeleton inside card area only when needed.
- `ready with items`: card visible.
- `ready empty`: card not rendered.
- `error`: card not rendered or shows a small retry affordance only if previous items exist.

## `AlsoReadingListDialog.vue`

**Responsibility**: Show additional visible readers when the compact card has more results.

**Props**:

```ts
interface AlsoReadingListDialogProps {
  visible: boolean
  bookId: string
  isbn: string | null
}
```

**Behavior**:

- Uses the same store data and cursor fetch method.
- Provides load-more pagination.
- Keeps row behavior consistent with compact card.
- Closes without mutating book/progress state.

## Store/Composable Contract

Add `useAlsoReadingStore` plus `useAlsoReading` wrapper or equivalent.

Expected state:

```ts
interface AlsoReadingPage {
  items: AlsoReadingItem[]
  nextCursor: string | null
  totalVisible: number
}

type AlsoReadingStatus = 'idle' | 'loading' | 'error'
```

Expected actions:

- `fetchForBook(bookId, isbn, options?: { cursor?: string | null; force?: boolean })`
- `clearBook(bookId)`

Caching:

- Add `cacheKeys.alsoReading(uid, bookId)` to `useCache.ts`.
- Use a short TTL, recommended 45 seconds.
- Invalidate the card when follow/block graph actions change.
- Serving cached card data while revalidating is allowed.

## Accessibility

- Card heading is a semantic heading inside a section.
- Avatar images use display name or username alt text.
- Relative status tags have text labels, not color-only meaning.
- "View profile" interactions have accessible names.
- Dialog focus is managed by PrimeVue Dialog behavior.

## Copy

Suggested compact heading:

```text
Also reading
```

Suggested summary when multiple readers are visible:

```text
3 people you follow are here too.
```

Relative labels:

- `ahead`
- `behind`
- `same area`

Avoid wording that encourages competition or interrupts reading.
