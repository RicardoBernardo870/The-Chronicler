# Implementation Plan: Ebook Support (Screenshot Capture)

**Branch**: `033-ebook-support` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-ebook-support/spec.md`

## Summary

Let readers capture a page by **uploading a screenshot** in addition to taking a photo, so ebook readers can use page capture (corpus recaps, vocabulary extraction). The page-capture prompt presents "Take photo" and "Upload image" as first-class peers; no book "format" is modeled and adding a book gains no new prompt. Uploaded images are **normalized client-side** (downscale/compress, and convert where the browser can decode, e.g. HEIC) so large tablet screenshots transparently fit the existing OCR limits, then flow through the **unchanged** `ocr-page` → review → save pipeline. In-app ebook reading is out of scope (deferred). **No backend, schema, or edge-function changes.**

## Technical Context

**Language/Version**: TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: PrimeVue 4, Pinia 3, Supabase JS v2 (existing). Browser `Canvas`/`Image` for client-side image normalization. No new runtime npm dependency expected (a tiny HEIC decoder is a contingency only — see research R2).

**Storage**: None added. The existing `page_captures` table and the "images are never persisted" rule are unchanged.

**Testing**: Vitest (`npm test`); typecheck via `vue-tsc -b`.

**Target Platform**: Installable PWA (mobile + desktop). Desktop has no camera → upload is the sole method there, which this feature makes fully sufficient.

**Project Type**: Web application (Vue front end + Supabase BaaS). Change is almost entirely at the capture entry point.

**Performance Goals**: Upload-to-saved under ~30s for a clear screenshot (SC-001); client-side resize of a high-res image is sub-second.

**Constraints**: Reuse the `ocr-page` contract (`image/jpeg|png`, ≤5 MB decoded) — normalize on the client to satisfy it. Images stay in memory; only reviewed text is saved (FR-006, Constitution IV). PrimeVue-first UI (Constitution VI).

**Scale/Scope**: 1 new util, 1 composable method, 1 component edit. No new pages/routes/stores; no DB/edge changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Memory Continuity** | Strengthened — ebook readers can now feed corpus recaps/vocab, which previously required a physical book. No spoiler surface touched. ✅ |
| **II. Physical-to-Digital Bridge** | Directly on-mission: extends capture beyond physical pages to digital reading without breaking the existing camera path. ✅ |
| **III. AI-First Recap Engine** | Reuses the `ocr-page` AI extraction unchanged; uploaded images use the same prompt/flow. ✅ |
| **IV. Data Integrity & Sync** | No data model change. Normalization is in-memory; only reviewed text persists; "images not persisted" preserved. ✅ |
| **V. PWA-First & Frictionless** | Makes capture usable on camera-less contexts (desktop). No new routes/bundles of note; capture views already lazy-loaded. ✅ |
| **VI. Component Architecture & UI Standards** | The upload affordance is a PrimeVue `Button` plus a standard hidden `<input type="file">` (the idiomatic, accessible web pattern — no PrimeVue equivalent for a file trigger). Logic lives in the composable/util, not the component. ✅ |

**Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/033-ebook-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no schema change — input-method note)
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── internal-interfaces.md
├── checklists/
│   └── requirements.md  # From /speckit-specify + /speckit-clarify
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── utils/
│   └── imageNormalize.ts          # NEW — File → { base64, mimeType: 'image/jpeg' };
│                                  #   downscale long edge, re-encode JPEG to fit ≤5 MB;
│                                  #   best-effort decode of HEIC/other browser-decodable types
├── composables/
│   └── useCapture.ts              # MOD — extract shared runOcr(base64, mimeType); add
│                                  #   importImage(file): normalize → preview → OCR → 'verify';
│                                  #   offline guard mirrors snap()
└── components/
    └── session/
        └── SessionCaptureField.vue  # MOD — idle state: "Take photo" + "Upload image" as peers,
                                      #   hidden file input, importImage wiring, ebook-aware copy;
                                      #   also offer "Upload image" in the denied/offline panels
```

**Structure Decision**: The single page-capture surface today is `SessionCaptureField` (the end-of-session prompt). Add the upload path there and in the camera-denied/offline fallbacks. All image work lives in `useCapture` + a pure-ish `imageNormalize` util so any future capture surface reuses it. No backend touched.

## Key Design Decisions

1. **Normalize on the client; reuse the edge function as-is.** `ocr-page` already accepts `image/jpeg|png` ≤5 MB. Rather than relax the server, the client converts any picked image to a JPEG within limits (downscale the long edge to a cap, e.g. ~2000px, encode at ~0.85 quality). This guarantees the upload fits (FR-007/SC-007) with zero backend change and keeps the "images never persisted" guarantee intact.

2. **One shared OCR path.** Extract the existing fetch-to-`ocr-page` logic in `useCapture.snap()` into a private `runOcr(base64, mimeType)`; both `snap()` (camera) and the new `importImage(file)` call it. The `verify` → `CaptureReviewViewport` → save flow is untouched, so an uploaded capture is downstream-identical to a camera one (FR-010).

3. **Upload is a first-class peer in the prompt (FR-011).** In `SessionCaptureField`'s idle state, "Take photo" and "Upload image" sit side by side (relabel the current "Capture" → "Take photo"). A hidden `<input type="file" accept="image/*">` is triggered by the upload button. Copy updated to mention ebooks/screenshots. The denied/offline panels also surface "Upload image" (upload doesn't need a camera, but still needs network for OCR).

4. **No format concept (FR-012).** The app never asks or stores whether a book is print/ebook; both capture methods are always available, which is the simplest way to honor "don't prompt."

5. **HEIC is best-effort.** Canvas-based normalization handles anything the browser can decode (PNG/JPEG/WebP, and HEIC on Safari). On browsers that can't decode HEIC, the normalizer fails cleanly → a friendly "couldn't read that image" message. A small HEIC decoder library is a **contingency only** if real usage needs it (research R2) — not a default dependency.

6. **Offline + errors reuse existing states.** `importImage` checks `navigator.onLine` (OCR needs network) and routes to the existing `offline`/`error` capture states, so all fallbacks ("Add note instead", "Skip") already work.

## Complexity Tracking

> No constitution violations — section intentionally empty.
