# Implementation Plan: Corpus-Grounded Delta Recaps

**Branch**: `015-corpus-recaps` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-corpus-recaps/spec.md`

## Summary

Replace the existing AI-inferred recap pipeline with a **corpus-grounded delta recap** pipeline that generates summaries from the actual text the reader has captured from their book. Captures happen via the device camera at the moment a session ends — replacing the existing session-note prompt on the Last Session card. OCR runs server-side via Gemini 2.5 Flash multimodal; the image itself is never persisted. Captured text is keyed against the reader's manually-tracked `current_page` (never the printed page number, to support multi-volume editions like LOTR with continuous pagination).

When the reader taps **Get Recap**, the engine fetches captures within the delta range (`last_recap_page` → `current_page`); if coverage is ≥30%, it generates a corpus-grounded recap that summarizes only that stretch (so the Recap History reads as a chronological journal). When coverage is insufficient or zero, it falls back transparently to today's inferred-mode pipeline. A small `mode` column on the `recaps` table records which path produced each recap, and the recap card surfaces a "📸 Generated from your captures" badge when corpus mode ran.

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Vue 3.5 (Composition API, `<script setup>`); Deno runtime for Supabase edge functions
**Primary Dependencies**: PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, VueUse, date-fns v4. New runtime dependency: native `navigator.mediaDevices.getUserMedia()` for camera access — no new npm packages required.
**Storage**: Supabase PostgreSQL — new `page_captures` table; existing `recaps` table extended with a `mode text` column. No new buckets in Supabase Storage (images are not persisted).
**Testing**: Vitest (unit + composable tests). Manual E2E walkthrough via quickstart.md for camera + OCR paths.
**Target Platform**: PWA — iOS Safari 14+, Android Chrome 90+, desktop Chromium / Firefox / Safari (with any available camera). Camera capture degrades to "Add note instead" when no camera is available.
**Project Type**: Single-project Vue PWA frontend with Supabase BaaS + edge functions. Existing repository layout is preserved.
**Performance Goals**: OCR endpoint p95 latency ≤5s for a 1080p book-page image; corpus-mode recap MUST begin streaming within 3s of the Get Recap tap (constitution Principle III parity with inferred mode); verify screen renders within 100ms of OCR response receipt.
**Constraints**: Photographed image MUST NOT be persisted server-side; OCR text capped at 10,000 characters per capture (FR-008a); corpus mode triggered at ≥30% delta coverage (inclusive); existing inferred-mode pipeline MUST remain functional as a fallback.
**Scale/Scope**: ~50 books per active user; ~100 captures per book in steady state; ~3KB average capture text size → ~15MB corpus per heavy user. No new third-party services beyond the existing Gemini 2.5 Flash AI provider.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I. Memory Continuity (NON-NEGOTIABLE)** | ✅ Pass | Corpus mode strengthens spoiler-safety (Gemini only sees user-captured pages, hard-clamped by SQL `WHERE page <= current_page`). Delta scoping eliminates redundancy across recap history. The 3-tier output structure (Memory Jogger / Concept Watchlist / Thematic Bridge) is preserved in the corpus prompt design. |
| **II. Physical-to-Digital Bridge** | ✅ Pass | Camera capture is the canonical physical-book interaction. Page numbers are explicitly **manual user input**, never OCR-detected, which protects edition-specific accuracy (the LOTR multi-volume case is the originating motivation). ISBN/edition handling is unaffected. |
| **III. AI-First Recap Engine** | ✅ Pass — with verification gate | Corpus mode is a refinement of the existing engine, reusing the streaming SSE pipeline, the 3-tier output schema, and the Gemini provider. Risk: corpus prompts carry ~5–60K extra tokens vs inferred prompts, which could push first-token latency above the 3s budget. **Verification gate:** Phase 0 must measure first-token latency at p95 with realistic corpus payloads. If exceeded, prompt-truncation strategy (sample representative pages) is the documented mitigation. |
| **IV. Data Integrity & Synchronization** | ✅ Pass | New `page_captures` table is RLS-scoped (`auth.uid() = user_id`) and cascade-deletes from `books` and `auth.users`. Capture writes are synchronous — UI does not confirm save until the row commits. Offline at capture time → reader sees a clear notice and the prompt persists for retry on the next session-end event. No optimistic queueing for captures (OCR requires network). |
| **V. PWA-First & Frictionless Portability** | ✅ Pass | Camera access uses the native `getUserMedia` API supported in all PWA-capable browsers. No native shell required. The capture flow is reachable in two taps from the dashboard (Tap "📸 Capture this page" on LastSessionCard → Snap → Confirm). Capture dialog is lazy-loaded so the main bundle stays slim. |

**Project-specific divergence note**: The constitution names "Claude API (Anthropic)" as the AI provider, but the project has used Gemini 2.5 Flash since feature 003. This divergence is documented in CLAUDE.md and prior plans (007, 008); it is honored here for consistency. The constitution's intent — "default to the latest capable model with prompt caching" — is satisfied by Gemini 2.5 Flash multimodal.

**Result: All gates pass.** No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/015-corpus-recaps/
├── spec.md                       # Feature spec (clarified)
├── plan.md                       # This file
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/                    # Phase 1 output
│   ├── ocr-page.md               # New edge function contract
│   ├── generate-recap.md         # Extended edge function contract
│   ├── page-captures-rls.sql     # RLS policy
│   ├── session-capture-field.md  # Vue component contract
│   └── captures-store.md         # Pinia store contract
├── checklists/
│   └── requirements.md           # Spec quality checklist
└── tasks.md                      # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── session/
│   │   ├── SessionCaptureField.vue         # NEW — replaces SessionNoteField as primary
│   │   └── SessionNoteField.vue            # KEPT — used by "Add note instead" fallback
│   ├── capture/
│   │   ├── CaptureCameraView.vue           # NEW — getUserMedia viewport + snap
│   │   └── CaptureVerifyView.vue           # NEW — OCR'd text editor + low-confidence banner
│   ├── dashboard/
│   │   └── LastSessionCard.vue             # MODIFIED — primary action becomes capture
│   └── recap/
│       └── RecapCard.vue                   # MODIFIED — adds corpus-mode badge
├── composables/
│   └── useCapture.ts                       # NEW — camera lifecycle + OCR call
├── stores/
│   └── captures.ts                         # NEW — Pinia store for page_captures
├── types/
│   └── index.ts                            # MODIFIED — add PageCapture, RecapMode types
├── services/
│   └── supabase.ts                         # UNCHANGED
└── pages/
    └── (no changes)

supabase/
├── functions/
│   ├── ocr-page/
│   │   └── index.ts                        # NEW edge function
│   └── generate-recap/
│       └── index.ts                        # MODIFIED — add corpus mode branch
└── migrations/
    └── 20260426000000_corpus_recaps.sql    # NEW — page_captures table + recaps.mode column

tests/
└── (Vitest co-located with composables/stores under src/)
```

