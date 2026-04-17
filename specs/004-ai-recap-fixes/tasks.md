---
description: "Task list for AI Recap & Progress Tracking Fixes"
---

# Tasks: AI Recap & Progress Tracking Fixes

**Input**: Design documents from `specs/004-ai-recap-fixes/`  
**Branch**: `004-ai-recap-fixes`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Format**: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1–US7)
- All changes are targeted edits to existing files — no new files except the edge function mode branch

---

## Phase 1: Setup

**Purpose**: Orient to affected files before making any changes.

- [x] T001 Read current `src/stores/progress.ts` to locate the fire-and-forget `progress_history` insert call
- [x] T002 Read current `supabase/functions/generate-recap/index.ts` to map the existing mode branches and token budget values

---

## Phase 2: Foundational

**Purpose**: No blocking infrastructure prerequisites — all fixes are independent targeted edits. This phase is intentionally empty; proceed directly to user story phases.

**Checkpoint**: Ready to begin user story implementation immediately after Phase 1.

---

## Phase 3: User Story 1 — Reliable Progress History Recording (Priority: P1) 🎯 MVP

**Goal**: Every page save writes a row to `progress_history`, unblocking US5 (passport stats) and US7 (velocity badge).

**Independent Test**: Save a page number on any book → query `progress_history` → a row must appear within 2 seconds (Quickstart Scenario 1).

### Implementation

- [x] T003 [US1] In `src/stores/progress.ts`: add `.then(() => {})` to the fire-and-forget `supabase.from('progress_history').insert({...})` call so the HTTP request is actually dispatched (Decision 2 — Supabase JS v2 lazy execution fix)
- [ ] T004 [US1] Verify the fix: save progress on a test book, check `progress_history` table in Supabase Studio for a new row with correct `book_id`, `user_id`, `page`, and `recorded_at`

**Checkpoint**: US1 complete. `progress_history` now accumulates rows. US5 and US7 unblock automatically.

---

## Phase 4: User Story 2 — Reliable AI Recap Output (Priority: P1)

**Goal**: Every recap attempt returns a fully populated three-part briefing with no empty fields and no "incomplete recap" error.

**Independent Test**: Generate a recap 3 times in a row on any book → all three return non-empty Memory Jogger, Concept Watchlist, and Thematic Bridge with no error (Quickstart Scenarios 2 & 3).

### Implementation

- [x] T005 [P] [US2] In `src/stores/recapFragments.ts`: add a validation gate before the `.insert()` call — discard the fragment silently if `raw_json` does not have a non-empty `key_events` array OR has a `raw` key present (Decision 5 — prevents `{raw:""}` rows)
- [x] T006 [P] [US2] In `supabase/functions/generate-recap/index.ts`: increase Pass 1 extraction `maxOutputTokens` from `4096` to `8192` (Decision 8 — prevents mid-JSON truncation for large books)
- [x] T007 [US2] In `supabase/functions/generate-recap/index.ts`: remove the `fragments` array handling from the `recap` mode path — the recap must always run its own fresh Pass 1 over the relevant page range; delete any code that accepts, validates, or forwards fragments to Pass 2 (Decision 1)
- [x] T008 [US2] In `src/stores/recaps.ts`: add a streaming lockout guard at the start of `generateRecap` — if `generationStatus.value === 'streaming'` return early without making a network request (FR-010); also bind `:disabled="recapsStore.generationStatus === 'streaming'"` on the recap trigger button in `src/pages/BookDetailPage.vue`

**Checkpoint**: US2 complete. Recaps reliably return all three fields, fragments no longer poison context, button is locked during streaming.

---

## Phase 5: User Story 4 — Book Completion Experience (Priority: P1)

**Goal**: At 100% progress the AI Recap section is hidden and the BookPassport becomes the sole AI destination; the passport AI summary is narrative prose, not JSON.

**Independent Test**: Set a book to 100% → verify AI Recap section invisible → navigate to BookPassportPage → verify flowing narrative paragraph with no JSON characters (Quickstart Scenarios 5 & 7).

### Implementation

