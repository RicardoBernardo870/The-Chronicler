---

description: "Task list for 008-recap-hardening"
---

# Tasks: Bulletproof Recap Generation

**Input**: Design documents from `/specs/008-recap-hardening/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/generate-recap.http.md, quickstart.md

**Tests**: None requested in the spec. Verification is manual via `quickstart.md` smoke tests + spoiler audit.

**Organization**: Tasks grouped by user story so each can be delivered independently. Modularization is split — the shared scaffold lives in Foundational (Phase 2) because US1/US2 cannot ship without it; the behavior-preserving relocation of Blurb/Passport prompts + handlers is User Story 3's own work.

## Format: `[ID] [P?] [Story] Description`

- **[P]** = can run in parallel (different files, no dep on incomplete tasks)
- **[Story]** = US1 / US2 / US3 / US4
- Absolute-from-repo-root paths

## Path Conventions

Edge function root: `supabase/functions/generate-recap/`
All new modules live under that directory.

---

## Phase 1: Setup

**Purpose**: Create the new directory layout and the feature branch is already in place (`008-recap-hardening`).

- [X] T001 Create directory structure `supabase/functions/generate-recap/{prompts,handlers,extraction,utils}/` and confirm `config.toml` is untouched
- [X] T002 Take a verbatim copy of the current `supabase/functions/generate-recap/index.ts` to `supabase/functions/generate-recap/index.legacy.ts` as a rollback reference (this file will NOT be deployed and will be deleted in polish)

---

## Phase 2: Foundational (Blocking prerequisites for ALL user stories)

**Purpose**: Shared scaffolding that every story imports. No business logic changes yet — this phase is pure structure + the thin orchestrator. On completion, running the function MUST still behave exactly as production (because the handler modules in this phase forward to the legacy prompt strings until US1/US2/US3 swap them).

- [X] T003 [P] Create `supabase/functions/generate-recap/types.ts` exporting `Mode`, `RequestBody`, `ExtractionResult`, `RecapPayload`, `StageLogEntry` per `data-model.md`
- [X] T004 [P] Create `supabase/functions/generate-recap/cors.ts` exporting `corsHeaders` + `handleOptions(req)` (returns preflight 200 or null)
- [X] T005 [P] Create `supabase/functions/generate-recap/auth.ts` exporting `manualJwtDecode(authHeader: string): string | null` — lifts the existing JWT-split/atob logic from legacy `index.ts`
- [X] T006 [P] Create `supabase/functions/generate-recap/aiClient.ts` exporting `createGeminiClient()` (reads `GEMINI_API_KEY`) + constant `DEFAULT_THINKING_CONFIG = { thinkingBudget: 0 }` per research.md Decision 3
- [X] T007 [P] Create `supabase/functions/generate-recap/utils/json.ts` exporting `extractJson(raw: string): string | null` — fence-aware, `{...}` slice fallback, null on total failure (mirrors the `generate-lore` v11 primitive)
- [X] T008 [P] Create `supabase/functions/generate-recap/utils/logging.ts` exporting `logStageFailure(entry: StageLogEntry): void` — single `console.error(JSON.stringify(entry))` with raw-text preview capped at 500 chars
- [X] T009 Create `supabase/functions/generate-recap/router.ts` exporting `resolveMode(body: RequestBody): Mode` with rules: `body.mode === 'passport_summary'` → `passport_summary`; `currentPage === 0` → `blurb`; else `recap`
- [X] T010 Rewrite `supabase/functions/generate-recap/index.ts` as a thin entrypoint: `Deno.serve` handler that: handles OPTIONS via `cors.ts`, validates Authorization via `auth.ts`, parses & validates body fields (`title`, `author`, `totalPages`, `percentage` required → 400), resolves mode via `router.ts`, then delegates to the appropriate handler. Preserves current 400/401/503 error shapes from `contracts/generate-recap.http.md`.
- [X] T011 [P] Create `supabase/functions/generate-recap/handlers/blurb.ts` — TEMPORARY SCAFFOLD: imports the legacy blurb prompt string inline and streams the Gemini response exactly as legacy index.ts does. Will be finalized in US3.
- [X] T012 [P] Create `supabase/functions/generate-recap/handlers/passport.ts` — TEMPORARY SCAFFOLD: imports the legacy passport prompt string inline and streams the Gemini response exactly as legacy index.ts does. Will be finalized in US3.
- [X] T013 [P] Create `supabase/functions/generate-recap/handlers/recap.ts` — TEMPORARY SCAFFOLD: imports the legacy extraction + recap prompt strings inline and replicates legacy two-pass flow exactly (no retry yet). Will be replaced by US1 + US2.

**Checkpoint**: Function type-checks, can be deployed, and behaves exactly like production. Ready for independent story delivery.

---

## Phase 3: User Story 1 — Spoiler-safe recap within strict page range (P1)

**Goal**: Replace the extraction prompt and recap prompt with the new strict versions from the spec. On completion, mid-book recaps are visibly more conservative and the extractor response includes `confidence_level`, though no retry behavior is present yet.

**Independent Test**: Request a recap at e.g. page 120/400 for a well-known book; inspect the streamed JSON and verify: (a) no spoilers past page 120, (b) recap text shows the new stricter phrasing (no invented events when extractor is sparse), (c) edge-function logs include an `extractor` entry with a `confidence_level` field.

- [X] T014 [P] [US1] Create `supabase/functions/generate-recap/prompts/extraction.ts` exporting `buildExtractionPrompt(fromPage: number, currentPage: number, totalPages: number): string` with EXACT body supplied in user input (includes CRITICAL CONSTRAINT, ANTI-SPOILER RULES, SCOPE, GUIDELINES, EDITION UNCERTAINTY HANDLING, MANDATORY SELF-CHECK, OUTPUT FORMAT with `confidence_level` field)
- [X] T015 [P] [US1] Create `supabase/functions/generate-recap/prompts/recap.ts` exporting `buildRecapPrompt(): string` with EXACT body supplied in user input (Chronicler preamble, CRITICAL rules, OUTPUT JSON ONLY with `memory_jogger` ≤600 chars, `concept_watchlist` ≤13 items, `thematic_bridge`)
- [X] T016 [US1] Create `supabase/functions/generate-recap/extraction/runExtraction.ts` exporting `runExtraction(ai, params: { title, author, isbn?, fromPage, currentPage, totalPages, percentage }): Promise<{ result: ExtractionResult | null, raw: string, rawJson: string | null }>` — single Gemini call with `temperature: 0.3`, `maxOutputTokens: 8192`, `thinkingConfig: { thinkingBudget: 0 }`, `systemInstruction: buildExtractionPrompt(...)`. Parses via `utils/json.ts`. Returns `{ result: null, ... }` on parse failure.
- [X] T017 [US1] Rewrite `supabase/functions/generate-recap/handlers/recap.ts`: replace the legacy two-pass scaffold with: (1) call `runExtraction()` once, (2) on parse failure OR missing `confidence_level`, log via `logStageFailure` and return 500 `{ error: "AI output invalid", detail: "No JSON block found in response" }`, (3) on success, pass `rawJson` as the recap-stage user message, systemInstruction = `buildRecapPrompt()`, `temperature: 0.7`, `maxOutputTokens: 4096`, `thinkingConfig: { thinkingBudget: 0 }`, stream response unchanged. No retry yet — retry lands in US2.
- [X] T018 [US1] Remove the legacy extraction + legacy recap prompt strings from `handlers/recap.ts` (they were inline during foundational scaffolding); confirm the file imports ONLY from `prompts/extraction.ts`, `prompts/recap.ts`, `extraction/runExtraction.ts`, `utils/json.ts`, `utils/logging.ts`, `aiClient.ts`, `types.ts`

**Checkpoint**: US1 deliverable. Extractor now self-reports confidence. Recap content observably stricter. Blurb and Passport still pass through the Phase-2 scaffolds unchanged.

---

## Phase 4: User Story 2 — Confidence-aware retry (P1)

**Goal**: Add confidence-based retry on top of US1. Pipeline retries up to 2 extra attempts with `currentPage` reduced by 5 pages each, and returns a graceful error rather than a speculative recap when retries are exhausted.

**Independent Test**: Force a low-confidence response (e.g., obscure book + extreme page); inspect logs for `attempt=0 confidence_level=low` then `attempt=1 adjustedPage=…` then either `attempt=2` or `confidence_level=high|medium`. If all attempts stay low → response is 500 with `{ error: "AI output invalid", detail: "Low extraction confidence after retries" }` — never a streamed recap.

**Depends on**: US1 complete (uses `runExtraction`, `buildExtractionPrompt`, `handlers/recap.ts`)

- [X] T019 [US2] Create `supabase/functions/generate-recap/extraction/retryPolicy.ts` exporting constants `MAX_ATTEMPTS = 2`, `PAGE_BUFFER = 5`, `TEMPERATURE = 0.3` and helper `computeAdjustedPage(currentPage: number, fromPage: number, attempt: number): number | null` that returns `max(currentPage - PAGE_BUFFER*attempt, fromPage+1, 1)` OR `null` if the result would not strictly advance past `fromPage` (signal to abort retries)
- [X] T020 [US2] Update `supabase/functions/generate-recap/handlers/recap.ts` to wrap `runExtraction` in a `while (attempt <= MAX_ATTEMPTS)` loop: on `confidence_level === 'low'` OR parse failure, call `computeAdjustedPage(...)`; if `null` → break and emit graceful error; otherwise increment attempt and re-run `runExtraction` with the adjusted page. On non-null `blockReason` from Gemini response → log and return 500 immediately (no retry, per research.md Decision 4)
- [X] T021 [US2] Update `supabase/functions/generate-recap/extraction/runExtraction.ts` to also surface `finishReason`, `blockReason`, `safetyRatings`, `usage` in its return value so `handlers/recap.ts` can route on them and pass them to `logStageFailure`
- [X] T022 [US2] Update `utils/logging.ts` call sites in `handlers/recap.ts` to emit one `StageLogEntry` per attempt (stage: `'extractor'`) and one per recap-stage failure (stage: `'recap'`), including `attempt` and bounded `rawTextPreview`
- [X] T023 [US2] When retries exhausted with confidence still `low`, return 500 JSON `{ error: "AI output invalid", detail: "Low extraction confidence after retries", finishReason?, blockReason? }` matching contract doc

**Checkpoint**: US2 deliverable. US1 + US2 = the full hardening. The function now refuses to emit a speculative recap.

---

## Phase 5: User Story 3 — Maintainable, modular edge-function codebase (P2)

**Goal**: Finish the refactor. Book Blurb and Passport Summary modes move from the temporary Phase-2 scaffolds into dedicated prompt + handler files. Their runtime behavior remains identical (byte-equivalent prompt strings).

**Independent Test**: (a) Byte-count the new prompt files and confirm they equal the legacy strings; (b) a developer locates extraction prompt, recap prompt, blurb prompt, passport prompt, retry policy each in < 30 seconds by filename; (c) 5 Blurb requests + 5 Passport requests produce semantically equivalent outputs compared to the legacy function for the same inputs (SC-008).

**Depends on**: Phase 2 scaffolds present (handlers exist). Independent of US1 and US2.

- [X] T024 [P] [US3] Create `supabase/functions/generate-recap/prompts/blurb.ts` exporting `buildBlurbPrompt(): string`. The string MUST be byte-for-byte equal to the current `buildBlurbPrompt` body in the legacy index.ts (`// ---- Book Blurb: spoiler-free preview for readers at page 0 ----` block). Verify by copying from `index.legacy.ts`.
- [X] T025 [P] [US3] Create `supabase/functions/generate-recap/prompts/passport.ts` exporting `buildPassportSummaryPrompt(title: string, author: string): string`. The string MUST be byte-for-byte equal to the current `buildPassportSummaryPrompt(title, author)` body in the legacy index.ts (`// ---- Passport Summary: narrative prompt for completed book ----` block). Verify by copying from `index.legacy.ts`.
- [X] T026 [US3] Rewrite `supabase/functions/generate-recap/handlers/blurb.ts` to remove the inline legacy prompt and import from `prompts/blurb.ts`. Keep the streaming config identical to legacy: model `gemini-2.5-flash`, `temperature: 0.7`, `maxOutputTokens: 4096`, `thinkingConfig: { thinkingBudget: 0 }`, same user-message format, same `text/plain` streaming response with `Cache-Control: no-cache`.
- [X] T027 [US3] Rewrite `supabase/functions/generate-recap/handlers/passport.ts` to remove the inline legacy prompt and import from `prompts/passport.ts`. Keep the streaming config identical to legacy: `temperature: 0.8`, `maxOutputTokens: 4096`, `thinkingConfig: { thinkingBudget: 0 }`, same user-message format, same `text/plain` streaming response with `Cache-Control: no-cache`.
- [X] T028 [US3] Grep `supabase/functions/generate-recap/` for any remaining references to the legacy inline prompt strings outside `index.legacy.ts` and delete them; confirm no circular imports (`index.ts` → `router.ts` / `handlers/*` only)

