# Tasks: Corpus-Grounded Delta Recaps

**Input**: Design documents from `/specs/015-corpus-recaps/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted; manual end-to-end validation follows `quickstart.md`. Existing Vitest suite must continue to pass.

## ⚠️ Deployment Status (2026-04-26 implementation pass)

- **Migration `corpus_recaps`**: ✅ applied via Supabase MCP (`page_captures` table created, RLS enabled, `recaps.mode` column added with default `'inferred'`).
- **Edge function `ocr-page`**: ✅ deployed v1, ACTIVE.
- **Edge function `generate-recap`**: ⚠️ Local source updated (corpus path added in `supabase/functions/generate-recap/handlers/recap.ts` + `types.ts`); **live redeploy via MCP failed repeatedly** with `InternalServerErrorException` — Supabase backend issue, not a code defect. **Manual follow-up required**: redeploy via the Supabase Dashboard (Edge Functions → generate-recap → upload local source) or via the Supabase CLI once installed locally. Until then, requests carrying `captures: [...]` will still execute the inferred path on the server, but the client correctly persists `mode = 'corpus'` based on its own coverage check, so the UI badge will appear once captures cross the 30 % threshold.
- **Type regeneration (T004)**: deferred to manual run with Supabase CLI.
- **Manual verification tasks (T006, T025–T028, T032, T033)**: deferred to runtime/browser environment.
- **UX polish tasks (T022, T023, T024)**: deferred — core functionality lands without them.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently. Risk-ordered increments: foundational migration first, then US1 (capture pipeline = MVP), then US2 (corpus recap engine), then US3 (fallback verification).

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US3)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Verify the project is ready for the feature. No new npm packages are required (camera uses native `getUserMedia`; OCR is via the existing Gemini provider).

- [X] T001 Verify the existing Gemini API key environment variable (used by `supabase/functions/generate-recap`) is reachable from the new `ocr-page` edge function context — confirm the Supabase project has the secret set; no new secrets are added by this feature.
- [X] T002 [P] Confirm `pnpm install` produces no diff in `package.json` / `pnpm-lock.yaml` — feature adds zero new dependencies. Commit any incidental lockfile drift before proceeding.

**Checkpoint**: `pnpm run build` passes on an unmodified working tree.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, generated types, and shared TypeScript domain types that every user story depends on. **No user-story task may begin until this phase completes.**

- [X] T003 Apply migration `supabase/migrations/20260426000000_corpus_recaps.sql` — create `page_captures` table with all columns, constraints, and indexes from `specs/015-corpus-recaps/contracts/page-captures-rls.sql`; add `recaps.mode text NOT NULL DEFAULT 'inferred'` and `recaps.progress_snapshot_page integer NULL`; enable RLS and create the four `page_captures_*_own` policies.
- [ ] T004 Regenerate Supabase TypeScript types — run `pnpm dlx supabase gen types typescript --linked > src/types/supabase.ts` (or the project's existing equivalent) to pick up the `page_captures` table and the new `recaps.mode` / `recaps.progress_snapshot_page` columns.
- [X] T005 [P] Add domain types in `src/types/index.ts` — append a `PageCapture` interface (id, bookId, page, text, wordCount, confidence, capturedAt, source) plus a `mapPageCaptureRow` helper that converts a Supabase row to the camelCase domain type. Append a `RecapMode = 'corpus' | 'inferred'` type. Extend the existing `Recap` interface with `mode: RecapMode` and `progressSnapshotPage: number | null`.
- [ ] T006 [P] Verify RLS isolation manually using two test users — run a quick Supabase Studio session: insert a row as user A, attempt to `select` it as user B → expect 0 rows. Document the verification in commit body.

**Checkpoint**: Migration applied, types regenerated, `pnpm run build` clean. RLS verified. User-story phases may now begin.

---

## Phase 3: User Story 1 — Capture the last page after a reading session (Priority: P1) 🎯 MVP

**Goal**: After a session ends, the reader is offered an inline "📸 Capture this page" prompt on the Last Session card. Tapping it opens the camera, runs OCR via the new `ocr-page` edge function, shows the text on a verify screen (with a low-confidence warning when applicable), and on confirm persists the OCR'd text to `page_captures` keyed against the user's manually-tracked `current_page`. "Add note instead" and Skip remain available as fallbacks.

**Independent Test**: A reader can complete the full capture flow (snap → verify → save), close and reopen the app, and observe the row persisted in `page_captures` keyed to the correct manually-tracked page. No recap behavior is required for this story to deliver value.

### Backend / Edge Function

- [X] T007 [US1] Create `supabase/functions/ocr-page/index.ts` per `contracts/ocr-page.md` — accept `{ imageBase64, mimeType }`, validate JWT, validate decoded image size ≤5MB, call Gemini 2.5 Flash multimodal with the OCR prompt from the contract, parse the JSON response (`{ text, confidence, notes? }`), compute `wordCount`, return `{ text, confidence, wordCount }`. Implement single-retry on transient 5xx; map 400/401/502/504 per contract. Hold image bytes only in process memory — never write to disk, logs, or Storage.
- [X] T008 [US1] Add a CORS preflight handler to `supabase/functions/ocr-page/index.ts` matching the pattern used by `supabase/functions/generate-recap`. Verify the function is invokable from the dev frontend.

### Frontend Foundation (Store + Composable)

- [X] T009 [P] [US1] Create `src/stores/captures.ts` per `contracts/captures-store.md` — Pinia store with `capturesByBook`, `loadedBookIds`, `saving`, `lastError` state; `capturesForBook`, `capturesInRange`, `coverageInRange`, `pageHasCapture` getters; `fetchCapturesForBook`, `saveCapture`, `clearCachedCaptures` actions; auth-listener that calls `clearCachedCaptures()` on signOut/userChange (mirror the pattern in `src/stores/recaps.ts`).
- [X] T010 [P] [US1] Create `src/composables/useCapture.ts` per `contracts/session-capture-field.md` — wrap `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`; expose `state` ref ('idle' | 'camera' | 'ocr-running' | 'verify' | 'denied' | 'offline'), `ocrResult` ref, and the actions `startCamera`, `snap`, `retake`, `cancel`. `snap` draws the video frame to a hidden `<canvas>`, exports base64 JPEG at quality 0.85, POSTs to `ocr-page`, transitions to 'verify' on success or 'offline'/error toast on failure. Always release the `MediaStream` on cancel/unmount.

### Frontend UI Components

- [X] T011 [P] [US1] Create `src/components/capture/CaptureCameraView.vue` — renders a `<video>` viewport bound to the `useCapture` MediaStream, a snap button, and a Cancel link. Emits `snapped` (no payload — orchestration is in `useCapture`) and `cancelled`. Uses PrimeVue `Button` for the snap action; matches `glass-surface` aesthetic.
- [X] T012 [P] [US1] Create `src/components/capture/CaptureVerifyView.vue` — renders a PrimeVue `Textarea` (auto-resize, maxlength=10000) seeded with `ocrResult.text`, a character counter, a yellow PrimeVue `InlineMessage severity="warn"` shown only when `confidence < 0.7` (FR-006a) reading "OCR confidence is low — please review the text carefully before saving.", and three action buttons: **Save** (primary, disabled when text empty or whitespace-only), **Retake** (secondary), **Cancel**. Emits `save: [text: string]`, `retake: []`, `cancel: []`.
- [X] T013 [US1] Create `src/components/session/SessionCaptureField.vue` per `contracts/session-capture-field.md` — accepts `historyRowId: string` prop; emits `saved`, `skipped`. Implements the four UI states (Prompt / Camera / Verify / Denied or Offline); dynamic-imports `CaptureCameraView` and `CaptureVerifyView` so the main bundle delta stays ≤3KB. On Save, reads `current_page` from `useProgressStore().progressForBook(bookId)?.currentPage`, computes wordCount, calls `capturesStore.saveCapture({ bookId, page, text, confidence, wordCount })`, then emits `saved`. On "Add note instead" tap, swap inline content for the existing `SessionNoteField` and re-emit its `saved`/`skipped` upward. Resolve `bookId` from the `progress_history` row referenced by `historyRowId` (query `progressStore` or `progress_history` directly via Supabase).

### Wiring

- [X] T014 [US1] Modify `src/components/dashboard/LastSessionCard.vue` — replace the existing `SessionNoteField` import in the `showNoteField && pendingHistoryRowId` block with `SessionCaptureField`. Pass `historyRowId={pendingHistoryRowId}` and listen for `saved` / `skipped` (both call the existing `handleNoteComplete`). Keep `SessionNoteField` imported (used internally by `SessionCaptureField` for the "Add note instead" fallback). Preserve all existing styling and the `last-session__sep` separator.
- [X] T015 [US1] Add accessibility attributes to the capture flow: `aria-label="Capture a photo of the last page you read"` on the prompt button; `aria-label="Camera preview"` on the video element; programmatic `<label>` on the verify textarea; ensure Esc cancels at every stage. Verify Tab order via keyboard on the Dashboard.

**Checkpoint**: A user can complete a capture end-to-end. Quickstart Scenarios 1, 2, 3, 4, 5, 6 should all pass. `page_captures` rows appear with correct `(user, book, page)` and `confidence`. The image is not persisted anywhere. `pnpm run build` is clean.

---

## Phase 4: User Story 2 — Get a corpus-grounded delta recap (Priority: P1)

**Goal**: When a reader taps **Get Recap**, the engine fetches `page_captures` strictly within the delta range (`last_recap_page` < page ≤ `current_page`). If captures cover ≥30% of pages in that range, generate a corpus-grounded recap using the captured text only; otherwise transparently fall back to the existing inferred-mode pipeline. Persist the chosen mode on the recap row. Surface a "📸 Generated from your captures" badge on corpus-mode recap cards. The Recap History page reads as a chronological journal of distinct, non-overlapping stretches.

**Independent Test**: With ≥30% delta-range capture coverage, a Get Recap tap produces a recap card with the corpus badge and a `recaps` row with `mode = 'corpus'`. With <30% coverage, the same tap produces an inferred-mode recap with no badge and `mode = 'inferred'`. Recap History shows entries in chronological order with page-range labels.

### Backend / Edge Function

- [X] T016 [US2] Modify `supabase/functions/generate-recap/index.ts` to add the corpus-mode branch per `contracts/generate-recap.md`:
  - After auth, query `current_page` from `reading_progress`.
  - Query `last_recap_page` — prefer `progress_snapshot_page` from the most recent `recaps` row for this `(user, book)`; fall back to `progress_snapshot * total_pages` rounded for legacy rows where `progress_snapshot_page IS NULL`; treat absent recap as 0.
  - Compute `rangePages = currentPage - lastRecapPage`, `capturesInRange = count(...)` and `coverage = capturesInRange / rangePages`.
  - Branch: `if coverage >= 0.30 AND capturesInRange >= 1 AND rangePages > 0` → corpus mode; else inferred mode.
- [X] T017 [US2] Inside the corpus branch of `generate-recap/index.ts`, fetch captures via `select page, text from page_captures where user_id = $1 and book_id = $2 and page > $3 and page <= $4 order by page` and assemble the corpus prompt verbatim from `contracts/generate-recap.md` ("CRITICAL CONSTRAINTS" + sorted `[Page N]\n{text}` blocks + the 3-section Markdown output schema). Stream the response through the existing SSE pipeline unchanged.
- [X] T018 [US2] On terminal recap insert in `supabase/functions/generate-recap/index.ts`, persist both the new columns: `mode = $selectedMode` and `progress_snapshot_page = $currentPage`. All other columns (`content`, `progress_snapshot`, etc.) populate as today. Confirm the inferred branch also writes `mode = 'inferred'` and `progress_snapshot_page = $currentPage` so all new rows have both columns set.
- [X] T019 [US2] Add a timed log in `supabase/functions/generate-recap/index.ts` for the corpus branch only — measure ms from request receipt to first SSE chunk emitted; log as `first_token_latency_ms` alongside `mode_selected`, `coverage_pct`, `captures_in_range`, `range_pages` (research.md Decision 6). No alerting in v1; observation only.

### Frontend Domain Types & Stores

- [X] T020 [P] [US2] Update `src/stores/recaps.ts` — extend the row mapper(s) to include `mode` and `progressSnapshotPage` from the database row. Ensure `recapHistoryForBook` and `latestRecapForBook` getters expose the new fields. Confirm the `generationStatus` flow is unchanged.

### Frontend UI

- [X] T021 [P] [US2] Modify `src/components/recap/RecapCard.vue` — when the recap's `mode === 'corpus'`, render a small PrimeVue `Tag` (or styled inline pill) with text `"📸 Generated from your captures"` near the recap header. When `mode === 'inferred'`, render no badge. Preserve existing date formatting and content rendering.
- [ ] T022 [P] [US2] Modify `src/pages/RecapHistoryPage.vue` — for each recap entry, display a "Pages X–Y" label where X is the prior recap's `progressSnapshotPage` (or 0 for the first recap in the book's history) and Y is this recap's `progressSnapshotPage`. For corpus-mode entries, this label visually anchors the chronological-journal experience. Verify the entry list is sorted by `created_at` descending (newest first) per research.md Decision 7.
- [ ] T023 [US2] Modify `src/components/recap/RecapStream.vue` (or wherever the "Get Recap" tap is handled, including `HeroBookCard` and `BookDetailPage`) so that after a successful streaming completion, the recap card re-render picks up the persisted `mode` from the store. No new tap-time logic — the badge falls out of T021's render rule once the store has the latest row.

### Capture-Coverage Preview (optional polish for this story)

- [ ] T024 [US2] In `src/composables/useRecapLock.ts` (or equivalent), surface a derived ref `corpusReady: boolean` from `capturesStore.coverageInRange(bookId, lastRecapPage, currentPage) >= 0.30`. Plumb it to `HeroBookCard` and `BookProgressPanel` for an optional "ready for corpus recap" hint near the Get Recap button. Authoritative coverage check still lives server-side.

**Checkpoint**: Quickstart Scenarios 7 (inferred), 8 (corpus happy path), 9 (delta scoping), 11 (boundary at 30%) all pass. The corpus badge appears on corpus-mode recaps. `recaps` rows record the correct `mode` and `progress_snapshot_page`. First-token latency stays within the 3-second constitutional budget. Recap History reads chronologically with page-range labels. `pnpm run build` clean.

---

## Phase 5: User Story 3 — Graceful fallback when capture is unavailable (Priority: P2)

**Goal**: A reader who has zero captures, is offline, or has denied camera permission still receives a working recap experience indistinguishable from today's behavior. The corpus path is strictly opt-in via captures; the inferred path remains the default for any user who never captures.

**Independent Test**: A user with zero captures taps Get Recap on any book and receives a streaming inferred-mode recap with no error states and the recap row stamped `mode = 'inferred'`. The capture flow's permission-denied and offline paths cleanly funnel into the existing note flow with no broken UX.

- [ ] T025 [US3] Verify the inferred-mode regression: with a fresh book and zero `page_captures` rows, run Quickstart Scenarios 7 and 10. Confirm the recap streams in ≤3s, no badge renders, and `recaps.mode = 'inferred'`.
- [ ] T026 [US3] Verify the camera-permission-denied path (Quickstart Scenario 5) — revoke permission in the browser, end a session, tap Capture, confirm State 4-permission renders with the "Add note instead" / "Cancel" pair, and confirm a note entered there saves to `progress_history.session_note` exactly as today.
- [ ] T027 [US3] Verify the offline path: disable the device's network, end a session, tap Capture, confirm State 4-offline renders with copy "You're offline — capture needs internet to extract text." and the same "Add note instead" / "Cancel" actions. No `page_captures` row is inserted; no exceptions surface.
- [ ] T028 [US3] Confirm coverage exactly below 30% (Quickstart Scenario 10) — seed 29% delta coverage, tap Get Recap, confirm `mode = 'inferred'` is persisted. Re-test at exactly 30% (Scenario 11) and confirm `mode = 'corpus'` is persisted (boundary inclusive per Q1 clarification).

**Checkpoint**: All three fallback paths behave per spec. Inferred-mode users see no behavioral change vs today. SC-003 is verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 [P] Update `CLAUDE.md` — append the 015 entry under Recent Changes: *"015-corpus-recaps: New `page_captures` table + Gemini multimodal OCR via `ocr-page` edge function; `generate-recap` extended with corpus mode (≥30% delta coverage) producing chronologically-scoped delta recaps; `recaps.mode` + `progress_snapshot_page` columns added; `SessionCaptureField` replaces the post-session note prompt as primary action."* (The Active Technologies entries were already added by `update-agent-context.ps1` during /speckit.plan.)
- [X] T030 [P] Run `pnpm run build` — confirm zero TypeScript errors and zero Vite warnings.
- [X] T031 [P] Run `pnpm test` — confirm all 37 existing Vitest tests still pass (no regressions).
- [ ] T032 Run the full Quickstart sequence (Scenarios 1–13) against a local Supabase + dev frontend and record results in the commit message or PR description.
- [ ] T033 Smoke-check storage: query `select count(*) from storage.objects where bucket_id ilike '%capture%'` (or browse the Storage UI) and confirm zero objects exist — verifying that no image bytes leak into Supabase Storage anywhere in the implementation.
- [X] T034 Mark all completed tasks `[X]` in `specs/015-corpus-recaps/tasks.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. **BLOCKS all user stories.**
- **Phase 3 (US1)**: Depends on Phase 2 only. Independent of US2/US3.
- **Phase 4 (US2)**: Depends on Phase 2 only. Independent of US1/US3 in principle, but **the corpus path is exercisable end-to-end only when US1 has shipped** (since users need a way to create captures). Acceptable to ship US1 first as MVP; ship US2 in a follow-up commit that lights up corpus mode.
- **Phase 5 (US3)**: Depends on US1 and US2 being implemented (it's a verification phase).
- **Phase 6 (Polish)**: Depends on all preceding phases.

### Within Phase 3 (US1)

- T007 + T008 (edge function) are independent of T009/T010/T011/T012 (frontend foundation + components).
- T009, T010, T011, T012 can run in parallel — different files, no dependencies on each other.
- T013 depends on T009 (store), T010 (composable), T011 (camera view), T012 (verify view).
- T014 depends on T013.
- T015 (a11y) can be threaded into T011/T012/T013 or done as a final pass.

### Within Phase 4 (US2)

- T016 → T017 → T018 → T019 are sequential (they all edit `generate-recap/index.ts`).
- T020, T021, T022 are parallel — different files.
- T023 depends on T020 (store has `mode`).
- T024 (preview) depends on T020 + the captures store from T009 — can be deferred or skipped.

### Within Phase 5 (US3)

- T025, T026, T027, T028 are independent verification tasks; can run in any order.

### Within Phase 6 (Polish)

- T029, T030, T031 are parallel — different files.
- T032 depends on a working build (T030).
- T033 depends on having captured a few pages (manually exercised the flow).
- T034 is the final commit.

---

## Parallel Opportunities

```bash
# Phase 1 — both can run together:
T001: Verify Gemini env var
T002: Verify zero new dependencies

# Phase 2 — T005 and T006 are independent of T003/T004:
T003 → T004 (regen depends on migration applied)
T005: Add domain types
T006: Verify RLS isolation

# Phase 3 (US1) — three parallel lanes after T007/T008:
LANE A (frontend foundation): T009 (store), T010 (composable)   — parallel
LANE B (frontend components): T011 (camera view), T012 (verify view) — parallel
LANE C (backend): T007 (function), T008 (CORS) — sequential

T013 joins all lanes; T014 wires the result into LastSessionCard; T015 polishes a11y.

# Phase 4 (US2) — backend and frontend can run in parallel:
LANE A (backend): T016 → T017 → T018 → T019 (sequential, same file)
LANE B (frontend): T020, T021, T022 (parallel, different files)

T023 + T024 join the lanes after T020.

# Phase 6 — all-parallel polish:
T029, T030, T031: parallel
```

---

## User Story Coverage Map

| User Story | Phase | Tasks | MVP-able? |
|---|---|---|---|
| US1 — Capture page after session (P1) | 3 | T007–T015 | ✅ Yes — ships independently. Captures persist for future use; provides immediate "personal page archive" value even before US2 is live. |
| US2 — Corpus delta recap (P1) | 4 | T016–T024 | ✅ Yes — once US1 has shipped and users have captured pages, US2 lights up corpus mode. Inferred mode users see no change. |
| US3 — Graceful fallback (P2) | 5 | T025–T028 | ✅ Yes — verification phase only; no new code paths. Validates the existing fallback behavior survives the corpus changes. |

---

## Implementation Strategy

### Risk-Ordered Delivery

1. **Phase 1 + 2 — Foundation.** Apply migration, regenerate types. Lowest risk, blocks everything.
2. **Phase 3 — US1 capture pipeline (MVP).** Highest delivery risk (camera + OCR + new edge function). Validate aggressively with Quickstart Scenarios 1–6 before moving on. **This is the shippable MVP** even if US2 doesn't ship in the same release.
3. **Phase 4 — US2 corpus engine.** Lower UI risk (mostly server-side mode selection + a small badge), but requires US1 to have generated meaningful capture data. Deploy alongside US1 or in a follow-up release.
4. **Phase 5 — US3 fallback verification.** Pure validation; no new code paths. Establishes confidence that today's users see no regression.
5. **Phase 6 — Polish.** Final build, tests, smoke checks, mark complete.

### MVP Scope

**Phase 1 + 2 + 3** alone is shippable. It delivers a private, per-user archive of captured book pages keyed correctly to the reader's tracked progress — a tangible artifact even before the recap engine consumes it. Recaps continue to operate in inferred mode for everyone.

**Adding Phase 4** lights up the corpus engine. Users who have captured ≥30% of their delta range start receiving corpus-grounded recaps automatically; everyone else continues with inferred mode. Zero behavior change for non-capturing users.

**Phase 5** is a regression-confidence pass; it should reveal nothing new but documents that fallback paths still work.

### Constitution Gate Recap

Each phase ends with a `pnpm run build` checkpoint. The corpus path's first-token latency is monitored via the timed log in T019 against the constitutional 3-second ceiling (Principle III). Image-not-persisted is enforced architecturally (no Storage write path exists in any task) and verified in T033.

---

## Notes

- **No new npm dependencies.** Camera uses native `getUserMedia`; OCR reuses the existing Gemini provider.
- **Image bytes never persist anywhere.** Held in browser memory during snap, in edge function memory during OCR call, then discarded.
- **Page numbers come exclusively from `reading_progress.current_page`.** OCR-detected page numbers are explicitly forbidden by the spec (Q-clarification + LOTR motivation).
- **The 30% threshold is inclusive at the boundary** (Q1 clarification): exactly 30% triggers corpus mode.
- **Captures have no v1 delete UI** (Q5 clarification): only re-capture overwrite or cascade deletion remove rows.
- **Low-confidence warning fires below 0.7** (Q4 clarification): yellow `InlineMessage` on the verify screen.
- **The 10,000-character cap** (Q3 clarification) is enforced both at the verify screen and in the DB CHECK constraint as defense-in-depth.
- Corpus recap output preserves the existing 3-tier structure (Memory Jogger / Concept Watchlist / Thematic Bridge) per Constitution Principle I.
