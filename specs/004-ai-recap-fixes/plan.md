# Implementation Plan: AI Recap & Progress Tracking Fixes

**Branch**: `004-ai-recap-fixes` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/004-ai-recap-fixes/spec.md`

---

## Summary

Fix eight root-cause bugs across the AI recap pipeline and progress tracking system. The critical path is `progress_history` writes (US1): once fixed, velocity badges (US7) and BookPassport stats (US5) unblock automatically. The recap engine is fixed by removing the broken fragment cache from the generation path, adding incremental `from_page` scoping, increasing the token budget, and adding a validation gate before fragment saves. The BookPassport is fixed with a new `passport_summary` edge function mode that produces narrative prose instead of JSON. The 100% completion experience is fixed by hiding the recap section and routing users to the passport.

---

## Technical Context

**Language/Version**: TypeScript 6 + Deno (edge function)  
**Primary Dependencies**: Vue 3.5, PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Gemini 2.5 Flash (AI)  
**Storage**: Supabase PostgreSQL — tables: `progress_history`, `recap_fragments`, `recaps`, `book_passports`  
**Testing**: Manual — 10 quickstart scenarios defined in `quickstart.md`  
**Target Platform**: PWA (web/mobile via Netlify)  
**Project Type**: Mobile-first web application  
**Performance Goals**: Recap stream begins within 3 seconds; progress history insert within 2 seconds  
**Constraints**: No database schema migrations required; all fixes are client-side or edge function changes  
**Scale/Scope**: Single-user app; fixes affect all books for all users

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Memory Continuity | ✅ PASS | Incremental `from_page` makes recaps genuinely context-aware; spoiler-free constraint preserved in prompts |
| II. Physical-to-Digital Bridge | ✅ PASS | ISBN is now forwarded to every AI call; manual entry path unchanged |
| III. AI-First Recap Engine | ✅ PASS | Recap reliability fixed (token budget, fragment validation, lockout); stream-within-3s target maintained |
| IV. Data Integrity & Synchronization | ✅ PASS | Fire-and-forget Supabase insert fixed to actually dispatch; `.then(() => {})` pattern used |
| V. (Not violated) | ✅ PASS | No new complexity layers added; fragment cache removed (simplification) |

**No gate violations.** No Complexity Tracking entries required.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-ai-recap-fixes/
├── plan.md              ← This file
├── research.md          ← 8 architectural decisions (Phase 0)
├── data-model.md        ← Entities and state transitions (Phase 1)
├── contracts/
│   └── edge-function.md ← generate-recap request/response contract (Phase 1)
├── quickstart.md        ← 10 manual test scenarios (Phase 1)
└── tasks.md             ← Execution tasks (Phase 2 — /speckit.tasks)
```

### Source Code Changes

```text
src/
├── stores/
│   ├── progress.ts         ← [US1] Add .then(()=>{}) to progress_history insert
│   ├── recapFragments.ts   ← [US2] Fragment validation gate before save
│   ├── recaps.ts           ← [US3] Pass from_page to streamRecap; lockout guard
│   └── bookPassport.ts     ← [US4/US5] Fix >= 1 guard; use passport_summary mode
├── services/
│   └── recapService.ts     ← [US3] Add from_page?: number to RecapRequest interface
└── pages/
    └── BookDetailPage.vue  ← [US4] v-if="!isComplete" on recap section; [US7] velocity

supabase/functions/generate-recap/
└── index.ts                ← [US2/US3/US4] Remove fragments; add passport_summary mode;
                              add from_page to Pass 1 prompt; increase Pass 1 tokens to 8192
```

**No new files needed.** All changes are targeted edits to existing files.

---

## Architecture Decisions (from research.md)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Remove `fragments` from recap path entirely | Fragment cache contains `{raw:""}` entries that poison Pass 2 context |
| 2 | `.then(() => {})` on progress_history insert | Supabase JS v2 lazy execution — without it, HTTP call never dispatches |
| 3 | `from_page` parameter for incremental recaps | All 5 stored recaps start identically — range scoping makes each recap new |
| 4 | New `passport_summary` mode (streaming narrative) | `full_summary` used the 3-field JSON prompt — passport displayed raw JSON to user |
| 5 | Fragment validation gate (no save if no `key_events`) | Prevents future `{raw:""}` rows accumulating in DB |
| 6 | `histRows.length >= 1` (was `>= 2`) in bookPassport.ts | Single-session readers should see `totalDays: 1`, not null |
| 7 | Wrap recap section in `v-if="!isComplete"` | At 100% the recap format is inappropriate; passport is the correct destination |
| 8 | Pass 1 `maxOutputTokens: 4096 → 8192` | The Hobbit fragment at page 100 truncated mid-sentence — larger books fail earlier |

