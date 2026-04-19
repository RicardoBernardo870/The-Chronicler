# Feature Specification: Bulletproof Recap Generation

**Feature Branch**: `008-recap-hardening`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "Harden the `generate-recap` edge function against spoilers and unreliable AI output; refactor the single-file function into multiple maintainable modules; deploy via the Supabase MCP."

## Clarifications

### Session 2026-04-19

- Q: Does the hardening pipeline apply to all three generation modes in `generate-recap` (Book Blurb at page 0, mid-book Recap, Passport Summary at completion)? → A: Only the mid-book Recap mode. The Book Blurb (`// ---- Book Blurb: spoiler-free preview for readers at page 0 ----`) and Passport Summary (`// ---- Passport Summary: narrative prompt for completed book ----`) prompts and behavior remain functionally untouched; they are only relocated into the new module layout.
- Q: Which stages of the proposed Extractor → Critic → Fixer → Recap pipeline ship in v1? → A: Drop Critic and Fixer entirely. v1 scope is: refactor into modules + apply the new anti-spoiler extraction prompt + apply the new stricter recap prompt + implement confidence-level retry. Critic/Fixer are explicitly out of scope for this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spoiler-safe recap within strict page range (Priority: P1)

A reader is on page 120 of a 400-page book and taps "Generate Recap." They receive a recap covering only what has happened up to page 120 — nothing beyond, no famous future scenes, no "bridging" into upcoming chapters. If the model is uncertain, it errs on the side of omitting events rather than risking spoilers.

**Why this priority**: This is the core promise of the Chronicler. A single spoiler permanently breaks reader trust and devalues every future recap. Without this guarantee, nothing else in the pipeline matters.

**Independent Test**: Generate recaps at multiple page checkpoints (e.g., 25%, 50%, 75%) for well-known books and manually verify none of the output mentions events from later sections. A reviewer familiar with the book can confirm safety without reading any implementation code.

**Acceptance Scenarios**:

1. **Given** a reader at page 120 of 400, **When** they request a recap, **Then** the returned recap references no events, characters, or plot points that occur after page 120.
2. **Given** a reader at page 25 of a well-known novel with a famous late-book twist, **When** they request a recap, **Then** the twist is not mentioned, hinted at, or foreshadowed in any of the three recap sections.
3. **Given** an incremental recap (`fromPage=100`, `currentPage=150`), **When** generation runs, **Then** the recap describes only pages 101–150 and does not restate material already covered in earlier recaps.

---

### User Story 2 - Confidence-aware retry when the model is uncertain (Priority: P1)

When the extraction stage self-reports low confidence about staying within the page range, the system automatically retries with a smaller, safer window rather than returning questionable content to the reader.

**Why this priority**: Shared priority with US1 because it is the concrete mechanism that makes safety enforceable at runtime, not just a hope pinned on prompt wording. Without it, a single "low confidence" response leaks spoilers.

**Independent Test**: Force the extraction stage to return `confidence_level: "low"` (via a synthetic input or mocked response) and verify the system transparently retries with a reduced page window up to the configured maximum, then either succeeds or returns a safe, minimal fallback recap.

**Acceptance Scenarios**:

1. **Given** the extractor returns `confidence_level: "low"` on attempt 1, **When** the pipeline evaluates the result, **Then** it retries with the target page reduced by a small buffer (e.g., 5 pages) and a lower sampling temperature.
2. **Given** two consecutive attempts still return low confidence, **When** the retry budget is exhausted, **Then** the pipeline either (a) returns a conservative minimal recap built only from high-confidence fragments or (b) surfaces a graceful "we couldn't safely generate a recap this time" error — never a speculative recap.
3. **Given** extractor returns `confidence_level: "high"` on attempt 1, **When** the pipeline evaluates the result, **Then** no retry occurs and the extracted content flows straight to the recap stage.

---

### User Story 3 - Maintainable, modular edge-function codebase (Priority: P2)

