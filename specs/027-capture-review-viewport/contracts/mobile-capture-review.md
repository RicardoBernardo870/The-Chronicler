# Contract: Mobile Capture Review

## Component Boundary

**New component**: `src/components/capture/CaptureReviewViewport.vue`

**Owned responsibility**: Render the mobile-only full-screen post-capture review state for one captured image and its OCR text.

## Props

```ts
defineProps<{
  imageSrc: string
  initialText: string
  confidence: number
}>()
```

## Emits

```ts
defineEmits<{
  confirm: [text: string]
  cancelRetake: []
}>()
```

## Required Behavior

- Render as a full-screen mobile review viewport when mounted.
- Show the captured image as the dominant visual element.
- Show exactly two decision actions without requiring scroll:
  - Primary: confirm/use capture.
  - Secondary: cancel/retake.
- Preserve the existing text verification affordance within the same review state.
- Disable or block confirm when verified text is empty or over the existing character limit.
- Show low-confidence OCR warning when confidence is below the existing threshold.
- Treat mobile back navigation as `cancelRetake`.
- Emit no event for adding another capture, queuing images, or generating a recap.

## Parent Integration

**Existing parent**: `src/components/session/SessionCaptureField.vue`

Parent responsibilities:
- Continue to own save behavior through `useCapturesStore.saveCapture`.
- Continue to emit `saved` after save success and `skipped` only for the broader prompt skip path.
- Route `cancelRetake` back into the existing camera capture state rather than exiting the prompt.
- Keep permission, offline, and error states unchanged.

## Composable Integration

**Existing composable**: `src/composables/useCapture.ts`

Required exposed state:

```ts
type UseCaptureReturn = {
  state: Ref<CaptureState>
  ocrResult: Ref<OcrResult | null>
  previewImage: Ref<{ dataUrl: string; mimeType: 'image/jpeg' } | null>
  startCamera: (target: HTMLVideoElement) => Promise<void>
  snap: () => Promise<void>
  retake: () => void
  cancel: () => void
}
```

## Accessibility And Mobile UX Contract

- Primary and secondary actions must be reachable in the mobile viewport without scroll.
- Buttons must use accessible names and PrimeVue Button where suitable.
- Full-screen state must avoid trapping users without a visible cancel path.
- Image review must not be covered by the action controls in a way that prevents judging capture quality.
- Mobile viewport and orientation changes must keep actions visible.

## Out Of Scope

- Multiple captures.
- Capture queues.
- Direct recap generation.
- Persistent image storage.
- Desktop-specific capture UX changes.
