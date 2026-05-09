# Data Model: Capture Review Viewport

## Overview

This feature does not add persistent entities or database schema. It refines the transient client-side capture state used before the existing `page_captures` save path.

## Entities

### Captured Image Preview

**Purpose**: Ephemeral visual preview of the single image captured by the mobile camera flow.

**Fields**:
- `dataUrl`: Browser-local JPEG data URL used for review display.
- `mimeType`: Image MIME type, expected to remain `image/jpeg`.
- `createdAt`: Client timestamp useful for debugging or replacement of stale preview state.

**Validation Rules**:
- Exists only after a successful frame capture.
- Must be cleared on cancel, retake, save success, unmount, and capture failure.
- Must not be persisted to Supabase or any local storage.
- Only one preview may exist at a time.

### OCR Result

**Purpose**: Existing text extraction result returned by the OCR flow and reviewed before persistence.

**Fields**:
- `text`: Extracted page text.
- `confidence`: OCR confidence value.
- `wordCount`: Extracted word count.

**Validation Rules**:
- Save remains disabled or blocked when trimmed text is empty.
- Text length must remain within the existing 10,000 character maximum.
- Low confidence remains visible to the user before saving.

### Review Decision

**Purpose**: The user choice made in the full-screen mobile review state.

**Values**:
- `confirm`: Save the reviewed OCR text through the existing capture store.
- `cancelRetake`: Discard preview and OCR result, then return to camera state.

**State Transitions**:

```text
idle -> camera -> ocr-running -> review
review -> confirm -> saved
review -> cancelRetake -> camera
review -> mobileBack -> camera
camera/error/offline/denied -> existing recovery states
```

## Relationships

- `Captured Image Preview` and `OCR Result` are produced by one successful snap.
- `Review Decision.confirm` persists only the OCR text and existing capture metadata through `useCapturesStore.saveCapture`.
- `Review Decision.cancelRetake` clears both preview and OCR result.

## Persistence Impact

- No new tables.
- No new columns.
- No new storage buckets.
- No IndexedDB/localStorage additions.
- Existing `page_captures` rows remain text-first capture records.
