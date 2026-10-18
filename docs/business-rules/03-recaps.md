# 03 · Recaps — Business Rules
> **Prefix:** REC · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-19 (BC-01 and BC-02 shipped)

## Overview

Recaps are The Chronicler's AI "memory joggers" (D-03: "The Chronicler" is the product name; "BookHero" stays the code name). A recap is a three-part briefing — `memory_jogger` (what happened), `concept_watchlist` (names to keep an eye on) and `thematic_bridge` (the open thread) — for the stretch of a book read since the previous recap. This file covers every path that produces, gates, stores or displays recap content:

- **Mid-book recap**, in two modes. **Corpus** is grounded on up to 3 of the reader's own page captures. **Inferred** is built from model knowledge: a Gemini 2.5 Pro extraction with Google Search grounding, then a Flash composer.
- **Pre-start blurb**: the `currentPage === 0` path, stored as a normal recap row.
- **Passport summary**: `book_passports.ai_summary`, a 90–100-word celebratory narrative of the whole book.
- **Recap images**: one 1024×1024 illustration per recap, made by a background server job.
- **Recap lock**: +5 % pages, 6 h cooldown, 72 h idle grant.
- **History, journal framing, book carousel and profile gallery.**
- **Recaps as context for other features**: the Master Recap for Insights, `recapContext` for quiz and resume, and suppression of the quiz and resume prompts after a fresh recap.

| Web route / surface | Purpose | Recap elements |
|---|---|---|
| `/` Dashboard hero card | The active in-progress book | "Get Recap" button or lock label; `RecapDialog` modal |
| `/books/:id` Book Detail → "Recap memories" section | One book | "Get Recap" in the section header; recap-image carousel; "View Recap History (N)" |
| `/books/:id/recaps` (route `recap-history`) | Journal of all recaps for a book | `RecapHistory` → `RecapCard` list, newest first |
| `/profile` → "Recap memories" | The 12 newest succeeded images across all books | Tap opens that book's history |
| `/books/:id/passport` (route `book-passport`) | Book Passport | `ai_summary` ("Your Story So Far"), streamed live, then persisted. The stats and page states belong to [02 · Reading Sessions](02-reading-sessions.md) (SES-44…SES-51) |
| Memory Check summary → "Feeling hazy? Read the full recap" | Link | → `recap-history` |
| Internal (no UI) | Master Recap → Insights; `recapContext` → quiz and resume | See REC-58…REC-61 |

**Owning objects** (names only; shapes live in [backend-contract](../backend-contract.md) §3 Tables, §7 Storage, §8 RPC catalogue, §10 Edge functions):

| Kind | Objects |
|---|---|
| Tables owned | `recaps`, `book_passports.ai_summary` |
| Tables read | `page_captures`, `progress_history`, `reading_progress`, `books` |
| Storage | bucket `recap-images` |
| Edge function | `generate-recap` (deployed v84), modes `recap` (corpus / inferred), `blurb`, `passport_summary`, `recap_image` |
| RPCs | `get_book_passport_stats`; `get_reading_quest_summary` (counts recaps for XP) |
| Triggers that affect recaps | `reading_progress_updated_at`, `page_captures_delete_on_completion`, `page_capture_quest_event_after_save` |

**Related domains:**

- [02 · Reading Sessions](02-reading-sessions.md): page saves, completion, passport stats and page.
- [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md): captures, fresh-recap suppression, `recapContext`.
- [06 · Insights](06-insights.md): master recap, milestone unlock.
- [07 · Profile, Stats & Goals](07-profile-stats-goals.md): XP, "Storyteller", gallery.
- [08 · Platform, Auth & Account](08-platform-auth-account.md): auth.
- [09 · Database invariants](09-database-invariants.md): cascades, storage.
- [11 · Cross-domain](11-cross-domain.md): delete, complete and sign-out.

**Traceability:** feature specs `specs/004`, `008`, `015` and `021` describe intent that the code has since superseded: 30 % capture coverage, a +10 % unlock, a Gemini image model, Realtime image updates and delta-only inferred recaps. This catalog supersedes them.

**Live snapshot (2026-10-18, aggregates only):**

| Measure | Value |
|---|---|
| `recaps` rows | 81 (71 `succeeded`, 10 legacy `NULL` image status; 0 `pending`, 0 `failed_*`) |
| By mode | 66 corpus, 15 inferred |
| Page-0 (blurb) rows | 2 |
| `recap-images` objects | 74, against 71 rows with an `image_path` (3 orphans) |
| Tables in the `supabase_realtime` publication | 0 |

---

## Rules

### Entry points & visibility

#### REC-01 · Generation is always explicit
No code path generates a mid-book recap or blurb automatically. Imports, completion and page saves never call `generateRecap`; only the two "Get Recap" buttons do. Passport summaries (REC-35) and recap images (REC-41) are the only automatic generations in this domain.
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:50-52`, `src/services/recapService.ts:52-53`

#### REC-02 · Where the Get Recap button exists
- **Hero card:** shown only for the active in-progress book (`0 < percentage < 100`, not DNF). It is **replaced by "End Session" while a session is active**.
- **Book Detail:** the button is rendered only when `percentage < 100`. The whole "Recap memories" section (button, carousel, history link) is hidden for DNF books. Book Detail does **not** hide the button during an active session, unlike the hero.
- **Enforced:** `client` only. The server accepts a request for any book state (REC-11).
- **Source:** `src/stores/progress.ts:679-688`, `src/components/dashboard/HeroBookCard.vue:258-278`, `src/pages/BookDetailPage.vue:121-122,304-317`
- **Target:** the server-side eligibility check (D-06 · BC-07) also rejects DNF and complete books (reasons `book_dnf` / `book_complete`, BC-07 acceptance 07-3). Whether a final recap at 100 % should ever be allowed stays open (REC-Q07).
- **Note:** the hero never shows a page-0 book, because `inProgressBooks` requires `percentage > 0`. A blurb is therefore reachable only from Book Detail (REC-33).

### Recap lock (client-only today)

#### REC-03 · Page threshold (+5 %)
`unlockPage = max(1, ceil(min(100, lastRecapPct + 5) / 100 × total_pages))`, where `lastRecapPct` is the newest recap's `progress_snapshot` (newest by `created_at`), or 0 when the book has no recap. The button is locked by pages while `(current_page ?? 0) < unlockPage`. If the book is not in the client store, `unlockPage = 0` and the page lock is off.
- **Enforced:** `client` (`useRecapLock`)
- **Source:** `src/composables/useRecapLock.ts:6,45-57`
- **Target:** the same formula is evaluated by `generate-recap` against server data, and a locked request is refused (D-06 · BC-07).
- **Note:** examples:
  - A 300-page book with no recap unlocks at page 15.
  - With the last recap at 37.45 %, the target is 42.45 %, which is page 128.
  - Page 0 is always page-locked (`unlockPage ≥ 1`).

#### REC-04 · Cooldown (6 h, "Option B" anchor)
`hoursSinceMeaningfulEvent = min(hoursSinceLastRecap, hoursSinceLastPageSave)`. `hoursSinceLastRecap` uses the newest recap's `created_at`; `hoursSinceLastPageSave` uses `lastPageSavedAt[bookId]` (REC-05). Each is ∞ when absent. `lockedByCooldown = !lockedByPages && !idleUnlocked && hoursSinceMeaningfulEvent < 6`. **Every page save, and every recap, locks Get Recap for 6 h.**
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:7,68-107`
- **Target:** evaluated on the server clock in `generate-recap` (D-06 · BC-07). Whether page saves should anchor the cooldown at all stays open (REC-Q01).

#### REC-05 · `lastPageSavedAt` source
`lastPageSavedAt` is set as follows:
1. **Hydration:** once per book per app session, from the newest `progress_history.recorded_at` (`order recorded_at desc limit 1`). Hydration is triggered by `useRecapLock`'s immediate watcher. It is skipped when an optimistic value already exists. On a fetch error `loaded` stays false, so it retries on the next call.
2. **Optimistic overwrite:** at the start of every `updateProgress` (before the network call, and also when offline).
3. **Confirmed overwrite:** with the confirmed history-insert timestamp.
4. **Rollback:** on a server error.
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:41-46,178-207,524-529,579,634-639`, `src/composables/useRecapLock.ts:27-36`
- **Target:** the anchor becomes the newest `progress_history` row as seen by the server (BC-04 · BC-07).
- **Note:** the composable's doc comment ("does NOT trigger any fetches") is wrong (REC-D32).

#### REC-05b · Offline saves never create a `progress_history` row
The offline queue drains through `syncToSupabase`, which only upserts `reading_progress`. It never inserts history and never runs the passport or Insight side effects. Three consequences:
- An offline save starts the 6 h cooldown locally (optimistic `lastPageSavedAt`).
- After an app restart, or on another device, the cooldown re-hydrates from the last **online** save.
- The flush bumps `reading_progress.updated_at` to the server's `now()` at flush time, which resets the 72 h idle clock (REC-07). ⚠ REC-D24
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:52-84,656-664`, `src/composables/useOfflineSync.ts:76-88`
- **Target:** offline saves are replayed through `save_progress` with their original timestamp and write `progress_history` rows, so the server-side cooldown anchor includes them (D-08 · BC-04).

#### REC-05c · Mixed clocks
`progress_history.recorded_at` is stamped with the **device** clock. `recaps.created_at` and `reading_progress.updated_at` are stamped with the **server's** `now()`. All lock math compares them against the device's `Date.now()`, so device clock skew shifts the cooldown and idle windows. For example, a device running 2 h fast sees a server-stamped recap as 2 h older than it is. ⚠ REC-D24
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:563-573`, `src/composables/useRecapLock.ts:60-85`
- **Target:** history is stamped on the server clock (client time only for offline replays), and eligibility is computed with the server's `now()` (D-06 · BC-04 · BC-07).

#### REC-06 · Idle unlock (72 h)
`idleUnlocked = hoursSinceLastSession ≥ 72 && hoursSinceLastRecap ≥ 6`, where `hoursSinceLastSession` is the hours since `reading_progress.updated_at`. With no progress row it is 0, so an idle grant is impossible. The idle grant overrides **both** the page lock and the cooldown.

The grant is one-shot per recap: the recap it produces re-locks Get Recap for 6 h. After that, if the reader is still idle, the grant applies again, so same-page recaps every 6 h are possible.
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:8,59-64,92-100`; test `tests/unit/recapLockIdleUnlock.spec.ts`
- **Target:** evaluated server-side (D-06 · BC-07). The anchor and the repeat behaviour stay open (REC-Q03, REC-Q04).

#### REC-07 · Any `reading_progress` update resets the idle clock
Live trigger `reading_progress_updated_at` (`BEFORE UPDATE … EXECUTE FUNCTION set_updated_at()`) sets `updated_at = now()` on every update, so all of these reset the 72 h idle clock:
- session start, pause, resume, cancel and end;
- DNF and resume-from-DNF;
- pencil edits;
- offline flushes.

"Idle" therefore means 72 h since **any** write to the progress row, not since the last page change.
- **Enforced:** `server:db` (trigger `reading_progress_updated_at`)
- **Source:** `supabase/reference/live-baseline-2026-10-18.sql` (trigger list)
- **Note:** the BC-04 session RPCs still write `reading_progress`, so this rule is unchanged unless REC-Q04 moves the anchor.

#### REC-08 · Final lock
`recapLocked = !DISABLE_RECAP_LOCK && !idleUnlocked && (lockedByPages || lockedByCooldown)`. `DISABLE_RECAP_LOCK` is a test-only flag and is `false` in production.
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:10-12,109-114`
- **Target:** `generate-recap` refuses locked requests on the server clock, and clients only render the state (D-06 · BC-07). How clients learn the state is REC-Q12.

#### REC-09 · Lock labels
| Condition | Label |
|---|---|
| Locked by pages | `"{n} more page"` / `"{n} more pages"`, `n = max(0, unlockPage − currentPage)` |
| Locked by cooldown | `"Recap in {h} hour"` / `"Recap in {h} hours"`, `h = max(0, ceil(6 − hoursSinceMeaningfulEvent))` |
| Otherwise | `''` |

- **Book Detail button:** label precedence is `recapTriggered ? 'Recap open' : recapLocked ? (label || 'Locked') : 'Get Recap'`. The tooltip is `label || "Read N more pages"`.
- **Hero:** the locked button shows `label || "Read N more pages"`. While the modal is open the hero shows "Recap open" (disabled).
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:116-136`, `src/pages/BookDetailPage.vue:309-313`, `src/components/dashboard/HeroBookCard.vue:265-277`

#### REC-10 · The lock is not time-reactive
The lock computeds read `Date.now()`, which is not reactive. The label and the lock re-evaluate only when a dependency changes (progress, recaps, `lastPageSavedAt`, book id). A cooldown that expires while the page stays open does not unlock until something re-renders, and "Recap in N hours" never counts down. ⚠ REC-D17
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:60-85`

#### REC-11 · No server-side gating
Neither RLS, the database nor `generate-recap` enforces the lock, quotas, completion or DNF state. Any authenticated caller — and, today, any caller with a forged token (REC-21) — can generate unlimited recaps. ⚠ REC-D04
- **Enforced:** none. Policy `Users can manage their own recaps` is owner-only for all commands.
- **Source:** `supabase/functions/generate-recap/index.ts:16-65`
- **Target:**
  - Eligibility (REC-03…REC-08) is enforced by `generate-recap` on the server clock (D-06 · BC-07).
  - One shared entitlement and AI-usage check runs in the function, and it allows everything until tiers are decided (D-14 · BC-12).

#### REC-12 · The concurrency guard is global and soft
`generateRecap` returns early, silently, if `generationStatus === 'streaming'`. That is one store-wide status, not one per book. Both callers call `resetStatus()` right before `generateRecap`, and closing the Book Detail modal also resets it. This re-opens the guard while a stream may still be running, so two generations for the same book can run at once. ⚠ REC-D10, REC-D12
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:54,168-172`, `src/pages/BookDetailPage.vue:185-189,213-216`
- **Target:** BC-07 adds a server-side per-book in-flight guard (at most one running request per user and book) and an idempotent `requestId`.

