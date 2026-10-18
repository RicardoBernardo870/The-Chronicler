# 07 · Profile, Reading Quest, Goals, Achievements, Stats & Reading DNA — Business Rules
> **Prefix:** PRO · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-19 (BC-01 and BC-02 shipped)

## Overview

This area covers what the reader sees about themselves:

- the **Profile** tab: identity header (avatar inside the yearly-goal ring, level badge, name, level title, goal caption), Reading DNA strip, DNA recommendations, stat pills, Trophy Room and Stats entry cards, Recap memories;
- **XP and reader levels**, and the yearly **Reading Quest** (goal, pace, status);
- the **weekly goal**, which exists only in the backend (dormant);
- **Reading Stats**: monthly chart, calendar, lifetime grid, personal records, book lengths, library breakdown, and every stats RPC formula behind them;
- the 17 **achievements** on the Trophy Room wall, and their ledger;
- **Reading DNA** (AI reader personality) and its book recommendations;
- **profile customization**: username, display name and avatar (the web also has bio, a public toggle and privacy settings), plus the dashboard greeting identity.

The follow graph, discovery, circles and the public profile are dormant backend features owned by [10 · Community & Circles](10-community-circles.md). iOS v1 builds only username, display name and avatar (D-13).

Terms used in this file (full glossary in the [README](README.md)):

| Term | Meaning here |
|---|---|
| Manual book | `books.source` is NULL or `'manual'` (added through search or the manual form). |
| Imported book | `books.source` is `'goodreads'` or `'storygraph'` (CSV import, [01 · Library](01-library.md)). `source` never changes after insert. |
| History row | A `progress_history` row. Today every online page save writes one ([02 · Reading Sessions](02-reading-sessions.md)). |
| Timed row / untimed row | A history row with / without `session_start_at` (session end vs pencil correction). |
| Meaningful session | A timed row with duration ≥ 60 s and page delta ≥ 1 ("valid session" in [02](02-reading-sessions.md)). |
| Page delta | Pages credited to one history row (PRO-21). |
| Reader zone | The reader's IANA time zone. Today the web client sends it only to three of this domain's RPCs (calendar, monthly, records) and to the passport stats RPC; under BC-06 it is stored server-side. |
| Quest | The yearly book-count goal and its pace (`get_reading_quest_summary.quest`). |
| Ledger | The insert-only `achievements` table. |

### Screens and entry points

| Web route (name) / surface | Purpose in this domain |
|---|---|
| `/profile` (`profile`) | Profile hub. Bottom nav "Profile" and the dashboard greeting avatar lead here. It shows the identity header, the DNA strip with its bottom sheet, "Your DNA suggests", the stat pills (Books / Pages / Hours / Streak, all → Stats), the entry cards "Trophy room — Quest goal and level" and "Stats — Charts, calendar, records", and "Recap memories". |
| `/profile/trophy-room` (`trophy-room`) | Quest hero ring with pace row, the goal set/edit dialog, the reader level strip and the 17-badge achievements wall. Mounting it runs the achievement sync. |
| `/profile/stats` (`profile-stats`) | Reading Stats, in this order: monthly chart (heading = year number), reading calendar, lifetime grid (7 tiles), personal records, book lengths, library breakdown. |
| `/profile/edit` (`profile-edit`) | Create or edit the reader profile: avatar, username with live availability, display name, bio, public toggle, 4 privacy selects. |
| Dashboard greeting | Salutation, reader name and avatar, or the "Set up your reader profile" CTA → `/profile/edit`. |
| Goal dialog | "Set yearly goal" / "Edit yearly goal" (Trophy Room). |
| DNA bottom sheet | "Your Reading DNA": tone, emojis and the full personality text. |
| — | Weekly goal: no client surface (PRO-36, PRO-103). |

### Owning backend objects

Names only. Shapes, grants and RLS live in [backend-contract](../backend-contract.md): §3 Tables, §5 Row-level security, §7 Storage, §8 RPC catalogue, §9 Triggers, §10 Edge functions.

- **Tables:** `reading_goals`, `reading_quest_events` (trigger-written), `achievements`, `reading_dna`, `user_settings` (dormant), `community_profiles`, `community_profile_privacy`, `community_follow_counts` (trigger-created). Read-only here: `books`, `reading_progress`, `progress_history`, `recaps`, `lore_cards`, `page_captures`.
- **RPCs:** `get_reading_quest_summary`, `get_reading_stats`, `get_library_breakdown`, `get_reading_calendar`, `get_monthly_reading`, `get_reading_records`, `get_library_with_progress` (first call on Profile and Stats), `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available`. Dormant: `upsert_weekly_goal`, `get_retention_summary`, `get_public_profile_by_username`.
- **Triggers:** `page_capture_quest_event_after_save` → `record_page_capture_quest_event()`; `set_reading_goals_updated_at`; `community_ensure_count_on_profile_insert`; `community_profiles_touch_updated_at`; `community_profile_privacy_touch_updated_at`. Relevant elsewhere: `reading_progress_updated_at` (moves the quest year, PRO-10).
- **Edge function:** `generate-reading-dna` (deployed v8 is canonical, D-09).
- **Storage:** `community-avatars` (public), `recap-images` (private, read-only here).
- **External (client-side):** Google Books volumes search and Open Library `search.json` plus the covers CDN, for DNA recommendation covers.
- **Planned (Phase 0, [backend-consolidation-plan](../backend-consolidation-plan.md)):**
  - `p_timezone` on every stats RPC, plus a stored reader zone (BC-06);
  - `reading_progress.completed_at` and the `save_progress` history semantics (BC-04);
  - a server-owned completion pipeline covering achievements and DNA eligibility (BC-05);
  - a server achievement catalog and evaluation (BC-09);
  - owner checks and revoked anon grants (BC-01);
  - edge-function auth (BC-02), repo/deployed sync (BC-03), AI-usage checks (BC-12), account deletion (BC-11).

### What Phase 0 changes in this domain (summary of Target lines)

| Decision | Effect here |
|---|---|
| D-07 · BC-06 | Quest year, streak days, "this week/month", sessions this month, calendar, monthly chart and records all use the reader's IANA zone. The zone is stored server-side for jobs (BC-05/BC-09 evaluation). |
| D-08 · BC-04 | Only forward page changes count for pages, streak days and charts, and offline saves replay at their original time. Session XP, `sessions_50/100`, `sessionsThisMonth` and the session records (longest session, night owl) need a real timed session on the server clock. A baseline row (recommended) removes the first-row over-count. |
| D-06 · BC-04 | "Finished this year" uses the new first-completion timestamp `reading_progress.completed_at`, not `updated_at`. |
| D-06 · BC-09 | The achievement catalog and evaluation move into SQL/RPC. `earned_at` becomes server-authoritative. Clients render. |
| D-06 · BC-05 | Completion evaluates achievements and DNA eligibility server-side, whatever the client or path. |
| D-09 · BC-03 | `generate-reading-dna` v8 (Gemini 2.5 Flash + Google Search grounding, `thinkingBudget: 1`) is canonical; the repo source is synced to it. |
| BC-01 | NULL-safe guard in `get_reading_quest_summary`; owner checks in `get_library_breakdown` and `get_library_with_progress`; anon/PUBLIC `EXECUTE` revoked; duplicate `reading_goals` index dropped. |
| D-13 | iOS v1 profile = username + display name + avatar. Bio, public toggle and privacy stay web-only, and iOS must preserve them on save (PRO-104). |
| D-10 · BC-11 | Account deletion removes every profile-domain row by cascade, and the avatar folder through Storage (PRO-105). |
| D-03 | User-facing copy says "The Chronicler", never "BookHero" (PRO-106). |

## Rules

### XP, levels and the Reading Quest

#### PRO-01 · XP formula
`totalXp = pagesRead×1 + completedBooks×25 + readingSessions×10 + pageCaptures×5 + recapsGenerated×20 + loreCardsUnlocked×15`. It is an integer, lifetime (not per year), and is recomputed on every call. Nothing stores it.
- **Enforced:** `server:rpc` (`get_reading_quest_summary`, CTE `xp`).
- **Source:** live `get_reading_quest_summary` (`supabase/reference/live-baseline-2026-10-18.sql`); same weights in `supabase/migrations/20260512_reading_quest_goal.sql:165-169`.
- **Target:** the formula stays server-side. Only the `readingSessions` input changes (PRO-04, D-08 · BC-04).
- **Note:** every input below is recomputed from current rows, so XP can **drop** when rows disappear (PRO-06, PRO-93).

#### PRO-02 · pagesRead is state-based and counts manual books only
`pagesRead = Σ clamp(reading_progress.current_page, 0, max(total_pages, 0))` over the user's manual books. Books with no progress row count 0. In-progress, completed **and DNF-shelved** books all count; there is no `dnf_at` filter.
- **Enforced:** `server:rpc` (`get_reading_quest_summary` CTEs `progress_rows`, `base_counts`).
- **Source:** live function body.
- **Note:** a manual book added "in progress at page P" or "already finished" credits P (or `total_pages`) XP pages at once, with no reading in the app. Imports never count, even after they are read in-app (PRO-97). Policy: PRO-Q02.

#### PRO-03 · completedBooks (XP and achievements) is lifetime, manual only
`completedBooks` = count of manual books with `total_pages > 0 AND current_page ≥ total_pages`, all time. Imported books never count.
- **Enforced:** `server:rpc` (`base_counts.completed_books_all`).
- **Source:** live function body.
- **Note:** this is one of five "books finished" definitions (⚠ PRO-D33, PRO-Q01).

#### PRO-04 · readingSessions counts every history row
`readingSessions = count(*)` of **all** the user's `progress_history` rows. Every page save is worth 10 XP and counts toward `sessions_50/100`: timed or untimed, backward corrections and zero-delta saves included, organic saves on imported books too (no `source` filter). This differs from the "meaningful session" used by `sessionsThisMonth` (PRO-22).
- **Enforced:** `server:rpc` (`activity_counts.reading_sessions`).
- **Source:** live function body; history write `src/stores/progress.ts:562-583`.
- **Target:** only rows that end a real timed session earn session XP and count toward `sessions_50/100`. Untimed forward changes earn page credit only. `save_progress` writes the history row atomically with the page, on the server clock, with an idempotency key, so a save can neither lose nor duplicate its row (D-08 · BC-04). Threshold for "real": PRO-Q19.
- **Note:** today the history insert runs separately, after the `reading_progress` upsert succeeds, inside a "non-critical" `try/catch`. If it fails, the page and the completion still count, but the save earns no session XP and is invisible to streaks, calendar, monthly chart, records and `sessionsThisMonth` ⚠ PRO-D28.

#### PRO-05 · pageCaptures counts unique captured pages, and survives deletions
`pageCaptures` = count of `reading_quest_events` rows with `event_type = 'page_capture'`. The partial unique index `reading_quest_events_page_capture_unique_idx` on `(user_id, book_id, page)` (where `book_id` and `page` are not null) allows one row per page, so re-capturing a page adds no XP. Trigger `page_capture_quest_event_after_save` (AFTER INSERT OR UPDATE on `page_captures`) inserts or merges the row via `record_page_capture_quest_event()`. On conflict it keeps the first `source_id` and the earliest `occurred_at`.
- **Enforced:** `server:db` (trigger, partial unique index, `reading_quest_events_event_type_check` = `'page_capture'` only, `reading_quest_events_page_check` NULL or ≥ 0, RLS owner SELECT only).
- **Source:** live `record_page_capture_quest_event()`, `pg_trigger`, `pg_indexes`.
- **Note:**
  - Events survive the completion purge of captures, and book deletion (`reading_quest_events_book_id_fkey ON DELETE SET NULL`). Capture XP never regresses.
  - The trigger also fires on every UPDATE of a capture, including resume writes. If an update changes `page`, a new `(user, book, page)` event is inserted (+5 XP).
  - **The same function deletes every `page_captures` row of the book when the book is already complete** (`total_pages > 0 AND current_page ≥ total_pages`), in the same statement. A capture saved on a finished book therefore still earns +5 XP and counts toward `capture_first`/`captures_50`, while the capture itself vanishes ⚠ PRO-D27. This supersedes the older claim that such captures "survive the completion cleanup".

#### PRO-06 · recapsGenerated and loreCardsUnlocked are plain row counts
They are `count(*)` of the user's `recaps` and `lore_cards` rows: any mode or status, imported-book rows included. Both cascade-delete with their book (`recaps_book_id_fkey`, `lore_cards_book_id_fkey ON DELETE CASCADE`), so XP drops when a book is deleted.
- **Enforced:** `server:rpc` (`activity_counts`).
- **Source:** live function body; live FKs.
- **Target:** after BC-07 and BC-08 the server writes these rows. The XP terms are unchanged.
- **Note:** recap blurbs count too ([03 · Recaps](03-recaps.md)). XP-on-delete policy: LIB-Q15 / PRO-Q18.

#### PRO-07 · Level thresholds and titles (0-based)
| Level | XP floor | Title |
|---|---|---|
| 0 | 0 | Page Turner |
| 1 | 1 500 | Chapter Seeker |
| 2 | 4 000 | Margin Walker |
| 3 | 8 000 | Lore Keeper |
| 4 | 14 000 | Archive Runner |
| 5 | 22 000 | Chapter Sage |
| 6 | 34 000 | Library Legend (max) |

A new reader is "Lv 0" / "Level 0".
- **Enforced:** `server:rpc` (`level_calc`); `client` mirror (`src/stores/readingQuest.ts:22-31`).
- **Source:** as cited.
- **Note:** display policy: PRO-Q04.

#### PRO-08 · Level progress fields
| Field | Value |
|---|---|
| `currentLevelXp` | `totalXp − floor` |
| `nextLevelXp` | `next − floor`, i.e. the **span** of the current level (0 at max) |
| `xpToNextLevel` | `max(next − totalXp, 0)` (0 at max) |
| `progressPercent` | `round((totalXp − floor)/(next − floor) × 100, 1)`; 100 at max |

The web client recomputes the same values from `totalXp` (`computeLevel`, which floors and clamps negatives to 0) and replaces the server `level` object (`mapQuestResponse`).
- **Enforced:** `server:rpc`; `client` (duplicate).
- **Source:** live `level_calc`; `src/stores/readingQuest.ts:65-103`.
- **Note:** a native client can trust the RPC and skip the mirror.

#### PRO-09 · The quest year is a UTC window, and membership is decided by updated_at
The window for year Y is `[make_timestamptz(Y,1,1,'UTC'), make_timestamptz(Y+1,1,1,'UTC'))`. A book counts toward Y iff it is completed (PRO-03 predicate) **and** its `reading_progress.updated_at` falls in that UTC window. The history-based first-finish date plays no part. The web client always requests `p_year = new Date().getFullYear()` (device-local year).
- **Enforced:** `server:rpc` (`base_counts.completed_books_year`); `client` (year choice, `src/stores/readingQuest.ts:111`).
- **Source:** live function body.
- **Target:** the window is `[Jan 1 00:00, next Jan 1 00:00)` in the reader's stored IANA zone (D-07 · BC-06). Membership is `reading_progress.completed_at` (first completion) inside that window, so later writes no longer move a book between years (D-06 · BC-04). The PWA keeps sending `p_year` (D-05). Backfill of `completed_at` for past completions: PRO-Q10.
- **Note:** New-Year boundary ⚠ PRO-D31.
  - Reader at UTC−5 finishing at 21:00 local on Dec 31: `updated_at` is Jan 1 UTC, so the book counts toward **next** year, while the dialog still says "Books to read in {local year}".
  - Reader at UTC+X in the first local hours of Jan 1: the client already requests the new year (and its goal row), but `now()` is still before the UTC `year_start`, so `elapsed = 1`, and a book finished in those hours counts toward the **previous** year.

#### PRO-10 · Any later write moves a completed book's quest year
Trigger `reading_progress_updated_at` (`set_updated_at`, BEFORE UPDATE only, no column filter) bumps `updated_at` on **every** update of the row. On INSERT the column default `now()` applies, and the client never sends `updated_at`. So any later write to a completed book's progress row moves it into the current UTC year. Realistic paths: a page re-save or correction through the page editor (`updateProgress` → upsert), or an offline-queue replay. DNF is not offered on complete books (`BookProgressPanel.vue:182`), and `startSession` refuses them (`progress.ts:277-279`).
- **Enforced:** `server:db` (`reading_progress_updated_at`).
- **Source:** live `pg_trigger`; `src/stores/progress.ts:57-62`.
- **Target:** obsolete for the quest once membership uses `completed_at` (BC-04). See also SES-06 / SES-Q15 in [02](02-reading-sessions.md).