---

## Implementation Order (Critical Path)

```
US1 (progress.ts)           ← critical path, unblocks US5 + US7
  └─► US5 (bookPassport.ts) ← stats now compute from real data
  └─► US7 (BookDetailPage)  ← velocity badge appears automatically

US2 (recapFragments.ts +    ← independent; fixes recap reliability
     recapService.ts +
     edge function tokens +
     lockout)

US3 (recapService.ts +      ← depends on US2 edge function changes
     recaps.ts +
     edge function from_page)

US4 (BookDetailPage +       ← independent of above; UI-only changes
     edge function passport_summary +
     bookPassport.ts narrative)

US6 (ISBN forwarding)       ← already partially implemented; verify and complete
```

---

## Key Implementation Details

### US1 — Progress History (1-line fix, critical path)

**File**: `src/stores/progress.ts`

```typescript
// BEFORE (never executes):
supabase.from('progress_history').insert({ ... })

// AFTER (forces HTTP dispatch):
supabase.from('progress_history').insert({ ... }).then(() => {})
```

### US2 — Fragment Validation Gate

**File**: `src/stores/recapFragments.ts`

Before calling `.insert()` on a fragment result, validate:
```typescript
const isValid = (
  result !== null &&
  typeof result === 'object' &&
  !('raw' in result) &&
  Array.isArray((result as any).key_events) &&
  (result as any).key_events.length > 0
)
if (!isValid) return  // silent discard
```

### US3 — Incremental Recap

**File**: `src/stores/recaps.ts`

```typescript
const latestRecap = recapsByBook[bookId]?.[0]  // already sorted desc
const fromPage = latestRecap?.pageSnapshot ?? 0
const result = await streamRecap(
  { ..., from_page: fromPage },
  onToken,
)
```

**Edge function**: In Pass 1 extraction prompt, add:
> "Cover only pages [from_page+1] to [currentPage]. Do not summarise events before page [from_page+1]."

### US4 — Completion Gate

**File**: `src/pages/BookDetailPage.vue`

```vue
<section v-if="!isComplete" class="recap-section">
  <!-- AI Recap button, hint, history link -->
</section>
```

### US4 — Passport Summary Mode

**File**: `supabase/functions/generate-recap/index.ts`

New branch in mode switch:
```typescript
case 'passport_summary': {
  // Stream a narrative prompt — no JSON structure
  // System prompt: "You are a book chronicler. Write a flowing narrative summary..."
  // No Pass 1. Single call. Stream response directly.
  break
}
```

**File**: `src/stores/bookPassport.ts`

Change the AI call from:
```typescript
body: JSON.stringify({ ..., mode: 'full_summary' })
```
to:
```typescript
body: JSON.stringify({ ..., mode: 'passport_summary' })
```

Handle the response as plain text (no `JSON.parse`):
```typescript
// Accumulate streaming text directly into ai_summary
// No extractJSON() or JSON.parse() call
```

### US5 — BookPassport Stats Single-Session Fix

**File**: `src/stores/bookPassport.ts`

```typescript
// BEFORE:
if (histRows && histRows.length >= 2) {

// AFTER:
if (histRows && histRows.length >= 1) {
  // For single row: totalDays = 1, peakDay = that row's date
```

### US6 — ISBN in All AI Calls

Already implemented in `RecapRequest` interface and `streamRecap` / `extractFragment` calls. Verify `bookPassport.ts` also forwards `isbn` in the passport request body.

### US7 — Velocity Badge

No code change needed. Once US1 lands and `progress_history` has rows, `useReadingPulse` composable will compute velocity naturally. Verify `VelocityBadge` is rendered in `BookDetailPage.vue` with the `v-if` guard already in place.