### Mode selection & request building (client-only today)

#### REC-13 · Delta start (`fromPage`)
`fromPage = recaps[0].pageSnapshot ?? 0`, where `recaps[0]` is the newest by `created_at` and a null page counts as 0. It is sent as `from_page` only when `> 0`; otherwise it is omitted and the server treats it as 0.
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:75,102`
- **Target:** computed server-side (D-06 · BC-07).

#### REC-14 · Corpus window = two recaps back ("Option A")
`capturesFromPage = recaps[1].pageSnapshot ?? 0` (the second-newest recap). The candidate captures are `capturesInRange(bookId, capturesFromPage, currentPage)`, which means `capturesFromPage < page ≤ currentPage`. The window therefore spans the current stretch **and** the previous one. ⚠ REC-D05
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:83-86`, `src/stores/captures.ts:27-28`
- **Target:** the corpus window is selected server-side (D-06 · BC-07). Which window is REC-Q02.

#### REC-15 · Capture cap and order
Take the 3 highest-page captures in the window (`MAX_RECAP_CAPTURES = 3`), re-sort them ascending by page, and send `{page, text}` only.
- **Enforced:** `client`. The server applies no cap and no length limit (REC-25).
- **Source:** `src/stores/recaps.ts:16,87-90,103-105`

#### REC-16 · Corpus decision
`useCorpus = selected.length ≥ 1 && currentPage > fromPage`; `mode = useCorpus ? 'corpus' : 'inferred'`. No coverage threshold applies: `coverageInRange` exists but has no caller. A same-page recap (`currentPage ≤ fromPage`) is therefore always inferred.
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:91-92`, `src/stores/captures.ts:34-38`
- **Target:** decided server-side, and the server reports the mode it used (D-06 · BC-07).

#### REC-17 · The inferred-recap warning uses a different window
Before generating, both entry points check `capturesInRange(bookId, fromPage, currentPage)` — the true one-back delta, not the store's two-back window. When it is empty they show a confirm dialog:

| Element | Copy |
|---|---|
| Header | "Inferred recap" |
| Message | "Without scanned pages, this recap is generated from your book's metadata and may be less accurate or contain spoilers. Continue?" |
| Buttons | "Generate anyway" / "Cancel" |

The reader can therefore be warned "inferred" and then receive a `corpus` recap built from older captures. ⚠ REC-D06
- **Enforced:** `client`
- **Source:** `src/pages/BookDetailPage.vue:191-209`, `src/pages/DashboardPage.vue:89-109`
- **Target:** the warning and the mode are driven by one server decision (BC-07 · REC-Q02, REC-Q12).

#### REC-18 · Request payload values
| Field | Value |
|---|---|
| `title`, `author` | From the book |
| `isbn` | From the book; may be null |
| `percentage` | `progress.percentage ?? 0`, 2 decimals (e.g. 37.45) |
| `currentPage` | `progress.currentPage ?? 0` |
| `totalPages` | `book.totalPages` |
| `from_page` | Optional (REC-13) |
| `captures` | Optional (REC-15) |

- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:65-67,95-106`

#### REC-19 · Mode, `fromPage` and the lock depend on hydrated client state
Mode selection, `fromPage` and the lock all require the book's recap list to be loaded.
- **Dashboard:** it swallows `fetchRecapsForBook` errors. After a failure `fromPage` becomes 0 and the recap covers the book from page 1.
- **Captures:** loaded via `fetchCapturesForBook`; errors are swallowed.
- **Book Detail:** the opposite problem. `onMounted` awaits `fetchRecapsForBook` **without** a catch, so a failure throws out of `onMounted` and skips `fetchPassport`, `fetchEntriesForBook` and `markBookLoreSeen` for that visit. ⚠ REC-D29
- **Enforced:** `client`
- **Source:** `src/pages/DashboardPage.vue:147,179`, `src/stores/recaps.ts:84-85`, `src/pages/BookDetailPage.vue:86-95`, `src/composables/useRecapLock.ts:49-50`
- **Target:** the server reads its own state, which removes the hydration dependency (D-06 · BC-07).

### Edge function `generate-recap`: transport, auth, routing (deployed v84; functionally identical to the repo)

#### REC-20 · CORS and preflight
`OPTIONS` returns `200 "ok"` with these headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Allow-Methods: POST, OPTIONS`

No `Access-Control-Expose-Headers` is set. Since 2026-10-19 (BC-02) any other method than `OPTIONS` and `POST` gets `405 {"error":"Method not allowed"}`.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/cors.ts:1-11`, `index.ts`

#### REC-21 · Authentication
- A missing `Authorization` header → `401 {"error":"No authorization header"}`.
- Since 2026-10-19 (BC-02, v86) the token is verified by Supabase Auth (`supabase.auth.getUser` in the shared `supabase/functions/_shared/auth.ts`): signature, expiry and that the user exists. A forged, expired or anon-key token → `401 {"error":"Unauthorized"}`.
- Platform `verify_jwt` is `true` on the live project, and `supabase/config.toml` commits it.

The hand-rolled base64url decode is gone, and with it the spurious-401 defect for tokens whose payload encodes to `-` or `_` (REC-D01 and REC-D03, both fixed).
- **Enforced:** `server:edge` (gateway `verify_jwt` + `supabase.auth.getUser`)
- **Source:** `supabase/functions/generate-recap/index.ts`, `supabase/functions/_shared/auth.ts`; `supabase/config.toml`

#### REC-22 · Body validation
| Mode | Requirement | Failure |
|---|---|---|
| `recap_image` | Truthy `recapId`, `title`, `memoryJogger` | `400 {"error":"Missing required image fields"}` |
| All other modes, including `passport_summary` | Truthy `title`, `author`, `totalPages`, and `percentage !== undefined` | `400 {"error":"Missing required fields"}` |
| Any | Body is a valid JSON object | `400 {"error":"invalid_input"}` (since BC-02) |

The check order is: method → auth header → `getUser` → `req.json()` → field validation → `GEMINI_API_KEY` → `OPENAI_API_KEY` (image only).

From the PWA the text-mode 400 is unreachable, because the live CHECKs `books_title_check` (1–500 chars), `books_author_check` (1–200 chars) and `books_total_pages_check` (≥ 1) guarantee truthy values. A native client must still send a non-empty `author` and `totalPages ≥ 1`.
- **Enforced:** `server:edge`; `server:db` (`books_*_check`)
- **Source:** `supabase/functions/generate-recap/index.ts`
- **Note:** since 2026-10-19 (BC-02) a 500 body is `{"error":"Internal server error","requestId"}`, with no internal error text.

#### REC-23 · Provider configuration errors
| Missing | Response | Applies to |
|---|---|---|
| `GEMINI_API_KEY` | `503 {"error":"AI service not configured"}` | All modes. Image mode needs it too, for the prompt refiner. |
| `OPENAI_API_KEY` | `503 {"error":"OpenAI image service not configured"}` | `recap_image` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `503 {"error":"Supabase admin client not configured"}` | `recap_image` |

- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/index.ts:43-51`, `aiClient.ts:15-19`, `openaiClient.ts:6-14`, `handlers/recapImage.ts:14-17,35-46`
- **Note:** the secrets are named above; their values are never documented.

#### REC-24 · Mode resolution priority
1. `mode === "recap_image"` → image.
2. `mode === "passport_summary"` → passport.
3. `currentPage === 0` → blurb.
4. Otherwise → mid-book recap.

The page-0 test is strict `=== 0`, so a body with no `currentPage` routes to the mid-book recap.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/router.ts:11-16`

#### REC-25 · The client decides corpus vs inferred
On the server, a non-empty `captures` array means the corpus path; anything else means inferred. The server does **not** filter captures by page range (the types comment says the client must ensure `fromPage < page ≤ currentPage`), does not cap their count or text length, and does not check that they belong to the caller's book.
- **Enforced:** `server:edge` (trusts input)
- **Source:** `supabase/functions/generate-recap/handlers/recap.ts:25-28`, `types.ts:14-18`
- **Target:** the server loads the caller's captures itself and selects the window (D-06 · BC-07).

#### REC-71 · Text-mode streaming contract
For text modes (recap, blurb, passport) a successful response is:
- `200` with `Content-Type: text/plain; charset=utf-8` and `Cache-Control: no-cache`;
- a chunked stream of **raw model text** — not SSE, no framing, no terminal event.

| Mode | Body |
|---|---|
| Recap and blurb | The text of a JSON object `{"memory_jogger","concept_watchlist","thematic_bridge"}`, possibly wrapped in code fences |
| Passport | Plain prose |
| Image | `202 {"status":"accepted"}` (JSON) |

- **Mode header:** the corpus path adds `X-Recap-Mode: corpus`. It is not in `Access-Control-Expose-Headers`, so browser JS cannot read it; a native HTTP client can.
- **Mid-stream failure:** a provider error mid-stream calls `controller.error`. The client sees a read error after a 200, with no JSON error body. A truncated or blocked stream is a 200 with partial text, which fails the client's parse (REC-36).
- **Disconnects:** the server does not observe client disconnects. Gemini calls already issued are not cancelled.
- **Time to first byte:** corpus is near-immediate. Inferred waits for up to 3 sequential, search-grounded Gemini 2.5 Pro calls before the first byte (REC-26, REC-30b).
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/handlers/recap.ts:139-161,237-274`, `handlers/blurb.ts`, `handlers/passport.ts`, `handlers/recapImage.ts:19-32`
- **Target:** BC-07 changes the response to carry the persisted, validated row. The exact wire format (JSON, NDJSON, or a stream plus a final frame) is REC-Q11. The legacy text stream stays available until the PWA migrates (D-05).

#### REC-72 · Error response contract
All errors are `application/json` with CORS headers.

| Status | Body | When |
|---|---|---|
| 401 | `{"error":"No authorization header"}` | Header missing |
| 401 | `{"error":"Unauthorized"}` | Payload undecodable or no `sub` — including the spurious base64url case (REC-21) |
| 400 | `{"error":"Missing required image fields"}` / `{"error":"Missing required fields"}` | REC-22 |
| 503 | `{"error":"AI service not configured"}`, `"OpenAI image service not configured"`, `"Supabase admin client not configured"` | REC-23 |
| 500 | `{"error":"AI output invalid","detail":…,"finishReason"?,"blockReason"?}` with `detail` ∈ "Provider safety block", "Low extraction confidence after retries", "No JSON block found in response", "Recap composition failed" | Inferred or corpus failure **before** streaming starts |
| 500 | `{"error":"Internal server error","detail":"<String(err)>"}` | Uncaught: bad JSON body, blurb/passport stream-start failure, a Gemini Pro throw, a non-string capture `text` |
| (none) | Read error after a 200 | Mid-stream provider error (REC-71) |
| 5xx gateway | Platform body, not the function's JSON | An inferred run exceeding platform request limits before the first byte [UNVERIFIED: platform limits not observed in this project] |

- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/index.ts:22-64`, `handlers/recap.ts:41-108,130-137,166-174,229-235`
- **Target:** no internal error text (D-06 · BC-02). The eligibility, entitlement and idempotency refusals that BC-07 and BC-12 add get stable machine-readable codes, defined in [backend-consolidation-plan](../backend-consolidation-plan.md).

### Inferred path (extraction → retry → composer)

#### REC-26 · Extraction call
| Setting | Value |
|---|---|
| Model | **`gemini-2.5-pro`** |
| Temperature | `0.0` |
| `maxOutputTokens` | 8192 |
| Tools | `googleSearch` |
| `dynamicRetrievalConfig` | `{mode: MODE_DYNAMIC, dynamicThreshold: 0}`, placed at the top level of `config` — most likely no effect [UNVERIFIED] |
| Streaming | No (`generateContent`) |
| `thinkingConfig` | None |

**System prompt** ("Paranoid Literary Analyst" v4):
- identify the book's ending in order to avoid it;
- find the chapter→page map;
- stop 1–2 chapters before the current page's chapter, with a 15–20 % safety buffer;
- omit anything ≥ 1 % uncertain;
- never mention foreshadowing.

**Output JSON:** `_internal_audit{book_ending_to_avoid, estimated_chapter_at_page, safe_stop_chapter}`, `chapters_covered[]`, `key_events[]`, `active_characters[]`, `current_conflicts`, `mood`, `confidence_level ∈ {high, medium, low}`.

**User message:** search instructions; "if no page-to-chapter map is found, stop at the `round(percentage × 0.8)` % mark"; title, author, ISBN (`"N/A"` if absent), page, total, percentage.

**`fromPage` is not used in either prompt**, so an inferred extraction is a story-so-far, not a delta. ⚠ REC-D07
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/extraction/runExtraction.ts:28-89`, `prompts/extraction.ts:9-42`
- **Note:** `totalPages` is passed to `buildExtractionPrompt` but used only in the user message. `VALID_CONFIDENCE` is declared and never used (REC-D32).

#### REC-27 · JSON repair
`extractJson(raw)` tries three candidates in order and returns the first that `JSON.parse`s, else `null`:
1. a fenced ```` ```json ```` block;
2. the slice from the first `{` to the last `}`;
3. the raw text.

