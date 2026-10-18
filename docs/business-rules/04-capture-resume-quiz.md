# 04 · Page Capture, Session Resume & Memory Check — Business Rules
> **Prefix:** CAP · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-18

`D-xx` are the 2026-10-18 owner decisions (decisions log in the [README](README.md)). `BC-xx` are the Phase 0 work packages in [backend-consolidation-plan](../backend-consolidation-plan.md). Payload shapes, columns, policies and function bodies are in [backend-contract](../backend-contract.md). Live definitions of every trigger and function named here are in `supabase/reference/live-baseline-2026-10-18.sql`.

Code and the live database are the source of truth. The web specs `specs/015-corpus-recaps`, `specs/027-capture-review-viewport` and `specs/033-ebook-support` are intent only, and they differ from shipped behaviour in several places (noted in the rules).

---

## Overview

After an **online page save** the reader is offered **"Capture this page"**. They can photograph the page (paper books) or upload a screenshot (ebooks, or no camera). The `ocr-page` edge function (Gemini 2.5 Flash) extracts the text. A high-confidence result is saved automatically. Anything else goes to a review screen where the reader can edit, retake or re-upload.

Each capture is stored once per `(user, book, page)`. Captures feed four other things:

- corpus-grounded recaps ([03 · Recaps](03-recaps.md));
- automatic vocabulary extraction ([05 · Codex & Lexicon](05-codex-lexicon.md));
- the pre-session **"Previously"** resume;
- the **Memory Check** recall quiz.

Each unique captured page earns **+5 XP**, recorded by a database trigger. When the book is completed, **all captures (with their resumes) and the quiz are deleted** server-side.

### Screens and entry points

| Web route / surface | Entry point | Purpose |
|---|---|---|
| `/` Dashboard → hero card (`HeroBookCard`) | Inline "Capture this page" prompt after a save; **Start Session** | Capture after a save; pre-session resume or Memory Check |
| `/books/:id` Book Detail (`BookDetailPage`, `BookProgressPanel`) | Inline prompt after a save (hidden for DNF); **Start Session**; **"Memory check"** chip | Same, plus an on-demand quiz |
| Camera overlay (`CaptureCameraView`, teleported to `<body>`) | "Take photo" | Live rear-camera preview, Snap / Cancel |
| Hidden `<input type=file accept="image/*">` | "Upload image" | Screenshot, ebook, or no camera |
| Review viewport (`CaptureReviewViewport`, full screen) | OCR confidence < 0.90, empty text, or a failed auto-save | Edit the text; Use Capture / Retake (Re-upload) / close |
| Note fallback (`SessionNoteField`) | "Add note instead" | A note of up to 160 chars on the new `progress_history` row |
| "Previously" dialog (`SessionResumeDialog`) | Start Session | ≤ 3 bullets + a tension line; the timer starts on "Begin reading" |
| Memory Check dialog (`MemoryCheckDialog`), `session` / `ondemand` modes | Start Session (when eligible) / the chip | 1–3 multiple-choice questions |
| `/books/:id/recaps` (`recap-history`) | "Feeling hazy? Read the full recap" | Exit from the quiz summary |
| `/profile/trophy-room` (Trophy Room) | XP and achievements | +5 XP per captured page; "Chronicler" and "Archivist" badges |

There is **no capture list, edit or delete UI** anywhere.

### Owning objects (names only)

- **Tables:**
  - `page_captures` and `book_quizzes`, written by the client;
  - `reading_quest_events`, written only by a trigger;
  - `progress_history.session_note`, written by the note fallback.
  - Side effects land in `vocabulary_extractions` / `lexicon_entries`, which are owned by LEX.
- **Triggers / functions:**
  - `page_capture_quest_event_after_save` → `record_page_capture_quest_event`;
  - `page_captures_delete_on_completion` → `delete_page_captures_on_book_completion`;
  - `book_quizzes_delete_on_completion` → `delete_book_quizzes_on_book_completion`.
  - Dead: `after_page_capture_saved`, `prune_page_captures_for_book`.
- **RPCs:** none are called by this domain. The XP consumer is `get_reading_quest_summary` ([07 · Profile, Stats & Goals](07-profile-stats-goals.md)).
- **Edge functions:** `ocr-page` (v2), `generate-page-resume` (v3), `generate-book-quiz` (v1). Side effect: `extract-vocabulary` (LEX).
- **Web code:**
  - `src/components/session/{SessionCaptureField,SessionNoteField,SessionStartButton,SessionResumeDialog,MemoryCheckDialog}.vue`
  - `src/components/capture/{CaptureCameraView,CaptureReviewViewport}.vue`
  - `src/composables/{useCapture,usePageResume,useSessionResume,useBookQuiz}.ts`
  - `src/stores/captures.ts`
  - `src/utils/imageNormalize.ts`

**Related rules elsewhere:**

- the save that raises the prompt: [02 · Reading Sessions](02-reading-sessions.md) SES-30 / SES-37 / SES-88;
- captures as recap corpus and the corpus-window mismatch: [03 · Recaps](03-recaps.md) REC-13…REC-17;
- the extraction pipeline: [05 · Codex & Lexicon](05-codex-lexicon.md) LEX-84…LEX-94;
- capture XP: [07 · Profile, Stats & Goals](07-profile-stats-goals.md) PRO-05;
- trigger and cascade invariants: [09 · Database Invariants](09-database-invariants.md) BE-19…BE-25;
- completion, delete and sign-out side-effect matrices: [11 · Cross-Domain](11-cross-domain.md).

---

## Rules

### A. Capture prompt — when it appears and disappears

#### CAP-01 · The prompt is raised by a save that produced a history row
The prompt is driven by the in-memory event `progressStore.lastSessionEnded = { bookId, historyRowId, sessionStartAt }`. That event is emitted **only** when an online `updateProgress` succeeded **and** the `progress_history` insert returned an id. It therefore fires for session-end saves and also for untimed pencil edits, backward corrections and the completing save.
- **Enforced:** `client` (`src/stores/progress.ts`).
- **Source:** `src/stores/progress.ts:562-614`.
- **Target:** the prompt keys off the history row written by the atomic `save_progress` RPC. Its response must expose that history row id so that the capture or the note attaches to it (D-06 · BC-04). Which saves should prompt at all is CAP-Q01.

#### CAP-02 · No history row, no prompt
No prompt is raised for:
- **offline saves:** queued in IndexedDB; the replay calls `syncToSupabase` only and never inserts history;
- **initial status and CSV import progress:** `setInitialProgress` and the import upsert bypass history;
- **DNF / resume-from-DNF writes;**
- **a failed history insert:** swallowed silently.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:81-84,419-466,581-583,656-664`.
- **Target:** offline replays will write history rows at their original time, timed when they end a session that is open on the server (D-08 · BC-04). The prompt stays a foreground-save UI event, so replays raise no prompt. Neither does the recommended BC-04 baseline row for a book added mid-way.

#### CAP-03 · The Dashboard hero shows a pending prompt for its own book
The hero watches the event with `immediate: true`. It renders the prompt only when `event.bookId === hero.book.id`. Switching the hero book hides the prompt. Switching back re-shows it while the event is still pending.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:76-97,299-311`.

#### CAP-04 · Book Detail shows only events raised while it is mounted, and hides them only for DNF
Book Detail watches **without** `immediate`, so only events emitted while the page is mounted are shown. It hides the prompt when the book is DNF (`v-if="!isDnf && …"`). It does **not** hide it for a completed book ⚠ CAP-D06. The watcher asymmetry with CAP-03 is ⚠ CAP-D16.
- **Enforced:** `client`.
- **Source:** `src/pages/BookDetailPage.vue:48-68,292-299`.

#### CAP-05 · Event lifetime and consumption
The event is consumed (`consumeSessionEnded()` → `null`) **only** when the prompt emits `saved` or `skipped`. Until then it stays in memory for the app's lifetime and re-surfaces on the hero (CAP-03). The event lives in a **single slot**: the next history-producing save for any book overwrites it (SES-88). It is lost on any page reload, including the service-worker update reload. It is never cleared on sign-out; there it is inert, because the next user has different book ids.
- **Enforced:** `client`.
- **Source:**
  - `src/stores/progress.ts:40,701-704`;
  - `HeroBookCard.vue:136-142` (the hero also refetches the last session after consuming);
  - `BookDetailPage.vue:63-68` (consume only).

#### CAP-06 · One prompt per event
After `saved` or `skipped`, the reader cannot capture again until the next history-producing save. Capture, note and skip are mutually exclusive per event: whichever emits first consumes it.
- **Enforced:** `client`.
- **Source:** `src/components/session/SessionCaptureField.vue:139,205-216`.

#### CAP-06a · Leaving mid-flow loses the consume
OCR and auto-save are **not cancelled** when `SessionCaptureField` unmounts (route change, or a hero swap — the hero is keyed `hero-${book.id}`). The pending `runOcr` → `finishCapture` → `handleSave` still runs, the capture **is saved**, and the glass toast still flips to "Page captured". However, `emit('saved')` is a no-op on an unmounted instance, so the event is **not consumed** and the prompt re-appears on the hero.

A **low-confidence** result in the same situation is silently lost: the "Check the captured text" warning shows, but no review UI exists any more. ⚠ CAP-D23
- **Enforced:** `client`.
- **Source:**
  - `SessionCaptureField.vue:111-126,158-189`;
  - `src/composables/useCapture.ts:240-243`;
  - `src/composables/useGlassToast.ts:15-59` (module singleton; survives navigation);
  - Vue 3.5 `emit()` returns early when `instance.isUnmounted`;
  - `src/pages/DashboardPage.vue:370-373`.

#### CAP-06b · Note fallback ("Add note instead")
**Field:**
- label "Where did you leave off?";
- placeholder "e.g. Just as the group reaches the mountain pass…";
- `maxlength` 160;
- the counter is shown at ≥ 140 chars and turns warning-styled at ≤ 10 remaining;
- "Save note" stays disabled until the text is non-blank.

**Save:**
- writes the **trimmed** note with `UPDATE progress_history SET session_note WHERE id = historyRowId AND user_id = uid`;
- errors are only `console.error`'d, and `saved` is still emitted, so the event is consumed even on failure ⚠ CAP-D27;
- the note can be written only for the row just created and cannot be edited later (SES-35).
- **Enforced:** `client` (trim, non-blank, maxlength); `server:db` `progress_history_session_note_check` (`char_length(session_note) <= 160`).
- **Source:** `src/components/session/SessionNoteField.vue:21-37,53-61`; `src/stores/progress.ts:471-484`.

### B. Camera path

#### CAP-07 · Camera pre-checks
1. Offline (`navigator.onLine === false`) → state `offline`; the camera is never opened.
2. `navigator.mediaDevices.getUserMedia` missing → state `denied`, with `errorMessage` "Camera not supported on this device". The denied panel ignores that message and shows the generic denial copy ⚠ CAP-D15.
- **Enforced:** `client`.
- **Source:** `src/composables/useCapture.ts:70-80`; `SessionCaptureField.vue:336-357`.

#### CAP-08 · Camera constraints
`getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 99999 }, height: { ideal: 99999 } }, audio: false })`. This prefers the rear camera at the highest resolution the device offers.
- **Enforced:** `client`.
- **Source:** `useCapture.ts:83-90`.

#### CAP-09 · Camera error mapping
- `NotAllowedError` / `PermissionDeniedError` → `denied`.
- Any other error → `error`, with the exception message (fallback "Could not start camera").
- **Enforced:** `client`.
- **Source:** `useCapture.ts:95-103`.

#### CAP-10 · Snap
1. A snap is ignored while an OCR is in flight, or when there is no stream or video element (double-tap guard).
2. It re-checks connectivity: offline → `offline`, and the stream is released.
3. The frame is drawn to a canvas at the **native video resolution** (`videoWidth × videoHeight`, fallback 1280 × 960) and encoded as `image/jpeg` at quality **0.92**.
4. There is **no downscaling and no client size check** ⚠ CAP-D11.
5. The stream is released right after encoding, before the OCR call.
- **Enforced:** `client`.
- **Source:** `useCapture.ts:151-188`.

#### CAP-11 · Camera overlay behaviour
The overlay locks body scroll and restores it on unmount. The `<video>` element is `autoplay playsinline muted`.
- **Enforced:** `client`.
- **Source:** `src/components/capture/CaptureCameraView.vue:21-44`.