#### PRO-11 · Months elapsed
`elapsed = 1` if `now() < year_start`. Otherwise `elapsed = clamp((least(now(), next_year) − year_start) / 2 629 800 s, 1, 12)`, where 2 629 800 s = 30.4375 days. Past years give 12, future years 1, and January floors at 1.
- **Enforced:** `server:rpc` (CTE `months`).
- **Source:** live function body.
- **Target:** measured against the reader-zone year bounds (D-07 · BC-06).

#### PRO-12 · Pace metrics
| Field | Formula | Null when |
|---|---|---|
| `requiredBooksPerMonth` | `round(target/12, 1)`, a constant that ignores elapsed time and books already read | no goal |
| `currentBooksPerMonth` | `round(completedYear/elapsed, 1)` | `completedYear = 0` |
| `projectedBooks` | `round(completedYear/elapsed × 12, 1)` | `completedYear = 0` |
| `hasProjection` | `projectedBooks IS NOT NULL` | — |

- **Enforced:** `server:rpc` (CTE `quest_base`).
- **Source:** live function body.
- **Note:** `projectedBooks` is fractional (e.g. `14.4`) and is shown raw as "Forecast". `completedBooks` is not capped at the target. Policy for "pace needed": PRO-Q03.

#### PRO-13 · Quest progress percent
`progressPercent = 0` with no goal, else `least(100, round(completedYear/target × 100, 1))`.
- **Enforced:** `server:rpc` (CTE `quest`).
- **Source:** live function body.

#### PRO-14 · Quest status (ordered, first match wins)
1. no goal → `no_goal`
2. `completedYear ≥ target` → `complete`
3. `projectedBooks IS NULL` → `no_projection`
4. `projected ≥ 1.1 × target` → `ahead`
5. `projected ≥ target` → `on_track`
6. `projected ≥ 0.75 × target` → `behind`
7. otherwise → `comeback`

Server and client are identical. The web client **overwrites** the server status and label with its own computation (`classifyQuestStatus`).
- **Enforced:** `server:rpc` (CTE `quest`); `client` (`src/stores/readingQuest.ts:50-63,92-103`).
- **Source:** as cited.

#### PRO-15 · Status labels (exact copy)
`no_goal` "Set your reading quest" · `no_projection` "Pace warming up" · `ahead` "Ahead of pace" · `on_track` "On track" · `behind` "A little behind" · `comeback` "Comeback arc available" · `complete` "Quest complete".
- **Enforced:** `server:rpc` (CTE `status_labels`; its `else 'On track'` branch is unreachable); `client` (`src/stores/readingQuest.ts:33-41`).
- **Source:** as cited.

#### PRO-16 · Status tag severity (client)
`no_goal` → secondary, `no_projection` → info, `ahead`/`on_track`/`complete` → success, `behind` → warn, `comeback` → info.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/QuestGoalHero.vue:30-38`.

#### PRO-17 · Quest RPC authorization is NULL-unsafe
Since 2026-10-19 (BC-01) `get_reading_quest_summary` raises `not_allowed` (`42501` → HTTP 403, or 401 for `anon`) when `auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()`, and `EXECUTE` is granted to `authenticated` only. The parameter is kept for PWA compatibility. Before BC-01 the guard raised `'Not allowed'` (P0001) only when `p_user_id <> auth.uid()` was TRUE, and PUBLIC/`anon` held `EXECUTE`, so an unauthenticated caller could read any user's quest (PRO-D01, fixed).
- **Enforced:** `server:rpc` (guard); `server:db` (grants).
- **Source:** migration `20261018120000_bc01_security_hardening.sql` (§2, §5).

#### PRO-106 · Quest hero render states and copy (Trophy Room)
The hero picks the first matching state:
1. loading with no summary → skeleton;
2. `error` set → a warn message with the raw error text, **even when a summary is present** (⚠ PRO-D18);
3. summary but no goal → empty CTA "Choose a calm yearly target and BookHero will track your pace as you read." + button "Set yearly goal";
4. summary with goal → status tag + pencil, the ring, "{completed}/{target}" with "quest complete" or "{n} to go", and the pace row "Pace needed / Your pace / Forecast" (`x.x/mo`, "—" when null).
- **Enforced:** `client` only.
- **Source:** `src/components/profile/QuestGoalHero.vue:44-141`.
- **Target:** user-facing copy names the product "The Chronicler" (D-03); "BookHero" is the internal code name only ⚠ PRO-D39.

### Yearly goal

#### PRO-18 · One goal per user per year
`reading_goals` has unique `(user_id, year)` (`reading_goals_user_year_key`), `year` 2000–2100 (`reading_goals_year_check`) and `target_books ≥ 1` (`reading_goals_target_books_check`), with **no DB maximum**. Trigger `set_reading_goals_updated_at` maintains `updated_at`. RLS allows owner select/insert/update/delete for role `authenticated`.
- **Enforced:** `server:db` (constraints, trigger, policies "Reading goals are … by owner").
- **Source:** live `pg_constraint`, `pg_policies`.
- **Note:** the duplicate index `reading_goals_user_year_idx` was dropped on 2026-10-19; the unique index covers it (BC-01, PRO-D41).

#### PRO-19 · Goal input validation (client)
- **Dialog:** integer input from 1 to 999, no digit grouping, +/- stepper and autofocus. It defaults to **12** when no goal exists and is re-seeded with the current target each time it opens.
- **Submit:** floors the value and rejects `< 1` with "Choose at least 1 book.".
- **Store:** re-validates (floor, finite, ≥ 1), else "Choose at least 1 book for your yearly goal.".
- **Copy:**
  - header "Set yearly goal" (no goal) / "Edit yearly goal";
  - label "Books to read in {year}";
  - help "You can adjust this anytime.";
  - buttons "Cancel" (disabled while saving) and "Save goal" (spinner while saving).
  A store error shows inside the dialog under the input. The hero's pencil is disabled while saving.
- **Enforced:** `client` only; the DB enforces only `≥ 1`.
- **Source:** `src/components/profile/ReadingGoalDialog.vue:1-40,63,66,68-90`; `src/stores/readingQuest.ts:154-158`; `QuestGoalHero.vue:95-103`.
- **Note:** a stored target above 999 is possible through a direct table write. How PrimeVue's InputNumber renders an out-of-range seed was not exercised [UNVERIFIED]. Native clients clamp to 1–999.

#### PRO-20 · Goal save targets the client's current year only
`reading_goals.upsert({user_id, year, target_books}, onConflict 'user_id,year')` for `new Date().getFullYear()` (device-local). It then invalidates the prefix `readingQuest:{uid}` and refetches. Only the current year is editable: there is no delete UI and no past- or future-year UI.
- **Enforced:** `client` (year choice); `server:db` (unique key).
- **Source:** `src/stores/readingQuest.ts:111,150-179`.
- **Target:** "current year" is the year in the reader's stored zone (D-07 · BC-06). The PWA's device year matches whenever the device zone equals the stored zone. Other years: PRO-Q13.

### Lifetime stats (`get_reading_stats`)

#### PRO-21 · Page delta definition (lifetime stats)
For each history row, `delta = max(0, page − previous page of the same book)`. The previous row comes from `lag(page, 1, 0) over (partition by book_id order by recorded_at, id)`, and **defaults to 0**: the first history row of a book counts its full page number (PRO-91). A backward correction followed by re-saving counts the same pages again (100 → 50 → 100 credits 150).
- **Enforced:** `server:rpc` (`get_reading_stats` CTE `deltas`).
- **Source:** live function body.
- **Target:** only forward page changes produce activity. Backward and zero-delta changes add no pages and no reading day, and offline replays count at their original `client_occurred_at` (D-08 · BC-04). Recommended, as in SES-D19: measure deltas against the book's high-water mark, so a correction followed by re-saving is not counted twice, and use **one** delta definition in every stats RPC (⚠ PRO-D43). A baseline row for books added mid-way removes the first-row over-count (BC-04, SES-Q17).

#### PRO-22 · "Meaningful session"
A history row with `session_start_at IS NOT NULL`, `recorded_at − session_start_at ≥ 60 s` and `delta ≥ 1`. **No upper cap**, unlike the 12 h cap in records (⚠ PRO-D35).
- **Enforced:** `server:rpc` (CTE `valid_sessions`).
- **Source:** live function body.
- **Target:** durations come from server-clock session timestamps (BC-04). This is the definition recommended for "real timed session" in PRO-Q19.

#### PRO-23 · get_reading_stats fields
| Field | Definition | Used by UI |
|---|---|---|
| `pagesThisWeek` | Σ delta where `recorded_at ≥ now() − 7 days` (rolling 168 h, not a calendar week) | no |
| `pagesThisMonth` | Σ delta where `recorded_at ≥ date_trunc('month', now())` (UTC calendar month) | no |
| `totalPagesRead` | Σ `least(max(current_page, 0), total_pages)` over `reading_progress` rows with `current_page > 0` of **manual** books with `total_pages > 0` (state-based; includes DNF) | yes |
| `totalReadingHours` | `round(Σ duration_s of meaningful sessions / 3600)`, **integer hours** | yes |
| `sessionsThisMonth` | `count(distinct (book_id, session_start_at))` of meaningful sessions with `recorded_at ≥ date_trunc('month', now())` (UTC) | yes |
| `currentStreakDays` | length of the latest run of consecutive reading days whose last day is `≥ current_date − 1` (today or yesterday keeps it alive), else 0 | yes |
| `longestStreakDays` | longest run length | yes |
| `allTimeVelocityPph` | `round(Σ delta / (Σ duration_s / 3600))` over meaningful sessions; 0 when there is no duration or no pages | yes |

All values are integers.
- **Enforced:** `server:rpc` (`get_reading_stats`).
- **Source:** live function body.
- **Target:** this week, this month, sessions this month and streaks are computed in the reader's zone through `p_timezone` or the stored zone (D-07 · BC-06). Only forward changes and real timed sessions count, including offline replays at their original time (D-08 · BC-04). The unused fields may be dropped or redefined; nothing renders them today (⚠ PRO-D40).
- **Note:** `pagesThisWeek` and `pagesThisMonth` compare device-written `recorded_at` with server `now()`. A device clock running ahead writes future rows that count at once (PRO-100).

#### PRO-24 · A streak day is a UTC date, and any history row marks one
Reading days are `date(recorded_at)` and "today" is `current_date`, both in the DB session zone (UTC on Supabase). Any history row marks a reading day, including zero-delta saves, backward corrections and untimed edits.
- **Enforced:** `server:rpc` (CTEs `reading_days`, `streak_*`).
- **Source:** live function body.
- **Target:** reading days are local dates in the reader's IANA zone (D-07 · BC-06). A day counts only if it has at least one forward page change, offline replays included at their original time; backward and zero-delta saves no longer keep a streak alive (D-08 · BC-04).
- **Note:** today the calendar (local) can show a 7-day run while `currentStreakDays` (UTC) shows 6, or resets at UTC midnight (⚠ PRO-D32).

#### PRO-25 · get_reading_stats authorization
A non-owner gets an empty `authorized` CTE, so every field is `0`, with no error. `EXECUTE` is granted to `authenticated` only.
- **Enforced:** `server:rpc` (CTE `authorized`, `p_user_id = (select auth.uid())`).
- **Source:** live function body; `pg_proc.proacl`.

#### PRO-26 · Books finished and in progress do not come from the stats RPC
The Profile and Stats pages take `booksFinished` and `booksInProgress` from the progress store (PRO-40), not from `get_reading_stats`.
- **Enforced:** `client`.
- **Source:** `src/composables/useReadingProfile.ts:69-74`.

### Library breakdown (`get_library_breakdown`)

#### PRO-27 · Breakdown status per book (all books, imports included)
- `unread` if `coalesce(current_page, 0) = 0`;
- `finished` if `current_page ≥ total_pages AND total_pages > 0`;
- otherwise `reading`.

There is **no DNF state**: a DNF book with pages counts as "reading", and an imported DNF at page 0 counts as "unread".
- **Enforced:** `server:rpc` (CTE `books_with_status`).
- **Source:** live function body.
- **Note:** the client `booksInProgress` excludes DNF, so the two "in progress" numbers can differ. Policy: LIB-Q11 / PRO-Q01.

#### PRO-28 · Breakdown fields
| Field | Definition |
|---|---|
| `authorsCount` | `count(distinct lower(trim(author)))` over non-null authors |
| `booksFinished` / `booksInProgress` / `booksUnstarted` | status counts (PRO-27) |
| `avgCompletionPct` | `round(avg(completion_pct), 1)` over non-unread books, with completion capped at 100 (**unused by the UI**) |
| `genreDistribution` | `[{genre, count, percentage}]` with `genre = nullif(trim(genre), '')` else `'Uncategorized'`, `percentage = round(count/total × 100, 1)`, ordered by count desc |

- **Enforced:** `server:rpc` (`get_library_breakdown`).
- **Source:** live function body.
- **Note:** genre grouping is **case-sensitive** after trim (`Fantasy` and `fantasy` are separate slices), while authors are case-folded. Ties have no secondary order.

#### PRO-29 · Genre bar (client)
The top 4 genres become segments, colored `#6366f1`, `#a78bfa`, `#818cf8`, `#c4b5fd`. A 5th color `#4f46e5` is defined but never used. The rest collapse into `"Other (n)"` with the summed percentage and color `rgba(148,148,178,0.35)`. The legend shows `Math.round(percentage)%`.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/LibraryBreakdownCard.vue:10-31,68`.

#### PRO-30 · Breakdown empty state
When `!breakdown || genreDistribution.length === 0` the card shows "Add a book to see your library breakdown.".
- **Enforced:** `client`.
- **Source:** `LibraryBreakdownCard.vue:41-47`.

#### PRO-31 · Breakdown has no authorization check
`get_library_breakdown` is SECURITY DEFINER and filters `b.user_id = p_user_id`. Since 2026-10-19 (BC-01) it raises `not_allowed` (`42501`) unless `p_user_id = auth.uid()`, so a reader can read only their own composition. The parameter is kept for the PWA.
- **Enforced:** `server:rpc` (owner assert); `EXECUTE` is limited to `authenticated`.
- **Source:** migration `20261018120000_bc01_security_hardening.sql` (§1); `pg_proc.proacl`.

### Calendar, monthly chart and records (time-zone-aware RPCs)

#### PRO-32 · The client supplies the time zone to three RPCs
The web client passes `Intl.DateTimeFormat().resolvedOptions().timeZone` (IANA) as `p_timezone` to `get_reading_calendar`, `get_monthly_reading` and `get_reading_records`; the server default is `'UTC'`. All three filter `p_user_id = (select auth.uid())`, so non-owners get empty or zero results. An unrecognised zone makes `AT TIME ZONE` raise SQLSTATE 22023 ("time zone … not recognized"):
- calendar and monthly catch it with `console.warn` and leave the month/year **uncached** (retried on the next mount or navigation);
- records reject through SWR, and the card stays hidden.
- **Enforced:** `server:rpc`; `client` (zone choice).
- **Source:** `src/composables/useReadingCalendar.ts:40`, `useMonthlyReading.ts:37`, `useReadingRecords.ts:35`; live function bodies.
- **Target:**
  - every stats RPC takes `p_timezone` and falls back to the reader's stored zone, not to UTC (D-07 · BC-06);
  - recommended: validate against `pg_timezone_names` with a fallback, as `get_retention_summary` already does;
  - the PUBLIC/anon `EXECUTE` these three RPCs carried was revoked on 2026-10-19 (BC-01, PRO-D05).
- **Note:** `p_month_start` may be any date in the month (the server applies `date_trunc('month', …)`). Native clients send `TimeZone.current.identifier`.

#### PRO-33 · Calendar day
A day is "active" when at least one history row exists with `(recorded_at AT TIME ZONE tz)::date` = that day, inside `[month_start, month_start + 1 month)`. Per day, books are ordered by their first `recorded_at` that day, and `furthestPage = max(page)` that day. Output: `[{date:'YYYY-MM-DD', books:[{bookId, title, coverUrl, furthestPage}]}]`, sorted by date. A deleted book's history is gone with it (cascade).
- **Enforced:** `server:rpc` (`get_reading_calendar`; pre-filters a ±1-day padded UTC range, then filters on the converted local date).
- **Source:** live function body.
- **Target:** active days come from forward-change activity in the reader's zone, offline replays included at their original time (D-07, D-08 · BC-04/BC-06).
- **Note:** the `'Unknown Book'` title fallback is unreachable because of the inner join on `books` (⚠ PRO-D40).