There is no schema validation beyond "is an object".
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/utils/json.ts:13-33`, `extraction/runExtraction.ts:63-77`

#### REC-28 · A safety block is terminal
If `promptFeedback.blockReason` is set, the function logs and returns `500 {"error":"AI output invalid","detail":"Provider safety block","finishReason","blockReason"}`. There is no retry.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/handlers/recap.ts:63-79`

#### REC-29 · Confidence retry policy
- **Proceed** when a parsed result exists and `confidence_level !== "low"`. A missing or unknown confidence counts as acceptable.
- **Retry** when there is no JSON or the confidence is low. `MAX_ATTEMPTS = 2` extra attempts, so at most 3 extraction calls.
- **Retry page:** attempt *n* uses `computeAdjustedPage = max(currentPage − 5n, max(fromPage + 1, 1))`.
- **Unreachable abort:** the documented branch for `adjusted ≤ fromPage` (log "adjusted page would not advance past fromPage; aborting retries") can never fire, because `adjusted ≥ fromPage + 1` always.
- **Spoiler consequence:** when `currentPage ≤ fromPage` (an idle re-grant on the same page, or progress moved backwards), retries target `fromPage + 1`, a page **beyond** the reader's position. ⚠ REC-D08
- **Exhausted:** with no JSON → detail "No JSON block found in response"; with low confidence → "Low extraction confidence after retries".
- **Dead constant:** `TEMPERATURE = 0.3` is unused; the real temperature is 0.0.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/extraction/retryPolicy.ts:4-25`, `handlers/recap.ts:32-108`

#### REC-30 · Composer
| Setting | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| Temperature | 0.7 |
| `maxOutputTokens` | 4096 |
| `thinkingBudget` | 0 |
| Streaming | Yes |

**User message:** "Here is the extracted content from pages {fromPage > 0 ? fromPage + 1 : 1} to {lastAdjustedPage} … {rawJson} … use ONLY …".

**System prompt** ("The Chronicler" v3, arc-shaped):
- use only the provided content; no external knowledge or inference about the future;
- `memory_jogger`: 2–4 plain sentences (anchor → what changed → strongest dramatic or visual moment), **max 90 words**;
- `concept_watchlist`: comma-separated, **max 5 items**;
- `thematic_bridge`: 1–2 sentences, the open thread;
- label-free prose: no lists, line breaks or markdown, because `memory_jogger` feeds the image refiner verbatim.

A stream-start failure returns `500 {"error":"AI output invalid","detail":"Recap composition failed"}`.

**The book's ending leaks into the composer.** `rawJson` is embedded verbatim, including `_internal_audit.book_ending_to_avoid` and `estimated_chapter_at_page`. The only guard is the composer prompt's instruction not to emphasise future developments. ⚠ REC-D09
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/handlers/recap.ts:110-162`, `prompts/recap.ts:13-44`, `prompts/extraction.ts:31-35`

