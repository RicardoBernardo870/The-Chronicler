# Contract: useReadingSession composable

## Purpose

Manages the lifecycle of an explicit reading session for a single book. Exposes reactive state and actions consumed by `SessionStartButton.vue`, `DashboardPage.vue`, and `BookDetailPage.vue`.

## Signature

```typescript
export interface ReadingSessionState {
  isActive: boolean           // true when session_start_at is non-null for this book
  startedAt: Date | null      // null when no active session
  elapsedSeconds: number      // live counter; 0 when no active session
}

export const useReadingSession = (bookId: string): {
  state:        Readonly<Ref<ReadingSessionState>>
  startSession: () => Promise<void>   // writes session_start_at to server immediately
  clearSession: () => Promise<void>   // resets session_start_at to null (used internally by progress store on page-save)
}
```

## Behaviour

| Action | Precondition | Effect |
|--------|-------------|--------|
| `startSession()` | No active session | Sets `session_start_at = NOW()` on `reading_progress` via server upsert; `state.isActive` becomes `true`; `elapsedSeconds` counter starts |
| `startSession()` | Active session exists | Emits `conflictWarning` event — caller must show confirmation dialog; on confirmation calls `startSession()` again which overwrites |
| `clearSession()` | Any | Sets `session_start_at = null` on `reading_progress`; stops counter |

## Reactive state

- `elapsedSeconds` is updated every second via `setInterval` while `isActive` is true. The interval is cleared on `clearSession()` and on composable unmount.
- `state` is derived from `progressStore.progressForBook(bookId).sessionStartAt` — shared Pinia state so both Dashboard and Book Detail views reflect changes immediately without additional server polling.

## Error handling

- If the server upsert for `startSession()` fails, the optimistic local state is rolled back and an error is thrown for the caller to surface to the user.
- Network offline: `startSession()` throws a friendly "You appear to be offline" error and does **not** optimistically set local state (session start must be server-confirmed per FR-011).
