# Implementation Plan: Capture Review Viewport

**Branch**: `027-capture-review-viewport` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/027-capture-review-viewport/spec.md`

## Summary

Improve the mobile-only post-capture experience by replacing the scroll-dependent verification surface with a full-screen review viewport where the captured image is the focus and exactly two decisions are always visible: confirm/use the capture or cancel/retake back to camera. The implementation will extend the existing `useCapture` single-shot state machine to retain an ephemeral preview image, introduce a dedicated mobile review component under `src/components/capture/`, and keep the current OCR text save path, permission handling, and one-image constraint intact.

## Technical Context

**Language/Version**: TypeScript 6.x with Vue 3.5 Composition API and `<script setup>`  
**Primary Dependencies**: PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, VueUse, native `navigator.mediaDevices.getUserMedia()`  
**Storage**: Existing Supabase `page_captures` write path via `useCapturesStore`; no schema changes and no image persistence  
**Testing**: Vitest with Vue Test Utils for state/component behavior; manual mobile viewport verification through the local app  
**Target Platform**: Mobile PWA/browser capture experience only  
**Project Type**: Frontend Vue PWA  
**Performance Goals**: Full-screen review appears immediately after OCR success; controls remain visible in mobile viewport without scroll; camera stream released once the frame is captured  
**Constraints**: One active capture image only; no multi-image queue; no recap generation from capture; no new runtime packages; maintain existing permission/offline/error behavior  
**Scale/Scope**: One capture flow used from post-session prompts in Dashboard hero and Book Detail page; implementation scoped to existing capture components/composable

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: PASS. The change improves capture usability for corpus-grounded recap inputs without altering spoiler boundaries or recap content generation.
- **II. Physical-to-Digital Bridge**: PASS. The feature strengthens page capture for physical book reading and preserves page-based progress context.
- **III. AI-First Recap Engine**: PASS. No recap prompt or model behavior changes; captured text continues to feed the existing recap pipeline later.
- **IV. Data Integrity & Synchronization**: PASS. Existing `page_captures` persistence path remains authoritative; captured images stay ephemeral and are not persisted.
- **V. PWA-First & Frictionless Portability**: PASS. Mobile one-handed usability is the central feature goal; no app-store or native dependency is introduced.
- **VI. Component Architecture & UI Standards**: PASS. Plan uses PrimeVue Button/Message/Textarea/Image where appropriate and introduces one focused capture review component rather than expanding page-level templates.

## Project Structure

### Documentation (this feature)

```text
specs/027-capture-review-viewport/
+-- plan.md
+-- research.md
+-- data-model.md
+-- quickstart.md
+-- contracts/
|   +-- mobile-capture-review.md
+-- checklists/
|   +-- requirements.md
+-- tasks.md
```

### Source Code (repository root)

```text
src/
+-- components/
|   +-- capture/
|   |   +-- CaptureCameraView.vue
|   |   +-- CaptureVerifyView.vue
|   |   +-- CaptureReviewViewport.vue
|   +-- session/
|       +-- SessionCaptureField.vue
+-- composables/
|   +-- useCapture.ts
+-- stores/
    +-- captures.ts
```

**Structure Decision**: Use the existing frontend Vue PWA structure. `SessionCaptureField.vue` remains the orchestration boundary, `useCapture.ts` remains the camera/OCR lifecycle boundary, and a new `CaptureReviewViewport.vue` owns the mobile full-screen review presentation.

## Complexity Tracking

No constitution violations identified.

## Phase 0: Research

See [research.md](./research.md).

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and [mobile-capture-review.md](./contracts/mobile-capture-review.md).

## Post-Design Constitution Check

- **I. Memory Continuity**: PASS. No changes to recap content or progress boundaries.
- **II. Physical-to-Digital Bridge**: PASS. Mobile page capture remains first-class for physical reading sessions.
- **III. AI-First Recap Engine**: PASS. Existing OCR and later recap integration are preserved.
- **IV. Data Integrity & Synchronization**: PASS. Only confirmed text is persisted through the existing store; cancel/retake discards the ephemeral preview and OCR result.
- **V. PWA-First & Frictionless Portability**: PASS. Review is optimized for mobile viewport reachability and does not introduce native dependencies.
- **VI. Component Architecture & UI Standards**: PASS. PrimeVue components are used for actions, messaging, text verification, and image display where suitable; custom review component is justified because the feature requires a domain-specific full-screen mobile state machine.
