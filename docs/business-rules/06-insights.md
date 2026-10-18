# 06 · Insights (Lore cards) — Business Rules
> **Prefix:** INS · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-18

## Overview

Insights are short AI-written "lore" entries (title, 90–160-word body, type, up to 5 named entities) that unlock as the reader crosses 10 % reading milestones (10, 20 … 90; never 100). Each card gives canonical background for something the reader has already met in the book, without restating it. The user-facing name is **"Insights"**; most UI copy and every internal name still say "lore" (`lore_cards`, `generate-lore`, `useLoreCardsStore`). "The Chronicler" is the product name and "BookHero" the code name (D-03).

Today the whole pipeline is **client-orchestrated**: the web client detects the milestone after an online page save, builds the spoiler-safe context ("Master Recap") from the reader's recaps, calls `generate-lore`, and inserts the row itself. The decided target (D-06 · D-12 · BC-08) moves detection, context building, fallback, backfill and the insert to the server; clients only list cards and mark them seen.

| Web route / surface | Purpose | Insight elements |
|---|---|---|
| (no UI) page save on `/` hero sheet or `/books/:id` page sheet / Focus mode | Trigger | Milestone detection → background generation (INS-01…INS-21) |
| Global, all routes (`App.vue`) | Progress signal | "Chronicler is weaving new lore · {title}" top pill while a generation call runs (INS-17, INS-60) |
| `/books/:id` Book Detail | One book's cards | Collapsible Insights card: type badge, "Unlocked at N%", title; expands to the body; cycle button when > 1 card; hidden for DNF (INS-43, INS-44). Opening the page marks the book's cards seen (INS-40) |
| `/lexicon` (route `lexicon`, labelled "Codex") → tab **Insights** (`?tab=lore`, `?bookId=`) | All cards | Book filter ("All Books" + every book), collapsible list newest first (INS-45…INS-49) |
| `/` hero card, `/` In Progress list, `/library` list view and search results | Unseen indicator | "New Lore" chip → Book Detail (INS-38, INS-39) |
| `/` hero card pulse line | Nudge | "N pages to your next Insight" within 15 pages (INS-50, INS-51) |
| `/profile/trophy-room` | Gamification | +15 XP per card; achievement "Lorekeeper" (INS-52, INS-53) |

**Owning objects** (names only; shapes live in [backend-contract](../backend-contract.md) §3.2 Tables, §4 Cascades, §5 RLS, §8 RPC catalogue, §10.3 `generate-lore`):

| Kind | Objects |
|---|---|
| Table owned | `lore_cards` |
| Tables read | `recaps` (Master Recap), `books` (title, author, ISBN, total pages), `reading_progress` (trigger source) |
| Edge function | `generate-lore` (deployed **v18**, canonical per D-09; `verify_jwt: false`) |
| RPC | `get_reading_quest_summary` (counts cards for XP — the only DB function that reads `lore_cards`) |
| Constraints / indexes | `lore_cards_unique_milestone`, `lore_cards_unlocked_at_milestone_check`, `lore_cards_book_id_fkey`, `lore_cards_user_id_fkey`, `lore_cards_user_book_idx`, `lore_cards_user_created_at_idx` |
| Triggers | none on `lore_cards`; not in the `supabase_realtime` publication |

**Related domains:**

- [02 · Reading Sessions](02-reading-sessions.md): the page save that triggers detection (SES-30, SES-69), the hero nudge (SES-68), offline saves (SES-77).
- [03 · Recaps](03-recaps.md): Master Recap (REC-58), the Insight gate (REC-59), the recap lock (REC-03…REC-08) that decides whether a qualifying recap can exist.
- [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md): page captures (the D-12 fallback source) and the completion purge (CAP-42).
- [05 · Codex & Lexicon](05-codex-lexicon.md): the Codex page that hosts the Insights tab; `?bookId=` deep links (LEX-51, LEX-81).
- [07 · Profile, Stats & Goals](07-profile-stats-goals.md): XP formula (PRO-01, PRO-06), achievements.
- [08 · Platform, Auth & Account](08-platform-auth-account.md): edge-function auth (PLT-78), SWR cache (PLT-30), sign-out (PLT-15), toast vs banner (PLT-37).
- [09 · Database invariants](09-database-invariants.md): BE-29 (constraints), BE-02 (RLS), BE-72/BE-73 (cascades).
- [11 · Cross-domain](11-cross-domain.md): delete, complete, DNF, sign-out, page-count edits.
- [12 · Client logic register](12-client-logic-register.md).

**Traceability:** this file supersedes the intent docs `specs/007-lore-chronoscope` and `specs/010-dashboard-ux-sync` (temperature 0.6, 2 048 tokens, 150–300 words, types `History|Myth|Geography`, success toast, "created by the edge function", random initial card — all superseded by the code). The Insights gaps that the 2026-10-18 audit found in the iOS docs are fully covered by INS-01…INS-21.

**Live snapshot (2026-10-18, aggregates only):**

| Measure | Value |
|---|---|
| `lore_cards` rows | 79 across 3 users / 14 books; 78 `seen = true` |
| Milestone split | 10: 4 · 20: 11 · 30: 11 · 40: 8 · 50: 9 · 60: 10 · 70: 9 · 80: 8 · 90: 9 (10 % is the rarest — INS-12a) |
| Type split | Lore 44 · Geography 15 · Culture 11 · History 9 (no Technology rows) |
| Produced by v18 | 67 of 79 rows were created on or after the v18 deploy (2026-05-07) |
| Rows on imported books (`source ≠ 'manual'`) | 0 |
| Rows whose `book_id` belongs to another user | 0 |
| Rows unlocked on the completing page (`unlocked_at_page ≥ total_pages`) | 3 (INS-06) |
| Rows whose stored milestone no longer matches `min(90, floor(page/total×10)×10)` | 1 (INS-35) |
| Rows with no mid-book recap created before them | 6, all created 2026-04-19…2026-05-07 (legacy; cause not determined). Every later card had one |

---

## Rules

### Milestones & detection (client-only today)

#### INS-01 · Milestone set
Valid milestones are exactly `{10, 20, 30, 40, 50, 60, 70, 80, 90}`. There is no 0 % and no 100 % milestone, so a (user, book) pair can hold at most **9** cards.
- **Enforced:** `client` (`detectCrossedMilestone`); `server:edge` (`generate-lore` `VALID_MILESTONES`); `server:db` (CHECK `lore_cards_unlocked_at_milestone_check`, UNIQUE `lore_cards_unique_milestone`).
- **Source:** `src/utils/milestoneDetect.ts:21-43`; deployed `generate-lore` v18 (`VALID_MILESTONES`); live `pg_constraint`.

#### INS-02 · Percentages used for detection
`newPct = totalPages > 0 ? Math.round(currentPage / totalPages × 10000) / 100 : 0` (2 decimals, half-up, **not** capped at 100). `prevPct = progress[bookId]?.percentage ?? 0` — the **in-memory** value, rounded the same way by `mapReadingProgress` or taken from `get_library_with_progress` (`least(100, round(current_page / total_pages × 100, 2))`). With no progress row loaded, `prevPct = 0`.
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:502-505`; `src/types/index.ts:440`; RPC `get_library_with_progress`.
- **Target:** detection runs inside `save_progress` from the **stored** previous `current_page` and the stored `total_pages`, never from a client-cached percentage (D-06 · BC-04 · BC-08).
- **Note:**
  - After a `total_pages` edit the progress map keeps the old percentage while `newPct` uses the new total. Example: total raised 200 → 400 at page 150 (real 37.5 %, cached 75 %); the next save at page 170 (42.5 %) looks backward and the 40 % milestone is lost. ⚠ INS-D11
  - JS rounding and PostgreSQL `numeric` `round(…, 2)` can differ by 0.01 in exact half-way cases; harmless except at x9.995 boundaries.

#### INS-03 · Crossing rule
`detectCrossedMilestone(prev, new)`: null if `new ≤ prev`; `prevBucket = floor(prev/10)×10`, `newBucket = floor(new/10)×10`; null if `newBucket ≤ prevBucket`; `milestone = min(newBucket, 90)`; null if `milestone < 10` or `milestone ≤ prevBucket`; otherwise `milestone`.
- **Enforced:** `client`
- **Source:** `src/utils/milestoneDetect.ts:21-43`; tests `tests/unit/milestoneDetect.spec.ts`.
- **Note:** test table: 5→10 ⇒ 10; 18→22 ⇒ 20; 22→28 ⇒ null; 8→35 ⇒ 30; 89→100 ⇒ 90; 95→100 ⇒ null; 20→20 ⇒ null; 25→15 ⇒ null; 0→5 ⇒ null.

#### INS-04 · A multi-milestone jump collapses to the latest
A save from 8 % to 35 % attempts only the 30 % card; 10 % and 20 % are skipped and **never retried automatically**. ⚠ INS-D05
- **Enforced:** `client`
- **Source:** `src/utils/milestoneDetect.ts:32-34`.
- **Target:** every crossed milestone that has no card is generated (latest first is recommended; policy in INS-Q01), and milestones skipped earlier are backfilled on later saves (D-12 · BC-08).

#### INS-05 · Rewind-then-advance can backfill
Dedup is per milestone (INS-11), so a backward correction followed by a forward save re-crosses buckets: any bucket without a card (skipped by INS-04 or failed) generates on that crossing; buckets that already have a card are no-ops. This contradicts spec 007's "skipped milestones are not backfilled".
- **Enforced:** `client` (consequence of INS-03 + INS-11)
- **Source:** `src/utils/milestoneDetect.ts:21-43`; `src/stores/loreCards.ts:108-111`.
- **Target:** superseded by systematic server backfill (D-12 · BC-08).

#### INS-06 · Completion can unlock the 90 % card
A save to 100 % from any value below 90 % yields milestone 90 (cap) when no 90 % card exists, with `unlocked_at_page = totalPages`. It runs in parallel with the passport auto-generation. Reaching 100 % from ≥ 90 % unlocks nothing.
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:617-632`.
- **Target:** completion effects, including Insight milestone evaluation, have one server owner whatever the client or path (D-06 · BC-05 · BC-08).
- **Note:** the completing save also purges the book's page captures in the same statement (trigger `page_captures_delete_on_completion`, [CAP-42](04-capture-resume-quiz.md#cap-42--completion-purge-from-the-progress-side)). A server-side captures fallback for the completing save must read or snapshot the captures before that purge (INS-Q02).

#### INS-07 · Only online, server-confirmed saves trigger
Detection runs only in the `navigator.onLine` branch, after the `reading_progress` upsert succeeds. A failed `progress_history` insert is swallowed and detection still runs. `prevPct` is captured **before** the optimistic update, so two rapid saves each detect against the preceding optimistic value. Offline saves are queued and replayed by `drainQueue → flushQueue(syncToSupabase)` **without** detection, so a milestone crossed offline is lost (recoverable only via INS-05). ⚠ INS-D06
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:502,551-632,656-664,81-84`.
- **Target:** offline saves are replayed through `save_progress` with their original timestamp, and the server evaluates milestones on every save including replays (D-08 · BC-04 · BC-08).

#### INS-08 · Quiet writes never trigger
`setInitialProgress` (add-book initial status) and CSV import (`booksStore.importBooks`) bypass `updateProgress`, so they never produce Insights. `markDnf`, `resumeDnf`, session start, pause, resume and cancel never trigger either.
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:419-466`; `src/stores/books.ts:247-252`.
- **Target:** whether milestones at or below a book's starting page (added mid-way or imported) are ever backfilled is INS-Q01 (recommended: no).