**Structure Decision**: Single-project Vue PWA layout, unchanged. The feature adds a new component family (`src/components/capture/`), one new composable, one new Pinia store, one new edge function, modifies one existing edge function, and adds one migration. No structural reorganization.

## Phase 0: Outline & Research

See [research.md](./research.md) for consolidated decisions. Key topics resolved:

1. **Gemini 2.5 Flash multimodal OCR quality + cost** — confirmed adequate for printed Latin-script book pages; ~$0.0001/image; confidence is derived from a self-rated prompt response since Gemini does not return a numeric OCR confidence natively.
2. **getUserMedia camera UX patterns** — single-shot capture preferred over a continuous stream; permission flow must offer the "Add note instead" fallback without blocking the user.
3. **Coverage threshold rationale (30%)** — chosen for v1 as the lowest threshold at which Gemini produces faithful summaries from sampled corpus across spot-check tests; tuneable via observed quality scores.
4. **Token budget for corpus prompts** — Gemini 2.5 Flash 1M-token context comfortably fits realistic deltas (≤200 captured pages × ~600 tokens/page = 120K tokens). No truncation needed in v1.
5. **Streaming preservation** — SSE pattern reused unchanged; corpus prompt is constructed in the edge function before the streaming call begins.

## Phase 1: Design & Contracts

See:

- [data-model.md](./data-model.md) — `page_captures` schema, `recaps.mode` column, validation rules, state transitions
- [contracts/ocr-page.md](./contracts/ocr-page.md) — new edge function request/response
- [contracts/generate-recap.md](./contracts/generate-recap.md) — extended edge function (mode selection logic)
- [contracts/page-captures-rls.sql](./contracts/page-captures-rls.sql) — RLS policy + indexes
- [contracts/session-capture-field.md](./contracts/session-capture-field.md) — Vue component prop/emit contract
- [contracts/captures-store.md](./contracts/captures-store.md) — Pinia store action/state contract
- [quickstart.md](./quickstart.md) — end-to-end E2E verification walkthrough

### Constitution Re-Check (Post-Design)

- **Principle I**: Corpus prompt design (see contracts/generate-recap.md) explicitly instructs Gemini to refuse plot inference beyond captured text; the SQL `WHERE page <= current_page` filter is a hard guardrail. ✅
- **Principle II**: Capture flow only invoked after `current_page` is committed to `reading_progress`, so the page key is always edition-correct. ✅
- **Principle III**: First-token latency budget protected by (a) corpus prompt assembly happens before streaming opens, so no extra round-trip, and (b) a Phase 0 latency probe documented in research.md. ✅
- **Principle IV**: Captures table has cascade FKs to both `books` and `auth.users`; sync write semantics; no offline queueing (network required for OCR). ✅
- **Principle V**: Capture dialog is dynamic-imported in the route bundle for LastSessionCard; main bundle delta projected at <8KB gzipped. ✅

**Result: All gates still pass post-design.**

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | *(none)* | *(none)* |
