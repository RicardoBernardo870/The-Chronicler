# Contract: Session Note Capture Flow

## Trigger

After `updateProgress()` succeeds (page saved, session ended), the progress store emits a `sessionEnded` event carrying `{ bookId, historyRowId, sessionStartAt }`.

## UI Contract

The save dialog / page-update modal listens for this event. When received:

1. The normal "Saved!" confirmation is shown as usual.
2. An inline text area slides in below the confirmation:
   - Label: `"Where did you leave off?"`
   - Placeholder: `"e.g. Just as the group reaches the mountain pass…"`
   - Max length: 160 characters
   - Character counter shown at ≥140 chars used
3. Two inline actions:
   - **Save note** (primary) — enabled when ≥1 character entered
   - **Skip** (text link) — dismisses without saving

## Write Contract

`PATCH progress_history SET session_note = $note WHERE id = $historyRowId AND user_id = $userId`

This is a single-field update on the row already inserted by the page-save. The update is fire-and-forget from the UI perspective (no spinner on the save-note action); errors are logged silently without disrupting the user.

## Idempotency

If the user taps "Save note" multiple times (e.g., double-tap), the PATCH is idempotent — only the value of `session_note` changes.

## Display on LastSessionCard

The note is surfaced below the metrics grid:

```
┌─────────────────────────────────────────────┐
│  📖  Last Session                            │
│  [metrics grid]                              │
│  ──────────────────────────────────────────  │
│  📝  Just as the group reaches the mountain  │
│      pass…                                   │
└─────────────────────────────────────────────┘
```

If `session_note` is null, the note row is hidden entirely (no placeholder shown).