A developer opening `supabase/functions/generate-recap/` finds the logic split across small, purpose-named files (prompts, extractor, recap composer, types, JSON utilities, HTTP/CORS wrapper) rather than one monolithic `index.ts`. Adding a new safety rule or adjusting a prompt touches a single file with a clear responsibility. The three existing generation modes (Book Blurb, mid-book Recap, Passport Summary) each live in their own prompt/module file.

**Why this priority**: Maintainability is essential for future iteration on safety rules, but not user-visible. P2 because it enables long-term velocity without blocking the P1 reader-facing guarantees.

**Independent Test**: A developer unfamiliar with the feature can locate the extraction prompt, the critic rules, and the retry policy in under two minutes by filename alone. Each module can be unit-tested in isolation with a stubbed AI client.

**Acceptance Scenarios**:

1. **Given** the refactored function, **When** a developer searches for the anti-spoiler extraction prompt, **Then** it lives in a single, clearly named file under a `prompts/` directory.
2. **Given** the refactored function, **When** a developer needs to adjust retry behavior, **Then** retry policy constants and logic live in one dedicated module and are imported by the orchestrator.
3. **Given** the refactored function, **When** the AI client is swapped or mocked, **Then** only one adapter module changes — not the extractor or recap modules.
4. **Given** the refactored function, **When** a developer inspects the Book Blurb or Passport Summary code path, **Then** each mode has its own prompt file and handler module and their runtime behavior is unchanged from the pre-refactor version.

---

### User Story 4 - Safe deployment via Supabase MCP (Priority: P3)

The refactored function deploys to the Supabase project using the Supabase MCP tooling, and the deployment preserves the existing public contract consumed by the client (`src/services/recapService.ts` and the recaps Pinia store) so no frontend changes are required.

**Why this priority**: Process and rollout hygiene. P3 because it is a one-time concern that doesn't affect runtime behavior once shipped.

**Independent Test**: After MCP-driven deploy, the existing frontend recap flow works end-to-end against the new function without any client-side change, and logs show the new multi-stage pipeline executing.

**Acceptance Scenarios**:

1. **Given** the new multi-file function, **When** it is deployed via Supabase MCP, **Then** all modules are bundled and the edge function boots without runtime module-resolution errors.
2. **Given** the function is live, **When** the existing client calls it with unchanged request shape, **Then** the response shape matches what the client expects today (memory_jogger, concept_watchlist, thematic_bridge).
3. **Given** a deployment, **When** diagnostics are needed, **Then** edge-function logs include stage-tagged entries (extractor / critic / fixer / recap) and retry counts.

---

### Edge Cases

- **Very short books (totalPages < 30)**: Retry-with-smaller-window buffer could reduce `currentPage` to a negative or nonsensical value. Pipeline MUST clamp the adjusted page to a minimum (e.g., ≥ 1) and, if clamping collides with `fromPage`, abort retries and fall back to the conservative-minimal path.
- **Incremental recap with `fromPage` very close to `currentPage`** (e.g., 5-page delta): Not enough surface for meaningful extraction. Pipeline MUST still produce a safe, short recap or a graceful "not enough new material" response.
- **Model returns malformed/non-JSON output**: JSON-parse failure MUST NOT surface a 500 to the reader when a retry is still available; retries exhausted → graceful error response with diagnostic logging.
- **Model returns safety-blocked content** (blockReason from provider): Treated as a hard failure — do NOT retry with smaller window (retrying will not change policy outcomes); return a graceful error and log the block reason.
- **Timeout / partial completion**: If any stage exceeds its per-stage budget, the pipeline aborts with a graceful error; it never ships a partially completed recap.
- **Book Blurb / Passport Summary regressions**: Because these modes are moved but not rewritten, their unchanged-behavior guarantee is a primary regression-test target.

## Requirements *(mandatory)*

### Functional Requirements

**Scope guard — modes that remain functionally untouched**