**Checkpoint**: US3 deliverable. The function is fully modularized, Blurb and Passport behavior is preserved, and a developer can navigate by filename.

---

## Phase 6: User Story 4 — Safe deployment via Supabase MCP (P3)

**Goal**: Ship. Deploy the multi-file function to Supabase project `zlndhygpqacygceivuvk` using the MCP tool while preserving `verify_jwt: false` and the client contract.

**Independent Test**: All 6 smoke tests from `quickstart.md` pass against the deployed function; `mcp__supabase__get_edge_function` returns a function with the expected file list; existing frontend (`src/services/recapService.ts`) receives unchanged response shapes for all three modes.

**Depends on**: US1, US2, US3 complete.

- [X] T029 [US4] Delete `supabase/functions/generate-recap/index.legacy.ts` (rollback copy no longer needed; git history preserves it)
- [X] T030 [US4] Run `deno check supabase/functions/generate-recap/index.ts` locally and resolve any type errors
- [X] T031 [US4] Deploy via `mcp__supabase__deploy_edge_function` with slug `generate-recap`, `verify_jwt: false`, and the full `files` array: `index.ts`, `cors.ts`, `auth.ts`, `types.ts`, `aiClient.ts`, `router.ts`, `utils/json.ts`, `utils/logging.ts`, `prompts/extraction.ts`, `prompts/recap.ts`, `prompts/blurb.ts`, `prompts/passport.ts`, `handlers/blurb.ts`, `handlers/passport.ts`, `handlers/recap.ts`, `extraction/runExtraction.ts`, `extraction/retryPolicy.ts`
- [X] T032 [US4] Run all 6 smoke tests in `specs/008-recap-hardening/quickstart.md` (Blurb, happy-path Recap, forced low-confidence Recap, incremental Recap with `from_page`, Passport Summary, error paths) and capture results
- [X] T033 [US4] Fetch recent logs via `mcp__supabase__get_logs` for service `edge-function` and confirm every successful recap call produced an `extractor` log entry, and that forced low-confidence calls show the retry progression

