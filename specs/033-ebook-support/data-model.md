# Phase 1 Data Model: Ebook Support (Screenshot Capture)

**Feature**: 033-ebook-support | **Date**: 2026-06-18

## Persisted schema

**None.** This feature introduces no tables, columns, enums, or storage. The existing `page_captures` table is used unchanged; no book "format" attribute is added (FR-012). No migration.

## Existing entity (unchanged shape)

### `page_captures` (existing)

Reviewed OCR text for a book/page, used by recaps and vocabulary. Written by `capturesStore.saveCapture({ bookId, page, text, confidence, wordCount })`.

- The only change is the **input method** that produces `text`: an uploaded, client-normalized image, in addition to a camera frame. A capture's row is identical regardless of input method.
- `source` (existing column, values `ocr|manual|import`) remains `ocr` for both camera and uploaded captures — the extraction path is the same `ocr-page` call. (No new source value is introduced; "uploaded vs photographed" is not tracked, per spec.)
- `page` continues to come from `reading_progress.current_page` (FR-005); the image is never persisted (FR-006).

## Transient (in-memory only) shapes

These are runtime types, not persisted:

- **NormalizedImage** = `{ base64: string; mimeType: 'image/jpeg' }` — output of `imageNormalize(file)`; the payload sent to `ocr-page`.
- **OcrResult** = `{ text: string; confidence: number; wordCount: number }` — existing `ocr-page` response, unchanged.
- **CapturePreviewImage** = `{ dataUrl: string; mimeType: 'image/jpeg' }` — existing ephemeral preview shown in review; now also produced from an uploaded image.

## Validation / invariants

- The normalized payload MUST be `image/jpeg` and ≤ 5 MB decoded (so `ocr-page` accepts it). The normalizer guarantees this by downscaling + re-encoding.
- A file that cannot be decoded to an image MUST surface a friendly error (not a crash) and MUST NOT call `ocr-page`.
- Uploaded image bytes MUST remain in memory only and MUST NOT be persisted; only reviewed text is saved.
- An uploaded capture MUST be indistinguishable downstream from a camera capture.
