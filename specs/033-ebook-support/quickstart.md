# Quickstart & Validation: Ebook Support (Screenshot Capture)

**Feature**: 033-ebook-support | **Date**: 2026-06-18

A run/validation guide proving the feature end-to-end. No backend changes; no migration.

## Prerequisites

- Deps installed (`npm install`); `.env` with Supabase vars (the `ocr-page` edge function must be reachable).
- A signed-in user with at least one book that has a tracked current page, so an end-of-session capture prompt can appear.
- A few sample images on the test device: a clear page screenshot (PNG), a **large** high-res screenshot (>5 MB), and (on Safari) a HEIC photo.

## Setup

```bash
npm install
npm run dev
```

## Validation scenarios

### V1 — Upload a screenshot to capture a page (US1 / FR-001, FR-002)
1. Read/advance a book to trigger the end-of-session capture prompt.
2. In the prompt, choose **Upload image** and pick a page screenshot.
3. Expect "Reading the page…", then the review screen with extracted text + the image preview.
4. Edit the text if needed, confirm — the capture saves and the prompt resolves.

### V2 — Both methods are first-class (US2 / FR-003, FR-011)
1. At the capture prompt, confirm **Take photo** and **Upload image** appear as peer buttons (not one hidden in a menu), plus "Add note instead" / "Skip".
2. Confirm "Take photo" still opens the camera and works as before.

### V3 — No ebook prompt when adding a book (FR-004)
1. Add a book via search / scan / manual.
2. Expect **no** new question asking whether it's an ebook or print.

### V4 — Large screenshot just works (FR-007 / SC-007)
1. Choose **Upload image** and pick a **>5 MB** high-res screenshot.
2. Expect it to be accepted and processed (auto-downscaled/compressed) — **no** "too large" error.

### V5 — HEIC (Safari) / unsupported file (FR-007, edge cases)
1. On Safari, upload a HEIC photo of a page → expect it to convert and process.
2. Pick a non-image file (e.g. a PDF/text file) → expect a clear, friendly "couldn't read that image" message and no crash; the reader can pick another.

### V6 — Camera-less / denied still works (US2 / FR-008)
1. On desktop (or with camera permission denied), open the capture prompt.
2. Expect **Upload image** to be available and fully able to complete a capture.

### V7 — Downstream parity (FR-010, SC-006)
1. After saving an uploaded capture, generate a corpus recap (or trigger vocabulary extraction) for that book.
2. Expect the uploaded capture to be used exactly like a camera capture.

### V8 — Nothing persisted (FR-006 / SC-004)
1. Save an uploaded capture; inspect `page_captures` for that book/page.
2. Expect only the reviewed text/metadata — no image stored anywhere.

### V9 — Offline (edge case)
1. Go offline, choose **Upload image**.
2. Expect the existing "you're offline; capture needs internet" state with "Add note instead" available; progress saving itself still works.

## Automated checks

```bash
npm test
npx vue-tsc -b
```

Targeted unit tests to add (see `tasks.md`):
- `imageNormalize`: returns `image/jpeg`; rejects/clean-errors on a non-image blob. (Canvas is limited under jsdom — keep assertions to type/branch behavior; note any environment caveats.)
- `useCapture.importImage`: offline → `offline` state; decode failure → `error` (no `ocr-page` call); success path sets `ocrResult` + `verify` via a mocked `runOcr`/fetch and a stubbed normalizer.

## Definition of Done

- V1–V9 pass.
- `npm test` and `vue-tsc -b` green.
- An ebook reader can capture a page entirely without a camera; large screenshots/HEIC are handled transparently; uploaded captures are downstream-identical to camera captures; nothing image-related is persisted.