#### PRO-34 · Monthly pages and books finished
For history rows whose local year is `p_year`:
- **Pages:** `pages = max(0, page − page of the same book's previous row)`, where the previous row is the latest one with `recorded_at` **strictly earlier** (any year), default 0. Pages are summed per local month.
- **`booksFinished` per month:** books whose **first** history row with `page ≥ total_pages` (and `total_pages > 0`) falls in that local month and year.

The RPC always returns 12 entries `{month, pages, booksFinished}`.
- **Enforced:** `server:rpc` (`get_monthly_reading`).
- **Source:** live function body.
- **Target:**
  - the same delta rule as PRO-21, in the reader's zone (D-07/D-08 · BC-06/BC-04);
  - recommended: monthly finishes use `reading_progress.completed_at` (BC-04), so the 12 monthly counts sum to the quest's yearly count (⚠ PRO-D33).
- **Note:**
  - The lateral "previous row" uses strict `<` with **no `id` tiebreak**, unlike the `lag()` in `get_reading_stats`. Two rows of the same book with an identical `recorded_at` each diff against the older row (pages double-counted) ⚠ PRO-D43.
  - `booksFinished` has no `source` filter: an imported book finished later through an organic save counts in that save's month.
  - Manual "already finished" adds and imports have no history, so they never appear here (PRO-98).

#### PRO-35 · Personal records
| Record | Definition |
|---|---|
| `bestDay` | local day with the largest Σ delta (same lateral-previous delta as PRO-34); ties → most recent day; `null` if no positive day |
| `longestSession` | max `round((recorded_at − session_start_at)/60)` minutes over rows with `session_start_at` set, `recorded_at > session_start_at` and duration **≤ 12 h**; ties → most recent; `date` = local day of the end |
| `nightOwl` | a session (same ≤ 12 h filter) exists whose **end** local hour is in [0, 4] (00:00–04:59) |
| `fastestFinish` | per book with `total_pages > 0`: `first_day` = local day of its first history row, `finish_day` = local day of its first row with `page ≥ total_pages`; `days = finish_day − first_day + 1` (inclusive); min days, ties → title A→Z; returns `{days, title}` |

Unauthorized callers get `{bestDay:null, longestSession:null, fastestFinish:null, nightOwl:false}`.
- **Enforced:** `server:rpc` (`get_reading_records`).
- **Source:** live function body; `supabase/migrations/20260716_records_achievements.sql:17-109` (same body; only the grants differ, PUBLIC/anon on live).
- **Target:** reader zone (D-07 · BC-06); session records only from real timed sessions on the server clock; `bestDay` uses the PRO-21 forward-delta rule (D-08 · BC-04). The finish day comes from `completed_at` (recommended, BC-04).
- **Note:**
  - `longestSession` and `nightOwl` consider **every** timed row: no ≥ 60 s or ≥ 1-page requirement, unlike PRO-22. A 30-second, zero-page timed save at 01:00 local unlocks `night_owl`.
  - `minutes` is `round(seconds/60)`, so a 119.5-minute session reports 120 and earns `deep_dive`.
  - `date` fields are JSON `YYYY-MM-DD` local dates; treat them as floating calendar dates.
  - The first-row rule (PRO-91) can make `fastestFinish` 1 day for books started outside the app (a false `devoured`).

### Weekly goal (dormant)

#### PRO-36 · Weekly goal is backend-only
`user_settings` stores `weekly_goal int NOT NULL DEFAULT 3` with CHECK 1–7 (`user_settings_weekly_goal_check`) and unique `user_id`. `upsert_weekly_goal(p_goal)`:
- raises `'Not authenticated'` without a uid;
- raises `'Weekly goal must be between 1 and 7'` out of range;
- otherwise inserts or updates the row.

**No code in `src/` reads or writes it.** RLS allows owner select/insert/update (role `public`), with no delete policy.
- **Enforced:** `server:db`, `server:rpc`; no client.
- **Source:** live table, constraint, policies, function.
- **Note:**
  - `upsert_weekly_goal(NULL)` passes the range check (`NULL < 1` is NULL) and then fails `NOT NULL` with a raw Postgres error ⚠ PRO-D46.
  - Since BC-01 (2026-10-19) the RPC is not executable by `anon` or `authenticated` (PRO-D05).
  - Neither object has a repo migration (⚠ PRO-D42).
  - Product decision: PRO-Q07.

#### PRO-103 · Weekly retention summary RPC (dormant)
`get_retention_summary(p_timezone)` validates the zone against `pg_timezone_names` (falling back to UTC).
- **Week:** the ISO week (Monday 00:00) in that zone.
- **`sessionsThisWeek`:** distinct `(book_id, session_start_at)` whose first `recorded_at` falls in the week, with **no** ≥ 60 s / ≥ 1-page filter.
- **`activeDaysThisWeek`:** distinct local days among those sessions.
- **`weeklyGoal`:** `user_settings.weekly_goal`, else 3.
- **`goalProgressPct`:** `least(100, round(sessions/goal × 100))`.
- **`daysSinceLastSession`:** local-date difference to the latest timed row.
- **`nudgeCode`:** first match of `goal_met` (sessions ≥ goal) → `comeback` (≥ 14 days since the last session) → `start_week` (0 sessions) → `almost_there` (goal − 1) → `keep_going`.

Signed-out callers get `nudgeCode = 'signed_out'`. No client calls it.
- **Enforced:** `server:rpc`; no client.
- **Source:** live `get_retention_summary`.
- **Note:** since BC-01 (2026-10-19) it is not executable by `anon` or `authenticated` (PRO-D05); it has no repo migration (⚠ PRO-D42).

### Profile-surface derivations (client)

#### PRO-37 · Ring percent
The identity-header ring and the quest-hero ring both show `clamp(quest.progressPercent, 0, 100)`, or 0 without a target. They are drawn as an SVG stroke-dasharray with r = 33 (header) and r = 62 (hero).
- **Enforced:** `client` only.
- **Source:** `src/components/profile/ProfileIdentityHeader.vue:21-29`; `QuestGoalHero.vue:20-28`.

#### PRO-38 · Goal caption and header tap
With no target the caption reads "Set a yearly goal"; otherwise "`{completedBooks}` of `{targetBooks}` books this year". Tapping the header (or pressing Enter/Space) always opens **profile edit**, not the goal dialog.
- **Enforced:** `client` only.
- **Source:** `ProfileIdentityHeader.vue:31-36,45-47`.
- **Note:** the component's header comment claims the tap opens the Trophy Room (⚠ PRO-D39). Policy: PRO-Q12.

#### PRO-39 · Level badge and level strip
- **Header:** `Lv {level}` (0-based) with the title under the name.
- **Level strip:** "Level {n}", `totalXp.toLocaleString()` XP, the title, a progress bar, then "`{xpToNextLevel}` XP to `{next title}`", or "Library Legend status secured." at max.
- **Enforced:** `client`.
- **Source:** `ProfileIdentityHeader.vue:82-89`; `src/components/profile/ReaderLevelStrip.vue:1-24,38`.

#### PRO-40 · "Books finished" and "in progress" on the Profile come from the progress store
- `booksFinished = progressStore.completedBooks.length`, where completed means `percentage ≥ 100`. This **includes imported books and DNF-stamped books at 100 %**.
- `booksInProgress` = books with `0 < pct < 100 AND !dnfAt`.

These values feed the "Books" pill, DNA gating, DNA input and Book Lengths. On Profile and Stats the progress map is derived from `get_library_with_progress`, which runs first: `percentage = least(100, round(current/total × 100, 2))` (0 when `total_pages ≤ 0`) and `updatedAt = reading_progress.updated_at`. Books with no progress row are skipped.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:103-133,679-699`; `src/types/index.ts:440`; `src/composables/useReadingProfile.ts:73`.
- **Note:**
  - A reader who imported 10 finished books sees **Books 10** on the Profile while "First victory" stays **locked** (PRO-48) ⚠ PRO-D33.
  - Rounding to 2 dp means a book of 20 000+ pages at 99.995 % counts as finished.
  - A DNF book reaches 100 % only through a later page save or a `total_pages` edit.

#### PRO-41 · Stat pill formatting
- **Books:** raw integer.
- **Pages / Hours:** `v ≥ 10 000` → `(v/1000).toFixed(1)` with a trailing `.0` stripped, plus `k` (e.g. `12.3k`, `20k`); else `toLocaleString()`.
- **Streak:** `{currentStreak}d`.

Every pill opens `/profile/stats`.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/ProfileStatsNav.vue:13-40`.

#### PRO-42 · Lifetime grid
Seven tiles, in order: Sessions this month, In progress, Pages read, Reading hours, Pages / hr, Current streak (`Nd`), Longest streak (`Nd`). The empty state "Start your first session to see your stats." shows iff `sessionsThisMonth = 0 AND booksInProgress = 0 AND totalPagesRead = 0`.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/LifetimeStatsGrid.vue:18-79`.

#### PRO-43 · Book lengths
Computed over `completedBooks` with `totalPages > 0`, including imports and placeholder page counts:
- `avg = round(Σ pages / n)`;
- **longest:** a strictly-greater scan from the first element (the list is sorted by `updatedAt` desc, so ties go to the most recently updated);
- **shortest:** the symmetric scan.

Copy: "Your average finished book runs **N pages**.", then Longest / Shortest rows (cover if any, title, "N pages"). The card is hidden when no book is finished. With one finished book, longest and shortest are the same book.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/BookLengthCard.vue:10-39`.
- **Note:** imports whose page count could not be resolved carry the placeholder `total_pages = 100` (`PLACEHOLDER_PAGES`, `page_count_estimated = true`, `src/stores/books.ts:254,307`) and count in the average. Policy: PRO-Q16.