#### INS-09 · Page clamp before save
Both save entry points clamp `page = max(0, min(input, totalPages))` before calling `updateProgress`. An unchanged page during an active session is not saved at all (confirm dialog "No pages read").
- **Enforced:** `client`
- **Source:** `src/pages/BookDetailPage.vue:134-152`; `src/pages/DashboardPage.vue:245-266`.
- **Note:** `updateProgress` has exactly two callers in `src/` (`BookDetailPage.vue:158`, `DashboardPage.vue:273`); the Focus-mode overlay save funnels into the same two handlers (`BookProgressPanel.vue:54-56,150`; `HeroBookCard.vue:67-69,326`).

#### INS-10 · DNF and completed books cannot trigger
The page input and session controls are hidden for DNF (`isDnf`) and complete (`isComplete`) books, so they produce no saves and no Insights. There is **no store-level guard**.
- **Enforced:** `client` (UI only)
- **Source:** `src/components/book/BookProgressPanel.vue:76,102,182`.
- **Target:** the server-side orchestration skips DNF books (recommended within BC-08); a completed book only gets cards through the completing save (INS-06).

### Eligibility & orchestration inside `maybeUnlockForMilestone` (client-only today)

#### INS-11 · Dedup (cost gate)
The client awaits `fetchLoreForBook(bookId)` — which returns **stale** data immediately when the SWR status is `background` — then returns without an AI call if any local card has `unlockedAtMilestone === milestone`. The server backstop is UNIQUE `lore_cards_unique_milestone (user_id, book_id, unlocked_at_milestone)`: a racing duplicate fails at INSERT with `23505`, **after** the AI cost was spent, and is swallowed. ⚠ INS-D08
- **Enforced:** `client` (pre-check); `server:db` (`lore_cards_unique_milestone`).
- **Source:** `src/stores/loreCards.ts:108-111`; live `pg_constraint`.
- **Target:** the server checks for an existing card and claims the (user, book, milestone) job **before** any AI call, and inserts with `ON CONFLICT DO NOTHING` (D-06 · BC-08).

