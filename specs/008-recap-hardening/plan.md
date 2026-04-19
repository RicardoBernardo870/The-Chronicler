# Implementation Plan: Bulletproof Recap Generation

**Branch**: `008-recap-hardening` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-recap-hardening/spec.md`

## Summary

Refactor the monolithic `supabase/functions/generate-recap/index.ts` into a modular structure and harden the **mid-book Recap** mode against spoilers. The hardening consists of (a) replacing the extraction prompt with a strict anti-spoiler analyst prompt that self-reports `confidence_level`, (b) replacing the recap composer prompt with a strictly-constrained "Chronicler" prompt, and (c) adding a confidence-based retry loop that reduces `currentPage` by a small buffer when confidence is `low`. The Book Blurb (page 0) and Passport Summary (completed book) modes are **relocated only** — their prompts are copied byte-for-byte into dedicated files and their handlers moved into dedicated modules with zero behavioral change. Critic/Fixer stages are explicitly out of scope. Deployment is via the Supabase MCP `deploy_edge_function` tool; the client contract (`src/services/recapService.ts`) is preserved exactly.

## Technical Context

**Language/Version**: TypeScript (Deno runtime — Supabase Edge Functions)
**Primary Dependencies**: `npm:@google/genai` (Gemini 2.5 Flash), `https://esm.sh/@supabase/supabase-js@2`
**Storage**: N/A for this feature (edge function is stateless; persistence of recaps is handled by existing client-side code)
**Testing**: Manual smoke tests via `supabase functions invoke` and frontend E2E; no unit-test harness exists for edge functions in this repo today
**Target Platform**: Supabase Edge Runtime (Deno) — project `zlndhygpqacygceivuvk`
**Project Type**: Serverless edge function (single function, multi-module)
**Performance Goals**: p95 mid-book recap (no retry) < 10 s; with one retry < 16 s (SC-005). Streaming first byte < 3 s per constitution §III.
**Constraints**:
- `verify_jwt: false` preserved; manual JWT decode remains
- Response shape for all three modes is frozen (client compatibility — FR-016, SC-006)
- Book Blurb + Passport Summary prompt strings must be byte-equivalent to current production (FR-024)
- No frontend changes permitted
- Gemini "thinking tokens" must be budgeted/disabled (FR-017)
**Scale/Scope**: Single edge function, ~8–12 modules, hundreds of invocations/day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Memory Continuity (NON-NEGOTIABLE) | ✅ PASS | Feature's entire purpose is strengthening spoiler-free guarantee. Three-tier recap shape (memory_jogger / concept_watchlist / thematic_bridge) preserved. |
| II. Physical-to-Digital Bridge | ✅ PASS | No change to ISBN/page/percentage inputs; retry uses absolute page math + % fallback inside the prompt. |
| III. AI-First Recap Engine | ✅ PASS | Prompt-level spoiler enforcement strengthened (per the analyst prompt's ANTI-SPOILER RULES + MANDATORY SELF-CHECK). Streaming preserved for Recap/Blurb/Passport. Recaps still persist client-side (no change). |
| IV. Data Integrity & Synchronization | ✅ PASS | Function remains stateless; no schema, storage, or sync changes. |
| V. PWA-First & Frictionless Portability | ✅ PASS | No frontend change; bundle size unchanged. |

**Pre-existing deviation (NOT introduced by this feature)**: Constitution §III names "Claude API (Anthropic)" but the current function uses Gemini 2.5 Flash. This deviation predates the feature and is out of scope to relitigate. Noted under Complexity Tracking for traceability only.

**Result**: Constitution Check PASSES. No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-recap-hardening/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (describes in-memory shapes; no DB schema)
├── quickstart.md        # Phase 1 output (deploy + smoke-test walkthrough)
├── contracts/
│   └── generate-recap.http.md   # Request/response contract (frozen)
├── checklists/
│   └── requirements.md
└── tasks.md             # Produced by /speckit.tasks (not this command)
```

### Source Code (repository root)

```text
supabase/functions/generate-recap/
├── index.ts                        # Thin HTTP entrypoint: CORS, JWT decode, mode router
├── types.ts                        # Shared TS types: RequestBody, ExtractionResult, RecapPayload, Mode
├── cors.ts                         # corsHeaders + OPTIONS handler
├── auth.ts                         # manualJwtDecode(authHeader) → userId | null
├── aiClient.ts                     # GoogleGenAI client factory + thinking-budget defaults
├── router.ts                       # dispatchByMode(body): 'blurb' | 'recap' | 'passport'
├── prompts/
│   ├── extraction.ts               # buildExtractionPrompt (NEW — anti-spoiler analyst)
│   ├── recap.ts                    # buildRecapPrompt (NEW — strict Chronicler)
│   ├── blurb.ts                    # buildBlurbPrompt (BYTE-EQUIVALENT copy)
│   └── passport.ts                 # buildPassportSummaryPrompt (BYTE-EQUIVALENT copy)
├── handlers/
│   ├── blurb.ts                    # Streamed JSON response (unchanged behavior)
│   ├── passport.ts                 # Streamed narrative response (unchanged behavior)
│   └── recap.ts                    # Orchestrates extraction + retry + recap streaming
├── extraction/
│   ├── runExtraction.ts            # Calls Gemini; returns parsed JSON + confidence_level
│   └── retryPolicy.ts              # Constants: MAX_ATTEMPTS, PAGE_BUFFER, clampAdjustedPage()
├── utils/
│   ├── json.ts                     # extractJson(raw) — fence-aware, null-on-fail
│   └── logging.ts                  # logStageFailure(stage, { finishReason, blockReason, ... })
└── config.toml                     # (existing) verify_jwt = false preserved
```

**Structure Decision**: Single Supabase Edge Function, multi-file layout. One `index.ts` entrypoint + topical subdirectories (`prompts/`, `handlers/`, `extraction/`, `utils/`). Each mode has its own prompt file and handler so a developer can find "the Blurb code" or "the Passport code" by filename alone (US3 acceptance criterion #4). The `extraction/` folder isolates the only novel behavior of this feature — confidence-based retry — from the shared plumbing. Deno ESM imports; no bundler config needed.

## Complexity Tracking

| Item | Why Noted | Decision |
|---|---|---|
| Constitution §III names Claude; function uses Gemini | Pre-existing discrepancy in prior features (001 / 003 / 007), not introduced here | Out of scope; migration would be a separate constitutional amendment + feature |
| Multiple subdirectories instead of flat files | Needed for US3 acceptance ("locate any module in under 2 min by filename") | Shallow two-level tree; each directory has ≤ 4 files; no circular imports |
| Passport Summary returns a plain-text stream (not JSON) | Pre-existing contract; frontend parses accordingly | Preserve exactly — FR-002 / FR-024 |
