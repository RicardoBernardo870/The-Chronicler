# Phase 0 Research: Ebook Support (Screenshot Capture)

**Feature**: 033-ebook-support | **Date**: 2026-06-18

No open `NEEDS CLARIFICATION` markers remained after `/speckit-clarify`. Decisions below are grounded in the existing capture code and the `ocr-page` contract.

## R1 — Reuse the existing OCR pipeline for uploads

- **Decision**: Send uploaded images to the **same** `ocr-page` edge function and `verify → review → save` flow used by camera capture. Factor the existing fetch logic in `useCapture.snap()` into a shared `runOcr(base64, mimeType)`.
- **Rationale**: `ocr-page` accepts `imageBase64` + `mimeType` and returns `{text, confidence, wordCount}` — it has no knowledge of the image's origin. Reusing it makes an uploaded capture downstream-identical to a camera capture (recaps, vocabulary, completion cleanup) with no backend change (FR-002, FR-010).
- **Alternatives considered**: A separate "upload-ocr" endpoint (rejected — needless duplication); relaxing the edge function's size/type limits (rejected — client normalization is safer and avoids a deploy).

## R2 — Client-side image normalization (the heart of FR-007/SC-007)

- **Decision**: A `imageNormalize(file)` util loads the file into an `Image`, draws it to a `Canvas` downscaled so the long edge ≤ ~2000px, and exports `image/jpeg` at ~0.85 quality → `{ base64, mimeType: 'image/jpeg' }`. This keeps any realistic page screenshot well under the 5 MB decoded limit and normalizes the type to one the edge function accepts.
- **Rationale**: The target users (tablet/e-reader) routinely have large PNG screenshots that would otherwise be rejected; transparent downscale/re-encode makes uploads "just work" (Q1 = auto-handle). A 2000px long edge preserves enough resolution for OCR while guaranteeing the size bound.
- **HEIC**: Canvas decoding works for whatever the browser supports — PNG/JPEG/WebP everywhere, and HEIC on Safari. On browsers that cannot decode HEIC (most desktop Chrome/Firefox), the load fails and we show a clean error. A dedicated HEIC decoder (e.g. `heic2any`) is held as a **contingency** to add only if real usage hits it — not a default dependency (keeps the bundle lean; iOS screenshots are PNG anyway).
- **Alternatives considered**: Uploading the raw file untouched (rejected — fails on >5 MB / HEIC, the exact failure the spec wants gone); server-side resizing (rejected — needs an edge change and ships big bytes over the wire).

## R3 — Where the upload entry point lives

- **Decision**: Add "Upload image" to `SessionCaptureField` — the idle prompt (peer to "Take photo") and the camera-denied/offline fallback panels. Use a hidden `<input type="file" accept="image/*">` triggered by a PrimeVue `Button`.
- **Rationale**: `SessionCaptureField` is the only page-capture surface today (end-of-session prompt). The denied/offline panels matter because upload is exactly the path a camera-less or permission-denied reader needs. The hidden-input + button pattern is the idiomatic, accessible web file picker (Constitution VI; no PrimeVue file-trigger needed for this).
- **Alternatives considered**: A separate "import" screen (rejected — adds navigation for a one-tap action); a PrimeVue `FileUpload` widget (rejected — heavier than needed; a plain input + button gives full control of the capture UX).

## R4 — Offline / error handling for uploads

- **Decision**: `importImage` mirrors `snap()`'s guards: if `navigator.onLine` is false → existing `offline` state; OCR/network failures → existing `error` state; both keep "Add note instead" / "Skip" fallbacks.
- **Rationale**: OCR requires connectivity (extraction is server-side); reusing the existing states means no new fallback UI and consistent behavior with camera capture.
- **Alternatives considered**: Queuing uploads for later OCR (rejected — out of scope; capture has always required network).

## R5 — Page number and persistence unchanged

- **Decision**: The captured `page` continues to come from `reading_progress.current_page` (the caller already passes `currentPage`); the normalized image is never persisted; only reviewed text is saved.
- **Rationale**: Ebook "pages" vary by device, but BookHero tracks the reader's own page already (FR-005); the no-persist rule (FR-006) is honored because normalization is in-memory and only text reaches `page_captures`.
- **Alternatives considered**: Deriving a page from the screenshot (rejected — unreliable and unnecessary).
