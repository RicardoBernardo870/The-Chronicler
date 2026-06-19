# Feature Specification: Ebook Support (Screenshot Capture & Format Awareness)

**Feature Branch**: `033-ebook-support`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "We need to add support for Ebooks throughout the app. Mainly, when saving a new page and ending a session the user has no way to take a picture because it's an ebook — so we need to let the user upload a screenshot of the page. Nuances: make the UI/UX easy. When the user adds a book, can we get info from Google/Open Library that it's an ebook? If so, we don't need to prompt the user whether it's an ebook. Also analyse how possible it is to let the user read the ebook itself in our app."

## Overview

Today, capturing a page (to ground recaps and extract vocabulary) assumes a **physical book and a camera**. Ebook readers can't point a camera at a page, so they're effectively locked out of page capture during a reading session and at session end. This feature lets readers **provide a page image by uploading a screenshot** instead of taking a photo, with an entry point that works the same whether the book is print or digital — so the app never has to ask "is this an ebook?". It also records the conclusions of two feasibility questions the request raised (catalog-based format detection; in-app reading).

## Clarifications

### Session 2026-06-18

- Q: Is reading the ebook inside the app in scope for this feature, or deferred? → A: **Deferred (analysis-only).** This feature is screenshot-capture only; in-app reading stays a future initiative (DRM/effort constraints recorded in Out of Scope).
- Q: Do we model a per-book format (print/ebook/audiobook)? → A: **No format concept.** The capture entry point offers both "Take photo" and "Upload image" everywhere, so the app never needs to know — or ask — a book's format.
- Q: Where should the upload option appear? → A: **In the page-capture prompt itself** (when saving a page / ending a session), as a clearly visible, first-class option — not hidden behind a menu — so ebook readers immediately see it. UI updated for that.
- Q: What happens with oversized or unsupported uploads (large tablet PNGs, HEIC)? → A: **Auto-handle** — the app downscales/compresses and converts (e.g., HEIC→JPEG/PNG) client-side so the upload transparently fits the extraction limits; a friendly error appears only for a file that isn't a usable image at all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture an ebook page by uploading a screenshot (Priority: P1)

A reader reading on a phone/tablet/e-reader app screenshots the page they're on, opens BookHero, and — while saving progress mid-session or when ending a session — chooses to **upload that screenshot** instead of taking a photo. The app reads the text from the image, lets the reader review/correct it, and saves it exactly like a camera capture, so their recaps and vocabulary work for ebooks too.

**Why this priority**: This is the core unblock. Without it, the entire capture-driven experience (corpus recaps, vocabulary extraction) is unavailable to ebook readers — which the request identifies as the main gap.

**Independent Test**: On a device without using the camera, start/end a session, choose "upload image," pick a screenshot of a page, confirm the extracted text appears for review, edit if needed, save — and verify the saved capture behaves identically to a camera capture (feeds recaps/vocab).

**Acceptance Scenarios**:

1. **Given** a reader is saving a page during a session, **When** they choose to upload an image and select a page screenshot, **Then** the text is extracted and presented for review before saving.
2. **Given** a reader is ending a session, **When** they choose to upload an image, **Then** the same capture-and-review flow runs and the capture is attached to the session/book.
3. **Given** the extracted text from a screenshot is imperfect, **When** the reader edits it in the review step, **Then** the edited text is what gets saved.
4. **Given** a saved capture that originated from an uploaded screenshot, **When** the reader later generates a corpus recap or vocabulary, **Then** it is used identically to a camera-sourced capture.

---

### User Story 2 - One easy capture entry point, no ebook prompt (Priority: P1)

Wherever a reader can capture a page, they see **both** "Take photo" and "Upload image" options. The app never asks the reader to declare whether a book is print or ebook in order to capture — the reader simply picks the method that fits their situation. Adding a book stays as simple as it is today.

**Why this priority**: The request explicitly asks for easy UX and "no prompt." Offering both capture methods everywhere removes the need to know the format at all, which is the simplest and most robust way to satisfy "don't prompt."

**Independent Test**: Open the capture entry point from every place a page can be captured; confirm both "Take photo" and "Upload image" are offered, and that adding a book introduces no new ebook/print question.

**Acceptance Scenarios**:

1. **Given** any place where a page can be captured, **When** the capture UI opens, **Then** the reader can choose either to take a photo or upload an image.
2. **Given** a reader is adding a book, **When** they complete the add flow, **Then** they are not asked whether the book is an ebook.
3. **Given** a device with no camera or denied camera permission (e.g., desktop), **When** the reader captures a page, **Then** the upload path is available and fully functional.

---

### Edge Cases

