# Data Model: Dashboard State Refactor

**Feature**: 011-dashboard-state-refactor
**Date**: 2026-04-20

No new Supabase tables or columns. All state below is **client-side** (composable refs, computed values, component props).

## Client-side state

### ActiveBook (new — module-scoped composable state)

**Owner**: `src/composables/useActiveBook.ts`

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `activeBookId` | `Ref<string \| null>` | Module singleton | Starts `null` until first mount; initialized to first in-progress book by default promotion rule. |
| `activeBook` | `ComputedRef<Book \| null>` | `booksStore.bookById(activeBookId)` | Reactive to both store changes and `activeBookId` changes. |
| `upNext` | `ComputedRef<Book[]>` | `booksStore.inProgressBooks` filtered to exclude `activeBookId` | Ordered by existing store ordering. |

**Transitions**:
1. `setActive(bookId)` — explicit user swap (Up Next tap). Writes to `activeBookId`.
2. `onBookCompleted(bookId)` — event hook. If `bookId === activeBookId`, call `promoteNext()`. Else no-op.
3. `promoteNext()` — picks the first book from `upNext`; writes to `activeBookId`. If empty, set `null`.
4. Mount initialization — if `activeBookId === null`, set to the first in-progress book.

**Invariants**:
- `activeBookId` never equals any `upNext[i].id`.
- `activeBookId` is `null` iff the user has zero in-progress books.

---

### LastSession (new — composable return value)

**Owner**: `src/composables/useLastSession.ts`

| Field | Type | Derivation |
|-------|------|------------|
| `bookId` | `string` | From the most-recent `progress_history` row. |
| `bookTitle` | `string` | `booksStore.bookById(bookId)?.title` |
| `endedAt` | `Date` | `progress_history.updated_at` of the latest row. |
| `pagesDelta` | `number` | Difference between the row's `current_page` and the prior row's `current_page` for the same book; floor at 0. |
| `durationSeconds` | `number \| null` | Difference between `endedAt` and the prior row's `updated_at` for the same book; `null` if no prior row. |
| `velocityPph` | `number \| null` | `pagesDelta / (durationSeconds / 3600)` if `durationSeconds ≥ 60` and `pagesDelta ≥ 1`; else `null`. |

**Qualification rule**: Return `null` from the composable if no qualifying session exists.

---

### VelocityReading (existing — audited)

**Owner**: `src/components/pulse/VelocityBadge.vue` (consumes `useReadingPulse`)

| Field | Type | Guarded Rule |
|-------|------|--------------|
| `pph` | `number \| null` | `null` when `velocity` is `null/undefined/NaN/Infinity` or session < 60s. |
| `prediction` | `string \| null` | `null` when `totalPages <= 0` or `currentPage > totalPages` or `velocity` is `null`. |

---

## Entity relationships

```
                      ┌────────────────────┐
                      │   booksStore       │
                      │  (Pinia, existing) │
                      └──────────┬─────────┘
                                 │ inProgressBooks
                                 ▼
   ┌─────────────────────────────────────────────────┐
   │            useActiveBook (composable)           │
   │  activeBookId ◄─ setActive() / promoteNext()    │
   │  activeBook   ─►  hero card                     │
   │  upNext       ─►  Up Next list                  │
   └─────────────────────┬───────────────────────────┘
                         │ activeBookId
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
 progressStore     recapsStore       useRecapLock
 .progressForBook  .latestRecapFor   (feature 010)
  (SWR-cached)      (SWR-cached)

                      ┌────────────────────┐
                      │ progress_history   │
                      │ (Supabase, exists) │
                      └──────────┬─────────┘
                                 ▼
                      ┌────────────────────┐
                      │ useLastSession     │
                      │  (composable, new) │
                      └──────────┬─────────┘
                                 ▼
                      ┌────────────────────┐
                      │ LastSessionCard    │
                      │  (component, new)  │
                      └────────────────────┘
```

## Validation rules

- **Hero exclusivity**: UI tests MUST confirm `upNext` never contains `activeBookId`.
- **Swap idempotency**: Calling `setActive(activeBookId)` MUST be a no-op (no re-render flash).
- **Completion scoping**: `onBookCompleted(someOtherId)` MUST NOT mutate `activeBookId`.
- **Velocity guards**: Unit test MUST cover `velocity = NaN`, `Infinity`, `0`, `null`, and `durationSeconds < 60` — all must yield `pph === null`.
- **LastSession empty**: When no sessions exist, card is hidden (no broken UI).