#### PRO-44 · Records card
The card is hidden unless `bestDay || longestSession || fastestFinish || longestStreak > 0`.
- **Session label:** `< 60` → "`N` min", else "`H`h `M`m" or "`H`h".
- **Days:** "1 day" / "N days".
- **Dates:** `MMM d, yyyy`.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/RecordsCard.vue:15-64`; `src/utils/date.ts:30-31`.

#### PRO-45 · Monthly chart
- **Bars:** 0 pages → 3 px; else `max(6, round(pages/maxPages × 100))%`, with `maxPages = max(1, …)`. Month labels are `J F M A M J J A S O N D`, and the card heading is the year number.
- **Year navigation:** back is unlimited; forward is disabled when `year ≥ current local year`.
- **Tap:** toggles the month detail "`Month` · N page(s) · N book(s) finished". Otherwise the summary reads "N pages · N book(s) finished in YYYY".
- **Skeleton:** only while the year is not loaded and loading.
- **Enforced:** `client` only.
- **Source:** `src/components/profile/MonthlyReadingChart.vue:9,22-61,77,83,113-121`.
- **Target:** "current year" is the reader-zone year (D-07).

#### PRO-46 · Calendar grid
- **Header:** **Monday-first** weekday header `M T W T F S S`, with `(getDay(1st) + 6) % 7` leading blanks.
- **Cells:** today is highlighted and future days dimmed. Active cells show the first book's cover plus a `+{n−1}` badge; inactive cells are not tappable.
- **Tap:** toggles the day detail ("`MMMM d`" plus rows "reached p. N" → book detail).
- **Navigation:** forward navigation is disabled on the current month.
- **Summary:** "N reading day(s) this month", or "No sessions logged this month[ yet].".
- **Enforced:** `client` only.
- **Source:** `src/components/profile/ReadingCalendarCard.vue:19,46-65,78-89,118,186-222`.
- **Note:** "today" and the forward limits are computed once at mount; a page left open past midnight shows a stale "today". Week start policy: PRO-Q15.

### Achievements

#### PRO-47 · Achievement catalog (display order = array order)
| key | title | hint | icon | unlock condition |
|---|---|---|---|---|
| `first_book` | First victory | Finish your first book | pi-flag | `sources.completedBooks ≥ 1` |
| `books_5` | Shelf conqueror | Finish 5 books | pi-book | `completedBooks ≥ 5` |
| `books_10` | Two-digit shelf | Finish 10 books | pi-crown | `completedBooks ≥ 10` |
| `pages_1k` | Thousand-pager | Read 1,000 pages | pi-file | `sources.pagesRead ≥ 1000` |
| `pages_10k` | Ten-thousand club | Read 10,000 pages | pi-database | `pagesRead ≥ 10000` |
| `sessions_50` | Regular | Log 50 reading sessions | pi-calendar | `sources.readingSessions ≥ 50` |
| `sessions_100` | Devoted | Log 100 reading sessions | pi-calendar-plus | `readingSessions ≥ 100` |
| `capture_first` | Chronicler | Save your first page capture | pi-camera | `sources.pageCaptures ≥ 1` |
| `captures_50` | Archivist | Save 50 page captures | pi-images | `pageCaptures ≥ 50` |
| `recap_first` | Storyteller | Generate your first recap | pi-sparkles | `sources.recapsGenerated ≥ 1` |
| `insight_first` | Lorekeeper | Unlock your first Insight | pi-eye | `sources.loreCardsUnlocked ≥ 1` |
| `streak_7` | Week of pages | Read 7 days in a row | pi-bolt | `longestStreakDays ≥ 7` |
| `streak_30` | Habit forged | Read 30 days in a row | pi-verified | `longestStreakDays ≥ 30` |
| `century_day` | Century day | Read 100+ pages in one day | pi-gauge | `records.bestDay.pages ≥ 100` |
| `deep_dive` | Deep dive | A single 2-hour reading session | pi-clock | `records.longestSession.minutes ≥ 120` |
| `devoured` | Devoured | Finish a book within 3 days | pi-forward | `(records.fastestFinish.days ?? ∞) ≤ 3` |
| `night_owl` | Night owl | End a session in the small hours | pi-moon | `records.nightOwl === true` |

Keys are the persisted contract: every client uses these exact strings.
- **Enforced:** `client` only (the server accepts any key string, ⚠ PRO-D08).
- **Source:** `src/utils/achievements.ts:28-154`.
- **Target:**
  - the catalog and its conditions live in SQL/RPC, and clients render server state (D-06 · BC-09);
  - the conditions adopt the Phase 0 inputs: streaks in the reader zone (BC-06); `sessions_50/100` count real timed sessions only (D-08 · BC-04); "books" follow the canonical finished definition (PRO-Q01);
  - existing keys are never renamed.

#### PRO-48 · Achievement inputs
The evaluation context has three parts:
- quest `sources`: manual books only, lifetime (PRO-02…06);
- `longestStreakDays` from `get_reading_stats` (UTC days, PRO-24);
- `records` from `get_reading_records` (device zone).

Null inputs evaluate as 0 / not earned. `sources` comes from the current-year quest call, but its fields are lifetime, so the year requested does not matter.
- **Enforced:** `client`.
- **Source:** `src/composables/useAchievements.ts:28-32`.
- **Target:** the server evaluates from its own definitions; no client-supplied context (BC-09).
- **Note:** book and page badges use manual-only `sources`, while the Profile "Books" pill counts imports (⚠ PRO-D33).

#### PRO-49 · Earned state
`earned = persisted earned_at exists OR condition currently true`. `earnedAt` is shown only when persisted. Locked badges render `pi-lock` instead of their icon, the hint is always visible, and the header reads "`earned` of `17`".
- **Enforced:** `client`.
- **Source:** `src/composables/useAchievements.ts:34-49`; `src/components/profile/AchievementsGrid.vue:33-35`.
- **Target:** earned iff a ledger row exists; the server persists at the triggering event, so the "true but not persisted" state disappears (BC-09).

#### PRO-50 · Ledger is insert-only
`achievements(id, user_id, achievement_key text, earned_at timestamptz default now())` has unique `(user_id, achievement_key)`. RLS allows owner INSERT and SELECT only (role `authenticated`), with no UPDATE or DELETE. Trophies never regress, even when the condition later becomes false (e.g. a book is deleted).
- **Enforced:** `server:db` (`achievements_user_id_achievement_key_key`; policies "Achievements are insertable by owner" / "Achievements are viewable by owner").
- **Source:** live `pg_constraint`, `pg_policies`; `supabase/migrations/20260716_records_achievements.sql:115-140`.
- **Target:** the server writes the ledger (BC-09). Client INSERT stays allowed until the PWA has migrated (D-05); `ON CONFLICT DO NOTHING` keeps the earliest `earned_at`. Then client INSERT is revoked.

#### PRO-51 · Achievement sync runs only on Trophy Room mount
`sync()`:
1. runs in parallel: quest summary, stats, records and the earned ledger, each error swallowed;
2. if a user exists and the ledger loaded, picks keys not in the ledger whose condition is true;
3. upserts `[{user_id, achievement_key}]` with `onConflict 'user_id,achievement_key'` and `ignoreDuplicates: true`;
4. on error logs and stops; on success stamps the **local** `earned_at = client now`.

It runs **only when the Trophy Room mounts**. There is no unlock celebration or notification, and the server never validates conditions. The ledger is read **once per app session** (`_earnedLoaded`) and never re-read. If that read fails, nothing is persisted on that visit and the next mount retries.
- **Enforced:** `client` only.
- **Source:** `src/composables/useAchievements.ts:51-97`; `src/pages/TrophyRoomPage.vue:28-37`.
- **Target:**
  - evaluation happens server-side, through `sync_achievements` or trigger-driven after `save_progress`, capture, recap and Insight writes; completion runs it inside the BC-05 pipeline;
  - `earned_at` is the server time of the triggering event;
  - the RPC returns the newly earned keys for an optional, quiet celebration (PRO-Q09) (D-06 · BC-09 · BC-05).
- **Note:**
  - `earned_at` today is the server `now()` at the Trophy Room visit, not the moment of accomplishment.
  - With two devices, the second re-"earns" a key the first already persisted. The insert is a no-op, but the badge shows the second device's local time until reload ⚠ PRO-D24.
  - `_earned` is not reset on account switch ⚠ PRO-D09.

### Reading DNA

#### PRO-52 · DNA storage
`reading_dna` has PK `user_id` (one row per user, cascading on auth-user delete). CHECKs:
- `personality`: 50–800 chars (`char_length`);
- `mood_tone`: 1–40;
- `mood_emojis`: `array_length` 1–5;
- `books_finished_at_generation ≥ 0`.

`suggestions jsonb` is **unconstrained**, and `generated_at` defaults to `now()`; there is no `updated_at`. RLS allows select, insert and update where `auth.uid() = user_id` (role `public`), with **no delete policy**.
- **Enforced:** `server:db` (`reading_dna_*_check`, policies `reading_dna_select/insert/update`).
- **Source:** live `pg_constraint`, `pg_policies`.
- **Note:**
  - `array_length('{}', 1)` is NULL, so an empty emoji array passes the CHECK.
  - The edge function measures length in UTF-16 units, while the CHECK counts code points. An emoji-heavy personality of ≥ 50 UTF-16 units but < 50 code points passes the function and fails the DB ⚠ PRO-D45.
  - The policies use per-row `auth.uid()` (the RLS initplan lint, BC-01).

#### PRO-53 · The client writes DNA
`generate-reading-dna` is stateless. The web client upserts its result into `reading_dna`.
- **Enforced:** `client`.
- **Source:** `src/stores/readingDna.ts:96-117`.
- **Target:** DNA eligibility becomes a server-owned completion effect (D-06 · BC-05). The server evaluates the threshold, generates once per user with no concurrent runs, and persists a validated row; clients only read it. This removes the two-device race, where web and iOS each fire an AI call and race the upsert.

#### PRO-54 · DNA read
`select * from reading_dna where user_id = me` with `maybeSingle()`, cached per user for the session (`fetchedForUserId`); a user switch clears it. On a read error the store logs, sets status `idle`, leaves `dna` unchanged (null on first load) and does **not** mark it fetched.
- **Enforced:** `client`.
- **Source:** `src/stores/readingDna.ts:31-58`.
- **Note:** a failed read looks like "no DNA" to the generator, which then regenerates and overwrites ⚠ PRO-D11.

#### PRO-55 · First generation needs 2 finished books
First generation requires `booksFinished ≥ 2` (`FINISHED_THRESHOLD = 2`), with `booksFinished` as defined in PRO-40. The store's doc comment still says 3 (⚠ PRO-D36).
- **Enforced:** `client` only.
- **Source:** `src/stores/readingDna.ts:8-22,60-62`.
- **Note:** policy: PRO-Q05.

#### PRO-56 · Regeneration rule
With a DNA row, the store regenerates when `booksFinished − dna.booksFinishedAtGeneration ≥ 2` **or** `(now − generatedAt) ≥ 90 days`. It still requires `booksFinished ≥ 2`. Deleting books makes `finishedSince` negative, and no regeneration happens until it climbs back or 90 days pass (`books_finished_at_generation` is never lowered).
- **Enforced:** `client` only.
- **Source:** `src/stores/readingDna.ts:22,60-68`.
- **Target:** the server owns the same thresholds unless PRO-Q05 changes them (BC-05).

#### PRO-57 · DNA is evaluated only on Profile mount
Evaluation happens only on `ProfilePage` mount, after all data loads, and the store **awaits generation before first paint**. There is no manual "Regenerate" button (spec 016 FR-012).
- **Enforced:** `client`.
- **Source:** `src/pages/ProfilePage.vue:32-52`.
- **Target:** evaluated on completion server-side (BC-05), so Profile visits never trigger AI calls (⚠ PRO-D19). Manual regenerate: PRO-Q06.

#### PRO-58 · DNA input
`books = progressStore.completedBooks.map({title, author})`: imports are included, the order is progress `updatedAt` desc, and there is no cap on count. Generation aborts if the list is empty.
- **Enforced:** `client`.
- **Source:** `src/stores/readingDna.ts:75-80`.
- **Note:** a large CSV import can trigger an AI call on the very next Profile visit. Policy: PRO-Q05. Spec 016 FR-009 (recaps/lore/captures as input) is not implemented (⚠ PRO-D36).

#### PRO-59 · Persisted DNA row
`{user_id, personality, mood_tone: moodSignature.tone, mood_emojis: moodSignature.emojis, suggestions, books_finished_at_generation: data.booksFinishedAtGeneration ?? booksFinished, generated_at: data.generatedAt ?? client now}`, upserted `onConflict user_id`, followed by a forced re-read.
- **Enforced:** `client`.
- **Source:** `src/stores/readingDna.ts:97-117`.

#### PRO-60 · DNA failure keeps the previous DNA (FR-014)
Any invoke error, empty data, upsert error or exception keeps the previous DNA. The status becomes `error` only when there is no DNA, else `idle`. There is no retry or backoff; the next attempt happens on the next Profile mount, and it re-bills the AI call.
- **Enforced:** `client`.
- **Source:** `src/stores/readingDna.ts:89-121`.
- **Target:** the server job retries with backoff and keeps the previous row on failure (BC-05). AI usage is recorded (BC-12).

#### PRO-61 · generate-reading-dna request and response validation
- **Request:** the body must be JSON with a `books` array of length ≥ 1, else 400 `invalid_input`.
- **Output normalisation:**
  - `personality` trimmed, 50–800 (JS `.length`);
  - `tone` trimmed, 1–40;
  - `emojis` = string entries, first 5, at least 1;
  - `suggestions` = entries with string `title`/`author`/`reason`, trimmed, first 5, **at least 3**.
  Anything else returns 502 `ai_unavailable`.
- **200 response:** `{personality, moodSignature:{tone, emojis[]}, suggestions:[{title, author, reason}], booksFinishedAtGeneration: body.books.length, generatedAt: server now}`.
- **Other errors (JSON `{error}`):** 401 `unauthorized` (no `sub` in the decoded token), 405 `Method not allowed`, 502 `ai_unavailable` (also when `GEMINI_API_KEY` is missing, no JSON block is found, or parsing fails), 500 `internal`. CORS `*`.
- **Enforced:** `server:edge` (`generate-reading-dna`).
- **Source:** deployed v8 `index.ts` (validation identical to `supabase/functions/generate-reading-dna/index.ts:46-91,123-192`).
- **Target:** verify the JWT through the gateway or `supabase.auth.getUser`, without the hand-rolled base64 decode, and return no internal error text (BC-02). Cap the books list and run the shared entitlement / AI-usage check, which allows everything until tiers are decided (BC-12, D-14) ⚠ PRO-D06.

#### PRO-62 · DNA prompt and model contract (deployed v8 is canonical)
- **System prompt:** a "Technical Narrative Critic and Literary Curator" persona. It asks for a personality of 2–3 sentences (50–800 chars) addressed "You…", a tone of exactly one word, exactly 3 emoji glyphs, 3–5 real books each with a one-sentence "Technical Craft"/"Structural Weight" reason, and strict JSON with no fences.
- **User message:** `FINISHED BOOKS:` followed by one `- "{title}" by {author}` line per book.
- **Model:** `gemini-2.5-flash`, temperature 0.85, `maxOutputTokens 2048`, `thinkingConfig.thinkingBudget: 1`, `tools: [{ googleSearch: {} }]`, and a `dynamicRetrievalConfig` key misplaced inside `config`.
- **JSON extraction:** from the first `{` to the last `}`.
- **Enforced:** `server:edge`.
- **Source:** deployed `generate-reading-dna` v8 (`verify_jwt: true`). The repo source differs only in `thinkingBudget: 0` and has no tools (single git commit `bc5311a`).
- **Target:** the repo is synced to v8, and the misplaced `dynamicRetrievalConfig` (not an option of the `googleSearch` tool) is cleaned up in the sync (D-09 · BC-03) ⚠ PRO-D37.
- **Note:** titles are interpolated unescaped into the prompt. Whether the misplaced key is ignored or rejected by `@google/genai`, and whether grounding text can break the `{…}` extraction, were not exercised at runtime [UNVERIFIED].

#### PRO-63 · DNA strip states
| Condition | Rendering |
|---|---|
| below threshold, no DNA | "Finish {2−n} more book(s) to unlock your Reading DNA." + progress bar `round(n/2 × 100)%` |
| generating, no DNA | skeleton |
| status `error`, no DNA | "Your Reading DNA couldn't be generated. We'll try again later." |
| DNA exists | tone pill (CSS-uppercased; the stored value keeps the AI's casing) + emoji row; tap → modal bottom sheet "Your Reading DNA" with tone, emojis and personality (dismiss by tapping the mask) |
| `booksFinished ≥ 2`, no DNA, status `idle` (generation never ran this visit) | no branch matches → an **empty glass card** ⚠ PRO-D29 |

- **Enforced:** `client` only.
- **Source:** `src/components/profile/DnaSignatureStrip.vue:11-90`; `MoodSignature.vue:25-35`.

### DNA recommendations

#### PRO-64 · Recommendation visibility
The section shows only when DNA exists and has at least one suggestion: heading "Your DNA suggests", one fitted row, no horizontal scroll. Cards show title and author. Each card shows a skeleton while it resolves without a cover, and a book-icon placeholder when unresolved or when the image fails. The AI `reason` is exposed only as an HTML `title` tooltip, which touch devices never show. Suggestions are **not** de-duplicated against the reader's library, although spec 016 FR-027 requires it ⚠ PRO-D44.
- **Enforced:** `client`.
- **Source:** `src/components/profile/DnaRecommendationsScroller.vue:22-81`.

#### PRO-65 · Cover resolution order
For each suggestion, **in sequence**:
1. Google Books search `q="{title} {author}"`, page 1 (20 results, `printType=books`, `langRestrict` = the browser's 2-letter language, optional key `VITE_GOOGLE_BOOKS_API_KEY`) → the first result with a cover, else the first result.
2. If Google returns nothing, non-OK or throws → Open Library `search.json?title=&author=&limit=3&fields=cover_i` → `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` (no `source`/`key`).
3. Otherwise unresolved.
- **Enforced:** `client` only.
- **Source:** `src/composables/useDnaRecommendations.ts:68-112`; `src/services/bookSearchService.ts:93-128`.
- **Target:** for multi-client traffic, book search goes through a server-side proxy that hides the Google key, caches and rate-limits (BC-15).
- **Note:** when Google returns results without a cover, step 2 is skipped ⚠ PRO-D17.

#### PRO-66 · Resolved items and retry
An item is "resolved" when `coverUrl !== null`. A set is skipped only when its signature matches **and** every item is resolved; unresolved gaps are retried on the next mount. Concurrent calls share one in-flight promise, even after the signature changed (⚠ PRO-D25).
- **Enforced:** `client`.
- **Source:** `src/composables/useDnaRecommendations.ts:115-172`.

#### PRO-67 · Recommendation cover cache
The cache is `localStorage['bookhero:dna-covers'] = {signature, items}`, with `signature = suggestions.map(t|a).join('~')`. It is read before the network when the signature and length match, and written after each resolution pass. Quota and private-mode errors are ignored. It has **no TTL** and is not user-scoped.
- **Enforced:** `client`.
- **Source:** `src/composables/useDnaRecommendations.ts:19,39-57,138-163`.

#### PRO-68 · Recommendation tap
With `source && key` the tap opens `add-book-details` (`/books/add/details/{source}/{encodeURIComponent(key)}`). Otherwise it seeds the add-book search with "`{title} {author}`" and opens `add-book`.
- **Enforced:** `client`.
- **Source:** `DnaRecommendationsScroller.vue:26-38`.

### Recap memories

#### PRO-69 · Recap gallery query
`recaps(id, book_id, created_at, image_path, books(title))` where `user_id = me`, `image_status = 'succeeded'` and `image_path is not null`, newest first, **limit 12**.
- **Enforced:** `client`; `server:db` (RLS on `recaps`).
- **Source:** `src/composables/useRecapGallery.ts:11,48-55`.
- **Note:** recap-side rules: REC-57 in [03 · Recaps](03-recaps.md).

#### PRO-70 · Gallery signed URLs
One batch `createSignedUrls(paths, 3600)` on the private bucket `recap-images`. Items whose URL fails to sign are dropped, and a missing title falls back to "Untitled". Storage RLS limits reads to the owner's folder (`recap-images: owner can select`).
- **Enforced:** `client`; `server:db` (storage policy).
- **Source:** `src/composables/useRecapGallery.ts:12,64-84`.

#### PRO-71 · Gallery caching
The gallery is fetched once per user per app session, with no TTL, even after an error (error → empty list, `loaded = true`). New images generated in the session do not appear, and deleted books' images keep rendering through still-valid URLs ⚠ PRO-D14.
- **Enforced:** `client`.
- **Source:** `src/composables/useRecapGallery.ts:44,85-92`.
- **Target:** recap images are deleted with their recap or book (BC-13); image status reaches clients through Realtime or a refresh on foreground (BC-14).

#### PRO-72 · Gallery UI
- **Loading:** a skeleton of 2 cards.
- **Empty:** "No memories yet" / "Keep reading and generating recaps — your favorite moments become images that gather here.".
- **Cards:** captioned with the book title and `MMM d, yyyy`; a tap opens `/books/:id/recaps`.
- **Enforced:** `client`.
- **Source:** `src/components/profile/RecapImagesCarousel.vue:17-69`.

### Profile customization and reader identity

#### PRO-73 · Profile row lifecycle
No `community_profiles` row exists after sign-up. The row is created only by the first successful save in `/profile/edit`. The insert fires `community_ensure_count_on_profile_insert`, which creates the `community_follow_counts` row. `community_profile_privacy` references `community_profiles` with ON DELETE CASCADE, and both cascade on auth-user delete.
- **Enforced:** `server:rpc` (`upsert_my_community_profile`); `server:db` (trigger, FKs).
- **Source:** `src/pages/ProfileEditPage.vue:1-5`; `src/composables/useCommunityIdentity.ts:6-11`; COM-01/COM-18 in [10](10-community-circles.md).
- **Target:** iOS v1 creates and edits username, display name and avatar only (D-13). On the web, the remaining fields stay as they are.

#### PRO-74 · Username rule
Client and DB both require `^[a-z0-9_-]{3,30}$` (`useCommunityIdentity.ts:17`; CHECK `community_profiles_username_format_chk`). Uniqueness is case-insensitive through `community_profiles_username_lower_uidx (lower(username))`. **Reserved, server-only:** `admin, api, auth, bookhero, login, profile, u`.
- **Enforced:** `server:db` (CHECK, unique index); `server:rpc` (`is_username_available`, `upsert_my_community_profile`); `client` (regex).
- **Source:** as cited; COM-04…COM-06.
- **Note:** the reserved list contains the code name `bookhero`, but not the product name (D-03). Policy: PRO-Q21.

#### PRO-75 · Username normalization
The client applies `trim().toLowerCase()` before validation, the availability check and save. The server applies `lower(trim(...))`.
- **Enforced:** `client`; `server:rpc`.
- **Source:** `ProfileEditPage.vue:100,181`; COM-03.
- **Note:** server `trim()` strips only ASCII spaces, while JS `trim()` strips all whitespace (COM-10). Native clients trim like JS before sending.

#### PRO-76 · Username suggestion (first run)
`email.split('@')[0]` → lowercase → strip `[^a-z0-9_-]` → first 30 chars. The suggestion is used only if it is at least 3 characters long, else the field starts empty.
- **Enforced:** `client` only.
- **Source:** `useCommunityIdentity.ts:156-158,175-181`; `ProfileEditPage.vue:89-92`.
- **Note:** with Sign in with Apple (D-11), a Hide-My-Email relay address makes the email handle meaningless. Native clients suggest from the Apple credential's given name instead; Apple provides it only on first authorization.

#### PRO-77 · Username availability check
On every change the state becomes `checking` (or `idle` if empty). After a debounce of 400 ms (maxWait 1500 ms):
- empty → `idle`;
- regex fails → `invalid`;
- equal to the saved username → `available` (no RPC);
- otherwise `is_username_available` → `available` / `taken`, and an RPC error → `idle`.

The server returns `{available:false}` when the caller is unauthenticated, the name is invalid or reserved, or another user holds it case-insensitively. The caller's own name is available. It always echoes `normalizedUsername`. Reserved names therefore display as **"taken"** (⚠ PRO-D21), and responses are not sequenced (⚠ PRO-D20).
- **Enforced:** `client`; `server:rpc` (`is_username_available`, EXECUTE `authenticated` only).
- **Source:** `ProfileEditPage.vue:103-129`; live function; COM-07/COM-08.

#### PRO-78 · Username hint copy
`taken` shows "That username's already taken. Try another." in red. Every other state shows "3–30 characters: lowercase letters, numbers, - and _". The input has `maxlength=30`, autocapitalize off and spellcheck off, with a fixed "@" prefix and a trailing state icon (spinner / check / cross).
- **Enforced:** `client`.
- **Source:** `ProfileEditPage.vue:131-140,238-378`.

#### PRO-79 · Save enablement
`canSave = regexValid && state !== 'taken' && !saving`. Saving is allowed while the state is `checking` or `idle`; the server re-validates.
- **Enforced:** `client`.
- **Source:** `ProfileEditPage.vue:167-169`.

#### PRO-80 · Display name
Optional, trimmed, empty → null. The **60-character maximum exists only as the input's `maxlength`**; neither the DB nor the RPC limits it ⚠ PRO-D07. Placeholder: "How other readers see you".
- **Enforced:** `client` only (limit); `server:rpc` (trim, empty → NULL).
- **Source:** `ProfileEditPage.vue:317`; COM-12.
- **Target:** included in iOS v1 (D-13).

#### PRO-81 · Bio
Optional, trimmed, empty → null. The client has `maxlength=160` and a live counter `{bio.length}/160` in UTF-16 units, styled as "limit" at ≥ 160. The server rejects `char_length(bio) > 160` (code points) with `bio_too_long` (CHECK `community_profiles_bio_len_chk`). The field is a 3-row auto-resizing textarea with placeholder "Currently haunting the fantasy shelves".
- **Enforced:** `client`; `server:rpc`; `server:db`.
- **Source:** `ProfileEditPage.vue:26,325-338`; COM-11.
- **Target:** web only; iOS v1 neither shows nor edits it, and must preserve it on save (D-13, PRO-104).

#### PRO-82 · Public toggle
"Public profile — Let other readers find you by username". The **client defaults to `true` on first run**. The RPC defaults to `true` when the key is omitted or null; the table defaults to `false`.
- **Enforced:** `client`; `server:rpc`.
- **Source:** `ProfileEditPage.vue:50,345-353`; COM-15.
- **Target:** web only; iOS v1 has no toggle (D-13). The default for new profiles is PRO-Q08.
- **Note:** the first-run intro promises "everything is private until you say otherwise" ⚠ PRO-D39.

#### PRO-83 · Privacy settings
Four surfaces, in UI order:
- Currently reading — "The book on your nightstand right now";
- Reading progress — "Pages, sessions, and streaks";
- Lexicon — "Words you collect while reading";
- Reading DNA — "Your AI reading personality".

Options are Everyone / Followers / Nobody, with no empty selection, under the section title "Who can see". All four default to `nobody` (client `DEFAULT_PRIVACY`, RPC coalesce, column defaults). They are enforced by `get_public_profile_by_username` (the owner always sees everything; "followers" requires a `follows` row) and by `get_also_reading_for_book`. Neither RPC is called by the PWA today.
- **Enforced:** `server:rpc` (dormant readers); `client` (form).
- **Source:** `ProfileEditPage.vue:64-75`; `useCommunityIdentity.ts:28-33`; COM-19…COM-23.
- **Target:** web only; iOS v1 has no privacy settings and preserves the stored values (D-13, PRO-104). The readers of these settings stay dormant until the Community phase.

#### PRO-84 · Avatar pick validation
`file.type` must start with `image/` ("Choose an image file.") and `size ≤ 8 MB` ("Choose an image under 8 MB."). The previous `blob:` preview is revoked, the new preview is shown locally, and the upload waits for save. Copy: a11y "Change profile photo"; hint "Tap to add a photo" / "Tap to change your photo"; `accept="image/*"`.
- **Enforced:** `client` only.
- **Source:** `ProfileEditPage.vue:27,146-163`.

#### PRO-85 · Avatar processing
`createImageBitmap` → scale `min(1, 512/max(w, h))` (rounded, at least 1 px) → canvas with `imageSmoothingQuality = 'high'` → JPEG quality **0.85**; re-encoding strips EXIF. If no 2D context is available, the original file is uploaded as-is ⚠ PRO-D22. A decode failure (e.g. HEIC on some browsers) surfaces the raw browser message as the save error.
- **Enforced:** `client` only.
- **Source:** `useCommunityIdentity.ts:14-15,199-227`.

#### PRO-86 · Avatar upload
The upload goes to bucket `community-avatars` (public; 5 MB limit; jpeg/png/webp) at path `{userId}/avatar-{Date.now()}.jpg`, with `upsert: true` and `contentType image/jpeg`. Failure shows "The image could not be uploaded. Try again.". The client then, **fire-and-forget**, lists `{userId}/` and removes every other file. The stored value is the public URL (`getPublicUrl`). Storage RLS restricts select/insert/update/delete to the owner's folder, `(storage.foldername(name))[1] = jwt.sub` (`community_avatars_owner_*`).
- **Enforced:** `client`; `server:db` (bucket limits, storage policies).
- **Source:** `useCommunityIdentity.ts:121-146`; COM-99/COM-100.
- **Note:** the cleanup runs **before** the profile save ⚠ PRO-D13.

#### PRO-87 · Save payload
`{username: normalized, displayName: trimmed|null, bio: trimmed|null, avatarUrl: newPublicUrl ?? existing ?? null, isPublic, privacy}` → `upsert_my_community_profile(payload)`. The server re-validates, upserts both tables and returns `get_my_community_profile()`. Server normalisation trims every text field and turns empty into NULL, `avatarUrl` included, so the RPC already supports removing the avatar; only the UI lacks it (PRO-Q14). Missing privacy keys default to `nobody` and a missing `isPublic` to `true` (PRO-104). On a failed save the picked file stays pending, so a retry uploads **another** `avatar-{ms}.jpg`.
- **Enforced:** `client`; `server:rpc`.
- **Source:** `ProfileEditPage.vue:171-201`; live `upsert_my_community_profile`.

#### PRO-88 · Save error → copy mapping
The client substring-matches the PostgREST message:
| Code | Copy |
|---|---|
| `username_invalid` | "Usernames are 3–30 characters: lowercase letters, numbers, - and _." |
| `username_taken` | "That username's already taken. Try another." |
| `bio_too_long` | "Your bio can be up to 160 characters." |
| `visibility_invalid` | "One of the privacy options is invalid." |
| anything else, `not_authenticated` included | "Your profile could not be saved. Try again." |

The copy shows in an inline error `Message`. Server checks run in this order: `not_authenticated` → `username_invalid` (format or reserved) → `bio_too_long` → `visibility_invalid` → `username_taken` (pre-check, plus the `unique_violation` handler for a concurrent race on `community_profiles_username_lower_uidx`).
- **Enforced:** `client` (mapping); `server:rpc`.
- **Source:** `useCommunityIdentity.ts:36-42,93-106`; live `upsert_my_community_profile`.
- **Note:**
  - The `isPublic` cast `(payload->>'isPublic')::boolean` runs in the DECLARE section. A non-boolean string (e.g. `"maybe"`) therefore raises a **raw 22P02** ("invalid input syntax for type boolean"), even before `not_authenticated`: a block's EXCEPTION handler does not catch declaration-time errors (verified 2026-10-18). Postgres accepts `"yes"`, `"no"`, `"on"`, `"off"`, `"t"`, `"f"`, `"1"` and `"0"` as booleans. The client shows the generic copy ⚠ PRO-D47. This corrects the earlier claim that such input maps to `visibility_invalid`.
  - The avatar upload always runs before the RPC, so any RPC error leaves the just-uploaded file orphaned.

#### PRO-89 · Save success
A toast "Profile saved" (2.5 s), then `router.push('profile')`. The header and greeting update from the RPC result.
- **Enforced:** `client`.
- **Source:** `ProfileEditPage.vue:188-194`.

#### PRO-90 · Identity derivations and page copy
- **`readerName`:** `displayName.trim() || username.trim() || email local-part`. The `'Reader'` literal is reached only with no auth user or no email property at all; the auth store maps a missing email to `""`, so a user without an email gets an **empty** name and empty initials.
- **`initials`:** first letters of the first two whitespace-separated words, else the first two characters, uppercased. When the avatar image fails it is hidden, and the initials underneath remain.
- **Page title / button:** "Create your reader profile" / "Create profile", or "Edit profile" / "Save changes".
- **First-run intro:** "Pick a username and (optionally) a face for your reading life. Everything here is yours to change later — and everything is private until you say otherwise."
- **While hydrating:** a skeleton (96 px circle + 3 bars).
- **Enforced:** `client` only.
- **Source:** `useCommunityIdentity.ts:156-172`; `src/stores/auth.ts:84`; `src/utils/coverFallback.ts`; `ProfileEditPage.vue:219-236,382-388`.

#### PRO-92 · Dashboard greeting
The salutation depends on the local hour: `< 5` "Up late", `< 12` "Good morning", `< 18` "Good afternoon", else "Good evening". The date reads `EEEE, MMMM d`. Three render states:
| State | Rendering |
|---|---|
| (a) identity **not loaded** (in flight, or all 3 fetch attempts failed, for the rest of the session) | salutation + date only, with no name and no avatar button |
| (b) loaded, no profile | the CTA "Set up your reader profile / Pick a username and an avatar" → `/profile/edit` **replaces** the whole greeting |
| (c) loaded with a profile | "{salutation}, {readerName}" + date + avatar button (image or initials) → `/profile` |

The salutation and date are computed at render time and do not react to the clock.
- **Enforced:** `client` only.
- **Source:** `src/components/dashboard/DashboardGreeting.vue:18-74`.

#### PRO-104 · Profile save replaces every field
`upsert_my_community_profile` is a **full replace**, not a patch. Every omitted key is reset:
- `displayName`, `bio` and `avatarUrl` → NULL;
- `isPublic` → **true**;
- each privacy key → `nobody`.

The PWA always sends every key, so it is unaffected.
- **Enforced:** `server:rpc` (coalesce defaults in DECLARE, `ON CONFLICT (user_id) DO UPDATE` of every column).
- **Source:** live `upsert_my_community_profile`; COM-14.
- **Target:** iOS v1 edits only username, display name and avatar (D-13). It must not wipe the web-only fields. Until the RPC changes (PRO-Q20), iOS sends the stored `bio`, `isPublic` and `privacy` read from `get_my_community_profile` back unchanged.

### Cross-cutting rules and lifecycle

#### PRO-91 · First-delta rule
In every history-delta computation (stats, monthly, records), the first `progress_history` row of a book has delta = its full `page`. A book added "in progress" at page P writes no history (`src/stores/books.ts:214-221`; `progress.ts:425-465`), so it credits P extra pages on the day of its first organic save. This inflates `bestDay` (a possible false `century_day`), monthly bars and `pagesThisWeek` ⚠ PRO-D10.
- **Enforced:** `server:rpc` (`lag(page, 1, 0)` / `coalesce(prev.page, 0)`).
- **Source:** live function bodies.
- **Target:** a baseline history row when a book is added mid-way, excluded from activity, so the starting page is not counted as read (recommended, BC-04; representation SES-Q17).

#### PRO-93 · Book delete
Deleting a book cascades `reading_progress`, `progress_history`, `recaps`, `lore_cards`, `page_captures` and the rest (`*_book_id_fkey ON DELETE CASCADE`). Everything history- or row-based recomputes lower: XP pages, completions, sessions, recaps and lore, streaks, calendar days, monthly bars, records and quest completions. What stays:
- capture XP (PRO-05);
- persisted achievements (PRO-50);
- `reading_dna` (its `books_finished_at_generation` is not lowered);
- `reading_goals`;
- `recap-images` objects.

The client invalidates `library`, `libraryBreakdown` and `readingQuest:*`, but **not** `readingStats`, `readingRecords`, the calendar/monthly caches or the gallery ⚠ PRO-D16, PRO-D14.
- **Enforced:** `server:db` (FKs); `client` (invalidation).
- **Source:** live FKs; `src/stores/books.ts:413-435`.
- **Note:** XP-on-delete policy: LIB-Q15 / PRO-Q18. Full matrix: [11 · Cross-Domain](11-cross-domain.md).

#### PRO-94 · Book completion effects in this domain
`reading_progress.current_page ≥ total_pages` does the following:
- quest and XP completion (+25 XP, manual books only), dated by `updated_at`;
- triggers `page_captures_delete_on_completion` and `book_quizzes_delete_on_completion` purge captures and quizzes, while capture XP survives through the quest events.

Achievements are **not** evaluated at completion (only on the next Trophy Room visit), and DNA only on the next Profile visit.
- **Enforced:** `server:db` (triggers); `client` (late evaluation).
- **Source:** live triggers; `TrophyRoomPage.vue:28-37`; `ProfilePage.vue:48`.
- **Target:** one server owner for completion effects on every client and path (D-06 · BC-05):
  - `completed_at` is stamped;
  - achievements are evaluated (BC-09);
  - DNA eligibility is checked;
  - existing purge triggers stay.

#### PRO-95 · DNF is ignored by every stats RPC
`dnf_at` is ignored by the quest, the stats, the breakdown, the calendar, the monthly chart and the records. Pages of a shelved book still count toward XP. The client excludes DNF only from `inProgressBooks`.
- **Enforced:** `server:rpc` (no `dnf_at` filter); `client`.
- **Source:** live function bodies; `src/stores/progress.ts:679-688`.
- **Note:** policy for "finished"/"in progress" with DNF: LIB-Q11 / PRO-Q01.

#### PRO-96 · A total_pages edit changes completion retroactively
Every completion predicate reads the current `total_pages`: quest, breakdown, monthly finishes and records' fastest finish. Lowering `total_pages` to ≤ `current_page` completes the book with no history row or other effects. The +25 XP is dated by the progress row's last `updated_at`, possibly in a past UTC year. Raising it un-completes the book (−25 XP).
- **Enforced:** `server:rpc` (no trigger on `books`).
- **Source:** live function bodies; LIB-63 in [01](01-library.md).
- **Note:** policy: LIB-Q04 / SES-Q05.

#### PRO-97 · Imported books in this domain
Imported books (`source <> 'manual'`):
- **Excluded from:** quest/XP pages and completions (the `progress_rows` filter), `totalPagesRead`, and `first_book`/`books_*`/`pages_*`.
- **Included in:** the breakdown, the Profile "Books" pill, Book Lengths and the DNA input.
- **History:** the import itself writes none. Once the reader saves progress on an imported book, its history rows count in streaks, calendar, monthly pages and finishes, records, session XP and `sessions_50/100`, because no history-based RPC filters on `source`. Its pages and completion still never count toward XP or the quest, and its first organic save credits the full current page as that day's delta (PRO-91).
- **Enforced:** `server:rpc`; `client`.
- **Source:** live function bodies; `src/stores/books.ts:256-374`.
- **Note:** policy: LIB-Q16 / PRO-Q02.

#### PRO-98 · Manual adds with an initial status
Manual "already finished" or "in progress" adds are `source = 'manual'`. They immediately add pages and +25 XP, and (if finished) count toward the current UTC year's quest. They never appear in history-based surfaces (monthly finishes, records, calendar).
- **Enforced:** `server:rpc`.
- **Source:** `src/stores/books.ts:214-245`; `src/stores/progress.ts:425-466`.
- **Note:** policy: LIB-Q01 / PRO-Q02.

#### PRO-99 · Offline saves write no history
Offline saves are queued in IndexedDB (`chronicler-offline/progress_queue`) and replayed via `syncToSupabase`, which writes only `reading_progress`. **No `progress_history` row** is written, so offline reading never counts toward streaks, calendar, sessions, hours, records, monthly pages or session XP. The queued `updatedAt` is ignored; the server stamps `updated_at = now()` **at drain time**, so a book finished offline on Dec 31 and synced on Jan 2 counts toward the new year. The drain invalidates neither `readingStats` nor `readingQuest` nor `libraryBreakdown` ⚠ PRO-D30.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:656-660`; `src/composables/useOfflineSync.ts:76-87`.
- **Target:** the queued operation replays through `save_progress` with `client_occurred_at`. The history row keeps the original time, and the original time decides `completed_at` and the quest year (D-08 · BC-04).

