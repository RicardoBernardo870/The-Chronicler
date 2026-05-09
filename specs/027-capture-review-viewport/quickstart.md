# Quickstart: Capture Review Viewport

## Prerequisites

- Current branch: `027-capture-review-viewport`
- Install dependencies already available in the repo.
- Supabase environment values configured as usual for capture/OCR flows.

## Implementation Touchpoints

1. Update `src/composables/useCapture.ts` to expose a single ephemeral `previewImage` created from the captured JPEG data URL.
2. Add `src/components/capture/CaptureReviewViewport.vue` for the mobile full-screen review UI.
3. Update `src/components/session/SessionCaptureField.vue` so `state === "verify"` mounts the review viewport when an OCR result and preview image are present.
4. Preserve current denied, offline, error, add-note-instead, and skip behavior.
5. Add focused tests for state transitions, single-preview cleanup, and review events.

## Verification

Run:

```powershell
npm run build
```

Manual mobile checks:

1. Start the app locally and open a mobile viewport.
2. Trigger the post-session capture prompt from Dashboard hero or Book Detail.
3. Tap Capture, then Snap.
4. Verify the review state fills the mobile viewport and shows the captured image.
5. Verify confirm/use and cancel/retake are visible without scrolling.
6. Verify cancel/retake returns to camera and clears the previous image.
7. Verify mobile back navigation from review returns to camera.
8. Verify save persists the existing text capture and exits the prompt.
9. Verify there is no path to add a second image or generate a recap from the capture page.

## Expected Non-Changes

- No database migrations.
- No Supabase storage changes.
- No edge function changes.
- No new runtime dependencies.
