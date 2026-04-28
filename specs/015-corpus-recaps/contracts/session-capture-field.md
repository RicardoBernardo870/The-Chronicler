# Contract: `SessionCaptureField` Component

**File**: `src/components/session/SessionCaptureField.vue` (new)
**Replaces (as primary action)**: `src/components/session/SessionNoteField.vue` in the post-session prompt slot on `LastSessionCard.vue`. The note component is **not** removed — it is invoked via the secondary "Add note instead" action.

## Purpose

Inline post-session prompt rendered on the Last Session card when `progressStore.lastSessionEnded` fires. Surfaces the "📸 Capture this page" call-to-action, runs the camera flow, and on confirm persists a row to `page_captures` keyed against the user's manually-tracked `current_page`.

## Props

```ts
defineProps<{
  historyRowId: string  // The progress_history row that fired the lastSessionEnded event;
                        // used as a stable key for the prompt instance, not for the capture itself.
}>()
```

The component does **not** receive `bookId` or `page` as props. It reads them at confirm time:
- `bookId` — from the `progress_history` row referenced by `historyRowId`.
- `page` — from `reading_progress.current_page` for that book at the moment of confirm. (NEVER from OCR. NEVER from a prop the parent could have stamped at an earlier moment.)

This pattern matches `SessionNoteField`'s existing API surface and minimizes coupling.

## Emits

```ts
defineEmits<{
  saved:   []   // Capture persisted successfully OR user chose "Add note instead" and the note saved
  skipped: []   // User dismissed the prompt (Skip button or close)
}>()
```

The parent (`LastSessionCard`) listens for either event and clears the prompt state — same as today's `SessionNoteField` integration.

## Template States

The component is a state machine with four visible states:

### State 1 — Prompt (default)

```text
┌─────────────────────────────────────────┐
│  📸 Capture this page                   │
│  [    Capture    ]  [ Add note instead ]│
│                            Skip         │
└─────────────────────────────────────────┘
```

- Primary button: "Capture" → transitions to State 2.
- Secondary link: "Add note instead" → swaps the inline content to a `SessionNoteField` (passing through `historyRowId`); when SessionNoteField emits `saved` or `skipped`, this component re-emits the same event.
- Tertiary link: "Skip" → emits `skipped`.

### State 2 — Camera viewport

Mounted via dynamic-import to keep the main bundle slim. Renders `<CaptureCameraView>` (a separate component that wraps `getUserMedia` + `<video>` + a snap button). On snap, the captured frame is encoded to base64 JPEG (quality 0.85) and the component transitions to State 3. On camera-permission denial, transitions to State 4-permission. On Cancel, emits `skipped`.

### State 3 — Verify & edit

Mounted via dynamic-import. Renders `<CaptureVerifyView>` which shows:

- The OCR'd text in a multi-line editable textarea (PrimeVue `Textarea` with `auto-resize`).
- A character counter (10,000 max — FR-008a).
- **If `confidence < 0.7`:** a yellow PrimeVue `InlineMessage severity="warn"` reading *"OCR confidence is low — please review the text carefully before saving."*
- Three actions: **Save** (primary), **Retake** (secondary, returns to State 2), **Cancel** (returns to State 1).

On Save:
- Validates `text.trim().length > 0` and `text.length <= 10000`. Empty text → error toast and stay on screen.
- Calls `capturesStore.saveCapture({ bookId, page, text, confidence, wordCount })` — the store handles the upsert.
- On success → emits `saved`.
- On error → PrimeVue Toast surfaces the error; user can retry or Cancel.

### State 4-permission — Camera permission denied

Replaces the prompt with a small inline panel:

> "Camera access was denied. You can still leave a note for this session, or grant camera access in your browser settings and try again."
>
> [ Add note instead ]   [ Cancel ]

"Add note instead" swaps in `SessionNoteField` as in State 1. "Cancel" emits `skipped`.

### State 4-offline — Network unavailable for OCR

Same pattern as 4-permission, with copy:

> "You're offline — capture needs internet to extract text. Try again later, or leave a note for now."

## Composable Used

`useCapture()` (`src/composables/useCapture.ts`) — wraps:
- Camera lifecycle (acquire `MediaStream`, attach to video element, snap, release stream).
- `ocr-page` edge function call.
- Network/permission error mapping to the State-4 variants.

The composable returns a small surface:

```ts
type UseCaptureReturn = {
  state: Ref<'idle' | 'camera' | 'ocr-running' | 'verify' | 'denied' | 'offline'>
  ocrResult: Ref<{ text: string; confidence: number; wordCount: number } | null>
  startCamera: () => Promise<void>
  snap: () => Promise<void>          // captures + calls OCR; transitions to 'verify' on success
  retake: () => void                  // returns to 'camera'
  cancel: () => void                  // releases stream, returns to 'idle'
}
```

## Accessibility

- Capture button has `aria-label="Capture a photo of the last page you read"`.
- Camera viewport video element has `aria-label="Camera preview"` and a visible snap button (focusable, Enter/Space activates).
- Verify textarea has a programmatic `<label>`; the low-confidence warning uses an `<InlineMessage>` which is announced by screen readers via its `role="alert"`.
- All three states are reachable via keyboard alone (Tab/Shift+Tab, Enter, Esc to cancel).

## Styling

- Inherits the existing `glass-surface` aesthetic of `LastSessionCard` panels.
- Camera viewport: 4:3 aspect, max-height 60vh on mobile; full-bleed snap button below.
- Animation: same `slide-in` keyframe used by `SessionNoteField` for visual continuity.

## Bundle Impact

`SessionCaptureField` itself is small (~3KB gzipped). The heavy parts (`CaptureCameraView`, `CaptureVerifyView`, `useCapture`, the camera-permission handler) are dynamic-imported, so the main bundle delta is bounded at ~3KB. The full capture flow loads on first invocation only.

## Failure Modes

| Failure | UI behavior | Persisted state |
|---|---|---|
| Camera permission denied | Show State 4-permission | none |
| Offline | Show State 4-offline | none |
| OCR returns empty text | State 3 with empty textarea + "Retake" suggestion | none |
| OCR returns non-200 | Toast "OCR temporarily unavailable" + back to State 1 | none |
| User edits to empty | Save button disabled | n/a |
| Capture upsert fails | Toast with error; stay on State 3 | none |
| Network drops mid-save | Same as above | none |

## Out of Scope

- Multiple captures per session (UX shows one prompt only).
- Re-opening the prompt after Skip in the same session.
- Editing existing captures — re-capture overwrites; no edit-existing surface in v1.
