# 09 · Database-Enforced Invariants — Business Rules
> **Prefix:** BE · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-18

## Overview

This file states what the **shared Supabase backend** guarantees no matter which client writes: the web PWA (live), the iOS app (next) and Android (later). It covers constraints, defaults, triggers, RLS ownership, cascades, RPC guards, edge-function validation and runtime limits. A rule here holds for a request sent with `curl`; anything that only the PWA does is marked `client` and belongs in [12 · Client logic register](12-client-logic-register.md).

Scope boundaries:

- **Shapes** (columns, JSON payloads, signatures) live in the [backend contract](../backend-contract.md). This file states the **rules** those objects enforce.
- **Domain behaviour** that happens to run in SQL (XP, streaks, recap prompts, community privacy) is owned by the domain files. The BE rules below keep the server-side statement and point to the canonical domain rule.
- **Security holes** are listed as Known defects with their fix package: BC-01 (database) or BC-02 (edge functions), from the [backend consolidation plan](../backend-consolidation-plan.md). The repository will be made private, so they are documented in full (D-16).
- **Target** lines carry only Required or Decided work (D-xx, BC-01 … BC-09, BC-11, BC-12). Recommended packages (BC-10, BC-13, BC-14, BC-15) appear as "Recommended" notes.
- The live database is canonical, not `supabase/migrations/` (drift: BE-D40). The read-only snapshot is [`supabase/reference/live-baseline-2026-10-18.sql`](../../supabase/reference/live-baseline-2026-10-18.sql), cited below as "baseline §X".

Product name: **The Chronicler**. "BookHero" is the internal code name (repo, Supabase project `zlndhygpqacygceivuvk`, identifiers) (D-03).

| Entry point (web route / action) | What the database enforces on that path |
|---|---|
| `/login` sign-up / sign-in | Only an `auth.users` row is created; nothing is bootstrapped (BE-88) |
| `/library`, Dashboard, `/profile` load | `get_library_with_progress` status derivation (BE-17); identity not checked ⚠ (BE-07) |
| `/books/add…`, Library swipe → Edit / Delete | `books` CHECKs (BE-09); no triggers on `books` (BE-11b); delete cascade (BE-72) |
| Page save, session buttons (Dashboard hero, `/books/:id`) | One progress row per book (BE-13); `updated_at` trigger (BE-14); completion purge triggers (BE-19, BE-20) |
| Page capture (camera → review → save) | Capture constraints (BE-24); XP-event + purge trigger (BE-21) |
| "Get Recap", Insights, OCR, auto-vocabulary, "Previously", Memory Check, Reading DNA | Edge-function validation and soft-failure contracts (BE-75 … BE-84) |
| `/profile/stats`, `/profile/trophy-room` | Stats, quest and records RPC formulas and timezone handling (BE-36 … BE-50) |
| `/profile/edit` | Username and profile RPC rules (BE-51, BE-52); avatar bucket (BE-70) |
| *(no UI — dormant, D-13)* follow graph, discovery, reading circles | BE-53 … BE-68 |

**Owning objects** (names only; details in the [backend contract](../backend-contract.md)):

