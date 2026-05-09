# Tasks: Capture Review Viewport

**Input**: Design documents from `specs/027-capture-review-viewport/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mobile-capture-review.md, quickstart.md

**Tests**: Automated test tasks were removed per user direction on 2026-05-09. Validate with build/typecheck and manual mobile quickstart.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing capture flow boundaries.

- [X] T001 Review current capture state transitions in `src/composables/useCapture.ts`, `src/components/session/SessionCaptureField.vue`, `src/components/capture/CaptureCameraView.vue`, and `src/components/capture/CaptureVerifyView.vue`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared one-shot preview state needed by all review stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Extend the `OcrResult`/capture return surface with an ephemeral `previewImage` ref in `src/composables/useCapture.ts`
- [X] T003 Update `snap()` in `src/composables/useCapture.ts` to retain exactly one JPEG preview data URL before OCR and clear stale preview data before a new snap
- [X] T004 Update `retake()` and `cancel()` in `src/composables/useCapture.ts` to clear `previewImage`, `ocrResult`, and `errorMessage`
- [X] T005 Add defensive preview cleanup on capture failure and unmount in `src/composables/useCapture.ts`
- [X] T006 Prevent rapid repeated snap input from creating multiple active previews or concurrent review states in `src/composables/useCapture.ts`

**Checkpoint**: The capture lifecycle can produce and clear one ephemeral image preview without UI changes.

---

## Phase 3: User Story 1 - Review One Capture Without Scrolling (Priority: P1) MVP

**Goal**: After a successful mobile capture, show a full-screen review viewport with the captured image as the focus and both decisions visible without scrolling.

**Independent Test**: On a mobile viewport, trigger capture, snap one image, and verify the image plus confirm/use and cancel/retake actions are visible in the viewport without scrolling.

### Implementation for User Story 1

- [X] T007 [US1] Create `src/components/capture/CaptureReviewViewport.vue` with props and emits from `specs/027-capture-review-viewport/contracts/mobile-capture-review.md`
- [X] T008 [US1] Implement the mobile full-screen image-first layout, sticky action area, and no-scroll decision controls in `src/components/capture/CaptureReviewViewport.vue`
- [X] T009 [US1] Preserve OCR text verification, character limit, and low-confidence warning behavior inside `src/components/capture/CaptureReviewViewport.vue`
- [X] T010 [US1] Replace the `state === "verify"` branch in `src/components/session/SessionCaptureField.vue` to mount `CaptureReviewViewport.vue` when both `ocrResult` and `previewImage` exist
- [X] T011 [US1] Add fallback handling in `src/components/session/SessionCaptureField.vue` for `state === "verify"` without `previewImage` so users are returned to a recoverable error or camera state

**Checkpoint**: User Story 1 is functional and testable as the MVP.

---

## Phase 4: User Story 2 - Confirm the Captured Image (Priority: P1)

**Goal**: Confirming from the review viewport saves the single reviewed OCR text capture through the existing persistence path and exits the prompt.

**Independent Test**: Capture one image, confirm it from review, and verify only that image/text pair is accepted and the UI offers no add-another or recap action.

### Implementation for User Story 2

- [X] T012 [US2] Wire `CaptureReviewViewport.vue` confirm events to `handleSave()` in `src/components/session/SessionCaptureField.vue`
- [X] T013 [US2] Ensure successful save clears the active prompt via existing `saved` emit and does not expose another capture action in `src/components/session/SessionCaptureField.vue`
- [X] T014 [US2] Verify no recap-generation action, multi-capture queue, or add-another control is present in `src/components/capture/CaptureReviewViewport.vue`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Cancel or Retake a Capture (Priority: P2)

**Goal**: Cancel/retake and mobile back navigation discard the reviewed capture and return to the camera state.

**Independent Test**: Capture one image, choose cancel/retake or mobile back navigation, and verify the previous image is discarded and the camera state returns.

### Implementation for User Story 3

- [X] T015 [US3] Add `cancelRetake` handling in `src/components/session/SessionCaptureField.vue` that clears the reviewed capture and returns to camera capture state
- [X] T016 [US3] Add mobile back navigation handling in `src/components/capture/CaptureReviewViewport.vue` that emits `cancelRetake`
- [X] T017 [US3] Ensure `CaptureReviewViewport.vue` removes mobile back listeners on unmount
- [X] T018 [US3] Ensure retake state shows normal single-capture controls with no queued preview in `src/components/session/SessionCaptureField.vue`

**Checkpoint**: User Stories 1, 2, and 3 are independently functional.

---

## Phase 6: User Story 4 - Preserve Existing Capture Readiness and Error Handling (Priority: P3)

**Goal**: Permission denied, offline, camera unavailable, OCR failure, and save failure behavior remain clear and do not enter a broken review state.

**Independent Test**: Exercise denied, offline, error, and save-failure paths and verify users remain in existing recovery states without hidden off-screen actions or image review without an image.

### Implementation for User Story 4

- [X] T019 [US4] Confirm denied, offline, and error branches in `src/components/session/SessionCaptureField.vue` remain unchanged except where needed for preview cleanup
- [X] T020 [US4] Ensure save failure in `src/components/session/SessionCaptureField.vue` keeps the review state recoverable with the same single preview and text

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate mobile UX quality, accessibility, and build health.

- [X] T021 [P] Review `src/components/capture/CaptureReviewViewport.vue` against PrimeVue-first styling and remove hard-coded colors where PrimeVue tokens are available
- [X] T022 [P] Verify accessible names, focus order, and low-confidence announcement behavior in `src/components/capture/CaptureReviewViewport.vue`
- [X] T023 Run `npm run build` and address type or bundle errors
- [ ] T024 Execute manual mobile quickstart validation from `specs/027-capture-review-viewport/quickstart.md`
- [X] T025 Update implementation notes in `specs/027-capture-review-viewport/quickstart.md` if verification reveals any changed manual steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Complete.
- **Foundational (Phase 2)**: Complete.
- **User Story 1 (Phase 3)**: Complete.
- **User Story 2 (Phase 4)**: Complete.
- **User Story 3 (Phase 5)**: Complete.
- **User Story 4 (Phase 6)**: Complete.
- **Polish (Phase 7)**: Build and manual validation remain.

### User Story Dependencies

- **US1 Review One Capture Without Scrolling**: First deliverable after Foundational.
- **US2 Confirm the Captured Image**: Requires US1 review UI but can be validated independently through confirm behavior.
- **US3 Cancel or Retake a Capture**: Requires US1 review UI but can be validated independently through cancel/back behavior.
- **US4 Preserve Existing Capture Readiness and Error Handling**: Can begin after Foundational, with final validation after US1-US3 integration.

### Parallel Opportunities

- T021 and T022 can run in parallel during polish.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 preview-state foundation.
3. Complete Phase 3 full-screen mobile review viewport.
4. Stop and validate US1 independently on a mobile viewport.

### Incremental Delivery

1. Add preview state foundation.
2. Add full-screen mobile review viewport.
3. Add confirm/save integration.
4. Add cancel/retake and mobile back behavior.
5. Re-validate existing permission, offline, and error states.
6. Run build and manual mobile quickstart.

## Notes

- Automated test tasks were removed per user direction.
- Keep the feature mobile-only; desktop-specific capture UX changes are out of scope.
- Do not add schema, storage, edge-function, recap-generation, or package changes.
