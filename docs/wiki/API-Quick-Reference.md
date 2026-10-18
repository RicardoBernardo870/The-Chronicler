# API Quick Reference

Last updated: 2026-10-18 · Live project `zlndhygpqacygceivuvk`, web `master` @ `8d8701c`.

This is a one-table lookup for every edge function and every core RPC. Request and response contracts are on [API Documentation](API-Documentation.md). Field-level detail is in the [backend contract](../backend-contract.md), sections [8 RPC catalogue](../backend-contract.md#8-rpc-catalogue) and [10 Edge functions](../backend-contract.md#10-edge-functions). Tables are on [Database Data Model](Database-Data-Model.md).

## Edge functions and core RPCs

**Kind:** EF = edge function (`POST /functions/v1/<slug>`); RPC = `POST /rest/v1/rpc/<name>`.

**Auth / guard:**

- **JWT ✗** — `verify_jwt = false` and the token is only base64-decoded, never verified (S-06, fixed by BC-02).
- **JWT ✓** — the gateway verifies the token.
- **✅** — the RPC compares the caller with `auth.uid()`.
- **⚠ S-01** — the RPC trusts `p_user_id`.
- **⚠ S-02** — the RPC's guard is bypassed by `anon`.
- Both ⚠ cases are fixed by BC-01.

**TZ:** which day boundaries the RPC uses.

| Name | Kind | Purpose | Auth / guard | Returns · failure mode | TZ | PWA caller |
|---|---|---|---|---|---|---|
| `generate-recap` | EF v84 | Pre-start blurb (`currentPage = 0`), mid-book recap (inferred or corpus), `passport_summary`, `recap_image` job | JWT ✗ | **Text modes:** `200 text/plain` chunked raw text (not SSE) holding one JSON object, or prose for the passport; parse at the end.<br>**Image mode:** `202 {"status":"accepted"}`; the result arrives via `recaps.image_status`.<br>**Errors:** 400 / 401 / 503 / 500; no 405. | — | `src/services/recapService.ts` (via `src/stores/recaps.ts`), `src/stores/bookPassport.ts` |
| `generate-lore` | EF v18 | One Insight card per milestone 10 … 90 % | JWT ✗ | `200 {title, content, type, linked_entities}` (no page or milestone; the client inserts `lore_cards`). Errors 400 / 401 / 405 / 503 / 500. | — | `src/services/loreService.ts` (via `src/stores/loreCards.ts`) |
| `ocr-page` | EF v2 | Page photo → text | JWT ✗ | `200 {text, confidence, wordCount}`. Errors 400 / 401 / 502 / 503 / 504 / 500 `{error, message}`. A 200 with empty `text` is possible. | — | `src/composables/useCapture.ts` |
| `extract-vocabulary` | EF v2 | ≤ 5 uncommon words from capture text | JWT ✓ | `200 {words: [{word, definition}]}`. **Soft:** `200 {words: []}` on AI failure. | — | `src/composables/useVocabularyExtraction.ts` |
| `generate-page-resume` | EF v3 | "Previously" resume from one captured page | JWT ✓ | `200 {resume: {bullets[1–3], tension} \| null}`. **Soft:** `null` on failure. | — | `src/composables/usePageResume.ts` |
| `generate-book-quiz` | EF v1 | Memory Check quiz from captures (last 6 sent) | JWT ✓ | `200 {quiz: {questions[1–3]} \| null}`. **Soft:** `null` on failure. | — | `src/composables/useBookQuiz.ts` |
| `generate-reading-dna` | EF v8 | Reader identity profile (Google Search grounding) | JWT ✓ | `200 {personality, moodSignature, suggestions[3–5], booksFinishedAtGeneration, generatedAt}`. Errors 400 / 401 / 405 / 502 `ai_unavailable` / 500. | — | `src/stores/readingDna.ts` |
| `get_library_with_progress` | RPC | Library + progress + status (`dnf` / `unread` / `finished` / `reading`) + `source`, `pageCountEstimated`, `dnfAt` | ⚠ S-01 | JSON array, unpaginated; `[]` when empty | — | `src/stores/books.ts` |
| `get_reading_stats` | RPC | Week and month pages, lifetime pages (manual books), hours, sessions, streaks, velocity | ✅ | Object of integers; zeros for a foreign caller | **UTC** | `src/composables/useReadingProfile.ts` |
| `get_last_session` | RPC | Latest history row (timed or untimed) with delta, duration, prediction | ⚠ S-01 | Object or `null` | — | `src/composables/useLastSession.ts` |
| `get_library_breakdown` | RPC | Genre, author and status breakdown (ignores DNF) | ⚠ S-01 | Object | — | `src/composables/useLibraryBreakdown.ts` |
| `get_reading_velocity` | RPC | Days-to-finish forecast for given books | ⚠ S-01 | Rows `{book_id, days_left}` (snake_case); books with too little data are omitted | **UTC** | `src/composables/useReadingVelocity.ts` |
| `get_book_passport_stats` | RPC | Passport journey stats (`p_time_zone`) | ✅ (anon EXECUTE) | `{totalDays, peakDay, peakDayPages, vocabularyCount}` | local | `src/stores/bookPassport.ts` |
| `get_reading_calendar` | RPC | Active days of a month with books read | ✅ (anon EXECUTE) | `[{date, books[]}]` | local | `src/composables/useReadingCalendar.ts` |
| `get_monthly_reading` | RPC | Pages + books finished per month of a year | ✅ (anon EXECUTE) | 12 rows `{month, pages, booksFinished}` | local | `src/composables/useMonthlyReading.ts` |
| `get_reading_records` | RPC | Best day, longest session, fastest finish, night owl | ✅ (anon EXECUTE) | Object; null sub-objects when no data | local | `src/composables/useReadingRecords.ts` |
| `get_reading_quest_summary` | RPC | Yearly goal, quest pacing, XP, level, XP sources (imports excluded from page/completion XP) | ⚠ S-02 | `{goal, quest, level, sources}`; `Not allowed` for another signed-in user | **UTC** year | `src/stores/readingQuest.ts` |
| `get_my_community_profile` | RPC | Caller's profile identity + privacy | ✅ | `{profile, privacy}` or `null` (no row until first save) | — | `src/composables/useCommunityIdentity.ts` |
| `upsert_my_community_profile` | RPC | Create or replace the profile; full replace (omitted `isPublic` becomes `true`) | ✅ | Same shape; typed errors `username_invalid`, `username_taken`, `bio_too_long`, `visibility_invalid`, `not_authenticated` | — | `src/composables/useCommunityIdentity.ts` (`/profile/edit`) |
| `is_username_available` | RPC | Live username check (reserved names read as taken) | ✅ | `{available, normalizedUsername}` | — | `src/composables/useCommunityIdentity.ts` |

## Not in the table

**Dormant RPCs.** No client calls any of these:

- `upsert_weekly_goal` and `get_retention_summary` — a weekly reading-session goal, not vocabulary retention.
- 21 follow-graph, discovery and reading-circle RPCs (D-13).

They are listed in [API Documentation §4.3](API-Documentation.md#43-dormant-rpcs-no-client-caller) and contract §8.5 – §8.6.

**Internal and trigger functions.** These are reachable at `/rpc` but are **not** part of the contract. Some are destructive or leak data until BC-01 locks them: see [BE-06](../business-rules/09-database-invariants.md#be-06--every-function-is-an-http-endpoint-default-privileges-re-open-it).

**Planned endpoints:**

| Endpoint | Work package |
|---|---|
| `delete-account` | BC-11 |
| `start/pause/resume/cancel_session`, `save_progress` | BC-04 |
| `review_lexicon_entry` | BC-10 |
| Book-search proxy | BC-15 |
| Shared AI entitlement check | BC-12 |

See [API Documentation §9](API-Documentation.md#9-planned-api-changes).

**Direct table writes.** Library import (`src/composables/useLibraryImport.ts` + `booksStore.importBooks`), progress, captures, lexicon and AI results write tables through `supabase-js`. See [API Documentation §5](API-Documentation.md#5-direct-table-writes).