#### PRO-100 · Activity timestamps come from the device clock
`progress_history.recorded_at` and `reading_progress.session_start_at` are written from the **device clock**. Pause/resume shifts `session_start_at` forward by the paused span. `reading_progress.updated_at` is **server** time. Streak days, calendar days, monthly buckets, records and session durations therefore depend on the device clock, while quest-year membership depends on the server clock.
- **Enforced:** `client` (`src/stores/progress.ts:240-249,284-294,510-518,563-573`).
- **Source:** as cited; SES rules in [02](02-reading-sessions.md).
- **Target:** session and save timestamps use the server clock; client time is used only for offline replays (D-06 · BC-04).

#### PRO-101 · Data invariants these RPCs rely on
- `books.total_pages ≥ 1` (`books_total_pages_check`), so every `total_pages > 0` guard is true in practice.
- `reading_progress.current_page` has **no CHECK** and can exceed `total_pages`; the RPCs clamp with `least()` and cap percentages at 100.
- `progress_history.page ≥ 0`.
- One progress row per `(book_id, user_id)` (`reading_progress_book_id_user_id_key`).
- Role `authenticated` has `statement_timeout = 8s` (`anon` 3 s). `get_reading_records` and `get_monthly_reading` run a per-row lateral sub-select over the full history and are the most likely to hit it (SQLSTATE 57014) ⚠ PRO-D43.
- **Enforced:** `server:db`.
- **Source:** live `pg_constraint`; `pg_roles.rolconfig`.

