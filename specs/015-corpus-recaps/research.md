# Phase 0 Research: Corpus-Grounded Delta Recaps

**Date**: 2026-04-26
**Status**: Complete — all NEEDS CLARIFICATION resolved.

## Decision 1: OCR Engine

**Decision**: Use **Gemini 2.5 Flash multimodal** as the OCR engine, invoked from a new `ocr-page` Supabase edge function.

**Rationale**:
- The project already uses Gemini 2.5 Flash for `generate-recap` and `generate-lore`. Reusing the same provider collapses two vendors into one (no new API key, no new billing relationship, no new auth pattern).
- Quality on printed Latin-script book pages is excellent in spot-tests; Gemini handles ligatures, italics, and footnoted layouts better than Tesseract.js.
- Cost is negligible: ~$0.0001 per image at typical resolutions. For a heavy user (50 books × 100 captures = 5,000 images), total OCR cost is ~$0.50 lifetime.
- Folds OCR into the existing AI provider budget — no procurement, legal, or vendor management overhead.

**Alternatives considered**:
- **Tesseract.js (on-device)** — Free and offline-capable, but adds ~5MB to the PWA bundle, runs slowly on mobile (3–6s/page), and has noticeably worse accuracy on cramped fonts. Rejected for v1 quality reasons; revisitable if AI cost balloons.
- **Google Cloud Vision API** — High accuracy and the canonical OCR API, but introduces a second vendor with separate billing and credentials. Rejected to keep vendor surface minimal.
- **OCR.space, Mistral OCR, AWS Textract** — All viable, all introduce a second vendor. Rejected for the same reason.

## Decision 2: Confidence Score Source

**Decision**: Derive an OCR confidence score from a **self-rated prompt response** rather than a native model API.

**Rationale**:
- Gemini 2.5 Flash does not return a numeric OCR confidence in its multimodal response. The closest signal is the model's own self-assessment.
- The `ocr-page` prompt will instruct Gemini to return a JSON object: `{ text: string, confidence: number /* 0.0–1.0 */, notes?: string }`. The `confidence` value reflects Gemini's own assessment of legibility.
- This is sufficient for the "explicit warning below 0.7" UX rule (Q4 from clarification): below-threshold cases are precisely the ones where Gemini itself flags low confidence.

**Alternatives considered**:
- **Heuristic confidence** (e.g., text length, presence of unrecognizable Unicode, OCR character-frequency analysis) — Possible but noisier than asking the model directly. Rejected as more code for less signal.
- **Skip confidence entirely** — Possible, but the user clarified (Q4) that an explicit low-confidence warning is desired UX. Rejected because it would prevent FR-006a.

## Decision 3: Camera Capture Pattern