**Checkpoint**: US4 deliverable — feature live in production.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T034 Run the spoiler audit from `specs/008-recap-hardening/quickstart.md` (5 well-known books × 3 page checkpoints = 15 generations minimum; target SC-001 ≥ 20) and record pass/fail in a new `specs/008-recap-hardening/spoiler-audit.md`
- [ ] T035 [P] Update `specs/008-recap-hardening/checklists/requirements.md` to mark any items that were deferred during implementation and note actuals vs. targets for SC-005 (p95 latency)
- [ ] T036 [P] Verify the frontend recap flow end-to-end in the running app (request recap for an in-progress book, confirm streaming UI renders the three sections correctly) — zero code changes expected in `src/services/recapService.ts` or any recap store
- [ ] T037 Commit via `/speckit.git.commit` (or manual) with a message summarizing the 008-recap-hardening shipment

---

## Dependencies

```
Setup (T001–T002)
   │
   ▼
Foundational (T003–T013)  ◀── blocks everything below
   │
   ├────────────────┬─────────────────┬─────────────────┐
   ▼                ▼                 ▼                 ▼
 US1 (T014–T018)   US3 (T024–T028)   (US4 depends on US1+US2+US3)
   │                │
   ▼                │
 US2 (T019–T023)    │
   │                │
   └────────┬───────┘
            ▼
         US4 (T029–T033)
            ▼
         Polish (T034–T037)
```