- [x] T009 [P] [US4] In `src/pages/BookDetailPage.vue`: wrap the entire AI Recap `<section>` (button, hint text, history link) with `v-if="!isComplete"` where `isComplete` is already computed as `percentage >= 100` (Decision 7)
- [x] T010 [P] [US4] In `supabase/functions/generate-recap/index.ts`: add a new `passport_summary` mode branch — skip Pass 1 entirely, use a dedicated narrative system prompt ("Write a flowing 200–400 word paragraph covering the full arc, themes, and memorable moments of [title] by [author] — the reader has finished the book, no spoiler constraints"), stream plain text directly (no JSON structure), set `maxOutputTokens: 4096` (Decision 4)
- [x] T011 [US4] In `src/stores/bookPassport.ts`: change the AI call `mode` from `'full_summary'` to `'passport_summary'`; update the response handling to accumulate streaming text as plain text without attempting `JSON.parse` — store the accumulated string directly as `ai_summary` (Decision 4)
- [ ] T012 [US4] Deploy the updated edge function: run `supabase functions deploy generate-recap` and verify in Supabase Dashboard → Edge Functions → Logs that the deployment succeeded ⚠️ MANUAL STEP — requires `supabase login` in your terminal

**Checkpoint**: US4 complete. At 100%, recap section hidden; passport shows narrative summary.

---

## Phase 6: User Story 5 — BookPassport Stats Accuracy (Priority: P1)

**Goal**: Once `progress_history` has rows (US1 fixed), stats compute correctly including single-session completions.

**Independent Test**: Complete a book after saving progress across ≥1 day → BookPassportPage shows non-null `total_days`, `peak_day`, `peak_day_pages` (Quickstart Scenario 6).

**Dependency**: Requires US1 (T003) to be complete so `progress_history` has data.

### Implementation

- [x] T013 [US5] In `src/stores/bookPassport.ts`: change the stats computation guard from `histRows.length >= 2` to `histRows.length >= 1`; for a single row set `totalDays = 1`, `peakDay` = that row's date, `peakDayPages = 0` (the reader recorded their position, no delta computable — acceptable for single-save case) (Decision 6)

**Checkpoint**: US5 complete. Passport stats show correctly for both single-session and multi-day readers.

---

## Phase 7: User Story 3 — Incremental (Range-Based) Recaps (Priority: P2)

**Goal**: Each new recap covers only pages since the last recap, not the full book from page 0.

**Independent Test**: Generate recap at page 30 → advance to page 60 → generate again → second recap Memory Jogger does not repeat events from pages 0–30 (Quickstart Scenario 4).

### Implementation