#### PRO-102 · Detail-page back navigation
Trophy Room, Reading Stats and Profile Edit share one back behaviour: `window.history.length > 1 ? router.back() : router.push({name: 'profile'})`. The pages are deep-link safe, because each loads its own data on mount. Titles: "Trophy Room" (trophy icon), "Reading Stats" (chart icon).
- **Enforced:** `client`.
- **Source:** `TrophyRoomPage.vue:23-26`; `ReadingStatsPage.vue:29-32`; `ProfileEditPage.vue:203-206`.

#### PRO-105 · Account deletion and profile data
No client offers account deletion today. Deleting the `auth.users` row cascades every profile-domain table: `reading_goals`, `achievements`, `reading_dna`, `user_settings`, `reading_quest_events`, `community_profiles` → `community_profile_privacy` and `community_follow_counts`, plus the books chain. Storage objects in `community-avatars/{uid}/` and `recap-images/{uid}/` are **not** removed by any cascade, and `storage.protect_delete` blocks deleting them through SQL.
- **Enforced:** `server:db` (`*_user_id_fkey ON DELETE CASCADE`).
- **Source:** live FKs; COM-95, COM-105 in [10](10-community-circles.md).
- **Target:** account deletion is an immediate hard delete through a new `delete-account` edge function, on web and iOS (D-10 · BC-11). The function:
  - purges `recap-images/{uid}/` and `community-avatars/{uid}/` through the Storage API;
  - revokes the Sign in with Apple token;
  - calls `auth.admin.deleteUser` (FK cascades remove the rows);
  - requires a confirmation and re-authentication.
  See [08 · Platform, Auth & Account](08-platform-auth-account.md).

## Flows

### F-1 · Profile load (web, today)
1. `profileReady = false` → skeleton (avatar circle, strip, 4 covers, 4 pills).
2. `await booksStore.fetchLibraryWithProgress()` (`get_library_with_progress`, SWR).
3. `await Promise.all([progress hydrate (from library entries), dnaStore.fetchDna(), fetchStats(), quest.fetchQuestSummary().catch(noop), fetchBreakdown(), fetchIdentity()])`. Only the quest call is guarded. A rejection from stats, breakdown or library **skips step 4** and surfaces as an unhandled error ⚠ PRO-D19.
4. `await dnaStore.maybeGenerateDna(booksFinished)` can block first paint for the whole AI round-trip.
5. `finally` → `profileReady = true` → the sections fade in: identity, DNA strip, recommendations, stats nav, recap carousel (the carousel fetches its own data on mount).

Persisted: only `reading_dna`, and only when step 4 generates.

### F-2 · DNA generation state machine (web, today)
```
idle --fetchDna--> loading --> idle (row or null; on read error: idle, NOT marked fetched)
Profile mount, after load:
  _shouldGenerate(booksFinished)?
    no  --> stay
    yes --> generating --invoke generate-reading-dna-->
              ok    --> upsert reading_dna --> fetchDna(force) --> loading --> idle
              fail  --> idle (if a DNA exists) | error (no DNA)
error persists until the next Profile mount retries (and re-bills).
Read failure leaves dna = null, so _shouldGenerate sees "no DNA" and regenerates, overwriting (PRO-D11).
```

### F-3 · DNA under Phase 0 (target, BC-05)
1. `save_progress` detects a first completion and stamps `completed_at` (BC-04).
2. The BC-05 pipeline checks DNA eligibility: canonical finished count ≥ 2 and (Δ ≥ 2 since generation, or ≥ 90 days). The 90-day rule also runs as a periodic job, or on the next completion.
3. If eligible and no run is in flight for the user, the job calls Gemini (v8 contract, after the BC-12 usage check), validates against the DB CHECKs, and upserts `reading_dna` with the service role.
4. On failure it keeps the old row and retries with backoff. Clients only `select` the row and show "generating" while a job is pending (if exposed).

### F-4 · DNA recommendation cover resolution (web)
`watch(dna, immediate)` → compute the signature. Then:
1. empty → clear;
2. same signature and all resolved → done;
3. new signature → hydrate from `localStorage` when the length matches; done if all resolved;
4. an in-flight run exists → join it (even across a signature change, PRO-D25).

Otherwise seed placeholders and, for each unresolved item, try Google, then Open Library, else leave it unresolved, publishing after each item. Finally write `localStorage` and set `resolving = false`. Persisted: `localStorage` only.

### F-5 · Trophy Room load
skeleton → `achievements.sync()` (quest + stats + records + ledger in parallel, errors swallowed) → insert newly earned keys → `pageReady` → `QuestGoalHero`, `ReaderLevelStrip` (only if `summary.level`), `AchievementsGrid`. The Trophy Room does not load the library or the progress store.

Partial-failure matrix (no page-level error is ever shown):

| Failure | Effect |
|---|---|
| quest RPC (first load) | hero shows the warn message; level strip hidden; every `sources` badge evaluates locked unless persisted; nothing is wrongly persisted |
| stats | streak badges evaluate from `longestStreakDays = 0` |
| records | record badges locked |
| ledger read | no dates; nothing persisted this visit; next mount retries |

### F-6 · Goal save
1. Open the dialog (seeded with the target, or 12).
2. Submit → local validation.
3. `saveGoal` sets `saving = true` (pencil disabled) → upsert → invalidate `readingQuest:{uid}*` → refetch (sets `loading`; no skeleton, because a summary exists).
4. The dialog closes.

On failure `error` is set and the dialog stays open showing it, while **the hero behind it also switches to the warn message** until a later successful fetch clears `error` (PRO-D18). Persisted: the `reading_goals` row.

### F-7 · Reading Stats load
skeleton → library → parallel(progress, stats, breakdown) → render the monthly chart (fetches its year), the calendar (fetches its month), the lifetime grid, the records card (fetches records), book lengths and the breakdown. Failures:
- The chart and calendar catch with `console.warn` and leave the year/month uncached (retried on the next mount or navigation). On error the chart renders **no bars** with the summary "0 pages · 0 books finished in YYYY".
- `RecordsCard` calls `void fetchRecords()`, so a failure is an unhandled rejection and the card stays hidden.
- A failure of the page-level library/stats/breakdown fetch rejects out of `onMounted` (unhandled), but `finally` still renders zero/empty cards.

Skeletons: the calendar shows 35 cells and the chart one 8 rem block.

### F-8 · Profile edit and save (web, today)
1. Mount → `fetchIdentity()`. It skips if already fetched and allows up to 3 failed attempts per user per session.
2. Hydrate the form from the profile, or start first-run: suggested username, `isPublic = true`, all privacy `nobody`. A **failed** fetch looks exactly like "no profile" here ⚠ PRO-D12.
3. Username: `idle ⇄ checking → {invalid | available | taken | idle (error)}`.
4. Save: `saving` → (pending avatar) downscale → upload `avatar-{ms}.jpg` → fire-and-forget delete of the other avatar files → RPC `upsert_my_community_profile` →
   - success: toast + navigate to `/profile`;
   - failure: inline message. The upload already happened and the old avatar may already be deleted (PRO-D13).

Persisted: a Storage object (step 4, even on failure), `community_profiles` + `community_profile_privacy` (+ `community_follow_counts` on first insert).

### F-9 · iOS v1 profile edit (target, D-13)
1. Load `get_my_community_profile`. If it fails, show an error with retry and **never** the first-run form.
2. Edit username (regex + availability with request cancellation), display name (≤ 60) and avatar (pick → ≤ 512 px JPEG 0.85).
3. Upload the avatar → call the RPC with username, displayName and avatarUrl **plus the stored bio, isPublic and privacy unchanged** (PRO-104), until PRO-Q20 ships a keep-absent-keys RPC.
4. After success, delete stale avatar files. On failure delete the just-uploaded file.

### F-10 · Achievement earning
- **Today:** the condition becomes true; the earned date is written only when the Trophy Room is visited (ledger insert with `earned_at = now()` at the visit). Until then the badge shows as earned without a date. A condition that later becomes false stays earned only if it was persisted.
- **Target (BC-09):** every server write that can change an input (`save_progress`, capture insert, recap or Insight persist, completion pipeline) re-evaluates the catalog for that user and inserts newly satisfied keys with the event time (`ON CONFLICT DO NOTHING`). Clients read the ledger and render.

### F-11 · Quest-year membership (today vs target)
| Event | Today | Target (BC-04 · BC-06) |
|---|---|---|
| Finish online on Dec 31, 21:00 local, UTC−5 | counts toward next year (`updated_at` Jan 1 UTC) | this year (reader-zone window, `completed_at`) |
| Re-save a page on a book finished last year | moves it into this year | no change (`completed_at` is a first-completion stamp) |
| Finish offline Dec 31, sync Jan 2 | next year (drain time) | this year (`client_occurred_at`) |
| Lower `total_pages` below `current_page` | counts in the year of the last `updated_at` | per LIB-Q04 / SES-Q05 |

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| XP weights | page 1 · book 25 · history row 10 · capture 5 · recap 20 · lore 15 | XP formula | `get_reading_quest_summary` CTE `xp` |
| `LEVEL_THRESHOLDS` | 0 / 1500 / 4000 / 8000 / 14000 / 22000 / 34000 | level floors (levels 0–6) | `src/stores/readingQuest.ts:22`; RPC `level_calc` |
| `LEVEL_TITLES` | Page Turner … Library Legend (7) | level names | `readingQuest.ts:23-31` |
| Month length | 2 629 800 s (30.4375 d) | months-elapsed divisor | RPC CTE `months` |
| Status ratios | 1.1 / 1.0 / 0.75 | ahead / on track / behind | `readingQuest.ts:59-61`; RPC |
| Goal default / min / max (UI) | 12 / 1 / 999 | dialog | `ReadingGoalDialog.vue:15-16,63` |
| Goal year range (DB) | 2000–2100 | CHECK | `reading_goals_year_check` |
| Weekly goal | default 3, range 1–7 | dormant | `user_settings_weekly_goal_check` |
| Retention comeback | ≥ 14 days | dormant nudge | `get_retention_summary` |
| Meaningful session | timed, ≥ 60 s, ≥ 1 page | sessions / hours / velocity | `get_reading_stats` |
| Session record cap | 12 h | longest session, night owl | `get_reading_records` |
| Night-owl hours | local hour 0–4 (00:00–04:59) | record flag | `get_reading_records` |
| Streak tolerance | last day ≥ today − 1 (UTC) | current streak alive | `get_reading_stats` |
| Achievement count | 17 | "N of 17" | `src/utils/achievements.ts:28-154` |
| Badge thresholds | books 1/5/10; pages 1 000/10 000; sessions 50/100; captures 1/50; recap 1; Insight 1; streak 7/30; day ≥ 100 pages; session ≥ 120 min; finish ≤ 3 days | unlock | `src/utils/achievements.ts` |
| DNA `FINISHED_THRESHOLD` | 2 | first generation and regeneration delta | `readingDna.ts:21`; `DnaSignatureStrip.vue:11` |
| DNA `DAYS_THRESHOLD` | 90 days | time-based regeneration | `readingDna.ts:22` |
| DNA limits | personality 50–800 · tone 1–40 · emojis 1–5 (prompt asks for 3) · suggestions 3–5 | validation | edge v8; `reading_dna_*_check` |
| DNA model config (v8, canonical) | `gemini-2.5-flash`, temperature 0.85, 2048 tokens, `thinkingBudget: 1`, `googleSearch` tool | AI call | deployed `generate-reading-dna` v8 |
| DNA covers key | `bookhero:dna-covers` | `localStorage` | `useDnaRecommendations.ts:19` |
| Recommendation search | Google page size 20; Open Library `limit=3` | cover lookup | `useDnaRecommendations.ts:94`; `bookSearchService.ts` |
| Gallery limit / signed URL TTL | 12 / 3600 s | recap memories | `useRecapGallery.ts:11-12` |
| Avatar pick max | 8 MB | pre-processing | `ProfileEditPage.vue:27` |
| Avatar output | ≤ 512 px, JPEG 0.85 | downscale | `useCommunityIdentity.ts:14-15` |
| Avatar bucket | public, 5 MB, jpeg/png/webp | storage | `storage.buckets` (`community-avatars`) |
| Username | `^[a-z0-9_-]{3,30}$`; reserved `admin, api, auth, bookhero, login, profile, u` | identity | CHECK; `is_username_available` |
| Username debounce | 400 ms (maxWait 1500 ms) | availability | `ProfileEditPage.vue:128` |
| Display name max | 60 (client only) | input | `ProfileEditPage.vue:317` |
| Bio max | 160 | client + DB | `ProfileEditPage.vue:26`; `community_profiles_bio_len_chk` |
| Identity fetch attempts | 3 per user per session | resilience | `useCommunityIdentity.ts:51` |
| Profile-saved toast | 2500 ms | feedback | `ProfileEditPage.vue:189-193` |
| Pill compact threshold | ≥ 10 000 → `k` | formatting | `ProfileStatsNav.vue:13-16` |
| Genre segments | 4 + "Other (n)" | breakdown bar | `LibraryBreakdownCard.vue:12` |
| Bar min heights | 3 px (0 pages) / 6 % | chart | `MonthlyReadingChart.vue:39-40` |
| Rings | r = 33 (header), r = 62 (hero) | SVG | `ProfileIdentityHeader.vue:11`; `QuestGoalHero.vue:11` |
| Calendar skeleton | 35 cells | loading grid | `ReadingCalendarCard.vue:128-130` |
| SWR TTLs | quest 60 s; stats / breakdown / records 120 s; progress 30 s | freshness | `readingQuest.ts:20`; `useReadingProfile.ts:22`; `useLibraryBreakdown.ts:20`; `useReadingRecords.ts:19`; `progress.ts:20` |
| Import placeholder pages | 100 | `total_pages` for unresolved imports | `src/stores/books.ts:254` |
| DB statement timeout | authenticated 8 s / anon 3 s | RPC hard limit | `pg_roles.rolconfig` |