- **Tables (26):** `books`, `reading_progress`, `progress_history`, `up_next_order`, `recaps`, `lore_cards`, `book_passports`, `reading_dna`, `page_captures`, `book_quizzes`, `reading_quest_events`, `lexicon_entries`, `vocabulary_extractions`, `anki_review_sessions`, `reading_goals`, `achievements`, `user_settings`, `community_profiles`, `community_profile_privacy`, `community_follow_counts`, `follows`, `blocks`, `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions` ([§3 Tables](../backend-contract.md#3-tables)).
- **Functions (69, 60 `SECURITY DEFINER`)** — RPCs plus internal and trigger functions ([§8 RPC catalogue](../backend-contract.md#8-rpc-catalogue), [§9 Triggers & internal functions](../backend-contract.md#9-triggers--internal-functions)).
- **Triggers (14 on 9 tables):** `reading_progress` (3), `page_captures` (1), `reading_goals` (1), `community_profiles` (2), `community_profile_privacy` (1), `follows` (2), `blocks` (2), `circle_members` (1), `reading_circles` (1). None on `auth.users`, `books`, `lexicon_entries`, `recaps` or `up_next_order`.
- **Enums (4):** `circle_invitation_status`, `circle_member_role`, `circle_status`, `profile_visibility` ([§6 Enums](../backend-contract.md#6-enums)).
- **Edge functions (7):** `generate-recap`, `generate-lore`, `ocr-page`, `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume`, `generate-book-quiz` ([§10 Edge functions](../backend-contract.md#10-edge-functions)).
- **Storage buckets (2):** `recap-images` (private), `community-avatars` (public) ([§7 Storage](../backend-contract.md#7-storage)).

---

## Rules

### Identity, authorization & exposure

#### BE-01 · RLS is the only barrier for direct table access
All 26 product tables in `public` have RLS **enabled** (none **forced**). `anon` and `authenticated` hold full DML grants on every table (Supabase default), so the policies in BE-02 … BE-05 are the only thing between a PostgREST request and the rows.
- **Enforced:** `server:db` (RLS on every table; `information_schema.role_table_grants`)
- **Source:** live `pg_class.relrowsecurity` / `relforcerowsecurity`; baseline §C header
- **Note:** The service role bypasses RLS. Only `generate-recap` (`mode:'recap_image'`) uses it today (BE-78), so that path is constrained only by the function's own filters.

#### BE-02 · Owner policies compare `user_id` only
A row is visible or writable only when `auth.uid() = user_id` (written `user_id = auth.uid()` on some tables). The command set differs by table:

| Commands allowed to the owner | Tables |
|---|---|
| `ALL` (select, insert, update, delete) | `books`, `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `book_passports`, `up_next_order`, `anki_review_sessions` |
| Select / insert / update / delete as separate policies | `lore_cards`, `page_captures`, `reading_goals`, `book_quizzes` |
| Select / insert / update (no delete) | `reading_dna`, `vocabulary_extractions`, `user_settings` |
| Select / insert only (insert-only ledger) | `achievements` |
| Select only (trigger-written) | `reading_quest_events` |

No policy checks that a referenced `book_id` belongs to the caller. The FK only checks that the book exists, so a client may insert `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `page_captures`, `lore_cards`, `up_next_order`, `book_quizzes` or `vocabulary_extractions` rows that point at **another user's** book. Those rows are invisible to the RPCs (they join `books.user_id = p_user_id`) and are cascade-deleted when the other user deletes the book. ⚠ BE-D06
- **Enforced:** `server:db` (RLS policies listed in baseline §C)
- **Source:** live `pg_policies`; FKs baseline §D
- **Target:** Child-table policies also require the referenced book to belong to the caller, e.g. `exists (select 1 from books where id = book_id and user_id = (select auth.uid()))` (BC-01).
- **Note:** `UPDATE` without `WITH CHECK` on `reading_dna` and `vocabulary_extractions` is **not** a hole: Postgres reuses the `USING` expression as the check, so `user_id` cannot be moved to another uid.
- **Note:** The older policies are granted to role `public` (anon + authenticated); for `anon`, `auth.uid()` is NULL and they match nothing. `reading_goals`, `book_quizzes`, `achievements`, `reading_quest_events`, the circle tables and the avatar storage policies are granted to `authenticated` only. 25 older policies call `auth.uid()` per row instead of `(select auth.uid())` (advisor `auth_rls_initplan`, BE-D14).

#### BE-03 · Tables without a DELETE policy
Clients cannot delete rows from `reading_dna`, `vocabulary_extractions`, `user_settings`, `achievements`, `reading_quest_events`, `community_profile_privacy`, `community_follow_counts`, `reading_circles`, `circle_invitations`, `circle_members` or `circle_reactions`. These rows disappear only through FK cascades (BE-72, BE-73, BE-74) or SECURITY DEFINER functions.
- **Enforced:** `server:db` (absence of a DELETE policy = deny)
- **Source:** baseline §C

#### BE-04 · Community and circle tables are read-restricted
`community_profiles`, `community_profile_privacy` and `community_follow_counts`: SELECT own row only. `follows` / `blocks`: SELECT rows where the caller is either side. `reading_circles` / `circle_members`: SELECT only for active members (`circle_user_is_member`). `circle_invitations`: SELECT for the invitee or the circle owner. `circle_reactions`: SELECT own reactions only; other members' reactions are readable **only** through `get_visible_circle_reactions` (BE-67).
- **Enforced:** `server:db` (`community_profiles_owner_select`, `follows_participant_select`, `blocks_participant_select`, `reading_circles_member_select`, `circle_members_member_select`, `circle_invitations_recipient_or_owner_select`, `circle_reactions_author_select`)
- **Source:** baseline §C
- **Note:** Canonical community behaviour: [10 · Community & circles](10-community-circles.md).

#### BE-05 · Direct table writes bypass RPC business rules
The `follows` and `blocks` INSERT policies only check `follower_id` / `blocker_id = auth.uid()`. The follow eligibility rules of `follow_community_user` (target profile public, no block either way) are **not** enforced for a direct insert. Direct `community_profiles` INSERT/UPDATE likewise bypass the reserved-username list and the validation in `upsert_my_community_profile`; only the CHECKs `^[a-z0-9_-]{3,30}$` and `bio ≤ 160` remain, and a profile can be created without its privacy row. ⚠ BE-D07
- **Enforced:** `server:db` (`follows_follower_insert`, `blocks_blocker_insert`, `community_profiles_owner_insert` / `_update`; `community_profiles_username_format_chk`, `community_profiles_bio_len_chk`)
- **Source:** baseline §C, §D
- **Target:** The direct `follows` insert bypass is closed; writes go through the RPCs (BC-01).

#### BE-06 · Every function is an HTTP endpoint; default privileges re-open it
All 69 `public` functions are reachable at `POST /rest/v1/rpc/<name>`. 60 `SECURITY DEFINER` functions are executable by `authenticated` and **17 by `anon`**: `after_page_capture_saved`, `community_block_cleanup_follows`, `community_ensure_count_on_profile_insert`, `community_ensure_follow_count`, `community_follow_counts_after_follow`, `community_remove_pair_follows`, `delete_book_quizzes_on_book_completion`, `delete_page_captures_on_book_completion`, `get_book_passport_stats`, `get_monthly_reading`, `get_reading_calendar`, `get_reading_quest_summary`, `get_reading_records`, `get_retention_summary`, `prune_page_captures_for_book`, `record_page_capture_quest_event`, `upsert_weekly_goal`. Five more (invoker) functions are anon-executable: `community_cursor_payload`, `community_encode_cursor`, `community_profiles_touch_updated_at`, `set_reading_goals_updated_at`, `set_updated_at`. ⚠ BE-D03, BE-D04
- **Enforced:** `server:db` (function ACLs; `pg_default_acl`)
- **Source:** live `has_function_privilege`; advisor lints 0028 (17) / 0029 (60); baseline §I
- **Target:** Revoke `anon`/`PUBLIC` EXECUTE across `public`, fix `pg_default_acl`, drop the dead `after_page_capture_saved`, drop or lock `prune_page_captures_for_book` (BC-01).
- **Note:** Root cause — `pg_default_acl` for schema `public` (owners `postgres` and `supabase_admin`) grants EXECUTE on every **new** function and full DML on every **new** table to `anon` and `authenticated`. The 2026-05-02 `revoke_anon_rpc_execute` migration only revoked grants that existed then. `CREATE OR REPLACE` keeps a function's existing ACL, which is why `get_reading_stats` and `get_library_with_progress` are authenticated-only while every function **created** later is anon-executable again.
- **Note:** Trigger functions are harmless through `/rpc`: Postgres raises "trigger functions can only be called as triggers".

#### BE-07 · Identity re-assertion differs per RPC
Not every RPC re-asserts `auth.uid()`:

| Behaviour | Functions |
|---|---|
| Derives or compares identity correctly | `get_reading_stats` (`authorized` CTE → zeros for others), `get_book_passport_stats` (`p_user_id = auth.uid()` → all-null/0 object), `get_monthly_reading`, `get_reading_calendar`, `get_reading_records` (`p_user_id = (select auth.uid())` in WHERE → empty for others), `upsert_weekly_goal`, `get_retention_summary`, every community/circle RPC (uses `auth.uid()` directly and ignores any client-supplied identity) |
| Guard bypassable | `get_reading_quest_summary`: raises `'Not allowed'` only when `p_user_id <> (select auth.uid())` is TRUE. For `anon` the comparison is NULL, so the function returns the target's goal, quest, level and XP sources. Verified live. ⚠ BE-D02 |
| **No identity check** | `get_library_with_progress`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity` (authenticated) — any signed-in caller reads any user's titles, progress, DNF state, session notes and forecasts by UUID ⚠ BE-D01. `prune_page_captures_for_book` (anon, destructive), `community_remove_pair_follows` (anon, destructive), `community_ensure_follow_count` (anon; benign — inserts only a zero row for a user who already has a profile, `on conflict do nothing`), `community_reconcile_follow_counts` (authenticated; recomputes every counter from real `follows` rows, so it cannot falsify counts — the risk is load and lock contention) ⚠ BE-D03 |
| Helpers that take arbitrary user ids | `circle_progress_location(p_circle_id, p_user_id)` leaks another user's `current_page`/`total_pages`: create your own circle on ISBN X, then call it with any victim uid. `community_relationship_payload(p_viewer, p_target)` leaks follow/block edges between any two users. `community_can_view_profile`, `community_has_block_between`, `community_interaction_reason`, `circle_user_is_member` / `_owner`, `circle_members_have_block`, `circle_book_matches`, `circle_member_count`, `circle_users_can_share` act as oracles ⚠ BE-D05 |

- **Enforced:** `server:rpc` (function bodies, baseline §A1–§A5)
- **Source:** live `pg_get_functiondef`; anon call verified 2026-10-18
- **Target:** The four unguarded RPCs assert `p_user_id = (select auth.uid())` and keep the parameter for PWA compatibility; `get_reading_quest_summary` gets a NULL-safe guard; helpers lose EXECUTE (D-05 · BC-01).
- **Note:** Guard styles differ: `get_reading_quest_summary` **raises** (HTTP 400, `P0001`, message `Not allowed`); the other guarded RPCs **silently** return empty or zero data for a foreign id. User ids are discoverable through `search_community_readers` and `get_public_profile_by_username`.

#### BE-08 · Every function pins `search_path`
Every `public` function is declared `SET search_path TO 'public'`; the advisor reports no mutable-search-path lint.
- **Enforced:** `server:db`
- **Source:** baseline §A

### Runtime limits & platform

#### BE-08a · Per-request runtime limits and server timezone
Every PostgREST request runs under role settings:

| Setting | Value | Effect |
|---|---|---|
| `statement_timeout` (`authenticated`) | 8 s | Longer queries fail with SQLSTATE `57014` |
| `statement_timeout` (`anon`) | 3 s | — |
| `authenticator` | `statement_timeout` 8 s, `lock_timeout` 8 s, preloads `safeupdate` | PostgREST rejects `UPDATE` / `DELETE` without a filter |
| DB `TimeZone` | `UTC` (no role override) | `current_date`, `date(recorded_at)` and `date_trunc` in any RPC without a timezone argument use UTC boundaries |
| `app.settings.jwt_exp` | 3600 | DB GUC |

Every stats and quest RPC scans the caller's whole `progress_history`, so it must finish inside 8 s.
- **Enforced:** `server:db` (`pg_db_role_setting`)
- **Source:** live `pg_db_role_setting`, `current_setting('TimeZone')`; baseline §I
- **Target:** Every day/week/month/year boundary uses the reader's IANA zone passed as `p_timezone`, not the DB timezone (D-07 · BC-06).
- **Note:** [UNVERIFIED: the Auth access-token lifetime, the JWT signing algorithm and PostgREST `max_rows` are project settings not readable through SQL; Supabase defaults are 3600 s and 1000 rows.] Un-paginated table `select`s can therefore be truncated at `max_rows`; scalar JSON RPC results are not capped.

#### BE-85 · Nothing happens server-side without a request
The project has no scheduled or event-driven processing: `pg_cron`, `pg_net`, `pgmq` and `http` are not installed, there are no database webhooks, the `supabase_realtime` publication contains **no tables**, and there are no views, materialized views or server-side caches. Every RPC recomputes from base tables. Consequences: no state ever changes by time alone — circle invitations never become `expired`, a `pending` recap image never times out, follow counts are never reconciled — and no client is ever notified of a server-side change (trigger deletions, recap image status). ⚠ BE-D39
- **Enforced:** `server:db` (platform inventory)
- **Source:** `list_extensions`; `pg_publication_tables` (0 rows); catalog queries; baseline §I
- **Note:** Recommended (BC-14): publish `recaps` (image status) and `reading_progress`, or define refresh-on-foreground (BE-Q06). The PWA's Realtime subscription on `recaps` exists but never fires; image status arrives by 2 s polling.

#### BE-86 · Error transport
PostgREST maps database errors to HTTP status codes. A native client must switch on `code` and `message`, not on the HTTP status alone:

| Source | HTTP | Body / meaning |
|---|---|---|
| `raise exception '<code>'` in an RPC (`P0001`) | 400 | `{"code":"P0001","message":"<code>"}` — the typed error is the `message` |
| FK violation `23503` | 409 | e.g. a write for a book that was just deleted, or a ledger row for a purged capture |
| Unique violation `23505` | 409 | e.g. `lore_cards_unique_milestone` = "already unlocked" |
| CHECK `23514`, NOT NULL `23502` | 400 | validate before writing (Constants) |
| Bad input `22P02`, `22007`/`22008`, `22023` (unknown IANA zone) | 400 | — |
| Permission `42501` | 401 (anon) / 403 (authenticated) | — |
| Statement timeout `57014` | 500 | retry with backoff |

- **Enforced:** `server:db` + PostgREST
- **Source:** PostgREST error mapping; live RPC bodies
- **Note:** [UNVERIFIED: the SQLSTATE→HTTP table follows PostgREST's documentation and was not exercised against this project for every code.]

#### BE-88 · Sign-up creates only the `auth.users` row
There is no trigger on `auth.users`, so sign-up creates no profile, settings, goal or community row. Per-user rows appear lazily: `reading_progress` on the first write for a book, `anki_review_sessions` on the first review, `reading_goals` on the first goal save, `community_profiles` + `community_profile_privacy` on the first `/profile/edit` save, `reading_dna` on the first DNA generation. `user_settings` is written only by the dormant `upsert_weekly_goal`.
- **Enforced:** `server:db` (absence of a trigger)
- **Source:** baseline §B header
- **Note:** Every RPC must tolerate a missing row: stats → zeros, `get_last_session` → `null`, library/calendar → `[]`, monthly → 12 zero rows, records → nulls + `nightOwl:false`, passport stats → `{totalDays:null, …, vocabularyCount:0}`, quest → `goal:null`, status `no_goal`, level 0, `get_my_community_profile` → `null`.

#### BE-89 · Where `updated_at` is maintained
`updated_at` is trigger-maintained (`now()` on every UPDATE) on `reading_progress`, `reading_goals`, `community_profiles`, `community_profile_privacy` and `reading_circles`. `user_settings.updated_at` is set inside `upsert_weekly_goal`. `up_next_order.updated_at` has a `now()` default but no trigger: the PWA writes it from the device clock on every reorder. `books`, `lexicon_entries` and `recaps` have **no** `updated_at` column at all.
- **Enforced:** `server:db` (triggers `reading_progress_updated_at`, `set_reading_goals_updated_at`, `community_profiles_touch_updated_at`, `community_profile_privacy_touch_updated_at`, `reading_circles_touch_updated_at`)
- **Source:** baseline §B, §H; `src/stores/upNext.ts:66-71`
- **Note:** A delta-sync RPC (`changed_since`, BC-14) cannot rely on `updated_at` for `books`, `lexicon_entries` or `recaps` today.

#### BE-90 · Length CHECKs count Unicode code points
Every text-length CHECK uses `char_length`, which counts **code points**. JavaScript `.length` counts UTF-16 units, Swift `String.count` counts grapheme clusters and Kotlin `String.length` counts UTF-16 units, so emoji-heavy or accented text can pass a client check and fail the DB CHECK, or the reverse. ⚠ BE-D46
- **Enforced:** `server:db` (e.g. `books_title_check`, `progress_history_session_note_check`, `reading_dna_personality_check`, `community_profiles_bio_len_chk`)
- **Source:** baseline §D
- **Note:** Validate against the limits in Constants with a code-point count (`unicodeScalars.count` in Swift, `codePointCount` in Kotlin).

### Books

#### BE-09 · Book field constraints
`books.title` is 1–500 characters, `author` 1–200, `total_pages ≥ 1` (no upper bound), and `isbn` is NULL or matches `^\d{9}[\dX]$|^\d{13}$` — no hyphens or spaces, uppercase `X` only, no checksum. `user_id` is NOT NULL with FK → `auth.users ON DELETE CASCADE`.
- **Enforced:** `server:db` (`books_title_check`, `books_author_check`, `books_total_pages_check`, `books_isbn_check`, `books_user_id_fkey`)
- **Source:** baseline §D
- **Note:** Canonical library rules: [01 · Library](01-library.md) (LIB-01 … LIB-05). Recommended (BC-15): normalise ISBNs server-side (strip hyphens/spaces, uppercase `X`), validate the checksum and convert ISBN-10 → 13 before insert.

#### BE-10 · `source` and `page_count_estimated`
`books.source` is NOT NULL, default `'manual'`, with **no CHECK**. Observed values: `manual`, `goodreads` (the client also writes `storygraph`). "Imported" means `coalesce(source,'manual') <> 'manual'`. `page_count_estimated` is NOT NULL, default `false`.
- **Enforced:** `server:db` (column defaults only)
- **Source:** baseline §H
- **Note:** `source` never changes after insert — no client or DB path rewrites it (consequence: BE-36).

#### BE-11 · No uniqueness and no audit columns on books
The same ISBN or title can be added to one library any number of times; there is no unique index per user. `books` has no `updated_at` column and no trigger.
- **Enforced:** `server:db` (absence of constraints)
- **Source:** baseline §D, §E
- **Note:** Duplicate warnings are client-only (LIB-Q02).

#### BE-11a · `page_count_estimated` is cleared only by the client
No trigger clears `books.page_count_estimated`. The web `updateBook` sends `page_count_estimated: false` whenever `total_pages` is saved. Any other client must do the same.
- **Enforced:** `client` (`src/stores/books.ts:389-392`)
- **Source:** trigger list, baseline §B

#### BE-11b · Editing `total_pages` fires nothing
Changing `books.total_pages` — even lowering it to ≤ `current_page` — fires no trigger. The library status flips to `finished` on the next read, but captures and the quiz are **not** purged (the completion triggers live on `reading_progress` only), and no history row or completion side effect is written. History-derived "finish" facts (`get_monthly_reading.booksFinished`, `get_reading_records.fastestFinish`) are recomputed against the new total on the next call, so a finish can appear retroactively in a past month. ⚠ BE-D22
- **Enforced:** `server:db` (absence of a trigger on `books`)
- **Source:** baseline §B
- **Target:** The server becomes the single owner of completion effects for every write path (BC-05). Whether a `total_pages` edit counts as a completion is still open (LIB-Q04).

#### BE-12 · `normalize_isbn`
`normalize_isbn(p)` = `nullif(upper(regexp_replace(coalesce(p,''), '[^0-9X]', '', 'g')), '')`. The regex runs **before** `upper`, so a lowercase `x` is deleted rather than uppercased (`'0-306-40615-x'` → `'030640615'`). It is used only for circle and "also reading" ISBN matching and the functional index `books_normalized_isbn_user_idx`; there is no ISBN-10 ↔ 13 conversion. ⚠ BE-D32
- **Enforced:** `server:db` (`normalize_isbn`, IMMUTABLE)
- **Source:** live `pg_get_functiondef`; verified with a live `select` 2026-10-18
- **Note:** Stored ISBNs cannot contain a lowercase `x` (BE-09), so only the `p_isbn` argument of `get_also_reading_for_book` is affected.

### Reading progress & history

#### BE-13 · One progress row per book; no page range
`reading_progress` has at most one row per `(book_id, user_id)`. `current_page` is NOT NULL, default 0, with **no range CHECK**: negative values and values above `total_pages` are accepted. ⚠ BE-D15
- **Enforced:** `server:db` (`reading_progress_book_id_user_id_key`)
- **Source:** baseline §D, §H
- **Target:** BC-04 adds `CHECK (current_page >= 0)`; the ceiling is enforced in `save_progress`, which validates the page on the server clock, because a CHECK cannot read `books.total_pages` (D-06 · BC-04). Other client-only validations that may become constraints are BE-Q03.
- **Note:** The RPCs clamp where it matters (`least()` in quest/stats; percentage capped at 100).

#### BE-14 · `reading_progress.updated_at` moves on every UPDATE
Trigger `reading_progress_updated_at` (`set_updated_at`, BEFORE UPDATE, any column) sets `updated_at = now()` on **every** update of the row: page save, session start/pause/resume/stop, DNF shelve/resume. On INSERT the column default `now()` applies. Library order (`lastReadAt`), the quest's "completed this year" and the 72 h recap idle clock all key off this value. ⚠ BE-D19
- **Enforced:** `server:db` (trigger `reading_progress_updated_at`)
- **Source:** baseline §B
- **Target:** A first-completion timestamp `reading_progress.completed_at` is stamped by `save_progress` and used for "finished this year" instead of `updated_at` (BC-04). What moves "last read" is open (SES-Q15).

#### BE-15 · History row constraints and the client clock
`progress_history.page ≥ 0`; `session_note` NULL or ≤ 160 characters; `recorded_at` defaults to `now()`, but the web client always sends its own device timestamp, which the DB accepts verbatim. There is no idempotency key and no unique constraint, so a repeated online save (double tap, client retry) writes duplicate rows. ⚠ BE-D16, BE-D20
- **Enforced:** `server:db` (`progress_history_page_check`, `progress_history_session_note_check`)
- **Source:** baseline §D; `src/stores/progress.ts:565-583`
- **Target:** `save_progress(book, page, note, client_occurred_at, idempotency_key)` writes `recorded_at` from the server clock; the client time is used only for offline replays, which keep their original timestamp (D-08 · BC-04).

#### BE-16 · Timed session end and the "valid session" filter
A history row with `session_start_at IS NOT NULL` is a **timed session end**; a row without it is an untimed save. Velocity, hours and `sessionsThisMonth` count only *valid* sessions: duration `recorded_at − session_start_at ≥ 60 s` **and** page delta ≥ 1.
- **Enforced:** `server:rpc` (`get_reading_stats.valid_sessions`, `get_last_session.valid_sessions`)
- **Source:** baseline §A1
- **Target:** History rows are explicitly timed or untimed. Pages, streaks and charts count any forward page change (including offline replays); session XP, session-count badges and the Last Session card require a real timed session (D-08 · BC-04).
- **Note:** The DB enforces no session state machine (Flow F2).

#### BE-17 · Library status derivation
`get_library_with_progress` derives each book's status in this order: `dnf` if `dnf_at` is not null → `unread` if `current_page = 0` or no progress row → `finished` if `total_pages > 0 AND current_page ≥ total_pages` → else `reading`. `percentage = least(100, round(current_page / total_pages × 100, 2))`. Rows are ordered by `coalesce(progress.updated_at, book.created_at) desc`. ⚠ BE-D23
- **Enforced:** `server:rpc` (`get_library_with_progress`)
- **Source:** baseline §A1
- **Note:** A negative `current_page` (BE-13) yields `reading`.
- **Note:** The payload has **no** `sessionPausedAt`; the PWA reads `reading_progress.session_paused_at` with a separate select (`src/stores/progress.ts:218-224`).
- **Note:** `dnf_at` is referenced by **no other function** (live search of every function body). Quest XP and `completedBooks`, stats, records, monthly, calendar, velocity, breakdown, the public profile and also-reading all ignore DNF. A DNF book whose pages reach `total_pages` keeps library status `dnf`, counts as completed in the quest, and loses its captures and quiz to the completion triggers. Saving pages does not clear `dnf_at` (the web save upserts `current_page` only).

#### BE-18 · Library breakdown ignores DNF
`get_library_breakdown` uses the same page thresholds but has no `dnf_at` branch: a DNF book counts as reading, finished or unread by pages. ⚠ BE-D23
- **Enforced:** `server:rpc` (`get_library_breakdown`)
- **Source:** baseline §A1

### Completion cleanup (triggers)

#### BE-19 · Completion deletes the book's page captures
When a `reading_progress` row is INSERTed, or its `current_page` is UPDATEd, and the result is `current_page ≥ books.total_pages` (`total_pages > 0`), **all** `page_captures` of that user and book are deleted, including their stored `resume`.
- **Enforced:** `server:db` (trigger `page_captures_delete_on_completion` → `delete_page_captures_on_book_completion`, AFTER INSERT OR UPDATE OF current_page)
- **Source:** live `pg_get_triggerdef` / `pg_get_functiondef`; baseline §A2, §B
- **Target:** The purge triggers stay, under one server owner of completion effects (BC-05). Whether the purge should wait for completion jobs that use captures (D-12 Insight fallback) is open (CAP-Q03).

#### BE-19a · `UPDATE OF current_page` fires even when the value is unchanged
The completion triggers are column triggers, so they fire on **every** upsert or update that lists `current_page` — even with the same value. The web start-session, DNF and initial-status upserts all send `current_page` (`src/stores/progress.ts:288-297,358-369,433-442`). On a finished book each such write re-runs the purge (normally a no-op).
- **Enforced:** `server:db` (trigger definitions)
- **Source:** baseline §B

#### BE-20 · Completion deletes the book's quiz
The same condition (BE-19) deletes the book's `book_quizzes` row. Nothing stops a client from inserting a new `book_quizzes` row for an already-finished book afterwards: the purge runs only on `reading_progress` writes, and the gating is client-side. ⚠ BE-D35
- **Enforced:** `server:db` (trigger `book_quizzes_delete_on_completion` → `delete_book_quizzes_on_book_completion`)
- **Source:** baseline §A2, §B

#### BE-21 · Capture writes record XP, then purge if the book is complete
On every INSERT **or UPDATE** of a `page_captures` row, `record_page_capture_quest_event` (a) upserts a `reading_quest_events` row (`event_type='page_capture'`, keyed by user + book + page; on conflict keep the earliest `occurred_at` and the first non-null `source_id`; `occurred_at` = the capture's `captured_at`); then (b) if the book is already complete (`reading_progress.current_page ≥ total_pages > 0`), deletes **all** captures of that book in the same statement. ⚠ BE-D21
- **Enforced:** `server:db` (trigger `page_capture_quest_event_after_save` → `record_page_capture_quest_event`, AFTER INSERT OR UPDATE, FOR EACH ROW)
- **Source:** live `pg_get_triggerdef` / `pg_get_functiondef`; baseline §A2, §B
- **Note:** Insert-then-purge consequences: PostgREST still returns the inserted row (RETURNING precedes the AFTER-row purge), so the client believes the save worked. The follow-up `vocabulary_extractions` insert fails with FK `23503` (only logged, `src/composables/useVocabularyExtraction.ts:58-75`) and the resume `UPDATE` matches 0 rows. The **+5 XP event is still recorded** and survives.
- **Note:** Because the trigger also fires on UPDATE, writing `resume` on a capture of a finished book purges all of that book's captures.
- **Note:** Correct statement of this behaviour across the catalog: capture side [04 · Capture](04-capture-resume-quiz.md), XP side [07 · Profile](07-profile-stats-goals.md) (PRO-05). A capture saved after completion does **not** survive.

#### BE-22 · Ledgers survive deletion of their source
Capture XP survives capture deletion and book deletion (`reading_quest_events.book_id` FK `ON DELETE SET NULL`). Vocabulary ledger rows survive capture deletion (`vocabulary_extractions.capture_id` FK `ON DELETE SET NULL`), but not book deletion (`book_id` cascades).
- **Enforced:** `server:db` (`reading_quest_events_book_id_fkey`, `vocabulary_extractions_capture_id_fkey`)
- **Source:** baseline §D

#### BE-23 · Un-finishing restores nothing
Moving `current_page` back below `total_pages` (or raising `total_pages`) does not restore deleted captures or quizzes. An un-finished book has no capture corpus, so its next mid-book recap falls back to the inferred path.
- **Enforced:** `server:db` (the triggers only delete)
- **Source:** baseline §A2

#### BE-23a · DNF and add-with-status writes have no server cascade
Setting or clearing `dnf_at` deletes nothing (captures, quiz, recaps, lore and lexicon all stay) and only bumps `reading_progress.updated_at` (BE-14). Adding a book with an initial status writes only `reading_progress` and never `progress_history`: queued → no row; in progress → page clamped to `[1, total − 1]`; completed → `total_pages`. For a **manual** book added as completed this immediately adds +25 XP and `total_pages` pages of XP, +1 to this year's quest `completedBooks` (its `updated_at` is now) and to `totalPagesRead`, while monthly, records, calendar and streaks ignore it (no history).
- **Enforced:** `server:db` (no DNF trigger) + `client` (`src/stores/books.ts:214-233`, `src/stores/progress.ts:420-446`)
- **Source:** baseline §B
- **Note:** Whether such adds count as completions is open (LIB-Q01). Recommended (BC-04): write a baseline history row when a book is added mid-way, so the starting page is not counted as read (SES-Q17).

#### BE-87 · Completion and capture triggers act only on the writer's own book
The three completion/capture trigger functions look up `books.total_pages` with `b.id = new.book_id AND b.user_id = new.user_id`, and delete only rows with `user_id = new.user_id`. A progress or capture row that points at **another user's** book (BE-02) therefore never purges anything, and never touches the other user's rows.
- **Enforced:** `server:db` (`delete_page_captures_on_book_completion`, `delete_book_quizzes_on_book_completion`, `record_page_capture_quest_event`)
- **Source:** live `pg_get_functiondef` 2026-10-18

### Page captures, vocabulary, lexicon

#### BE-24 · Capture constraints
`page_captures` is unique per `(user_id, book_id, page)`; `page ≥ 0`; `text` 1–10 000 characters; `word_count ≥ 0`; `confidence numeric(3,2)` in [0, 1] (values are rounded to 2 decimals); `source ∈ {ocr, manual, import}`, default `ocr`; `resume jsonb` nullable; `captured_at` default `now()`.
- **Enforced:** `server:db` (`page_captures_user_id_book_id_page_key`, `page_captures_page_check`, `page_captures_text_check`, `page_captures_word_count_check`, `page_captures_confidence_check`, `page_captures_source_check`)
- **Source:** baseline §D
- **Note:** An empty OCR result cannot be saved (BE-80). Native OCR confidence (D-15) must be mapped into [0, 1] before writing.
- **Note:** `resume` may carry a legacy `characters` key on old rows (1 live row); decoders must treat it as optional.

#### BE-24a · Re-capturing a page keeps the row
Re-capturing an already captured page is an upsert on `(user_id, book_id, page)` that **keeps the existing row id** and does not touch `resume` (the web save sends no id and no resume). Consequences: the vocabulary-ledger insert for the "new" capture hits UNIQUE `capture_id` (`23505`), so auto-vocabulary is silently skipped; and the old `resume` survives, so the "Previously" dialog keeps the stale summary (resume generation is gated on `resume IS NULL`). ⚠ BE-D34
- **Enforced:** `server:db` (unique key) + `client` (`src/stores/captures.ts:85-99`)
- **Source:** baseline §D
- **Note:** Re-capture semantics are open (CAP-Q04). A client that wants a fresh resume must null `resume` itself.

#### BE-25 · Vocabulary ledger constraints
`vocabulary_extractions`: `capture_id` UNIQUE and nullable (the idempotency key); `words_added` 0–5; `status ∈ {pending, succeeded, failed, skipped}`; `page ≥ 0`. Because `capture_id` is nullable, rows orphaned by the completion purge (SET NULL) accumulate without violating uniqueness. A capture at page 0 always ends with ledger `failed` and no words: auto-vocabulary inserts `lexicon_entries.page_found = page`, and `lexicon_entries_page_found_check` requires ≥ 1. ⚠ BE-D34
- **Enforced:** `server:db` (`vocabulary_extractions_capture_id_key`, `_words_added_check`, `_status_check`, `_page_check`)
- **Source:** baseline §D; `src/composables/useVocabularyExtraction.ts:154-160`
- **Note:** Status transitions are written by the client; the edge function is stateless ([05 · Codex](05-codex-lexicon.md)).

#### BE-26 · Lexicon constraints
`lexicon_entries`: `term` 1–200 characters; `definition` ≥ 1; `entry_type ∈ {dictionary, quote}`, default `dictionary`; `source ∈ {manual, auto}`, default `manual`; `leitner_box` 1–5, default 1; `next_review_at date`, default `CURRENT_DATE` — the **UTC** date of the server; `page_found` NULL or ≥ 1; `mastered` default false; `last_reviewed_at` nullable. There is **no** uniqueness on `(user, book, term)`; dedup is client-only. ⚠ BE-D27
- **Enforced:** `server:db` (`lexicon_entries_*` checks)
- **Source:** baseline §D, §H
- **Note:** Leitner scheduling is client-computed; recommended (BC-10): a `review_lexicon_entry` RPC; the review daily tally and due set use the reader's timezone (BC-06).

#### BE-27 · One review aggregate row per user
`anki_review_sessions` has exactly one row per user (`anki_review_sessions_user_id_key`); `total_sessions` defaults to 1, counts to 0. Clients update it read-modify-write, so two devices can lose increments.
- **Enforced:** `server:db` (unique key)
- **Source:** baseline §D, §H

### Recaps, lore, passports, DNA, quizzes

#### BE-28 · Recap row constraints
`recaps`: `memory_jogger`, `concept_watchlist`, `thematic_bridge` non-empty; `mode ∈ {corpus, inferred}`, default `inferred`; `progress_snapshot numeric(5,2)` NOT NULL; `page_snapshot` nullable; `image_status` NULL or one of `pending, succeeded, failed_safety, failed_transient, skipped`. A book may have any number of recaps (no uniqueness). RLS `ALL` lets the owner update or delete any recap, including its image columns.
- **Enforced:** `server:db` (`recaps_memory_jogger_check`, `recaps_concept_watchlist_check`, `recaps_thematic_bridge_check`, `recaps_mode_check`, `recaps_image_status_check`)
- **Source:** baseline §D
- **Target:** `generate-recap` persists the validated `recaps` row itself and returns it; clients stop inserting recaps (BC-07).
- **Note:** No code path writes `skipped`; legacy rows have `image_status` NULL.

#### BE-29 · One Insight card per milestone
`lore_cards` is unique per `(user_id, book_id, unlocked_at_milestone)`; `unlocked_at_milestone ∈ {10, 20, …, 90}`; `type` is free text (**no CHECK live**; observed `History`, `Geography`, `Culture`, `Lore`); `linked_entities text[]` default `{}`; `seen` default false. A second insert for the same milestone fails with `23505`, which clients must treat as "already unlocked".
- **Enforced:** `server:db` (`lore_cards_unique_milestone`, `lore_cards_unlocked_at_milestone_check`)
- **Source:** baseline §D
- **Target:** Milestone detection on save, generation with recap → captures → metadata fallback, backfill of skipped milestones, and `insert … on conflict do nothing` move server-side; clients only list and mark seen (D-12 · BC-08).

#### BE-30 · One passport per book
`book_passports` is unique per **book** (`book_passports_book_id_key`), not per `(user, book)`. Clients upsert on `book_id`.
- **Enforced:** `server:db` (unique key)
- **Source:** baseline §D
- **Target:** Passport stats are frozen at completion and the AI summary runs as a server job (BC-05).

#### BE-31 · Reading DNA constraints
`reading_dna` has one row per user (PK `user_id`); `personality` 50–800 characters; `mood_tone` 1–40; `mood_emojis` 1–5 elements; `books_finished_at_generation ≥ 0`; `suggestions jsonb` unconstrained. `reading_dna_mood_emojis_check` uses `array_length`, which is NULL for an empty array, so `'{}'` passes the CHECK. Deleting books never lowers `books_finished_at_generation`, so `finishedNow − books_finished_at_generation` can go negative. ⚠ BE-D33
- **Enforced:** `server:db` (`reading_dna_*` checks, PK)
- **Source:** baseline §D
- **Target:** DNA eligibility is evaluated server-side (BC-05).

#### BE-32 · One quiz per book
`book_quizzes` is unique per `(user_id, book_id)`; `page_snapshot ≥ 0`; `score` NULL or 0–3; `questions jsonb` unconstrained (documented shape `[{question, options[3], correctIndex 0–2, sourcePage}]`).
- **Enforced:** `server:db` (`book_quizzes_user_id_book_id_key`, `book_quizzes_page_snapshot_check`, `book_quizzes_score_check`)
- **Source:** baseline §D; table comment
- **Note:** A quiz can hold 1–3 questions (BE-83), so the maximum score is the question count. Quiz persistence stays a client write today (CAP-Q16).

### Goals, quest, achievements, settings

#### BE-33 · One reading goal per year
`reading_goals` is unique per `(user_id, year)`; `year` 2000–2100; `target_books ≥ 1` (no maximum — the 999 cap is client-only); `updated_at` is set on UPDATE by trigger.
- **Enforced:** `server:db` (`reading_goals_user_year_key`, `reading_goals_year_check`, `reading_goals_target_books_check`, trigger `set_reading_goals_updated_at`)
- **Source:** baseline §B, §D

#### BE-34 · Achievements are an insert-only ledger
`achievements` holds one row per `(user_id, achievement_key)`; owners may only SELECT and INSERT (no UPDATE or DELETE). Keys are free text with no CHECK; the catalog and conditions live in the client (`src/utils/achievements.ts`).
- **Enforced:** `server:db` (`achievements_user_id_achievement_key_key`; RLS select + insert)
- **Source:** baseline §C, §D
- **Target:** The catalog and evaluation move into SQL/RPC with a server-authoritative `earned_at`; clients render (BC-09).

#### BE-35 · Weekly session goal (dormant)
`user_settings` has one row per user; `weekly_goal` 1–7, default 3. `upsert_weekly_goal` raises `'Not authenticated'` or `'Weekly goal must be between 1 and 7'`. No client calls it.
- **Enforced:** `server:db` (`user_settings_user_id_key`, `user_settings_weekly_goal_check`) + `server:rpc` (`upsert_weekly_goal`)
- **Source:** baseline §A2, §D
- **Target:** The reader's timezone is persisted server-side (e.g. `user_settings.time_zone`) so jobs can use it (D-07 · BC-06). Whether the weekly goal itself is revived is open (BE-Q01).

#### BE-36 · XP formula
`get_reading_quest_summary` computes `XP = pagesRead + 25 × completedBooks + 10 × historyRows + 5 × pageCaptureEvents + 20 × recaps + 15 × loreCards`. `pagesRead = Σ clamp(current_page, 0, total_pages)` and `completedBooks` (all time) count **manual books only**. `readingSessions` = **every** `progress_history` row (every save), not timed sessions. History, capture, recap and lore counts include imported books. ⚠ BE-D28, BE-D24
- **Enforced:** `server:rpc` (`get_reading_quest_summary`)
- **Source:** baseline §A2
- **Target:** Session XP requires a real timed session; page XP counts any forward page change, including offline replays (D-08 · BC-04).
- **Note:** `books.source` never changes (BE-10), so an imported book the reader later continues or finishes in-app stays excluded from `pagesRead`, `completedBooks` and `totalPagesRead` forever, while its new history rows, recaps and lore still earn XP (LIB-Q16).
- **Note:** Canonical rule: [07 · Profile](07-profile-stats-goals.md) PRO-01 … PRO-06.

#### BE-37 · Level thresholds
XP floor → level / title: 0 → 0 "Page Turner"; 1 500 → 1 "Chapter Seeker"; 4 000 → 2 "Margin Walker"; 8 000 → 3 "Lore Keeper"; 14 000 → 4 "Archive Runner"; 22 000 → 5 "Chapter Sage"; 34 000 → 6 "Library Legend" (max: `progressPercent = 100`, `nextLevelXp = 0`). `progressPercent = round((xp − floor) / (next − floor) × 100, 1)`. `currentLevelXp = xp − floor`; `nextLevelXp` is the **span** of the current level (`next − floor`), not the absolute threshold.
- **Enforced:** `server:rpc` (`get_reading_quest_summary.level_calc`)
- **Source:** baseline §A2
- **Note:** Canonical rule: PRO-07, PRO-08.

#### BE-38 · Quest pacing
The quest year window is **UTC** `[Jan 1 00:00Z, next Jan 1)`. `monthsElapsed = clamp((min(now, yearEnd) − yearStart) / 2 629 800 s, 1, 12)` (1 if the year has not started). `completedBooks(year)` = manual books finished whose `reading_progress.updated_at` falls in the year (not capped at the target). `requiredBooksPerMonth = round(target / 12, 1)`; `currentBooksPerMonth = round(completed / months, 1)` (NULL if 0); `projectedBooks = round(completed / months × 12, 1)` (NULL if 0); `progressPercent = least(100, round(completed / target × 100, 1))` (0 without a goal). ⚠ BE-D19, BE-D27
- **Enforced:** `server:rpc` (`get_reading_quest_summary.quest_base` / `quest`)
- **Source:** baseline §A2
- **Target:** The year window uses the reader's timezone (D-07 · BC-06), and "finished this year" uses `reading_progress.completed_at` (BC-04).
- **Note:** The web client passes the **device-local** year into this UTC window and saves goals under the same local year (`src/stores/readingQuest.ts:117-127,164-168`). Canonical rule: PRO-09 … PRO-13.

#### BE-39 · Quest status precedence
First match wins: no goal → `no_goal` ("Set your reading quest"); completed ≥ target → `complete` ("Quest complete"); no projection → `no_projection` ("Pace warming up"); projected ≥ 1.1 × target → `ahead` ("Ahead of pace"); ≥ target → `on_track` ("On track"); ≥ 0.75 × target → `behind` ("A little behind"); else `comeback` ("Comeback arc available").
- **Enforced:** `server:rpc` (`get_reading_quest_summary.status_labels`)
- **Source:** baseline §A2
- **Note:** Canonical rule: PRO-14, PRO-15.

### Stats RPC formulas & timezone handling

#### BE-40 · Page-delta definitions differ by RPC
- `get_reading_stats`: `max(0, page − lag(page, 1, 0))` per book, ordered by `(recorded_at, id)`.
- `get_last_session`, `get_monthly_reading`, `get_reading_records`: `max(0, page − previous page)`, where "previous" is the latest row with `recorded_at` **strictly earlier** (two rows with the same timestamp both compare to the earlier row).
- `get_book_passport_stats`: `max(0, clampedPage − running max of prior pages)`, so re-reading backwards never re-counts.

Totals across screens can therefore differ after backward corrections. In every variant the **first** history row of a book is compared with page 0, so the first tracked save of a book started outside the app (e.g. page 200) counts as 200 pages read that day, week, month and session. Every history row's day counts as a **reading day** for streaks regardless of its delta: a backward correction or a same-page save keeps a streak alive. ⚠ BE-D25, BE-D26
- **Enforced:** `server:rpc` (respective functions)
- **Source:** baseline §A1
- **Note:** Recommended (BC-04): a baseline history row when a book is added mid-way; its representation is open (SES-Q17). Canonical rule: PRO-21, PRO-91.

#### BE-41 · `get_reading_stats` uses server UTC
`pagesThisWeek` = rolling 7 × 24 h; `pagesThisMonth` and `sessionsThisMonth` start at `date_trunc('month', now())` UTC; streak days = `date(recorded_at)` UTC; the current streak counts only if the last reading day ≥ `current_date − 1` (UTC). `sessionsThisMonth` = distinct `(book_id, session_start_at)` with duration ≥ 60 s and delta ≥ 1. `totalReadingHours = round(Σ valid duration / 3600)` with **no** 12 h cap. `allTimeVelocityPph = round(Σ delta / (Σ duration / 3600))`. `totalPagesRead = Σ clamp(current_page, 0, total)` over manual books with `current_page > 0`. ⚠ BE-D27, BE-D29, BE-D20
- **Enforced:** `server:rpc` (`get_reading_stats`)
- **Source:** baseline §A1
- **Target:** Takes `p_timezone`; offline replays count at their original timestamp; session counts need timed sessions (D-07, D-08 · BC-04, BC-06).
- **Note:** The rolling windows compare device-written `recorded_at` with server `now()`: a device clock running ahead writes future timestamps that count immediately. Canonical rule: PRO-22 … PRO-25.

#### BE-42 · Timezone-aware RPCs
`get_reading_calendar`, `get_monthly_reading`, `get_reading_records` (argument `p_timezone`) and `get_book_passport_stats` (argument **`p_time_zone`**) apply `at time zone <arg>` directly; an invalid IANA name raises SQLSTATE `22023`. The default is `'UTC'`. `get_retention_summary` validates against `pg_timezone_names` and falls back to UTC. The web client passes `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Enforced:** `server:rpc`
- **Source:** baseline §A1, §A2; `src/composables/useMonthlyReading.ts:37`, `useReadingCalendar.ts:40`, `useReadingRecords.ts:35`, `src/stores/bookPassport.ts:21,35`
- **Target:** Every stats RPC takes `p_timezone` (streaks, this week/month, quest year, sessions this month, review daily tally, Word-of-the-Day day), and the reader's timezone is stored server-side for jobs (D-07 · BC-06).
- **Note:** Send an IANA identifier (`Europe/Lisbon`), never an abbreviation (`WEST`).

#### BE-43 · Reading records
`get_reading_records`: `bestDay` = the local day with the largest Σ delta (> 0), ties → later day; `longestSession` = max `round(duration / 60)` minutes among timed rows with `0 < duration ≤ 12 h`, ties → latest; `nightOwl` = any such session whose `recorded_at` local hour ∈ [0, 4]; `fastestFinish` = min `(firstFinishDay − firstHistoryDay + 1)` days (local) over books with `total > 0`, ties by title ascending. Each sub-object is NULL without data; unauthorised callers get `{bestDay:null, longestSession:null, fastestFinish:null, nightOwl:false}`.
- **Enforced:** `server:rpc` (`get_reading_records`)
- **Source:** baseline §A1
- **Note:** `longestSession` / `nightOwl` apply **no** ≥ 60 s or ≥ 1-page filter (unlike BE-16). `finishDay` is the first local day with `page ≥ current total_pages`; imported books (no history) never qualify. Canonical rule: PRO-35.

#### BE-44 · Monthly reading
`get_monthly_reading` returns exactly 12 rows (`month` 1–12) for `p_year` in the given zone: `pages` = Σ positive deltas; `booksFinished` = books whose **first** history row with `page ≥ total_pages` falls in that month. Imports never write history, so they are excluded.
- **Enforced:** `server:rpc` (`get_monthly_reading`)
- **Source:** baseline §A1
- **Note:** Unauthorised → 12 zero rows. Canonical rule: PRO-34.

#### BE-45 · Reading calendar
`get_reading_calendar(p_month_start)` normalises to the month containing `p_month_start` and returns only days with activity, each with its books ordered by first read time; `furthestPage = max(page)` that local day; a missing title becomes `'Unknown Book'`.
- **Enforced:** `server:rpc` (`get_reading_calendar`)
- **Source:** baseline §A1
- **Note:** Canonical rule: PRO-33.

#### BE-46 · Passport stats
`get_book_passport_stats`: pages clamped to `[0, total_pages]`; `totalDays = max(1, ceil((lastRecorded − firstRecorded) / 86 400 s))` — elapsed time, not calendar days; NULL without history; `peakDay` / `peakDayPages` = the local day with the largest delta, ties → earliest; `vocabularyCount` = the book's lexicon entries, quotes included.
- **Enforced:** `server:rpc` (`get_book_passport_stats`)
- **Source:** baseline §A1
- **Target:** Stats are frozen at completion (BC-05).

#### BE-47 · Last session
`get_last_session` reads the latest history row of any book and returns `pagesDelta`, `startPage` (previous page), `endPage`, `durationSeconds` (only with `session_start_at`), `velocityPph` (only if duration ≥ 60 s and delta ≥ 1), `completionDelta = round(delta / total × 1000) / 10` (%), and `finishPredictionSessions = ceil(remaining / max(1, rollingVelocity × lastSessionHours))`, where `rollingVelocity` = Σ delta / Σ hours over the **3 most recent valid sessions across all books** — `0` if the book is finished. It returns JSON `null` when the user has no history. ⚠ BE-D30
- **Enforced:** `server:rpc` (`get_last_session`)
- **Source:** baseline §A1
- **Note:** When the latest row is untimed, the divisor is `greatest(1, velocity × 0 h)` = 1, so the prediction equals the remaining pages ("312 sessions left"). Hide it when `durationSeconds` is null. Ignores DNF and `source`; `bookTitle` falls back to `'Unknown Book'`.

#### BE-48 · Reading velocity
`get_reading_velocity` uses the last 30 days of history for the given books: the average delta per timed session (needs ≥ 3 session deltas), else the average per **UTC** day of `max − min` page (needs ≥ 3 active days). `days_left = ceil((total − current) / avg)`. Books without enough data, finished books and books with total 0 are **omitted**, so `days_left ≥ 1` in practice. ⚠ BE-D31, BE-D27
- **Enforced:** `server:rpc` (`get_reading_velocity`)
- **Source:** baseline §A1
- **Note:** A "session delta" needs a previous row of the same book **inside** the window. A day only counts with ≥ 2 saves at different pages on the same UTC day. Only books owned by `p_user_id` are returned; DNF books are not excluded. The meaning of the estimate is open (SES-Q08).

#### BE-49 · Library breakdown
`get_library_breakdown`: `genreDistribution` sorted by count desc, NULL or blank genre → `'Uncategorized'`, `percentage = round(count / total × 100, 1)`; `authorsCount` = distinct `lower(trim(author))`; `avgCompletionPct` = average per-book completion (1 dp) over non-unread books. Imported books are included. ⚠ BE-D23
- **Enforced:** `server:rpc` (`get_library_breakdown`)
- **Source:** baseline §A1
- **Note:** Genre grouping is **case-sensitive** after `trim` (`Fantasy` ≠ `fantasy`); authors are case-folded; genre ties have no secondary order. Canonical rule: PRO-27, PRO-28.

#### BE-50 · Weekly retention summary (dormant)
`get_retention_summary(p_timezone)`: week = ISO week (Monday 00:00) in the validated zone; `sessionsThisWeek` = distinct `(book_id, session_start_at)` whose first `recorded_at` falls in the week (no ≥ 60 s / ≥ 1 page filter); `activeDaysThisWeek` = distinct local days among them; `goalProgressPct = least(100, round(sessions / weeklyGoal × 100))`; `weeklyGoal` falls back to 3 without a `user_settings` row. `nudgeCode` precedence: `goal_met` (sessions ≥ goal) → `comeback` (≥ 14 days since the last session) → `start_week` (0 sessions) → `almost_there` (goal − 1) → `keep_going`; signed out → `signed_out`.
- **Enforced:** `server:rpc` (`get_retention_summary`)
- **Source:** baseline §A2
- **Note:** Unused by any client (BE-Q01).

### Profile identity & community

#### BE-51 · Username rules
A username is lowercased and trimmed, must match `^[a-z0-9_-]{3,30}$`, must not be one of `admin, api, auth, bookhero, login, profile, u`, and is unique case-insensitively. `is_username_available` returns `available:false` when signed out, invalid, reserved or taken by someone else; the caller's own current name is "available".
- **Enforced:** `server:db` (`community_profiles_username_format_chk`, `community_profiles_username_lower_uidx`) + `server:rpc` (`is_username_available`, `upsert_my_community_profile`)
- **Source:** baseline §A3, §D
- **Note:** Canonical rules: COM-03 … COM-08; PRO-74, PRO-75.

#### BE-52 · Profile upsert semantics
`upsert_my_community_profile(payload)` creates or updates both `community_profiles` and `community_profile_privacy` and returns `get_my_community_profile()`. Defaults: `isPublic` **true** when omitted (the table default is false); each privacy field `'nobody'` when omitted; empty strings → NULL for `displayName`, `bio`, `avatarUrl`. Typed errors: `not_authenticated`, `username_invalid`, `bio_too_long` (> 160), `visibility_invalid`, `username_taken` (also on a unique-violation race). Every save **overwrites all fields**, so the client must always send the full payload. No row exists at sign-up (BE-88).
- **Enforced:** `server:rpc` (`upsert_my_community_profile`)
- **Source:** baseline §A3
- **Note:** The `isPublic` cast runs in the function's DECLARE initialiser, which its EXCEPTION handler does not cover, so a non-boolean value (e.g. `"maybe"`; `"yes"`, `"on"` and `"1"` are valid booleans) raises a raw `22P02`, not `visibility_invalid` (COM-15, COM-D27). Errors arrive as HTTP 400 `{code:"P0001", message:"<code>"}` (BE-86). `get_my_community_profile` inner-joins privacy, so a profile row created by a direct insert without a privacy row reads back as `null`.
- **Note:** iOS v1 edits only username, display name and avatar (D-13), but it must still round-trip `bio`, `isPublic` and `privacy` from `get_my_community_profile`, or one save resets them (`isPublic` → true, privacy → `nobody`, `bio` → NULL). The default for new profiles is open (BE-Q09).

#### BE-53 · Profile visibility
The owner can always view their own profile — but only if a profile row exists. For anyone else: a block in either direction → invisible; otherwise visible iff `is_public = true`. `community_has_block_between` returns **true** when either id is NULL (fail-closed).
- **Enforced:** `server:rpc` (`community_can_view_profile`, `community_has_block_between`)
- **Source:** baseline §A3
- **Note:** Canonical rules: COM-20 … COM-25, COM-107.

#### BE-54 · Interaction reason precedence
`community_interaction_reason`: NULL ids → `profile_unavailable`; same user → `self`; any block → `blocked`; not viewable → `profile_unavailable`; else `allowed`. A follow requires `allowed`; otherwise `follow_community_user` returns the relationship payload with `changed:false` (no error).
- **Enforced:** `server:rpc` (`community_interaction_reason`, `follow_community_user`)
- **Source:** baseline §A3
- **Note:** Dormant (D-13). Canonical rules: COM-24, COM-34.

#### BE-55 · Blocking side effects
`block_community_user` on self returns `{changed:false, reason:'self'}`. Otherwise it inserts the block (idempotent) and removes follows in both directions. AFTER INSERT triggers on `blocks` also delete pending circle invitations between the pair in circles where either is a member, remove the **blocked** user from every circle the blocker belongs to, and close **every** active circle that has zero members (a global sweep). Because the trigger deletes the follows before the RPC calls `community_remove_pair_follows`, `removedFollowsCount` is **always 0** for a new block. Unblock never restores follows or memberships. ⚠ BE-D49
- **Enforced:** `server:db` (triggers `community_block_cleanup_follows`, `circle_block_cleanup_memberships`) + `server:rpc` (`block_community_user`, `unblock_community_user`)
- **Source:** baseline §A3, §A5, §B
- **Note:** Dormant (D-13). Canonical rules: COM-38 … COM-40.

#### BE-56 · Denormalised follow counters
`community_follow_counts` rows exist only for users with a community profile (created by trigger on profile insert). AFTER INSERT / DELETE triggers on `follows` increment / decrement them, floored at 0. Counts are shown only when the reason is `allowed` or `self`.
- **Enforced:** `server:db` (triggers `community_ensure_count_on_profile_insert`, `community_follow_counts_after_follow_insert` / `_delete`; CHECK ≥ 0) + `server:rpc` (`community_relationship_payload`)
- **Source:** baseline §A3, §B
- **Note:** `community_reconcile_follow_counts` is never scheduled (BE-85). Canonical rules: COM-41 … COM-43.

#### BE-57 · Public profile payload
`get_public_profile_by_username` returns NULL when signed out, for an unknown username (exact lowercase match), without a privacy row, for a block in either direction, or for a non-public profile viewed by someone other than the owner. Sections are included per visibility (`everyone`; `followers` + the viewer follows; or the owner): `stats` {`booksRead`, `totalPagesRead` (all books incl. imports), `currentStreakDays` (UTC, last day today or yesterday), `longestStreakDays`}, `currentlyReading` (most recently updated in-progress book), `lexiconHighlights` (6 newest entries with `leitner_box ≥ 5`, `masteredAt` = entry `created_at`), `readerDna` {`personality`, `moodTone`, `moodEmojis`}. Hidden or empty sections are **omitted**, not null. ⚠ BE-D52
- **Enforced:** `server:rpc` (`get_public_profile_by_username`)
- **Source:** baseline §A4
- **Note:** No section filters `dnf_at` or `source`: `booksRead` counts imported and DNF books at `total_pages`; `currentlyReading` can be a DNF-shelved book; highlights include quotes and ignore `mastered`. Dormant (D-13). Canonical rules: COM-27 … COM-32.

#### BE-58 · Reader search
`search_community_readers`: the query is trimmed and lowercased; < 2 characters → empty; prefix match on username or display name; excludes self, non-public profiles and blocked pairs; ordered `created_at desc, user_id desc`; limit clamped 1–50 (default 20); signed-out callers get an empty page. The query is concatenated into `LIKE v_query || '%'` without escaping, so `_` (a legal username character) and `%` act as wildcards. ⚠ BE-D50
- **Enforced:** `server:rpc` (`search_community_readers`)
- **Source:** baseline §A4
- **Note:** Dormant (D-13). Canonical rules: COM-44 … COM-48.

#### BE-59 · Follower, following and blocked lists
Follower/following lists are empty unless the viewer can view the target profile; only public profiles are listed; pairs blocked against the viewer are excluded; ordered `followed_at desc, user_id desc`; limit 1–50. The blocked list holds the caller's own blocks and includes users without a profile (username null). These lists page by keyset on the last returned row, with no gaps (COM-54).
- **Enforced:** `server:rpc` (`list_community_followers`, `list_community_following`, `list_my_blocked_users`)
- **Source:** baseline §A4
- **Note:** Dormant (D-13). Canonical rules: COM-49 … COM-54.

#### BE-60 · "Also reading"
`get_also_reading_for_book` matches people the viewer **follows** (not followers) whose profile is viewable, whose `currently_reading_visibility ∈ {everyone, followers}`, and who are mid-book (`0 < current_page < total`) on the same book id or the same normalised ISBN. One row per user (same-book match preferred, then most recent); progress fields only when `progress_visibility ∈ {everyone, followers}`; `relativeStatus` = `same_area` if |Δ%| ≤ 10, else `ahead` / `behind`, or NULL; limit clamped 1–20 (default 3). Raises `not_authenticated`, `invalid_cursor`. DNF-shelved books of followed readers are not excluded. ⚠ BE-D53, BE-D47
- **Enforced:** `server:rpc` (`get_also_reading_for_book`)
- **Source:** baseline §A4
- **Note:** Dormant (D-13). Canonical rules: COM-55 … COM-65.

### Reading circles (dormant, D-13)

#### BE-61 · Circle creation
Name trimmed, 1–80 characters (`invalid_circle_name`); the book must be the caller's (`invalid_book`). The circle snapshots the book's title, author, cover and normalised ISBN; the creator becomes `owner`. Invitees are accepted only if the creator **follows** them and no block exists; others are returned in `skippedUserIds`.
- **Enforced:** `server:db` (`reading_circles_name_not_blank`) + `server:rpc` (`create_reading_circle`)
- **Source:** baseline §A5, §D
- **Note:** Canonical rules: COM-66 … COM-69.

#### BE-62 · Membership limits
At most **10 members** per circle including the owner (`circle_full`); a new member may not have a block with any existing member (`blocked`); exactly one owner per circle.
- **Enforced:** `server:db` (trigger `circle_members_assert_insert` → `circle_assert_member_insert`; index `circle_members_one_owner_idx`)
- **Source:** baseline §A5, §B, §E
- **Note:** Canonical rule: COM-75.

#### BE-63 · Invitations and removal
At most one *pending* invitation per `(circle, invitee)`. Only the owner may invite (`not_circle_owner`) or remove members (`use_leave_circle` when targeting self); removal also revokes a pending invitation (`status = 'revoked'`).
- **Enforced:** `server:db` (`circle_invitations_pending_unique_idx`) + `server:rpc` (`invite_reading_circle_members`, `remove_reading_circle_member`)
- **Source:** baseline §A5, §E
- **Note:** Canonical rules: COM-70, COM-71, COM-77.

#### BE-64 · Invitation response
The caller must be the invitee and the invitation `pending` (`invitation_not_pending`); accepting requires an `active` circle (`circle_not_active`) and inserts the membership (subject to BE-62). Status becomes `accepted` or `declined` with `responded_at = now()`. `expired` exists in the enum but is never set (BE-85).
- **Enforced:** `server:rpc` (`respond_to_reading_circle_invitation`)
- **Source:** baseline §A5, §F
- **Note:** Canonical rules: COM-72 … COM-74.

#### BE-65 · Leaving a circle
The caller must be a member (`not_circle_member`). If the owner leaves, the earliest-joined remaining member becomes owner and `reading_circles.owner_id` is updated; if nobody remains, the circle becomes `closed`. The hand-off and close run only when the **leaver is the owner**: if a block already stripped the owner (BE-55), the remaining members are all `member`, and when the last one leaves the circle stays `active` with zero members until some later block's sweep closes it. ⚠ BE-D48
- **Enforced:** `server:rpc` (`leave_reading_circle`)
- **Source:** baseline §A5
- **Note:** Canonical rules: COM-76, COM-78.

#### BE-66 · Reaction posting
Content trimmed, 1–280 characters (`invalid_reaction_content`); the caller must be an active member without blocks in an active circle; the book must be the caller's and match the circle by id or normalised ISBN (`invalid_book`); `1 ≤ source_page ≤ total_pages` (`invalid_page`); the caller must have progress > 0 (`invalid_progress`); and `normalized_location = round(source_page / total × 100, 3)` must be **≤ the caller's own progress location** (`reaction_ahead_of_progress`).
- **Enforced:** `server:db` (`circle_reactions_*` checks) + `server:rpc` (`add_circle_reaction`)
- **Source:** baseline §A5, §D
- **Note:** Canonical rules: COM-85 … COM-87.

#### BE-67 · Spoiler gate
A member sees only non-deleted reactions with `normalized_location` between `max(p_min, 0)` and `min(p_max, ownLocation, 100)`, excluding authors blocked either way. `viewerEquivalentPage = clamp(ceil(loc / 100 × ownTotalPages), 1, ownTotalPages)`. With no progress → `{items:[], viewerProgressMissing:true}`. Limit clamped 1–100 (default 50). The caller's own location uses their matching book (exact book preferred, else ISBN match, most recently updated). ⚠ BE-D47
- **Enforced:** `server:rpc` (`get_visible_circle_reactions`, `circle_progress_location`)
- **Source:** baseline §A5
- **Note:** Canonical rules: COM-88 … COM-93.

#### BE-68 · Circle error codes
Circle RPCs raise `P0001` with message = code: `not_authenticated`, `not_circle_member`, `not_circle_owner`, `blocked`, `circle_full`, `invalid_circle`, `invalid_circle_name`, `invalid_book`, `invalid_page`, `invalid_progress`, `invalid_reaction_content`, `reaction_ahead_of_progress`, `use_leave_circle`, `invitation_not_pending`, `circle_not_active`. Cursors for `list_my_reading_circles` and `get_visible_circle_reactions` are cast with `p_cursor::timestamptz` without a handler, so a malformed cursor surfaces as a raw `22007`/`22008` datetime error. ⚠ BE-D51
- **Enforced:** `server:rpc` (circle RPCs)
- **Source:** baseline §A5

### Storage

#### BE-69 · `recap-images` bucket
Private; 10 MiB per object; `image/png`, `image/jpeg`, `image/webp`. Policies allow SELECT, INSERT and DELETE when the first path segment equals the caller's uid (no UPDATE policy). Objects are written by `generate-recap` with the service role at `{userId}/{recapId}.png` (upsert). Clients read through signed URLs.
- **Enforced:** `server:db` (bucket limits; policies `recap-images: owner can select` / `insert` / `delete`)
- **Source:** baseline §C, §G; `supabase/functions/generate-recap/utils/storage.ts:11-16`
- **Note:** Owners may delete their own recap images through the Storage API today; nothing does (BE-71).

#### BE-70 · `community-avatars` bucket
Public; 5 MiB per object; `image/jpeg`, `image/png`, `image/webp`. Authenticated users may SELECT, INSERT, UPDATE and DELETE only under `{jwt.sub}/…`; public URL reads need no policy; listing is restricted to the caller's own folder.
- **Enforced:** `server:db` (bucket limits; policies `community_avatars_owner_*`)
- **Source:** baseline §C, §G

#### BE-71 · The database never deletes Storage objects
Deleting a book, recap or user deletes no Storage object: `storage.objects` has no FK to `auth.users` or `recaps`, and the `protect_objects_delete` trigger (`storage.protect_delete()`, statement-level BEFORE DELETE) blocks direct SQL deletes. Objects must be removed through the Storage API. ⚠ BE-D37
- **Enforced:** `server:db` (`protect_objects_delete`)
- **Source:** live `pg_trigger` on `storage.objects`; baseline §G
- **Target:** Account deletion purges `recap-images/{uid}/` and `community-avatars/{uid}/` through the Storage API (D-10 · BC-11).
- **Note:** Recommended (BC-13): delete recap images when a recap or book is deleted, plus an orphan sweep (BE-Q05).

### Cascades

#### BE-72 · Deleting a book
`DELETE FROM books WHERE id = …` cascades to `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `lore_cards`, `book_passports`, `page_captures`, `book_quizzes`, `up_next_order`, `vocabulary_extractions`, `circle_reactions` on that book, and **every `reading_circles` row anchored on that book** — which in turn cascades its `circle_invitations`, `circle_members` and `circle_reactions` for **all** members. SET NULL: `reading_quest_events.book_id` (capture XP kept). Untouched: `achievements`, `reading_dna`, `reading_goals`, `anki_review_sessions`, `user_settings`, and Storage objects (`recap-images/{uid}/{recapId}.png` orphaned). ⚠ BE-D37, BE-D48
- **Enforced:** `server:db` (`*_book_id_fkey ON DELETE CASCADE`; `reading_quest_events_book_id_fkey ON DELETE SET NULL`; `reading_circles_book_id_fkey`)
- **Source:** live `pg_constraint` (48 FKs); baseline §D
- **Note:** Derived values are recomputed on the next read: XP from that book's pages, completion, history rows, recaps and lore disappears, so the reader's level can **drop**; capture XP and badges stay (LIB-Q15). Flow: F6.

#### BE-73 · Deleting a user
Deleting the `auth.users` row cascades every user-owned table (`books` → the BE-72 chain, plus `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `lore_cards`, `book_passports`, `page_captures`, `book_quizzes`, `up_next_order`, `vocabulary_extractions`, `reading_dna`, `reading_goals`, `reading_quest_events`, `achievements`, `anki_review_sessions`, `user_settings`, `community_profiles` → `community_profile_privacy`, `community_follow_counts`), `follows` and `blocks` on either side (follow-count triggers decrement the counterparts), `circle_invitations` (as invitee or inviter), `circle_members`, `circle_reactions` (as author), and **`reading_circles` where the user is `owner_id` OR `created_by`** — the whole circle is deleted for everyone. Storage objects are orphaned. ⚠ BE-D38, BE-D48
- **Enforced:** `server:db` (all `user_id` FKs → `auth.users ON DELETE CASCADE`)
- **Source:** live `pg_constraint`; baseline §D
- **Target:** Immediate hard delete through a new `delete-account` edge function with confirmation and re-authentication, on web **and** iOS: purge Storage, revoke the Sign in with Apple token, `auth.admin.deleteUser`; these FK cascades remove the rows (D-10 · BC-11). Flow: F7.

#### BE-74 · Deleting a community profile
The owner may delete their `community_profiles` row directly (RLS). It cascades `community_profile_privacy` and `community_follow_counts`, but leaves `follows`, `blocks` and circle memberships, which reference `auth.users`.
- **Enforced:** `server:db` (`community_profile_privacy_user_id_fkey`, `community_follow_counts_user_id_fkey`; policy `community_profiles_owner_delete`)
- **Source:** baseline §C, §D

### Edge-function-enforced rules

#### BE-75 · `generate-recap` request validation and routing
Check order: `Authorization` header (401 `No authorization header`) → payload decode (401 `Unauthorized`) → `req.json()` (a malformed body throws inside the outer `try` → **500** `Internal server error`, not 400) → field validation → `GEMINI_API_KEY` (503 `AI service not configured`, also for images) → `OPENAI_API_KEY` (images only). Non-image modes need truthy `title`, `author`, `totalPages` and a defined `percentage` (400 `Missing required fields`); `recap_image` needs `recapId`, `title`, `memoryJogger` (400 `Missing required image fields`). Routing: `mode:'recap_image'` → image job; `mode:'passport_summary'` → passport (validated like a text mode); `currentPage === 0` → blurb; anything else (including a body without `currentPage`) → mid-book recap. There is no HTTP-method check. ⚠ BE-D08, BE-D09, BE-D11, BE-D43
- **Enforced:** `server:edge` (`generate-recap`, verify_jwt **false**)
- **Source:** `supabase/functions/generate-recap/index.ts:16-65`, `router.ts:11-16`, `auth.ts:5-16`
- **Target:** Real JWT verification (BC-02); the recap lock (+5 % / 6 h cooldown / 72 h idle) enforced on the server clock, the corpus window selected server-side and the row persisted by the function (BC-07); a shared entitlement and AI-usage check before any model call (BC-12).

#### BE-76 · Mid-book recap: corpus vs inferred
A non-empty `captures[]` selects the **corpus** path: captures sorted by page and composed directly (response header `X-Recap-Mode: corpus`). Otherwise the **inferred** path runs `gemini-2.5-pro` extraction with Google Search grounding at temperature 0, retried while the result is `confidence_level = 'low'` **or** has no parseable JSON, up to `MAX_ATTEMPTS = 2` extra attempts (≤ 3 Pro calls), each lowering `currentPage` by `PAGE_BUFFER = 5 × attempt` but never to ≤ `from_page`; a result that omits `confidence_level` is accepted. A safety block → immediate 500 `Provider safety block`. All inferred-path failures are JSON 500s returned **before** streaming starts (`{error:'AI output invalid', detail:'Low extraction confidence after retries' | 'No JSON block found in response' | 'Recap composition failed'}`).
- **Enforced:** `server:edge` (`generate-recap`)
- **Source:** `supabase/functions/generate-recap/handlers/recap.ts:22-80,272`; `extraction/retryPolicy.ts:4-25`; `extraction/runExtraction.ts:30-58`
- **Target:** The server selects the corpus window (BC-07).
- **Note:** The extractor prompt stops ~15–20 % before the reader's page, or at `round(percentage × 0.8)` % when no chapter map is found. `X-Recap-Mode` is not listed in `Access-Control-Expose-Headers`, so browsers cannot read it (native clients can). Canonical rules: [03 · Recaps](03-recaps.md).

#### BE-77 · Recap output contract
All modes except passport and image stream `text/plain` that must parse to `{memory_jogger, concept_watchlist, thematic_bridge}`. Prompt caps: recap `memory_jogger` 2–4 sentences / ≤ 90 words, `concept_watchlist` ≤ 5 items; blurb ≤ 600 characters and ≤ 13 items; passport = one 90–100-word plain-text paragraph. The server does **not** validate the streamed JSON; the client parses, validates and persists. A mid-stream failure is a truncated body. ⚠ BE-D43
- **Enforced:** `server:edge` (prompts only) + `client` (`src/services/recapService.ts:99-126`)
- **Source:** `supabase/functions/generate-recap/prompts/recap.ts:41-43`, `prompts/blurb.ts:13-14`, `prompts/passport.ts:11`
- **Target:** The function validates and persists the row itself; once a generation is paid for it finishes and saves even if the client aborts (BC-07).

#### BE-78 · Recap image job
`mode:'recap_image'` answers `202 {status:'accepted'}` immediately and continues in `EdgeRuntime.waitUntil`. It sets `image_status = 'pending'`, refines the prompt with `gemini-2.5-flash` (temperature 0.4, no thinking override; falls back to a deterministic prompt on error **or empty output**), and calls OpenAI `gpt-image-2` at 1024 × 1024, `quality:"low"`. A safety error retries once with a softer prompt; a transient error retries once after 2 000 ms. Final states: `succeeded` (upload `{uid}/{recapId}.png` with upsert, set `image_path` and `image_generated_at`), `failed_safety` or `failed_transient`. Updates use the **service role**, filtered `id = recapId AND user_id = <decoded sub>`. ⚠ BE-D36, BE-D08
- **Enforced:** `server:edge` (`generate-recap`)
- **Source:** `supabase/functions/generate-recap/handlers/recapImage.ts:19-32`, `handlers/image.ts:55-160`, `openaiClient.ts:12`, `utils/storage.ts:11-16`
- **Note:** Gaps: `handleImageGeneration` has `try/finally` but no `catch`, so a Storage or DB exception leaves the row `pending` forever while the log reports `failed_transient`. A `recapId` that is not the caller's (or was deleted) makes every UPDATE match 0 rows **without error**, yet Gemini and OpenAI are still billed and `{sub}/{recapId}.png` is still uploaded. Classification: HTTP 429/5xx → transient; other non-2xx → safety only if the message matches `/safety|policy|moderation|content policy|blocked/i`, else transient. [UNVERIFIED: the Edge Runtime wall-clock limit is plan-dependent; a killed job also leaves `pending`.]
- **Note:** Recommended (BC-13): a stale `pending` becomes `failed_transient` after a timeout, and the job handles its errors.

#### BE-79 · `generate-lore` validation
Non-POST → 405. All of `title, author, currentPage, totalPages, percentage, milestone, masterRecap` must be non-null; `masterRecap` must be a non-blank string; `Number(milestone)` must be one of 10, 20, …, 90 (`"50"` passes); an invalid JSON body → 400 `Missing required fields`. The output `type` must be one of `History, Culture, Geography, Technology, Lore` (else 500 `AI output invalid`); `linked_entities` is truncated to 5, non-strings dropped, strings trimmed. The response is `{title, content, type, linked_entities}` only — the function never writes `lore_cards`. ⚠ BE-D08, BE-D41
- **Enforced:** `server:edge` (`generate-lore`, verify_jwt **false**)
- **Source:** `supabase/functions/generate-lore/index.ts:86-131,318-326`
- **Target:** The deployed version is canonical: v18, accuracy-first prompt, temperature 0.35; the repo source is synced to it (D-09 · BC-03). Orchestration and persistence move server-side (D-12 · BC-08).
- **Note:** Prompt targets: title 3–8 words, content 90–160 words. Canonical rules: [06 · Insights](06-insights.md) (INS-22 … INS-24).

#### BE-80 · `ocr-page` validation
`mimeType ∈ {image/jpeg, image/png}`; the image must be ≤ 5 MiB (computed from the base64 length — send raw base64, not a `data:` URL); one 10 s budget covers the call and its single retry (504 `OcrTimeout`; 502 `OcrUpstream` after the retry fails); `confidence` is clamped to [0, 1]; `wordCount` = whitespace-split count. Image bytes are never persisted. If the model's JSON omits `text` or `confidence`, the function still answers **200** with `text: ""` and/or `confidence: 0`. There is no HTTP-method check (a GET falls into 400 `Body must be JSON`). ⚠ BE-D08, BE-D09, BE-D44
- **Enforced:** `server:edge` (`ocr-page`, verify_jwt **false**)
- **Source:** `supabase/functions/ocr-page/index.ts:30-40,118-122,166-201`
- **Target:** iOS uses on-device Apple Vision first and falls back to `ocr-page` on low confidence; the 0.90 auto-save / 0.70 warning thresholds are Gemini-calibrated and are recalibrated for Vision (D-15); JWT verification (BC-02).
- **Note:** An empty `text` cannot be saved (BE-24); route it to manual review. The timed-out Gemini call is not aborted.

#### BE-81 · `extract-vocabulary` validation
At most 5 words; word length > 1; non-empty definition. Any AI or configuration failure → **200 `{words: []}`**; errors never surface. There is no cap on `ocrText` length and none on returned word length, so a > 200-character "word" fails `lexicon_entries_term_check` on the client insert and fails the whole batch. ⚠ BE-D45
- **Enforced:** `server:edge` (`extract-vocabulary`, verify_jwt true)
- **Source:** `supabase/functions/extract-vocabulary/index.ts:51-58,90-135`
- **Target:** The shared entitlement / AI-usage check runs first (BC-12).
- **Note:** Proper-noun filtering and case-insensitive dedup are client-side; auto entries are inserted with `leitner_box 1` and `next_review_at = now + 24 h` cast to a UTC `date` ([05 · Codex](05-codex-lexicon.md)).

#### BE-82 · `generate-page-resume` validation
`pageText` is truncated to 12 000 characters and `recapContext` to 800 (it must be a string if present, else 400 `invalid_input`). Output: ≤ 3 bullets, each — and the `tension` line — capped at 240 characters; at least one non-empty bullet is required, else `null`; `tension` may be an empty string. `insufficient` or any failure → **200 `{resume: null}`**.
- **Enforced:** `server:edge` (`generate-page-resume`, verify_jwt true)
- **Source:** `supabase/functions/generate-page-resume/index.ts:70-81,121-122,153-161`
- **Note:** Nothing is persisted on `null`, so the client retries on every Start (CAP-Q06).

#### BE-83 · `generate-book-quiz` validation
Uses only the **last 6** captures in the order received (so clients must send them in reading order), each truncated to 6 000 characters; returns 1–3 questions (invalid ones are filtered, not repaired), exactly 3 options each, `correctIndex` 0–2, question ≤ 240 and option ≤ 120 characters. Options are shuffled server-side (Fisher–Yates) and `correctIndex` remapped. A single capture with a non-numeric `page` or blank `text` rejects the whole request (400 `invalid_input`). Any other failure → **200 `{quiz: null}`**.
- **Enforced:** `server:edge` (`generate-book-quiz`, verify_jwt true)
- **Source:** `supabase/functions/generate-book-quiz/index.ts:59-70,90-131,174-177,212-220`
- **Note:** Canonical rules: [04 · Capture](04-capture-resume-quiz.md).

#### BE-84 · `generate-reading-dna` validation
Requires a `books` array with ≥ 1 entry (no upper bound, no per-entry validation). Output: personality 50–800 characters, tone 1–40, emojis 1–5 (the prompt asks for exactly 3), suggestions trimmed to 5 with ≥ 3 required; otherwise 502 `ai_unavailable` (also when `GEMINI_API_KEY` is missing). The response adds `booksFinishedAtGeneration = books.length` and `generatedAt`. Length checks use JS UTF-16 `.length` while the DB uses code points (BE-90). The function never writes `reading_dna`; the client upserts on `user_id`. ⚠ BE-D41, BE-D46
- **Enforced:** `server:edge` (`generate-reading-dna`, verify_jwt true)
- **Source:** `supabase/functions/generate-reading-dna/index.ts:56-91,148-157,194-198`
- **Target:** The deployed v8 with Google Search grounding is canonical; the repo is synced to it (D-09 · BC-03). DNA eligibility moves server-side (BC-05).

---

## Flows

### F1 · Online page save — what the database does (today)

1. **Progress upsert.** The client upserts `reading_progress {book_id, user_id, current_page}` (`onConflict book_id,user_id`). The DB stamps `updated_at = now()` on UPDATE (BE-14); the AFTER triggers delete all captures and the quiz if `current_page ≥ total_pages` (BE-19, BE-20). *Persisted:* the page.
2. **History insert.** The client inserts `progress_history {book_id, user_id, page, recorded_at: <device time>, session_start_at: <captured start or null>}`. A failure is swallowed. *Persisted:* the history row — or nothing, silently (⚠ BE-D18).
3. **Session clear.** If a session was active, the client fires `UPDATE reading_progress SET session_start_at = NULL, session_paused_at = NULL` without awaiting it (the `updated_at` trigger fires again). If it fails, the session survives server-side; the next save writes a second history row with the same `session_start_at`, and hours and velocity count both rows' full durations (⚠ BE-D18).
4. **Failure.** If step 1 fails online, the client rolls back and rethrows. Nothing ties steps 1–3 together: there is no transaction and no idempotency key, so a double tap writes duplicate history rows (⚠ BE-D16).
5. **Offline.** The PWA queues `{bookId, currentPage}` in IndexedDB and later replays **only step 1**, FIFO, last-write-wins, with no version check. No history row is ever written for an offline save and the session columns are not cleared. Offline pages count toward `current_page`-based numbers (quest pages, `totalPagesRead`, library %) but never toward history-based ones (streaks, week/month pages, sessions, hours, velocity, calendar, monthly chart, records); the next online save's delta absorbs them into that day. A stale replay can overwrite a newer page written from another device, and a replayed page ≥ total fires the completion purge (⚠ BE-D17). The queue is not user-scoped: after an account switch it replays as the new user, creating rows on another user's `book_id` (BE-02 ⚠ BE-D06).

**Target (D-06, D-08 · BC-04):** one `save_progress(book, page, note, client_occurred_at, idempotency_key)` RPC writes `reading_progress` + `progress_history` and ends the session atomically on the server clock; detects completion and stamps `completed_at`; offline replays send their original time and are counted (timed vs untimed history kept apart).

### F2 · Session columns (no server state machine)

```
idle (session_start_at NULL)
  ── start ──► running   (client upsert: current_page, session_start_at = device now, session_paused_at = NULL)
running ── pause ──► paused   (UPDATE … SET session_paused_at = now WHERE session_start_at IS NOT NULL)
paused ── resume ──► running  (session_start_at += now − session_paused_at; session_paused_at = NULL)
running|paused ── end ──► idle (F1: history row carries session_start_at, shifted by the paused span when saved while paused; then both columns cleared)
running|paused ── cancel ──► idle (both columns NULL; no history)
running|paused ── DNF ──► idle (DNF upsert also nulls both columns; no history)
```

- The DB enforces **none** of these transitions: no CHECK, no trigger, and no RPC reads `session_paused_at`. Duration math everywhere is `recorded_at − session_start_at`.
- Start is refused **client-side** on a finished or DNF book; the start upsert also sends `current_page`, re-firing the completion triggers (BE-19a).
- **Target (BC-04):** `start_session` / `pause_session` / `resume_session` / `cancel_session` RPCs on the server clock.

### F3 · Completion — database effects by write path (today)

| Path | Purge triggers (BE-19/20) | `progress_history` row | Quest credit date | Capture XP |
|---|---|---|---|---|
| Online page save reaching `total_pages` | yes | yes | `updated_at` of that write (UTC year) | kept |
| Offline save, replayed later | yes, at replay | **no** | replay time | kept |
| Add book as "finished" (manual) | yes (INSERT) | no | insert time | — |
| CSV import "read" | yes (no-op, no captures) | no | not counted (imported) | — |
| `total_pages` lowered to ≤ `current_page` | **no** (no trigger on `books`) | no | the row's last `updated_at` (may be a past year) | kept |
| Any later UPDATE of a finished book's row (session columns, DNF toggle, DNF resume) | re-runs only if the write lists `current_page` (BE-19a) | no | **moves** to the new `updated_at` (⚠ BE-D19) | kept |

Side effects outside the DB (passport, Insight, completion prompt, achievements, DNA) run only in the client on the online path. **Target (BC-05):** one server owner for completion effects regardless of client or path.

### F4 · Capture save — trigger chain

1. Client upserts `page_captures` on `(user_id, book_id, page)` → AFTER trigger upserts the `reading_quest_events` row (+5 XP once per distinct page; earliest `occurred_at` wins).
2. Same trigger: if the book is complete, delete **all** of the book's captures. PostgREST still returns the inserted row (BE-21).
3. Client fire-and-forget: `vocabulary_extractions` row `pending` (unique per capture; `23505` on re-capture → skipped; `23503` if the capture was purged) → `extract-vocabulary` → client dedup → `lexicon_entries` (`source='auto'`) → ledger `succeeded | skipped | failed`.
4. Client fire-and-forget: `generate-page-resume` → `UPDATE page_captures SET resume, resume_generated_at` (re-fires step 1–2 as an UPDATE; matches 0 rows if purged).
5. On later completion: captures (and resumes) deleted (BE-19); ledger rows keep `capture_id = NULL` (BE-22).

### F5 · Recap and image status (`recaps.image_status`)

```
client streams generate-recap ──fail/abort──► nothing persisted
   │ JSON parsed client-side
   ▼
client INSERT recaps (…, mode, image_status = 'pending') ── client POST mode = recap_image
   │                                                         │ 4xx/5xx/network/503 → row stays 'pending' FOREVER
   ▼                                                         ▼
edge 202 → 'pending' (re-set) → refine prompt → OpenAI
   ├─ ok ─────────────────────────────► upload {uid}/{recapId}.png → 'succeeded' + image_path + image_generated_at
   ├─ safety → softer prompt ─ ok ────► 'succeeded'
   │                         └ fail ──► 'failed_safety' | 'failed_transient'
   └─ transient → wait 2 s ── ok ─────► 'succeeded'
                             └ fail ──► 'failed_transient'
exception in upload/update, runtime kill ─► stays 'pending' (no catch, no server timeout)
'skipped': valid value, never written (clients treat NULL as 'skipped')
```

Live distribution on 2026-10-18: only NULL (legacy rows) and `succeeded`. The PWA watches with a Realtime subscription that never fires (BE-85) plus 2 s polling with no cap. **Target (BC-07):** the function persists the recap row; **recommended (BC-13):** stale `pending` → `failed_transient`.

### F6 · Book delete

1. Client: `DELETE books WHERE id = …` (the `safeupdate` filter is required).
2. DB: BE-72 cascade, including circles anchored on the book (deleted for every member).
3. Survives: capture XP events (`book_id` → NULL), achievements, `reading_dna` (its `books_finished_at_generation` is not lowered), `reading_goals`, `anki_review_sessions`, and the `recap-images/{uid}/{recapId}.png` objects.
4. History-based stats lose the book retroactively; XP from its pages, completion, history rows, recaps and lore vanishes, so the level can drop.
5. In-flight AI work for the book fails after paying: later inserts hit FK `23503`; the resume `UPDATE` matches 0 rows; the image job still uploads an orphan object (BE-78).

### F7 · Account deletion

- **Today:** no client path, RPC or edge function exists. A dashboard deletion applies BE-73 and leaves Storage objects behind (⚠ BE-D38).
- **Target (D-10 · BC-11), web and iOS:**
  1. The client confirms and re-authenticates the reader.
  2. The client calls the new `delete-account` edge function with the user's JWT; the function verifies it.
  3. The function purges `recap-images/{uid}/` and `community-avatars/{uid}/` through the Storage API (SQL deletes are blocked, BE-71).
  4. If the account used Sign in with Apple, the function revokes the Apple token.
  5. The function calls `auth.admin.deleteUser(uid)`; FK cascades remove every row (BE-73), including circles the user owns or created.
  6. The client wipes all local state for that user (caches, queues, widgets, Live Activities).

### F8 · Profile identity save (today)

1. `get_my_community_profile` → `null` (no row) or `{profile, privacy}`.
2. Optional avatar upload to `community-avatars/{uid}/avatar-{epochMs}.jpg` (upsert), then best-effort removal of every other file in `{uid}/`.
3. `upsert_my_community_profile(payload)` with the full payload (BE-52) → typed errors or the new state.

Ordering hazard: steps 2a/2b run **before** step 3. If the save fails (e.g. `username_taken`), the stored `avatar_url` points at a file that was just deleted. Every client should upload → save → clean up.

### F9 · Follow, block and circle lifecycle (dormant, D-13)

```
follow (target public & no block; idempotent; changed flag) ⇄ unfollow
block → follows removed both ways → circle invitations between the pair deleted →
        blocked user removed from the blocker's circles → empty circles closed (global sweep)
unblock → block row deleted only (nothing restored)

circle: create (owner + pending invitations) ─► active
invitation: pending ─accept─► accepted (member row) | ─decline─► declined | ─owner removes─► revoked | expired: never set
member: joined ─leave─► gone (owner leaving → earliest member promoted; none left → closed)
        ─removed by owner─► gone
anchor book deleted, or owner/creator account deleted ─► circle row DELETED (cascade)
closed: terminal (no RPC reopens; closed circles are invisible to every RPC)
```

### F10 · Shipping a backend change (privilege and drift discipline)

1. Write the change as a migration (never dashboard-only); new RPCs are client-agnostic and backward compatible (D-05).
2. In the same migration: `revoke execute … from public, anon`; grant `authenticated` only where the function is a real RPC; internal helpers get no client grant. Until the default ACL is fixed, **every new function is anon-executable by default** (BE-06).
3. Assert identity with `(select auth.uid())`, NULL-safe (BE-07); take `p_timezone` for any day boundary (BE-42).
4. Regenerate the live baseline file and update the [backend contract](../backend-contract.md) in the same change (BC-03).
5. Deploy edge functions from the repo with an explicit `supabase/config.toml` (`verify_jwt` per function), so a redeploy cannot silently change auth (BC-02).

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| Book title | 1–500 chars | `books.title` | `books_title_check` |
| Book author | 1–200 chars | `books.author` | `books_author_check` |
| Page count | ≥ 1, no maximum | `books.total_pages` | `books_total_pages_check` |
| ISBN format | `^\d{9}[\dX]$\|^\d{13}$` | stored ISBN (no hyphens, uppercase X) | `books_isbn_check` |
| Session note | ≤ 160 chars | `progress_history.session_note` | `progress_history_session_note_check` |
| History page | ≥ 0 | `progress_history.page` | `progress_history_page_check` |
| Capture text | 1–10 000 chars | `page_captures.text` | `page_captures_text_check` |
| Capture confidence | `numeric(3,2)` in [0, 1] | rounded to 2 dp | `page_captures_confidence_check` |
| Capture source | `ocr`, `manual`, `import` | default `ocr` | `page_captures_source_check` |
| Vocabulary per capture | 0–5 words | ledger `words_added` | `vocabulary_extractions_words_added_check` |
| Ledger status | `pending`, `succeeded`, `failed`, `skipped` | | `vocabulary_extractions_status_check` |
| Lexicon term | 1–200 chars | | `lexicon_entries_term_check` |
| Lexicon `page_found` | NULL or ≥ 1 | | `lexicon_entries_page_found_check` |
| Leitner box | 1–5, default 1 | | `lexicon_entries_leitner_box_check` |
| `next_review_at` default | `CURRENT_DATE` (UTC) | manual adds | column default |
| Recap mode | `corpus`, `inferred` (default) | | `recaps_mode_check` |
| Recap image status | NULL, `pending`, `succeeded`, `failed_safety`, `failed_transient`, `skipped` | | `recaps_image_status_check` |
| Insight milestones | 10, 20, …, 90 | max 9 cards per book | `lore_cards_unlocked_at_milestone_check` |
| DNA text | personality 50–800; tone 1–40; emojis 1–5 | | `reading_dna_*` |
| Quiz score | NULL or 0–3 | | `book_quizzes_score_check` |
| Goal year / target | 2000–2100 / ≥ 1 | | `reading_goals_*` |
| Weekly goal | 1–7, default 3 | dormant | `user_settings_weekly_goal_check` |
| `statement_timeout` | 8 s authenticated / 3 s anon | per request | `pg_db_role_setting` |
| `lock_timeout` | 8 s | authenticator | `pg_db_role_setting` |
| `safeupdate` | on | UPDATE/DELETE need a filter | `pg_db_role_setting` |
| DB `TimeZone` | UTC | non-TZ RPC boundaries | `current_setting('TimeZone')` |
| `app.settings.jwt_exp` | 3600 | DB GUC | `pg_db_role_setting` |
| Valid session | ≥ 60 s and ≥ 1 page | stats, last session | `get_reading_stats`, `get_last_session` |
| Records session cap | 0 < duration ≤ 12 h | records only | `get_reading_records` |
| Night-owl hours | local 00:00–04:59 | | `get_reading_records` |
| Rolling velocity | 3 most recent valid sessions (all books) | finish prediction | `get_last_session` |
| Velocity window / samples | 30 days / ≥ 3 sessions or ≥ 3 active UTC days | | `get_reading_velocity` |
| Streak tolerance | last day ≥ today − 1 (UTC) | | `get_reading_stats`, `get_public_profile_by_username` |
| XP weights | page 1 · completed book 25 · history row 10 · captured page 5 · recap 20 · Insight 15 | | `get_reading_quest_summary` |
| Level floors | 0 / 1 500 / 4 000 / 8 000 / 14 000 / 22 000 / 34 000 | levels 0–6 | `get_reading_quest_summary` |
| Seconds per month | 2 629 800 | quest pacing | `get_reading_quest_summary` |
| Quest factors | ahead ≥ 1.1 × target; behind ≥ 0.75 × target | | `get_reading_quest_summary` |
| Retention comeback | ≥ 14 days | dormant | `get_retention_summary` |
| Username | `^[a-z0-9_-]{3,30}$`; reserved `admin, api, auth, bookhero, login, profile, u` | | `community_profiles_username_format_chk`, `upsert_my_community_profile` |
| Bio | ≤ 160 chars | | `community_profiles_bio_len_chk` |
| Community page size | default 20, clamp 1–50 | lists, search | community RPCs |
| Search minimum | 2 chars | | `search_community_readers` |
| Also-reading | default 3, clamp 1–20; same area ± 10 % | | `get_also_reading_for_book` |
| Public highlights | 6 newest, `leitner_box ≥ 5` | | `get_public_profile_by_username` |
| Circle name / members | 1–80 chars / ≤ 10 incl. owner | | `reading_circles_name_not_blank`, `circle_assert_member_insert` |
| Reaction length / page size | 1–280 chars / default 50, clamp 1–100 | | `circle_reactions_*`, `get_visible_circle_reactions` |
| `recap-images` bucket | private, 10 MiB, png/jpeg/webp | | `storage.buckets` |
| `community-avatars` bucket | public, 5 MiB, jpeg/png/webp | | `storage.buckets` |
| OCR input | jpeg/png, ≤ 5 MiB, 10 s total incl. 1 retry | | `ocr-page/index.ts:38-40` |
| Resume caps | input 12 000 / recap 800; ≤ 3 bullets × 240 chars | | `generate-page-resume/index.ts:70-81,121-122` |
| Quiz caps | last 6 captures × 6 000 chars; ≤ 3 questions; 3 options; Q ≤ 240, option ≤ 120 | | `generate-book-quiz/index.ts:121-125,175-177` |
| Recap extraction retry | `MAX_ATTEMPTS` 2, `PAGE_BUFFER` 5 | inferred path | `generate-recap/extraction/retryPolicy.ts:4-5` |
| Recap image | 1024 × 1024, `quality: low`; 1 retry after 2 000 ms | | `generate-recap/handlers/image.ts:61-63,126` |
| Insight output | ≤ 5 linked entities; types History, Culture, Geography, Technology, Lore | | `generate-lore/index.ts:114,128` |
| DNA suggestions | 3–5 | | `generate-reading-dna/index.ts:59-85` |
| Signed URL TTL (client) | 60 s single image, 3 600 s gallery/carousel | | `src/composables/useRecapImage.ts:35`, `useRecapGallery.ts:12` |

---

## Data touchpoints

Shapes: [backend contract §3 Tables](../backend-contract.md#3-tables), [§8 RPC catalogue](../backend-contract.md#8-rpc-catalogue), [§7 Storage](../backend-contract.md#7-storage).

| Object | Read / write | By whom |
|---|---|---|
| `books` | R/W | client (direct CRUD); RPCs read |
| `reading_progress` | R/W | client (upserts, session updates, DNF); trigger `updated_at`; completion triggers read; RPCs read |
| `progress_history` | R/W | client (insert per online save, session note update); every stats RPC reads |
| `page_captures` | R/W/D | client (upsert, resume update); triggers delete (BE-19, BE-21) |
| `book_quizzes` | R/W | client (upsert, score); trigger deletes (BE-20) |
| `reading_quest_events` | R | trigger writes only; quest RPC reads |
| `vocabulary_extractions` | R/W | client (ledger) |
| `lexicon_entries`, `anki_review_sessions` | R/W | client |
| `recaps` | R/W | client insert; `generate-recap` (service role) updates image columns |
| `lore_cards`, `book_passports`, `reading_dna` | R/W | client writes edge-function output |
| `reading_goals` | R/W | client upsert `onConflict user_id,year`; quest RPC reads |
| `achievements` | R/insert | client (`ignoreDuplicates`) |
| `user_settings` | R/W | `upsert_weekly_goal` only (dormant) |
| `community_profiles`, `community_profile_privacy` | R/W | profile RPCs (direct writes possible, BE-05) |
| `community_follow_counts`, `follows`, `blocks`, circle tables | R/W | dormant RPCs and triggers |
| `recap-images` | W (service role) / R (signed URLs) | `generate-recap`; client |
| `community-avatars` | R/W | client |

---

## Client-side logic & server migration

Rules the database does **not** enforce, which every client implements today, and where they go under D-06.

| # | Client rule today | Related BE rule | Under D-06 |
|---|---|---|---|
| 1 | Online save sequence: upsert `current_page` → insert history (device time + captured `session_start_at`) → clear session columns | F1, BE-15 | **Moves:** atomic `save_progress` on the server clock (BC-04) |
| 2 | Clamp `current_page` to `[0, total_pages]` | BE-13 | **Moves:** server validation in `save_progress` (BC-04); clients keep UX validation |
| 3 | Upsert column discipline: send only the columns meant to change (page save → `current_page`; start → `current_page, session_start_at, session_paused_at:null`; DNF → `current_page, dnf_at, session_*:null`) | F2 | **Moves:** session and DNF/resume RPCs that never send `current_page` (BC-04) |
| 4 | Session guards (no start on finished/DNF), pause shift on save, cancel without history | F2 | **Moves:** session RPCs (BC-04) |
| 5 | Completion detection and its effects (passport, Insight, achievements, DNA) | F3 | **Moves:** BC-05, BC-08, BC-09 |
| 6 | Achievement catalog and conditions | BE-34 | **Moves:** BC-09 |
| 7 | DNA regeneration threshold | BE-31 | **Moves:** BC-05 |
| 8 | Insight milestone gating, dedup, `23505` = already unlocked | BE-29 | **Moves:** BC-08 |
| 9 | Recap lock, range (`from_page`), corpus vs inferred, JSON validation, row insert | BE-75 … BE-77 | **Moves:** BC-07 |
| 10 | Image-status polling with a cap | F5 | Stays client; recommended BC-13 / BC-14 add a terminal state and push |
| 11 | Identity isolation (passing one's own `p_user_id`) | BE-07 | **Moves:** server assertion (BC-01); the parameter stays |
| 12 | Timezone argument on day-boundary RPCs | BE-42 | **Extended:** every stats RPC (BC-06) |
| 13 | Imports write no history; add-with-status writes no history | BE-23a | Recommended: atomic import RPC (BC-15) and baseline row (BC-04) |
| 14 | `page_count_estimated = false` on page-count save | BE-11a | Stays client (LIB-Q05) |
| 15 | ISBN cleaning before insert | BE-09 | Recommended: BC-15 |
| 16 | Lexicon dedup | BE-26 | Stays client (BE-Q03) |
| 17 | Vocabulary-ledger transitions | BE-25 | Stays client (not covered by BC-01…15) |
| 18 | Leitner scheduling, daily cap | BE-26 | Recommended: `review_lexicon_entry` RPC (BC-10) |
| 19 | Quiz cache policy; resume once per capture | BE-32, BE-82 | Stays client (CAP-Q16) |
| 20 | AI-result persistence and conflict targets: `page_captures.resume` (update by id), `book_quizzes` (`user_id,book_id`), `lore_cards` (unique milestone), `reading_dna` (`user_id`), `book_passports` (`book_id`), `recaps` (insert) | BE-28 … BE-32 | Recaps BC-07, Insights BC-08, passport/DNA BC-05; resume and quiz stay |
| 21 | Avatar processing and upload → save → cleanup ordering | F8 | Stays client |
| 22 | AI rate limiting — none anywhere | BE-75 … BE-84 | **Moves:** shared check in every AI function (BC-12) |

---

## Caching & offline

- **Server side:** no caches, materialized views or scheduled refreshes; every RPC recomputes from base tables (full scans of the caller's `progress_history`). No server-driven invalidation signal exists (BE-85): trigger deletions, follow counts and image status are visible only on re-fetch or poll.
- **Client keys** (PWA, `src/composables/useCache.ts:185-206`): `library:{uid}`, `readingStats:{uid}`, `lastSession:{uid}`, `libraryBreakdown:{uid}`, `readingQuest:{uid}` (prefix-invalidated), `velocity:{uid}`, `readingRecords:{uid}`, plus `books`, `progress`, `lexicon:{uid}:{bookId|all}`, `recaps:{uid}:{bookId}`, `bookPassport:{uid}:{bookId}`, `upNext`, `lore:{uid}:{bookId|all}`. TTLs and the full invalidation matrix: [08 · Platform](08-platform-auth-account.md).
- **Invalidation after server-visible writes:** online save → `library`, `lastSession`, `readingStats`, `readingQuest*`; recap insert → `recaps:{uid}:{book}`, `readingQuest*`; book delete → books, progress, library, breakdown, quest, lexicon, recaps, passport. Gaps are catalogued in [11 · Cross-domain](11-cross-domain.md).
- **Offline:** only page saves are queued (IndexedDB `chronicler-offline/progress_queue`); replay re-runs only the `reading_progress` upsert (F1 step 5). The service worker cannot flush the queue itself (no auth token); it posts `FLUSH_PROGRESS_QUEUE` to open tabs. **Target (D-08 · BC-04):** offline replays go through `save_progress` with `client_occurred_at` and an idempotency key.
- **Signed URLs** (60 s / 3 600 s) must be re-minted, not cached; cache the image bytes. Avatars are public URLs with cache-busting file names.

---

## Known defects

Contract cross-references: S-xx = [backend contract §12 Security status](../backend-contract.md#12-security-status).

| ID | Defect | Impact | Fix |
|---|---|---|---|
| BE-D01 | `get_library_with_progress`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity` never compare `p_user_id` with `auth.uid()` (BE-07) — S-01 | Any signed-in user reads any user's library, progress, DNF state, session notes, forecasts | BC-01: assert `p_user_id = (select auth.uid())`, keep the parameter |
| BE-D02 | `get_reading_quest_summary` guard is NULL for `anon` (BE-07) — S-02 | Anyone with the anon key reads any user's goal, XP, level and sources (verified live) | BC-01: NULL-safe guard + revoke anon |
| BE-D03 | Destructive / global functions executable by anon or authenticated: `prune_page_captures_for_book`, `community_remove_pair_follows`, `community_reconcile_follow_counts`; dead `after_page_capture_saved` (BE-06, BE-07) — S-03 | Delete another user's captures or follow edges; load/lock abuse | BC-01: drop `after_page_capture_saved`; drop or lock prune; revoke the helpers |
| BE-D04 | `pg_default_acl` grants EXECUTE and full DML on every new object to `anon` / `authenticated` (BE-06) — S-05 | Every future function is anon-executable unless its migration revokes it | BC-01: alter default privileges; F10 checklist |
| BE-D05 | Helper functions accept arbitrary user ids (`circle_progress_location`, `community_relationship_payload`, oracles) (BE-07) — S-04 | Progress and relationship leaks, privacy bypass | BC-01: revoke EXECUTE on non-RPC helpers |
| BE-D06 | Owner RLS never checks `book_id` ownership (BE-02) — S-10 | Cross-user rows; the PWA offline queue drained after an account switch creates rows on another user's books | BC-01: child-table policies check book ownership; per-user queues |
| BE-D07 | Direct `follows` / `community_profiles` writes bypass RPC rules (BE-05) — S-11 | Follow private/blocking users, inflate counts, reserved names, profiles without privacy rows | BC-01: close the follows-insert bypass; profile writes via RPC only |
| BE-D08 | `generate-recap`, `generate-lore`, `ocr-page` run with `verify_jwt = false` and only base64-decode the JWT (no signature, `exp` or `aud`) — S-06 | Unauthenticated AI spend; forged `sub` + known `recapId` rewrites another user's recap image via the service role | BC-02: `verify_jwt = true` or `supabase.auth.getUser` |
| BE-D09 | `generate-recap` (`auth.ts:11`) and `ocr-page` (`index.ts:30`) call `atob` on unnormalised base64url — S-07 | Genuine tokens whose payload encodes `-`/`_` get 401 (likely with non-ASCII Apple names in `user_metadata`) | BC-02 (drop hand-rolled decoding), before BC-11 enables Apple |
| BE-D10 | No `supabase/config.toml` in the repo; `verify_jwt` lives only in deployed metadata | A redeploy from the repo can silently change auth | BC-02: commit per-function settings |
| BE-D11 | 500 responses include internal error text (`detail: String(err)`) — S-08 | Information leak | BC-02 |
| BE-D12 | No rate limiting, quota or entitlement check in any AI function; CORS `*` — S-09 | Unbounded cost | BC-12 (allow-all check first, D-14); BE-Q08 |
| BE-D13 | Leaked-password protection disabled — S-12 | Weak passwords accepted | Enable in Auth settings (BC-11) |
| BE-D14 | Advisors: 25 `auth_rls_initplan` policies, 7 unindexed FKs (`book_passports.user_id`; `book_id` on `lexicon_entries`, `lore_cards`, `page_captures`, `reading_quest_events`, `up_next_order`, `vocabulary_extractions`), duplicate index `progress_history_user_recorded_at_idx` = `_desc_idx`, redundant `idx_page_captures_user_book_page`, `idx_anki_review_sessions_user`, `reading_goals_user_year_idx` | Slower policies and cascade deletes; wasted writes | BC-01 |
| BE-D15 | No CHECK on `reading_progress.current_page` (BE-13) | Negative or > total pages accepted; negative shows as `reading` | BC-04: `CHECK (current_page >= 0)` plus the ceiling check in `save_progress` |
| BE-D16 | No idempotency key / uniqueness on `progress_history` (BE-15) | Double taps and retries duplicate rows (+10 XP each, double hours) | BC-04 `idempotency_key` |
| BE-D17 | Offline replay writes only `reading_progress`, FIFO last-write-wins (F1) | Offline reading missing from streaks, charts, sessions; stale replays overwrite newer progress | BC-04 + D-08 (replay with original time); SES-Q18 |
| BE-D18 | Save is not atomic: history failure swallowed, session clear fire-and-forget (F1) | Progress without history; stale `session_start_at` double-counts hours and velocity | BC-04 |
| BE-D19 | `reading_progress.updated_at` moves on every UPDATE and dates quest completions (BE-14, BE-38) | A book finished last year moves into this year's quest after a session start or DNF toggle | BC-04 `completed_at`; SES-Q15 |
| BE-D20 | Device-clock `recorded_at` and session timestamps are accepted verbatim (BE-15, BE-41) | Clock skew distorts streaks, rolling windows, durations; a future row pins "last session" | BC-04 server clock |
| BE-D21 | A capture saved (or updated) on a finished book is inserted, returned, then deleted; its +5 XP stays (BE-21) | Ghost capture in the client; follow-up ledger `23503`, resume update 0 rows; XP for nothing | Product decision CAP-Q02; then reject with a typed error in a BEFORE trigger (or a capture RPC) |
| BE-D22 | No trigger on `books`: `total_pages` edits that finish/un-finish a book run no effects (BE-11b) | No purge, history, passport; retroactive finishes in past months | BC-05; LIB-Q04 |
| BE-D23 | DNF is known only to `get_library_with_progress` (BE-17, BE-18, BE-49) | DNF books count as in progress in breakdown, completed in the quest, "currently reading" publicly; pages still save | BE-Q04 |
| BE-D24 | `books.source` never changes, so imported books read in-app never earn page/completion XP or quest credit (BE-36) | Under-counted progress for importers | LIB-Q16 |
| BE-D25 | The first history row of a book is compared with page 0 (BE-40) | Starting to track a half-read book creates a huge best day / session | Recommended BC-04 baseline row; SES-Q17 |
| BE-D26 | Three page-delta definitions across RPCs (BE-40) | Stats card, monthly chart and passport disagree after corrections | One shared SQL delta helper (BC-04 / BC-06) |
| BE-D27 | UTC boundaries in `get_reading_stats`, quest year, velocity day buckets, public-profile streaks and `lexicon_entries.next_review_at` default (BE-26, BE-38, BE-41, BE-48, BE-57) | Streaks and month totals disagree with the local-time calendar | BC-06 (D-07) |
| BE-D28 | `readingSessions` XP counts every history row (BE-36) | Pencil edits farm 10 XP; two meanings of "session" | D-08 · BC-04 |
| BE-D29 | No forgotten-timer cap in `totalReadingHours` / velocity, while records cap at 12 h (BE-41, BE-43) | A forgotten timer inflates hours and depresses velocity | BC-04 stale-session rule; SES-Q16 |
| BE-D30 | `get_last_session` returns `finishPredictionSessions` = remaining pages for an untimed latest row (BE-47) | "312 sessions left" | Return NULL when untimed |
| BE-D31 | `get_reading_velocity` never returns 0 (despite its migration comment) and mixes per-session and per-day averages as "days" (BE-48) | Misleading finish date | SES-Q08 |
| BE-D32 | `normalize_isbn` strips lowercase `x` before uppercasing (BE-12) | `p_isbn` with `x` never matches | `upper()` first, then strip `[^0-9X]` |
| BE-D33 | `reading_dna_mood_emojis_check` accepts `'{}'` (`array_length` NULL) (BE-31) | Empty emoji set storable | `cardinality(mood_emojis) between 1 and 5` |
| BE-D34 | Ledger edge cases: re-capture hits `23505` (no new words, stale resume kept); page-0 captures always fail (`page_found ≥ 1`); `capture_id = NULL` orphans accumulate (BE-24a, BE-25) | Missing vocabulary; stale "Previously" | CAP-Q04; write `page_found = NULL` for page 0 |
| BE-D35 | A quiz can be re-inserted for a finished book (BE-20) | Stale quiz rows after completion | BEFORE INSERT guard, or server-side persistence (CAP-Q16) |
| BE-D36 | Recap image job: no `catch`; 0-row updates unchecked; 503 after the client inserted a `pending` row; `skipped` never written; no stale timeout (BE-78, F5) | Rows stuck `pending` forever; paid images for deleted/foreign recaps; orphan objects | Recommended BC-13 |
| BE-D37 | Storage objects are never deleted on recap, book or user deletion (BE-71, BE-72) | Orphaned images; the delete confirm's "all its data" is untrue | D-10 / BC-11 for accounts; recommended BC-13 for recaps/books (BE-Q05) |
| BE-D38 | No account-deletion path on any client (BE-73) — S-16 | App Store Guideline 5.1.1(v), GDPR | D-10 · BC-11 (F7) |
| BE-D39 | Realtime publication empty; PWA subscription dead; no server change signals (BE-85) | Image status only by polling; no cross-device refresh | Recommended BC-14 (BE-Q06) |
| BE-D40 | Migration drift: 55 of 69 live functions have no local migration; `user_settings`, `upsert_weekly_goal`, `get_retention_summary`, `prune_page_captures_for_book`, `after_page_capture_saved` have no migration anywhere; 7 local files applied out-of-band; `recap_fragments` / `book_maps` dropped without one. A replay of the local folder regresses `get_reading_stats` (file-name order drops the `source='manual'` filter), re-adds a stale `lore_cards.type` CHECK that rejects live rows, and sets the `recap-images` limit to 512 KB | The repo cannot rebuild the live backend | BC-03: squash the live baseline into a baseline migration; enforce discipline |
| BE-D41 | Deployed `generate-lore` (v18) and `generate-reading-dna` (v8) differ from the repo; deployed lore puts `thinkingBudget` / `includeThoughts` at the config root (ignored by the SDK); `dynamicRetrievalConfig` (recap extraction, deployed DNA) is ignored by 2.5 models (BE-79, BE-84) | Repo deploy would change behaviour; dead config | BC-03: sync repo to deployed (D-09) and fix the thinking config |
| BE-D42 | Dead or dormant objects: `after_page_capture_saved`, `prune_page_captures_for_book`, `reading_circles.canonical_book_id`, `recaps.image_status = 'skipped'`, `circle_invitation_status = 'expired'`, `TEMPERATURE` in `retryPolicy.ts:6`, `mintSignedUrl` in `utils/storage.ts:23` | Attack surface and confusion | BC-01 (drop/lock functions); BC-03 cleanup |
| BE-D43 | `generate-recap`: malformed JSON body → 500; no method check; `X-Recap-Mode` not exposed to browsers; streamed JSON not validated server-side (BE-75, BE-77) | Wrong error class; web cannot read the mode; invalid output reaches clients | BC-07 (validated, persisted response); BC-02 error hygiene |
| BE-D44 | `ocr-page` answers 200 with `text: ""` / `confidence: 0` when the model omits fields; a timed-out Gemini call is not aborted (BE-80) | Unsavable "success"; wasted spend | Typed error (e.g. 422 `OcrEmpty`); abort on timeout |
| BE-D45 | `extract-vocabulary` caps neither input length nor word length (BE-81) | One long "word" fails the whole lexicon batch on `term ≤ 200` | Cap `ocrText` and word length server-side |
| BE-D46 | Edge functions validate lengths in UTF-16 units while CHECKs count code points (BE-84, BE-90) | Output accepted by the function can fail the DB insert, or the reverse | Validate in code points everywhere |
| BE-D47 | Community pagination: `get_visible_circle_reactions` and `get_also_reading_for_book` use the (limit+1)-th row as cursor and skip it; `list_my_reading_circles` returns limit + 1 items (BE-60, BE-67) | Items lost or duplicated across pages (dormant) | Fix before the Community phase (D-13) |
| BE-D48 | Circle ownership holes: a block can remove the owner and leave an ownerless active circle; `created_by` CASCADE deletes a circle someone else now owns; deleting the anchor book deletes the circle for everyone; a zero-member circle can stay active (BE-55, BE-65, BE-72, BE-73) | Silent data loss for other members (dormant) | BE-Q07 |
| BE-D49 | `block_community_user.removedFollowsCount` is always 0 for a new block (BE-55) | Misleading payload (dormant) | Count inside the trigger or before inserting |
| BE-D50 | `search_community_readers` does not escape `_` / `%` in `LIKE` (BE-58) | Wrong matches (dormant) | Escape the query |
| BE-D51 | Malformed circle cursors raise raw `22007` / `22008` (BE-68) | Untyped errors (dormant) | Typed `invalid_cursor` |
| BE-D52 | Public profile: highlights use `leitner_box ≥ 5` and label `created_at` as `masteredAt`; `currentlyReading` can be DNF; streaks UTC; `booksRead` includes imports (BE-57) | Inaccurate public data (dormant) | Before the Community phase (D-13) |
| BE-D53 | Community privacy leaks: caller-controlled `p_isbn` in also-reading probes followed users' books; `currentlyReading` returns pages when `progress = nobody`; highlights reveal book titles; `hasBlockedViewer` exposed — S-15 | Privacy leaks (dormant) | Before the Community phase (D-13) |

---

## Open decisions

Questions answered by D-01 … D-17 are reflected as **Target** lines above and are not repeated. Related decisions owned by other files: SES-Q15 (what moves "last read"), SES-Q16 (stale sessions), SES-Q17 (baseline-row representation), SES-Q18 (offline replay conflicts), LIB-Q01 ("already finished" adds), LIB-Q04 (`total_pages` edits), LIB-Q11 (DNF scope in the library), LIB-Q12 (delete safeguards), LIB-Q16 (imported books read in-app), CAP-Q02 (captures on complete books), CAP-Q04 (re-capture), CAP-Q16 (resume/quiz persistence), REC-Q08 (recap deletion), REC-Q09 (image robustness).

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| BE-Q01 | Revive or drop the weekly session goal backend (`user_settings.weekly_goal`, `upsert_weekly_goal`, `get_retention_summary`)? | Live, anon-executable, no client caller | Drop the two RPCs unless a weekly-goal ring is on the iOS roadmap; keep `user_settings` (BC-06 stores `time_zone` there). If revived, align its session definition with D-08 |
| BE-Q02 | Once BC-04 / BC-05 RPCs exist and the PWA has migrated, lock down direct client writes to server-owned tables (`reading_progress`, `progress_history`, `recaps`, `lore_cards`, `book_passports`, `achievements`)? | RLS `ALL` / insert allows any client write, so a client can bypass every server rule | Yes, staged: ship the RPCs, migrate the PWA (D-05), then make those policies SELECT-only (writes through SECURITY DEFINER RPCs). Keep direct writes for client-owned data (books, lexicon, up-next) |
| BE-Q03 | Which client-only validations become DB constraints? | No page-range CHECK; `books.source` free text; no uniqueness on books or lexicon terms | Add `books.source in ('manual','goodreads','storygraph')` as a `NOT VALID` CHECK, then validate. (`current_page >= 0` already ships with BC-04, and `≤ total_pages` is enforced in `save_progress`, not a trigger, because `total_pages` edits are open, LIB-Q04.) Keep duplicates soft (LIB-Q02) |
| BE-Q04 | Should DNF be a server-wide status? | Only the library RPC knows `dnf_at` (BE-17); quest, breakdown, public profile, also-reading, velocity ignore it | One shared SQL status helper used by every RPC: DNF books are excluded from "in progress", "currently reading" and also-reading; pages already read keep their XP; reaching the last page on a DNF book clears `dnf_at` in `save_progress`. See LIB-Q11 |
| BE-Q05 | Where does Storage clean-up run for recap and book deletion (BC-13)? | Never; SQL deletes are blocked (BE-71); owners can delete their own objects via the Storage API | A server path: a `delete-book` (and recap-delete) edge function that deletes rows and objects together, plus a periodic orphan sweep. A sweep needs a scheduler — `pg_cron` is not installed (BE-85), so use a scheduled edge function. See LIB-Q12 |
| BE-Q06 | Add tables to the `supabase_realtime` publication, or define refresh-on-foreground (BC-14)? | Publication empty (BE-85) | Publish `recaps` (image status) and `reading_progress` (cross-device sessions, Live Activities); refresh-on-foreground for everything else. See REC-Q09 |
| BE-Q07 | Circle cascade and ownership semantics (decide before the Community phase, D-13) | `created_by` and `owner_id` CASCADE delete whole circles; anchor-book delete deletes the circle; a block can remove the owner (BE-D48) | `created_by → SET NULL`; owner deletion or removal hands ownership to the earliest member; deleting the anchor book closes the circle instead of deleting it |
| BE-Q08 | Apply a tier-independent abuse ceiling in the shared AI check before tiers are decided (D-14)? | No limits at all (BE-D12) | Yes: a generous per-user daily ceiling per function, recorded in `ai_usage`, returning a typed 429; tiers later replace the numbers |
| BE-Q09 | What `isPublic` does a profile get when a client sends none (iOS v1 has no toggle, D-13)? | RPC default `true`, table default `false`, PWA sends `true` on first run (BE-52) | Change the RPC default to `false` (backward compatible: the PWA always sends the field); iOS creates profiles with `isPublic:false` and `nobody` privacy, and round-trips existing values |
| BE-Q10 | Paginate `get_library_with_progress` and add a delta (`changed_since`) before large libraries and multiple devices (BC-14)? | One unpaginated JSON array; table selects capped by `max_rows` (BE-08a); `books` / `lexicon_entries` / `recaps` have no `updated_at` (BE-89) | Add keyset pagination and `p_changed_since`, with `updated_at` columns + triggers on the tables a delta needs |
| BE-Q11 | Keep compute-on-read for stats RPCs under the 8 s `statement_timeout`, or add incremental aggregates? | Full scans of `progress_history` per call (BE-08a) | Keep compute-on-read for v1; monitor with `pg_stat_statements`; add per-user daily aggregates (keyed by the stored reader timezone, BC-06) if p95 approaches 1 s |

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

- **Never rely on your own `p_user_id` for isolation.** Until BC-01 lands, four RPCs trust it (BE-07). Always pass the signed-in user's id; never another.
- **Reference only your own book ids** in every child-table write (BE-02). Scope offline queues per user and wipe them on sign-out or user switch.
- **Every UPDATE / DELETE needs a filter** (`eq` / `match`), or `safeupdate` rejects it (BE-08a).
- **Encode one payload type per operation** for `reading_progress` upserts. A shared model whose optional fields serialise as `null` would un-shelve DNF books or kill running sessions (Client logic #3).
- **Errors:** switch on `code` + `message` (BE-86). Treat `57014` as retryable with backoff; treat `23505` on `lore_cards` as "already unlocked"; treat `23503` after a book delete as "book gone".
- **Timezones:** send an IANA identifier to `p_timezone` / `p_time_zone` (note the different name on `get_book_passport_stats`). `get_reading_stats`, the quest year and velocity are UTC today (BE-41, BE-38, BE-48); present them consistently until BC-06.
- **Length checks in code points** (BE-90): Swift `unicodeScalars.count`, Kotlin `codePointCount`, never `String.count` / `String.length`.
- **Never write `reading_quest_events`** (trigger-only) and never write `progress_history` for imports or add-with-status (BE-23a).
- **Do not save a capture on a finished book** (it is deleted at once, BE-21) and purge local captures, resumes and quiz when a book completes (BE-19, BE-20).
- **Profile saves are full replaces** (BE-52): read `get_my_community_profile`, change only what the screen edits, send everything back. Upload the avatar, save, then clean up old files (F8).
- **Storage:** recap images through signed URLs minted on demand; cache bytes, not URLs. SQL cannot delete objects (BE-71).
- **Image status:** poll with backoff and a cap (e.g. 2 s → 30 s, stop after ~3 min); Realtime is not published (BE-85).
- **Decoders:** RPC JSON is camelCase; timestamps are ISO-8601 with fractional seconds and an offset; `YYYY-MM-DD` fields are floating calendar dates; `percentage`, `completionDelta`, `projectedBooks` may be non-integers or `null`; `page_captures.resume` may contain a legacy `characters` key.
- **Shapes and types:** there is no Swift/Kotlin type generator for Supabase; hand-write models from the [backend contract](../backend-contract.md). JSON RPC results are untyped `json` / `jsonb`.

### iOS-specific (iOS 26+, D-04)

- Set `URLRequest.timeoutInterval` ≥ 10 s for PostgREST and RPC calls (server budget 8 s).
- Before enabling Sign in with Apple (D-11 · BC-11), BC-02 must remove the hand-rolled JWT decoding: Apple-provided names in `user_metadata` make the `-`/`_` 401 bug (BE-D09) likely on recaps and OCR.
- On-device Apple Vision OCR (D-15) writes the same `page_captures` row: map Vision's confidence into [0, 1] (`numeric(3,2)`, BE-24), compute `word_count` from the final text, and never save empty text. The 0.90 / 0.70 thresholds must be recalibrated for Vision.
- Live Activities and widgets read the session columns of `reading_progress`; fetch `session_paused_at` separately (BE-17) and refresh on `scenePhase == .active` until BC-14 decides on Realtime.
- Account deletion (App Store 5.1.1(v)) is the D-10 flow (F7), shared with the web; do not build a client-side cascade.
- Re-query time-zone-sensitive aggregates on `NSSystemTimeZoneDidChange` / significant time change.
- Fire-and-forget calls (vocabulary extraction, resume, recap image) run in a `Task` detached from the view; the ledger's unique `capture_id` makes retries idempotent (BE-25).
