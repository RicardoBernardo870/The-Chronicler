# Troubleshooting

Last updated: 2026-10-18

Real failure modes found in the 2026-10-18 audit (web `master` @ `8d8701c` + the live project). Each entry gives the symptom, the cause and what to do. Where the cause is a known defect, the catalog ID and the work package that fixes it are linked; the [business-rules catalog](../business-rules/README.md) has the full rule.

Quick tools: browser DevTools (Console, Network, Application → Service workers / IndexedDB / Local storage), `window.__bookheroCache` in dev builds, Supabase function logs, the Supabase security and performance advisors, read-only SQL in the SQL editor.

---

## Startup & auth

### Blank page on startup

- **Cause:** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing at build time. `src/services/supabase.ts` throws before mount: "Missing Supabase environment variables. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
- **Fix:** set both in `.env.local` (local) or the Vercel project (production), then restart `pnpm dev` or rebuild. `VITE_*` values are compiled in; a running build never picks up a change.

### "Loading..." splash never goes away

- **Cause:** `authStore.initialize()` has no `catch`. If `supabase.auth.getSession()` rejects (rare), the rejected promise stays cached, the guard's await throws and `App.vue` never clears the splash (PLT-D16).
- **Fix:** reload the page. If it repeats, check the Console for the rejection and the stored `sb-<project-ref>-auth-token`; clearing site data forces a fresh sign-in.

### Slow cold start offline (~3 s), then empty sections

- **Expected:** `getSession()` is raced against 3 s; on timeout the last user snapshot (`bookhero-auth-user`) is trusted (PLT-10). Data is not cached offline, so sections render empty and the Dashboard shows "Some things didn't load".
- **Note:** offline, table reads (GET) spend about 7 s in postgrest-js' built-in 1 s + 2 s + 4 s retry before failing, while RPC reads (POST) fail at once, so some skeletons last longer than others (PLT-34).

### Redirected to the dashboard instead of the link I opened

- **Cause:** the guard sends signed-out users to `/login` without a `redirect` query, and sign-in always pushes `/` (PLT-05, PLT-D18).
- **Fix:** none today; open the link again after signing in.

### Magic link: no way to resend, or the link opens the web app

- **Cause:** after "Send magic link" the form stays hidden until reload (PLT-D17). No client passes `emailRedirectTo`, so every link lands on the Supabase Site URL (PLT-82). The default Supabase email sender has a very low hourly limit.
- **Fix:** reload `/login` to resend or change the email. If emails do not arrive, check Auth logs for rate limiting and configure custom SMTP (BC-11).

### Signed out unexpectedly on every device

- **Cause:** sign-out uses the supabase-js default scope `global`, so signing out anywhere revokes every session of that user (PLT-14). Other open tabs receive the broadcast too.
- **Fix:** expected today; scope is open decision PLT-Q01.

### "Sign out" does nothing

- **Cause:** offline (or any network failure), `signOut()` rejects; the handler has no catch, so there is no message and the reader stays signed in (PLT-D14). A server 401/403/404 is *not* a failure: the local session is removed anyway.
- **Fix:** sign out again when online.

### The bottom nav disappeared but the page is still there

- **Cause:** the session ended (refresh-token failure, or a global sign-out from another device). `user` became null, so the nav is hidden, but there is no reactive redirect until the next navigation (PLT-D15).
- **Fix:** navigate or reload; you land on `/login`.

### Another account's data flashes after switching users

- **Cause:** sign-out clears only the Supabase session, the user snapshot and SWR metadata. Pinia stores, module singletons, the offline queue and in-flight AI jobs survive (PLT-15, PLT-D12, PLT-D13). Achievement dates can persist into the next account; queued offline saves replay under the next user.
- **Fix:** reload after switching accounts on a shared browser; before switching, make sure the "Progress will sync" badge is gone.

---

## Data loading & stale data

### "Some things didn't load — Reopen the app or refresh the page to try again."