- **US1 ⇒ US2**: US2 extends the retry loop around `runExtraction` / `handlers/recap.ts` produced in US1.
- **US3 ∥ US1+US2**: US3 only touches Blurb/Passport modules — no file conflict with US1/US2.
- **US4 ⇐ US1 + US2 + US3**: Deploy requires the full set of modules.

## Parallel execution examples

Within Foundational (after T001–T002 done):

```
Run in parallel: T003, T004, T005, T006, T007, T008, T011, T012, T013
```

Within US1 (after Phase 2 checkpoint):

```
Run in parallel: T014, T015   # prompt files, independent
Then sequential: T016 → T017 → T018
```

Within US3 (independent of US1/US2 in parallel flow):

```
Run in parallel: T024, T025   # prompt copies, independent
Then sequential: T026, T027 (both touch the same aiClient but different handler files → T026 ∥ T027 OK)
Then: T028
```

## Implementation strategy

**MVP (US1 + US2)**: Delivers the entire spoiler-safety hardening. If time is constrained, US3 can be deferred — the Phase-2 scaffolds already work end-to-end — and the refactor ships as a v1.1. US4 is required for any shipment.

**Recommended order**: Foundational → US1 → US2 → US3 → US4 → Polish. This produces a single coherent deploy with all acceptance criteria met.

**Alternate incremental delivery**:
1. Ship Foundational alone behind a feature flag: zero behavioral change, validates the refactor is safe (doesn't risk regressions in Blurb/Passport).
2. Ship US1 + US2: spoiler hardening live.
3. Ship US3 + US4: finalize module layout.

## Format validation

All tasks follow the checklist format:

- ✅ Every task begins with `- [ ]`
- ✅ Every task has a `Txxx` ID in execution order
- ✅ `[P]` used only where files differ and deps are satisfied
- ✅ `[US1]`/`[US2]`/`[US3]`/`[US4]` on every user-story phase task; no story label on Setup/Foundational/Polish tasks
- ✅ Every task names an exact file path or executable action
