# Phase 0 Research: Bulletproof Recap Generation

**Feature**: 008-recap-hardening
**Date**: 2026-04-19

No `NEEDS CLARIFICATION` markers remain after `/speckit.clarify`. Research below captures the decisions backing the Technical Context in `plan.md`.

## Decision 1 — Retry policy constants

**Decision**: `MAX_ATTEMPTS = 2` (i.e. up to 2 retries after the initial extraction, for a max of 3 Gemini calls in the extraction stage); `PAGE_BUFFER = 5` pages reduction per retry; extractor temperature fixed at `0.3` for all attempts (simpler than a temperature schedule and already validated by the user's proposed prompt).

**Rationale**:
- Matches the sample retry snippet the user provided (`attempt < 2` → up to 2 retries).
- A 5-page buffer is small enough not to materially strip reader-relevant context, large enough to move meaningfully away from a just-crossed scene boundary.
- Keeps p95 latency within SC-005's 16 s budget even on the worst case (3 extraction calls + 1 recap stream).

**Alternatives considered**:
- Temperature schedule (0.3 → 0.2 → 0.1): marginal safety gain, extra config surface, rejected.
- Larger buffer (10 pages): risks producing empty extractions on short books, rejected.
- Unlimited retries: rejected on latency and cost grounds.

## Decision 2 — Retry clamp behavior

**Decision**: On each retry, compute `adjustedPage = max(currentPage - PAGE_BUFFER * attempt, fromPage + 1, 1)`. If `adjustedPage` would not strictly advance past `fromPage`, abort retries and return a graceful error (FR-010, FR-011).

**Rationale**: Prevents degenerate retries on short books or when the delta window (`currentPage - fromPage`) is already small. Matches spec edge case "Very short books."

**Alternatives considered**:
- Silently return empty recap: rejected — violates SC-001 expectation of explicit handling.
- Retry without clamp: would yield negative or nonsensical pages.

## Decision 3 — "Thinking token" handling

**Decision**: Set `config.thinkingConfig = { thinkingBudget: 0 }` on Gemini 2.5 Flash calls, and keep `maxOutputTokens = 8192` for extraction, `4096` for recap/blurb/passport.

**Rationale**:
- The sibling `generate-lore` function exhibited intermittent empty-text responses traced to thinking-token starvation of the visible-output budget (documented in this session's earlier work).
- Disabling thinking is safe for structured-JSON and streaming-narrative outputs the function produces; thinking primarily helps with multi-step reasoning the Chronicler doesn't require.

**Alternatives considered**:
- Raise `maxOutputTokens` to 16384: would reduce starvation but doubles worst-case latency.
- Leave thinking enabled: root cause of the lore-generation failure mode documented earlier; rejected.

## Decision 4 — Provider safety blocks vs low-confidence retries

**Decision**: Treat non-empty `promptFeedback.blockReason` as terminal. Return a graceful 4xx-style JSON error (`{ error: "AI output invalid", blockReason }`) without consuming retry budget (FR-012).

**Rationale**: Block reasons are policy outcomes; re-issuing the same input gets the same block. Retrying wastes time and money.

**Alternatives considered**:
- Retry with smaller window even on block: usually still blocks, rejected.

## Decision 5 — Malformed-JSON recovery

**Decision**: `extractJson(raw)` attempts fenced-block, then `{...}` slice, then `JSON.parse` on the raw. If all fail and `confidence_level` cannot be inferred, treat as if confidence was `low` and consume one retry slot (FR-013).

**Rationale**: Reuses the `extractJson` primitive already deployed in `generate-lore`. Consistent with the retry budget — recoverable conditions don't surface HTTP 500 while retries remain.

## Decision 6 — Preserving streaming for the Recap mode

**Decision**: Keep the current streaming response contract for mid-book Recap. The extraction stage is a **non-streaming** `generateContent` call (because we need to inspect `confidence_level` before streaming). Only the final composer call uses `generateContentStream`, matching today's behavior.

**Rationale**:
- Client contract requires streaming text that parses to JSON at end (`src/services/recapService.ts` and `useRecaps*` stores already handle this shape).
- Streaming the extractor would prevent confidence inspection.
- p95 streaming first-byte ≤ 3 s constitution requirement is preserved — first byte begins from the composer call, after the (potentially retried) extractor resolves. Extraction max 3 calls × ~2 s each ≈ 6 s worst-case before first byte; acceptable per SC-005 (< 16 s end-to-end at p95 with retry).

**Alternatives considered**:
- Stream both stages and parse confidence mid-stream: complex, fragile, rejected.
- Non-streaming final response: breaks the "streaming first byte" feel already in the UI.

## Decision 7 — Module organization (TypeScript / Deno)

**Decision**: Use top-level directories `prompts/`, `handlers/`, `extraction/`, `utils/`, plus flat files `types.ts`, `cors.ts`, `auth.ts`, `aiClient.ts`, `router.ts`, `index.ts`. ESM relative imports (`./prompts/extraction.ts`). No bundler — Supabase Edge Functions support the layout natively.

**Rationale**: Matches the FR-021 module list exactly; keeps each directory ≤ 4 files (US3 discoverability).

**Alternatives considered**:
- Flat files only: poor discoverability, fails US3.
- Deeper nesting (e.g., `extraction/prompts/…`): unnecessary for this surface area.

## Decision 8 — Deployment pipeline

**Decision**: Use Supabase MCP `mcp__supabase__deploy_edge_function` with the full file manifest. No `supabase functions deploy` CLI run in this repo; MCP is the system of record (FR-025).

**Rationale**: User explicitly requested MCP. The MCP tool accepts a `files` array so multi-file deployment is trivial.

## Decision 9 — Backward-compatibility of client contract

**Decision**: Response body shapes remain:
- Mode `blurb` → streaming `text/plain` containing a JSON object with `memory_jogger`, `concept_watchlist`, `thematic_bridge`.
- Mode `recap` → same streaming JSON shape.
- Mode `passport_summary` → streaming `text/plain` narrative paragraph.

**Rationale**: Zero frontend change requirement (SC-006). The existing stores (`src/stores/recaps.ts` etc.) parse trimmed streamed text as JSON for Blurb/Recap and as plain text for Passport.

## Decision 10 — Logging format

**Decision**: On any extractor/recap failure path, emit a single `console.error` with a JSON payload `{ stage, attempt, finishReason, blockReason, safetyRatings, usage, rawTextLength, rawTextPreview }` (preview ≤ 500 chars).

**Rationale**: Matches the diagnostic pattern deployed in `generate-lore` v13 during this session; proven useful for root-causing similar failures. Satisfies FR-018.

---

**Outcome**: All decisions resolved. Ready for Phase 1.
