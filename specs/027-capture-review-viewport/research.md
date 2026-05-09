# Research: Capture Review Viewport

## Decision: Keep The Flow Frontend-Only

**Rationale**: The feature changes the post-capture decision moment, not storage or OCR semantics. Existing camera, OCR, and `page_captures` persistence already support a single confirmed text capture.

**Alternatives considered**:
- Add a new backend contract for image review: rejected because images are not persisted and the current edge function already receives the image for OCR.
- Add a new Supabase table or storage bucket for image previews: rejected because the spec explicitly scopes the image to the review decision and no storage rule changes are needed.

## Decision: Retain An Ephemeral Preview Image In `useCapture`

**Rationale**: The current composable captures a JPEG data URL, strips it to base64 for OCR, and then discards the original preview. A full-screen review viewport needs the image to be visible after OCR succeeds, but only until confirm, cancel, retake, or unmount.

**Alternatives considered**:
- Reconstruct a data URL in the review component from request payload: rejected because the composable is the capture boundary and already has the image at the correct lifecycle point.
- Show only OCR text in full-screen mode: rejected because the spec requires the captured image to be the primary focus.

## Decision: Add A Dedicated `CaptureReviewViewport.vue`

**Rationale**: A focused component keeps the full-screen mobile review behavior separate from the session prompt and preserves Principle VI single-responsibility guidance. PrimeVue can cover the controls and supporting messages, while the domain-specific viewport layout belongs in a capture component.

**Alternatives considered**:
- Expand `CaptureVerifyView.vue` into full-screen image review: rejected because it would mix existing text verification responsibilities with mobile viewport shell behavior.
- Put the review markup directly in `SessionCaptureField.vue`: rejected because that component already orchestrates multiple capture/note/error states.

## Decision: Preserve Text Verification Inside The Review Viewport

**Rationale**: The existing saved entity is captured text, not an image. The mobile review must let the user confirm/use the capture without losing the ability to review OCR quality, especially for low-confidence captures.

**Alternatives considered**:
- Confirm the image without exposing OCR text: rejected because it risks saving poor OCR text without user visibility.
- Split into image review and separate text verification screens: rejected because it adds an extra decision point and conflicts with the 2-tap post-capture success criterion.

## Decision: Mobile Back Navigation Cancels Review

**Rationale**: The clarification states that mobile back navigation should behave like cancel/retake. This keeps the review state predictable and prevents unconfirmed images from being accepted by accident.

**Alternatives considered**:
- Let back navigation leave the capture page: rejected because it could bypass the explicit review decision.
- Disable back navigation: rejected because it fights common mobile expectations and leaves users dependent on visible controls only.

## Decision: Use Component Tests Plus Manual Mobile Verification

**Rationale**: The repository uses Vitest and Vue Test Utils. Browser camera APIs and visual viewport ergonomics also need manual verification in the local app because jsdom cannot fully exercise real camera and mobile browser behavior.

**Alternatives considered**:
- End-to-end camera automation only: rejected because camera permissions and device APIs are brittle in CI without additional harness work.
- Manual testing only: rejected because state transitions and one-image constraints can be covered with deterministic unit/component tests.