- **Cause:** a PostgREST request still got 401 after the single 400 ms retry in `retryingFetch` (the cold-start `PGRST303` token race), or the Dashboard's ordered load threw (PLT-33, PLT-35, PLT-36). Shown at most once per 30 s.
- **Fix:** reload. If it persists, check the Network tab for 401s on `/rest/v1/` (expired or revoked session → sign in again) and the Console for the failing store.

### A section shows a skeleton again right after I changed something

- **Cause:** `invalidate()` sets `fetchedAt = 0`, which makes the next access a **blocking** `'loading'` fetch rather than a background refresh (PLT-28).
- **Fix:** expected today (PLT-D20).

### Burst of requests when returning to the tab

- **Cause:** on `visibilitychange → visible`, every stale key that ever registered a revalidator refreshes at once; revalidators are never unregistered (PLT-30). It coincides with the token refresh, which is exactly when the 401 race happens.
- **Fix:** expected today (PLT-D20).

### Reading Stats calendar or monthly chart does not show today's reading

- **Cause:** `useReadingCalendar` and `useMonthlyReading` cache each month/year for the whole session and never refetch the current period (PLT-D24).
- **Fix:** reload the page.

### "Finish by" forecast missing for a book

- **Cause:** `velocity:{uid}` has a 365-day TTL and ignores which book ids were requested; a book that starts without a timed session gets no forecast until a session ends or the page reloads. Visiting the Dashboard first can replace the Library's forecasts (PLT-D21). A `total_pages` edit also leaves the old forecast.
- **Fix:** reload, or end a timed session.

### New recap missing from all-books views; deleted book still shows Insights or gallery images

- **Cause:** `recaps:all:{uid}` is not invalidated by `generateRecap` (PLT-D22); `removeBook` does not invalidate `lore:*` or the recap gallery, and Storage images are never deleted (BC-13).
- **Fix:** wait for the TTL / refocus, or reload.

### Counts differ between screens around midnight or New Year

- **Cause:** `get_reading_stats` (streaks, this week/month), `get_reading_quest_summary` (year) and `get_reading_velocity` compute in **UTC**; calendar, records, monthly and passport stats use the device zone; Word of the Day and `dueTodayCount` use the UTC date while the review tally uses the local date (PLT-D30).
- **Fix:** expected today; D-07 · BC-06 moves every boundary to the reader's IANA zone.

### Book Passport "peak day" is one day early

- **Cause:** `peakDay` (`YYYY-MM-DD`) is parsed with `new Date()` as UTC midnight, so it shows the previous day west of UTC (PLT-D31).

### Library re-sorts when I start or pause a session; a finished book moves to another year

- **Cause:** trigger `reading_progress_updated_at` bumps `updated_at` on **every** row update (session start/pause/resume/clear, DNF). The library RPC orders by it and the quest counts completions by its UTC year (PLT-D29).
- **Fix:** expected today; BC-04 adds `reading_progress.completed_at` and a separate last-read time.

### An RPC returns zeros, `[]` or "Not allowed"

