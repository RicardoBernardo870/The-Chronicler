# Quickstart: AI Recap & Progress Tracking Fixes

**Feature**: 004-ai-recap-fixes  
**Branch**: `004-ai-recap-fixes`

---

## Setup

```bash
# From repo root
pnpm install

# Ensure Supabase CLI is installed and linked
supabase functions deploy generate-recap
```

---

## Manual Test Scenarios

These are the acceptance scenarios from `spec.md` translated into manual test steps. Run in order.

---

### Scenario 1 — Progress history actually writes (US1 / SC-001)

**Goal**: Confirm every page save produces a `progress_history` row.

1. Open the app. Go to any book. Save a page number (tap + confirm).
2. Open Supabase Studio → Table Editor → `progress_history`.
3. **Expected**: A row appears with the correct `book_id`, `user_id`, `page`, and `recorded_at`.
4. Save 2 more different page numbers.
5. **Expected**: 3 distinct rows (append-only, not upserted).

**Before fix**: 0 rows ever appear. After fix: every save writes a row.

---

### Scenario 2 — Recap produces full three-part output (US2 / SC-002)

**Goal**: Confirm no "incomplete recap received" error and all fields populated.

1. Open a book at 20–80% progress. Tap "AI Recap".
2. Watch the streaming response complete.
3. **Expected**: All three sections (Memory Jogger, Concept Watchlist, Thematic Bridge) show non-empty text.
4. Repeat 3 times.
5. **Expected**: All 3 attempts succeed with no error toast.

**Before fix**: Second/third attempts often return error or show empty sections.

---

### Scenario 3 — Recap button locks while streaming (US2 / SC-008)

**Goal**: No duplicate recap requests.

1. Tap "AI Recap" and immediately tap it again while stream is in progress.
2. **Expected**: The second tap does nothing; button is disabled/unresponsive.
3. Check network tab — only one request to `generate-recap` was made.

---

### Scenario 4 — Incremental recap covers only delta pages (US3 / SC-003)

**Goal**: Second recap covers page 30–60, not page 0–60.

1. Read a book to page 30. Generate a recap. Note what Memory Jogger covers.
2. Advance to page 60. Generate a new recap.
3. **Expected**: The second Memory Jogger does NOT repeat the opening events from the first. It covers events from page ~30 onward.

---

### Scenario 5 — 100% completion hides recap, shows passport (US4 / SC-004)

**Goal**: At 100%, only the passport button is available.

1. Set a book's current page to its total page count (mark complete).
2. Go to BookDetailPage.
3. **Expected**: The entire AI Recap section (button, hint, history link) is invisible.
4. **Expected**: A "View Reading Journey" (or "✦ Book Passport") button is the only AI-related CTA.

---

### Scenario 6 — BookPassport stats are correct (US5 / SC-005)

**Goal**: After multi-day reading, passport shows real stats.

**Prerequisites**: Scenario 1 must pass first (history rows must exist).

1. Ensure a completed book has `progress_history` rows on at least 2 different calendar dates.
   *(If testing same-day: create rows with different `recorded_at` dates directly in Studio.)*
2. Navigate to BookPassportPage for that book (or trigger passport generation).
3. **Expected**: `total_days`, `peak_day`, and `peak_day_pages` all show non-null values.
4. For a single-session book (1 history row): **Expected**: `total_days = 1`.

---

### Scenario 7 — BookPassport AI summary is narrative prose (US4 / SC-006)

**Goal**: Summary reads as a paragraph, not raw JSON.

1. Navigate to BookPassportPage for a completed book.
2. **Expected**: The "Story So Far" / AI summary section shows flowing prose, not JSON characters (`{`, `"memory_jogger"`, etc.).
3. **Expected**: The text mentions the book's themes, arc, and memorable moments naturally.

---

### Scenario 8 — Velocity badge appears after 2 saves (US7 / SC-007)

**Goal**: VelocityBadge shows after progress history has data.

**Prerequisites**: Scenario 1 must pass first.

1. Save progress on a book twice (with a small time gap).
2. Reload BookDetailPage.
3. **Expected**: VelocityBadge appears with a pages/hour figure and a finish-line estimate.
4. At 100%: **Expected**: Badge is hidden.

---

### Scenario 9 — Fragment validation gate (US2 / FR-012)

**Goal**: No `{raw:""}` fragments saved to database.

1. Advance a book past a 10% boundary (e.g., 0% → 12%).
2. Wait a few seconds for the background extraction to complete.
3. Check `recap_fragments` table in Studio.
4. **Expected**: Any new row has a `raw_json` column containing a proper object with a `key_events` array.
5. **Expected**: No rows with `raw_json = {"raw":""}` or `{"raw":"...incomplete..."}`.

---

### Scenario 10 — ISBN forwarded to AI calls (US6 / FR-009)

**Goal**: ISBN is present in edge function payload when book has one.

1. Add a book via ISBN scan. Verify ISBN is stored in `books.isbn`.
2. Trigger a recap on that book.
3. Check Supabase Edge Function logs or browser network tab.
4. **Expected**: The request body to `generate-recap` includes `"isbn": "<value>"`.
5. For a manually-added book with no ISBN:
6. **Expected**: Request body either omits `isbn` or sends `null`; no error occurs.

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/stores/progress.ts` | Add `.then(() => {})` to fire-and-forget insert |
| `src/stores/recapFragments.ts` | Validate fragment JSON before saving |
| `src/stores/recaps.ts` | Pass `from_page` to `streamRecap` |
| `src/services/recapService.ts` | Add `from_page?` to `RecapRequest` interface |
| `src/stores/bookPassport.ts` | Fix `>= 1` guard, use `passport_summary` mode |
| `src/pages/BookDetailPage.vue` | Wrap recap section in `v-if="!isComplete"` |
| `supabase/functions/generate-recap/index.ts` | Remove fragments, add `passport_summary`, `from_page`, increase tokens to 8192 |

---

## Edge Function Deploy

After modifying the edge function:

```bash
supabase functions deploy generate-recap
```

Verify in Supabase Dashboard → Edge Functions → generate-recap → Logs that the deployment succeeded.