#### CAP-12 · Camera "Cancel" means Skip
"Cancel" emits `skipped`, which consumes the event.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:293-298`.

#### CAP-12a · Frame failure, and Back while the camera is open
If `canvas.getContext('2d')` returns `null` at snap time, the state becomes `error` with "Could not capture frame", and the stream is released. The camera overlay has **no** `popstate` handling: browser or OS Back navigates away from the page. Unmount then releases the stream, and the event stays pending (not consumed).
- **Enforced:** `client`.
- **Source:** `useCapture.ts:164-174,240-243`; `CaptureCameraView.vue:21-31`.

### C. Upload path and normalisation

#### CAP-13 · Upload accepts any `image/*`
The file input's value is reset after each pick, so the same file can be picked again.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:57-66,234-241`.

#### CAP-14 · Upload offline pre-check
Offline → state `offline`. No normalisation and no OCR call happen.
- **Enforced:** `client`.
- **Source:** `useCapture.ts:195-201`.

#### CAP-15 · Upload normalisation
1. Decode via `<img>` and an object URL.
2. Scale by `min(1, 2000 / max(w, h))`, so the long edge is ≤ **2000 px** and the image is never upscaled. Each side becomes `max(1, round(side × scale))`.
3. Re-encode as **`image/jpeg` quality 0.85**.
4. Return base64 without the `data:` prefix.
- **Enforced:** `client`.
- **Source:** `src/utils/imageNormalize.ts:7-8,35-55`.

#### CAP-16 · Decode failure
A file that is not an image, or a format the browser cannot decode (e.g. **HEIC** outside Safari), leads to:
- state `error`, with "That file couldn't be read as an image. Try a different screenshot.";
- an error toast "Couldn't read that image".

⚠ CAP-D20
- **Enforced:** `client`.
- **Source:** `useCapture.ts:207-216`; `SessionCaptureField.vue:70-79`.
- **Note:** spec 033 promised transparent HEIC conversion; the shipped code does not do it.

#### CAP-16a · The web always sends JPEG and has no client size check
Both web paths send `mimeType: 'image/jpeg'`: the camera via `toDataURL('image/jpeg')`, and uploads because they are re-encoded. The server's `image/png` allowance is never used by the web client. Uploads have no client size pre-check; normalisation (CAP-15) is what keeps them under the 5 MiB server cap.
- **Enforced:** `client`.
- **Source:** `useCapture.ts:177-184`; `imageNormalize.ts:52-54`.

#### CAP-90 · Page images are transient
The image exists only in component memory (`previewImage` data URL). It is dropped on cancel, unmount or error. `ocr-page` never persists it, and no Storage path exists for captures. Only the extracted text is stored.
- **Enforced:** `client` + `server:edge` (`ocr-page`).
- **Source:**
  - `useCapture.ts:60-64,143,240-243`;
  - `supabase/functions/ocr-page/index.ts`;
  - spec 015 FR-015a and 033 FR-006 (intent, honoured).

### D. OCR call and the `ocr-page` contract

#### CAP-17 · OCR request (web client)
The web client sends a raw `fetch` POST to `${VITE_SUPABASE_URL}/functions/v1/ocr-page`:
- headers: `Authorization: Bearer <access_token>` and `Content-Type: application/json` only — **no `apikey` header**;
- body: `{ imageBase64, mimeType }`.

With no session it fails with "Not authenticated".
- **Enforced:** `client`.
- **Source:** `useCapture.ts:37,110-124`.
- **Target:** `ocr-page` moves behind real JWT verification (CAP-81). The PWA keeps working unchanged because it already sends the user's JWT (D-05 · BC-02).

#### CAP-18 · OCR error surfacing (client)
For a non-2xx response:
- the message is the response JSON's `message` ?? `error` ?? `"OCR failed (HTTP <status>)"`;
- the state becomes `error` and the preview is cleared;
- a 4 s toast shows — "OCR failed" (camera) or "Couldn't read that image" (upload) — alongside the inline error panel.
- **Enforced:** `client`.
- **Source:** `useCapture.ts:126-144`; `SessionCaptureField.vue:70-79,115-124`.

#### CAP-19 · OCR success is trusted; there is no client timeout
A 2xx body is taken as `{ text, confidence, wordCount }` and the state moves to `verify`. There is **no client-side timeout** on the fetch; the server enforces 10 s (CAP-84) ⚠ CAP-D24.
- **Enforced:** `client`.
- **Source:** `useCapture.ts:137-139`.

#### CAP-81 · `ocr-page` authentication only decodes the token
`ocr-page` is deployed with `verify_jwt: false`. `manualJwtDecode` strips `Bearer `, splits the token, runs `atob(parts[1])` and requires a string `sub`. Consequences:
- the signature, `exp`, `aud` and `role` are **never checked**, so forged and expired tokens are accepted;
- `atob` runs without base64url→base64 normalisation, so a genuine token whose payload contains `-` or `_` gets a spurious 401.

The 401 body is `{error:"Unauthorized", message:"Missing or invalid JWT"}`. ⚠ CAP-D01
- **Enforced:** `server:edge` (`ocr-page`).
- **Source:** `supabase/functions/ocr-page/index.ts:24-35,148-152`; deployed v2 (`verify_jwt: false`).
- **Target:** `verify_jwt = true` (or real `supabase.auth.getUser` verification), the hand-rolled decode is removed, and the per-function setting is committed in `supabase/config.toml` (BC-02).

#### CAP-82 · `ocr-page` request validation
**Check order:**
1. `OPTIONS` → CORS reply.
2. Auth (CAP-81).
3. JSON body → 400 `{error:"InvalidRequest", message:"Body must be JSON"}`.
4. `imageBase64` non-empty string → 400 "imageBase64 missing or invalid".
5. `mimeType ∈ {image/jpeg, image/png}` → 400 "mimeType must be image/jpeg or image/png".
6. Decoded size `floor(len × 3/4) − padding ≤ 5 MiB` → 400 "Image exceeds 5 MB limit".
7. `GEMINI_API_KEY` present → 503 `{error:"AiUnavailable", message:"AI service not configured"}`.
8. Model call.

**Notes:**
- There is no HTTP-method check: a `GET` falls through to 400 "Body must be JSON".
- The size is computed from the base64 string, so clients must send raw base64, never a `data:` URL.
- **Enforced:** `server:edge`.
- **Source:** `ocr-page/index.ts:38-40,140-180`.

#### CAP-83 · Extraction prompt and what confidence means
**Model call:** `gemini-2.5-flash` with parts `[inlineData{mimeType,data}, OCR_PROMPT]`, `temperature 0.1`, `maxOutputTokens 8192`, `thinkingBudget 0`.

**The prompt asks the model to:**
- extract all visible text;
- keep paragraph breaks as `\n\n` and line breaks as `\n`;
- **exclude** printed page numbers, headers and footers (chapter and running titles), footnote markers, and ornaments or page-break symbols;
- answer with JSON `{text, confidence, notes}`.

**Confidence bands in the prompt:**

| Band | Meaning |
|---|---|
| 0.95–1.00 | clean |
| 0.70–0.94 | minor uncertainty |
| 0.40–0.69 | review carefully |
| 0.00–0.39 | retake |

**How confidence is handled:** `confidence` is the **model's self-rating**, clamped to [0, 1]. A missing or non-numeric value becomes 0, and a missing `text` becomes `""`. `notes` is discarded.

**Parsing:** strip markdown fences, or extract the first `{…}`; non-JSON throws (see CAP-84).

**SDK:** the function imports `npm:@google/genai` unpinned, as do `generate-page-resume` and `generate-book-quiz` ⚠ CAP-D31.
- **Enforced:** `server:edge`.
- **Source:** `ocr-page/index.ts:43-63,78-122`; deployed v2.
- **Target:**
  - the deployed v2 prompt text is canonical; the repo copy differs only in comments and punctuation and must be synced to it (D-09 · BC-03);
  - on iOS, Apple Vision runs first and `ocr-page` becomes the fallback, so these bands describe Gemini output only (D-15).

#### CAP-84 · `ocr-page` retry, timeout and error mapping
**Retry and timeout:**
- After **any** first-attempt error (empty response, non-JSON, SDK/HTTP 4xx such as quota or safety), the function retries **once**.
- Both attempts share a single **10 s** race timer. The timer is never cleared, and the losing Gemini call is not aborted ⚠ CAP-D19.

**Error mapping:**

| Condition | Status | Body |
|---|---|---|
| Error text contains "timed out" | 504 | `{error:"OcrTimeout", message:"OCR took too long; please try again"}` |
| Any other failure after the retry | 502 | `{error:"OcrUpstream", message:"Gemini call failed after retry"}` |
| Unexpected exception | 500 | `{error:"InternalError", message:"Unexpected error"}` — no internal text |
- **Enforced:** `server:edge`.
- **Source:** `ocr-page/index.ts:125-137,182-212`.
- **Note:** this differs from spec 015's `contracts/ocr-page.md`, which says there is no retry on 4xx and a 401 for expired tokens.

#### CAP-85 · `ocr-page` success response
200 with `{ "text": string, "confidence": number, "wordCount": number }`, where `wordCount = text.split(/\s+/).filter(Boolean).length` on the untrimmed text. CORS is `*`.

The response can be a **soft success**: a model reply without `text` still returns 200 with `text: ""` and `confidence: 0`. Such a reply cannot be saved (the DB requires ≥ 1 char), so clients must route it to manual review (CAP-21).
- **Enforced:** `server:edge`.
- **Source:** `ocr-page/index.ts:118-122,198-212`.

### E. Save decision: auto-save or review

#### CAP-20 · Auto-save for high confidence
After OCR, `text = ocrResult.text.slice(0, 10000).trim()`. If `confidence >= 0.90` **and** `text` is non-empty, the capture is **auto-saved** with no review UI. The glass toast shows "Page captured" / "Text analysed successfully.".
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:86-90,158-182`.
- **Target:** on iOS, recognition runs on device with Apple Vision first, and `ocr-page` is called only when Vision's confidence is low. The 0.90 auto-save threshold is calibrated for Gemini's self-rating and applies to `ocr-page` results only. A recalibrated Vision rule must be fixed before launch (D-15; see CAP-Q07).

#### CAP-21 · Otherwise the review opens
When confidence < 0.90 or the text is empty, the review viewport opens. A warning toast shows "Check the captured text" / "The scan wasn't clear — review the text or retake the photo.".
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:184-189`.

#### CAP-22 · A failed auto-save falls back to review
If the auto-save upsert fails, an error toast "Could not save capture" (with the error detail, 4 s) fires and the review viewport opens.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:141-149,170-177`.

#### CAP-22a · A save confirmed from the review shows no success toast
Only the auto-save path shows "Page captured". The earlier warning toast may still be on screen (6 s life). On success the prompt simply closes (`emit('saved')`).
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:128-150,172-173`; `useGlassToast.ts:44-51`.

#### CAP-23 · Review text editing
- The textarea is pre-filled with `initialText.slice(0, 10000)` (`maxlength=10000`).
- The counter shows the remaining characters and turns warning-styled at ≤ 200 remaining.
- "Use Capture" is enabled only when `text.trim().length > 0` and the length is ≤ 10 000.
- The saved text is the **trimmed, edited** text.
- **Enforced:** `client`.
- **Source:** `src/components/capture/CaptureReviewViewport.vue:20-34,95-121`.

#### CAP-24 · Low-confidence banner
"OCR confidence is low. Review the text before saving." shows if and only if `confidence < 0.70`. Results from 0.70 to 0.89 are reviewed without the banner.
- **Enforced:** `client`.
- **Source:** `CaptureReviewViewport.vue:21,28,82-88`.
- **Target:** the 0.70 threshold is Gemini-calibrated and must be recalibrated for Apple Vision on iOS (D-15; see CAP-Q07).

#### CAP-25 · Typed text is still stored as OCR
A reader can type text into an empty OCR result and save it. It is stored with the OCR confidence (possibly 0) and `source='ocr'`.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:128-138`; `src/stores/captures.ts:94`.

#### CAP-26 · Review actions
**Retake / Re-upload:**
- The label is "Re-upload" when the capture came from an upload, otherwise "Retake".
- Retake re-opens the camera (`retake()` → state `camera`); Re-upload re-opens the file picker.
- Browser Back (`popstate`) during review behaves like Retake.
- The review pushes a history entry on mount and never pops it ⚠ CAP-D12.

**Close (X):** calls `cancel()` and returns to the idle method picker. The OCR text is discarded and the event is **not** consumed. This is the only way back to "Add note instead" or "Skip" from the review. Spec 027 asked for "exactly two" actions (CAP-Q14).

There is no in-flight guard on "Use Capture" ⚠ CAP-D13.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:53-55,191-203,307-316`; `CaptureReviewViewport.vue:31-71`.

#### CAP-27 · The error panel's "Try again" always reopens the camera
The inline error panel's "Try again" always calls `retake()`, which opens the camera, even when the failed capture was an upload ⚠ CAP-D14.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:384-389`.

#### CAP-27a · Re-upload keeps the review open until a new file is picked
"Re-upload", and Back on an upload-sourced review, only calls `fileInput.click()`. The state stays `verify`, so the review stays open until a new file is actually picked; `handleUploadChange` then sets `showReview=false`. Cancelling the OS picker leaves the reader on the same review.

When Re-upload is triggered from `popstate` there is no user activation, so the browser may block the programmatic picker. Back would then do nothing visible except consume the pushed history entry. [UNVERIFIED: browser user-activation policy; not exercised]
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:57-81,191-198`; `CaptureReviewViewport.vue:44-52`.

### F. Persisted capture

#### CAP-28 · Page number comes from progress, never from OCR
The page is the client's `progressStore.progressForBook(bookId).currentPage` at save time, defaulting to 0. OCR never supplies it, and the DB cannot validate it.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:101-103,132-135`; DB comment on `page_captures`.

#### CAP-29 · Word count is recomputed from the final text
`word_count = text.split(/\s+/).filter(Boolean).length`. The OCR `wordCount` is ignored.
- **Enforced:** `client`.
- **Source:** `SessionCaptureField.vue:131`.

#### CAP-30 · One capture per page (upsert)
The write is a PostgREST **upsert** with `onConflict: 'user_id,book_id,page'`. It sends `user_id, book_id, page, text, word_count, confidence, source:'ocr'` and returns the full row. A re-capture overwrites `text`, `word_count`, `confidence` and `source` only.
- **Enforced:** `client` payload; `server:db` `page_captures_user_id_book_id_page_key`.
- **Source:** `src/stores/captures.ts:77-101`.

#### CAP-31 · A re-capture keeps the old row
The upsert payload omits `captured_at`, `resume` and `resume_generated_at`. A re-capture therefore keeps the same row `id`, the original `captured_at` and the **old `resume`**, which is now stale relative to the new text ⚠ CAP-D04.
- **Enforced:** `client` (payload shape).
- **Source:** `captures.ts:86-95`; BE-24a.

#### CAP-32 · Database constraints on `page_captures`

| Column | Constraint |
|---|---|
| `text` | 1..10 000 chars (`char_length`) |
| `word_count` | ≥ 0 |
| `confidence` | `numeric(3,2)` in [0, 1] — stored rounded to 2 decimals |
| `page` | ≥ 0 |
| `source` | ∈ {`ocr`, `manual`, `import`} — only `ocr` is ever written ⚠ CAP-D18 |
- **Enforced:** `server:db` `page_captures_text_check`, `_word_count_check`, `_confidence_check`, `_page_check`, `_source_check`.
- **Source:** live constraints.

#### CAP-32a · Text-length counting and whitespace
**Length counting differs between client and DB:**
- The client caps with JS `String.length` (UTF-16 code units); Postgres `char_length` counts code points.
- The client cap is therefore equal or stricter and never trips the CHECK.
- `slice(0, 10000)` can split a surrogate pair.

**Whitespace-only text:** the CHECK is `char_length(text) > 0`, so the DB **accepts whitespace-only text**. The non-blank rule is client-only. Live data currently has 0 whitespace-only rows. ⚠ CAP-D32

**Page 0:** captures at page 0 are legal (a prompt after saving page 0).
- **Enforced:** `client` (non-blank); `server:db` (length only).
- **Source:** `SessionCaptureField.vue:167`; `CaptureReviewViewport.vue:29-33`; `page_captures_text_check`.

#### CAP-33 · Upload origin is not recorded
`source` is `'ocr'` for both camera and upload captures (CAP-Q09).
- **Enforced:** `client`.
- **Source:** `captures.ts:94`.

#### CAP-34 · Local cache patch after a save
After a save, the store:
- patches the per-book list (replaces the same page or appends, then sorts by page ascending);
- marks the book as loaded;
- invalidates the `readingQuest:<uid>` SWR prefix.
- **Enforced:** `client`.
- **Source:** `captures.ts:103-113`.

#### CAP-35 · Row-level security on `page_captures`
Owner-only SELECT / INSERT / UPDATE / DELETE: role `public`, predicate `auth.uid() = user_id` (evaluated per row). Default grants give `anon` / `authenticated` full DML, so RLS is the only guard ⚠ CAP-D22.
- **Enforced:** `server:db` policies `page_captures_select_own`, `_insert_own`, `_update_own`, `_delete_own`.
- **Source:** live `pg_policies`.
- **Target:** the policies use `(select auth.uid())` (initplan advisory) and also check book ownership (BC-01; see CAP-89).

#### CAP-89 · Child-table RLS does not check book ownership
The owner policies on `page_captures` and `book_quizzes` check only `user_id = auth.uid()`. A signed-in client can therefore insert a capture or quiz row whose `book_id` belongs to another user; the FK only checks that the book exists. The completion purge never fires for such a row, because the trigger joins `books` on `id` **and** `user_id`. ⚠ CAP-D25
- **Enforced:** not enforced (`server:db` gap).
- **Source:** live policies; BE-02. [Logic read from the live definitions; not exercised.]
- **Target:** RLS on child tables checks that `book_id` belongs to the caller (BC-01).

### G. Capture side effects and XP

#### CAP-36 · Vocabulary extraction after every save
After every successful `saveCapture`, vocabulary extraction fires fire-and-forget with `{captureId, bookId, page, ocrText}`. A failure never affects the capture. It is idempotent per `capture_id` (the ledger is unique on it), so a re-capture of the same page (same id, CAP-31) **never re-extracts** ⚠ CAP-D04. The pipeline itself is LEX-84…LEX-91.
- **Enforced:** `client`; `server:db` `vocabulary_extractions_capture_id_key`.
- **Source:** `captures.ts:115-130`; `src/composables/useVocabularyExtraction.ts:58-76`.
- **Note:** the extraction always fails in these cases:
  - **Page 0:** `lexicon_entries_page_found_check` requires `page_found ≥ 1`, so the ledger ends `failed` (BE-25).
  - **Capture on a completed book:** the row is already deleted, so the ledger insert fails with FK 23503 and is only logged (CAP-43).

#### CAP-37 · Resume generation after every save
After every successful save, `triggerResumeGeneration(mapped)` fires fire-and-forget. All errors are swallowed (`console.warn`).
- **Enforced:** `client`.
- **Source:** `captures.ts:132-140`; `src/composables/usePageResume.ts:63-70`.

#### CAP-37a · The capture-time resume uses only the recaps already loaded
At capture time, `recapContext` comes from whatever is **already in the recaps store** (`latestRecapForBook`); nothing is fetched. If the book's recaps were never loaded in this app session (e.g. a capture from the Dashboard hero), the resume is generated **without** memory-jogger name context. The Start-time backfill loads recaps first (CAP-55).
- **Enforced:** `client`.
- **Source:** `usePageResume.ts:28-47`.

#### CAP-37b · Writing the resume re-fires the capture trigger
The client's `UPDATE page_captures SET resume…` re-fires `page_capture_quest_event_after_save` (AFTER UPDATE, no column filter):
- the quest-event upsert is a no-op because of the dedupe;
- the completion check runs again, so writing a resume on a book that is already complete deletes **all** of that book's captures.
- **Enforced:** `server:db`.
- **Source:** live trigger `page_capture_quest_event_after_save`; BE-21.

#### CAP-38 · One XP event per unique page, ever
Trigger `page_capture_quest_event_after_save` (AFTER INSERT OR UPDATE, FOR EACH ROW, SECURITY DEFINER) inserts `reading_quest_events(user_id, book_id, 'page_capture', page, source_id = capture.id, occurred_at = captured_at)`.

On a conflict with the partial unique index `(user_id, book_id, page) WHERE event_type='page_capture' AND book_id IS NOT NULL AND page IS NOT NULL`, it keeps the first `source_id` and the **earliest** `occurred_at`. Re-captures and resume updates therefore add nothing.
- **Enforced:** `server:db` `record_page_capture_quest_event`, index `reading_quest_events_page_capture_unique_idx`.
- **Source:** live function definition.

#### CAP-39 · Capture XP and badges
`get_reading_quest_summary` computes:

`total_xp = pages_read + 25·completed_books + 10·reading_sessions + 5·page_captures + 20·recaps_generated + 15·lore_cards_unlocked`

Here `page_captures = count(reading_quest_events WHERE event_type='page_capture')`. That count is **lifetime** (not year-scoped), not filtered by book source, and survives both capture deletion and book deletion (`book_id` → NULL).

Badges: "Chronicler" (`capture_first`) at pageCaptures ≥ 1; "Archivist" (`captures_50`) at ≥ 50. The RPC's identity guard is NULL-unsafe, so an anon caller can read any user's counts ⚠ CAP-D03.
- **Enforced:** `server:rpc` `get_reading_quest_summary` (XP); `client` (badges, `src/utils/achievements.ts:82-95`).
- **Source:** live RPC definition; PRO-01 / PRO-05.
- **Target:**
  - **NULL-safe guard:** `auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()` → raise, and anon / PUBLIC `EXECUTE` is revoked (BC-01).
  - **Badges:** evaluated server-side with a server-authoritative `earned_at` (BC-09).
  - **XP:** capture XP stays lifetime, so BC-06 time zones do not affect it.

#### CAP-40 · Clients never write quest events
`reading_quest_events` has a **SELECT-only** owner policy. Its rows are written exclusively by the SECURITY DEFINER trigger.
- **Enforced:** `server:db` policy "Reading quest events are viewable by owner" (role `authenticated`).
- **Source:** live `pg_policies`.

#### CAP-88 · No quota, entitlement or idempotency on this domain's AI calls
`ocr-page`, `generate-page-resume`, `generate-book-quiz` and `extract-vocabulary` have **no** rate limit, entitlement check or idempotency key. Every client retry is billed again. Soft failures (resume `null`, quiz `null`) persist nothing, so the next trigger calls the model again.
- **Enforced:** none.
- **Source:** grep over `supabase/functions/**` (no quota or entitlement code).
- **Target:** one shared entitlement and `ai_usage` check in every AI edge function, allowing everything until tiers are decided (D-14 · BC-12).

### H. Retention, completion purge and cascades

#### CAP-41 · No per-book retention cap
`prune_page_captures_for_book(p_user_id, p_book_id, p_keep default 5)` would keep only the newest captures (`captured_at desc, page desc, id desc`). It is called only by `after_page_capture_saved()`, and that function is **attached to no trigger**; migration `20260513` dropped `page_capture_retention_after_save`. Captures therefore accumulate until completion; live aggregates show books with more than 5 captures (maximum 22).

Both functions are absent from the repo migrations. `prune_page_captures_for_book` is SECURITY DEFINER with **no `auth.uid()` check**, and `EXECUTE` is granted to PUBLIC, `anon` and `authenticated` ⚠ CAP-D02.
- **Enforced:** `server:db` (absence of a trigger).
- **Source:** live `pg_trigger`, `proacl`; `supabase/migrations/20260513_page_capture_completion_cleanup.sql:153-157`.
- **Target:** `after_page_capture_saved` is dropped and `prune_page_captures_for_book` is dropped or locked (BC-01). Keeping captures until completion stays the behaviour.

#### CAP-42 · Completion purge from the progress side
Triggers `page_captures_delete_on_completion` and `book_quizzes_delete_on_completion` run AFTER INSERT OR UPDATE **OF current_page** ON `reading_progress`, FOR EACH ROW. When `books.total_pages > 0 AND NEW.current_page >= total_pages`, they delete all of the user's `page_captures` and `book_quizzes` for that book. The book row is matched on `id` **and** `user_id`.

"UPDATE OF current_page" fires whenever `current_page` is in the SET list, even if the value is unchanged.

| Fires on | Does not fire on |
|---|---|
| `updateProgress` / `syncToSupabase`, including the **offline-queue replay** (an offline completion purges at sync time) | `clearSession` |
| `startSession` | pause / resume |
| `markDnf` | `resumeDnf` |
| `setInitialProgress` | |
| CSV-import inserts | |
- **Enforced:** `server:db` `delete_page_captures_on_book_completion`, `delete_book_quizzes_on_book_completion`.
- **Source:** live trigger and function definitions; `src/stores/progress.ts:52-63,284-298,351-368,425-444`.
- **Target:** the purge stays server-owned in these triggers. It runs identically for the new `save_progress` / session RPCs and for replays, whatever the client (D-06 · BC-04 · BC-05). Purge timing relative to the other completion jobs is CAP-Q03; the BC-05 plan proposes moving the purge to the end of the completion pipeline (at most 24 h after completion) behind a flag.

#### CAP-43 · Completion purge from the capture side
`record_page_capture_quest_event` first inserts the quest event. It then deletes **all** captures of the book, including the one just written, when `total_pages > 0 AND coalesce(current_page, 0) >= total_pages`. The lookup is an **inner join** `books ⋈ reading_progress` on `(id, user_id)`, so nothing is purged when there is no progress row.

The effect for a capture saved on an already-complete book:
1. The client receives the row (RETURNING).
2. It shows success.
3. The row earns its **+5 XP event** and then vanishes.
4. The follow-up vocabulary insert fails with FK 23503, and the resume UPDATE matches 0 rows.

⚠ CAP-D06
- **Enforced:** `server:db` `record_page_capture_quest_event`.
- **Source:** live function definition (verified 2026-10-18).
- **Note:** the RETURNING-then-delete ordering is inferred from PostgreSQL AFTER-ROW trigger semantics and was not exercised. This rule supersedes any earlier claim that such a capture "survives" the completion cleanup (SES-37, SES-D13 agree).

#### CAP-44 · Completion can be undone; the purge cannot
The page pencil is hidden for complete books. However, the Library "Edit Book" dialog can raise `total_pages` (`BookEditDialog` → `books.updateBook`), which makes `current_page < total_pages` again and re-opens sessions and capture. CSV-import enrichment can also raise `total_pages` for `page_count_estimated` books.

Captures and quizzes purged at completion are **gone for good** (no undo), while their XP events remain.
- **Enforced:** `server:db` (the triggers only delete).
- **Source:**
  - `src/components/books/BookEditDialog.vue:21-31`;
  - `src/stores/books.ts:376-411`;
  - `src/components/book/BookProgressPanel.vue:75-83`;
  - `src/composables/useLibraryImport.ts:70-72`;
  - BE-23.
- **Target:** BC-04 stamps a first-completion `reading_progress.completed_at`. Whether the purge should be deferred is CAP-Q03.

#### CAP-45 · Book and account deletion
**Book delete:**
- cascades `page_captures`, `book_quizzes` and `vocabulary_extractions` (`ON DELETE CASCADE`);
- sets `reading_quest_events.book_id` to NULL, so the XP is kept.

A detached event leaves the partial unique index, so re-adding the same title (a new `books.id`) can earn capture XP for the same pages again. When a capture is deleted, `vocabulary_extractions.capture_id` becomes NULL and the ledger survives.

**Account delete:** everything cascades through the `auth.users` FKs.
- **Enforced:** `server:db` FKs `page_captures_book_id_fkey`, `book_quizzes_book_id_fkey`, `reading_quest_events_book_id_fkey` (SET NULL), `vocabulary_extractions_capture_id_fkey` (SET NULL), and the `*_user_id_fkey` (CASCADE).
- **Source:** live `pg_constraint`.
- **Target:** account deletion becomes an in-app hard delete through the new `delete-account` edge function on web and iOS. FK cascades remove this domain's rows; there is no Storage to purge here, because images are never stored (CAP-90) (D-10 · BC-11).
- **Note:** AI jobs in flight when a book is deleted (resume, vocabulary) still bill. Their writes then fail (FK error) or match 0 rows.

#### CAP-46 · DNF purges nothing
DNF does **not** purge captures, resumes or quizzes. It hides the capture prompt, the Memory Check chip and dialog, and blocks session start.
- **Enforced:** `client` (hiding); `server:db` (no DNF trigger, BE-23a).
- **Source:** `BookDetailPage.vue:285-299`; `BookProgressPanel.vue:102-110,155`; `src/stores/progress.ts:280-282`.

#### CAP-47 · Lowering `total_pages` does not purge
Editing `books.total_pages` so that `current_page >= total_pages` does **not** purge until the next `reading_progress` write that touches `current_page`; there is no trigger on `books`. That write may never come: the book now reads as 100 %, so the pencil, Start Session, End Session and the DNF link are all hidden or blocked. Its captures, resumes and quiz then linger until the book is deleted or `total_pages` is raised again. ⚠ CAP-D26
- **Enforced:** `server:db` (absence of a trigger).
- **Source:** live trigger list; BE-11b.
- **Target:** completion effects become path-independent, so a completion caused by a `total_pages` edit runs the same purge. This needs a `books` trigger, or routing the edit through a server RPC (D-06 · BC-05).

### I. Session resume ("Previously")

#### CAP-48 · The resume is generated at capture time and shown at session start
The resume is generated **unconditionally at capture save** (CAP-37). Whether to show it is decided only at Start Session (CAP-52, CAP-58).
- **Enforced:** `client`.
- **Source:** `usePageResume.ts:21-25`.

#### CAP-49 · `generateResumeForCapture`
The function:
1. returns `null` when signed out;
2. returns the existing `capture.resume` without calling the AI when one is present;
3. returns `null` when `capture.text.trim()` is empty;
4. otherwise invokes `generate-page-resume` with `{ pageText: capture.text, recapContext: latestRecap.memoryJogger.trim() || undefined }`.
- **Enforced:** `client`.
- **Source:** `usePageResume.ts:28-47`.

#### CAP-50 · Only a resume with bullets is persisted
Only a response whose `bullets` is a non-empty array is persisted. The client runs `UPDATE page_captures SET resume = <json>, resume_generated_at = <client now> WHERE id = capture.id` (RLS-scoped), then patches its local cache. A `null` or invalid result persists nothing, and it is retried on the next Start (CAP-55).
- **Enforced:** `client`.
- **Source:** `usePageResume.ts:50-60`; `captures.ts:151-157`.

#### CAP-51 · "Latest capture" means the highest page
The dialog uses the capture with the **highest page number** (the list is sorted by page ascending, so the last entry), not the most recently captured one. After a backward correction this can be a page beyond the reader's position ⚠ CAP-D08. Only that single capture is ever considered: if it has no resume, lower-page resumes are not used.
- **Enforced:** `client`.
- **Source:** `src/composables/useSessionResume.ts:33-37,46-51`; `captures.ts:58,110`.

#### CAP-52 · A fresh recap suppresses the resume
There is no dialog, and no backfill AI call, when the latest recap (`recapsByBook[bookId][0]`, newest by `created_at`) has `pageSnapshot >= currentPage`. `currentPage` comes from local progress and defaults to 0. A recap from an earlier stretch never suppresses.

Because `currentPage` defaults to 0 when progress isn't loaded, **any** recap suppresses in that state. Clients must load progress before evaluating.
- **Enforced:** `client`.
- **Source:** `useSessionResume.ts:39-44`; `src/stores/recaps.ts:34-38,174-176`.

#### CAP-53 · Dialog content
- **Header:** "Previously" plus a pill "page {capture.page}".
- **Body:** the bullets list, then the tension paragraph only when it is non-empty.
- **Footer:** the hint "Your timer starts once you begin." and the button "Begin reading".
- **Dismiss** (mask click, X, Esc) aborts the session start.
- **Enforced:** `client`.
- **Source:** `src/components/session/SessionResumeDialog.vue:22-58`.

#### CAP-54 · The timer starts only on Begin / Skip
`session_start_at` is written only by `beginSession()` → `startSession()`, on "Begin reading" (resume or quiz) or "Skip to reading" (quiz). Dismissing either dialog writes nothing.
- **Enforced:** `client`.
- **Source:** `src/components/session/SessionStartButton.vue:51-60,103-106,197-211`.
- **Target:** the write becomes the `start_session` RPC on the server clock, and is still called only on Begin / Skip (D-06 · BC-04).

#### CAP-55 · The resume is backfilled at Start
1. At Start, captures and recaps are loaded (both errors swallowed).
2. If the resume is not suppressed and the latest capture has no resume, `generateResumeForCapture` is **awaited** while the button shows its loading state; errors are swallowed.

A capture whose generation returns `resume: null` (e.g. an "insufficient" page) is retried on **every** Start click. So "at most one AI call per capture" holds only for successful generations ⚠ CAP-D07.
- **Enforced:** `client`.
- **Source:** `useSessionResume.ts:53-66`.

#### CAP-55a · A slow backfill blocks Start
`supabase.functions.invoke` has no client timeout, and `generate-page-resume` has no server timeout or retry. A slow Gemini call keeps the Start button loading for as long as the function runs, up to the platform wall-clock limit ⚠ CAP-D24.
- **Enforced:** `client`.
- **Source:** `useSessionResume.ts:61-66`; `supabase/functions/generate-page-resume/index.ts:127-138`.

#### CAP-56 · Resume or nothing
If `view` is `null` after `load()`, the session starts immediately with no dialog.
- **Enforced:** `client`.
- **Source:** `SessionStartButton.vue:85-100`.

#### CAP-57 · Resume shape
`{ bullets: string[] (1..3, each trimmed, ≤ 240 chars), tension: string (≤ 240 chars, may be "") }`, normalised by the server. One legacy live row also carries a `characters` key, which no client reads. The live column comment and migration `20260713` still describe that key ⚠ CAP-D21.
- **Enforced:** `server:edge` (`generate-page-resume`).
- **Source:** `generate-page-resume/index.ts:70-81`; live jsonb key census.

#### CAP-86 · `generate-page-resume` contract
**Auth:** deployed v3 with `verify_jwt: true`; the gateway verifies the signature and expiry. In-function, the token is decoded with base64url normalisation and only `sub` is checked.

**Errors:**

| Condition | Status | Body |
|---|---|---|
| Non-POST | 405 | — |
| No `sub` | 401 | `{error:"unauthorized"}` |
| Bad JSON, blank `pageText`, or `recapContext` neither `undefined` nor a string (a JSON `null` fails) | 400 | `{error:"invalid_input"}` |
| Missing key, model error, unparsable reply, or `{insufficient:true}` | **200** | `{resume: null}` (soft failure) |

**Model call:** `pageText` is trimmed and capped at 12 000 chars, `recapContext` at 800. Model `gemini-2.5-flash`, `temperature 0.3`, `maxOutputTokens 512`, `thinkingBudget 0`.

**System instruction:**
- persona "The Chronicler";
- use ONLY the page text, with the prior recap used only for names;
- no predictions or foreshadowing;
- ≤ 3 one-sentence bullets in reading order, plus a one-sentence present-tense tension line;
- answer `{insufficient:true}` for short, garbled or non-narrative text.

**Parsing and output:** the JSON is taken from the first `{` to the last `}`. A 200 returns `{resume:{bullets, tension}|null}` and needs ≥ 1 non-empty bullet. There is no retry and no server timeout.
- **Enforced:** `server:edge`.
- **Source:** `generate-page-resume/index.ts:17-56,70-81,91-162`.
- **Target:** the function gets the BC-12 entitlement and `ai_usage` check (CAP-88).
- **Note:** the gateway's 401 body shape differs from the function's own. [UNVERIFIED: the gateway error body was not captured]

### J. Session-start orchestration

#### CAP-58 · Start Session click order
1. If a session is active → emit `cancelSession`; the confirmation happens upstream.
2. `bookQuiz.prepare()` loads captures, recaps, the last page-save time and the quiz row (all errors swallowed).
3. If `sessionPromptEligible` → open Memory Check in session mode, and stop.
4. Otherwise `sessionResume.load()`.
5. If a resume view exists → open the resume dialog.
6. Otherwise `beginSession()`.

The quiz takes the "Previously" slot **instead of** the resume. The `bookId` passed to the composables is not reactive ⚠ CAP-D17.
- **Enforced:** `client`.
- **Source:** `SessionStartButton.vue:62-101`.

#### CAP-59 · Start-session guards
The client refuses to start when:
- offline → "You appear to be offline. Start Session requires a connection.";
- `percentage >= 100` → "This book is already complete.";
- `dnfAt` is set → "This book is shelved as Did Not Finish. Resume it first.".

The errors are rendered under the button.
- **Enforced:** `client` only.
- **Source:** `src/composables/useReadingSession.ts:95-100`; `src/stores/progress.ts:276-282`; `SessionStartButton.vue:55-57,192-195`.
- **Target:** the `start_session` RPC enforces the same guards on the server clock (D-06 · BC-04).

#### CAP-60 · The start write
`startSession` upserts `reading_progress {current_page (unchanged), session_start_at: <client now>, session_paused_at: null}`. Because it includes `current_page`, it re-fires the completion triggers (CAP-42).
- **Enforced:** `client`.
- **Source:** `progress.ts:284-301`.
- **Target:** the `start_session` RPC on the server clock. It inserts `current_page = 0` only when no row exists and never touches an existing `current_page`, so starting a session no longer re-fires the completion triggers (D-06 · BC-04; SES-11, SES-87).

#### CAP-60a · Offline start: dialogs can open before the offline check
The offline check lives only in `startSession`, i.e. *after* `prepare()` and `load()`. Offline, those reads fail silently, but in-memory caches can still open the quiz intro or the resume dialog. The reader sees the offline message only after tapping Begin or Skip, under the button, with the dialog already closed. "Quiz me" offline ends at "Couldn't build a quiz this time." ⚠ CAP-D29
- **Enforced:** `client`.
- **Source:** `useReadingSession.ts:95-100`; `SessionStartButton.vue:51-60,193-195`.

#### CAP-60b · Double-tap guard on Start
The PrimeVue `Button` with `:loading="pending"` is disabled while `prepare()`, `load()` and `startSession()` run.
- **Enforced:** `client`.
- **Source:** `SessionStartButton.vue:180-189`.

### K. Memory Check — eligibility and generation

#### CAP-61 · "Away" means at least 48 h since the last page save
"Away" is `Date.now() − lastPageSavedAt[bookId] >= 2·24·60·60·1000`: a rolling **48 h**, independent of time zone.

**Where the anchor comes from:**
- `lastPageSavedAt` = the latest `progress_history.recorded_at` for the book.
- It is fetched once per book; the fetch is skipped when a value exists, when it already loaded (including "no row") or while it is loading, and an error leaves it unloaded.
- It is also set optimistically to "now" at the start of every `updateProgress`.
- A book with no history row is never "away".

**Two weaknesses:**
- The optimistic stamp is applied to **offline** saves too and never rolled back, even though no history row is written, so locally the away clock resets until reload ⚠ CAP-D30.
- `recorded_at` is the writing device's clock, so cross-device clock skew shifts the boundary.
- **Enforced:** `client`.
- **Source:** `src/composables/useBookQuiz.ts:28,60-73`; `src/stores/progress.ts:178-207,524-529,579,634-639`.
- **Target:**
  - `recorded_at` is stamped on the server clock (client time only for offline replays), and offline replays write history rows at their original time, so they count as page saves for the away clock (D-08 · BC-04).
  - Pencil edits keep resetting the clock unless CAP-Q01 changes which saves count.

#### CAP-62 · "Material" means at least one non-blank cached capture
- **Enforced:** `client`.
- **Source:** `useBookQuiz.ts:54-58`.

#### CAP-63 · A quiz "covers the position" while its snapshot ≥ the current page
"Covers position" = a cached quiz exists and `quiz.pageSnapshot >= currentPage`.
- **Enforced:** `client`.
- **Source:** `useBookQuiz.ts:49-52`.

#### CAP-64 · Session-start eligibility
Eligible = away ≥ 48 h **AND** material **AND NOT** a fresh recap (`latestRecap.pageSnapshot >= currentPage`) **AND NOT** a covering quiz **with** `answeredAt` set.
- **Enforced:** `client`.
- **Source:** `useBookQuiz.ts:77-92`.

#### CAP-65 · The session-mode intro
Session mode opens on an **intro**: "{It's been N days | It has been a little while} since page {currentPage}. A few quick questions before you dive back in?".
- N = `floor(ms / 86 400 000)`.
- "a little while" is used when N is `null` or < 2; N is `null` when there is no anchor or it lies in the future.

Buttons:
- "Skip to reading" — starts the session with no AI call;
- "Quiz me" — the only place the AI is called.
- **Enforced:** `client`.
- **Source:** `src/components/session/MemoryCheckDialog.vue:50-54,149-155,242-245`; `useBookQuiz.ts:62-67`.
- **Target:** whether "N days" should count calendar days in the reader's time zone (D-07) is CAP-Q11.

#### CAP-66 · On-demand mode bypasses every gate
On-demand mode skips the intro and starts loading as soon as it opens. It checks no eligibility: no 48 h rule, no recap suppression, no answered suppression.
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:78-89`.

#### CAP-66a · Chip visibility and interplay with sessions
The chip is visible whenever the book is not complete and not DNF — **including during an active session** and with zero captures. An on-demand quiz neither pauses nor affects the running timer.

A quiz generated or answered on demand stamps `page_snapshot` / `answered_at`, which then suppresses the session-start prompt at that position (CAP-64). Both dialog instances on Book Detail share one module-level `quizByBook` cache.
- **Enforced:** `client`.
- **Source:** `src/components/book/BookProgressPanel.vue:155-178`; `BookDetailPage.vue:284-290`; `useBookQuiz.ts:31-33`.

#### CAP-67 · `loadOrGenerate`
1. Fetch the quiz row, once per book per app session (module-level cache; a cached `null` counts as fetched).
2. If it covers the position → reuse it with no AI call (retakes allowed).
3. Otherwise `generate()`.
- **Enforced:** `client`.
- **Source:** `useBookQuiz.ts:94-106,165-169`.

#### CAP-68 · `generate`
- **Input:** the **last 6 usable captures in page order** (the highest pages), as `{page, text}`.
- **Context:** `recapContext` = the latest recap's `memoryJogger.trim()`, or omitted.
- **Call:** invoke `generate-book-quiz`.
- **Result:** if `quiz.questions` is not a non-empty array → return `null`, and the UI shows "Couldn't build a quiz this time.".

Pages above the current position are included after a backward correction ⚠ CAP-D08.
- **Enforced:** `client`.
- **Source:** `useBookQuiz.ts:29,119-138`.

#### CAP-69 · Persisting a quiz
The quiz is upserted into `book_quizzes` on `(user_id, book_id)` with `page_snapshot = currentPage` (at generation), `questions`, `score: null`, `answered_at: null` and `generated_at: <client now>`. There is one row per (user, book); a regenerated quiz replaces the previous one (same id) and resets the score.
- **Enforced:** `client`; `server:db` `book_quizzes_user_id_book_id_key`.
- **Source:** `useBookQuiz.ts:140-160`.

#### CAP-70 · Empty state (in practice on-demand only)
With no usable captures, the dialog shows "Quizzes are built from your page captures. Capture a page at the end of a session and the memory check unlocks." and makes no AI call. In session mode this state still offers "Begin reading".
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:56-63,225-232`.

#### CAP-87 · `generate-book-quiz` contract
**Auth:** deployed v1 with `verify_jwt: true`, plus an in-function `sub` decode.

**Request:** `{ captures: [{ page: number, text: non-blank string }, …≥ 1], recapContext?: string }`. Validation is all-or-nothing: **every** capture needs a numeric `page` and non-blank `text`, otherwise 400 `invalid_input`. Through `functions.invoke`, a 400 or 401 surfaces as a thrown `FunctionsHttpError` → the dialog's `error` step.

**Errors:** the same 405 / 401 / 400 semantics as CAP-86. Soft failures return **200 `{quiz: null}`**.

**Input handling:** the server keeps the **last 6 array elements as sent**, so clients must send them in reading order. Each text is capped at 6 000 chars and the recap at 800. Pages are sent as `PAGE n:\n<text>` joined by `\n\n---\n\n`.

**Model call:** `gemini-2.5-flash`, `temperature 0.4`, `maxOutputTokens 1024`, `thinkingBudget 0`.

**Prompt rules:**
- use only the provided text;
- wrong options must be plausible but contradicted by the text, never outside facts;
- 3 questions when the material allows, 2 or 1 when thin;
- exactly 3 options, one correct;
- question ≤ 20 words, option ≤ 12 words;
- give a `sourcePage`;
- fall back to `{insufficient:true}`.

**Normalisation:**
- keep questions with a non-blank question, exactly 3 non-blank string options and an integer `correctIndex` 0–2;
- keep the first 3;
- cap at 240 chars per question and 120 per option;
- `sourcePage` must be a number or `null`;
- shuffle the options with Fisher–Yates and remap `correctIndex`.

A quiz therefore has **1–3** questions. There is no retry and no server timeout.
- **Enforced:** `server:edge`.
- **Source:** `supabase/functions/generate-book-quiz/index.ts:23-70,86-132,174-220`.
- **Target:** the function gets the BC-12 entitlement and `ai_usage` check (CAP-88).

### L. Memory Check — answering and scoring

#### CAP-71 · Answering a question
Each question takes one answer, locked on the first tap. Feedback:
- the correct option gets a green check;
- the chosen wrong option gets a red X;
- the other options fade;
- if `sourcePage != null`, "From your capture · page {sourcePage}" is shown.

The header pill shows "{i} of {n}".
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:91-94,119-127,140-196`.

#### CAP-72 · Advancing and scoring
"Next question" / "See results" is enabled only after answering. Score = the number of answers equal to `correctIndex`.
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:44-46,247-257`.

#### CAP-73 · The score is saved only on "See results"
On "See results" for the last question:
1. The client optimistically sets local `{score, answeredAt: <client now>}`.
2. It runs `UPDATE book_quizzes SET score, answered_at WHERE id AND user_id`.
3. A failure is only logged — no rollback, no retry ⚠ CAP-D10.

Abandoning mid-quiz saves nothing.
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:96-103`; `useBookQuiz.ts:171-183`.

#### CAP-74 · Summary
- **Score:** "{score} / {n}", labelled "Perfect recall" (all correct), "Solid recall" (> 0) or "It happens — memory fades" (0).
- **List:** a ✓ / ✗ line per question.
- **Recap link:** "Feeling hazy? Read the full recap" only when a recap exists **and** `score < n`.
- **Footer:** session mode shows "Begin reading" plus the hint "Your timer starts once you begin."; on-demand mode shows "Done".
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:199-223,259-271`.

#### CAP-75 · Session mode has no skip after "Quiz me"
During loading and questions there is no skip. Dismissing the dialog aborts the session start, and an in-flight generation still completes and upserts (CAP-Q10).
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:131-138,240-272`.

#### CAP-75a · The recap link does not start the session
In session mode, the summary's recap link closes the dialog and routes to `recap-history` (`/books/:id/recaps`) **without** emitting `begin`. The session is therefore not started, exactly as with a dismiss. The hint "Your timer starts once you begin." is shown during questions too.
- **Enforced:** `client`.
- **Source:** `MemoryCheckDialog.vue:114-117,248-251`.

#### CAP-76 · Database rules for `book_quizzes`
- `score` CHECK: NULL or 0..3.
- `page_snapshot >= 0`.
- `questions` jsonb is unconstrained.
- Owner RLS for SELECT / INSERT / UPDATE / DELETE: `(select auth.uid()) = user_id`, role `authenticated`.
- No trigger exists on `book_quizzes`.
- **Enforced:** `server:db` `book_quizzes_score_check`, `book_quizzes_page_snapshot_check`, policies "Book quizzes are … by owner".
- **Source:** live constraints and policies.
- **Note:** nothing stops a client from re-inserting a quiz for an already-finished book; the purge runs only on `reading_progress` writes (BE-20).

#### CAP-77 · Option order is fixed at generation
The options are shuffled **once, server-side**, at generation (Fisher–Yates over 3 indices, `correctIndex` remapped). Every retake reuses the stored order.
- **Enforced:** `server:edge`.
- **Source:** `generate-book-quiz/index.ts:88-101,122-129`.

#### CAP-77a · The quiz payload is trusted
The client only checks that `questions` is a non-empty array; `mapBookQuiz` defaults `questions ?? []`. The server never checks that:
- `sourcePage` is one of the submitted pages;
- the options are distinct;
- the ≤ 20 / ≤ 12-word limits were honoured (only the 240 / 120-char caps are enforced).

⚠ CAP-D28
- **Enforced:** none beyond CAP-87's normalisation.
- **Source:** `useBookQuiz.ts:137-138`; `src/types/index.ts:831-840`; `generate-book-quiz/index.ts:103-132`.

#### CAP-78 · No quiz XP and no quiz history
Quizzes earn no XP and keep no history; only the latest take's score is kept.
- **Enforced:** `server:db` (single row per book).
- **Source:** `src/types/index.ts:809-818`; `book_quizzes_user_id_book_id_key`.

### M. Clocks and time zone

#### CAP-79 · Which clock stamps which field
| Field | Clock |
|---|---|
| `captured_at` | Database `now()`, on insert only |
| `resume_generated_at`, `book_quizzes.generated_at`, `answered_at` | Client clock (UTC ISO string) |
| `progress_history.recorded_at`, `session_start_at` | Client clock (UTC ISO string) |

The 48 h away rule is elapsed time. Capture XP is lifetime, with no year bucketing.
- **Enforced:** `client`; `server:db` default on `captured_at`.
- **Source:** `captures.ts:86-95`; `usePageResume.ts:55`; `useBookQuiz.ts:150,175`; `progress.ts:284,563-574`.
- **Target:** `recorded_at` and `session_start_at` move to the server clock, with client time used only for offline replays (D-06 · BC-04). `resume_generated_at`, `generated_at` and `answered_at` stay client-stamped unless CAP-Q16 moves their writes server-side.

#### CAP-80 · No day-boundary logic in this domain
The intro's "N days" counts whole 24 h periods (`floor(ms / 86 400 000)`), not calendar days. So 47 h 59 m is not eligible, and 71 h shows "2 days". `reading_quest_events.occurred_at` copies `captured_at` (server clock) and keeps the earliest value on conflict. There is no day-boundary logic anywhere in this domain.
- **Enforced:** `client`; `server:db`.
- **Source:** `useBookQuiz.ts:62-73`; live `record_page_capture_quest_event`.
- **Target:** D-07 (the reader's IANA time zone for every day boundary) applies if the "N days" copy is redefined as calendar days (CAP-Q11).

---

## Flows

### F1 · Capture state machine (`useCapture`, `SessionCaptureField`)

States: `idle | camera | ocr-running | verify | denied | offline | error`, plus the component-level `note` mode.

```
idle --Take photo--> camera (CaptureCameraView mounts → startCamera)
camera --offline--> offline                       (CAP-07)
camera --no mediaDevices--> denied                (CAP-07)
camera --NotAllowed/PermissionDenied--> denied    (CAP-09)
camera --other error--> error                     (CAP-09)
camera --Snap--> offline | ocr-running → [stream released] → verify | error   (CAP-10)
camera --Snap, no 2D context--> error "Could not capture frame"              (CAP-12a)
camera --Cancel--> emit skipped (event consumed)                              (CAP-12)
camera --browser Back--> page left; stream released; event pending           (CAP-12a)
idle/denied --Upload--> offline | ocr-running → (decode fail → error) → verify | error   (CAP-14..16)
verify --conf ≥ 0.90 & text--> auto-save → emit saved | save fail → review   (CAP-20/22)
verify --otherwise--> review                                                  (CAP-21)
review --Use Capture--> save → emit saved | error toast, stay in review
review --Retake--> camera | --Re-upload--> file picker (review stays open)   (CAP-26/27a)
review --X--> idle (text discarded; event pending)                           (CAP-26)
review --Back (popstate)--> same as Retake/Re-upload
any --Add note instead--> cancel → note → saved/skipped (consumes)           (CAP-06b)
any --Skip--> cancel → emit skipped
error --Try again--> camera (always the camera)                              (CAP-27)
ocr-running/auto-save --component unmounted--> work continues; capture may be saved;
                                               'saved' dropped; event NOT consumed   (CAP-06a)
```

**Persistence:** nothing is written until `saveCapture` succeeds (a single upsert). The image never leaves memory except as the OCR request body (CAP-90).

### F2 · End-to-end capture save: what is persisted at each step

1. **Page save (online).** The reader saves a page (End Session sheet or pencil):
   - `reading_progress` upsert — the completion triggers may purge captures and the quiz here (CAP-42);
   - `progress_history` insert;
   - `lastSessionEnded` emitted (CAP-01).
   - If the history insert fails, there is no event (CAP-02).
2. **Prompt.** It appears on the hero or Book Detail (CAP-03/04).
3. **Image.** Take photo or upload → `ocr-page`:
   - 4xx/5xx → error panel and toast; nothing saved;
   - offline → offline panel offering the note fallback.
4. **Decision.** Auto-save or review (CAP-20/21).
5. **Write.** `saveCapture` upsert on `(user_id, book_id, page)`. The DB AFTER trigger then:
   - upserts the quest event, deduplicated (CAP-38);
   - runs the completion check, which may delete every capture of the book, the new one included (CAP-43).
6. **Client follow-up.** Patch the cache, invalidate `readingQuest:*`, then fire vocabulary extraction and resume generation (independent and silent; CAP-36/37).
7. **Close.** The prompt emits `saved` → the event is consumed; the hero refetches the last session.

**Failures:**
- an upsert failure shows a toast and keeps (or opens) the review;
- side-effect failures are invisible.

**Abort:** Skip / Cancel consume the event; X returns to the picker; navigating away keeps the event pending (CAP-06a).

### F3 · Resume generation (two entry points)

- **At capture (CAP-37):** `triggerResumeGeneration`, not awaited → `generate-page-resume` → if it returns bullets, `UPDATE page_captures.resume` → `applyResume` patches the cache.
- **At Start Session (CAP-55):** a backfill awaited inside `useSessionResume.load()`. A failure or `null` means no dialog, and the attempt is repeated on the next Start.
- **Race:** if Start is tapped before the capture-time call returns, both calls can run — a double AI bill, last writer wins ⚠ CAP-D09.

### F4 · Start Session gate (`SessionStartButton`)

```
Idle --click--> pending(prepare: captures, recaps, last page save, quiz row)
  eligible (CAP-64)? --yes--> MemoryCheckDialog(intro)
        intro --Skip to reading--> beginSession
        intro --Quiz me--> loading → empty | error | question…→ summary
        summary/empty/error --Begin reading--> beginSession
        summary --recap link--> /books/:id/recaps (no session)        (CAP-75a)
        any step --dismiss--> Idle (nothing written to reading_progress)
  --no--> pending(load resume; maybe awaited backfill AI call)
        view? --yes--> ResumeDialog --Begin reading--> beginSession ; --dismiss--> Idle
        --no--> beginSession
beginSession: offline/complete/DNF → error text under button (CAP-59)
              else upsert session_start_at = now → Active (timer)
Active --stop icon--> emit cancelSession (confirm upstream → clearSession)
```

**Persisted:**
- `reading_progress.session_start_at` / `session_paused_at`, only on begin;
- `book_quizzes`, on generate and on score;
- `page_captures.resume`, on backfill.

### F5 · Memory Check dialog steps

`intro` (session mode only) → `loading` → `question` (× n) → `summary`, with terminal steps `empty` and `error`. Everything is reset on every open (`watch(visible)`).

- **Scoring:** the score is written only on "See results" (CAP-73).
- **Dismissal:** at any point in session mode it aborts the start (CAP-75).
- **On-demand:** closes with "Done".

### F6 · Completion interplay

1. `updateProgress(page = total)` → `reading_progress` upsert → the triggers purge `page_captures` (and their resumes) and `book_quizzes`.
2. The history insert follows, then `lastSessionEnded`.
3. The prompt stays visible on Book Detail. The Dashboard hides it, because `onBookCompleted` rotates the hero.
4. If the reader captures anyway (CAP-43):
   - the row is inserted and the +5 XP event recorded;
   - the row is then deleted by the trigger;
   - the vocabulary ledger insert fails on the FK;
   - the resume UPDATE matches 0 rows;
   - the client cache keeps a ghost capture until reload ⚠ CAP-D05.
5. The Memory check chip is hidden (complete), but `quizByBook` keeps the stale entry.
6. An offline completion purges at replay time instead (CAP-42).

### F7 · Target iOS capture pipeline (D-15)

1. **Image.** Camera or photo picker → an in-memory image (CAP-90), normalised to a long edge of ≤ 2000 px JPEG (CAP-15, CAP-Q13).
2. **On device.** Apple Vision text recognition (offline-capable) → text plus a Vision-derived confidence.
3. **High Vision confidence** (threshold set under CAP-Q07) → use the Vision text: auto-save, or review per the recalibrated rule.
4. **Low Vision confidence** (or Vision failure) → call `ocr-page`, then apply CAP-20 / CAP-21 / CAP-24 to the Gemini confidence.
5. **Save.** Same as F2 step 5 (needs network today; offline queueing is CAP-Q08).

### Edge cases and user-visible copy

| Situation | Behaviour / copy | Rule |
|---|---|---|
| Idle prompt | "Capture this page" + "Reading a paper book? Take a photo. On an ebook or device? Upload a screenshot instead. We'll save the text so future recaps come straight from what you actually read." — buttons Take photo · Upload image · Add note instead · Skip | `SessionCaptureField.vue:244-290` |
| OCR running / auto-saving | Panel hidden; glass loading toast "Reading the page…" (camera subtitle "Analysing the text") | CAP-20 |
| Camera denied / unsupported | "Camera access was denied. You can upload a screenshot of the page instead, leave a note, or grant camera access and try again." [Upload image] [Add note instead] Cancel | CAP-07/09 |
| Offline | "You're offline; capture needs internet to extract text. Try again later, or leave a note for now." [Add note instead] Cancel | CAP-07/14 |
| Generic error | `{errorMessage ?? "Something went wrong."}` [Try again] [Add note instead] Skip | CAP-18/27 |
| Verify without preview | "We could not prepare the capture preview. Try taking the photo again." [Try again] Skip | `SessionCaptureField.vue:318-333` |
| Empty OCR text | Review with an empty textarea; "Use Capture" disabled until text is typed | CAP-23/85 |
| Save failure | Toast "Could not save capture" + raw error (4 s) | CAP-22 |
| Camera image > 5 MiB | 400 → "Image exceeds 5 MB limit" | CAP-10/82 |
| OCR slow | 504 → "OCR took too long; please try again" | CAP-84 |
| Wrong page photographed | Saved against the current page; overwritten by re-capturing at the same page | CAP-28/30 |
| Re-capture of the same page | Overwrites the text; keeps the old resume, `captured_at` and id; no new XP; no vocabulary re-run | CAP-31/36/38 |
| Capture after completion | Success toast; the row is deleted server-side at once; +5 XP kept | CAP-43 |
| Page corrected backwards | Captures above the new current page remain and are used by the resume (highest page) and the quiz (last 6) | CAP-51/68 |
| Resume "insufficient" | No dialog; retried on every Start | CAP-55 |
| Start Session offline | "You appear to be offline. Start Session requires a connection." (possibly only after a dialog) | CAP-59/60a |
| Quiz loading | "Building your quiz from your captured pages…" (spinner) | CAP-68 |
| Quiz failed / null | "Couldn't build a quiz this time." | CAP-68 |
| Quiz with no captures | "Quizzes are built from your page captures. Capture a page at the end of a session and the memory check unlocks." | CAP-70 |
| Quiz dismissed mid-way (session) | Session not started; score not saved | CAP-73/75 |
| Score save fails | Shown as answered locally; server not updated; `console.warn` only | CAP-73 |
| Note save fails | Logged only; the prompt still closes as saved | CAP-06b |

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| `AUTO_SAVE_CONFIDENCE` | 0.90 (≥) | Skip the review and auto-save (Gemini-calibrated) | `src/components/session/SessionCaptureField.vue:87` |
| `LOW_CONFIDENCE_THRESHOLD` | 0.70 (<) | Warning banner in the review (Gemini-calibrated) | `src/components/capture/CaptureReviewViewport.vue:21` |
| Vision thresholds (iOS) | TBD | Auto-save / warning / fallback-to-`ocr-page` rule for Apple Vision | D-15; CAP-Q07 |
| `MAX_CHARS` | 10 000 | Capture text cap (client UTF-16 units; DB code points) | `SessionCaptureField.vue:90`; `CaptureReviewViewport.vue:20`; `page_captures_text_check` |
| Review counter warning | ≤ 200 remaining | Counter turns warning-styled | `CaptureReviewViewport.vue:105` |
| Camera constraints | `facingMode` ideal `environment`; width/height ideal 99999 | Rear camera, maximum resolution | `src/composables/useCapture.ts:83-90` |
| Camera canvas fallback | 1280 × 960 | Used when the video dimensions are unknown | `useCapture.ts:165-166` |
| Camera JPEG quality | 0.92 | Snap encoding (no resize) | `useCapture.ts:177` |
| `MAX_EDGE` (upload) | 2000 px | Long-edge cap, never upscaled | `src/utils/imageNormalize.ts:7` |
| `JPEG_QUALITY` (upload) | 0.85 | Upload re-encode | `imageNormalize.ts:8` |
| `MAX_DECODED_BYTES` | 5 MiB | Server image cap (computed from base64) | `supabase/functions/ocr-page/index.ts:38` |
| `GEMINI_TIMEOUT_MS` | 10 000 ms | OCR budget, including the single retry | `ocr-page/index.ts:39` |
| `ALLOWED_MIME_TYPES` | `image/jpeg`, `image/png` | Server MIME allowlist | `ocr-page/index.ts:40` |
| OCR model params | `gemini-2.5-flash`; temperature 0.1; 8 192 tokens; thinking 0 | Gemini config | `ocr-page/index.ts:87-106` |
| OCR confidence bands | 0.95–1 / 0.70–0.94 / 0.40–0.69 / 0–0.39 | Prompt guidance | `ocr-page/index.ts:43-63` |
| Resume input caps | `pageText` 12 000; `recapContext` 800 chars | Server trimming | `supabase/functions/generate-page-resume/index.ts:121-122` |
| Resume output caps | ≤ 3 bullets; 240 chars per item (bullets and tension) | Normalisation | `generate-page-resume/index.ts:70-81` |
| Resume model params | temperature 0.3; 512 tokens; thinking 0 | Gemini config | `generate-page-resume/index.ts:133-135` |
| `AWAY_THRESHOLD_MS` | 172 800 000 (48 h) | Memory Check session trigger | `src/composables/useBookQuiz.ts:28` |
| "Away" label floor | < 2 whole days → "It has been a little while" | Intro copy | `src/components/session/MemoryCheckDialog.vue:50-54` |
| `MAX_QUIZ_CAPTURES` | 6 (client) / 6 (server, last 6 as sent) | Captures sent to the quiz model | `useBookQuiz.ts:29`; `generate-book-quiz/index.ts:174-176` |
| Quiz per-capture cap | 6 000 chars; recap 800 | Server trimming | `generate-book-quiz/index.ts:174-177` |
| Quiz output caps | 1–3 questions; 3 options; question 240 / option 120 chars | Normalisation | `generate-book-quiz/index.ts:86,103-132` |
| Quiz model params | temperature 0.4; 1 024 tokens; thinking 0 | Gemini config | `generate-book-quiz/index.ts:192-194` |
| `score` range | NULL or 0..3 | DB CHECK | `book_quizzes_score_check` |
| Quiz summary labels | all correct "Perfect recall"; > 0 "Solid recall"; 0 "It happens — memory fades" | Copy thresholds | `MemoryCheckDialog.vue:203` |
| Capture XP | +5 per unique (user, book, page), lifetime | Quest XP | `get_reading_quest_summary` |
| Achievements | ≥ 1 "Chronicler" (`capture_first`), ≥ 50 "Archivist" (`captures_50`) | Trophy Room | `src/utils/achievements.ts:82-95` |
| `p_keep` (dead) | 5 | Default of the prune helper (not wired) | `prune_page_captures_for_book` |
| `MAX_RECAP_CAPTURES` (consumer) | 3 | Captures sent to a corpus recap (REC-15) | `src/stores/recaps.ts:16` |
| Session note | ≤ 160 chars; counter at ≥ 140, warning at ≤ 10 remaining | Note fallback | `src/components/session/SessionNoteField.vue:21-26`; `progress_history_session_note_check` |
| Glass toast lives | success 5 s; warning 6 s; loading until dismissed | Feedback | `src/composables/useGlassToast.ts:44-51` |
| PrimeVue error toast life | 4 000 ms | "OCR failed" / "Couldn't read that image" / "Could not save capture" | `SessionCaptureField.vue:76,121,146` |

---

## Data touchpoints

Shapes are in [backend-contract](../backend-contract.md): §3 Tables, §4 Cascades & lifecycle effects, §5 Row-level security, §9 Triggers & internal functions, §10 Edge functions.

| Object | Read / write | By whom |
|---|---|---|
| `page_captures` | R: `select id,user_id,book_id,page,text,word_count,confidence,captured_at,source,resume` `eq book_id` `order page` (no `user_id` filter; relies on RLS) | Web `captures.fetchCapturesForBook` |
| `page_captures` | W: upsert `onConflict user_id,book_id,page`; `UPDATE resume, resume_generated_at` by id | Web `captures.saveCapture`; `usePageResume` |
| `page_captures` | D: completion purge; FK cascade on book/user delete | Triggers (CAP-42/43); FKs (CAP-45) |
| `book_quizzes` | R: `maybeSingle` by `book_id`. W: upsert `onConflict user_id,book_id`; `UPDATE score, answered_at` by id + user_id | Web `useBookQuiz` |
| `book_quizzes` | D: completion purge; FK cascade | Trigger `delete_book_quizzes_on_book_completion`; FKs |
| `reading_quest_events` | W only by trigger; R via `get_reading_quest_summary` | `record_page_capture_quest_event`; PRO |
| `progress_history.session_note` | W: `UPDATE … WHERE id AND user_id` | Web `progress.saveSessionNote` (note fallback) |
| `progress_history.recorded_at` | R: latest per book (away clock) | Web `progress.fetchLastPageSavedAt` |
| `recaps` (`memory_jogger`, `page_snapshot`, `created_at`) | R (suppression, name context) | Web recaps store (SWR) |
| `reading_progress.current_page` | R (page number, coverage) | Web progress store |
| `vocabulary_extractions` / `lexicon_entries` | W (side effect) | Web `useVocabularyExtraction` (LEX) |
| `ocr-page` | Called with `{imageBase64, mimeType}` | Web `useCapture` (raw fetch) |
| `generate-page-resume` | Called with `{pageText, recapContext?}` | Web `usePageResume` (`functions.invoke`) |
| `generate-book-quiz` | Called with `{captures[], recapContext?}` | Web `useBookQuiz` (`functions.invoke`) |

---

## Client-side logic and server migration

Under D-06 native clients stay thin. Today almost everything in this domain is client logic. The server owns only the XP event, the completion purge, and the edge-function validation and normalisation.

| # | Logic (rules) | Today | Phase 0 / decision | Native clients |
|---|---|---|---|---|
| 1 | Prompt trigger and one-shot consume (CAP-01…06b) | Client, in-memory event | Driven by the history row returned by `save_progress` (BC-04); which saves prompt is CAP-Q01 | Implement; keep the pending prompt per book, owned by a view model (not the view) |
| 2 | Page number = local `current_page` (CAP-28) | Client | Stays client | Implement; load progress first |
| 3 | Trim, non-blank, ≤ 10 000, `word_count` (CAP-23/29/32a) | Client (DB checks length only) | Recommended DB CHECK on `btrim` (CAP-D32) | Implement; count like Postgres |
| 4 | Image normalisation, camera / upload (CAP-10/15) | Client | Stays client (CAP-Q13) | Implement |
| 5 | OCR thresholds, auto-save / review / warning (CAP-20/24) | Client | iOS: Vision first, `ocr-page` fallback, recalibrated thresholds (D-15) | Implement (CAP-Q07) |
| 6 | `ocr-page` auth (CAP-81) | Decode-only | `verify_jwt = true` (BC-02) | Send the user JWT (SDK `functions.invoke`) |
| 7 | Offline gating before camera, OCR and Start (CAP-07/14/59) | Client | Start guards move into `start_session` (BC-04) | Check connectivity first (CAP-D29) |
| 8 | Resume persistence, skip-if-present, bullets check, Start backfill, highest-page selection, fresh-recap suppression (CAP-49…56) | Client | No BC package — stays client today; candidate for server ownership (CAP-Q16) | Implement exactly, with a timeout |
| 9 | Memory Check eligibility, `page_snapshot` caching, upsert, scoring (CAP-61…78) | Client | No BC package — stays client today (CAP-Q16) | Implement exactly; validate payloads |
| 10 | Away-clock source `recorded_at` (CAP-61) | Device clock | Server clock; offline replays keep their original time (D-08 · BC-04) | Read the server value |
| 11 | Timer contract: write `session_start_at` only on Begin / Skip (CAP-54) | Client | `start_session` RPC on the server clock (BC-04) | Implement; start the Live Activity only then |
| 12 | Completion purge (CAP-42/43/47) | Server (triggers) | Stays server; path-independent (BC-05) | Purge local captures and quiz on completion |
| 13 | Capture XP event (CAP-38) | Server (trigger) | Unchanged; summary guard fixed (BC-01) | Never write `reading_quest_events` |
| 14 | Capture badges (CAP-39) | Client (Trophy Room mount) | Server-side achievements (BC-09) | Render only |
| 15 | AI usage / entitlement (CAP-88) | None | Shared check in every AI function (BC-12, D-14) | Handle a denial response |
| 16 | Cache revalidation (Caching) | Never | Refresh on foreground (BC-14) | Refresh on appear / foreground |
| 17 | Retention helpers (CAP-41) | Dead | Dropped or locked (BC-01) | — |

---

## Caching and offline

- **Captures store** (Pinia, in memory):
  - `capturesByBook[bookId]` plus `loadedBookIds`;
  - fetched **once per book per app session** — no TTL, no SWR, no revalidation;
  - patched locally on save and on resume write;
  - `clearCachedCaptures` exists but is **never called** — not on sign-out, completion purge or book delete ⚠ CAP-D05.
- **Quiz cache:** the module-level `quizByBook` is shared by `SessionStartButton` and both dialogs. `fetchQuiz` skips any key that exists, including a cached `null`. It is never invalidated or cleared (sign-out, completion, delete).
- **Away anchor:** `lastPageSavedAt` lives per book in the progress store. It is fetched once, set optimistically on every `updateProgress`, and rolled back only on an online error (CAP-61).
- **Recaps:** SWR key `recaps:<uid>:<bookId>`, TTL 60 s. Used for suppression and the memory-jogger context.
- **Invalidations from this domain:** `saveCapture` → `invalidate(readingQuest(uid), {prefix: true})`.
- **Auth change:** `clearAll()` clears only the SWR cache. Pinia stores, module caches and `lastSessionEnded` survive sign-out, and there is no page reload. The leftovers are inert for the next user (different book ids), but they are never cleared ([11 · Cross-Domain](11-cross-domain.md) sign-out matrix).
- **Cross-device / cross-tab:**
  - A capture, resume or quiz written from another device — e.g. the iOS app — is invisible to an open web session until a full reload.
  - Resume, quiz-eligibility and corpus-recap decisions are therefore made on stale data.
  - Only recaps (60 s SWR) and progress (SWR) revalidate. Neither `page_captures` nor `book_quizzes` is in the Realtime publication.
- **Offline:**
  - Camera, upload, OCR, resume, quiz and Start Session all require the network.
  - There is no offline queue for captures, and no IndexedDB or `localStorage` key in this domain.
  - Offline page saves are queued by the progress domain but never produce a capture prompt (CAP-02). An offline completion purges captures and the quiz at replay time (CAP-42).
- **Target:**
  - Refresh-on-foreground (or Realtime) is defined for all clients, and the web should apply the same revalidation to captures and quizzes (BC-14, recommended).
  - Offline replays keep their original time and write a history row (D-08 · BC-04).

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| CAP-D01 | `ocr-page` runs with `verify_jwt: false` and only decodes `sub`: no signature or `exp` check, and `atob` without base64url normalisation (CAP-81) | Anyone can spend Gemini OCR quota with a forged or expired token; rare spurious 401s for real users | BC-02 |
| CAP-D02 | `prune_page_captures_for_book` is SECURITY DEFINER with no identity check, and `EXECUTE` is granted to PUBLIC / anon / authenticated; `after_page_capture_saved` is dead; neither is in the repo migrations (CAP-41) | Cross-user delete of captures given a (user_id, book_id); repo/live drift | BC-01 (drop or lock both; revoke) |
| CAP-D03 | The `get_reading_quest_summary` guard `p_user_id <> auth.uid()` is NULL-unsafe, and anon / PUBLIC hold `EXECUTE` (CAP-39) | An unauthenticated caller can read any user's XP, level and capture counts | BC-01 (NULL-safe guard; revoke anon) |
| CAP-D04 | A re-capture keeps the old `resume`, `captured_at` and row id, and never re-runs vocabulary extraction (CAP-31/36) | "Previously" describes the old text; new words are never mined | Per CAP-Q04: e.g. a BEFORE UPDATE trigger that nulls `resume` / `resume_generated_at` when `text` changes |
| CAP-D05 | Captures store and `quizByBook` never revalidate and are never cleared (`clearCachedCaptures` unused) | Ghost captures and quizzes after a server purge or delete; stale across devices; previous user's data in memory | Clear per book on completion, delete and sign-out; refresh on foreground (BC-14) |
| CAP-D06 | Book Detail offers the capture prompt for a just-completed book; the capture is acknowledged, toasted, deleted by the trigger, earns +5 XP, and the vocabulary insert fails with FK 23503 (CAP-04/43) | Misleading success; free XP; wasted AI calls | CAP-Q02; minimum: hide the prompt when complete (all clients) |
| CAP-D07 | A `resume: null` result is never persisted as attempted, so every Start re-bills Gemini and waits for it (CAP-55) | Cost; slow session start | CAP-Q06 (attempt marker) + client timeout |
| CAP-D08 | After a backward correction, the resume (highest page) and the quiz (last 6 by page) can use pages beyond the reader's position (CAP-51/68) | Spoiler-like content from re-read stretches | CAP-Q05 (only consider `page ≤ current_page`) |
| CAP-D09 | Capture-time and Start-time resume generation can run at once (F3) | Double AI bill; last writer wins | Single-flight per capture id (in-memory promise map) |
| CAP-D10 | The quiz score save is optimistic, with no rollback or retry (CAP-73) | Server keeps `answered_at = null` → the prompt can reappear after reload | Await the update; retry once; reconcile on reload |
| CAP-D11 | Camera stills are sent at full resolution as JPEG 0.92 with no size check (CAP-10) | Can exceed the 5 MiB cap on high-resolution devices; latency and cost | CAP-Q13 (downscale to 2000 px / 0.85) |
| CAP-D12 | The review viewport `pushState`s on mount and never pops (CAP-26) | An extra Back press is needed later | `history.back()` on confirm or close when the entry is still on top |
| CAP-D13 | No in-flight guard on "Use Capture" (CAP-26) | Duplicate upserts and duplicate side-effect calls on a double tap | Disable while saving |
| CAP-D14 | The error panel's "Try again" always opens the camera (CAP-27) | Upload users land in the camera | Re-run `lastMethod` |
| CAP-D15 | The denied panel ignores `errorMessage` (CAP-07) | "Camera not supported on this device" is never shown | Show the message when present |
| CAP-D16 | Hero watcher is `immediate`, Book Detail's is not (CAP-03/04) | A pending prompt resurfaces on the Dashboard but not on Book Detail | Use one consistent rule |
| CAP-D17 | `bookId` is non-reactive in `SessionStartButton` / `MemoryCheckDialog` / `useReadingSession` (CAP-58) | If `BookDetailPage` is reused across `/books/A → /books/B`, the controls act on book A | Pass refs, or key the page by route id |
| CAP-D18 | Dead code: `CaptureVerifyView.vue`; `coverageInRange`, `coverageRef`, `pageHasCapture`, `clearCachedCaptures`, `lastError`, `saving`; the OCR `wordCount` field; the `iconOnly` Start variant; `source` values `manual`/`import` never written; empty `src/components/{capture,session}/__tests__/` (no automated coverage) | Misleading docs and specs (e.g. the "≥ 30 % coverage" comment) | Remove or wire up; add tests |
| CAP-D19 | The 10 s `ocr-page` timer covers both attempts, is never cleared, and does not abort the losing Gemini call (CAP-84) | The retry rarely has time; wasted model cost | Per-attempt `AbortController` with an explicit total budget |
| CAP-D20 | HEIC uploads fail on browsers without HEIC decoding — Chrome, Firefox, Android (CAP-16) | Spec 033 promise broken for iPhone photos uploaded on the web | Client-side HEIC decode, or document the limitation; native clients decode natively |
| CAP-D21 | The stale resume shape (a `characters` key) remains in migration `20260713` and in the live `page_captures.resume` column comment; 1 legacy row (CAP-57) | Misleads implementers | BC-03 (baseline sync); update the comment |
| CAP-D22 | Hygiene: `page_captures` policies use per-row `auth.uid()` on role `public`; `idx_page_captures_user_book_page` duplicates the unique-constraint index; `fetchCapturesForBook` has no `user_id` filter; default grants give anon / authenticated full DML (RLS is the only guard); unindexed FK `book_id` (`page_captures`, `reading_quest_events`) | Advisor findings; weaker defence in depth | BC-01 |
| CAP-D23 | Unmount mid-flow drops the consume and discards a low-confidence result (CAP-06a) | Re-prompt for a page already captured; silent data loss | Bind the save to a store / view model; CAP-Q15 |
| CAP-D24 | No client timeout on the OCR fetch, the resume backfill or the quiz invoke (CAP-19/55a) | The Start button can spin for the platform wall-clock limit | ~15 s OCR, ~20 s resume and quiz, then degrade silently |
| CAP-D25 | Child-table RLS checks only `user_id`, not book ownership (CAP-89) | Rows against another user's book; the completion purge never fires for them | BC-01 |
| CAP-D26 | Lowering `total_pages` to ≤ `current_page` never purges captures or the quiz, which then linger (CAP-47) | Completion side effects depend on the path | BC-05 (path-independent completion) |
| CAP-D27 | A failed note save is silent and still consumes the event (CAP-06b) | The note is lost with no feedback | Show an error; keep the prompt pending on failure |
| CAP-D28 | The quiz payload is trusted: no checks on `sourcePage` membership, option distinctness or word limits (CAP-77a) | Odd or broken questions can render | Server: validate `sourcePage ∈ submitted pages` and distinct options; client: validate before rendering |
| CAP-D29 | An offline Start can open the quiz or resume dialog from cache; the offline error appears only after Begin (CAP-60a) | Confusing flow | Check connectivity before the pre-flight |
| CAP-D30 | Offline saves stamp `lastPageSavedAt` optimistically with no rollback (CAP-61) | The away clock resets locally until reload | Resolved by BC-04 replay history; meanwhile skip the stamp offline |
| CAP-D31 | `ocr-page`, `generate-page-resume` and `generate-book-quiz` import `npm:@google/genai` unpinned | SDK version resolved at deploy time; non-reproducible behaviour | BC-03 (pin versions in `deno.json`) |
| CAP-D32 | The DB accepts whitespace-only capture text; client and DB count length differently; `slice` can split a surrogate pair (CAP-32a) | Junk rows possible from a non-web writer | DB `CHECK (char_length(btrim(text)) > 0)` (backward compatible, D-05); slice by code points |

The corpus-window vs warning-dialog mismatch for recaps ("Inferred recap" warned while a corpus recap is generated from older captures) is owned by [03 · Recaps](03-recaps.md) (REC-17).

---

## Open decisions

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| CAP-Q01 | Which saves raise the capture prompt (and reset the 48 h away clock): only timed sessions, any forward page change, or also backward corrections? | Any online save that produced a history row, including pencil, backward and completing saves (CAP-01, CAP-61) | Prompt after any **forward** page change, timed or not, consistent with D-08's counting; never after a backward correction or a completing save (CAP-Q02); keep the away clock on any history row |
| CAP-Q02 | On completion: hide the prompt for complete books? Should a capture on a complete book earn +5 XP? | Prompt shown on Book Detail; the capture is saved, +5 XP recorded, the row deleted at once (CAP-43) | Hide the prompt for complete books on all clients (`save_progress` reports `effects.captureAllowed = false` on the completing save, BC-04); server-side, reject a capture on a complete book with `book_complete` and no XP (BC-05, OP-05.3) |
| CAP-Q03 | When should captures and the quiz be purged: at the completion write (today), or after the BC-05 completion jobs, e.g. a D-12 Insight backfill from captures or the passport summary? What about un-completion (`total_pages` raised) and DNF? | Immediate and irreversible on any `current_page ≥ total_pages` write; DNF never purges (CAP-42/44/46) | Run the purge as the **last step** of the server-owned completion job (BC-05), so the D-12 / BC-08 capture fallback and backfill can still read captures; keep "DNF never purges" |
| CAP-Q04 | On re-capturing a page: regenerate the resume, re-run vocabulary extraction, bump a timestamp? | None of these happen (CAP-31/36) | Yes: null `resume` on text change (DB trigger); key the vocabulary ledger on capture id + text version; add an `updated_at`, keeping `captured_at` as first capture; XP stays once per page |
| CAP-Q05 | Capture selection for the resume and quiz: highest page or most recent; ignore captures above the current page? | Highest page; the quiz uses the 6 highest pages; pages above `current_page` are included (CAP-51/68) | Consider only `page ≤ current_page`; resume = highest such page; quiz = last 6 such pages |
| CAP-Q06 | Record failed or insufficient resume attempts to stop re-billing on every Start? | Nothing persisted on `null`; retried on every Start (CAP-55) | Add nullable `resume_status` (`ok` / `insufficient` / `failed`) + `resume_attempted_at` (additive, D-05); never retry `insufficient` until the text changes; retry `failed` with backoff |
| CAP-Q07 | Apple Vision calibration (D-15 residual): which metric and thresholds drive auto-save, warning and fallback to `ocr-page`? How are page numbers and running headers stripped? What `confidence` value is stored? | Only Gemini thresholds exist (0.90 / 0.70) | Calibrate on a labelled page set before launch (e.g. mean observation confidence plus a minimum word count); strip top/bottom bands and digit-only lines to match the `ocr-page` exclusions; store the Vision score and record the engine (CAP-Q09) |
| CAP-Q08 | With on-device OCR, may iOS queue capture saves offline? | Capture requires the network on every client | Yes on iOS, after BC-04 lands: freeze the page at capture time, use an idempotency key, and replay after the progress replay; the PWA is unchanged |
| CAP-Q09 | Record the capture origin and OCR engine? | `source='ocr'` for camera, upload and typed text (CAP-25/33) | Add nullable `capture_method` (`camera` / `upload`) and `ocr_engine` (`gemini` / `vision`) columns; keep `source='ocr'` for compatibility (D-05) |
| CAP-Q10 | Memory Check exits: allow skipping during loading and questions? Should the recap link start the session? Partial scores, XP, history? | No skip after "Quiz me"; dismiss aborts; the recap link aborts; only the final score is saved; no XP or history (CAP-73/75/75a/78) | Add "Skip to reading" during loading and questions (starts the session); keep dismiss = abort; keep the recap link as "leave without starting"; no XP for now |
| CAP-Q11 | Away rule and copy: a per-book rolling 48 h, or calendar days in the reader's time zone (D-07)? | Per-book elapsed 48 h; "N days" = whole 24 h periods (CAP-61/65/80) | Keep the per-book elapsed 48 h gate; compute the "N days" label as a calendar-day difference in the reader's IANA time zone (D-07) |
| CAP-Q12 | Show the on-demand "Memory check" chip when the book has no captures? | Shown, with the empty state (CAP-66a/70) | Keep — the empty state teaches the feature |
| CAP-Q13 | Downscale camera stills like uploads? | Full resolution, JPEG 0.92 (CAP-10) | Yes — long edge ≤ 2000 px, JPEG 0.85, on every client |
| CAP-Q14 | Keep the review's third action (close X → method picker), despite spec 027's "exactly two actions"? | Three actions (CAP-26) | Keep it — it is the only route back to note or skip; amend the spec intent; mirror it natively as a toolbar close |
| CAP-Q15 | When the reader leaves during OCR, should a low-confidence result be kept for later review? | Discarded silently; an auto-save completes but the prompt re-appears (CAP-06a) | Let the save task outlive the view; consume on success; park a low-confidence result as "finish your capture" on the same book until the next prompt |
| CAP-Q16 | Move resume and quiz persistence and the pre-session decision server-side? This is not covered by BC-01…BC-15. | The client writes `page_captures.resume` and `book_quizzes`, and computes eligibility (CAP-49…69) | Yes, additively (D-05/D-06): the edge functions write with the caller's JWT and return the row; add `get_session_warmup(book_id)` returning `{kind: 'quiz' \| 'resume' \| null, payload}`; the PWA migrates afterwards |

Dropped because the 2026-10-18 decisions answer them:

| Question | Answered by | Recorded in |
|---|---|---|
| Wire the keep-5 prune, or drop the dead helpers? | BC-01 | Target on CAP-41 |
| Which iOS OCR engine? | D-15 | CAP-20 / CAP-24 / CAP-83 Targets |
| `ocr-page` `verify_jwt`? | BC-02 | Target on CAP-81 |
| Hardening of `get_reading_quest_summary`? | BC-01 | Target on CAP-39 |
| Corpus rule and inferred-warning window | Owned by REC | [03 · Recaps](03-recaps.md) |

Tier gating of Memory Check and resume is not decided here: subscriptions are undecided (D-14), and BC-12 provides only the entitlement and usage hook.

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

**Capture and persistence**
- **Page number.** The capture page is the local `current_page` at save time, never OCR (CAP-28).
- **Write.** Upsert on `(user_id, book_id, page)` with `source:'ocr'`. Trim the text, reject whitespace-only, and cap at 10 000 **code points**, matching Postgres `char_length`. Recompute `word_count` with a whitespace split (CAP-29/32a).
- **Side effects.** After a save, start two **detached** jobs — vocabulary extraction (LEX pipeline) and resume generation + `UPDATE resume` (CAP-36/37). Never surface their errors, and let them finish if the app goes to the background.
- **Quest events.** Never insert `reading_quest_events` (CAP-40). Refresh quest and XP after a capture.

**Prompt ownership**
- Bind the save to the pending prompt, not to the view. Keep `{bookId, historyRowId, sessionStartAt}` per book in a repository or view model, and consume it when the save succeeds even if the sheet was dismissed. This fixes the web's CAP-06a.

**Completion and lifecycle**
- **Purge.** Expect server-side purges on completion: when a save reaches `total_pages`, clear the local captures, resumes and quiz for that book.
- **Prompt.** Do not offer the prompt for a book that is complete (pending CAP-Q02).
- **Un-completion.** Remember that raising `total_pages` re-opens a book that no longer has captures (CAP-44).
- **Delete.** On book delete, cancel per-book AI tasks and purge local artefacts (CAP-45).
- **Sign-out / account switch.** Wipe all per-user caches: captures, quiz, last-page-saved, pending prompt.

**Pre-session orchestration**
- **Connectivity.** Check it first (CAP-D29).
- **Order.** Replicate CAP-58 exactly: quiz eligibility (CAP-61…64) → resume (highest-page capture, fresh-recap suppression, awaited backfill) → start. **Load progress first** (CAP-52).
- **Timeouts.** Put ~20 s on resume and quiz calls and ~15 s on `ocr-page`.
- **Dismissal.** Swiping away either sheet aborts the start; write `session_start_at` only on "Begin reading" / "Skip to reading" (CAP-54).
- **Quiz rendering.** Options are already shuffled server-side, so render them in stored order. Lock the answer after the first tap. Validate rows before rendering: 1–3 questions, 3 options, `correctIndex ∈ {0,1,2}`. Treat an invalid row as "Couldn't build a quiz this time." (CAP-77a).
- **Quiz cache.** Model it as an app-wide repository keyed by `bookId`, and revalidate it, together with captures, on book-detail appear and on app foreground (BC-14). Web and native share accounts, and stale caches drive wrong resume, quiz and corpus decisions.

**AI calls**
- **Auth.** Call the functions through the Supabase SDK (`functions.invoke`), which sends the user JWT and `apikey`.
- **Errors.** Map `ocr-page`'s `{error, message}` bodies (CAP-82/84).
- **Soft failures.** Treat `{resume: null}` / `{quiz: null}` as non-errors (CAP-86/87).
- **Entitlements.** Expect a BC-12 entitlement / usage denial response once it ships.

### iOS-specific (iOS 26+, iPhone first — D-04, D-15)

**Capture input**
- **Camera.** Use VisionKit `VNDocumentCameraViewController` (edge detection, perspective correction) or an AVFoundation `AVCapturePhotoOutput` still. Allow one page per flow. `DataScannerViewController` is a live scanner for ISBNs and short text, not full pages.
- **Upload.** Use `PhotosPicker` (no photo-library permission needed) plus `.fileImporter` for Files. HEIC decodes natively, which closes CAP-D20.
- **Normalisation.** Normalise both the camera and upload paths to a long edge ≤ 2000 px and `jpegData(compressionQuality: 0.85)`, and keep the decoded size ≤ 5 MiB.
- **Transience.** Keep image bytes in memory only: no Photos save, no Storage upload, delete any temp file (CAP-90).
- **Permission.** `NSCameraUsageDescription` is required, worded for "The Chronicler" (D-03). When denied, show the denial panel with **Open Settings** (`UIApplication.openSettingsURLString`) plus the Upload and Add-note fallbacks. The Simulator has no camera, so the upload path must be complete.

**OCR (D-15)**
- **Pipeline.** On-device Apple Vision text recognition comes first (accurate level, language correction). Vision's per-observation confidence is **not comparable** to Gemini's self-rating, so the 0.90 / 0.70 thresholds do not transfer (CAP-Q07). Call `ocr-page` when Vision's confidence is low.
- **Parity.** Match `ocr-page`'s output conventions: `\n\n` paragraphs, `\n` lines, no printed page numbers, running headers, footers or footnote markers. Recaps, vocabulary and quizzes consume this text.
- **Offline.** On-device OCR works offline, but the save still needs the network until CAP-Q08 is decided.

**Presentation**
- **Sheets.** Present "Previously" and Memory Check as sheets (`presentationDetents([.medium, .large])`). Start the Live Activity only on Begin / Skip.
- **Feedback and accessibility.** Use `.sensoryFeedback(.success / .error)` on answers. VoiceOver must announce correct / incorrect and the "From your capture · page N" note. Support Dynamic Type for options of up to 120 chars.
- **Glass.** The capture prompt card, its toasts and the review's bottom bar use native Liquid Glass (`.glassEffect` / `GlassEffectContainer`), with no pre-iOS-26 fallback. Respect Reduce Transparency and Increase Contrast (D-04).
- **Review screen.** Follow spec 027's intent: a full-screen review with both primary actions visible without scrolling, a thumb-reachable bottom bar, back-swipe = retake, and a close button (CAP-Q14).

**Privacy and App Review**
- Page images and text go to Google Gemini through Supabase — `ocr-page` when it is used, plus resume, quiz, vocabulary and corpus recaps.
- Disclose this in the privacy policy and the App Privacy labels. Obtain the in-app third-party-AI consent before the first capture; the consent flow is owned by [08 · Platform, Auth & Account](08-platform-auth-account.md).
- Captured text of copyrighted books stays per-user only; never share it.
