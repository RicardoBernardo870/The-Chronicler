# Contract: useRecapLock Composable

**File**: `src/composables/useRecapLock.ts`  
**Type**: Vue 3 Composable

## Signature

```ts
useRecapLock(bookId: Ref<string> | string): {
  recapLocked: ComputedRef<boolean>
  recapLockedByPages: ComputedRef<boolean>
  pagesUntilUnlock: ComputedRef<number>
  daysSinceLastSession: ComputedRef<number>
}
```

## Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bookId` | `Ref<string> \| string` | Yes | The book ID to compute lock state for |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `recapLocked` | `ComputedRef<boolean>` | True when user cannot generate a new recap |
| `recapLockedByPages` | `ComputedRef<boolean>` | True when page threshold not met since last recap |
| `pagesUntilUnlock` | `ComputedRef<number>` | Pages remaining until page threshold is met (0 if unlocked) |
| `daysSinceLastSession` | `ComputedRef<number>` | Days since last progress update |

## Behaviour Contracts

- `recapLocked` is `false` when no recap has been generated yet (first recap is always unlocked).
- `recapLocked` is `false` when `daysSinceLastSession >= 3` (time escape hatch).
- `recapLocked` is `true` only when BOTH: `recapLockedByPages === true` AND `daysSinceLastSession < 3`.
- `pagesUntilUnlock` is `0` when `recapLockedByPages === false`.
- All outputs update reactively when progress or recaps store state changes.
- The composable does NOT trigger any fetches — callers are responsible for ensuring store data is hydrated.

## Lock Formula

```
RECAP_TIME_UNLOCK_DAYS = 3
lastRecapPct     = latestRecap?.progressSnapshot ?? 0
unlockPage       = ceil((lastRecapPct + 5) / 100 * totalPages)
recapLockedByPages = lastRecapPct > 0 && currentPage < unlockPage
daysSince        = (Date.now() - new Date(progress.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
recapLocked      = recapLockedByPages && daysSince < RECAP_TIME_UNLOCK_DAYS
pagesUntilUnlock = max(0, unlockPage - currentPage)
```