#### INS-12 · Recap prerequisite (spoiler wall)
The client awaits `recapsStore.fetchRecapsForBook(bookId)` (SWR 60 s) and builds the Master Recap (INS-13). If it is the empty string, it returns with no AI call. A reader who never generated a mid-book recap therefore **never gets Insights**; the page-0 blurb (`progress_snapshot = 0`) does not count. The crossed milestone is consumed and never re-attempted. ⚠ INS-D04
- **Enforced:** `client`; `server:edge` (`generate-lore` rejects a blank `masterRecap` with 400).
- **Source:** `src/stores/loreCards.ts:113-117`; `src/utils/masterRecap.ts:15-32`; [REC-59](03-recaps.md#rec-59--insights-depend-on-recaps-today).
- **Target:** when no qualifying recap exists, the Insight is generated from the reader's page captures, or from spoiler-guarded book metadata (D-12 · BC-08). Context definitions are INS-Q02.

#### INS-12a · The recap lock gates the first Insight
"Get Recap" is itself locked ([REC-03…REC-08](03-recaps.md#recap-lock-client-only-today)): unlocked only when `currentPage ≥ max(1, ceil((lastRecapPct + 5)/100 × totalPages))` **and** ≥ 6 h have passed since the most recent of {last recap, last page save}, or by the idle grant (≥ 72 h since `reading_progress.updated_at` and ≥ 6 h since the last recap). To get the **10 %** Insight the reader must reach ≥ 5 %, wait 6 h after the last save, generate a recap, then save past 10 %. A recap generated **after** a milestone was crossed never retro-generates the missed card. "Get Recap" is hidden on Book Detail for completed books and the whole recap section is hidden for DNF books.
- **Enforced:** `client` (`useRecapLock`)
- **Source:** `src/composables/useRecapLock.ts:6-8,49-56,86-112`; `src/pages/BookDetailPage.vue:304,308`.
- **Target:** with the D-12 fallback the recap lock no longer gates Insights (D-12 · BC-08); the lock itself moves server-side under BC-07.
- **Note:** live evidence — the 10 % milestone has 4 cards against 8–11 for every other milestone.

#### INS-13 · Master Recap derivation
From the book's recap rows: keep `progressSnapshot > 0` **and** `(pageSnapshot ?? 0) ≤ currentPage`; sort by `pageSnapshot ?? 0` ascending (stable; ties keep the store's `created_at desc` order); render each as three lines `Memory jogger: …` / `Concept watchlist: …` / `Thematic bridge: …`; join with `\n\n---\n\n`. A null `pageSnapshot` counts as page 0 (always included). Corpus and inferred recaps are both included. The value is not persisted and has no length cap, and `generate-lore` trusts whatever text it receives. ⚠ INS-D03
- **Enforced:** `client`
- **Source:** `src/utils/masterRecap.ts:15-32`; tests `tests/unit/masterRecap.spec.ts`; same rule as [REC-58](03-recaps.md#rec-58--master-recap).
- **Target:** built server-side in the same byte format, so the v18 prompt sees identical input (D-06 · BC-08).
- **Note:**
  - `currentPage` is the page just saved, not the milestone page, so recaps up to the saved page are included.
  - The source rows can be stale (SWR `background` serves cached data), so a recap generated on another device moments earlier can be missing. A recap generated in this tab is `unshift`ed locally and is included (`src/stores/recaps.ts:137-139`).
  - Inferred recaps can themselves contain spoilers (the Book Detail warning says so); Insights inherit that risk.

#### INS-14 · The book must be in the local store
If `booksStore.bookById(bookId)` is undefined, the client returns without an AI call.
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:119-122`.
- **Target:** the server loads the book by id and requires `books.user_id = auth.uid()` (BC-08 · BC-01).

#### INS-15 · Request percentage
`percentage = totalPages > 0 ? Math.round(currentPage / totalPages × 100) : 0` (integer), where `currentPage` is the page just saved. `generate-lore` rounds it again for the prompt.
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:124-126`.
- **Target:** computed server-side (BC-08).

#### INS-16 · Topic de-duplication input
`existingTopics` = the **titles** (not the entities) of every locally cached card for the book at request time. Concurrent generations for the same book do not see each other's titles.
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:143`.
- **Target:** the server reads the titles of existing cards at generation time, with generations serialised per book (BC-08).

#### INS-17 · Banner state
The book id is added to `generatingBookIds` immediately before the HTTP call and removed in `finally`. The banner is not shown during the pre-checks (INS-11…INS-14) or the INSERT.
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:28-33,130,145-149`.
- **Target:** clients learn about pending server-side generations from the save response and show the banner until the card arrives (INS-Q13).

#### INS-18 · The client inserts the row
On a 2xx response the client inserts `{user_id: current auth uid, book_id, title, content, type, linked_entities, unlocked_at_page: currentPage, unlocked_at_milestone: milestone, seen: false}` with `.select().single()`. `generate-lore` never writes to the database.
- **Enforced:** `client` (RLS `lore_cards_insert_own` only checks `auth.uid() = user_id`)
- **Source:** `src/stores/loreCards.ts:151-168`.
- **Target:** the server inserts the row (`INSERT … ON CONFLICT (user_id, book_id, unlocked_at_milestone) DO NOTHING RETURNING *`); clients only list and mark seen. The client INSERT path stays available until the PWA migrates (D-05), then client INSERT is revoked (D-06 · BC-08 · BC-01).

#### INS-19 · Local merge after insert
The client appends the mapped row, re-sorts by milestone ascending, `swrTouch`es `lore:{uid}:{bookId}` and `lore:{uid}:all`, and prefix-invalidates `readingQuest:{uid}` (XP changed). There is **no toast** and no other arrival feedback besides the chips and the banner disappearing.
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:170-180` (the comment at `:179-180` about a "dashboard inline lore card" is stale — no such card exists).
- **Target:** clients refresh the list on foreground or via Realtime (BC-14) and still invalidate the quest cache. Arrival feedback is INS-Q07.

#### INS-20 · Silent failure
Any throw anywhere (fetch, edge non-2xx, insert error including the unique violation, network) is logged as `console.error('[loreCards] maybeUnlockForMilestone failed:', e)`. Nothing is shown, nothing is retried, and the milestone is never re-attempted. The caller also `.catch`es. ⚠ INS-D07
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:181-184`; `src/stores/progress.ts:630-631`.
- **Target:** failures are recorded server-side and retried, and failed milestones are backfilled (D-12 · BC-08; retry policy INS-Q03). The UI stays silent.

#### INS-21 · Fire-and-forget
`updateProgress` does not await the generation; the save UI resolves independently.
- **Enforced:** `client`
- **Source:** `src/stores/progress.ts:626-632`.
- **Target:** the save returns immediately and generation runs asynchronously on the server; once a paid call has started, the server finishes and saves it (BC-08).

### `generate-lore` edge function (deployed v18 — canonical per D-09)

#### INS-22 · Methods, CORS and check order
`OPTIONS` → 200 with CORS headers and no body; any other non-`POST` → 405 `{"error":"Method not allowed"}`. CORS: `Access-Control-Allow-Origin: *`, headers `authorization, x-client-info, apikey, content-type`, methods `POST, OPTIONS`. Check order: method → auth → body → secret → AI.
- **Enforced:** `server:edge` (`generate-lore`)
- **Source:** deployed v18 source; repo `supabase/functions/generate-lore/index.ts:4-8,146-208`.

#### INS-23 · Auth is decode-only
Deployed with `verify_jwt: false`. The function strips a case-insensitive `Bearer ` prefix (empty token → 401), base64url-decodes the JWT payload **without verifying the signature or expiry**, and requires a `sub` claim; otherwise 401 `{"error":"Unauthorized"}`. `sub` is not used further (no DB access, no per-user limit). ⚠ INS-D01
- **Enforced:** `server:edge` (weak)
- **Source:** live `list_edge_functions` (`verify_jwt: false`); deployed v18 `decodeJwt`; repo `index.ts:12-19,160-175`.
- **Target:** `verify_jwt = true` or real `supabase.auth.getUser` verification, no hand-rolled decoding, and a committed `supabase/config.toml` (BC-02). A shared entitlement and AI-usage check runs in the function, allowing everything until tiers are decided (D-14 · BC-12).
- **Note:** unlike `generate-recap` and `ocr-page`, this decoder normalises base64url (`-`→`+`, `_`→`/`), so genuine tokens are not spuriously rejected.

#### INS-24 · Body validation
Required non-null: `title`, `author`, `currentPage`, `totalPages`, `percentage`, `milestone`, `masterRecap`. `masterRecap` must be a non-blank string and `Number(milestone)` must be in the INS-01 set. Invalid JSON or any failure → 400 `{"error":"Missing required fields"}`. Numeric types and string lengths are **not** validated; `existingTopics` and `isbn` are optional. ⚠ INS-D15
- **Enforced:** `server:edge`
- **Source:** deployed v18 `validateBody`; repo `index.ts:100-109,178-193`.
- **Note:**
  - Empty-string `title` / `author` pass (only null/undefined are rejected); `"50"` passes as a milestone.
  - `percentage`, `milestone` and `currentPage` are never cross-checked against each other.
  - A non-array truthy `existingTopics` with a `length` (e.g. a string) throws inside the AI `try` → 500 `{"error":"Internal server error"}` instead of 400.

#### INS-25 · Missing secret
If the `GEMINI_API_KEY` function secret is absent → 503 `{"error":"AI service not configured"}`.
- **Enforced:** `server:edge`
- **Source:** deployed v18; repo `index.ts:199-205`.

#### INS-26 · Model call (deployed v18)
`@google/genai` (unpinned `npm:` import) `models.generateContent`, model `gemini-2.5-flash`, non-streaming, `maxOutputTokens: 4096`, `temperature: 0.35`, system instruction = the "Chronicler Historian" prompt. `thinkingBudget: 1000` and `includeThoughts: true` are placed at the **root of `config`** instead of inside `thinkingConfig`, so the intended budget is most likely ignored and the model's default dynamic thinking applies; thinking tokens share the 4 096-token output budget. ⚠ INS-D12, INS-D13
- **Enforced:** `server:edge`
- **Source:** deployed v18 source (live `get_edge_function`); repo `index.ts:253-265` differs (temperature 0.85, `thinkingConfig: { thinkingBudget: 0 }`).
- **Target:** repo synced to deployed v18 with the thinking settings moved into `thinkingConfig` (BC-03 · D-09). Recommended: `includeThoughts: false` (no consumer reads thoughts) and a pinned SDK version.
- **Note:** [UNVERIFIED: whether the SDK drops the root-level keys, and the live rate of `finishReason: MAX_TOKENS` / "No JSON block found" — no `generate-lore` entries in the available log window. Production keeps producing cards with v18 (67 rows since the deploy).]

#### INS-27 · Prompt contract (deployed v18)
The prompt requires: reference only characters, places, events and concepts present in the Master Recap; do **not** summarise or restate it; give "canonical context" drawn **exclusively** from the author's published books, appendices and official companion materials, with no invented details ("ACCURACY RULE"); pick ONE named subject in priority item/object → place → event → organisation/faction → group/demographic; prefer the most recent recap sections; when `existingTopics` is non-empty, a block `=== ALREADY COVERED — do NOT write about these topics again ===` lists them and demands a different topic; tone adapts to genre (Fantasy, Sci-fi, Thriller/Mystery, Historical) and "matches the prose style of {author}"; output raw JSON `{title: 3–8 words, content: 90–160 words, type: History|Culture|Geography|Technology|Lore, linked_entities: ≤ 5 names from the recap}`. The recap block header is `=== MASTER RECAP (Current Knowledge Boundary) ===`.
- **Enforced:** `server:edge` (prompt only — word counts and the spoiler rule are not validated)
- **Source:** deployed v18 `SYSTEM_PROMPT` and user message.
- **Target:** unchanged prompt for recap-sourced cards (D-09); fallback-sourced cards need prompt variants (INS-Q02).
- **Note:**
  - Book title, author, ISBN and the reader's recap text are interpolated **unescaped** into the prompt (self-contained prompt-injection surface: it only affects the caller's own card). ⚠ INS-D15
  - The "author's canon" instruction invites knowledge from later in the book; the only guard is the prompt line "Do NOT reference any events, characters, or spoilers that occur after the current progress". Monitor spoiler reports (INS-Q10).
  - The repo version differs: "expanded context, may introduce NEW details", a Romance tone line, recap header "oldest → newest", no LENGTH block (INS-D12).

#### INS-28 · Output extraction
The function takes the substring from the first `{` to the last `}`. None found → 500 `{"error":"AI output invalid","detail":"No JSON block found in response","finishReason","blockReason"}` and logs diagnostics (finish reason, block reason, safety ratings, usage, a 500-char raw preview). `JSON.parse` failure → 500 `{"error":"AI output invalid","detail":"Response was not valid JSON"}`.
- **Enforced:** `server:edge`
- **Source:** deployed v18 `extractJson`; repo `index.ts:137-142,267-307`.

#### INS-29 · Output validation and normalisation
`title` and `content` must be non-blank strings; `type` must be one of `History`, `Culture`, `Geography`, `Technology`, `Lore` (case-sensitive), otherwise 500 `{"error":"AI output invalid","detail":"Response failed shape validation"}`. `linked_entities`: non-arrays become `[]`; arrays are filtered to strings and **sliced to 5 before** trimming and empty-filtering, so fewer than 5 can survive even when more valid names existed. ⚠ INS-D26
- **Enforced:** `server:edge`
- **Source:** deployed v18 `validateAndNormalise`; repo `index.ts:114-132,309-316`.

#### INS-30 · Success response and generic errors
200 returns exactly `{title (trimmed), content (trimmed), type, linked_entities (trimmed, non-empty)}` — no id, page or milestone. Any other exception → 500 `{"error":"Internal server error","detail": <exception message>}`. There is no soft-failure 200 shape; the call is not idempotent. ⚠ INS-D15
- **Enforced:** `server:edge`
- **Source:** deployed v18; repo `index.ts:318-333`.
- **Target:** no internal error text in 500s (BC-02).
- **Note:** the web client reads only `error` (thrown as the message, then only logged); `detail`, `finishReason` and `blockReason` are never read (`src/services/loreService.ts:45-48`).

#### INS-61 · Data sent to the AI provider
Each call sends to Google Gemini: book title, author, ISBN, current page, total pages, percentage, milestone, the reader's Master Recap text, and the titles of the book's earlier cards.
- **Enforced:** `client` (request body) → `server:edge` (forwards to Gemini)
- **Source:** `src/stores/loreCards.ts:134-144`; deployed v18 user message.
- **Target:** with the D-12 fallback, the reader's page-capture text or book metadata can be sent instead (BC-08). Disclosure and consent belong in the App Privacy details and the first-AI-use explainer (see Notes for native clients).

### Persistence, ownership & cascades (live database)

#### INS-31 · Schema
`lore_cards(id uuid PK default gen_random_uuid(), user_id uuid NOT NULL → auth.users ON DELETE CASCADE, book_id uuid NOT NULL → books ON DELETE CASCADE, title text NOT NULL, content text NOT NULL, type text NOT NULL (no CHECK), linked_entities text[] NOT NULL default '{}', unlocked_at_page int NOT NULL, unlocked_at_milestone int NOT NULL CHECK ∈ {10…90 step 10}, seen bool NOT NULL default false, created_at timestamptz NOT NULL default now())`. No `updated_at`, no triggers. Indexes: `lore_cards_pkey (id)`, `lore_cards_unique_milestone (user_id, book_id, unlocked_at_milestone)`, `lore_cards_user_book_idx (user_id, book_id)`, `lore_cards_user_created_at_idx (user_id, created_at desc)`.
- **Enforced:** `server:db`
- **Source:** live `pg_constraint`, `pg_indexes`; `supabase/reference/live-baseline-2026-10-18.sql`; rule BE-29 in [09 · Database invariants](09-database-invariants.md).
- **Target:** additive nullable columns for BC-08 bookkeeping (e.g. the context source, INS-Q02) are backward compatible (D-05). A `type` CHECK is INS-Q11.
- **Note:** the local migration `20260417_lore_cards.sql:14` creates `CHECK (type IN ('History','Myth','Geography'))`, which does not exist live and would reject live rows on a replay. ⚠ INS-D14

#### INS-32 · Row-level security and grants
Four per-command policies on role `public`: `lore_cards_select_own`, `lore_cards_insert_own` (WITH CHECK `auth.uid() = user_id`), `lore_cards_update_own` (USING + WITH CHECK), `lore_cards_delete_own` — all `auth.uid() = user_id`. Any column is insertable and updatable by the owner, and the INSERT policy does **not** check that `book_id` belongs to the caller (only the FK exists). Table grants are the Supabase defaults (full DML to `anon` and `authenticated`), so RLS is the only gate. ⚠ INS-D02, INS-D16
- **Enforced:** `server:db` (RLS)
- **Source:** live `pg_policies`, `information_schema.role_table_grants`.
- **Target:** RLS on child tables checks book ownership (BC-01); once BC-08 owns the insert, clients lose INSERT and may only update `seen` (column grant or a mark-seen RPC) (D-06 · BC-08). The PWA keeps its insert path until it migrates (D-05).

#### INS-33 · Book delete cascade
Deleting a `books` row deletes its cards server-side (`lore_cards_book_id_fkey ON DELETE CASCADE`), and their XP disappears from `get_reading_quest_summary`. The web client does **not** purge lore state or lore cache keys on delete. ⚠ INS-D18
- **Enforced:** `server:db` (FK); `client` (no purge)
- **Source:** live FK; `src/stores/books.ts:413-435` (invalidates progress, library, breakdown, quest, lexicon, recaps and passport keys only).
- **Note:** a generation in flight for a deleted book still pays for the AI call and then fails the INSERT with FK `23503` (silent).

#### INS-34 · Account delete cascade
Deleting the `auth.users` row cascades every card (`lore_cards_user_id_fkey ON DELETE CASCADE`). No in-app account deletion exists today, so this only fires on an admin/dashboard deletion.
- **Enforced:** `server:db` (FK)
- **Source:** live FK.
- **Target:** immediate hard delete through the new `delete-account` edge function on web and iOS; the FK cascade removes the cards (D-10 · BC-11). Insights store nothing in Storage.

#### INS-35 · Completion, DNF and edits have no database effect on cards
The completion triggers (`page_captures_delete_on_completion`, `book_quizzes_delete_on_completion`) purge captures and the quiz only; cards persist. DNF, resume and book edits (title, author, total pages) leave cards untouched; `unlocked_at_milestone` and `unlocked_at_page` are never recomputed. Cards are immutable in practice except `seen`.
- **Enforced:** `server:db` (absence of triggers); `client` (no edit UI)
- **Source:** live trigger list (none on `lore_cards` or `books`).
- **Note:**
  - Live: 1 of 79 rows has a stored milestone that no longer equals `min(90, floor(unlocked_at_page / total_pages × 10) × 10)` — consistent with a later page-count edit or the INS-02 rounding edge.
  - No cards exist on imported books today, but nothing prevents it: an imported book later read through the normal save path is eligible.
  - Whether edits should regenerate or flag cards is INS-Q12.

#### INS-36 · Re-reading
Moving progress back to 0 and re-reading creates no new cards for milestones that already have one (INS-11). A **completed** book cannot be moved back in the web UI (pencil and session controls hidden when `isComplete`), so "rewind" only applies to in-progress books; there is no re-read or reset flow.
- **Enforced:** `client` (UI); `server:db` (unique milestone)
- **Source:** `src/components/book/BookProgressPanel.vue:76,102`.

### Seen flag & "New Lore" chip

#### INS-37 · New rows are unseen
Every inserted card has `seen = false`.
- **Enforced:** `client` (insert payload); `server:db` (default `false`)
- **Source:** `src/stores/loreCards.ts:163`.
- **Target:** the server insert also writes `seen = false` (BC-08).

#### INS-38 · Chip condition and surfaces
`hasUnseenLore(bookId) = loreByBook[bookId].some(c => !c.seen)`, computed purely from the in-memory store. The store is populated by `fetchLoreForAllBooks()` on Dashboard mount and Library mount (both non-blocking). The chip renders on the Dashboard hero card, the Dashboard "In progress" list, and Library **list-view** book cards (`BookCard` via `SwipeableBookCard`, which also renders Library **search results**). It does **not** render on the Library grid view, the DNF list page or the Completed row. ⚠ INS-D27
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:215-216`; `src/pages/DashboardPage.vue:175`; `src/pages/LibraryPage.vue:167`; `src/components/dashboard/HeroBookCard.vue:150-158`; `src/components/dashboard/InProgressSection.vue:37-45`; `src/components/books/BookCard.vue:22,41-60`; `src/components/library/SwipeableBookCard.vue:124`; `LibrarySearchResults.vue:100`.

#### INS-39 · Chip copy and action
Label "New Lore" with a sparkles icon; aria-label "New lore unlocked — tap to view". Tapping stops propagation and navigates to Book Detail.
- **Enforced:** `client`
- **Source:** `src/components/books/BookCard.vue:43-60`; `HeroBookCard.vue:150-158`; `InProgressSection.vue:37-45`.
- **Note:** final copy ("New Insight"?) is INS-Q05.

#### INS-40 · Mark seen on Book Detail
On Book Detail mount, after awaiting library (if missing) → progress (if missing) → recaps → passport → lexicon, the page calls `markBookLoreSeen(bookId)`. If the **local** cache holds ≥ 1 unseen card for the book, it sends `UPDATE lore_cards SET seen = true WHERE book_id = ? AND seen = false` (RLS scopes the user); on success it flips the local cards and `swrTouch`es both lore keys; on error it logs and keeps the chip. It is idempotent and runs regardless of DNF state or whether the Insights card was expanded. ⚠ INS-D22
- **Enforced:** `client`; `server:db` (RLS `lore_cards_update_own`)
- **Source:** `src/stores/loreCards.ts:189-208`; `src/pages/BookDetailPage.vue:86-95`.
- **Target:** clients still mark seen (BC-08: "clients only list and mark seen"); the semantics are INS-Q06.
- **Note:**
  - The `onMounted` chain has no try/catch: if any of the five earlier awaits rejects, `markBookLoreSeen` never runs and the chip survives the visit.
  - It is a no-op when the book's cards are not yet in memory (e.g. the Insights card's own fetch is slower, or a deep link to a DNF book whose card is not mounted).
  - The server UPDATE clears **all** unseen rows of the book, including ones not yet cached locally, but only cached cards are flipped in memory.

#### INS-41 · Seen is terminal and per book
There is no un-see; all unseen cards of a book are cleared together. Viewing a card in the Codex Insights tab does **not** mark it seen. A card that arrives while the reader is on Book Detail stays unseen, so the chip appears after navigating away. ⚠ INS-D23
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:189-208`; `src/components/lore/LoreCardList.vue` (no seen call).

### Display, ordering & presentation

#### INS-42 · Store ordering
`loreByBook[bookId]` is always sorted by `unlocked_at_milestone` ascending.
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:46,83,172-173`.

#### INS-43 · Book Detail card selection
The card initially shows the **last** card in milestone order (the highest milestone), not a random one. When the card count grows while mounted (including the first population 0 → N), it jumps to the last index — which is not the new card when a lower milestone was backfilled. The cycle button (only when > 1 card) picks a uniformly random **different** card and expands the panel; its tooltip is the native `title` "Card {i} of {n} — click to cycle". ⚠ INS-D24
- **Enforced:** `client`
- **Source:** `src/components/lore/LoreChronoscopeCard.vue:35-46,70-80,126-133`.
- **Note:** the initial selection is INS-Q09.

#### INS-44 · Book Detail visibility and states
Rendered only when `!isDnf`, so it shows for reading and completed books. It starts collapsed (`initialCollapsed = true`); the header (type badge + "Unlocked at N%" + title) toggles on click. States: first fetch pending → 3-line skeleton (one frame when the SWR cache is fresh); no cards → an empty `aria-hidden` div (nothing visible, no placeholder); ≥ 1 card → collapsed panel. A fetch error leaves `initialLoading = true` forever (**permanent skeleton**, unhandled rejection). ⚠ INS-D20
- **Enforced:** `client`
- **Source:** `src/pages/BookDetailPage.vue:301`; `src/components/lore/LoreChronoscopeCard.vue:35-39,90-138`.
- **Note:** the header `div` is not focusable (no role or tabindex); keyboard users rely on PrimeVue Panel's own toggle button. Panel transitions are disabled under `prefers-reduced-motion` (`LoreChronoscopeCard.vue:369-374`).

#### INS-45 · Codex Insights list ordering
`sortDescByDate(cards, 'createdAt')` — newest first across books. No grouping by book, no type filter, no search, no pagination. Cards start collapsed; the collapsed state per card id lasts for the component's lifetime.
- **Enforced:** `client`
- **Source:** `src/components/lore/LoreCardList.vue:36-47`; `src/utils/date.ts:79-82`.
- **Note:** the tab component is always mounted (`v-show`), so the Insights data loads on Codex mount even when the Lexicon tab is active (`GreatLibraryPage.vue:328-345`).

#### INS-46 · Codex book filter and deep links
Options are "All Books" (null) plus every book in `booksStore.books` (including completed, DNF, imported and card-less books). The Select is searchable (`filter`) and clearable (`show-clear` → All Books). The selected tab and book are mirrored into the URL with `router.replace({query: {tab: 'lore'?, bookId?}})`, which drops other query params. `?bookId=` pre-selects the Insights filter; it arrives from the Book Detail **"Words N"** chip (shown only when the book has ≥ 1 lexicon entry) and from the Word of the Day card — both open the **Lexicon** tab, so the Insights filter is pre-set but invisible until the reader switches tabs. The Insights filter (`loreBookId`) is independent of the Lexicon tab's filter, which is never seeded from `?bookId`. ⚠ INS-D28
- **Enforced:** `client`
- **Source:** `src/pages/GreatLibraryPage.vue:46,62-77,126-138,333-342`; `src/pages/BookDetailPage.vue:278`; `src/components/book/BookProgressPanel.vue:155-168`; LEX-51 and LEX-81 in [05 · Codex & Lexicon](05-codex-lexicon.md).
- **Note:** no live code navigates with `?tab=lore`; the only such link is in the dead compact card mode (INS-D32). The "Codex" chip on Book Detail opens the Add Word dialog; it does not navigate.

#### INS-47 · List row content
The collapsed header shows an uppercase type badge (History indigo, Culture amber, Geography emerald, Technology cyan, Lore violet), "Unlocked at N%" and the title. The **book title is not shown**, even in "All Books" mode.
- **Enforced:** `client`
- **Source:** `src/components/lore/LoreCardList.vue:49-58,86-94`.
- **Note:** INS-Q08.

#### INS-48 · Card detail content
Title, type badge, body (plain text, line-height 1.6), "Mentions:" chips only when `linkedEntities.length > 0`, and the footer "Unlocked on {MMM d, yyyy} at {milestone}%" formatted in the device's local time zone from `created_at`. `unlocked_at_page` is never displayed. ⚠ INS-D30
- **Enforced:** `client`
- **Source:** `src/components/lore/LoreCardDetail.vue:7-42`; `src/utils/date.ts:30-31`.
- **Note:** "Mentions:" chips are plain non-interactive spans keyed by entity text (duplicate names → duplicate Vue keys); the body has no `white-space: pre-wrap`, so newlines in AI text collapse on web; an unknown `type` renders with no colour class.

#### INS-49 · Codex empty state
"Keep reading to unlock your first lore card." + "Lore cards unlock at every 10% reading milestone." While loading: three 104 px skeleton panels. The same empty copy is shown on a fetch error (no error state). ⚠ INS-D21
- **Enforced:** `client`
- **Source:** `src/components/lore/LoreCardList.vue:16-34,62-74`.
- **Note:** a request-id guard stops a stale request from clearing the loading state of a newer one; a rejection still escapes the async watcher as an unhandled rejection after `finally` clears `loading`.

#### INS-60 · Generation banner presentation
Visible while `generatingBookIds.size > 0`. Copy "Chronicler is weaving new lore" plus the title of the first id in the Set's iteration order (omitted when the book is not in `booksStore`). Non-interactive (`pointer-events: none`), `role="status"`, `aria-live="polite"`, 0.25 s fade/slide. Layout: `position: fixed`, top = safe-area inset + 0.75 rem, centred, `z-index: 1200`, pill radius, max width `100vw − 2rem`, title ellipsised at 16 rem; a violet dot pulses every 1.6 s forever with **no** `prefers-reduced-motion` override. It is rendered once in `App.vue` outside `RouterView`, so it also shows over `/login` when a generation is still running after sign-out. The glass toast (`z-index 1210`) occupies the same slot and hides the banner while both are visible. ⚠ INS-D29
- **Enforced:** `client`
- **Source:** `src/App.vue:6`; `src/components/lore/LoreGenerationBanner.vue:9-103`; PLT-37 in [08 · Platform, Auth & Account](08-platform-auth-account.md).

### Nudge

#### INS-50 · Pages to the next Insight
`pagesToNextInsight(cp, tp)`: null if `tp ≤ 0` or `cp < 0`; `pct = cp / tp × 100` (unrounded); `next = (floor(pct/10) + 1) × 10`; null if `next > 90`; `milestonePage = ceil(next/100 × tp)`; return `milestonePage − cp` if > 0, else null.
- **Enforced:** `client`
- **Source:** `src/utils/milestoneDetect.ts:50-61`; tests `tests/unit/milestoneNudge.spec.ts`; same rule as [SES-68](02-reading-sessions.md#ses-68--pages-to-the-next-insight).
- **Note:** detection uses the 2-decimal rounded percentage (INS-02), the nudge the unrounded one: at 250 / 2 501 pages (9.996 %, rounded 10.00 %) the milestone unlocks one page before the nudge's `ceil` page.

#### INS-51 · Nudge display
The hero pulse line shows "{n} page(s) to your next Insight" when `n ≤ 15` (`MILESTONE_NUDGE_THRESHOLD`) and `pagesLeft > 15`; otherwise "{N} pages left · finish by ~{date}" ("finish wins"). It checks neither the recap prerequisite (INS-12) nor whether that milestone already has a card. ⚠ INS-D25
- **Enforced:** `client`
- **Source:** `src/components/dashboard/HeroBookCard.vue:123-135,217-231`.
- **Target:** with the D-12 fallback every crossed milestone yields a card, so the promise becomes truthful; clients still suppress the nudge when the next milestone already has a card (recommended within BC-08).

### Gamification

#### INS-52 · XP
Each `lore_cards` row is worth **15 XP** in `get_reading_quest_summary`: `lore_cards_unlocked = count(*) from lore_cards where user_id = p_user_id`, exposed as `sources.loreCardsUnlocked`. The count is all-time, has **no** book-source filter (unlike `pagesRead` and `completedBooks`, which count manual books only), does not join `books` (so a row on another user's book would count, INS-32), and drops when a book is deleted (FK cascade).
- **Enforced:** `server:rpc` (`get_reading_quest_summary`, SECURITY DEFINER)
- **Source:** live `get_reading_quest_summary` (CTEs `activity_counts`, `xp`); PRO-01 and PRO-06 in [07 · Profile, Stats & Goals](07-profile-stats-goals.md).
- **Note:**
  - Level thresholds 1 500 / 4 000 / 8 000 / 14 000 / 22 000 / 34 000 XP. The level-3 title is **"Lore Keeper"** (8 000–13 999 XP), a name collision with the "Lorekeeper" achievement (INS-D31).
  - The RPC's owner guard is not NULL-safe for anonymous callers; that fix belongs to BC-01 (PRO domain).
  - XP for backfilled and fallback cards is INS-Q04.

#### INS-53 · Achievement "Lorekeeper"
`insight_first` — "Lorekeeper", "Unlock your first Insight", icon `pi-eye` — is earned when `sources.loreCardsUnlocked ≥ 1`. It is evaluated client-side when the Trophy Room mounts; the earned date lives in the insert-only `achievements` ledger.
- **Enforced:** `client` (evaluation); `server:db` (ledger)
- **Source:** `src/utils/achievements.ts:103-109`.
- **Target:** achievements are evaluated server-side with a server-authoritative `earned_at` (D-06 · BC-09).

### Caching & identity lifecycle

#### INS-54 · Cache keys and TTL
Both lore keys use a TTL of **120 000 ms**: `lore:{uid}:{bookId}` (`fetchLoreForBook`) and `lore:{uid}:all` (`fetchLoreForAllBooks`, which also `swrTouch`es the per-book key of every book that has cards and whose key already exists).
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:19,36-95`; `src/composables/useCache.ts:193-194`.

#### INS-55 · User change keeps lore state
`clearAll()` on any auth identity change wipes the SWR metadata, but the Pinia `loreByBook` and `generatingBookIds` state is **not** reset. After sign-out and sign-in as another user in the same tab, the previous user's cards stay in memory and appear in Codex "All Books" until a reload. ⚠ INS-D17
- **Enforced:** `client`
- **Source:** `src/stores/auth.ts:85-92`; `src/stores/loreCards.ts:24,28,224-226`; PLT-15 in [08 · Platform, Auth & Account](08-platform-auth-account.md).

### Time

#### INS-56 · No time-zone logic
Milestones are percentage-based and carry no dates. `created_at` is the server's `now()` at INSERT time, i.e. **after** the AI call (typically 10–30 s after the save), not the save time; a save just before local midnight can therefore show the next day's date. Display and sorting use the device's local time zone (`parseISO` / `format`). No day boundary, streak or cooldown logic touches Insights; the only time-based gate is the upstream recap lock (INS-12a: 6 h / 72 h, device clock against server timestamps).
- **Enforced:** `client` (display); `server:db` (`created_at default now()`)
- **Source:** `src/components/lore/LoreCardDetail.vue:18,39-41`; `src/utils/date.ts:30-31`.
- **Target:** D-07 / BC-06 do not change Insights (no day boundaries). Under BC-08, `created_at` is the server-side generation time; the recap-lock dependency disappears (D-12).

### Timeouts & concurrency

#### INS-57 · No client timeout or cancellation
`loreService.generate` is a bare `fetch` with no `AbortController` or timeout; the banner stays up until the response or a network/platform timeout. `supabase.auth.getSession()` runs first (it may refresh the access token); no session → `Error('Not authenticated')`.
- **Enforced:** `client`
- **Source:** `src/services/loreService.ts:28-51`.
- **Target:** moot under BC-08 (no client-held AI call).
- **Note:** [UNVERIFIED: the Supabase edge wall-clock limit for this plan is not readable via MCP; see backend-contract §1.4.] Expected latency is 10–30 s (spec SC-002 "< 30 s"; not measured).

#### INS-58 · Account switch mid-generation
`authStore.user.id` is read at INSERT time, not captured at the start. Sign-out during the AI call → `authStore.user` is null → TypeError → silent exit (the paid result is lost). Sign-out **and** sign-in as another user in the same tab during the call → the card is inserted under the **new** user's `user_id` referencing the **previous** user's `book_id` (RLS checks only `user_id`, INS-32): the new user gains 15 XP and a card in Codex "All Books". ⚠ INS-D10
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:105-106,155`.
- **Target:** the server binds the job to the `auth.uid()` of the save and checks book ownership, so this cannot happen (BC-08 · BC-01). Native clients bind any legacy job to the starting user.

#### INS-59 · No per-book serialisation
Two milestone generations for the same book (rapid consecutive saves, INS-07) run in parallel; each reads `existingTopics` before the other inserts (INS-16), and the banner's Set holds the book id once, so it hides when the first finishes. ⚠ INS-D09
- **Enforced:** `client`
- **Source:** `src/stores/loreCards.ts:130-149`.
- **Target:** server-side generations are serialised per (user, book) (BC-08).

---

## Flows

### F1 · Milestone unlock today (web, happy path and every exit)

1. Reader saves page P from the hero sheet, Book Detail sheet or Focus mode → `updateProgress(bookId, P)` (`src/stores/progress.ts:495`).
2. `prevPct` = in-memory percentage (0 if none); `newPct` = `round2(P / T × 100)` (INS-02). Optimistic UI update.
3. **Offline** → enqueue `{type: 'progress_update'}` in IndexedDB → **exit** (no Insight, ever; INS-07). Persisted: queue item only.
4. Upsert `reading_progress` → failure: roll back and rethrow → **exit**. Persisted: `reading_progress.current_page`.
5. Insert `progress_history` (failure tolerated). If `newPct ≥ 100` and `prevPct < 100`: fire passport generation.
6. `m = detectCrossedMilestone(prevPct, newPct)`; null → **exit**.
7. `maybeUnlockForMilestone(bookId, m, P)`, not awaited (INS-21):
   1. No auth user → exit silently.
   2. Await `fetchLoreForBook` (throws → exit, logged). A card with milestone `m` exists → exit (dedup, INS-11).
   3. Await `fetchRecapsForBook` (throws → exit). Master Recap empty → exit (INS-12) — **the milestone is consumed**.
   4. Book not in the store → exit (INS-14).
   5. `generatingBookIds += bookId` → banner visible. `POST /functions/v1/generate-lore`. Non-2xx / network / no session → (`finally`: banner off) exit silently. `finally`: `generatingBookIds -= bookId` → banner hidden.
   6. INSERT `lore_cards` (`seen = false`). `23505` / RLS / FK `23503` / network → exit silently; the AI cost is spent and nothing is stored.
   7. Merge into `loreByBook` (sorted), `swrTouch` both lore keys, invalidate `readingQuest:{uid}*`. A mounted Book Detail card jumps to the last index; chips appear wherever `hasUnseenLore(bookId)` is rendered.

Persisted per step: only 7.6 writes (one row). There is no attempt ledger, so skipped and failed attempts are invisible and unrecoverable except by rewinding (INS-05).

**Abort paths:** closing the tab/app during 7.5 loses the paid result. Sign-out during 7.5 → TypeError at 7.6 → silent exit. Account switch during 7.5 → the card is inserted for the new user on the previous user's book (INS-58). Navigating between routes aborts nothing (the pipeline lives in the global Pinia store). There is no `AbortController`.

### F2 · Card row lifecycle

| From | Event | To |
|---|---|---|
| (none) | Client INSERT after a 200 from `generate-lore` (target: server INSERT `ON CONFLICT DO NOTHING`) | `seen = false` |
| `seen = false` | Book Detail mount → `markBookLoreSeen` | `seen = true` (terminal) |
| any | Book delete or user delete (FK CASCADE) | row gone (XP −15) |

### F3 · Banner state

`hidden` ⇄ `visible`, driven by `generatingBookIds.size > 0`. Shown only during the HTTP call (INS-17); title = first book id in the Set (INS-60). Two concurrent generations for one book hide it when the first finishes (INS-59).

### F4 · Book Detail Insights card

1. Mount → `initialLoading = true` (skeleton) → await `fetchLoreForBook`.
2. OK with 0 cards → empty `aria-hidden` div. OK with ≥ 1 card → collapsed panel at the last index (highest milestone).
3. Fetch throws → `onMounted` rejects; `initialLoading` stays `true` → **permanent skeleton** (INS-D20).
4. Header tap toggles expanded ⇄ collapsed. Cycle (n > 1) → random other card + expand.
5. Store length grows (first population or a new card) → index = last.
6. Hidden entirely for DNF books (INS-44).

### F5 · Codex Insights tab

1. Codex mount → `LoreCardList` mounted (`v-show`; Insights tab active iff `?tab=lore`) → `watch(bookId, immediate)`.
2. `loading = true` → `fetchLoreForBook(bookId)` or `fetchLoreForAllBooks()` → `finally loading = false` (request-id guarded).
3. 0 cards **or a fetch error** → empty-state copy (INS-49). ≥ 1 → collapsed panels, `createdAt` desc.
4. Filter change → `router.replace` + refetch (SWR: usually fresh, no network).
5. "All Books" lists `Object.values(loreByBook).flat()` — everything in memory, including deleted books' and a previous user's cards (INS-D17, INS-D18).

### F6 · Mark seen on Book Detail

`onMounted`: `fetchLibrary` (if the book is missing) → `fetchProgress` (if missing) → `fetchRecapsForBook` → `fetchPassport` → `fetchEntriesForBook` → `markBookLoreSeen`. It relies on `loreByBook[bookId]` already being populated (by the Insights card's own fetch, the Dashboard/Library all-books fetch, or an earlier visit). Not populated → no-op; any earlier rejection → skipped (INS-40).

### F7 · Offline

No Insight work happens offline: generation needs an online save (INS-07), and lore reads hit Supabase through SWR (stale in-memory data is served if it was loaded before). Nothing about Insights is persisted to IndexedDB or `localStorage`. The offline-queue replay never generates Insights, so those milestones are lost today.

### F8 · Target flow (D-06 · D-12 · BC-08; contract detail in [backend-consolidation-plan](../backend-consolidation-plan.md))

1. **Client →** `save_progress(book, page, note, client_occurred_at, idempotency_key)` (BC-04). Offline replays use the same call with their original time (D-08).
2. **Server, in the save transaction:** compute the previous and new percentage from the stored `current_page` and `total_pages`. Determine the **due set**: milestones `m ∈ {10…90}` with `m ≤ min(90, floor(newPct/10)×10)`, no existing card, not DNF, and (recommended) above the book's starting/baseline page (INS-Q01). Enqueue one job per due milestone with `ON CONFLICT DO NOTHING` on (user, book, milestone). For a completing save that may need the captures fallback, snapshot the capture context before the purge trigger runs (INS-06, INS-Q02).
3. **Server → client:** the save response carries the pending milestones, so the client can show the banner (INS-Q13).
4. **Worker (after commit), serialised per (user, book):** verify the job is still due (book exists, owned, not DNF, no card); run the shared entitlement + AI-usage check (allow-all until tiers are decided, D-14 · BC-12).
5. **Context, in order:** Master Recap (INS-13 format, spoiler wall `page_snapshot ≤ window page`) → the reader's page captures (page ≤ window page) → spoiler-guarded book metadata. Record which source was used (INS-Q02).
6. **Generate** with the v18 prompt (INS-27) or its fallback variant; `existingTopics` = titles of the book's existing cards (now complete because of serialisation). Validate per INS-28/INS-29.
7. **Persist:** `INSERT … ON CONFLICT (user_id, book_id, unlocked_at_milestone) DO NOTHING RETURNING *` with `seen = false`, `unlocked_at_page` and `unlocked_at_milestone`; write the AI-usage record; close the job.
8. **Failure:** the job is retried per INS-Q03; nothing is shown to the reader. Once a paid call has started, the server finishes and saves it whatever the client does.
9. **Backfill:** every later save re-evaluates the due set, so milestones skipped by jumps, crossed offline, or failed are generated (D-12).
10. **Clients:** list cards (refresh on foreground, or Realtime once `lore_cards` is published, BC-14), invalidate the quest cache when a new card appears, render chips/banner, and mark seen. Optional later: push "Insight unlocked" via `device_tokens` (BC-14).
11. **Transition (D-05):** the legacy client path (F1) and the legacy `generate-lore` request contract keep working for the PWA until it moves to `save_progress`; a client must not run both paths. The PWA drops F1 in the release that adopts `save_progress`. After that, client INSERT on `lore_cards` is revoked and clients may only update `seen` (INS-32).

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| Milestone set | 10, 20, …, 90 | Valid unlock milestones | `src/utils/milestoneDetect.ts:21-43`; `generate-lore` `VALID_MILESTONES`; CHECK `lore_cards_unlocked_at_milestone_check` |
| Milestone cap | 90 | No 100 % card | `src/utils/milestoneDetect.ts:34` |
| Bucket size | 10 % | `floor(pct/10)×10` | `src/utils/milestoneDetect.ts:27-28` |
| Detection precision | 2 decimals | `Math.round(x × 10000) / 100` | `src/stores/progress.ts:503-505` |
| Request percentage precision | integer | `Math.round(x × 100)` | `src/stores/loreCards.ts:124-126` |
| Max cards per user/book | 9 | One per milestone | `lore_cards_unique_milestone` |
| Lore SWR TTL | 120 000 ms | Per-book and all-books keys | `src/stores/loreCards.ts:19` |
| Recaps SWR TTL | 60 000 ms | Master Recap source freshness | `src/stores/recaps.ts:18` |
| `MILESTONE_NUDGE_THRESHOLD` | 15 pages | Show "N pages to your next Insight" | `src/components/dashboard/HeroBookCard.vue:125` |
| Model | `gemini-2.5-flash` | AI model | deployed v18 |
| Temperature | **0.35** (repo 0.85 — drift) | Accuracy-first | deployed v18; repo `index.ts:257` |
| Thinking | `thinkingBudget: 1000`, `includeThoughts: true` at the `config` root (misplaced; repo `thinkingConfig.thinkingBudget: 0`) | Reasoning budget | deployed v18; repo `index.ts:262` |
| `maxOutputTokens` | 4 096 (shared with thinking tokens) | Output budget | deployed v18; repo `index.ts:258` |
| Title length (prompt) | 3–8 words | Not validated | deployed v18 |
| Content length (prompt) | 90–160 words | Not validated | deployed v18 |
| `linked_entities` max | 5 | Truncated, not rejected | deployed v18 `validateAndNormalise` |
| Valid types | `History`, `Culture`, `Geography`, `Technology`, `Lore` | Case-sensitive; no DB CHECK | deployed v18; `src/types/index.ts:698` |
| Diagnostic preview | 500 chars | Raw AI text logged on a "No JSON" failure | deployed v18 |
| Master Recap separator | `\n\n---\n\n` | Between recaps | `src/utils/masterRecap.ts:31` |
| Master Recap labels | `Memory jogger: ` / `Concept watchlist: ` / `Thematic bridge: ` | Per-recap lines | `src/utils/masterRecap.ts:26-28` |
| XP per card | 15 | Reading Quest XP | `get_reading_quest_summary` |
| Achievement `insight_first` | ≥ 1 card | "Lorekeeper" | `src/utils/achievements.ts:103-109` |
| Level-3 title | "Lore Keeper" (8 000–13 999 XP) | Not the achievement | `get_reading_quest_summary` |
| Recap page threshold (upstream gate) | +5 % since the last recap | Prerequisite for any Insight today | `src/composables/useRecapLock.ts:6` |
| Recap cooldown (upstream gate) | 6 h since the last recap or page save | Same | `src/composables/useRecapLock.ts:7` |
| Recap idle grant (upstream gate) | 72 h since `reading_progress.updated_at` | Same | `src/composables/useRecapLock.ts:8` |
| Banner z-index / title max width / pulse | 1200 / 16 rem / 1.6 s infinite | Global banner | `src/components/lore/LoreGenerationBanner.vue:39,56,79` |
| Codex skeleton | 3 × 104 px | Loading placeholders | `src/components/lore/LoreCardList.vue:63-65` |
| Compact-card excerpt (dead) | 120 chars + "…" | Unused compact mode | `src/components/lore/LoreChronoscopeCard.vue:176-178` |

---

## Data touchpoints

| Object | Read / write | By whom | Contract |
|---|---|---|---|
| `lore_cards` | SELECT `*` `eq(book_id)` `order(unlocked_at_milestone asc)` | Client `fetchLoreForBook` | [backend-contract](../backend-contract.md) §3.2 |
| `lore_cards` | SELECT `*` `order(created_at desc)`, no limit; partitioned by `book_id` client-side | Client `fetchLoreForAllBooks` | §3.2 |
| `lore_cards` | INSERT (9 columns) `.select().single()`; `23505` = already unlocked | Client today; server under BC-08 | §3.2, §5 |
| `lore_cards` | UPDATE `{seen: true}` `eq(book_id)` `eq(seen, false)`, no `.select()` | Client `markBookLoreSeen` | §5 |
| `lore_cards` | DELETE (cascade only) | FKs from `books`, `auth.users` | §4.1, §4.2 |
| `lore_cards` | `count(*)` → XP | RPC `get_reading_quest_summary` | §8 |
| `recaps` | SELECT `*` `eq(book_id)` `order(created_at desc)`; uses `progress_snapshot`, `page_snapshot`, `memory_jogger`, `concept_watchlist`, `thematic_bridge` | Client (Master Recap); server under BC-08 | §3.2 |
| `page_captures` | SELECT text by page (D-12 fallback) | Server under BC-08 only | §3.3 |
| `books` | `title`, `author`, `isbn`, `total_pages` (target fallback adds `genre`, `description`) | Client store today; server under BC-08 | §3.1 |
| `reading_progress` / `progress_history` | Written by the triggering save | Client today; `save_progress` under BC-04 | §3.1 |
| `generate-lore` | POST JSON | Client today; server worker under BC-08 | §10.3 |
| Gemini `gemini-2.5-flash` | Outbound AI call | `generate-lore` only | §10.3 |

Row → model mapping: `mapLoreCard` (`src/types/index.ts:728-740`) maps snake_case to camelCase and defaults `linked_entities ?? []`; `type` is typed as the 5-value union although the DB accepts any text.

---

## Client-side logic & server migration

Every client must implement the rules below today. "Moves to" names the work package that takes the rule server-side per D-06; "stays" means it remains client rendering logic.

| # | Rule(s) | Today | Moves to / stays |
|---|---|---|---|
| 1 | Milestone detection: 2-decimal %, buckets, cap 90, collapse-to-latest (INS-02…INS-04) | Client only | **Moves → BC-04 + BC-08** (server, from stored page/total; backfill replaces collapse-to-latest) |
| 2 | Trigger placement: online confirmed saves only; never quiet writes, imports, DNF, sessions, offline replays (INS-07, INS-08, INS-10) | Client | **Moves → BC-04 + BC-08** (every `save_progress`, including offline replays, D-08) |
| 3 | Dedup pre-check; `23505` = already unlocked (INS-11) | Client + unique constraint after the AI cost | **Moves → BC-08** (claim before the AI call, `ON CONFLICT DO NOTHING`) |
| 4 | Master Recap assembly and the recap prerequisite (INS-12, INS-13) | Client (the server trusts any text) | **Moves → BC-08**, with the captures / metadata fallback (D-12) |
| 5 | Request building: book lookup, integer %, `existingTopics` from titles (INS-14…INS-16) | Client | **Moves → BC-08** |
| 6 | Row insert with `unlocked_at_page = saved page`, `seen = false` (INS-18) | Client | **Moves → BC-08**; client INSERT revoked after the PWA migrates (D-05) |
| 7 | Silent failure, no retry (INS-20) | Client | **Moves → BC-08** (server retries and backfill); UI stays silent |
| 8 | Job identity: user read at insert time (INS-58); no per-book serialisation (INS-59) | Client | **Moves → BC-08** (job bound to the saving user, serialised per book) |
| 9 | Banner (INS-17, INS-60) | Client, during the HTTP call | **Stays client**, driven by the pending signal from the save response (INS-Q13) |
| 10 | Local merge, cache touch, quest invalidation (INS-19) | Client | **Stays client** (refresh on foreground or Realtime, BC-14) |
| 11 | Seen marking and chip computation (INS-37…INS-41) | Client | **Stays client** (BC-08: clients mark seen); semantics INS-Q06 |
| 12 | Display: highest milestone first, random cycle, `createdAt` desc in Codex, hidden for DNF (INS-42…INS-49) | Client | **Stays client** |
| 13 | Nudge math (INS-50, INS-51) | Client | **Stays client**; becomes truthful with BC-08 |
| 14 | Upstream recap lock (INS-12a) | Client | No longer gates Insights (D-12); the lock itself moves → BC-07 |
| 15 | `insight_first` achievement (INS-53) | Client, on Trophy Room mount | **Moves → BC-09** |
| 16 | Cache and identity hygiene: purge on book delete and user change (INS-33, INS-55) | Not done | **Stays client** (fix INS-D17/D18); BC-14 for delta sync |

---

## Caching & offline

| Item | Behaviour | Source |
|---|---|---|
| `lore:{uid}:{bookId}` | TTL 120 s. Written by `fetchLoreForBook`, which **replaces** `loreByBook[bookId]` wholesale. `swrTouch`ed after an insert and after mark-seen, and by `fetchLoreForAllBooks` for books that have cards (only when the key already exists — `swrTouch` is a no-op for keys never created) | `src/stores/loreCards.ts:36-57,85,175,206`; `src/composables/useCache.ts:98-101` |
| `lore:{uid}:all` | TTL 120 s. Written by `fetchLoreForAllBooks`, which **merges**: it overwrites `loreByBook[bid]` only for books present in the response, so books with zero cards (e.g. deleted) keep their cached cards | `src/stores/loreCards.ts:60-95` |
| SWR semantics | `loading` (never fetched or failed, `fetchedAt = 0`) → await; `fresh` (≤ TTL) → no network; `background` → serve stale + revalidate. Concurrent runs share one promise. Stale keys with a registered revalidator refetch on `visibilitychange → visible` | `src/composables/useCache.ts:53-92,167-181`; PLT-30 |
| Partial "fresh" trap | `swrStatus` creates an entry with `fetchedAt = 0`; a failed run leaves it at 0. A later `swrTouch(loreAll)` (after an insert or mark-seen) flips that never-loaded key to fresh, so Codex "All Books" can show only the partially loaded cards for up to 120 s with no refetch ⚠ INS-D19 | `src/composables/useCache.ts:53-65,98-101`; `src/stores/loreCards.ts:176,207` |
| `readingQuest:{uid}*` | Prefix-invalidated after a successful insert (XP changed) | `src/stores/loreCards.ts:177` |
| `recaps:{uid}:{bookId}` | TTL 60 s; the Master Recap may use stale rows | `src/stores/recaps.ts:18,28-48` |
| Not invalidated by | Book delete, book edit, progress save, DNF. User change: SWR `clearAll()` only (Pinia state kept) | `src/stores/books.ts:413-435`; `src/stores/auth.ts:89` |
| Browser storage | None: no `localStorage`, IndexedDB or service-worker cache for Insights | — |
| Offline | No generation offline and none on replay (INS-07); reads serve whatever is in memory | `src/stores/progress.ts:656-664` |
| **Target** | BC-08: the server generates on every save, including offline replays (D-08). BC-14: add `lore_cards` to the `supabase_realtime` publication, or refresh on foreground. Clients purge per-book cards on delete and everything on user change | — |

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| INS-D01 | `generate-lore` runs with `verify_jwt: false` and only base64-decodes the JWT; any token with a `sub` passes (INS-23) | Anyone can spend Gemini quota; no per-user limit | **BC-02** (`verify_jwt = true` or `auth.getUser`; commit `config.toml`) + **BC-12** usage check |
| INS-D02 | The owner may INSERT arbitrary rows and UPDATE any column; INSERT does not check `book_id` ownership (INS-32) | Fabricated cards (+15 XP each, "Lorekeeper") up to 9 per book × any known book id; rows on foreign books (enables INS-58) | **BC-01** (ownership check in RLS) + **BC-08** (server-only insert; client may update `seen` only) |
| INS-D03 | The spoiler wall is entirely client-built; the edge function accepts any `masterRecap` | A modified or buggy client can feed spoilers or arbitrary text | **BC-08** (server builds the context) |
| INS-D04 | No Insight without a qualifying mid-book recap; the crossed milestone is consumed forever; the recap lock makes the 10 % card rare (INS-12, INS-12a) | Readers who never press "Get Recap" never get Insights, while the hero promises them | **BC-08** (D-12 captures / metadata fallback + backfill) |
| INS-D05 | Multi-bucket jumps generate only the latest milestone; the others are never generated (INS-04) | Missing cards on short books and big jumps | **BC-08** backfill (INS-Q01) |
| INS-D06 | Milestones crossed offline are never generated (INS-07) | Missing cards for offline readers | **BC-04 + BC-08** (replays through `save_progress`, D-08) |
| INS-D07 | Failures are silent and never retried; a result paid for is lost on tab close, backgrounding or sign-out (INS-20, F1) | Lost cards and wasted AI spend | **BC-08** (server finishes and saves; retry policy INS-Q03) |
| INS-D08 | The dedup pre-check can read a stale cache; duplicates across devices/tabs pay for the AI call and then fail with `23505` (INS-11) | Wasted AI spend | **BC-08** (claim before the AI call; `ON CONFLICT DO NOTHING`) |
| INS-D09 | Concurrent generations for one book run in parallel: topics can repeat and the banner hides when the first finishes (INS-59) | Duplicate topics; misleading banner | **BC-08** per-book serialisation; native per-book actor until then |
| INS-D10 | Identity read at INSERT time; in-flight jobs are not cancelled on sign-out; the banner stays over `/login` (INS-58, INS-60) | A card inserted for the new user on the previous user's book (+15 XP, visible in Codex) | **BC-08 + BC-01**; clients bind the job to the starting user and cancel on sign-out |
| INS-D11 | After a `total_pages` edit the stale cached `prevPct` can make a forward save look backward (INS-02) | A milestone (e.g. 40 %) is silently lost | **BC-04 + BC-08** (server detection from stored page/total); clients derive % at use time |
| INS-D12 | Repo `generate-lore` ≠ deployed v18 (prompt, temperature 0.85 vs 0.35, thinking, Romance line) (INS-26, INS-27) | Deploying from the repo would silently revert product behaviour | **BC-03** (sync repo to deployed, D-09) |
| INS-D13 | Deployed `thinkingBudget` / `includeThoughts` sit at the `config` root instead of `thinkingConfig` (INS-26) | Intended 1 000-token budget likely ignored; thinking shares the 4 096-token budget; unknown `MAX_TOKENS` failure rate | **BC-03** (move into `thinkingConfig`; recommended `includeThoughts: false`); log `usageMetadata.thoughtsTokenCount` |
| INS-D14 | Local migration `20260417_lore_cards.sql` creates a `type` CHECK (`History`, `Myth`, `Geography`) that is absent live (INS-31) | A migration replay would reject live `Lore` / `Culture` rows | **BC-03** (baseline migration from the live snapshot) |
| INS-D15 | Input/output hardening: no body-size limit on `masterRecap` / `existingTopics`, no rate limit, CORS `*`, unescaped prompt interpolation, shallow validation (non-array `existingTopics` → 500, numeric types unchecked), `detail` leaks exception text, unpinned `npm:@google/genai` (INS-24, INS-27, INS-30) | Cost abuse; confusing errors; non-reproducible deploys | **BC-02** (no internal text), **BC-12** (usage ledger), **BC-03** (pin the SDK); validate types and sizes in the BC-08 contract |
| INS-D16 | Default grants give `anon` and `authenticated` full DML on `lore_cards`; policies use per-row `auth.uid()` (advisor `auth_rls_initplan`); `book_id` FK is not the leading column of any index | Weaker defence in depth; slower cascade deletes | **BC-01** |
| INS-D17 | Sign-out / account switch keeps `loreByBook` and `generatingBookIds` (INS-55) | The previous user's cards appear in Codex "All Books" on a shared device | Reset the lore store on every user change |
| INS-D18 | Book delete does not purge `loreByBook[id]` or the lore keys; the all-books merge never removes keys (INS-33) | A deleted book's cards stay in Codex "All Books" for the session | Purge the book's cards and invalidate `lore:*` on delete |
| INS-D19 | `swrTouch` on a never-loaded `lore:{uid}:all` key marks partial data fresh (Caching table) | Codex "All Books" can show only some cards for up to 120 s | Only touch keys with `fetchedAt > 0`, or invalidate instead |
| INS-D20 | Book Detail Insights card: no try/catch on mount (INS-44) | Permanent skeleton and an unhandled rejection on a fetch error | Catch and fall back to the empty/error state |
| INS-D21 | Codex Insights list has no error state (INS-49) | A fetch error reads as "Keep reading to unlock your first lore card" | Add an error state with retry |
| INS-D22 | Mark seen depends on the local cache and on an unguarded mount chain; it also fires for DNF books and unexpanded cards (INS-40) | Chips survive visits, or clear without the reader seeing the card | Await the lore fetch first; isolate each mount step; semantics INS-Q06 |
| INS-D23 | A card that arrives while the reader is on Book Detail stays unseen (INS-41) | "New Lore" chip for a card the reader watched arrive | Mark seen on arrival when the card is visible (INS-Q06) |
| INS-D24 | The new-card watcher jumps to the highest milestone, not to the new card (INS-43) | With backfill, the reader is shown an older card instead of the new one | Select the newly arrived card (by id or newest `created_at`) |
| INS-D25 | The nudge ignores the recap prerequisite and existing cards, and uses unrounded % while detection rounds (INS-50, INS-51) | Promises an Insight that never comes; off-by-one page at rounding edges | **BC-08** fallback makes it truthful; suppress when the next milestone already has a card |
| INS-D26 | `linked_entities` sliced to 5 before trimming and empty-filtering (INS-29) | Fewer than 5 mentions even when more valid names existed | Trim and filter first, then slice (edge fix within BC-03 sync) |
| INS-D27 | The "New Lore" chip is missing from the Library grid view (`LibraryGridView` / `ReadingWideCard`) (INS-38) | Unseen Insights invisible in the default grid layout | Add the chip to grid cards |
| INS-D28 | `?bookId=` pre-filters only the Insights tab while opening the Lexicon tab unfiltered; the two filters are independent (contradicts spec 007 FR-014) (INS-46) | Deep links appear to do nothing; hidden pre-filter on the other tab | One shared book filter seeded from `?bookId` (INS-Q08); LEX-51 in [05 · Codex & Lexicon](05-codex-lexicon.md) |
| INS-D29 | Accessibility: banner pulse ignores `prefers-reduced-motion`; the glass toast hides the banner; the Book Detail header is not focusable; the cycle tooltip uses `title` (invisible on touch); type is conveyed by colour (INS-43, INS-44, INS-60) | Motion and keyboard / touch accessibility gaps | Reduced-motion override; focusable header; visible cycle label; text type label |
| INS-D30 | Display: newlines collapse (no `pre-wrap`); duplicate entity names give duplicate Vue keys; unknown types get no colour (INS-48) | Minor rendering glitches | `white-space: pre-wrap`; key by index; neutral style for unknown types |
| INS-D31 | Naming drift: user copy still says "lore" ("New Lore", "Chronicler is weaving new lore", "Keep reading to unlock your first lore card", aria "Lore Chronoscope…") while the tab, achievement and nudge say "Insight(s)"; Codex quote badges say "Lore"; level 3 is "Lore Keeper" while the achievement is "Lorekeeper" | Confusing vocabulary across clients | Decide in INS-Q05; quote badge rename belongs to LEX |
| INS-D32 | Dead code and stale comments: `randomLoreForBook`, `isGeneratingForBook`, the compact non-collapsible mode of `LoreChronoscopeCard` (the only `?tab=lore` link), the "dashboard inline lore card" comment (`loreCards.ts:179-180`) | Misleading code | Remove; keep a `?tab=lore` deep link only if the product wants one |

---

## Open decisions

D-01…D-17 have resolved these former questions; they appear as Target lines instead and are not repeated here: which `generate-lore` is canonical (D-09), Insights without recaps and the recap-lock coupling (D-12), lost / skipped / offline milestones (D-12), server-side orchestration and server-only inserts (D-06 · BC-08), edge-function auth (BC-02), RLS book-ownership hardening (BC-01), monetisation gating (D-14 · BC-12), realtime vs foreground refresh (BC-14), background completion of paid AI work (BC-08), and account deletion (D-10).

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| INS-Q01 | **Backfill policy** under D-12: generation order, how many per save, the context window of a backfilled card, and which milestones are eligible (books added mid-way or imported; the completing save) | Only the latest crossed milestone is attempted; nothing is backfilled except by rewinding (INS-04, INS-05) | Generate the newest due milestone first, then missing lower ones oldest-first, one in flight per book, at most 3 AI calls per book per save (the rest on later saves or by a sweeper). Context window for a backfilled card = sources up to that milestone's page when available, else up to the current page. `unlocked_at_page` keeps today's meaning (the page saved). Only milestones above the book's starting page (BC-04 baseline row) are eligible; the completing save backfills like any other |
| INS-Q02 | **Fallback context** under D-12: which captures and which metadata, the spoiler guard for each, completion-purge timing, and whether the source is stored or shown | Recap only (INS-12) | Captures: the newest ≤ 5 captures with `page ≤ window page`, capped at ~8 000 characters; on a completing save, snapshot capture text before the purge (INS-06). Metadata: `title`, `author`, `genre`, `description`, with a prompt variant limited to the premise and setting stated in the description and the opening of the book. Store the source in a nullable `lore_cards` column (`recap` / `captures` / `metadata`, additive per D-05) and show a subtle "Based on book info" label on metadata cards |
| INS-Q03 | **Retry policy** for failed generations | None (INS-20) | A job ledger (status, attempts, last error, next attempt). Retry transient failures up to 3 times with backoff on later saves or a sweeper; after a safety block or invalid output, try the next fallback source once, then mark it permanently failed. Never surface errors to the reader |
| INS-Q04 | **XP for backfilled and fallback cards**: keep +15 XP for every card? | +15 per row, whatever the source | Keep +15 for every card (simple; matches existing rows); the INS-Q01 cap limits bursts. Book-source XP scoping and delete clawback stay with the PRO domain |
| INS-Q05 | **Naming**: "Insights" everywhere in user copy, or keep "Lore"? What do iOS and Android ship? | Mixed (INS-D31) | "Insight(s)" in all user copy ("New Insight", "The Chronicler is uncovering a new Insight", "Keep reading to unlock your first Insight"); keep internal names; rename the Codex quote badge to "Quote" (LEX) |
| INS-Q06 | **Seen semantics**: on opening Book Detail, on expanding or displaying the card, and/or on viewing in the Codex? Per card or per book? DNF visits? A card arriving while visible? | Per book, on Book Detail open, including DNF and unexpanded (INS-40, INS-41) | Per card: mark seen when the card's body is displayed (Book Detail panel expanded, or a Codex row expanded), including a card that arrives while displayed; DNF visits do not clear it (the card is hidden) |
| INS-Q07 | **Arrival feedback**: toast, haptic, Codex tab badge, local notification, push? | Chips and the banner only; the success toast was removed in spec 010 | In-app: a brief toast ("New Insight unlocked") + a Codex tab badge with the unseen count. Push "Insight unlocked" later via `device_tokens` (BC-14), opt-in |
| INS-Q08 | **Codex Insights tab**: show the book title, group by book, type filter, search; which books in the filter; one filter shared with the Lexicon tab? | Flat list newest first, no book title, filter lists every book, independent filters (INS-45…INS-47) | Show the book title per row in "All Books"; keep newest first; list only books with ≥ 1 card in the filter; share one book filter across both tabs, seeded from `?bookId` (spec FR-014) |
| INS-Q09 | **Book Detail card**: initial card (highest milestone, newest, random), and an empty placeholder? | Highest milestone first; nothing shown when empty (INS-43, INS-44) | Newest-created card first (equals the highest milestone except after backfill); when empty, show a quiet placeholder "Your first Insight unlocks at {next}%"; keep it hidden for DNF |
| INS-Q10 | **Content controls**: report, hide, delete or regenerate an Insight (AI quality, spoilers)? AI-generated label? | None; RLS allows owner UPDATE/DELETE but there is no UI | Add "Report / hide" per card (hidden flag, additive column; hiding keeps XP, deleting would lower it) and an "AI-generated" label; no regenerate in v1. Use reports to monitor the v18 canon-prompt spoiler risk (INS-27) |
| INS-Q11 | **Type taxonomy**: lock the 5 types with a DB CHECK? Is "Lore" (56 % of rows) a useful category, and "Technology" (0 rows)? | Edge-validated only; no CHECK (INS-31) | Add `CHECK (type IN ('History','Culture','Geography','Technology','Lore'))` (all live rows comply; backward compatible). Revisit the taxonomy only with product data; clients decode unknown values with a fallback |
| INS-Q12 | **Edits and re-reads**: recompute or regenerate cards after a `total_pages`, title or author edit? Generate for books whose page count is an estimate? Re-read flow? | Cards are frozen; placeholder page counts are used as-is (INS-35, INS-36) | Keep cards frozen; skip generation while `books.page_count_estimated = true` (imported 100-page placeholders); no re-read or reset in v1 |
| INS-Q13 | **Pending signal**: how do clients learn that a server-side generation started and finished (banner, refresh)? | The banner covers the client-held HTTP call (INS-17) | `save_progress` returns the pending milestones; clients show the banner until the card appears (bounded polling ≤ 60 s, refresh on foreground, Realtime once `lore_cards` is published under BC-14) |

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

- **Build against the decided target.** If BC-04 and BC-08 ship before the native build, a native client calls `save_progress` and only lists cards, renders chips, the banner and the nudge, and marks seen. It does not port detection, the Master Recap, `generate-lore` calls or the insert. Until then, replicate INS-02…INS-21 exactly and keep both clients on the same rules (D-05) — a looser recap lock (INS-12a) or different rounding would silently produce more or fewer Insights than the PWA.
- **Milestone math must be bit-exact** (legacy path): `pct = (Double(page) / Double(total) × 10000).rounded(.toNearestOrAwayFromZero) / 100`; previous % from the last confirmed server value; `floor(pct/10)×10` buckets; cap 90; collapse to latest. Request `percentage = Int((page/total × 100).rounded())`. Port the test tables from `tests/unit/milestoneDetect.spec.ts`, `milestoneNudge.spec.ts` and `masterRecap.spec.ts`. Always derive % from `(current_page, total_pages)` at use time (INS-D11).
- **Master Recap** (legacy path): replicate INS-13 byte-for-byte — filter, stable sort by `pageSnapshot ?? 0` with ties in `created_at desc`, the three labels and the `\n\n---\n\n` separator.
- **Job hygiene** (legacy path): serialise per book and de-duplicate in-flight `(bookId, milestone)`; capture the user id at the start and abort the insert if the signed-in user changed; cancel per-book jobs on book delete and all jobs on sign-out; treat `23505` as "already unlocked"; keep failures silent in the UI (log only); use a request timeout ≥ 60 s.
- **Networking:** send `Authorization: Bearer <access token>` **and** the `apikey` header. The function returns hard errors only (INS-28…INS-30); map them to telemetry, not UI.
- **Model:** decode `type` as a string-backed enum with an unknown fallback (no DB CHECK; legacy migrations allowed "Myth"); `linked_entities` defaults to `[]`; `created_at` is ISO-8601 with fractional seconds. Render `content` as plain text (no Markdown parsing; AI text may contain `*` or `_`). Newlines will show natively although the web collapses them.
- **Caching:** 120 s staleness plus refresh on app foreground (web visibility revalidation). Purge a book's cards on delete and **all** cards on sign-out (fixes INS-D17/D18).
- **Seen:** mark seen only after the lore fetch completes (fixes the INS-D22 race); follow INS-Q06 once decided.
- **UI parity:** "New Lore" chip rules (INS-38), highest-milestone-first Book Detail card with random cycling (INS-43), `createdAt` desc in the Codex (INS-45), hidden for DNF (INS-44), nudge threshold 15 with "finish wins" (INS-51). Show the book title per row in "All Books" (INS-Q08 recommendation).
- **Gamification:** XP and "Lorekeeper" come from `get_reading_quest_summary`; invalidate the quest cache after a new card appears. Do not evaluate achievements locally once BC-09 ships.
- **Entitlements:** do not hard-code any Insight quota or tier; gating is server-side and the tiers are undecided (D-14 · BC-12).
- **Do not lose in translation:** no card at 100 %; one card per milestone; the spoiler wall `page_snapshot ≤ current page`; `existingTopics` from titles; `unlocked_at_page` = the saved page; silent failures; DNF hides the Book Detail card.

### iOS-specific (iOS 26+, iPhone first — D-04)

- **Book Detail card:** a `DisclosureGroup` (collapsed by default) with a cycle `Button` (`arrow.triangle.2.circlepath`) when there is more than one card. **Codex tab:** a `List` with a book `Picker` and `DisclosureGroup` rows. Content in `Text` with Dynamic Type; `.textSelection(.enabled)`.
- **Banner:** a non-interactive top capsule (`.overlay` or `safeAreaInset(edge: .top)`) using native Liquid Glass (`.glassEffect`, grouped with other floating controls in a `GlassEffectContainer`); no pre-iOS-26 fallback. Respect Reduce Transparency and Increase Contrast, and turn the pulse off under Reduce Motion (fixes INS-D29). Post `AccessibilityNotification.Announcement("Generating a new Insight for {title}")`.
- **Accessibility:** the type badge needs a text label for VoiceOver ("Type: Geography"), not colour alone; the cycle button's label says "Show another Insight, {i} of {n}".
- **Arrival:** `.sensoryFeedback(.success, trigger:)` on a new card; `.badge(unseenCount)` on the Codex tab (INS-Q07). Remote push needs BC-08 + `device_tokens` (BC-14).
- **Legacy path only:** wrap the edge call and insert in `beginBackgroundTask` — readers often end a session and immediately background the app, which loses the card on the PWA. Under BC-08 this is unnecessary.
- **App Store:** Guideline 5.1.2(i) — disclose that book metadata, recap text, and (with D-12) page-capture text are sent to Google Gemini, and obtain consent before the first AI feature; list Google in the App Privacy details. Label Insights as AI-generated and offer "Report / hide" (generative-content moderation; INS-Q10). Guideline 5.1.1(v) — in-app account deletion through `delete-account` (D-10); the `lore_cards` FK cascade already covers Insights. Do not ship publicly before BC-02 closes INS-D01.