- **Cause:** the guarded stats RPCs silently filter on `p_user_id = auth.uid()`, so a mismatched or anonymous caller gets zeros, `[]` or nulls; `get_reading_quest_summary` raises "Not allowed" for a signed-in mismatch ([PLT-77](../business-rules/08-platform-auth-account.md#plt-77--rpc-caller-identity-checks-are-inconsistent)).
- **Fix:** pass the signed-in user's own id. (The opposite problem — four RPCs that return *another* user's data — is the security defect PLT-D01, fixed by BC-01.)

### Request cancelled with SQLSTATE `57014`

- **Cause:** statement timeout: 8 s for `authenticated`, 3 s for `anon`. Stats and quest RPCs scan the caller's whole `progress_history` (PLT-86).
- **Fix:** retry once; investigate the query plan and the unindexed FKs reported by the performance advisor.

### Table read returns at most 1000 rows

- **Cause:** un-paginated `select`s (`books.select('*')`, the lexicon dedupe read) are capped by PostgREST `max_rows` (Supabase default 1000; project value unverified). RPCs are not capped.

---

## Writes & RLS

### Insert or update fails with an RLS error (`42501` / "new row violates row-level security policy")

- **Causes:** not signed in; the row's `user_id` is not the caller; the table has no policy for that command (`reading_dna`, `vocabulary_extractions`, `user_settings`, `community_profile_privacy` have no DELETE policy; circle tables are SELECT-only; `achievements` is insert-only; `reading_quest_events` is read-only).
- **Fix:** supply `user_id` explicitly on every insert; use the owning RPC where writes are RPC-only ([Authentication & Authorization › Row-level security](Authentication-Authorization.md#row-level-security)).

### UPDATE/DELETE rejected without a filter

- **Cause:** `authenticator` preloads `safeupdate`; PostgREST rejects UPDATE/DELETE with no `eq`/`match` filter (PLT-86).

### Save fails with a CHECK-constraint error

- **Cause:** server CHECKs: book title 1–500 chars, author 1–200, ISBN `^\d{9}[\dX]$|^\d{13}$` (no hyphens, uppercase X), `total_pages ≥ 1`, `progress_history.page ≥ 0`, session note ≤ 160, capture text ≥ 1 char. A non-integer page ("12.5") is rejected by the integer column and rolled back. `reading_progress.current_page` has **no** CHECK (clamp it client-side).

### A finished book's captures or Memory Check quiz disappeared

- **Expected:** triggers delete a book's `page_captures` and `book_quizzes` when `current_page >= total_pages > 0`, on any write path (online save, offline replay, import, add-as-completed). A capture saved **after** completion is deleted in the same statement by `record_page_capture_quest_event`, while its +5 XP event is still recorded. Follow-up vocabulary extraction then fails its FK silently.

### Deleting a book removed a reading circle

- **Cause:** `reading_circles.book_id` cascades, so deleting a book that anchors a circle deletes the circle and every member's rows (dormant feature, PLT-D43).

---

## Sessions & offline

### "You appear to be offline. Start Session requires a connection."

- **Expected:** Start, Pause and Resume Session refuse to run offline ("…Pause requires a connection.", "…Resume requires a connection."). Sessions are never queued.

### Start Session fails while online

| Message | Cause |
|---|---|
| "This book is already complete." | `startSession` refuses books at 100 % |
| "This book is shelved as Did Not Finish. Resume it first." | DNF books cannot start sessions; use "Start reading again" |
| "Book not found" | The book is not in the loaded library (deleted, or another account's id) |
| "Not authenticated" | No signed-in user in the store |
| Raw Postgres / PostgREST message | The `reading_progress` upsert failed (RLS, CHECK, network). The timer is never optimistic: `session_start_at` is written only after the server confirms |

The start button can also wait on the "Previously" resume backfill or the Memory Check quiz generation (no client timeout on `functions.invoke`).

### The page went backwards after starting a session or shelving a book on another device

- **Cause:** `startSession` and DNF writes upsert the device's **cached** `current_page`; a stale tab (or one with no local row, which sends 0) rewinds the server page without a history row (SES-87).
- **Fix:** reload stale tabs before starting; BC-04's session and DNF RPCs never send `current_page`.

### Offline progress does not sync

Check, in order:

1. **Was it queued at all?** Only saves made while `navigator.onLine === false` are queued. A save that fails while the browser thinks it is online is rolled back with the raw error (PLT-43).
2. **Is a window open?** Background Sync (tag `progress-sync`) is Chromium-only and only posts `FLUSH_PROGRESS_QUEUE` to open windows; iOS Safari has no Background Sync at all. Drains also run on the `online` event and on every progress fetch while online (PLT-47).
3. **Inspect the queue:** DevTools → Application → IndexedDB → `chronicler-offline` → `progress_queue`.
4. **Record for a deleted book?** It fails its FK forever and never leaves the queue (`retries` is never incremented) (PLT-D28). Delete the record manually.
5. **Badge gone but records remain?** `pendingSync` is cleared after any drain attempt, even a failed one, and is not restored on reload (PLT-D26).
6. **Signed in as someone else?** Records carry no user id and replay as whoever is signed in (PLT-D12).

### Offline reading does not appear in stats, streaks or the calendar

- **Cause:** an offline save writes only `reading_progress` on replay: no `progress_history` row, no session end, no capture prompt, no Insight, no passport (PLT-D25).
- **Fix:** expected today. D-08 · BC-04 replays offline saves through `save_progress` with their original time so they count.

### A session is still "running" after I ended it offline

- **Cause:** the offline end never clears `session_start_at` on the server; after reconnect the page syncs but the session stays active (zombie session).
- **Fix:** cancel the session ("Cancel session — no progress saved").

### The app reloaded by itself

- **Cause:** a new deploy activated a new service worker; `main.ts` reloads once on `controllerchange` (PLT-54). Unsaved input in an open sheet or form is lost (PLT-D36).

### Service worker changes don't show up locally

- **Cause:** the SW is disabled under `pnpm dev` (`devOptions.enabled: false`).
- **Fix:** `pnpm build && pnpm preview`; use DevTools → Application → Service workers ("Update on reload" / "Unregister") or clear site data for a clean state.

### Deep link returns 404 on first visit

- **Cause:** `vercel.json` has no SPA rewrite; without an active service worker, `/library` or `/books/:id` hits Vercel directly (PLT-D35). With the SW active, the navigation fallback serves `index.html`.
- **Fix:** add a rewrite to `/index.html` ([Deployment](Deployment.md#frontend-hosting-vercel)).

### Covers missing offline; manifest shortcuts or standalone mode ignored

- **Cause:** the `book-covers` CacheFirst route stores nothing (opaque `no-cors` responses are not cacheable without `CacheableResponsePlugin`), and Google cover thumbnails are not routed (PLT-D33). The manifest is not linked from `index.html`, so shortcuts, `display` and `orientation` are ignored (PLT-D34).

---

## Edge functions & AI

### Edge function returns `401`

| Function | Likely cause |
|---|---|
| any | No session: raw-fetch callers throw `'Not authenticated'` before calling; the anon key as bearer is rejected (no `sub`) |
| `generate-recap`, `ocr-page` | Genuine token whose base64url payload contains `-` or `_` (for example non-ASCII claims): `manualJwtDecode` calls `atob` without normalisation (PLT-D07). Passport generation ends as "AI error: 401" |
| `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume`, `generate-book-quiz` | Gateway rejected an expired or invalid token |

If 401s start right after a redeploy from the repo: without a `config.toml`, `generate-recap`, `generate-lore` and `ocr-page` switch to `verify_jwt = true` (PLT-D11), and the PWA's raw-fetch calls omit `apikey`, so they may be rejected (PLT-D46; the "ES256 compat" reason in `generate-recap/auth.ts` is unverified). Redeploy with `--no-verify-jwt` to restore today's behaviour, or ship BC-02 properly ([Deployment › Edge functions](Deployment.md#edge-functions)).

### Edge function returns `503`, `502` or `504`

| Status / body | Cause | Fix |
|---|---|---|
| 503 `AI service not configured` (`generate-recap`, `generate-lore`), `AiUnavailable` (`ocr-page`) | `GEMINI_API_KEY` missing | `supabase secrets set GEMINI_API_KEY=…` |
| 503 `OpenAI image service not configured` / `Supabase admin client not configured` | `OPENAI_API_KEY` or service-role env missing (recap image mode) | Set the secret; service-role vars are platform-injected |
| 502 `ai_unavailable` (`generate-reading-dna`) | Missing key or unusable model output | Check logs |
| 504 `OcrTimeout` / 502 `OcrUpstream` (`ocr-page`) | 10 s Gemini budget exceeded / single retry failed | Retry; send ≤ 5 MB JPEG or PNG as raw base64 (not a `data:` URL) |
| 500 `AI output invalid` (`generate-recap`) | Low extraction confidence after retries, no JSON block, or composition failed (inferred path) | Retry later or capture pages so the corpus path is used |
| 500 `Internal server error` with `detail` (`generate-recap`) | Includes a malformed JSON body; `detail: String(err)` leaks internals (PLT-D08) | Check the request body; BC-02 removes the leak |

Soft failures return 200: `extract-vocabulary` → `{words: []}`, `generate-page-resume` → `{resume: null}`, `generate-book-quiz` → `{quiz: null}`. A resume that comes back `null` is regenerated on every Start Session click.

### Recap image stays `pending` (skeleton forever)

- **Causes:** the client's `mode: 'recap_image'` request failed (only a `console.warn`); the background job threw on upload or on a `recaps` update (no `catch`); or the edge runtime killed the job. Nothing ever sets a terminal status, there is no sweeper, and the panel polls every 2 s with no cap. The Realtime subscription never fires because the `supabase_realtime` publication has no tables.
- **Check:** `recaps.image_status` / `image_path` for that row; function logs for `recap_image`. Successful images normally land 30–60 s after the insert.
- **Fix:** none in-app today (no manual retry); BC-13 adds a timeout to `failed_transient` and error handling.

### Image slot disappears although the image exists

- **Cause:** `createSignedUrl` failed (or the 60 s / 3600 s signed URL expired); the panel then renders nothing.
- **Fix:** reopen the view to mint a new URL.

### No Insight at a milestone

- **Causes:** the save was offline (no milestone check); the book had no recap when the milestone was crossed (Insights need a master recap; a reader below 5 % or inside the 6 h recap cooldown at 10 % gets no 10 % Insight); the save was a backward correction; or a stale percentage after a `total_pages` edit hid the crossing.
- **Fix:** expected today; D-12 · BC-08 generates from captures or metadata and backfills skipped milestones.

### "Chronicler is weaving new lore" banner stays up, even on `/login`

- **Cause:** in-flight AI jobs are not cancelled or bound to the user on sign-out (PLT-D13); the glass toast can also cover the banner (PLT-D38).

### Passport says "Your passport is being generated." forever, or its summary is blank

- **Cause:** passport generation runs only in the client, on the first online save that reaches 100 %. A book completed offline or added through the "Already completed" path never gets one. An empty AI stream saves `ai_summary = ''`, so the summary section stays blank. Imported books hide "View Reading Journey" (`source <> 'manual'`).
- **Fix:** expected today; BC-05 makes the server own completion effects (passport job included).

---

## Build & tests

### `npm install` fails

- **Cause:** the repo uses **pnpm** (`pnpm-lock.yaml`).
- **Fix:** `pnpm install`.

### `pnpm build` fails

- Run `pnpm build` and read the `vue-tsc -b` output first: unused locals/parameters are errors (`noUnusedLocals`, `noUnusedParameters`), as are non-erasable TypeScript constructs (`erasableSyntaxOnly`).
- `src/sw.ts` is excluded from the app tsconfig and compiled by VitePWA; its type errors surface during `vite build`.

### Tests fail

```bash
pnpm exec vitest run tests/unit/<file>.spec.ts
```

Check whether the `@/services/supabase` mock still matches the store's call chain after an API change, and whether a module singleton kept state from a previous test ([Testing › Writing unit tests](Testing.md#writing-unit-tests)).

### Local stack doesn't match production

- **Cause:** `supabase/migrations/` has drifted (BC-03); replaying it regresses `get_reading_stats`, re-adds a stale `lore_cards.type` CHECK and sets a 512 KB recap-image limit.
- **Fix:** use `supabase/reference/live-baseline-2026-10-18.sql` as the reference until the baseline migration lands; never `db push` from the current folder ([Deployment › Database changes](Deployment.md#database-changes)).