- **Screenshot includes reader UI chrome** (status bar, page controls): extraction + the review/edit step still yield usable body text; the reader can trim noise before saving.
- **Large or HEIC screenshot**: automatically downscaled/compressed/converted client-side so it fits the extraction limits — it just works, no manual resizing. A friendly error appears only for a file that isn't a usable image at all (e.g., a non-image file).
- **Wrong image** (not a page): the review step lets the reader correct or cancel before anything is saved.
- **No text extracted / low confidence**: the reader can type or fix the text manually before saving (existing behavior preserved).
- **Offline**: text extraction needs connectivity; if offline, the reader is told capture needs a connection (consistent with today's capture behavior), and progress saving itself still works.
- **Desktop / no camera**: upload is the only method and must be fully sufficient.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Page capture — both when saving a page mid-session and when ending a session — MUST let the reader provide the page image by **uploading an image file** (e.g., a device screenshot), in addition to the existing camera option.
- **FR-002**: An uploaded page image MUST flow through the **same extract-text → review/edit → save** pipeline as a camera photo; the reader reviews and can edit the text before it is saved.
- **FR-003**: The capture entry point MUST present both "Take photo" and "Upload image" wherever a page can be captured, **without requiring the reader to declare the book's format** first.
- **FR-004**: Adding a book MUST NOT introduce any new prompt asking whether the book is an ebook or print.
- **FR-005**: The captured page number MUST continue to come from the reader's tracked current page, never inferred from the image.
- **FR-006**: Uploaded page images MUST NOT be persisted; only the reviewed text is stored (consistent with the existing "images are not persisted" rule).
- **FR-007**: The app MUST accept common image uploads — **including large high-resolution screenshots and HEIC photos** — and automatically downscale/compress and convert them client-side so they fit the text-extraction limits, without the reader having to resize or convert anything. A clear, friendly error MUST appear only when the chosen file is not a usable image at all (not merely because it is large or HEIC).
- **FR-008**: On devices without a working camera (or with camera permission denied), the reader MUST be able to complete page capture entirely via upload.
- **FR-009**: If extraction yields no text or low confidence from an uploaded image, the reader MUST be able to edit or enter the text manually before saving.
- **FR-010**: A capture that originated from an uploaded image MUST be indistinguishable downstream from a camera capture (same use in recaps, vocabulary extraction, completion cleanup).
- **FR-011**: The page-capture prompt MUST present "Upload image" as a **clearly visible, first-class option alongside "Take photo"** (not hidden behind a secondary menu), so an ebook reader immediately recognizes they can upload a screenshot. The two options MUST read as peers.
- **FR-012**: The system MUST NOT model or store a per-book "format" (print/ebook/audiobook); capture is format-agnostic and the app never branches on book format.

### Key Entities *(include if data involved)*

- **Page Capture** (existing): reviewed text for a book/page, used for recaps and vocabulary. Unchanged in shape; gains a new **input method** (uploaded image) alongside camera. Source attribution may distinguish the input method (informational only). No new persisted entity is introduced by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An ebook reader can capture a page (both mid-session and at session end) **without using a camera**, completing the upload-to-saved flow in under ~30 seconds for a clear screenshot.
- **SC-002**: Adding a book requires **zero** additional ebook/print questions versus today.
- **SC-003**: For legible page screenshots, capture success (usable text saved) is on par with camera photos of physical pages.
- **SC-004**: **100%** of uploaded page images are discarded after capture — none are retained in storage.
- **SC-005**: Every place that offers page capture offers both photo and upload methods, verified across at least one mobile and one desktop context.
- **SC-006**: Ebook readers can use corpus recaps and vocabulary extraction at parity with physical-book readers.
- **SC-007**: Large high-resolution tablet screenshots and HEIC photos upload and process successfully **without the reader manually resizing or converting** them.

## Assumptions

- This feature **reuses the existing capture → text-extraction → review → save pipeline**; the only new ingredient is accepting an uploaded image as the source, so the change is primarily at the capture entry point, not the downstream processing.
- **Catalog-based ebook detection is unreliable and is therefore not depended upon.** Google Books and Open Library describe *editions* of a title (a book commonly exists in both print and ebook), not *the reader's own copy*. Metadata can say "an ebook edition exists," but not "this reader is reading the ebook." Rather than guess (and risk being wrong) or prompt, the design simply offers both capture methods so the format question can be avoided entirely. (This is the answer to the request's "can we detect it?" — practically, no, not for the reader's specific copy.)
- Page numbers for ebooks remain whatever the reader tracks in the app; ebook "pages" vary by device/font, but BookHero already tracks the reader's own current page, so no change is needed there.
- Extraction continues to require connectivity; offline capture remains unsupported, consistent with today.

## Out of Scope

- **Reading the ebook inside BookHero** — *feasibility analysis (per the request):* this is **not feasible as a general capability** and is deliberately excluded from this feature. To read an ebook in-app, the reader would have to supply a **DRM-free** EPUB/PDF they own; the vast majority of store-purchased ebooks (Kindle, Apple Books, Google Play Books, Kobo) are **DRM-protected and cannot be opened**, and BookHero cannot source or host licensed ebook files. Even limited to DRM-free user uploads, it would require an in-app reader/renderer, page-number mapping, large-file storage, and offline handling — a substantial standalone initiative. **Decision: in-app reading is deferred** — a separate future initiative, not part of this feature (Clarifications Q1).
- Audiobook playback/listening.
- Auto-importing screenshots or watching the photo library.
- Changing how page numbers are tracked.