- **FR-001**: The Book Blurb mode (currently delimited by `// ---- Book Blurb: spoiler-free preview for readers at page 0 ----`) MUST be relocated into its own module without any behavioral or prompt-content changes.
- **FR-002**: The Passport Summary mode (currently delimited by `// ---- Passport Summary: narrative prompt for completed book ----`) MUST be relocated into its own module without any behavioral or prompt-content changes.
- **FR-003**: Only the mid-book Recap mode receives the new extraction prompt, the new recap prompt, and the confidence-based retry cycle.

**Extraction stage (mid-book Recap only)**

- **FR-004**: The system MUST prompt the extractor to describe only events within a bounded page range (`fromPage+1` through `currentPage`) and explicitly forbid bridging into later material.
- **FR-005**: The extractor MUST return a structured JSON object containing at minimum: `chapters_covered`, `key_events`, `active_characters`, `current_conflicts`, `mood`, and `confidence_level` (one of `high | medium | low`).
- **FR-006**: The extractor MUST be instructed to omit events it is not certain fall within the range, preferring under-reporting to over-reporting.
- **FR-007**: The extractor MUST be called with a low sampling temperature (e.g., 0.3) to reduce speculative output.

**Confidence-based retry (mid-book Recap only)**

- **FR-008**: When the extractor returns `confidence_level: "low"`, the orchestrator MUST retry with `currentPage` reduced by a small, configurable buffer (default: 5 pages).
- **FR-009**: The orchestrator MUST cap retries at a configurable maximum (default: 2 attempts after the initial call) and MUST NOT retry indefinitely.
- **FR-010**: The orchestrator MUST clamp the adjusted page so it never falls below `fromPage + 1` or below 1; if clamping would collide with `fromPage`, retries MUST stop immediately.
- **FR-011**: When retries are exhausted and confidence remains `low`, the function MUST return a graceful error response (not a speculative recap) with a clear detail message; a future iteration MAY replace this with a conservative minimal recap.
- **FR-012**: Provider-side safety blocks (non-empty `blockReason`) MUST NOT trigger the low-confidence retry path and MUST produce a graceful error immediately.
- **FR-013**: A malformed/non-JSON extractor response MUST NOT surface a 500 to the client while retry budget remains; the orchestrator MUST retry first.

**Recap stage (mid-book Recap only)**

- **FR-014**: The Recap stage MUST consume only the extractor's structured output and MUST be prompted to use no external knowledge and to not infer future events.
- **FR-015**: The Recap stage MUST return JSON with `memory_jogger` (≤ 600 chars, 2–4 sentences), `concept_watchlist` (comma-separated, ≤ 13 items), and `thematic_bridge` (1–2 sentences).
- **FR-016**: The Recap stage response shape MUST remain backward-compatible with the existing client (`src/services/recapService.ts` and the recaps Pinia store) so no frontend change is required.

**Robustness & observability**

- **FR-017**: Each stage MUST have a bounded output-token budget and the function MUST explicitly disable (or account for) Gemini "thinking tokens" so visible output is never starved.
- **FR-018**: On any stage failure the function MUST log a structured diagnostic entry tagged with the stage name (`extractor` / `recap` / `blurb` / `passport`), including `finishReason`, `blockReason`, retry count, and a bounded raw-text preview.
- **FR-019**: The function MUST return CORS-compliant responses consistent with the current function so existing preflight behavior is preserved.
- **FR-020**: The function MUST never return HTTP 500 for a recoverable condition while retries remain; it MUST exhaust retries first.

**Modularization (applies to all three modes)**

