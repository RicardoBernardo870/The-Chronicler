# Contract: Internal interfaces

No external API and no edge-function/RPC changes. Below are the internal util / composable / UI seams.

## Util — `src/utils/imageNormalize.ts` (new)

```ts
export interface NormalizedImage { base64: string; mimeType: 'image/jpeg' }

// Load `file` into an Image, downscale the long edge to <= MAX_EDGE (~2000px),
// draw to a canvas, export as JPEG (~0.85) → base64 (no data: prefix).
// Throws a typed error when the file cannot be decoded as an image.
export const imageNormalize = (file: File): Promise<NormalizedImage>
```

- Output is always `image/jpeg` and sized to fit the `ocr-page` limits (≤5 MB decoded).
- Decodes whatever the browser supports (PNG/JPEG/WebP everywhere; HEIC on Safari). Decode failure → typed error (no `ocr-page` call).

## Composable — `src/composables/useCapture.ts` (modified)

```ts
// Extracted shared OCR path used by BOTH camera and upload:
//   private runOcr(base64: string, mimeType: 'image/jpeg'): Promise<void>
//   - posts to ocr-page with the access token; on ok → ocrResult + state='verify';
//     on failure → state='error'; sets previewImage for the review screen.

// New public method:
importImage(file: File): Promise<void>
//   - if offline → state='offline' (OCR needs network)
//   - state='ocr-running'; normalize via imageNormalize(file);
//     on decode failure → state='error' with a friendly message;
//     else set previewImage from the normalized data URL and call runOcr(...).
```

- `snap()` is refactored to call `runOcr(...)` after building the camera frame's base64; its external behavior is unchanged.
- Returned surface adds `importImage`; existing `state`, `ocrResult`, `previewImage`, `errorMessage`, `startCamera`, `snap`, `retake`, `cancel` are unchanged.

## UI — `src/components/session/SessionCaptureField.vue` (modified)

- **Idle state**: present two peer actions — **"Take photo"** (was "Capture" → relabel; triggers `handleStartCapture`) and **"Upload image"** (triggers a hidden `<input type="file" accept="image/*">`). Keep "Add note instead" and "Skip". Update the hint copy to mention reading on a device / uploading a screenshot.
- **File input handler**: on change, take the first file and call `importImage(file)`; surface `error`-state toasts as today; reset the input value so the same file can be re-picked.
- **Denied / Offline panels**: add an "Upload image" action (upload needs no camera; still needs network — offline upload routes to the offline state).
- **Review path unchanged**: `state==='verify'` still renders `CaptureReviewViewport` with `previewImage.dataUrl` + `ocrResult.text`; save flow (`handleSave`) is untouched, so uploaded captures persist identically.

## Data flow

```text
"Upload image" → hidden <input type=file> → importImage(file)
        imageNormalize(file) → { base64, mimeType:'image/jpeg' }  (downscaled/re-encoded, ≤5 MB)
        → runOcr(base64, 'image/jpeg') → POST ocr-page → { text, confidence, wordCount }
        → state='verify' → CaptureReviewViewport (review/edit) → capturesStore.saveCapture(...)
"Take photo" → startCamera → snap() → runOcr(...) → (same review/save)
```