#### REC-30b · No bytes before composition, no timeout
The inferred path sends nothing until up to 3 sequential, search-grounded `gemini-2.5-pro` calls finish. Neither the client (a `fetch` with no timeout) nor the function sets a timeout. Platform request-idle and wall-clock limits could end a slow 3-attempt run with a gateway error instead of the JSON error shapes [UNVERIFIED: limits taken from Supabase docs, not observed in this project's logs]. ⚠ REC-D30
- **Enforced:** none
- **Source:** `src/services/recapService.ts:59-67`, `supabase/functions/generate-recap/handlers/recap.ts:36-97`
- **Target:** BC-07 defines abort and background semantics: once the paid call has started, the server finishes and saves.

### Corpus path

#### REC-31 · Corpus composer
The extraction stage is skipped.
1. Captures are sorted ascending by page.
2. Each becomes a block `[Page N]\n{text.trim()}`; blocks are joined by blank lines.
3. The user message frames them as "covering pages {fromPage + 1 or 1} to {currentPage} (the stretch since their last recap)", with these CRITICAL constraints:
   - only the captured text;
   - no inference from the title, author or training data;
   - no speculation and no predictions about a character's fate;
   - "what happened in this stretch", not a story-so-far.
4. Model, parameters and system prompt are the same as REC-30.

The response adds the header `X-Recap-Mode: corpus`. The first-chunk function log records `{stage:"recap", mode_selected:"corpus", first_token_latency_ms, captures_in_range, range_pages}`.

A non-string `text` makes `c.text.trim()` throw before streaming → `500 Internal server error`. Capture text is not length-capped server-side. ⚠ REC-D18
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/handlers/recap.ts:186-275`
- **Note:** the prompt calls the captures "the stretch since their last recap". With the two-back window (REC-14) they may come from the previous stretch (REC-D05).

### Blurb & passport summary

#### REC-32 · Blurb (page 0)
| Setting | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| Temperature / tokens / thinking | 0.7 / 4096 / `thinkingBudget 0` |
| Streaming | Yes |
| Output | The same 3-key JSON, as a raw JSON object only (no markdown, no fences — the client still strips fences) |
| `memory_jogger` | 2–4 sentences, **max 600 characters**, a spoiler-free hook |
| `concept_watchlist` | **Max 13 items**, names only |
| `thematic_bridge` | 1–2 sentences on mood and tone |
| User message | Title, author and ISBN only; no page or progress data |

A stream-start failure is not caught in the handler, so it surfaces as `500 Internal server error`.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/handlers/blurb.ts:7-44`, `prompts/blurb.ts:8-16`
- **Target:** repo prompt sources are byte-synced to the deployed v84. The repo uses `—`/`–` where deployed uses ASCII `-`, despite the "BYTE-EQUIVALENT" comment (BC-03).

#### REC-33 · Blurbs persist as recaps
A blurb is reached only through the REC-06 idle grant at page 0 on Book Detail. It needs a `reading_progress` row at page 0 whose `updated_at` is ≥ 72 h old, and the inferred warning is also shown. The result is inserted like any recap:
- `progress_snapshot 0`, `page_snapshot 0`, `mode 'inferred'`, `image_status 'pending'`;
- an image is requested;
- it counts for XP and the "Storyteller" badge;
- it becomes `latestRecap`, so `fromPage` stays 0.

The live database holds 2 page-0 rows. ⚠ REC-D26
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:120-151`
- **Note:** the Master Recap excludes blurbs (`progress_snapshot > 0`, REC-58). Quiz and resume `recapContext` and the fresh-recap suppression do not (REC-60, REC-61).

#### REC-34 · Passport summary request
The request body is `{title, author, isbn|null, percentage: 100, currentPage: totalPages, totalPages, mode: "passport_summary"}`.

| Setting | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| Temperature / tokens / thinking | 0.8 / 4096 / `thinkingBudget 0` |
| Output | Plain-text stream (not JSON): one paragraph of **90–100 words** covering the full arc, warm and celebratory, with no spoiler constraints |
| Input | Title, author and ISBN only; never the reader's captures, notes or recaps |

- **Enforced:** `server:edge`
- **Source:** `src/stores/bookPassport.ts:133-148`, `supabase/functions/generate-recap/handlers/passport.ts:7-44`, `prompts/passport.ts:7-18`

#### REC-35 · Passport trigger & persistence
**Trigger.** Generation runs only from `updateProgress` when **online**, when `newPct ≥ 100 && prevPct < 100`, and only after `fetchPassport` finds no row. A per-book `generating` flag de-duplicates within the tab.

**Sequence:**
1. Stats RPC `get_book_passport_stats(p_user_id, p_book_id, p_time_zone = device IANA zone or 'UTC')`.
2. POST the passport summary request (REC-34). The stream is shown live on the passport page.
3. Upsert `book_passports` with `onConflict: 'book_id'`: the stats, `ai_summary` (whatever text arrived — possibly empty or partial) and `generated_at = client now`.

**Failure.** A non-OK HTTP response, a stats-RPC error or a stream error → logged, **no row written, no retry**. A failed upsert is skipped silently. The `fetchPassport(...).then(...)` chain has no catch, so a fetch error silently skips generation. An offline completion never triggers it. ⚠ REC-D22
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:551,616-624,656-664`, `src/stores/bookPassport.ts:19-48,113-190`
- **Target:** completion is detected server-side by `save_progress` (BC-04). One server owner then runs the passport AI-summary job on every completion path — online, offline replay, any client — with retries, and freezes the passport stats at completion. Clients only read the result (D-06 · BC-04 · BC-05).
- **Note:**
  - The trigger fires for any book source, including imported books later finished in-app. Book Detail shows "View Journey" only for `source = 'manual'` ([01 · Library](01-library.md), LIB-86).
  - CSV-imported "read" books and books added as "Already finished" never get a passport today.
  - The passport page states and the stats refresh are SES-48…SES-50 in [02 · Reading Sessions](02-reading-sessions.md).

### Persistence of a recap (client-owned today)

#### REC-36 · Parse & validate
1. The client accumulates the **whole** body.
2. It extracts the JSON: a ```` ```(json) ```` fenced block (non-greedy), else the first greedy `{…}`, else the trimmed text.
3. `JSON.parse` failure → "AI returned an unexpected response format. Please try again."
4. Any of the 3 keys falsy → "Incomplete recap received. Please try again."

There are no type or length checks: the watchlist count and the word limits are prompt-only, and a non-string value passes the truthiness check. ⚠ REC-D18
- **Enforced:** `client`
- **Source:** `src/services/recapService.ts:99-125`
- **Target:** the server parses and validates before persisting (D-06 · BC-07).

#### REC-37 · Insert
The **client** inserts the `recaps` row: `book_id, user_id, progress_snapshot = percentage, page_snapshot = currentPage, memory_jogger, concept_watchlist, thematic_bridge, mode, image_status: 'pending'`. The server defaults `id` and `created_at`.

| Column | Live constraint |
|---|---|
| `memory_jogger`, `concept_watchlist`, `thematic_bridge` | `char_length > 0` CHECKs |
| `mode` | ∈ {corpus, inferred}, NOT NULL, default `'inferred'` |
| `image_status` | ∈ {pending, succeeded, failed_safety, failed_transient, skipped} or NULL, **no default** |
| `progress_snapshot` | `numeric(5,2)` NOT NULL |
| `page_snapshot` | Nullable integer |

There is no uniqueness, so many recaps per book are allowed.
- **Enforced:** `client`; `server:db` (`recaps_memory_jogger_check`, `recaps_concept_watchlist_check`, `recaps_thematic_bridge_check`, `recaps_mode_check`, `recaps_image_status_check`, RLS `Users can manage their own recaps`)
- **Source:** `src/stores/recaps.ts:120-135`; `supabase/reference/live-baseline-2026-10-18.sql`
- **Target:** `generate-recap` inserts the validated row itself, under the caller's verified identity, and returns it (D-06 · BC-07). Clients never insert `recaps` rows. During the transition the legacy client insert keeps working for the PWA (D-05).

#### REC-38 · Abort semantics
If the stream is aborted through its signal before completion, nothing is persisted and the status returns to `idle`.
- **When abort is checked:** before the request, before and after each chunk read, and on `AbortError`. It is **not** re-checked between stream end and insert (REC-D11).
- **Dashboard:** the only caller that passes a signal. Dismissing the modal (header ×, "Done" or Escape) or unmounting the page aborts and discards the result.
- **Book Detail:** passes no signal, so closing the modal there does **not** stop or discard the recap. It is still saved and its image is requested.
- **Hero switch:** does not effectively abort. The `activeBookId` watcher captures the controller that exists when the watcher runs, so a recap started after the last switch is never aborted; the switch only closes the modal.
- ⚠ REC-D10, REC-D11
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:111-117`, `src/services/recapService.ts:57,84-96`, `src/pages/DashboardPage.vue:80-87,111-116,131-139`, `src/pages/BookDetailPage.vue:185-216`
- **Target:** once the paid generation has started, the server finishes and saves whatever the client does. A dismissal or disconnect only stops the client waiting. The client then finds the recap in history and on the next fetch, on every surface and platform (D-06 · BC-07).

#### REC-39 · Post-insert side effects
After a successful insert:
1. Unshift the new recap into `recapsByBook[bookId]`.
2. Fire `requestRecapImage` (errors are only `console.warn`ed).
3. Invalidate `recaps:{uid}:{bookId}` and the prefix `readingQuest:{uid}`.
4. Set status `complete`.
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:137-160`

#### REC-40 · Error handling
- **Inside the `try`** (stream, parse, validation, insert): status `error` and `error = e.message`, or `'Failed to generate recap'` for a non-`Error` throwable; `streamingText` is cleared. For a non-OK HTTP response the message is the JSON `error` field (e.g. "AI output invalid") or `HTTP {status}`; `detail` is discarded.
- **Pre-flight throws** ("Not authenticated" / "Book not found in library") sit **before** the `try`. They reject the caller's promise, and neither caller catches it. Because both callers called `resetStatus()` first, the status stays `idle` and the modal shows the "Generating your recap…" shimmer until dismissed. ⚠ REC-D13
- **Missing session:** "Not authenticated" thrown inside `streamRecap` *is* inside the `try` and surfaces as an error.
- **Concurrency guard:** returns silently (REC-12).
- **Enforced:** `client`
- **Source:** `src/stores/recaps.ts:54,60-63,73,161-165`, `src/services/recapService.ts:54-55,69-76`

### Recap images

#### REC-41 · Image request
After the insert, the client POSTs `{mode: "recap_image", recapId, title, author|null, genre|null, memoryJogger, fromPage, currentPage}`. `fromPage` is the delta start; `textStageDurationMs` is never sent. The server responds **`202 {"status":"accepted"}`** at once and continues in `EdgeRuntime.waitUntil`. If this request fails (network, 4xx, 5xx), nothing ever moves the row off `pending` (REC-D15).
- **Enforced:** `client` (kick-off); `server:edge` (job)
- **Source:** `src/services/recapService.ts:129-159`, `src/stores/recaps.ts:141-151`, `supabase/functions/generate-recap/handlers/recapImage.ts:8-33,48-55`
- **Target:** the server starts the image job itself right after persisting the row (BC-07), so a client failure can no longer strand it; job robustness is BC-13, recommended (D-06 · BC-07 · BC-13).

#### REC-42 · Image status transitions
The job uses the service-role client, filtered `id = recapId AND user_id = <decoded sub>`.

| Event | Row update |
|---|---|
| Start | `image_status 'pending'`, `image_path null`, `image_generated_at null` |
| Success | Upload, then `image_status 'succeeded'`, `image_path '{userId}/{recapId}.png'`, `image_generated_at now` |
| Failure | `image_status 'failed_safety'` or `'failed_transient'`, `image_path null` |

- **`skipped`:** never written by anyone. Legacy `NULL` rows are mapped to `skipped` client-side.
- **Ownership check:** since 2026-10-19 (BC-02) a `recapId` that does not exist or belongs to another user gets `404 {"error":"recap_not_found"}` before any AI call.
- **0-row updates:** silent no-ops. A recap deleted after that check still costs Gemini and OpenAI calls and an upload (REC-D02).
- **No catch:** `handleImageGeneration` has `try/finally` but no `catch`. An upload or update exception, or a runtime kill, leaves the row `pending`, while the function log reports `final_image_status: failed_transient` (REC-D15).
- **Enforced:** `server:edge`; `server:db` (`recaps_image_status_check`)
- **Source:** `supabase/functions/generate-recap/handlers/image.ts:23-35,89-160`, `src/types/index.ts:446-460`
- **Target:**
  - Verify that the recap row exists and belongs to the verified caller before calling any provider (D-06 · BC-02; BC-13, recommended).
  - Handle job errors (catch → `failed_transient`), and move stale `pending` rows to `failed_transient` after a timeout (BC-13, recommended; value REC-Q09).

#### REC-43 · Prompt refinement
| Setting | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| Temperature / tokens | 0.4 / 4096 |
| `thinkingConfig` | None (the `DEFAULT_THINKING_CONFIG` import is unused) |
| Input | Title, author (or "Unknown"), genre (or "Unknown"), and `memoryJogger` **only** |

**Guidelines:**
- keep all proper nouns;
- use cinematography vocabulary, with explicit camera and composition;
- full-frame 1:1 square, no letterbox or borders;
- sensory atmosphere and canonical character looks;
- "the source recap is the source of truth"; minimal invention;
- output the prompt only.

The output is stripped of ```` ```text ```` fences and of a leading "Final prompt:" or "Prompt:". Empty output or any error → a deterministic fallback prompt built from the jogger. `pageRange` is passed and never used.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts:31-89`
- **Note:** recap content therefore reaches **both** Google (refiner) and OpenAI (image).

#### REC-44 · Image generation
OpenAI `POST https://api.openai.com/v1/images/generations` with `{model: "gpt-image-2", prompt, size: "1024x1024", n: 1, quality: "low"}`. The function expects `data[0].b64_json` and decodes it to PNG bytes.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/openaiClient.ts:10-13`, `handlers/image.ts:50-87`

#### REC-45 · Error classification & retries
**Classification of a non-OK response:**
- HTTP 429 or ≥ 500 → transient;
- a message matching `/safety|policy|moderation|content policy|blocked/i` → safety;
- anything else → transient (so a 400 such as "invalid model" is retried).

Missing image bytes count as transient, and thrown network errors are classified the same way.

**Exactly one retry:**
- **Safety:** re-refine with `softer: true` (less graphic, silhouettes, implied action) and retry once → `failed_safety` if still a safety error, else `failed_transient`.
- **Transient:** sleep 2000 ms and retry the same prompt once → `failed_transient` on failure.

There is no manual retry.
- **Enforced:** `server:edge`
- **Source:** `supabase/functions/generate-recap/handlers/image.ts:37-48,66-76,107-133`

#### REC-46 · Storage
| Property | Value |
|---|---|
| Bucket | `recap-images` |
| Visibility | Private |
| `file_size_limit` | 10 MiB live (the migration says 512 KiB — REC-D32) |
| MIME types | png, jpeg, webp |
| Object key | `{userId}/{recapId}.png`, `contentType image/png`, `upsert: true`, written with the service role |
| Storage RLS | Owner SELECT, INSERT and DELETE where the first folder = `auth.uid()`; no UPDATE policy |

Direct SQL deletes from `storage.objects` are blocked by trigger `protect_objects_delete` (`storage.protect_delete()`), so cleanup must go through the Storage API.
- **Enforced:** `server:db` (storage policies `recap-images: owner can select|insert|delete`, trigger `protect_objects_delete`)
- **Source:** `supabase/functions/generate-recap/utils/storage.ts:3-21`; `supabase/reference/live-baseline-2026-10-18.sql`

#### REC-47 · Display URLs
| Surface | Call | TTL |
|---|---|---|
| Recap image panel | `createSignedUrl(path, 60)`, only when the status is `succeeded` | 60 s |
| Book carousel and profile gallery | `createSignedUrls(paths, 3600)` | 1 h |

⚠ REC-D20
- **Enforced:** `client`; `server:db` (owner SELECT policy)
- **Source:** `src/composables/useRecapImage.ts:27-42`, `src/components/book/BookRecapCarousel.vue:36-45`, `src/composables/useRecapGallery.ts:57-69`

#### REC-48 · Live status updates
Each mounted `useRecapImage` panel:
1. re-reads `image_status, image_path` from the row on mount;
2. subscribes to Realtime `postgres_changes UPDATE` on `recaps id=eq.{id}`;
3. polls the row every **2000 ms while the status is `pending`**, with **no timeout or maximum**.

The live `supabase_realtime` publication contains **zero tables**, so the subscription never fires; polling is the only working mechanism. If the status re-read fails (row deleted, RLS), the panel keeps the prop status, so a `pending` prop keeps polling. ⚠ REC-D15, REC-D16
- **Enforced:** `client`
- **Source:** `src/composables/useRecapImage.ts:52-131`
- **Target:** add `recaps` (`image_status`) to the `supabase_realtime` publication, or define bounded refresh-on-foreground (BC-14, recommended; which one is REC-Q09). Stale `pending` becomes `failed_transient` server-side after a timeout (BC-13, recommended).

#### REC-49 · Image UI states
| Status | UI |
|---|---|
| `pending` | Square skeleton, plus "Illustrating this stretch…" in the modal |
| `succeeded` with a URL | The image: `alt=""`, `aria-hidden`, no preview |
| `failed_safety` / `failed_transient` | A non-alarming gradient placeholder, no copy, no retry |
| `skipped` / NULL | No image slot at all |

- **Layout:** 1:1, `object-fit: cover`, capped at `max-width: 360px` and centred.
- **Mint failure:** `succeeded` but the `createSignedUrl` call fails → the slot silently disappears, with no placeholder (REC-D20).
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapImagePanel.vue:20-66`, `src/components/recap/RecapDialog.vue:100-109`

### Display: modal, history, journal framing, carousels

#### REC-50 · Ordering
The per-book list is `select * from recaps where book_id = ? order by created_at desc`, restricted to the owner by RLS. "Latest recap" means index 0 everywhere: the lock, `fromPage`, the modal, and the quiz and resume context. It is **not** ordered by page.
- **Enforced:** `client`; `server:db` (RLS)
- **Source:** `src/stores/recaps.ts:34-40,174-180`

#### REC-51 · Range label
For recap *i*: `from = max(0, previous.pageSnapshot ?? 0) + 1`, where `previous` is the next-older recap (index *i* + 1), and `to = recap.pageSnapshot`. The label is `from ≥ to ? "page {to}" : "pages {from}–{to}"` (en dash). A history card with a null `pageSnapshot` shows `"page —"`; the modal shows no chip. The first-ever recap reads "pages 1–X".
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapHistory.vue:10-21`, `RecapCard.vue:19-25`, `RecapDialog.vue:35-40`
- **Note:** the range is derived from the neighbouring row, not stored. See REC-Q17.

#### REC-52 · Day gap & byline
`days = floor((created_at_i − created_at_prev) / 86 400 000)`: elapsed 24 h periods, independent of time zone. The gap is shown only when ≥ 1, as "1 day later" or "{n} days later".

The byline is `["From your captures" if mode = corpus, day-gap]` joined with `" · "`. Corpus recaps also show a camera icon.
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapDialog.vue:42-52`, `RecapHistory.vue:16-21`, `RecapCard.vue:28-35`

#### REC-53 · History card header
The header is `"{rangeLabel} · {progressSnapshot}%"`. The percentage is the raw number and may show 2 decimals (REC-D31). It is followed by the date `MMM d, yyyy` in device local time (`format(parseISO(iso), 'MMM d, yyyy')`).
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapCard.vue:47-55`, `src/utils/date.ts:30-31`

#### REC-54 · Watchlist chips
Chips are `concept_watchlist.split(',').map(trim).filter(Boolean)`. The "Keep an eye on" section appears only when the list is non-empty.
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapDialog.vue:54-59,122-129`, `RecapCard.vue:37-42`

#### REC-55 · The modal shows the persisted row, never the stream
The modal renders the **persisted row** (`latestRecapForBook`) only when `status === 'complete'`. Streamed tokens are never shown: `streamingText` is accumulated but unused, and both `idle` and `streaming` show the shimmer. If the status is `complete` but no recap for the book is in memory, the body renders nothing and has no footer.
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapDialog.vue:27-33,67-159`

#### REC-70 · Recap modal states & copy
| State | Content |
|---|---|
| Header | "Recap" with a sparkles icon |
| Generating (`idle` or `streaming`) | Spinner, "Generating your recap…", 3 shimmer blocks |
| Error | Red icon, the store's `error` string (or "Something went wrong generating your recap." when it is empty), button "Try Again" |
| Complete | Image-first story layout (top to bottom, below) |

The complete layout runs:
1. image panel (REC-49);
2. range chip (REC-51) and byline (REC-52);
3. `memory_jogger` prose;
4. "Keep an eye on" chips (REC-54);
5. `thematic_bridge` as an open-thread quote;
6. footer "View history ({n})" (closes and navigates to `recap-history`) and "Done" (closes).

- **Retry:** the hero's retry re-runs the capture check and confirm dialog (REC-17). Book Detail's retry (`resetStatus()` + generate) skips the confirm.
- **Closing:** `dismissable-mask=false` — a backdrop tap does not close the modal. The header × and **Escape** do (PrimeVue's `closeOnEscape` default).
- **Error strings:** users see raw server strings such as "AI output invalid", "Unauthorized" or "AI service not configured" (REC-D19).
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapDialog.vue:67-159`, `src/pages/BookDetailPage.vue:211`, `src/pages/DashboardPage.vue:80-109`

#### REC-56 · Book carousel
The carousel shows this book's recaps where `imageStatus === 'succeeded' && imagePath`, taken from the **store copy**, newest first, captioned with the short date. Slides are plain figures (`alt="Recap image"`) and are not tappable. It re-signs URLs only when the set of recap ids changes. The empty-state copy is: "Generate recaps as you read — your moments become images that gather here." It is hidden for DNF books, together with the rest of the section.
- **Enforced:** `client`
- **Source:** `src/pages/BookDetailPage.vue:125-128,304,326`, `src/components/book/BookRecapCarousel.vue:24-77`
- **Note:** the store copy is not patched when an image finishes, so a new image appears only after a refetch (REC-D14).

#### REC-57 · Profile "Recap memories" gallery
**Query:** `recaps(id, book_id, created_at, image_path, books(title))` where `user_id = me`, `image_status = 'succeeded'`, `image_path is not null`, ordered by `created_at desc`, `limit 12`.

**Display:** the title falls back to "Untitled". Items whose signed URL failed are dropped. Tapping an item opens `recap-history` for that book. The empty state is "No memories yet" / "Keep reading and generating recaps — your favorite moments become images that gather here."

**Loading:** once per user per app session (module singleton). A fetch failure still marks it loaded, so the empty state persists for the session. ⚠ REC-D20
- **Enforced:** `client`
- **Source:** `src/composables/useRecapGallery.ts:11-92`, `src/components/profile/RecapImagesCarousel.vue:13-45`
- **Note:**
  - After a book is deleted, the gallery keeps showing that book's images, because the cached 1 h URLs still work and the Storage objects are not deleted. A tap then navigates to the history of a book that no longer exists.
  - New images made during the session do not appear until a reload.
  - The gallery is also specified from the Profile side in [07 · Profile, Stats & Goals](07-profile-stats-goals.md) (PRO-69…PRO-72).

#### REC-69 · Recap History page
The route is `/books/:id/recaps` (name `recap-history`) with the header "Recap History". It lists `RecapCard`s, newest first. Each card uses the journal framing (REC-51…REC-54) and its own image panel.

| State | Content |
|---|---|
| Loading | 3 skeleton cards |
| Error | The message (or "Failed to load recap history") and "Retry" (REC-D28) |
| Empty | "No recap history yet." / "Generate your first recap from the book detail page." |

- **Back:** `router.back()` when there is history, otherwise Book Detail.
- **Entry points:**
  - the modal footer "View history (N)";
  - Book Detail "View Recap History (N)";
  - a profile gallery tap;
  - the Memory Check summary link "Feeling hazy? Read the full recap", shown only when the book has ≥ 1 recap in memory **and** the score is below the question count.
- **DNF books:** the page stays reachable through a direct link or the gallery, even though Book Detail hides the section.
- **Enforced:** `client`
- **Source:** `src/router/index.ts:46-50`, `src/pages/RecapHistoryPage.vue:21-82`, `src/components/recap/RecapHistory.vue:26-32`, `src/components/session/MemoryCheckDialog.vue:48,114-117,215-222`
- **Note:** the page has no "streaming" state.

### Recaps as context for other features

#### REC-58 · Master Recap
The Master Recap is built from the book's recaps:
1. Keep `progressSnapshot > 0` (drops page-0 blurbs) and `(pageSnapshot ?? 0) ≤ currentPage` (the spoiler wall; a null page counts as 0 and is included).
2. Sort by `pageSnapshot ?? 0` ascending. The sort is stable, so ties keep the store's `created_at desc` order.
3. Render each recap as three lines: `Memory jogger: …` / `Concept watchlist: …` / `Thematic bridge: …`.
4. Join them with `\n\n---\n\n`.

The result is an empty string when no recap qualifies.
- **Enforced:** `client`
- **Source:** `src/utils/masterRecap.ts:15-32`; tests `tests/unit/masterRecap.spec.ts`
- **Target:** built server-side as part of Insights orchestration (D-06 · BC-08). Also specified as INS-13 in [06 · Insights](06-insights.md).

#### REC-59 · Insights depend on recaps today
A lore milestone unlock calls `fetchRecapsForBook` and then `buildMasterRecap(history, currentPage)`. **An empty master recap aborts lore generation**, so with no qualifying mid-book recap there is no Insight card. `generate-lore` also rejects an empty `masterRecap`.

The milestone check runs only inside an **online** `updateProgress` that crosses a milestone, and there is no later re-check. A milestone crossed while the book had no qualifying recap is permanently skipped. A save that jumps several 10 % buckets attempts only the latest one, capped at 90. ⚠ REC-D25
- **Enforced:** `client`; `server:edge` (`generate-lore` non-empty check)
- **Source:** `src/stores/loreCards.ts:99-117`, `src/stores/progress.ts:626-632`, `src/utils/milestoneDetect.ts:21-34`, `supabase/functions/generate-lore/index.ts:100-109`
- **Target:**
  - When no qualifying recap exists, Insights are generated from the reader's page captures, or from spoiler-guarded book metadata.
  - Skipped, offline-crossed and failed milestones are backfilled.
  - Milestone detection runs on the server's save, and clients only list and mark seen.
  - (D-12 · BC-08)

#### REC-60 · Name-continuity context
The Memory Check quiz and Session Resume send the **latest** recap's trimmed `memory_jogger` as an optional `recapContext`. The server caps it at 800 characters. There is no page check, so it can be a blurb, or a recap from beyond the current page if progress was moved back (REC-D27).
- **Enforced:** `client`
- **Source:** `src/composables/useBookQuiz.ts:127-133`, `src/composables/usePageResume.ts:28-46`
- **Note:** the consumer rules live in [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md) (CAP-37a, CAP-49, CAP-68). Selection of the context is REC-Q14.

#### REC-61 · Fresh-recap suppression
The session-resume dialog and the session-start quiz prompt are suppressed when `(latestRecap.pageSnapshot ?? 0) ≥ currentPage`.
- **Enforced:** `client`
- **Source:** `src/composables/useSessionResume.ts:39-44`, `src/composables/useBookQuiz.ts:76-80`
- **Note:** this is the same rule as CAP-52 and CAP-64 in [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md).

#### REC-62 · XP & achievement
`get_reading_quest_summary` counts **all** of the user's `recaps` rows (`recaps_generated`, ×20 XP), blurbs included. Deleting a book cascades its recaps and so lowers XP. Achievement `recap_first` ("Storyteller", "Generate your first recap") requires `recapsGenerated ≥ 1`.
- **Enforced:** `server:rpc` (`get_reading_quest_summary`, XP); `client` (achievement evaluation)
- **Source:** `supabase/reference/live-baseline-2026-10-18.sql` (`get_reading_quest_summary`), `src/utils/achievements.ts:97-102`
- **Target:** achievements are evaluated server-side, with a server-authoritative `earned_at` (D-06 · BC-09). The XP formula is PRO-01 in [07 · Profile, Stats & Goals](07-profile-stats-goals.md).

### Lifecycle, cascades & isolation

#### REC-63 · Book delete
`recaps.book_id` and `book_passports.book_id` are `ON DELETE CASCADE`, and so is `user_id → auth.users`. Objects in `recap-images` are **not** deleted: there is no trigger and no function, and SQL cannot delete them (REC-46). Live there are 3 orphans.

On the client:
- `recaps:{uid}:{bookId}` and `bookPassport:{uid}:{bookId}` are invalidated;
- `recapsByBook[bookId]` stays in memory;
- the gallery keeps its items (REC-57).

There is no in-app account deletion today. Deleting the `auth.users` row would leave every `recap-images/{uid}/*` object behind. ⚠ REC-D23
- **Enforced:** `server:db` (`recaps_book_id_fkey`, `book_passports_book_id_fkey`, `recaps_user_id_fkey`); `client` (invalidation)
- **Source:** `src/stores/books.ts:413-434`; `supabase/reference/live-baseline-2026-10-18.sql`
- **Target:**
  - Recap images are deleted through the Storage API (an edge function) when a recap or book is deleted, and an orphan sweep runs (BC-13, recommended).
  - Account deletion is an immediate hard delete through a `delete-account` edge function. It purges `recap-images/{uid}/` and `community-avatars/{uid}/` and then deletes the auth user (FK cascades remove the rows), on web and iOS (D-10 · BC-11).

#### REC-64 · Completion
Get Recap is hidden at ≥ 100 % (REC-02). Existing recaps, history and images remain.

Live trigger `page_captures_delete_on_completion` deletes all of the book's page captures when the book completes:
- it fires `AFTER INSERT OR UPDATE OF current_page ON reading_progress`;
- it calls the SECURITY DEFINER function `delete_page_captures_on_book_completion()`;
- it acts only when `total_pages > 0` and `current_page ≥ total_pages`.

After that, corpus recaps for the book can no longer be reproduced; stored recaps are unaffected. Moving progress back below 100 % does not restore captures. The trigger also fires on the bulk-import upsert of completed books and on `startSession`'s upsert, which re-sends `current_page`.

A capture saved **after** completion is deleted in the same statement by the `page_capture_quest_event_after_save` trigger (`record_page_capture_quest_event()`), while its +5 XP event is still recorded. The passport summary is generated per REC-35.
- **Enforced:** `server:db` (triggers `page_captures_delete_on_completion`, `page_capture_quest_event_after_save`)
- **Source:** `supabase/reference/live-baseline-2026-10-18.sql` (trigger definitions)
- **Target:** completion effects get one server owner on every path (D-06 · BC-05).

#### REC-65 · DNF
On Book Detail the recap section (button, carousel, history link) is hidden, and the book leaves the hero. Recap rows are untouched, and `/books/:id/recaps` stays reachable through a direct link or the gallery. Resuming (`resumeDnf`) writes `reading_progress`, which restarts the 72 h idle clock (REC-07).

DNF confirm copy:

| Element | Copy |
|---|---|
| Header | "Didn't finish?" |
| Message | "Shelve this book as Did Not Finish? Your progress and words are kept, but sessions, recaps and insights are paused until you resume." |
| Buttons | "Shelve it" / "Keep reading" |

- **Enforced:** `client`
- **Source:** `src/pages/BookDetailPage.vue:223-240,304`

#### REC-66 · Edit `total_pages`
Changing `total_pages` re-bases the page threshold immediately: REC-03 multiplies the stored `progress_snapshot` percentage by the new total. The recaps themselves are not recomputed. The progress-map percentage may stay stale until a refetch, so the hero % bar and `unlockPage` can disagree.
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:49-53`, `src/stores/books.ts:376-411`
- **Note:** always derive the percentage from `(current_page, total_pages)` at use time ([11 · Cross-domain](11-cross-domain.md)).

#### REC-67 · Account isolation
RLS `Users can manage their own recaps` (ALL, `auth.uid() = user_id`) and `Users manage own book_passports` (ALL) apply. Clients may update and delete their own rows, though no UI does. Neither policy checks that `book_id` belongs to the caller.

On a user change the SWR cache is cleared, but `recapsByBook`, `generationStatus` and `streamingText` are not reset. The gallery re-fetches because it is keyed by user id.
- **Enforced:** `server:db` (RLS); `client`
- **Source:** `src/stores/auth.ts:86-89`; `supabase/reference/live-baseline-2026-10-18.sql` (policies)
- **Target:** RLS on child tables checks book ownership (BC-01). On any user change, native clients wipe every piece of per-user recap state ([08 · Platform, Auth & Account](08-platform-auth-account.md)).

#### REC-73 · In-flight AI work survives book delete and sign-out
Nothing cancels a running recap stream, image job or passport generation when its book is deleted or the user signs out. Book Detail streams have no abort signal, and an inferred recap can take tens of seconds.
- **After a book delete:** the client `recaps` insert fails with FK 23503 (status `error`). The passport upsert fails silently. The image job still calls OpenAI and uploads an orphaned `recap-images/{uid}/{recapId}.png` (REC-D02). AI cost is incurred in every case.
- **After a sign-out followed by a different sign-in:** the late insert would run under the new session with the old `book_id`. RLS checks only `user_id`, so a cross-user row is possible [UNVERIFIED: reasoned from code; not reproduced]. The same issue is documented for lore as INS-58.
- **Enforced:** none
- **Source:** `src/pages/BookDetailPage.vue:185-189`, `src/stores/recaps.ts:120-135`, `supabase/functions/generate-recap/handlers/image.ts:22-34,143`
- **Target:** the server persists under the verified caller and checks ownership (BC-07 · BC-02). The image job bails out when the row is gone (BC-13, recommended). RLS checks book ownership (BC-01). Clients cancel per-book tasks on delete and all tasks on sign-out.

### Time & clocks

#### REC-68 · Absolute-time arithmetic
All recap time math — cooldown, idle and day gap — is absolute-time arithmetic on ISO timestamps. Only display dates are localised, in the device's zone. The passport stats RPC is the only call in this domain that sends a time zone (`p_time_zone`).
- **Enforced:** `client`
- **Source:** `src/composables/useRecapLock.ts:60-85`, `src/stores/bookPassport.ts:19-37`
- **Target:** day boundaries use the reader's IANA zone, which is stored server-side (D-07 · BC-06). This affects passport stats (REC-68c) and the day-gap label if it becomes calendar-based (REC-Q15).

#### REC-68b · The day gap is not calendar-based
Because the gap is `floor(Δms / 86 400 000)`, two recaps on consecutive calendar days that are less than 24 h apart show no "1 day later", while recaps 47 h apart show "1 day later". Card and carousel dates are device-local `MMM d, yyyy`, so a recap near midnight can show different dates on devices in different zones. Clock skew is covered in REC-05c.
- **Enforced:** `client`
- **Source:** `src/components/recap/RecapDialog.vue:48`, `RecapHistory.vue:20`, `src/utils/date.ts:30-31`

#### REC-68c · Passport stats day boundaries
`get_book_passport_stats` computes:
- **Peak day:** pages per day are bucketed with `(recorded_at AT TIME ZONE p_time_zone)::date`.
- **Total days:** `totalDays = max(1, ceil((last − first recorded_at) / 86400 s))` — elapsed days, not calendar days.
- **Page deltas:** `greatest(0, page − running max of earlier pages)`, clamped to `[0, total_pages]`.
- **Authorization:** `p_user_id = auth.uid()`, checked inside the `authorized_book` CTE. A wrong user gets null `totalDays`, `peakDay` and `peakDayPages` and `vocabularyCount` 0, not an error.

The stored stats are refreshed — and the row rewritten — with the **viewing** device's zone on later views (SES-48).
- **Enforced:** `server:rpc` (`get_book_passport_stats`)
- **Source:** `supabase/reference/live-baseline-2026-10-18.sql` (`get_book_passport_stats`)
- **Target:** stats are frozen at completion (BC-05) and computed in the reader's stored zone (D-07 · BC-06).

---

## Flows

### F1 · Get Recap from the Dashboard hero (today)
1. **Lock evaluated** (REC-03…REC-09). Locked → a disabled button with its label. Unlocked → "Get Recap".
2. **Tap → `handleGetRecap`:**
   - compute `fromPage` (the latest recap's page) and `currentPage`;
   - `await fetchCapturesForBook` (errors swallowed);
   - if no capture lies in `(fromPage, currentPage]` → the "Inferred recap" confirm (REC-17). Cancel ends the flow; "Generate anyway" continues to step 3.
3. **`doGenerateRecap`:** a new `AbortController`; `recapTriggered = true` (the modal opens and the button shows "Recap open", disabled); `resetStatus()`; `generateRecap(bookId, signal)`.
4. **Store:**
   - the guard (REC-12) and pre-flight checks run (a throw here → endless shimmer, REC-D13);
   - `status = streaming`;
   - corpus selection (REC-13…REC-16);
   - `streamRecap` POST.
5. **Server:**
   - Inferred: up to 3 search-grounded Gemini 2.5 Pro calls (tens of seconds, no bytes yet), then the Flash composer stream.
   - Corpus: the composer streams directly.
6. **Client reads the entire body.** The modal shows the shimmer "Generating your recap…".
7. **Parse and validate** (REC-36). Failure → `status = error` → the modal shows the message and "Try Again".
8. **Insert** the `recaps` row with `image_status 'pending'`. An insert failure → `status = error`.
9. **Finish:** unshift the row into the store, fire the image request (F4), invalidate caches, set `status = complete`. The modal renders the persisted row with the image skeleton.
10. **Dismiss** (×, Escape or Done) → `handleDismissRecap`: abort, `recapTriggered = false`, `resetStatus()`.
    - Before step 6 completes → `aborted` → nothing is persisted.
    - After step 6 but before step 8 → **still persisted** (REC-D11).
    - Leaving the Dashboard also aborts. A hero-book change only closes the modal and does not abort (REC-38).

**Persisted:** nothing until step 8 (one `recaps` row). The image columns are updated later by the server job.

**Offline:** `fetch` rejects → `status = error` with the browser's network message. There is no offline queue for recaps.

### F2 · Get Recap from Book Detail (today)
F1 applies, with these differences:
- no abort signal;
- the retry button skips the confirm;
- closing the modal calls `resetStatus()` only, so the request keeps running and **the recap is still inserted and its image requested** when it completes;
- the button re-enables as soon as the modal closes (`recapTriggered = false`), so a second concurrent generation is possible if the lock allows it (REC-12, REC-D10).

### F3 · Server inferred pipeline (deployed v84)
1. Auth (decode only), JSON body, field validation, provider-key checks (REC-21…REC-23).
2. `resolveMode` → `recap` (REC-24); `captures` empty → inferred (REC-25).
3. Attempt 0: extraction at `currentPage` (REC-26).
   - `blockReason` → 500 "Provider safety block" (terminal).
   - Parsed and not `low` → step 5.
4. Attempts 1 and 2: extraction at `max(currentPage − 5n, fromPage + 1)` (REC-29). When exhausted → 500 "No JSON block found in response" or "Low extraction confidence after retries".
5. Composer stream (REC-30). A start failure → 500 "Recap composition failed". A mid-stream failure → a read error after the 200.

Nothing is persisted server-side for text modes.

### F4 · Recap image state machine
```
client insert ─► image_status = 'pending'
   │ client POST mode=recap_image ── network / 4xx / 5xx ──► stays 'pending' forever (console.warn only)
   ▼ 202 accepted; background job (EdgeRuntime.waitUntil)
server UPDATE ─► 'pending' (image_path null, image_generated_at null)
   │ refine prompt (Gemini 2.5 Flash; deterministic fallback on error or empty output)
   ▼ OpenAI gpt-image-2
   ok ─────────────────────────────► upload {uid}/{recapId}.png (upsert) ─► 'succeeded' + image_path + image_generated_at
   safety ─► softer refine ─► retry ─► ok → upload… | safety → 'failed_safety' | other → 'failed_transient'
   transient ─► sleep 2 s ─► retry ─► ok → upload… | any error → 'failed_transient'
   upload / UPDATE throws, or runtime killed ─► row left 'pending' (no catch; finally only logs)
```
**Client side.** Each mounted `RecapImagePanel` re-reads the row, then polls every 2 s while the status is `pending`, without limit. On `succeeded` it mints a 60 s signed URL. The **store copy** of the recap is not updated, so the modal caption and the Book Detail carousel stay stale until the next `fetchRecapsForBook` (REC-D14).

**Timing, from live data** (`image_generated_at − created_at`, n = 70 succeeded):

| Statistic | Value |
|---|---|
| p50 | ≈ 42 s |
| p90 | ≈ 57 s |
| Minimum | ≈ 28 s |
| Outlier | ≈ 65 min |

These figures include the client's kick-off latency, so size a poll cap against them.

**Target.** The server starts the job after persisting the row (BC-07). The job catches errors and writes `failed_transient`. A sweeper moves stale `pending` rows to `failed_transient` (BC-13, recommended). Clients learn the status through Realtime or a bounded refresh (BC-14, recommended).

### F5 · Generation status machine (web store, global)
`idle` →(generateRecap)→ `streaming` →(abort)→ `idle`; →(parse and insert ok)→ `complete`; →(any error in the `try`)→ `error`. `resetStatus()` returns any state to `idle`. A single status is shared by every book and both entry points (REC-D12).

Exceptions:
- a call while `streaming` returns without changing anything;
- pre-flight throws leave the status at `idle`, which shows the shimmer indefinitely;
- an aborted earlier run that resolves after a new run started sets `idle` over the new run's `streaming`, which re-opens the guard.

### F6 · Passport summary (today)
1. An online `updateProgress` crosses 100 % → `fetchPassport` (no catch).
2. No row → `generatePassport`: `generating[bookId] = true`.
3. Stats RPC.
4. POST `passport_summary`.
5. The stream goes into `streamingText[bookId]`. The passport page renders it live under "Crafting your reading journey…".
6. Upsert the row, then `generating = false`.

Any failure stores nothing. The passport page then shows "Your passport is being generated." / "Check back in a moment." **permanently**, because the page never triggers generation. Offline completions, imports, "Already finished" adds and `total_pages` edits never reach step 1 (REC-D22).

**Target (BC-05).** The server's completion event enqueues the job. The job computes and freezes the stats in the reader's zone, generates the summary with retries, and writes the row. Clients only read it.

### F7 · Lock lifecycle (example)
1. 10:00 — the reader saves page 120. The cooldown runs until 16:00 ("Recap in 6 hours"; the label refreshes only on re-render).
2. From 16:00 — unlocked if the page is ≥ `unlockPage`.
3. 17:00 — the reader generates a recap. Get Recap is now locked by pages until +5 % **and** by cooldown until 23:00.
4. The reader is away 3+ days with no progress-row writes, and the last recap is ≥ 6 h old → idle-unlocked regardless of pages.
5. Starting a session (an `updated_at` write) during the absence resets the 72 h clock.

### F8 · Target flow (D-06 · BC-07; detailed contract in [backend-consolidation-plan](../backend-consolidation-plan.md))
1. **Client →** `generate-recap` with the book id and an idempotency key. The request needs no captures, page or percentage.
2. **Server: identity.** Verify the JWT (BC-02) and run the shared entitlement and AI-usage check, which allows everything until tiers are decided (BC-12, D-14).
3. **Server: state.** Load the caller's book, progress, recaps, newest history row and captures. Evaluate eligibility (REC-03…REC-08) on the server clock. Locked → a structured refusal (no AI call).
4. **Server: mode.** Select `fromPage`, the corpus window and the mode (REC-Q02).
5. **Server: generate.** Inferred: extraction with `_internal_audit` stripped before composing (REC-D09). Corpus: compose directly.
6. **Server: persist.** Validate the output and insert the `recaps` row (`image_status 'pending'`). Start the image job (BC-13).
7. **Server → client:** the persisted row. The wire format is REC-Q11.
8. **Disconnect or background:** once the paid call has started, the server finishes and saves. The client recovers the row from history on its next fetch.
9. **Transition:** the legacy client-insert flow (F1/F2) keeps working for the PWA until it migrates (D-05).

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| `RECAP_PAGE_THRESHOLD_PERCENT` | 5 | % of the book beyond the last recap's `progress_snapshot` | `src/composables/useRecapLock.ts:6` |
| `RECAP_COOLDOWN_HOURS` | 6 | Hours after the last recap or the last page save | `src/composables/useRecapLock.ts:7` |
| `RECAP_IDLE_UNLOCK_HOURS` | 72 | Hours since `reading_progress.updated_at` that override the locks | `src/composables/useRecapLock.ts:8` |
| `DISABLE_RECAP_LOCK` | false | Test-only override | `src/composables/useRecapLock.ts:12` |
| `unlockPage` floor | 1 | Page 0 is always page-locked | `src/composables/useRecapLock.ts:52` |
| `unlockPage` when the book is not in the store | 0 | Page lock off | `src/composables/useRecapLock.ts:49-50` |
| `MAX_RECAP_CAPTURES` | 3 | Captures sent in corpus mode (highest pages) | `src/stores/recaps.ts:16` |
| Corpus minimum | ≥ 1 capture and `currentPage > fromPage` | Corpus trigger | `src/stores/recaps.ts:91` |
| Recaps SWR TTL | 60 000 ms | Per-book history freshness | `src/stores/recaps.ts:18` |
| `MAX_ATTEMPTS` | 2 | Extraction retries (max 3 calls) | `supabase/functions/generate-recap/extraction/retryPolicy.ts:4` |
| `PAGE_BUFFER` | 5 | Pages subtracted per retry | `supabase/functions/generate-recap/extraction/retryPolicy.ts:5` |
| `TEMPERATURE` (retryPolicy) | 0.3 (**unused**) | Documented extractor temperature; the real value is 0.0 | `supabase/functions/generate-recap/extraction/retryPolicy.ts:6` |
| Extraction | `gemini-2.5-pro`, temp 0.0, 8192 tokens, Google Search tool | Inferred extraction | `supabase/functions/generate-recap/extraction/runExtraction.ts:44-60` |
| No-map fallback | `round(percentage × 0.8)` % | Extraction stop point | `supabase/functions/generate-recap/extraction/runExtraction.ts:37` |
| Safety buffer (prompt) | 15–20 % | Extraction undershoot | `supabase/functions/generate-recap/prompts/extraction.ts:22` |
| Composer | `gemini-2.5-flash`, 0.7, 4096, `thinkingBudget 0` | Recap and corpus | `supabase/functions/generate-recap/handlers/recap.ts:120-128,219-227` |
| Recap output limits (prompt only) | Jogger 2–4 sentences, ≤ 90 words; watchlist ≤ 5; bridge 1–2 sentences | Output shape | `supabase/functions/generate-recap/prompts/recap.ts:25-44` |
| Blurb | Flash, 0.7, 4096; jogger ≤ 600 chars; watchlist ≤ 13 | Page-0 output | `supabase/functions/generate-recap/handlers/blurb.ts:10-18`, `prompts/blurb.ts:13-15` |
| Passport summary | Flash, 0.8, 4096; 90–100 words, plain text | Passport | `supabase/functions/generate-recap/handlers/passport.ts:10-18`, `prompts/passport.ts:11` |
| Image refiner | Flash, 0.4, 4096 (no thinking config) | Image prompt | `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts:74-81` |
| Image model | `gpt-image-2`, 1024×1024, quality `low`, n = 1 | Recap image | `supabase/functions/generate-recap/openaiClient.ts:12`, `handlers/image.ts:58-64` |
| Image retries | 1 (transient after 2000 ms, or safety with a softer prompt) | Image pipeline | `supabase/functions/generate-recap/handlers/image.ts:107-133` |
| Function log preview cap | 500 chars | Stage-failure logs | `supabase/functions/generate-recap/utils/logging.ts:3` |
| Panel signed URL TTL | 60 s | Per image | `src/composables/useRecapImage.ts:35` |
| Carousel and gallery signed URL TTL | 3600 s | Batch | `src/components/book/BookRecapCarousel.vue:40`, `src/composables/useRecapGallery.ts:12` |
| Pending poll interval | 2000 ms, no maximum | Image status | `src/composables/useRecapImage.ts:63-71` |
| Image readiness (live data) | p50 ≈ 42 s, p90 ≈ 57 s after insert | Sizing a poll cap | live `recaps` aggregate, 2026-10-18 |
| Image panel | max-width 360 px, 1:1 | Layout | `src/components/recap/RecapImagePanel.vue:58-66` |
| `GALLERY_LIMIT` | 12 | Profile gallery size | `src/composables/useRecapGallery.ts:11` |
| Day length | 86 400 000 ms | Day-gap floor | `src/components/recap/RecapDialog.vue:48`, `RecapHistory.vue:20` |
| XP per recap | 20 | Quest XP | RPC `get_reading_quest_summary` |
| Achievement `recap_first` | ≥ 1 recap | "Storyteller" | `src/utils/achievements.ts:97-102` |
| `recap-images` size limit | 10 MiB live (512 KiB in the migration) | Storage | live `storage.buckets`; `supabase/migrations/20260503_recap_image_columns.sql:34` |
| `recapContext` server cap | 800 chars | Quiz and resume input | `supabase/functions/generate-page-resume/index.ts:121-122`; `generate-book-quiz` |
| Insight milestone buckets | Every 10 %; latest crossed only; max 90 | The Insight gate needs a master recap | `src/utils/milestoneDetect.ts:21-34` |

---

## Data touchpoints

| Object | Read / write | By whom | Contract |
|---|---|---|---|
| `recaps` (text row) | INSERT with `image_status 'pending'` | Client today; `generate-recap` under BC-07 | [backend-contract](../backend-contract.md) §3 Tables |
| `recaps` image columns | UPDATE `image_status`, `image_path`, `image_generated_at` | `generate-recap` `recap_image` job (service role) | §3, §10 Edge functions |
| `recaps` | SELECT per book (history), per row (image status), gallery (12 newest succeeded + `books(title)`) | Client | §3 |
| `recaps` count | Read | RPC `get_reading_quest_summary` (XP ×20) | §8 RPC catalogue |
| `book_passports` | UPSERT `onConflict book_id` including `ai_summary`; stats-only UPDATE | Client today; server job under BC-05 | §3 |
| `page_captures` | SELECT per book, ordered by page | Client (corpus selection); server under BC-07 | §3 |
| `progress_history.recorded_at` | SELECT newest per book | Client (cooldown anchor) | §3 |
| `reading_progress` (`current_page`, `updated_at`, `dnf_at`) | Read | Client (lock, visibility) | §3 |
| `books` (`title`, `author`, `isbn`, `genre`, `total_pages`) | Read | Client → request body | §3 |
| `recap-images/{uid}/{recapId}.png` | Upload (upsert); signed-URL read; no delete today | Edge job writes; client reads | §7 Storage |
| `get_book_passport_stats` | Call | Client, before the passport summary | §8 |
| `generate-recap` | POST (4 modes) | Client | §10 |
| Triggers `reading_progress_updated_at`, `page_captures_delete_on_completion`, `page_capture_quest_event_after_save` | Fire on progress and capture writes | Database | §9 Triggers & internal functions |
| Cascades `recaps_book_id_fkey`, `book_passports_book_id_fkey`, `recaps_user_id_fkey` | Delete | Database | §4 Cascades & lifecycle effects |

---

## Client-side logic & server migration

Every client must implement the rules below today. "Moves to" names the work package that takes the rule server-side per D-06; "stays" means it remains client rendering logic.

| # | Rule(s) | Today | Moves to / stays |
|---|---|---|---|
| 1 | Recap lock: pages, cooldown, idle, final (REC-03…REC-08) | Client only; the server enforces nothing | **Moves → BC-07** (enforcement on the server clock). Clients still render the labels (REC-09): from an eligibility read (REC-Q12) or a local mirror |
| 2 | Cooldown anchor bookkeeping: optimistic `lastPageSavedAt`, device-stamped history, offline saves without history (REC-05…REC-05c) | Client | **Moves → BC-04** (server-clock history, offline replays with their original time) **+ BC-07** |
| 3 | Mode selection: `fromPage`, two-back window, top-3 captures, ≥ 1-capture rule (REC-13…REC-16) | Client | **Moves → BC-07** |
| 4 | Inferred-warning dialog (REC-17) | Client, with a different window | Stays a client dialog, **driven by the server's eligibility and mode answer** (BC-07, REC-Q02/Q12) |
| 5 | Parse and validate the stream; insert the row (REC-36, REC-37) | Client | **Moves → BC-07** |
| 6 | Image kick-off after insert (REC-41) | Client fire-and-forget | **Moves → BC-07** (server kick-off), with job robustness in **BC-13** |
| 7 | Abort / discard on dismiss (REC-38) | Dashboard discards; Book Detail keeps | **Replaced by BC-07** "once paid, finish and save" |
| 8 | Image status follow-up: polling (REC-48) | Client, unbounded | Client with a cap, plus **BC-13** (sweeper) and **BC-14** (Realtime or foreground refresh) |
| 9 | Hide rules: ≥ 100 %, DNF, hero during a session (REC-02) | Client | Stays client UI. The server also rejects DNF and complete books (BC-07, acceptance 07-3) |
| 10 | Journal framing: range label, day gap, byline, header (REC-51…REC-53) | Client | Stays client (REC-Q15, REC-Q17 may simplify it) |
| 11 | Master recap assembly; the Insight gate (REC-58, REC-59) | Client | **Moves → BC-08**, with the captures / metadata fallback (D-12) |
| 12 | `recapContext` selection; fresh-recap suppression (REC-60, REC-61) | Client | Stays client (CAP domain; REC-Q14) |
| 13 | Passport summary trigger, stats, upsert (REC-35) | Client, online crossing only | **Moves → BC-05**, with completion detected by BC-04 |
| 14 | `recap_first` achievement (REC-62) | Client evaluation | **Moves → BC-09** |
| 15 | Storage cleanup on recap, book or account delete (REC-63) | Nobody | **New server work → BC-13, BC-11 (D-10)** |
| 16 | Auth of `generate-recap` (REC-21) | Decode-only | **Server → BC-02** |

---

## Caching & offline

| Item | Behaviour | Source |
|---|---|---|
| SWR `recaps:{uid}:{bookId}` | TTL 60 s. `fresh` → no fetch; `background` → serve and revalidate; `loading` (never fetched or invalidated, `fetchedAt = 0`) → await the fetch. Concurrent calls dedupe via `inflight`. A revalidator is registered for tab-visibility refresh, but visibility refresh only refetches keys that are stale **and** were fetched before. A key invalidated right after an insert is refetched only by the next explicit `fetchRecapsForBook` | `src/stores/recaps.ts:28-48`, `src/composables/useCache.ts:167-180` |
| Invalidations | Recap insert → `recaps:{uid}:{bookId}` + prefix `readingQuest:{uid}`. Book delete → `recaps:{uid}:{bookId}`, `bookPassport:{uid}:{bookId}`. User change → `clearAll()`. **Image status changes invalidate nothing**, so the store copy stays stale until a refetch | `src/stores/recaps.ts:155-158`, `src/stores/books.ts:433-434`, `src/stores/auth.ts:89` |
| `recaps:all:{uid}` | Defined only in the dead `fetchRecapsForAllBooks`; never called, never invalidated | `src/stores/recaps.ts:184-212` |
| Passport `bookPassport:{uid}:{bookId}` | TTL 60 s; `swrTouch` after an upsert or stats refresh | `src/stores/bookPassport.ts:82,85-111,183` |
| Captures | `loadedBookIds`: fetched once per book per app session, no TTL; the local list is mutated on save. The local list is **kept after completion** even though the server purged the captures — harmless today because Get Recap is hidden at 100 % | `src/stores/captures.ts:48-66,106-111` |
| `lastPageSavedAt` | In memory per book; fetched once per app session; set optimistically on save, including offline saves | `src/stores/progress.ts:178-207,529` |
| Gallery | Module singleton, once per user per app session. 1 h signed URLs are reused for the whole session. New images and deleted books are not reflected until a reload | `src/composables/useRecapGallery.ts:22-26,44` |
| Book carousel | Re-signs only when the recap id set changes, so its URLs also expire after 1 h on a long-open page | `src/components/book/BookRecapCarousel.vue:22-28` |
| Streaming content | Never cached | `src/stores/recaps.ts:10-12` |
| Browser storage | None: no `localStorage` or IndexedDB in this domain | — |
| Offline | Recap generation, image requests and passport generation all require the network, and there is no queue. The progress offline queue still sets `lastPageSavedAt` optimistically, which starts the cooldown even offline. Its later flush writes no history row (REC-05b) | — |
| **Target** | BC-07: the server is the source of truth for eligibility and persistence, so clients need no lock inputs beyond what they display. BC-14: Realtime on `recaps` or refresh-on-foreground. BC-04: offline replays write history with their original timestamps | — |

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| REC-D01 | `generate-recap` trusts an unverified, base64-decoded JWT `sub`, and `verify_jwt = false` (REC-21) | Anyone can spend Gemini 2.5 Pro + Search and OpenAI credits. In `recap_image` mode the service-role client updates `recaps` and uploads to `recap-images/{sub}/{recapId}.png` for any chosen `sub` | **BC-02**: `verify_jwt = true` or `auth.getUser`; commit `config.toml` **Fixed 2026-10-19 (BC-02):** v86 runs with `verify_jwt = true` and verifies the caller with `supabase.auth.getUser`; `config.toml` committed. |
| REC-D02 | The `recap_image` job runs the paid pipeline and uploads even when the recap row is missing (deleted book) or belongs to someone else. 0-row updates are silent (REC-42, REC-73) | Wasted cost; orphaned or overwritten objects | **BC-02 + BC-13**: verify row ownership and existence before calling providers; bail out if the row is gone **Partly fixed 2026-10-19 (BC-02):** the job returns 404 `recap_not_found` before any AI call when the recap is missing or not the caller's; a recap deleted mid-job is still not handled (BC-13). |
| REC-D03 | Base64url payload decoded with plain `atob` (REC-21). Mechanism reproduced in Node; not reproduced against a live token | Intermittent spurious `401 Unauthorized` for valid sessions (accented names, `>?~` bytes) | **BC-02** (drop the manual decode) **Fixed 2026-10-19 (BC-02).** |
| REC-D04 | No server-side eligibility or quotas (REC-11) | Unlimited recaps from any client; no basis for entitlements | **BC-07 + BC-12** |
| REC-D05 | The corpus window is two recaps back, while the prompt and the type contract say "since the last recap" (REC-14, REC-31) | With no new captures, the "new" recap re-summarises the previous stretch, is badged "From your captures", and gets the new page range | **BC-07** server selection + **REC-Q02** |
| REC-D06 | The inferred warning checks the one-back window; the mode uses two-back (REC-17) | The reader confirms "may contain spoilers" and then gets a corpus recap | **BC-07** (one server decision drives both) + REC-Q02 |
| REC-D07 | Inferred extraction ignores `from_page`, yet the composer is told "pages X–Y" (REC-26, REC-30) | A story-so-far recap is presented as one stretch; journal framing is misleading | **REC-Q06** (delta extraction or honest labelling) |
| REC-D08 | The retry floor `fromPage + 1` can exceed `currentPage`, and the documented abort branch is unreachable (REC-29) | Same-page or backwards recaps extract content **beyond** the reader's page (spoiler) | Clamp every attempt to `≤ currentPage`; handle `currentPage ≤ fromPage` explicitly (REC-Q03) |
| REC-D09 | `_internal_audit.book_ending_to_avoid` is passed verbatim to the composer (REC-30) | The book's ending sits in the composer's input; only a soft prompt guard | Strip `_internal_audit` server-side before composing (in BC-07 scope) |
| REC-D10 | Inconsistent dismiss semantics. The Dashboard discards a paid result; Book Detail keeps running, re-opens the guard and allows concurrent duplicate generations; a hero switch does not abort because of a stale controller (REC-12, REC-38) | Lost paid results; duplicate recaps; a shared status flips between runs | **BC-07** "once paid, finish and save" + a per-book in-flight guard and idempotency key |
| REC-D11 | Abort is not re-checked between stream end and insert (REC-38) | A dismissal that lands after the last chunk still persists | Moot under BC-07; until then, re-check before insert |
| REC-D12 | One global `generationStatus` for all books (F5) | Book A's stream blocks book B and shows in book B's modal | Per-book status (native: per-task state) |
| REC-D13 | Pre-flight throws sit outside the `try` (REC-40) | Endless "Generating your recap…" shimmer; unhandled rejection | Move the checks inside the `try` / surface the error |
| REC-D14 | The store copy of `image_status` is never patched (REC-56, F4) | "Illustrating this stretch…" persists after the image appears; the Book Detail carousel misses the new image until a refetch | Patch the store when the status flips; BC-14 |
| REC-D15 | Stuck `pending` forever. Causes: client kick-off failure, an upload or update exception (no catch), a runtime kill, a 503 before the job. Polling is unbounded; a 400 is retried as transient; the log says `failed_transient` while the row stays `pending` (REC-41, REC-42, REC-45, REC-48) | Endless skeleton and 2 s polling; no terminal state | **BC-13** (catch → `failed_transient`, stale-pending sweeper) + server kick-off (BC-07) + a client poll cap |
| REC-D16 | Realtime subscription is dead: `supabase_realtime` has 0 tables, yet a channel opens per mounted panel (REC-48) | Misleading code; wasted channels | **BC-14** (publish `recaps`) or remove the subscription |
| REC-D17 | The lock is not time-reactive (REC-10) | "Recap in N hours" never counts down; the button never unlocks while the page is open | Tick `now` periodically (e.g. every 60 s) |
| REC-D18 | Shallow validation. Non-string fields pass; limits are prompt-only; a non-string capture `text` → 500; capture text is uncapped (REC-25, REC-31, REC-36) | `.split(',')` crashes on non-strings; oversized prompts | **BC-07** server-side validation and capture selection |
| REC-D19 | Raw server error strings are shown, and `detail` is discarded. 500s leak `String(err)` (REC-22, REC-40, REC-70) | Users see "AI output invalid" or "Unauthorized"; internal text is exposed | **BC-02** (no internal text) + an error-code → copy map (REC-Q15) **Partly fixed 2026-10-19 (BC-02):** 500s no longer carry internal text; the client still shows raw error strings (REC-Q15). |
| REC-D20 | Signed-URL lifetimes and gallery staleness. 60 s panel URLs; 1 h URLs reused for the session; a failed mint silently removes the slot; the gallery never refreshes in-session, keeps a deleted book's images, and a fetch failure sticks as empty (REC-47, REC-49, REC-57) | Broken images in long-lived views; taps into deleted books | Re-mint on error or expiry; purge by `bookId` on delete; refresh on foreground |
| REC-D21 | N+1 on the history page: each card re-queries its row and mints its own URL | Slow history for long journals | Batch the status read + `createSignedUrls` |
| REC-D22 | Passport summary fragility. Online crossing only; offline, import, "Already finished" and other-device paths never; an AI failure leaves no row, no retry and a permanent "being generated"; partial or empty text is persisted; `fetchPassport` has no catch (REC-35) | Missing or empty passport narratives | **BC-05** (server job) with **BC-04** completion detection |
| REC-D23 | Recap images are orphaned on book delete (3 live) and on any account deletion (REC-63) | Data left behind; GDPR and App Store 5.1.1(v) exposure | **BC-13** (Storage API purge + orphan sweep); **D-10 / BC-11** |
| REC-D24 | Offline saves are invisible to the cooldown anchor, and device clocks are mixed with server clocks (REC-05b, REC-05c) | Cooldown and idle windows differ across devices and drift with clock skew | **BC-04 + BC-07** (server clock; offline replays keep their original time) |
| REC-D25 | An Insight milestone is consumed with no Insight when no qualifying recap exists, and is never retried (REC-59) | Readers who never recap never get Insights, while the hero promises "N pages to your next Insight" | **BC-08** (D-12 fallback + backfill) |
| REC-D26 | A blurb is produced only by accident (idle grant at page 0) and stored as a recap (REC-33) | Unexpected XP, image and `recapContext`; quiz and resume suppressed at page 0 | **REC-Q05** |
| REC-D27 | Progress moved backwards: inverted page ranges in prompts and labels; `recapContext` can carry content beyond the current page (REC-29, REC-60) | Spoiler risk in quiz and resume; confusing journal | REC-Q03 / REC-Q14 |
| REC-D28 | History "Retry" never clears `error`, and a failing retry is an unhandled rejection (REC-69) | The error panel stays even after a successful retry | Reset `error` before retrying; catch |
| REC-D29 | Book Detail `onMounted` awaits `fetchRecapsForBook` with no catch (REC-19) | Passport, lexicon and lore-seen loads are skipped on that visit | Catch each call independently |
| REC-D30 | The inferred path has no client or server timeout; up to 3 Pro calls before the first byte (REC-30b) [UNVERIFIED: gateway limit behaviour] | A possible gateway 5xx instead of a JSON error; paid work lost | **BC-07** background semantics; a generous client timeout (≥ 120 s) until then |
| REC-D31 | `progress_snapshot` is shown raw (e.g. "37.45%") on history cards (REC-53) | Cosmetic | REC-Q15 (round for display) |
| REC-D32 | Drift and dead code (see the list below) | Misleading code; deploy footguns | **BC-03** (sync repo ↔ deployed; baseline migration) + **BC-02** (`config.toml`) + dead-code removal **Partly fixed 2026-10-19 (BC-02):** `supabase/config.toml` is committed; the other items remain. |

REC-D32 covers:

- **Unused code in `generate-recap`:** `TEMPERATURE 0.3`, `VALID_CONFIDENCE`, `pageRange`, `mintSignedUrl`, and the refiner's `DEFAULT_THINKING_CONFIG` import. `textStageDurationMs` is never sent.
- **Misplaced config:** `dynamicRetrievalConfig` sits at the top level of `config` (effect UNVERIFIED).
- **Prompt drift:** repo prompts use Unicode dashes where deployed v84 uses ASCII.
- **Deploy footguns:** no `supabase/config.toml`, so a fresh deploy flips `verify_jwt`; `npm:@google/genai` is unpinned.
- **Migration drift:** the bucket limit is 512 KiB in the migration vs 10 MiB live; spec 021 says `image_status` defaults to `'pending'`, but live has no default; the base `recaps` table is absent from the local migrations.
- **Dead client code:** `CompletedRecapImageCarousel.vue`, `CompletedRecapImageSlide.vue`, `fetchRecapsForAllBooks` with its `recaps:all` key, `streamingText`, and `RecapHistory`'s `bookTitle` prop.
- **Stale comments:**
  - `src/stores/captures.ts:14-15` ("≥30% coverage");
  - `useRecapLock.ts:18` ("does NOT trigger any fetches");
  - `auth.ts:2` (refers to a `config.toml` that does not exist);
  - `prompts/extraction.ts:4-7` (`_timeline_reasoning`).

---

## Open decisions

D-01…D-17 have resolved these former questions; they appear as Target lines instead and are not repeated here: dismiss semantics, who persists the row, server enforcement, the clock source, offline-save history, missed Insights, account-deletion purge, quota enforcement, and storage cleanup on delete.

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| REC-Q01 | Should a **page save** start the 6 h cooldown ("recaps are for coming back"), or should the cooldown anchor only on the last recap? | Every page save, including pencil edits and offline saves, locks Get Recap for 6 h (REC-04) | Keep Option B, the documented intent, but compute it server-side from `progress_history` (BC-07). Revisit after usage data |
| REC-Q02 | Corpus window: the current delta `(fromPage, currentPage]` (the edge contract and the prompt) or two recaps back? Should the warning and the mode use the same rule? | Mode uses two-back; warning uses one-back; no coverage threshold (REC-14, REC-16, REC-17) | Decide corpus vs inferred on the **delta** window; optionally pass previous-stretch captures as labelled "earlier context"; one server decision drives both the warning and `mode` (BC-07) |
| REC-Q03 | Same-page and backwards recaps (`currentPage ≤ fromPage`): refuse, clamp, or a "where you left off" recap? Should the idle grant allow repeated same-page recaps every 6 h? | Allowed through the idle re-grant every 6 h; always inferred; retries look past the reader (REC-06, REC-29) | Refuse unless idle-granted. When idle-granted, allow **one** "where you left off" recap per idle period, never extracting beyond `currentPage` |
| REC-Q04 | Idle anchor: any `reading_progress` write (today), or the last page save or session? | Session start, pause, cancel and DNF resume reset the 72 h clock (REC-07) | Anchor on the newest `progress_history` row (a real reading event), so opening a session does not cancel "welcome back" |
| REC-Q05 | Pre-start blurb: a real feature with its own UX, excluded from history, XP and images, or removed? | Reachable only by accident at page 0; stored as a recap with XP and an image (REC-33) | Either add an explicit "Before you start" action that is not stored as a recap (no XP, no image), or remove the page-0 path; the server refuses page 0 in the recap mode |
| REC-Q06 | Inferred-recap scope: delta-only (spec 004) or story-so-far (today)? | Story-so-far labelled as a page range (REC-26) | Make the extraction delta-aware (pass `from_page`); if quality suffers, label inferred recaps "Story so far · up to page N" |
| REC-Q07 | Completed books: allow a final recap at 100 %? Should Book Detail hide Get Recap during an active session like the hero does? | Hidden at ≥ 100 %; Book Detail shows it during sessions (REC-02) | No recap at 100 % (the passport covers the full arc); hide during an active session on every surface |
| REC-Q08 | Recap management: may readers delete or regenerate a recap? | RLS allows update and delete; no UI | No regenerate in v1. If deletion is added, it must purge the image (BC-13) and lowers XP (REC-62) |
| REC-Q09 | Image robustness. Stale-`pending` timeout value? Manual "retry image"? Show failed states? Realtime publication vs bounded refresh-on-foreground (BC-14)? | Polls forever; failures show a silent placeholder; no retry (REC-48, REC-49) | Sweeper after 10 min → `failed_transient`; client poll cap 3 min, then a placeholder and a re-check on next appearance; no manual retry in v1; refresh on foreground + bounded polling (Realtime optional) |
| REC-Q10 | Image provider and cost: confirm OpenAI `gpt-image-2` at quality `low` (spec 021 named a Gemini model). Should blurbs get images? | gpt-image-2 low for every recap, including blurbs | Keep. Record every image call in `ai_usage` (BC-12) to inform D-14 tiers; no images for blurbs (follows REC-Q05) |
| REC-Q11 | Wire format of the BC-07 response: keep the raw text stream, return the persisted row as JSON, or NDJSON progress events plus a final row? | Raw `text/plain` stream of model JSON text; no client renders tokens (REC-55, REC-71) | NDJSON, as proposed in BC-07 (OP-07.8): stage events, a heartbeat at least every 15 s so long inferred runs are not cut off (REC-30b), and a final `recap` line carrying the persisted row; keep the legacy stream until the PWA migrates (D-05) |
| REC-Q12 | How do clients learn the lock state for labels once the server enforces it? | Each client recomputes the lock (REC-03…REC-09) | Add an eligibility read (e.g. RPC `get_recap_eligibility(p_book_id)` on the server clock) returning `locked`, the reason, pages to unlock, `unlock_at` and the would-be mode. Clients render and tick locally |
| REC-Q13 | Keep Google Search grounding on Gemini 2.5 Pro for inferred extraction? | Pro + Search, up to 3 calls per inferred recap | Keep for now. Measure cost through `ai_usage` (BC-12); get a legal read on grounding display terms; consider Flash + Search if cost dominates |
| REC-Q14 | `recapContext` for quiz and resume: the newest recap, or the newest at or below the current page (excluding blurbs)? | Newest, with no page check (REC-60) | Newest with `page_snapshot ≤ currentPage` and `progress_snapshot > 0` (spoiler-safe); align with CAP |
| REC-Q15 | Display. Round `progress_snapshot` on cards? Error-specific copy (safety block vs low confidence vs locked)? A calendar-day gap in the reader's zone (D-07) instead of elapsed 24 h? | Raw 2-decimal %, raw server strings, elapsed-24 h gap (REC-52, REC-53, REC-70) | Integer %; map error codes to friendly copy; calendar days in the reader's zone |
| REC-Q16 | When a book's title or author is edited, should the passport summary (and recaps) be regenerated or flagged? | Left frozen | Leave frozen; no regeneration in v1 |
| REC-Q17 | Under BC-07, persist the range start (`from_page`) and source metadata (captures used) on the `recaps` row? | The range is derived from the next-older row (REC-51) | Yes, as additive nullable columns (backward compatible, D-05); clients prefer stored values |

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)
- **Build against the decided target.** If BC-02 and BC-07 land before the native build, the native client calls the server-owned recap flow (F8). It does not port the lock, mode selection, parsing or insertion. Until then, replicate REC-03…REC-41 exactly, and keep both clients on the same rules (D-05).
- **Auth.** Send `Authorization: Bearer <access token>`, refreshed when near expiry, plus the `apikey` header. Since BC-02 (2026-10-19) the token is verified server-side. Refresh once and retry on a `401` before treating the user as signed out.
- **Streaming (legacy contract, REC-71).** Accumulate the whole body. Do not render tokens, because they are JSON text. Show a "Generating your recap…" state. Use a generous timeout (≥ 120 s) for the inferred path. Map a gateway 5xx or timeout to the same retryable error as "AI output invalid".
- **Parsing parity (REC-36).** Trim → fenced block → first `{` … last `}` → decode three **non-empty strings**. Reject other types. Native clients may read `X-Recap-Mode`, but should not trust it for `mode` until REC-Q02 is settled.
- **Persistence (legacy, REC-37).** Insert exactly `book_id, user_id, progress_snapshot (2 dp), page_snapshot, memory_jogger, concept_watchlist, thematic_bridge, mode, image_status 'pending'`. Never write the `image_*` columns afterwards. Retry the `recap_image` kick-off once on a network failure.
- **Cancel = keep (BC-07).** Once the request is sent, dismissing or backgrounding must not discard the result. Re-fetch history on return. Until BC-07 ships, finish the request in the background and persist.
- **Image follow-up.** Poll `image_status, image_path` every 2 s **with a cap**: about 3 min, sized from p50 ≈ 42 s / p90 ≈ 57 s. Then show the placeholder and re-check on the next appearance. Update the local model when the status flips. Adopt Realtime only once `recaps` is published (BC-14).
- **Images.** Mint signed URLs in batch. Download once and cache bytes on disk keyed by `recapId` (images are immutable per recap). Re-mint on 400/403. Never hold 60 s URLs in long-lived views.
- **Lock (until BC-07).** Port it as a pure function `evaluate(totalPages, currentPage, progressUpdatedAt, latestRecap{progressSnapshot, createdAt}, lastPageSavedAt, now)`, with unit tests mirroring `tests/unit/recapLockIdleUnlock.spec.ts` and skewed-clock cases. Drive `now` from a periodic timer so the label counts down (REC-D17). Refresh the inputs on foreground.
- **Hide rules.** No Get Recap at ≥ 100 %, for DNF, or in the hero during an active session (REC-02, REC-Q07).
- **Journal framing and master recap.** Implement REC-51…REC-54 byte-for-byte: en dash, "page —", the " · " join, `split(',')`. If BC-08 has not shipped, implement REC-58 byte-for-byte too: the labels and the `\n\n---\n\n` separator.
- **Per-user and per-book hygiene.** On a user change, wipe every recap cache, image cache and in-flight task (REC-67). On book delete, purge that book's recaps, gallery items and image cache, and cancel its tasks (REC-63, REC-73). On completion, purge the book's local captures (REC-64).
- **Entitlements.** Do not hard-code any "recaps per month" tier. Gating is server-side (BC-12) and the tiers are undecided (D-14).
- **AI disclosure.** Inferred recaps send title, author, ISBN and page position to Google Gemini with Search grounding. Corpus recaps send captured page text to Gemini. Image prompts derived from `memory_jogger` go to Gemini (refiner) **and** OpenAI. Disclose this, and obtain consent before the first recap.

### iOS-specific (iOS 26+, iPhone first — D-04)
- **Networking:** `URLSession.bytes(for:)` for the legacy stream and for the BC-07 line-delimited response (REC-Q11). supabase-swift's `functions.invoke` buffers the whole body, so it shows no progress. Use structured concurrency (`Task`). Under BC-07, dismissal does not cancel the request; wrap long requests in `beginBackgroundTask` so they can complete.
- **Sheet:** present `RecapDialog` as a `.sheet` with `.presentationDetents([.large])`. On iOS 26 system sheets adopt Liquid Glass. Build custom floating controls (Get Recap, lock pill, watchlist chips) with `.glassEffect`, grouped in `GlassEffectContainer`. Respect Reduce Transparency and Increase Contrast. There is no pre-iOS-26 fallback (D-04).
- **Story layout:** a square image (`aspectRatio(1, contentMode: .fill)`, `.clipped()`), the byline `Label("From your captures", systemImage: "camera")` · "N days later", prose with Dynamic Type, chips in a flow layout, and an open-thread quote. Toolbar: "View history (N)" and "Done".
- **History and galleries:** history is a pushed `List` or `LazyVStack`, newest first. The gallery and the book carousel use `ScrollView(.horizontal)` with `.scrollTargetBehavior(.paging)`. A gallery tap pushes that book's history.
- **Accessibility:** images are decorative (`.accessibilityHidden(true)`). The lock button's VoiceOver label includes the reason ("Locked, 12 more pages"). Pluralise via the String Catalog: "%lld more pages", "Recap in %lld hours".
- **Haptics:** `.sensoryFeedback(.success, trigger:)` when a recap completes.
- **Corpus input quality:** captures are recognised on-device with Apple Vision first, falling back to `ocr-page` (D-15). Corpus recaps consume `page_captures.text` whatever OCR engine produced it, so OCR quality directly bounds corpus-recap quality ([04 · Capture, Resume & Quiz](04-capture-resume-quiz.md)).
- **App Store:**
  - Guideline 5.1.2(i): third-party AI disclosure and consent before the first recap or capture. List Google (including Search grounding) and OpenAI in the App Privacy details.
  - Guideline 5.1.1(v): in-app account deletion through the `delete-account` edge function, which purges `recap-images/{uid}/` (D-10).
  - Guideline 1.2: if recap images ever become shareable (`ShareLink`), add a "Report image" affordance and label spoilers.
  - BC-02 closed the forgeable-auth hole (REC-D01) on 2026-10-19.