- [x] T014 [P] [US3] In `src/services/recapService.ts`: add `from_page?: number` to the `RecapRequest` interface; pass it through in the request body of `streamRecap` (Decision 3)
- [x] T015 [P] [US3] In `src/stores/recaps.ts`: before calling `streamRecap`, resolve `fromPage` as `recapsByBook[bookId]?.[0]?.pageSnapshot ?? 0` (latest recap's page snapshot or 0 for first recap); pass it as `from_page: fromPage` in the request (Decision 3)
- [x] T016 [US3] In `supabase/functions/generate-recap/index.ts`: read `from_page` from the request body (default `0`); update the Pass 1 extraction system prompt to include the instruction "Cover only pages [from_page + 1] to [currentPage]. Do not summarise or reference events before page [from_page + 1]." — apply this only when `from_page > 0` (Decision 3)

**Checkpoint**: US3 complete. Recaps are incremental — each new recap covers only the pages read since the previous one.

---

## Phase 8: User Story 7 — Velocity Badge Visibility (Priority: P2)

**Goal**: VelocityBadge appears on BookDetailPage once `progress_history` has at least two entries.

**Independent Test**: Save progress twice with a short gap → reload BookDetailPage → velocity badge shows pages/hour and finish estimate (Quickstart Scenario 8).

**Dependency**: Requires US1 (T003) to be complete.

### Implementation

- [x] T017 [US7] In `src/pages/BookDetailPage.vue`: verify the `VelocityBadge` component is rendered with the correct `v-if` guard (at least 2 history entries and progress < 100%); if the guard is missing or incorrect, fix it to match the acceptance criteria from spec.md US7 — no logic changes to `useReadingPulse` should be needed once history rows exist

**Checkpoint**: US7 complete. Velocity badge appears automatically now that history is being written.

---

## Phase 9: User Story 6 — ISBN Context for AI (Priority: P3)

**Goal**: When a book has an ISBN, it is included in every AI call payload.

**Independent Test**: Add a book via ISBN scan → trigger recap → verify `isbn` field present in request payload (Quickstart Scenario 10).

### Implementation

- [x] T018 [P] [US6] In `src/stores/bookPassport.ts`: verify the `generatePassport` call includes `isbn` in the edge function request body — if missing, add `isbn: isbn ?? null` to the payload (already present in `RecapRequest` and `extractFragment`; passport call may have been missed)
- [x] T019 [P] [US6] In the Add Book manual entry form (`src/pages/AddBookPage.vue` or equivalent): verify an optional ISBN text input field exists; if absent, add one so users can supply an ISBN for manually-added books (FR-009 / US6 AC3)

**Checkpoint**: US6 complete. ISBN is forwarded in all three AI call paths: recap, fragment extraction, and passport generation.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, deploy, and cross-story checks.

- [ ] T020 [P] Run Quickstart Scenario 1 through 10 manually per `specs/004-ai-recap-fixes/quickstart.md` and confirm all acceptance criteria pass
- [x] T021 [P] Verify no TypeScript build errors: run `npm run build` or `tsc --noEmit` and resolve any type errors introduced by the `from_page?: number` field addition or the `>= 1` guard change

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Empty — no blocking prerequisites
- **Phase 3 (US1)**: Must complete before US5 and US7
- **Phase 4 (US2)**: Independent — can run in parallel with US1
- **Phase 5 (US4)**: Partially independent — T010/T011/T012 can run in parallel with US1; T009 (BookDetailPage) also independent
- **Phase 6 (US5)**: Requires US1 (T003) — stats need real history data
- **Phase 7 (US3)**: Requires US2 edge function changes (T007) to be deployed first
- **Phase 8 (US7)**: Requires US1 (T003)
- **Phase 9 (US6)**: Independent — no dependencies
- **Phase 10 (Polish)**: Requires all desired stories to be complete

### User Story Dependencies

```
US1 (T003–T004)  ←── critical path
  ├─► US5 (T013)
  └─► US7 (T017)

US2 (T005–T008)  ←── independent of US1
  └─► US3 (T014–T016)  ←── build on edge function from US2

US4 (T009–T012)  ←── independent

US6 (T018–T019)  ←── independent
```

### Parallel Opportunities Within Stories

**US2**: T005 (recapFragments.ts) and T006 (edge function tokens) touch different files — run in parallel  
**US4**: T009 (BookDetailPage) and T010 (edge function passport_summary) touch different files — run in parallel  
**US3**: T014 (recapService.ts) and T015 (recaps.ts) touch different files — run in parallel  
**US6**: T018 (bookPassport.ts) and T019 (AddBookPage) touch different files — run in parallel

---

## Parallel Example: US2

```
# These two tasks touch different files — launch together:
T005: Fragment validation gate in src/stores/recapFragments.ts
T006: Token budget increase in supabase/functions/generate-recap/index.ts

# Then sequentially:
T007: Remove fragments from recap path in supabase/functions/generate-recap/index.ts
T008: Streaming lockout in src/stores/recaps.ts + src/pages/BookDetailPage.vue
```

## Parallel Example: US4

```
# These touch different files — launch together:
T009: v-if="!isComplete" in src/pages/BookDetailPage.vue
T010: passport_summary mode in supabase/functions/generate-recap/index.ts

# Then sequentially:
T011: Switch to passport_summary in src/stores/bookPassport.ts (needs T010 deployed)
T012: Deploy edge function (needs T007 + T010 complete)
```

---

## Implementation Strategy

### MVP Scope (US1 Only — 2 tasks)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 3: US1 (T003–T004)
3. **STOP and VALIDATE**: Confirm `progress_history` rows appear after save
4. This single 1-line fix unblocks velocity badges and passport stats automatically

### Recommended Delivery Order

1. US1 (T003–T004) — 1 line, maximum unblocking value
2. US2 (T005–T008) — recap reliability, fixes user-visible errors
3. US4 (T009–T012) — completion experience + deploy edge function
4. US5 (T013) — stats now work (history data exists)
5. US3 (T014–T016) — incremental recaps (requires deployed edge function)
6. US7 (T017) — velocity badge verification
7. US6 (T018–T019) — ISBN forwarding
8. Polish (T020–T021)

### Single-Developer Execution

All 21 tasks can be completed sequentially in one session. The edge function deploy (T012) is the only external action — plan for it after T007 and T010 are both complete.

---

## Notes

- [P] tasks can run in parallel — different files, no shared dependencies
- All changes are edits to existing files; no new files needed (except the new mode branch inside the edge function)
- Edge function must be deployed (T012) before US3 incremental prompts take effect
- The `from_page` field in `RecapRequest` is additive — existing calls without it default to `0` (full book), preserving backward compatibility
- Existing `{raw:""}` fragments in the database are harmless once the cache is removed from the recap path (Decision 1); no cleanup migration needed