- **FR-021**: The function codebase MUST be split into purpose-named modules covering at minimum: HTTP/CORS entrypoint, mode router (Blurb / Recap / Passport), prompts, extractor, recap composer, Blurb handler, Passport handler, JSON extraction utilities, AI client adapter, types, and retry-policy constants.
- **FR-022**: Each module MUST have a single responsibility and MUST be importable by the router/orchestrator without circular dependencies.
- **FR-023**: Prompt strings MUST live in dedicated files under a `prompts/` subdirectory, with one file per prompt (extractor prompt, recap prompt, Book Blurb prompt, Passport Summary prompt).
- **FR-024**: The Book Blurb and Passport Summary prompt strings MUST be byte-equivalent to the current production prompts after relocation (no wording changes in this feature).

**Deployment**

- **FR-025**: Deployment MUST be performed via the Supabase MCP `deploy_edge_function` tool, bundling all modules.
- **FR-026**: The deployment MUST preserve the existing `verify_jwt` behavior of the current function unless an explicit decision to change it is recorded.

### Key Entities *(include if feature involves data)*

- **ExtractionResult**: Structured output of the extractor stage — `chapters_covered`, `key_events`, `active_characters`, `current_conflicts`, `mood`, `confidence_level`. Used directly as input to the Recap stage.
- **RecapPayload**: Final recap returned to the client — `memory_jogger`, `concept_watchlist`, `thematic_bridge`. Shape-compatible with existing client contract.
- **RetryPolicy**: Configuration object holding `maxAttempts`, `pageBuffer`, and (optional) temperature adjustment, consumed by the orchestrator.
- **ModeRouter**: Dispatches an incoming request to one of three handlers — Book Blurb (page 0), mid-book Recap (the hardened path), or Passport Summary (completed book) — based on the existing request parameters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a spoiler-audit test set of at least 20 recap generations across ≥ 5 well-known books at varied page checkpoints, zero recaps contain events from beyond the reader's current page (reviewer-verified).
- **SC-002**: When the extractor self-reports low confidence, the pipeline retries with a reduced window in 100% of cases, up to the configured maximum, with zero speculative recaps reaching the reader.
- **SC-003**: The "No JSON block found in response" class of failures (observed in the sibling `generate-lore` function) occurs in under 1% of successful-upstream recap requests after this feature ships.
- **SC-004**: A developer can locate the extraction prompt, Critic rules, Fixer logic, and retry policy by filename alone in under 2 minutes.
- **SC-005**: End-to-end mid-book recap generation (no retry) completes in under 10 seconds at the 95th percentile; with one retry, under 16 seconds at p95.
- **SC-008**: Book Blurb and Passport Summary responses after the refactor are semantically equivalent to pre-refactor responses for the same inputs (spot-check: at least 5 samples per mode show no prompt-driven behavioral regression).
- **SC-006**: Zero frontend code changes required: existing `src/services/recapService.ts` and recaps store continue to work against the new function without modification.
- **SC-007**: Edge-function logs include stage-tagged entries for 100% of requests, enabling per-stage failure attribution.

## Assumptions

- The existing Gemini 2.5 Flash model remains the AI provider for all stages; different stages may use different temperatures and token budgets but the same model family.
- Reader progress inputs (`title`, `author`, `isbn`, `fromPage`, `currentPage`, `totalPages`) already arrive in the function request body in the current shape and do not change.
- The final client-facing response shape (`memory_jogger`, `concept_watchlist`, `thematic_bridge`) is preserved exactly; no consumer-side migration.
- Critic and Fixer stages are explicitly OUT OF SCOPE for this feature and may be considered in a future iteration.
- The existing Supabase project and its secrets (Gemini API key) are reused; no new infrastructure.
- "Low confidence" retry reduces `currentPage` by a small buffer (default 5 pages); exact buffer and retry count are tunable constants and do not require a spec revision.
- Book Blurb and Passport Summary prompt strings are copied byte-for-byte from the current `index.ts` into their new prompt files.

## Dependencies

- Supabase MCP `deploy_edge_function` tool must be authorized for the target project.
- Gemini API key already present in Supabase function secrets.
- Existing client contract in `src/services/recapService.ts` defines the preserved response shape.