## Data touchpoints

Shapes: [backend-contract](../backend-contract.md) §3 Tables, §8 RPC catalogue, §10 Edge functions.

| Object | Read / write | By whom |
|---|---|---|
| `reading_goals` | R (quest RPC) / W upsert `onConflict user_id,year` | client (`readingQuest.ts:163-168`) |
| `reading_quest_events` | R (quest RPC) / W | trigger `record_page_capture_quest_event` only (RLS: owner SELECT) |
| `achievements` | R ledger / W upsert `ignoreDuplicates` | client today (`useAchievements.ts:51-97`); server under BC-09 |
| `reading_dna` | R / W upsert `onConflict user_id` | client today (`readingDna.ts`); server under BC-05; also read by dormant `get_public_profile_by_username` |
| `user_settings` | none / W | `upsert_weekly_goal` only (unused); planned home of the reader zone (BC-06) |
| `community_profiles`, `community_profile_privacy`, `community_follow_counts` | R / W | `get_my_community_profile`, `upsert_my_community_profile`; trigger for counts |
| `books`, `reading_progress`, `progress_history`, `recaps`, `lore_cards`, `page_captures` | R | stats / quest RPCs; progress store; gallery query |
| `get_reading_quest_summary(p_user_id, p_year)` | R | Profile, Trophy Room, achievements |
| `get_reading_stats(p_user_id)` | R | Profile pills, lifetime grid, streak badges |
| `get_library_breakdown(p_user_id)` | R | Profile, Stats |
| `get_reading_calendar(p_user_id, p_month_start, p_timezone)` | R | Stats |
| `get_monthly_reading(p_user_id, p_year, p_timezone)` | R | Stats |
| `get_reading_records(p_user_id, p_timezone)` | R | Stats, record badges |
| `get_library_with_progress(p_user_id)` | R | Profile, Stats (first call) |
| `is_username_available(p_username)` | R | Profile edit |
| `upsert_weekly_goal`, `get_retention_summary`, `get_public_profile_by_username` | — | dormant |
| `generate-reading-dna` (edge) | call | Profile mount (client) today |
| `community-avatars/{uid}/avatar-{ms}.jpg` | R public / W | client upload + cleanup |
| `recap-images/{uid}/…` | R (signed, 3600 s) | gallery |
| Google Books, Open Library search + covers | R | DNA recommendation covers (client) |

## Client-side logic & server migration

| # | Rule (IDs) | Today | Moves to / stays | Owner |
|---|---|---|---|---|
| 1 | Level and status recomputation (PRO-08, PRO-14) | client mirror overwrites server values | server already authoritative; native trusts the RPC | server |
| 2 | Quest year choice (PRO-20, PRO-09) | device-local year into a UTC window | reader zone stored server-side; the client year is advisory (BC-06) | server |
| 3 | Goal validation 1–999, default 12 (PRO-19) | client; DB only ≥ 1 | stays client (UI); a DB max is optional | client |
| 4 | Achievement catalog, conditions, sync, earned merge (PRO-47…51) | client only; server accepts any key | SQL catalog + evaluation, server `earned_at` (BC-09) | server |
| 5 | DNA thresholds, input, AI call, upsert (PRO-53…60) | client on Profile mount | completion-pipeline job (BC-05), usage check (BC-12) | server |
| 6 | "Books finished" for pill, Book Lengths and DNA (PRO-40) | progress-store percentage ≥ 100 | one server definition (PRO-Q01); clients display it | server |
| 7 | Time zone for stats (PRO-32) | client sends to 3 RPCs | every stats RPC takes `p_timezone`; stored zone for jobs (BC-06) | both |
| 8 | History row per save, timestamps (PRO-04, PRO-100) | client insert after upsert; device clock | `save_progress` atomic, server clock (BC-04) | server |
| 9 | Offline replay (PRO-99) | progress upsert only | replay `save_progress` with `client_occurred_at` (BC-04) | both |
| 10 | DNA recommendation covers + cache (PRO-64…67) | client, direct Google/Open Library | stays client; search behind the BC-15 proxy; cache per user + signature | client |
| 11 | Recap gallery query + signing (PRO-69…71) | client | stays client; re-sign on expiry; purge on delete (BC-13) | client |
| 12 | Display derivations: pills, grid, book lengths, genre bar, records labels, chart bars, calendar grid, navigation limits (PRO-37…46) | client | stays client | client |
| 13 | Username normalization, regex, debounce, suggestion, "same as saved" shortcut (PRO-74…79) | client UX; server authoritative | stays client | client |
| 14 | Display-name 60-character cap (PRO-80) | client only | add a server CHECK/RPC check (PRO-D07) | server |
| 15 | Avatar pipeline (PRO-84…86) | client | stays client; clean up only after a successful save | client |
| 16 | Error → copy mapping (PRO-88) | substring match | stays client; prefer error codes | client |
| 17 | Reader name, initials, greeting (PRO-90, PRO-92) | client | stays client | client |
| 18 | Profile full-replace round-trip (PRO-104) | web sends all keys | keep-absent-keys RPC (PRO-Q20); until then iOS round-trips | server |
| 19 | Cache invalidation matrix (Caching & offline) | client, with gaps | stays client; close the gaps (PRO-D16) | client |

## Caching & offline

| Key / store | Lifetime | Revalidation | Invalidated by |
|---|---|---|---|
| `readingQuest:{uid}:{year}` (SWR) | 60 s | background when stale; `visibilitychange` revalidator | prefix `readingQuest:{uid}` on book add, add-with-status, import, edit, delete, `setInitialProgress`, online progress save, capture save, lore unlock, recap generated, goal save. **Not** on DNF or offline drain |
| `readingStats:{uid}` | 120 s | same | add-with-status, import, `setInitialProgress`, online progress save. **Not** on book delete, DNF, capture, offline drain |
| `libraryBreakdown:{uid}` | 120 s | same | add, add-with-status, import, edit, delete, `setInitialProgress`. **Not** on session saves (finishing a book) or DNF |
| `readingRecords:{uid}` | 120 s | same | **never explicitly invalidated** |
| Monthly chart (`useMonthlyReading`, Map by year) | app session | none | user switch only; the current year never refreshes until reload, contrary to the code comment |
| Calendar (`useReadingCalendar`, Map by `yyyy-MM`) | app session | none | user switch only |
| Recap gallery | app session | none | user switch. Signed URLs expire after 1 h; new images and deleted books are not reflected |
| Quest store `summary` (Pinia) | until replaced | SWR above | `clearAll()` resets only SWR entries, so the previous account's summary stays visible until the new account's first successful fetch |
| DNA row | app session per user | `fetchDna({force})` after generation | user switch |
| Community identity | app session per user | `fetchIdentity({force})` | the save updates it in place; reset on uid change |
| Achievements `_earned` / `_earnedLoaded` | app session, **not user-scoped** | none | never (PRO-D09) |
| Stats / records / breakdown module refs | until refetch | SWR | not reset on user switch; old values visible until refetch |
| `localStorage bookhero:dna-covers` | persistent, no TTL | signature change | DNA regeneration |
| SWR semantics | `invalidate()` sets `fetchedAt = 0`, so the next access is a *blocking* `loading` fetch (data refs kept). `clearAll()` runs on auth user change but does not reset module-level refs | | |

**Offline:** this domain has no offline support. RPC failures leave zeros or empty states, indistinguishable from "no data". Offline progress saves write no history (PRO-99). Profile edit, goal save, DNA and achievements all need the network.

**Native guidance:** mirror the TTLs, and treat `scenePhase == .active` as the `visibilitychange` revalidation. Persist the last-known aggregates (quest, stats, records, ledger, DNA) per user, and render them offline with an "as of" hint instead of zeros. Close the invalidation gaps:
- a progress save refreshes stats, records, breakdown, calendar month and chart year;
- a delete refreshes stats, records and the gallery;
- DNF refreshes stats, breakdown and quest;
- an image success refreshes the gallery.

Wipe every per-user cache on user change.

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| PRO-D01 | `get_reading_quest_summary` guard is NULL-unsafe and the function is anon/PUBLIC-executable (PRO-17). | An unauthenticated caller with any UUID reads that user's goal, yearly completions and XP sources. UUIDs leak through the public-profile payload. | BC-01: `auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()` → raise; revoke anon/PUBLIC. **Fixed 2026-10-19 (BC-01).** |
| PRO-D02 | `get_library_breakdown` has no owner check (PRO-31). | Any signed-in user reads anyone's genre, author and status composition, bypassing privacy. | BC-01 owner assert; keep the param. **Fixed 2026-10-19 (BC-01).** |
| PRO-D03 | `get_library_with_progress` (first call on Profile and Stats), `get_last_session` and `get_reading_velocity` never reference `auth.uid()` (same as SES-D01). | Full library (titles, ISBNs, progress, DNF, active session) readable by UUID. | BC-01 owner assert. **Fixed 2026-10-19 (BC-01).** |
| PRO-D04 | `prune_page_captures_for_book` is SECURITY DEFINER, anon-executable, has no auth check and deletes captures; its only caller, `after_page_capture_saved`, is attached to no trigger. | Anyone can delete another user's captures by ids. | BC-01: drop or lock both. **Fixed 2026-10-19 (BC-01):** both dropped. |
| PRO-D05 | `get_reading_calendar`, `get_monthly_reading`, `get_reading_records`, `upsert_weekly_goal` and `get_retention_summary` are PUBLIC/anon-executable; `pg_default_acl` grants EXECUTE on every new function. | Safe today only through internal guards; a widened attack surface. | BC-01: revoke and fix default ACLs. **Fixed 2026-10-19 (BC-01):** PUBLIC/anon `EXECUTE` revoked (`upsert_weekly_goal` and `get_retention_summary` are no longer client-executable); default ACL fixed for owner `postgres`. |
| PRO-D06 | `generate-reading-dna` hand-decodes the JWT (it relies on gateway `verify_jwt: true`), interpolates titles unescaped, has no cap on `books[]` and no usage/entitlement check (PRO-61). | Cost and abuse exposure; prompt injection through titles. | BC-02 (real verification), BC-12 (usage check), cap the list, quote titles. |
| PRO-D07 | `upsert_my_community_profile` accepts any `avatarUrl` and an unbounded display name (PRO-80). | Profiles can point to arbitrary URLs; very long names break layouts. | Validate that `avatarUrl` is the caller's own `community-avatars/{uid}/` public URL (or NULL); CHECK `char_length(display_name) ≤ 60`. |
| PRO-D08 | Achievements accept arbitrary keys; `progress_history` is owner-ALL under RLS, so XP inputs are client-writable (PRO-47). | Trivial cheating; matters for any leaderboard or Game Center. | BC-09 server catalog; BC-04 server-written history. |
| PRO-D09 | Module-level state survives an account switch: achievements `_earned`/`_earnedLoaded`, stats, breakdown and records refs, and the quest `summary`. Sign-out does not reload. | The second account sees the first account's badge dates and skips persisting its own. | Reset all per-user state on uid change. |
| PRO-D10 | The first history row of a book counts its whole page (PRO-91). | Inflated best day, a false `century_day`, monthly bars, `pagesThisWeek`; a false `devoured` for books started elsewhere. | BC-04 baseline row (SES-Q17). |
| PRO-D11 | A DNA read failure leaves `dna = null`, so generation runs and overwrites the existing DNA (PRO-54). | Wasted AI call; the reader's DNA silently replaced. | BC-05 server ownership; meanwhile skip generation unless the read succeeded. |
| PRO-D12 | Profile edit treats a failed identity fetch as "no profile" and shows the first-run form; saving overwrites bio, avatar and privacy with blanks/defaults. | Data loss on a flaky network. | Distinguish error from "no row"; block the save until loaded. |
| PRO-D13 | Avatar cleanup runs right after upload, before the profile save (PRO-86). | If the save fails, the referenced avatar is already deleted, leaving a broken avatar and an orphan upload. | Delete stale files only after a successful save; delete the new file on failure. |
| PRO-D14 | The recap gallery is cached for the session while signed URLs expire after 1 h; errors are cached as "No memories yet"; deleted books' images keep rendering and tap through to a missing book; new images never appear (PRO-71). | Broken images in long sessions; ghost memories. | Re-sign on expiry/foreground; invalidate on recap image success and book delete; BC-13 deletes the objects. |
| PRO-D15 | The monthly chart and calendar never refetch the current year/month in a session. | Today's reading is missing until reload. | TTL + invalidation on progress save. |
| PRO-D16 | Invalidation gaps: `readingRecords` is never invalidated; `readingStats` not on delete, DNF or offline drain; `libraryBreakdown` not on session saves or DNF; quest not on DNF or drain. | Stale stats for up to 120 s, or until reload. | Close the matrix (Caching & offline). |
| PRO-D17 | When Google returns results without a cover, the Open Library fallback is skipped and the item is retried every visit (PRO-65). | Missing covers; repeated Google quota use. | Fall back to Open Library when the chosen result has no cover. |
| PRO-D18 | `QuestGoalHero` shows the raw error instead of a still-valid summary; a failed goal save swaps the hero behind the dialog; `error` lingers while the cache is fresh (PRO-106). | Confusing error state; raw PostgREST text shown. | Show stale data plus a friendly inline error; scope save errors to the dialog. |
| PRO-D19 | Profile `Promise.all` lacks per-call catches; DNA generation blocks first paint; `useReadingProfile()` auto-fires an unhandled `fetchStats()`; stats card errors render as zeros. | One failing RPC skips DNA and leaves unhandled rejections; slow first paint; errors look like "no data". | `allSettled`; render first, then generate (or BC-05); explicit error/retry states. |
| PRO-D20 | Username availability responses are not sequenced (PRO-77). | A slow older response can overwrite the state for a newer value. | Cancel or sequence requests. |
| PRO-D21 | Reserved usernames show "taken" during the check but "Usernames are 3–30 characters…" on save. | Confusing copy. | Return a reason code (`reserved`) from `is_username_available`. |
| PRO-D22 | Without a 2D context the raw file (possibly PNG/HEIC, up to 8 MB) is uploaded labelled `image/jpeg` (PRO-85). | Exceeds the 5 MB bucket limit, or a mislabelled type. | Refuse with copy instead of uploading the raw file. |
| PRO-D23 | `get_my_community_profile` inner-joins privacy; a profile row without a privacy row reads as "no profile". | Triggers PRO-D12-style overwrites. | Left join with default privacy. |
| PRO-D24 | `earned_at` is the Trophy Room visit time; the ledger is read once per session; a second device stamps its own local time (PRO-51). | Wrong earned dates; multi-device disagreement. | BC-09 server-authoritative `earned_at`. |
| PRO-D25 | DNA cover resolution reuses the in-flight promise even after the suggestion signature changed (PRO-66). | The new set is not resolved until the next remount. | Key the in-flight promise by signature. |
| PRO-D26 | Identity fetch failures are capped at 3 per user per session, with no error or retry UI. | The greeting stays nameless; the edit page shows first-run (PRO-D12). | Visible error with a retry affordance. |
| PRO-D27 | A capture saved on a completed book is deleted in the same statement, while its +5 XP event survives (PRO-05; same as SES-D13). | The capture vanishes; XP and capture badges are still awarded; vocabulary-ledger FK failures. | CAP-Q02: hide the prompt for complete books; the trigger skips or removes the event when it purges. |
| PRO-D28 | The history insert failure is swallowed after a successful progress upsert (PRO-04). | The save earns no session XP and no streak day. | BC-04 atomic save. |
| PRO-D29 | The DNA strip renders an empty card when ≥ 2 books are finished, no DNA exists and generation did not run (PRO-63). | A blank component. | Add a fallback branch (generating / retry). |
| PRO-D30 | Offline saves write no history, and the drain stamps `updated_at` at drain time (PRO-99). | Offline reading is invisible to stats and badges; quest-year errors. | BC-04 replay with `client_occurred_at` (D-08). |
| PRO-D31 | Quest year: a UTC window, `updated_at` membership and a device-local year request (PRO-09, PRO-10). | Books jump years around New Year and after re-saves. | BC-04 `completed_at` + BC-06 reader zone. |
| PRO-D32 | Time-zone mix: quest year, streaks and "this month" are UTC; calendar, chart and records use the device zone; the goal year is local. | The calendar shows a run that the streak count denies. | BC-06 everywhere. |
| PRO-D33 | Five "books finished" definitions: Profile pill/DNA/Book Lengths (store, incl. imports and DNF at 100 %), breakdown (all books), XP/achievements (manual, lifetime), quest (manual, UTC `updated_at` year), monthly chart (first history finish). | "Books 10" next to a locked "First victory"; the yearly quest and the monthly sums disagree. | One canonical definition (PRO-Q01) on `completed_at`. |
| PRO-D34 | Three "session" definitions: XP/`sessions_50/100` (every history row), `sessionsThisMonth`/hours/velocity (meaningful), records (any timed row ≤ 12 h). | Pencil edits farm session XP and badges. | D-08 · BC-04; threshold PRO-Q19. |
| PRO-D35 | The 12 h outlier cap applies to records but not to `totalReadingHours` or velocity. | A forgotten timer inflates hours. | PRO-Q11. |
| PRO-D36 | The DNA store comment says threshold 3 while the code uses 2; spec FR-009 input (recaps/lore/captures) is not implemented. | Misleading docs; thin DNA input. | Fix the comment; PRO-Q05. |
| PRO-D37 | `generate-reading-dna` repo ≠ deployed v8 (`thinkingBudget` 0 vs 1, no tools vs `googleSearch`); misplaced `dynamicRetrievalConfig` (PRO-62). | A redeploy from the repo silently changes behaviour. | BC-03 sync the repo to v8 (D-09). |
| PRO-D38 | Dormant `get_public_profile_by_username` stats count imports, ignore DNF for `currentlyReading` and use UTC streaks (COM-28/COM-29). | A public number would differ from the owner's view. | Align with PRO-Q01 before the Community phase. |
| PRO-D39 | Copy drift: `ProfileIdentityHeader.vue:2-4` comment says the tap opens the Trophy Room; the first-run intro says "private until you say otherwise" while `isPublic` defaults on; the quest CTA says "BookHero will track your pace" (D-03). | Misleading comment and copy; wrong product name. | Fix the comment; fix the copy with PRO-Q08; "The Chronicler" in copy. |
| PRO-D40 | Dead outputs: `pagesThisWeek`, `pagesThisMonth`, `avgCompletionPct`; the unreachable `'Unknown Book'` fallback in the calendar; the 5th genre color. | Contract noise. | Document as unused; drop or define in BC-06. |
| PRO-D41 | Duplicate indexes: `reading_goals_user_year_idx` ≡ `reading_goals_user_year_key`; two `progress_history (user_id, recorded_at)` indexes. | Write overhead. | BC-01 duplicate-index cleanup. **Fixed 2026-10-19 (BC-01):** `reading_goals_user_year_idx` and `progress_history_user_recorded_at_idx` dropped. |
| PRO-D42 | No repo migration for the community schema, `user_settings`, `upsert_weekly_goal` or `get_retention_summary`. | The repo cannot reproduce production. | BC-03 baseline migration. |
| PRO-D43 | Delta drift: `get_reading_stats` uses `lag()` ordered by `(recorded_at, id)`, while monthly and records use a strict-`<` lateral without an `id` tiebreak; the per-row lateral risks the 8 s timeout at scale. | Totals differ across screens; possible 57014 timeouts. | One shared delta CTE (window function, high-water) in the BC-06 rewrite. |
| PRO-D44 | DNA suggestions are not filtered against the reader's library (spec 016 FR-027) (PRO-64). | Recommends books the reader already owns. | Pass the library titles as exclusions in the prompt and filter server-side before persisting. |
| PRO-D45 | `reading_dna_mood_emojis_check` accepts `{}`; JS `.length` (UTF-16) vs `char_length` (code points) mismatch (PRO-52). | Invalid rows possible; rare upsert failures. | CHECK with `cardinality()`; validate in code points. |
| PRO-D46 | `upsert_weekly_goal(NULL)` passes the range check and fails `NOT NULL` with a raw error (PRO-36). | Raw error text. | `p_goal IS NULL OR …` guard. |
| PRO-D47 | The `isPublic` cast in DECLARE raises a raw 22P02 before `not_authenticated`, and the handler cannot catch it (PRO-88). | Native clients sending a bad boolean get an unmapped error. | Validate inside the body and raise `visibility_invalid`; send JSON booleans. |

