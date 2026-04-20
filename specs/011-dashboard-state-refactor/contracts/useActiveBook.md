# Contract: `useActiveBook` composable

**Path**: `src/composables/useActiveBook.ts`
**Feature**: 011-dashboard-state-refactor

## Purpose

Single source of truth for the Dashboard's hero bookId. Exposes reactive derivations and mutation methods for explicit swap + completion-driven auto-promotion.

## Signature

```ts
export const useActiveBook = (): {
  activeBookId: Readonly<Ref<string | null>>
  activeBook:   ComputedRef<Book | null>
  upNext:       ComputedRef<Book[]>
  setActive:   (bookId: string) => void
  onBookCompleted: (bookId: string) => void
  initializeIfNeeded: () => void   // called on Dashboard mount
}
```

## Behavior

| Call | Precondition | Postcondition |
|------|-------------|---------------|
| `setActive(id)` | `id` exists in `booksStore.inProgressBooks` | `activeBookId === id`; `upNext` excludes `id` |
| `setActive(activeBookId)` | — | No state change (no reactive trigger) |
| `onBookCompleted(id)` where `id === activeBookId` | — | Promotes next in-progress book (or `null` if empty) |
| `onBookCompleted(id)` where `id !== activeBookId` | — | No state change |
| `initializeIfNeeded()` | `activeBookId === null` | Sets to first in-progress book, or remains `null` if library empty |

## Reactivity guarantees

- `activeBook` and `upNext` MUST update within one Vue flush when `activeBookId` or `booksStore.inProgressBooks` changes.
- `activeBookId` is exposed as `Readonly<Ref>` — consumers mutate only via the provided methods.

## Edge cases

- User deletes the hero book from library → `activeBook` becomes `null` reactively; caller is responsible for re-initializing (via `initializeIfNeeded`).
- Library empties → `activeBookId` is set to `null`.
- Rapid-fire `setActive` calls → last call wins; no queueing.
