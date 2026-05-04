# Tasks — Recap Image Generation (Feature 021)

**Feature**: 021 — Recap Image Generation
**Tech Stack**: TypeScript 6 (strict) + Vue 3.5 (`<script setup>`) + PrimeVue 4 + Pinia 3 + Supabase JS v2 + Deno (Edge Functions) + Gemini 2.5 Flash Image
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Data Model**: [data-model.md](./data-model.md)
**Generated**: 2026-05-03

---

## Dependency Graph

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational: types + migration + storage util)
        ├─► Phase 3 (US1: visible image end-to-end)
        │     └─► Phase 4 (US2: prompt fidelity + name preservation)
        │           └─► Phase 5 (US3: genre adaptation + softer mode)
        └─► Phase 6 (US4: failure handling + placeholder — runs in parallel with US2 work)
              └─► Final Phase (Polish)
```

US1 and US2 are both P1 — US1 must be functionally wired before US2 fidelity can be verified end-to-end. US3 extends the refiner built in US2. US4 hardening runs after the happy path (US1/US2) is stable. 

---

## Phase 1: Setup

**Goal**: Establish the new file skeleton so all subsequent tasks have clear targets.

- [x] T001 Create migration file at `supabase/migrations/20260503_recap_image_columns.sql` with the full SQL from data-model.md §1 (additive ALTER TABLE + check constraint + storage bucket + 3 RLS policies + status index)
- [x] T002 Create empty stub files for all new source modules: `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts`, `supabase/functions/generate-recap/handlers/image.ts`, `supabase/functions/generate-recap/utils/storage.ts`, `src/composables/useRecapImage.ts`, `src/components/recap/RecapImagePanel.vue` — each file must export its primary symbol as a no-op / placeholder so TypeScript does not error on imports in later tasks

---

## Phase 2: Foundational

**Goal**: Shared infrastructure that every user story depends on — types, mapper, and the storage utility. All must be complete before Phase 3 begins.

- [x] T003 Extend `src/types/index.ts`: add `RecapImageStatus` union type (`'pending' | 'succeeded' | 'failed_safety' | 'failed_transient' | 'skipped'`) and extend the `Recap` interface with `imagePath: string | null`, `imageStatus: RecapImageStatus`, `imageGeneratedAt: string | null` as specified in data-model.md §2.1
- [x] T004 Update the `mapRecap` row-to-domain mapper (wherever it currently lives, e.g. `src/stores/recaps.ts` or a dedicated mapper file) to map `row.image_path → imagePath`, `row.image_status → imageStatus` (fallback `'skipped'` when null), `row.image_generated_at → imageGeneratedAt` per data-model.md §2.2
- [x] T005 Implement `supabase/functions/generate-recap/utils/storage.ts` — export two pure async functions: `uploadRecapImage(adminClient, userId, recapId, imageBytes: Uint8Array): Promise<string>` (uploads to `recap-images` bucket, returns bucket-relative path `{userId}/{recapId}.png`) and `mintSignedUrl(adminClient, path: string, expiresIn?: number): Promise<string>` (creates a signed URL with default 60 s TTL)

---

## Phase 3 — US1: See a Cover-Like Image with My Recap (P1)

**Story Goal**: A user generates a recap and an image renders alongside the text fields, persists on re-load, and shows a loading state (Skeleton) while generating.

**Independent Test Criteria**: Generate a recap on any book. Both text fields and an image panel appear in the recap card. Reload the page — the image re-renders from the stored path without re-invoking generation. During generation a 1:1 Skeleton is visible in the image slot.

- [x] T006 [US1] Implement the Gemini image call in `supabase/functions/generate-recap/handlers/image.ts`: accepts `(supabaseAdmin, recapId, userId, imagePrompt: string)`, sets `image_status = 'pending'` on the recap row, calls `gemini-2.5-flash-image` with `responseModalities: ['IMAGE']`, receives base64 inline image bytes from the response, uploads via `storage.ts`, then updates the recap row to `image_status = 'succeeded'`, `image_path`, `image_generated_at`. Export a single async function `handleImageGeneration(...)`.
- [x] T007 [US1] Wire `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts` minimum viable stub: export `refineImagePrompt(input: ImagePromptInput): string` that for now returns a simple concatenation of book title + memory jogger (genre adaptation comes in US2/US3). Import and use this stub inside `handlers/image.ts`.
- [x] T008 [US1] Extend `supabase/functions/generate-recap/index.ts` to invoke the image stage **after** text fields are produced: call `EdgeRuntime.waitUntil(handleImageGeneration(...))` so the response to the client is not blocked. Pass `recapId`, `userId`, `memoryJogger`, and book metadata from the already-computed text stage. Do not alter the text streaming logic.
- [x] T009 [US1] Extend `src/stores/recaps.ts` to surface `imagePath`, `imageStatus`, and `imageGeneratedAt` on the store's `Recap` domain objects. Ensure `fetchRecap` / `upsertRecap` (and any equivalent fetch paths) populate these fields from the row via the updated `mapRecap`.
- [x] T010 [US1] Implement `src/composables/useRecapImage.ts`: accepts `recapId` and initial `imageStatus` + `imagePath`, returns a reactive `signedUrl` computed from a Supabase Storage signed URL call (only when `imageStatus === 'succeeded'`), and subscribes to the Supabase Realtime channel for the recap row to watch `image_status` / `image_path` transitions. Unsubscribes on component unmount. Arrow functions throughout.
- [x] T011 [US1] Implement `src/components/recap/RecapImagePanel.vue`: uses `useRecapImage` composable; renders a `<Skeleton>` (PrimeVue) at 1:1 aspect ratio while `imageStatus === 'pending'`; renders a `<Image>` (PrimeVue, `preview="false"`) with `alt=""` and `aria-hidden="true"` once `imageStatus === 'succeeded'`; renders a gradient placeholder `<div>` when `imageStatus` is `'failed_safety'` or `'failed_transient'`; renders nothing (`v-if` short-circuit) when `imageStatus === 'skipped'` or `imagePath` is null on a pre-feature recap. Target ≤ 250 lines.
- [x] T012 [US1] Mount `<RecapImagePanel>` inside `src/components/recap/RecapStream.vue` at a fixed prominent placement (above the three text-field sections). Pass `recapId`, `imageStatus`, `imagePath` as props derived from the current recap object.

---

## Phase 4 — US2: Image Reflects What I've Actually Read (P1)

**Story Goal**: The image faithfully depicts named characters, locations, and events from `memory_jogger` with no invented detail, no substituted generic figures, and no spoilers beyond the user's current page.

**Independent Test Criteria**: A recap whose `memory_jogger` contains at least two specific proper nouns produces an image that visually corresponds to those entities (not generic replacements). The unit test suite in `tests/unit/refineImagePrompt.test.ts` passes all assertions, including the no-hardcoded-literals lint.

- [x] T013 [US2] Replace the US1 stub with the full `refineImagePrompt` implementation in `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts`. Must implement: source-of-truth fidelity (all visual content from `memoryJogger`), name preservation (all proper nouns pass through verbatim), composition directives (camera angle, subject focus, foreground, background, scale, visual hierarchy), atmosphere (sensory cues from `memoryJogger` only), consistency (period/genre-appropriate objects), spoiler safety (nothing beyond `pageRange.toPage` when provided), minimal invention (tasteful treatment when detail is absent), and the mandatory 1:1 square composition directive (exact string: `square 1:1 composition; central subject anchor; no widescreen crop, no portrait crop`). Output must be plain text — no JSON, markdown, labels, or bullets. See contracts/refineImagePrompt.contract.md §MUST for the full rule list.
- [x] T014 [P] [US2] Add name-preservation test vector in `supabase/functions/generate-recap/prompts/imagePromptRefiner.test.ts`: input with two specific fictional proper nouns in `memoryJogger`; assert output `toContain` both strings exactly.
- [x] T015 [P] [US2] Add square-directive test vector in `supabase/functions/generate-recap/prompts/imagePromptRefiner.test.ts`: any valid input; assert output contains `square 1:1 composition` (or exact near-verbatim from contract). Every single test input must pass this check.
- [x] T016 [P] [US2] Add spoiler-safety test vector in `supabase/functions/generate-recap/prompts/imagePromptRefiner.test.ts`: input with `pageRange: { fromPage: 1, toPage: 50 }` and a `memoryJogger` truncated to page-50 content; assert output does not contain terms from a separate "future content" list not present in the `memoryJogger`.
- [x] T017 [US2] Add no-hardcoded-literals static lint test in `supabase/functions/generate-recap/prompts/imagePromptRefiner.test.ts`: reads the source of `imagePromptRefiner.ts` as a string; asserts it contains none of the forbidden literals listed in contracts/refineImagePrompt.contract.md §MUST NOT (Tolkien names, LOTR world names, Hogwarts, Westeros, Stark, Dune, Arrakis, etc.).

---

## Phase 5 — US3: Image Style Matches the Book's Genre (P2)

**Story Goal**: Visual-fidelity language adapts to the book's genre. Fantasy gets epic cinematography; historical gets period-accurate production design; literary gets moody character-focus; horror gets chiaroscuro tension. No genre vocabulary leaks into a different genre.

**Independent Test Criteria**: Three prompts generated with distinct genres produce outputs using disjoint vocabulary banks (verifiable by asserting genre-specific terms appear in the correct output and are absent from the others). The softer-mode flag produces detectably less literal output.

- [x] T018 [US3] Extend genre-fork vocabulary in `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts`: implement the eight genre branches from the contract (Fantasy/epic, Sci-fi, Historical fiction, Literary fiction, Horror/thriller, Mystery, Children's, Default) as a `const` vocabulary map. Genre is inferred from `bookGenre` when non-null, otherwise from textual cues in `memoryJogger` + `bookTitle` + `bookAuthor`. The selected vocabulary terms must be appended to the visual-fidelity section of the output prompt.
- [x] T019 [P] [US3] Add genre-fork test vectors (three inputs) in `supabase/functions/generate-recap/prompts/imagePromptRefiner.test.ts`: fantasy input → output contains at least one of `['atmospheric concept art', 'volumetric lighting', 'wide-angle landscape']`; historical-fiction input → output contains at least one of `['period-accurate production design', 'natural light', 'editorial photography style']`; literary-fiction input → output contains at least one of `['intimate close-up', 'moody natural light', 'shallow depth of field']`. Assert these sets are disjoint across the three outputs.
- [x] T020 [P] [US3] Add softer-mode test vector in `supabase/functions/generate-recap/prompts/imagePromptRefiner.test.ts`: same `ImagePromptInput` called twice — once without `softer`, once with `softer: true`. Assert outputs differ. Assert softer output contains at least one of `['silhouette', 'implied', 'in shadow', 'atmospheric', 'suggestion of']`.

---

## Phase 6 — US4: Recap Without Image Still Works (P2)

**Story Goal**: Transient failures trigger one silent auto-retry; safety rejections trigger one softer-prompt retry. After both attempts fail the recap settles with all text fields intact and a placeholder in the image slot. No retry button. No background regeneration on future views. Legacy recaps (pre-feature) render without any image slot.

**Independent Test Criteria**: Forcing a transient failure produces exactly one retry in the edge function logs, then settles `image_status = 'failed_transient'`. The UI shows a placeholder and no retry affordance. Legacy recap rows (null status) render the recap card normally with no image slot.

- [x] T021 [US4] Implement transient-failure retry in `supabase/functions/generate-recap/handlers/image.ts`: wrap the Gemini image call in a try/catch; on network error or 5xx response, wait a short backoff (~2 s) and attempt the call exactly once more with the same prompt. If the retry also fails, update the recap row to `image_status = 'failed_transient'` (with `image_path` remaining null). Log `transient_retry_used: true`.
- [x] T022 [US4] Implement safety-rejection retry in `supabase/functions/generate-recap/handlers/image.ts`: detect safety-rejection responses from the Gemini API (provider-specific error code / `finishReason`); on first rejection, call `refineImagePrompt({ ...input, softer: true })` to generate a softer prompt and retry the image call once. If still rejected, update to `image_status = 'failed_safety'`. Log `safety_retry_used: true`. This retry is independent of and counted separately from the transient retry.
- [x] T023 [US4] Update `src/components/recap/RecapImagePanel.vue` placeholder states: the `failed_safety` and `failed_transient` states MUST render a non-alarming gradient `<div>` at 1:1 ratio (matching the Skeleton size) — no error text, no retry button, no spinner. Confirm via visual inspection that the placeholder does not suggest a broken state to the user.
- [x] T024 [US4] Confirm backwards compatibility in `src/components/recap/RecapImagePanel.vue`: when `imageStatus === 'skipped'` (null DB value mapped via `mapRecap`), the component renders nothing — no Skeleton, no placeholder, no broken image. The recap card layout must be visually unaffected. Add a TS comment explaining the `'skipped'` path.
- [x] T025 [P] [US4] Add failure-path unit test in `supabase/functions/generate-recap/handlers/image.test.ts`: mock the Gemini client to throw a transient error on both first and second call; assert `image_status` transitions to `'failed_transient'`; assert the transient retry was called exactly twice (once original, once retry); assert text fields are unaffected.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Goal**: Observability, final validation, and sign-off against quickstart.md acceptance criteria.

- [x] T026 Add structured observability logging block to `supabase/functions/generate-recap/handlers/image.ts` that emits (without persisting): `recap_id`, `text_stage_duration_ms` (passed in from index.ts), `image_stage_duration_ms`, `transient_retry_used: bool`, `safety_retry_used: bool`, `final_image_status`. Use `console.log` with a JSON-serializable object (Deno/Supabase log format).
- [x] T027 Verify `image_status` check constraint values in `supabase/migrations/20260503_recap_image_columns.sql` exactly match the `RecapImageStatus` union in `src/types/index.ts` — same five strings, same spelling. Fix any discrepancy in either file.
- [ ] T028 Run the full Deno test suite for the Edge Function: `deno test supabase/functions/generate-recap/` — confirm all assertions pass, including the static lint (T017) that scans for forbidden literal strings in `imagePromptRefiner.ts`.
- [ ] T029 Manual E2E smoke test against staging using quickstart.md §1–§9 as a checklist: apply migration, deploy function, generate a recap, observe Skeleton → image transition, verify `image_status = 'succeeded'` in Studio, confirm spoiler safety on one test book, trigger and confirm both failure paths, verify cross-user isolation, verify legacy recap renders without image slot, confirm no regression in time-to-first-text-token.

---

## Parallel Execution Examples

### US1 (Phases 3): Mostly sequential — each piece depends on the last
```
T006 (Gemini call + upload)
  → T007 (refiner stub) [can be developed concurrently with T006 given the interface is known]
  → T008 (index.ts wiring — depends on T006+T007)