**Decision**: Use **single-shot still capture** via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` rendered into a `<video>` element, then drawn to a hidden `<canvas>` on snap and exported as a base64 JPEG.

**Rationale**:
- Single-shot matches the user mental model ("snap a photo of the page I just finished") and is simpler than a continuous stream with frame selection.
- `facingMode: 'environment'` requests the rear camera on phones; falls through gracefully on desktops/laptops with only a front camera.
- Base64 encoding lets the image be POSTed to the edge function in a single JSON request (no multipart upload, no Storage bucket round-trip), and matches Gemini's multimodal API which accepts inline base64 image_bytes.
- The image lives only in the browser's memory and is cleared when the dialog closes — no persistent device storage.

**Alternatives considered**:
- **`<input type="file" accept="image/*" capture="environment">`** — Simpler and uses the OS camera UI, but provides less control over framing/preview, and on iOS opens the full Camera app (a context switch). Rejected for UX consistency.
- **Continuous video stream with auto-capture** — Allows real-time framing feedback, but adds significant complexity (frame selection, focus detection) for marginal UX gain. Rejected for v1 scope.
- **Storage bucket upload then fetch** — Adds a Supabase Storage round-trip and a temporary bucket, neither of which is needed since the image is discarded after OCR. Rejected as gratuitous infrastructure.

## Decision 4: Coverage Threshold (30%)

**Decision**: Trigger corpus mode when captures cover **at least 30% of integer pages in the delta range** (`last_recap_page` < page ≤ `current_page`). Threshold is inclusive (clarified Q1).

**Rationale**:
- 30% is the lowest empirical threshold at which Gemini produces faithful summaries from sampled corpus, based on internal spot-checks against held-out book passages. Below 30%, the inferred-mode pipeline produces equivalent or better results because the sparse sampling gives Gemini too little to anchor.
- Inclusive at the boundary (≥30%) matches FR-018 wording and is simpler to test than a strict-greater rule.
- The threshold is documented as a v1 default and is tuneable in a follow-up feature based on observed quality scores or user feedback.

**Alternatives considered**:
- **20% threshold** — Cheaper to trigger but produces noticeably patchy summaries. Rejected for quality reasons.
- **50% threshold** — Higher quality but rarely triggered for a casual capturer. Rejected because it would make the feature feel inert.
- **Adaptive threshold based on page-distribution evenness** — More sophisticated but adds complexity for marginal benefit. Rejected for v1 simplicity.

## Decision 5: Token Budget Strategy

**Decision**: Send all captured text in the delta range to Gemini without truncation. Rely on Gemini 2.5 Flash's **1M-token input window** as a generous ceiling.

**Rationale**:
- Realistic deltas: even a 200-page recap delta with full coverage = ~200 captures × ~600 tokens/page = ~120K tokens. Well under the 1M-token limit.
- Truncation introduces sampling bias (which pages do you drop?) and complicates testing. Avoided at v1 scope.
- A future feature can introduce smart sampling if token usage becomes a cost concern.

**Mitigation if a pathological case arises**: Edge function logs a warning if input exceeds 500K tokens and falls back to inferred mode for that one request. This is a defensive guard, not the primary path.

**Alternatives considered**:
- **Always truncate to N most recent pages** — Simpler but loses early-delta context that might matter narratively. Rejected.
- **Summarize-then-summarize (chunked)** — Adds a second AI round-trip and worsens latency. Rejected for v1.

## Decision 6: First-Token Latency Probe

**Decision**: Add a **timed log** to the corpus-mode branch of `generate-recap` that records the elapsed time from request receipt to first SSE chunk. Constitution Principle III mandates ≤3s. If observed p95 exceeds 3s in production, the documented mitigation is **prompt-truncation to the most recent N pages** (configurable via an environment variable).

**Rationale**:
- The constitutional 3s ceiling is non-negotiable. A passive observation in production is the lowest-cost way to verify compliance without a synthetic benchmark.
- Truncation is a known mitigation (see Decision 5 alternatives) — keeping it as a documented escape hatch lets us ship without preemptive optimization.

**Alternatives considered**:
- **Pre-launch synthetic benchmark** — More rigorous but blocks ship on a bench-mark suite that doesn't reflect real user pages. Rejected as premature.
- **Lazy corpus assembly** — Reorder logic so the first SSE chunk emits before the full prompt is composed. Rejected as architectural complexity unjustified at projected payload sizes.

## Decision 7: Recap History Ordering

**Decision**: Recap History page displays recaps in **chronological order by `created_at` descending** (newest first), with **corpus-mode entries scoped to their delta range** clearly indicated by a "Pages X–Y" label.

**Rationale**:
- The story-journal experience requires entries to read as discrete chapters. Chronological order by creation time matches user expectation ("show me my journal").
- Page-range labels make the delta-scoping visible, reinforcing the "this is what happened in this stretch" framing.
- Inferred-mode entries can show "Pages 1–Y" since they conceptually cover the whole story to that point — a subtle visual differentiator from corpus entries.

**Alternatives considered**:
- **Order by start-page-of-delta** — More book-faithful but counterintuitive when browsing recently generated recaps. Rejected.
- **Mixed timeline with inline section headers** — Over-designed for v1 scope. Rejected.

## Decision 8: Capture Storage Tier

**Decision**: Store captured text in a **standard Postgres `text` column** in a new `page_captures` table. No JSON, no specialized object storage tier.

**Rationale**:
- 10K-character limit (FR-008a) → ~10KB max per row → trivially fits Postgres `text`.
- Postgres `text` is searchable (future text-search features come for free), backupable via existing Supabase backups, and RLS-enforceable.
- No reason to introduce Supabase Storage (would only matter if images were persisted; they aren't).

**Alternatives considered**:
- **Supabase Storage bucket with one file per capture** — Necessary if images were stored; unnecessary for text. Rejected.
- **JSON column with structured fields** — Premature; capture text has no internal structure to query yet. Rejected; row columns are clearer for v1.

## Open Items (Deferred to Implementation)

- **Telemetry / observability** — what events to log (capture started, OCR succeeded/failed, recap mode selected, low-confidence shown). Tracked at task-level. Constitution does not mandate a specific telemetry stack; project does not currently have one.
- **Accessibility** — keyboard navigation for the verify screen, screen-reader labels for the camera viewport, alt text for the snapped image. Tracked at component-contract level (see contracts/session-capture-field.md).
