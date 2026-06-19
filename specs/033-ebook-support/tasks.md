---
description: "Task list for 033-ebook-support"
---

# Tasks: Ebook Support (Screenshot Capture)

**Input**: Design documents from `/specs/033-ebook-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: One robust unit test is included in Polish (the composable's upload path). The canvas-based `imageNormalize` is verified manually via quickstart V4/V5 because `Canvas`/`toDataURL` are not meaningfully supported under jsdom.

**Organization**: Tasks grouped by user story. US1 (upload works) is the MVP; US2 completes coverage (both methods in every capture state). Both are P1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete tasks → can run in parallel.
- File paths are exact and relative to repo root.

## Path Conventions

- Web app (Vue front end + Supabase BaaS): code under `src/`, unit tests under `tests/unit/`. **No backend, schema, or edge-function changes in this feature.**

---

## Phase 1: Foundational (Shared Capture Plumbing)

**Purpose**: The image normalizer and the composable's upload method — both user stories depend on these.

**⚠️ CRITICAL**: No user-story phase can begin until this phase is complete.

- [X] T001 [P] Create `src/utils/imageNormalize.ts`: `imageNormalize(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' }>` — load the file into an `Image`, draw to a `Canvas` downscaled so the long edge ≤ ~2000px, export `image/jpeg` (~0.85 quality), return the base64 (no `data:` prefix). Throw a typed error if the file cannot be decoded as an image. Guarantees output fits the `ocr-page` limits (`image/jpeg`, ≤5 MB decoded).
- [X] T002 In `src/composables/useCapture.ts`, extract the existing `ocr-page` fetch logic from `snap()` into a private `runOcr(base64, mimeType)` (and have `snap()` call it — no behavior change), then add and export `importImage(file: File)`: if `!navigator.onLine` → set state `'offline'`; else set state `'ocr-running'`, call `imageNormalize(file)` (on decode failure → state `'error'` with a friendly message and **no** `ocr-page` call), set `previewImage` from the normalized data URL, and call `runOcr(base64, 'image/jpeg')`. (Depends on T001.)

**Checkpoint**: An uploaded image can be normalized and run through OCR into the `verify` state.

---

## Phase 2: User Story 1 - Capture an ebook page by uploading a screenshot (Priority: P1) 🎯 MVP

**Goal**: From the page-capture prompt, a reader can choose "Upload image", pick a screenshot, review the extracted text, and save — without a camera.

**Independent Test**: Trigger the end-of-session capture prompt, choose Upload image, pick a page screenshot, confirm the review screen shows extracted text + preview, edit, save — and the capture behaves like a camera capture.

- [X] T003 [US1] In `src/components/session/SessionCaptureField.vue`: pull `importImage` from `useCapture`; in the **idle** state relabel "Capture" → "Take photo" and add an "Upload image" PrimeVue `Button` that triggers a hidden `<input type="file" accept="image/*">`; on file change, call `importImage(firstFile)` then reset the input value (so the same file can be re-picked); update the prompt hint to mention reading on a device / uploading a screenshot; keep the existing error-state toast. The `verify` → `CaptureReviewViewport` → `handleSave` path is unchanged. (Depends on T002.)

**Checkpoint**: MVP — ebook readers can capture a page via upload end-to-end.

---

## Phase 3: User Story 2 - One easy capture entry point, everywhere (Priority: P1)

**Goal**: "Take photo" and "Upload image" are first-class peers in every capture state, and adding a book asks no ebook/print question.

**Independent Test**: Confirm both methods appear as peers in the prompt; on a camera-less/denied context the upload path still completes a capture; adding a book shows no new format prompt.

- [X] T004 [US2] In `src/components/session/SessionCaptureField.vue`, add an "Upload image" action to the **camera-denied** and **offline** fallback panels (upload needs no camera; an offline upload routes to the existing `offline` state). Ensure the idle state's two methods read as equal peers (FR-011). (Same file as T003 → after T003.)
- [X] T005 [US2] Confirm the add-book surfaces (`src/pages/AddBookPage.vue`, `src/components/books/BookForm.vue`, `src/pages/BookSearchDetailPage.vue`) introduce **no** ebook/print prompt and need no change (FR-004) — verification only, no code edit expected.

**Checkpoint**: Capture is available and easy in every state and on every device; no format prompt anywhere.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Test the upload path and validate end-to-end.

- [X] T006 [P] Add `tests/unit/useCaptureImport.spec.ts`: `vi.mock` `@/utils/imageNormalize` and global `fetch`; assert `importImage` → `'offline'` when `navigator.onLine` is false; → `'error'` with no `fetch` call when the normalizer throws; → sets `ocrResult` and state `'verify'` on a mocked successful OCR response.
- [X] T007 Automated gates green: `npm test` (79 passing) and `npx vue-tsc -b` (no type errors). Manual `quickstart.md` V1–V9 walkthrough in the running app is pending (upload capture, large screenshot, HEIC/unsupported, camera-less, downstream parity, no-persist, offline, no add-book prompt).

---

## Dependencies & Execution Order

- **Foundational (Phase 1)**: T001 [P] → T002 (T002 uses the util). BLOCKS both stories.
- **US1 (Phase 2)**: T003 after T002.
- **US2 (Phase 3)**: T004 after T003 (same file); T005 is an independent verification.
- **Polish (Phase 4)**: T006 after T002 (tests the composable); T007 last.

### Parallel Opportunities

- T001 is standalone (new file).
- T006 (test) can be written in parallel with the US2 component work (different file), once T002 exists.
- T005 (verification) is independent.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Foundational (`imageNormalize` + `importImage`).
2. Phase 2 (US1) — upload button in the prompt.
3. **STOP and VALIDATE**: quickstart V1, V4, V5, V8 — upload a screenshot (incl. a large one), confirm it saves and nothing is persisted.

### Incremental Delivery

1. Foundational → US1 (upload works) → demo.
2. Add US2 (denied/offline peers + no-prompt check) → full coverage → demo.
3. Polish: composable test + typecheck + full quickstart.

---

## Notes

- **No backend/schema/edge changes** — the `ocr-page` function and `page_captures` are reused unchanged; the client normalizes the image to fit.
- Images are normalized in memory and never persisted; only reviewed text is saved (FR-006).
- No book "format" is modeled; both capture methods are always available (FR-012, FR-004).
- HEIC decoding is browser-dependent; a dedicated decoder lib is a contingency only (research R2), not part of these tasks.
- Arrow functions only (project convention); per-component PrimeVue imports.