T009 (store extension — can run in parallel with T006–T008)
T010 (composable — depends on T009)
T011 (component — depends on T010)
T012 (mount — depends on T011)
```

### US2 (Phase 4): Tests can run in parallel once T013 is complete
```
T013 (full refiner implementation)
  → T014 [P] + T015 [P] + T016 [P] in parallel
  → T017 (lint test — only needs the source file to exist, can start with T013)
```

### US3 (Phase 5): Tests parallel after T018
```
T018 (genre fork)
  → T019 [P] + T020 [P] in parallel
```

### US4 (Phase 6): Retry logic then tests
```
T021 + T022 (retry logic in handlers/image.ts — sequential, same file)
T023 + T024 (component states — sequential, same file)
  → T025 [P] (unit test — can start once T021 is done, independent of T023/T024)
```

---

## Implementation Strategy

**MVP (Phases 1–3 + Phase 6 core)**: Complete T001–T012 and T021–T024. This delivers a working end-to-end image that appears alongside recaps, gracefully degrades on failure, and is backwards-compatible with legacy recaps. The prompt quality at MVP uses the stub refiner — image content is visible but not yet genre-tuned.

**Quality pass (Phases 4–5)**: Complete T013–T020. The prompt refiner is now fully implemented with name preservation, spoiler safety, and genre adaptation.

**Hardening (Final Phase)**: T026–T029 close out observability, test coverage, and manual E2E validation.

---

## Summary

| Phase | User Story | Tasks | Parallel Opportunities |
|-------|-----------|-------|----------------------|
| Setup | — | T001–T002 | None (sequential) |
| Foundational | — | T003–T005 | T003 ‖ T004 ‖ T005 |
| Phase 3 | US1 (P1) | T006–T012 | T009 ‖ T006–T007 |
| Phase 4 | US2 (P1) | T013–T017 | T014 ‖ T015 ‖ T016 after T013 |
| Phase 5 | US3 (P2) | T018–T020 | T019 ‖ T020 after T018 |
| Phase 6 | US4 (P2) | T021–T025 | T025 after T021 |
| Polish | — | T026–T029 | None (sequential sign-off) |

**Total tasks**: 29  
**MVP scope**: T001–T012 + T021–T024 (16 tasks — delivers visible image + graceful failure)  
**Full implementation**: All 29 tasks