## Open decisions

Questions answered by the 2026-10-18 decisions and therefore not repeated: time-zone policy (D-07), session XP and the treatment of pencil corrections (D-08), offline reading counting (D-08), moving achievements and DNA server-side (D-06 · BC-09/BC-05), the DNA grounding config (D-09), security fix timing (BC-01 Required), account deletion (D-10), iOS profile scope (D-13). Moved to Known defects as fixes: blocking first paint on DNA (PRO-D19) and suggestions already in the library (PRO-D44).

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| PRO-Q01 | What is the one canonical "books finished" (and "in progress") used by the Profile pill, Book Lengths, DNA gating, breakdown, badges, XP and quest? Do DNF books at 100 % count? | Five definitions (PRO-D33); DNF ignored server-side, and DNF at 100 % counts on the Profile. | Finished = `completed_at IS NOT NULL` (BC-04) and not currently DNF. One server definition exposed by the stats RPCs; add a DNF bucket to the breakdown (aligns with LIB-Q11). Imports per PRO-Q02. |
| PRO-Q02 | Which completions and pages earn XP and quest credit when they were not read in the app: manual "already finished" or "in progress at P" adds, imports, and imports later read in-app? | Manual adds earn pages and +25 XP and count for the quest at once; imports never count, even when read in-app (PRO-97, PRO-98). | Treat all of them as backfill (aligns with LIB-Q01/LIB-Q16): they count in "books finished" but earn no XP. In-app progress above a baseline (BC-04) earns XP like any manual book. For the quest, count a backfill only when it carries a real completion date in that year (import "Date Read", LIB-Q08); manual adds stamped at add time do not count. |
| PRO-Q03 | Should "Pace needed" stay `target/12`, or become remaining books ÷ remaining months? | Constant `target/12` (PRO-12). | Add a `remainingBooksPerMonth` field (remaining ÷ max(1, remaining reader-zone months)) and show it. Keep the old field for the PWA (D-05). |
| PRO-Q04 | Display levels 0-based ("Lv 0 · Page Turner") or 1-based? | 0-based everywhere (PRO-07). | Keep the API 0-based. Display `level + 1` on web and iOS at the same release, because "Lv 0" reads as broken. |
| PRO-Q05 | DNA threshold and input: 2 books (code) or 3 (spec)? Count imports? Feed recaps, Insights and captures (spec FR-009)? | 2; imports included; titles and authors only (PRO-55, PRO-58). | Keep 2 on the canonical finished set (PRO-Q01). Exclude imports until read in-app, so a large import does not trigger an AI call. Keep title/author input for v1. |
| PRO-Q06 | Offer a manual "Regenerate DNA"? | None (spec 016 FR-012). | Not in v1; revisit with entitlements (BC-12, D-14). |
| PRO-Q07 | Weekly goal: build a UI (and what does 1–7 mean) or drop `user_settings.weekly_goal`, `upsert_weekly_goal` and `get_retention_summary`? | Backend-only, unused (PRO-36, PRO-103). | Same question as BE-Q01 ([09](09-database-invariants.md), which owns the backend decision) and PLT-Q13. Keep it out of iOS v1, and drop the two RPCs unless a weekly-goal feature is on the roadmap. If it is revived, use `get_retention_summary` semantics (timed sessions per ISO week in the reader zone), aligned with D-08. `user_settings` becomes the home of the reader zone either way (BC-06). |
| PRO-Q08 | Default visibility of new profiles: the web defaults `isPublic = true` while its copy promises privacy; iOS has no toggle (D-13). | Web first-run true; RPC default true; column default false (PRO-82). | Default `false` on every client while discovery is dormant; fix the web copy; existing values untouched. |
| PRO-Q09 | Celebrate newly earned badges? Mirror to Game Center? | No feedback; earned silently on Trophy Room visit. | Quiet in-app banner + haptic from the keys BC-09 returns ("present but quiet"); Game Center later. |
| PRO-Q10 | How are `completed_at` and existing ledger dates backfilled when BC-04/BC-09 ship? | No `completed_at`; ledger dates = visit times. | `completed_at` = first history row with `page ≥ total_pages`, else `reading_progress.updated_at` for manual completions; imports per LIB-Q08. Never rewrite existing `earned_at`. |
| PRO-Q11 | Apply the 12 h outlier cap (or session expiry, SES-Q16) to hours and velocity? | Only records are capped (PRO-D35). | Yes: one cap for every duration-based stat. |
| PRO-Q12 | What should a tap on the identity header open? | Profile edit; the caption invites "Set a yearly goal" (PRO-38). | Avatar/name → profile edit; ring/caption → Trophy Room. |
| PRO-Q13 | Allow goals for other years (next year in December; past results)? | Current year only (PRO-20). | Allow next year from Dec 1 (reader zone); read-only past years in the Trophy Room. |
| PRO-Q14 | Offer "Remove photo"? Keep the 8 MB pick limit? | No removal; 8 MB pre-processing limit (PRO-84, PRO-87). | Add removal (the RPC already accepts an empty `avatarUrl`; also delete the files); keep 8 MB because images are downscaled before upload. |
| PRO-Q15 | Calendar week start: Monday or the device locale? | Monday-first (PRO-46). | Follow the locale (`Calendar.firstWeekday` on iOS) on all clients. |
| PRO-Q16 | Exclude placeholder page counts from Book Lengths? | Included (PRO-43). | Exclude `page_count_estimated = true`. |
| PRO-Q17 | Should a capture saved on a completed book earn +5 XP? | Yes, while the capture is deleted (PRO-D27). | Decided together with CAP-Q02 (owner [04](04-capture-resume-quiz.md)): no XP; hide the prompt. |
| PRO-Q18 | Should deleting a book lower XP and level? | Yes, except capture XP; badges stay (PRO-93). | Decided together with LIB-Q15 (owner [01](01-library.md)). |
| PRO-Q19 | Under D-08, which timed sessions count as "real" for session XP, `sessions_50/100` and `sessionsThisMonth`? | XP counts every row; `sessionsThisMonth` uses ≥ 60 s and ≥ 1 page; records any timed row. | The meaningful-session definition (timed, ≥ 60 s, ≥ 1 page, server clock), applied to all three. |
| PRO-Q20 | iOS edits only username, display name and avatar, but the RPC is a full replace. Change the RPC or require round-tripping? | Full replace (PRO-104). | Make `upsert_my_community_profile` keep current values for absent keys. This is backward compatible, because the PWA always sends every key. Until then iOS round-trips. |
| PRO-Q21 | Reserve the product name in usernames (D-03)? | Reserved list has `bookhero`, not `chronicler` (PRO-74). | Add `chronicler`, `thechronicler`, `the-chronicler`, `the_chronicler`, after checking that no existing profile holds them. |

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

- **Screens:** Profile (tab) → push **Trophy Room** and **Reading Stats** (two separate destinations), plus **Profile Edit**. The carousel opens Recap History. Back pops; never hard-code the parent.
- **Trust the server:** render `level`, `quest.status` and `statusLabel` from `get_reading_quest_summary`; do not port the client mirror (PRO-08, PRO-14). After BC-09, render the ledger only, and after BC-05 read `reading_dna` only. Until then, replicate PRO-51 and PRO-55…60 exactly, re-read the ledger per user after each sync, and never stamp local times.
- **Achievement keys** are a persisted contract: the 17 strings of PRO-47, verbatim.
- **Time zone:** send a valid IANA id (`p_timezone`) to every stats RPC that takes one. Treat `YYYY-MM-DD` fields as floating dates. Until BC-06, remember that streaks, "this month" and the quest year are UTC server-side; widgets and notifications must not promise local-day streaks.
- **Books finished:** until PRO-Q01, compute it from the library payload (`percentage ≥ 100`, imports included), exactly like the web, so DNA gating matches.
- **Profile save:** never send a partial payload today (PRO-104). Distinguish "failed to load" from "no profile" (PRO-D12). Clean up stale avatars only after a successful save (PRO-D13).
- **String limits:** the server counts code points (`char_length`). Validate bio ≤ 160 and display name ≤ 60 in Unicode scalars, not grapheme clusters or UTF-16. Send JSON booleans for `isPublic` (PRO-D47).
- **Errors:** RPCs are killed at 8 s (SQLSTATE 57014). Show a retry state, not zeros. Map P0001 messages to the PRO-88 copy.
- **Multi-device:** web and iOS both run today's client-side DNA check and achievement sync. Before invoking DNA, re-check `reading_dna.generated_at` (or wait for BC-05), and never generate after a failed read (PRO-D11).
- **Recommendation covers:** use the same Google → Open Library chain (behind the BC-15 proxy when available), with `langRestrict` = the device language. Cache per user + signature. Show the AI `reason` visibly, because touch has no hover.
- **Recap images:** request signed URLs (3600 s), re-sign on expiry and on foreground, and cache image bytes by recap id, not by URL. Purge items on book delete.
- **First paint:** never block the Profile on DNA generation; render, then swap the strip in.

### iOS-specific (iOS 26+, iPhone first — D-04)

- **Scope (D-13):** v1 profile = username, display name, avatar. No bio, no privacy settings, no public toggle. Community discovery, follows and circles stay out.
- **Glass:** Profile cards, the DNA sheet and the stat tiles use native Liquid Glass (`.glassEffect`, `GlassEffectContainer` for grouped tiles), with no pre-iOS-26 fallback. Respect Reduce Transparency and Increase Contrast with solid materials.
- **Rings:** `Circle().trim(from: 0, to: p).rotation(.degrees(-90))` for the header (avatar inside) and the hero. Animate with `.smooth`, and respect Reduce Motion.
- **Charts:** Swift Charts `BarMark` (12 marks, selection via `chartXSelection`) with an `AXChartDescriptor` for Audio Graphs.
- **Calendar:** `LazyVGrid(columns: 7)`. Use `Calendar(identifier: .gregorian)` with `TimeZone.current` for the month start, and send `p_month_start` as `yyyy-MM-dd` with a POSIX formatter. Week start: PRO-Q15.
- **Achievements:** SF Symbols mapping suggestion: flag, book, crown, doc.text, cylinder.split.1x2, calendar, calendar.badge.plus, camera, photo.on.rectangle, sparkles, eye, bolt, checkmark.seal, gauge.high, clock, forward, moon.stars, and lock for locked badges. Optional quiet `.sensoryFeedback(.success)` on new keys (PRO-Q09).
- **DNA sheet:** `.sheet` with `.presentationDetents([.medium, .large])`. The tone is displayed uppercased; the stored casing is kept.
- **Avatar:** `PhotosPicker` (no library permission prompt) and optional camera (`NSCameraUsageDescription`). Honour orientation, resize to ≤ 512 px with `UIGraphicsImageRenderer`, and encode with `jpegData(compressionQuality: 0.85)`, which strips EXIF/GPS. Upload to `community-avatars/{uid}/avatar-{ms}.jpg`.
- **Availability check:** `.task(id: normalizedUsername)` with a 400 ms `Task.sleep`. Cancellation gives correct ordering (fixes PRO-D20).
- **Sign in with Apple (D-11):** with Hide-My-Email, the email handle is meaningless for the username suggestion and the reader-name fallback. Use `ASAuthorizationAppleIDCredential.fullName`, which Apple provides only on first authorization: persist it and use it as the suggested display name.
- **Account deletion (D-10):** reachable from Settings, with confirmation and re-authentication, calling `delete-account` (PRO-105). App Review Guideline 5.1.1(v).
- **AI disclosure:** DNA sends finished-book titles to Google Gemini with Search grounding (D-09). Declare it in the privacy label and the consent flow ([08](08-platform-auth-account.md)).
- **Widgets:** the yearly-goal ring and the streak are WidgetKit candidates, fed from an App Group cache of the quest and stats RPCs. Reload after saves. Streaks stay UTC-based until BC-06.
- **OCR (D-15)** does not touch this domain, except that capture XP counts unique pages whatever the OCR engine (PRO-05).
