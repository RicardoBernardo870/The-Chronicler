# The Chronicler — Backend Contract

Last updated: 2026-10-19 · Verified against the live Supabase project `zlndhygpqacygceivuvk` and web `master` @ `8d8701c`. BC-01 (migration `bc01_security_hardening`) and BC-02 (edge-function auth) are live since 2026-10-19.

> **What this is.** The authoritative, live-verified contract of the one shared Supabase backend behind every client: the web PWA (live), the iOS app (next), and Android (later). Product / App Store name: **The Chronicler**. **BookHero** is the internal code name (repo, Supabase project, code identifiers).
>
> **Source of truth.** The live database, not `supabase/migrations/` (which has drifted, §13). A read-only catalog snapshot is committed at [`supabase/reference/live-baseline-2026-10-19.sql`](../supabase/reference/live-baseline-2026-10-19.sql) (post-BC-01; the pre-BC-01 baseline is `live-baseline-2026-10-18.sql`) (functions, triggers, policies, constraints, indexes, enums, buckets, columns, runtime settings).
>
> **Companion docs.** Business rules (stable IDs, e.g. BE-21, LIB-04, COM-52): [docs/business-rules/](business-rules/README.md) — database invariants are in [09 · Database invariants](business-rules/09-database-invariants.md). Work packages BC-01…BC-15: [backend-consolidation-plan.md](backend-consolidation-plan.md).
>
> **Principles (owner decisions 2026-10-18).** Every backend change is client-agnostic and backward compatible; the PWA keeps working and migrates to new RPCs too (D-05). Core logic moves server-side before the iOS build; native clients stay thin (D-06). Deployed edge-function sources are canonical (D-09).
>
> **Legend.** ✅ guarded = the RPC derives or compares identity with `auth.uid()`. ✅ owner-checked = the RPC raises `42501 not_allowed` unless `p_user_id = auth.uid()` (BC-01, 2026-10-19). Exec: A = `anon`, U = `authenticated`. "Owner" = `auth.uid() = user_id`. `[UNVERIFIED: …]` = not readable through SQL/MCP; stated from Supabase defaults or code reading.
>
> **Keeping it current.** Any backend change ships as a migration, a regenerated baseline file and an update to this document in the same change (BC-03).

---

## 1. Connection, auth & runtime limits

### 1.1 Endpoints and keys

| Item | Value |
|---|---|
| Project ref | `zlndhygpqacygceivuvk` |
| API base | `https://zlndhygpqacygceivuvk.supabase.co` |
| Tables (PostgREST) | `GET/POST/PATCH/DELETE /rest/v1/<table>` |
| RPC | `POST /rest/v1/rpc/<function>` with a JSON body of named arguments |
| Auth | `/auth/v1/*` |
| Storage | `/storage/v1/*` |
| Edge functions | `POST /functions/v1/<slug>` |
| Client key | The publishable (anon) key. It is public and ships in every client (web env `VITE_SUPABASE_ANON_KEY`, URL in `VITE_SUPABASE_URL`). |
| Server key | `SUPABASE_SERVICE_ROLE_KEY` exists only in edge-function env. It must never reach a client. |

### 1.2 Authentication (current state)

| Topic | Live behaviour |
|---|---|
| Providers | `email` only. No OAuth, no Sign in with Apple, no phone/OTP code entry, no MFA, no anonymous users. |
| Methods used by the PWA | Password sign-in; password sign-up (no redirect URL); magic link via `signInWithOtp` without `emailRedirectTo` (lands on the Auth Site URL) and without `shouldCreateUser:false`, so a magic link to an unknown email silently creates an account. |
| Email confirmation | Effectively off: every user's `email_confirmed_at` is within 0.1 s of `created_at`. [UNVERIFIED: the dashboard setting itself is not readable.] |
| Password reset / change, email change | Not implemented on any client. |
| Leaked-password protection | **Disabled** (security advisor). |
| Sign-up side effects | Only the `auth.users` row. There is no trigger on `auth.users`; no profile, settings or community row is created. |
| Access token | JWT. DB GUC `app.settings.jwt_exp = 3600`. [UNVERIFIED: the Auth access-token lifetime and the JWT signing algorithm are dashboard settings; Supabase default lifetime is 3600 s.] Tokens embed `user_metadata`. |
| Sign-out | supabase-js default scope is `global`: every refresh token of the user is revoked on every device (web and native). |
| Web session handling | `persistSession`, `autoRefreshToken`, `detectSessionInUrl`; default `implicit` flow (magic-link tokens arrive in the URL fragment). |
| Planned | Sign in with Apple + email/password, password reset on all clients, magic and reset links via universal links, linking an Apple ID to an existing email account, custom SMTP, an email-confirmation decision (D-11, BC-11). Immediate in-app account deletion via a new `delete-account` edge function (D-10, BC-11). |

### 1.3 Authorization model

- RLS is **enabled (not forced)** on all 26 product tables in `public`. `authenticated` holds full DML grants on every table (Supabase default), so RLS policies are the barrier for direct PostgREST access (§5). Since BC-01 `anon` holds **no** table privileges in `public` (except the out-of-scope `activity_logs`).
- Owner policies compare `user_id` with `(select auth.uid())`; INSERT/UPDATE on the ten book-child tables also require the referenced `book_id` to belong to the caller (BC-01, §5).
- Aggregated reads go through `SECURITY DEFINER` RPCs. Every RPC `authenticated` can execute derives or asserts identity from `auth.uid()`; the four `p_user_id` stats RPCs and `get_reading_quest_summary` raise `42501 not_allowed` for any other id (§8).
- **Function grants (BC-01):** no `public` function is executable by `anon`/`PUBLIC`; `authenticated` may execute only the client allowlist (§8.1, §9.2). `pg_default_acl` for owner `postgres` no longer grants `EXECUTE` on new functions (to `PUBLIC`, `anon` or `authenticated`) or any privilege on new tables/sequences to `anon`: every new function needs an explicit `grant execute … to authenticated` in its migration. Defaults owned by `supabase_admin` still grant to `anon`/`authenticated` and cannot be changed from a `postgres` migration, so every migration must run as `postgres`.
- Schema `private` (not exposed by PostgREST) holds `assert_is_caller(uuid)` (identity guard, not client-executable) and the RLS helpers `is_circle_member(uuid)` / `is_circle_owner(uuid)` (executable by `authenticated`, identity from `auth.uid()`).
- Every `public` function pins `search_path = public`; the `private` functions pin `search_path = ''`.

### 1.4 Runtime limits

| Setting | Value | Consequence for clients |
|---|---|---|
| `statement_timeout` (`authenticated`) | 8 s | Any table call or RPC that runs longer fails with SQLSTATE `57014`. Treat as retryable with backoff. |
| `statement_timeout` (`anon`) | 3 s | — |
| `authenticator` | `statement_timeout` 8 s, `lock_timeout` 8 s, preloads **`safeupdate`** | PostgREST rejects `UPDATE`/`DELETE` without a filter. Every mutation must carry an `eq`/`match` filter. |
| DB `TimeZone` | `UTC`, no role override; `DateStyle = ISO, MDY` | Every RPC without a timezone argument uses UTC day/week/month/year boundaries (§8). |
| PostgREST `max_rows` | [UNVERIFIED: not readable; Supabase default 1000] | Un-paginated table `select`s can be truncated. Scalar JSON RPC results are not capped. |
| Edge-function wall-clock / idle limits | [UNVERIFIED: plan-dependent] | A slow inferred recap (up to 3 sequential Gemini Pro calls before the first byte) or a long image job can be cut off by the platform. |
| Storage object size | Per bucket, §7 | — |

### 1.5 Platform inventory

| Item | Live state |
|---|---|
| Product objects in `public` | 26 tables · 69 functions (60 `SECURITY DEFINER`) · 14 triggers · 4 enums · 48 foreign keys · no views, materialized views or sequences |
| Storage buckets | `recap-images` (private), `community-avatars` (public) |
| Edge functions | 7: `generate-recap`, `generate-lore`, `ocr-page`, `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume`, `generate-book-quiz` (§10) |
| Extensions installed | `plpgsql`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` |
| Not installed | `pg_cron` (no scheduled jobs), `pg_net` (no DB webhooks; no `supabase_functions` schema), `pg_graphql` (the `graphql` schema exists, the extension does not), `pgmq`, `http` |
| Realtime | Publication `supabase_realtime` contains **no tables**. No Postgres Changes stream exists. The PWA's subscription on `recaps` never fires; image status arrives through polling. |
| Server-side caches | None. Every RPC recomputes from base tables. |

### 1.6 Error transport

| Source | HTTP | Body / handling |
|---|---|---|
| RPC `raise exception '<code>'` (SQLSTATE `P0001`) | 400 | `{"code":"P0001","message":"<code>","details":null,"hint":null}`. Switch on `message`. |
| FK violation `23503` | 409 | e.g. inserting a row for a book that was just deleted |
| Unique violation `23505` | 409 | e.g. `lore_cards_unique_milestone` = "already unlocked" |
| NOT NULL `23502`, CHECK `23514` | 400 | Validate before writing (§3) |
| Bad input `22P02` (uuid/boolean), `22007`/`22008` (timestamp), `22023` (unknown IANA zone) | 400 | — |
| Permission `42501` | 401 for `anon`, 403 for `authenticated` | e.g. a signed-out call to a community RPC |
| Statement timeout `57014` | 500 (PostgREST maps class `57` to 500) | `"canceling statement due to statement timeout"`; retry with backoff |
| Edge functions | per function | JSON `{error, …}` bodies; see §10 |

The SQLSTATE→HTTP mapping follows PostgREST's documented table. [UNVERIFIED: not exercised against this project for every code.]

---

## 2. Domain map

| Domain | Status | Tables | RPCs | Edge functions | Storage | Rules |
|---|---|---|---|---|---|---|
| Library | Live | `books`, `reading_progress` (status), `up_next_order` | `get_library_with_progress`, `get_library_breakdown`, `get_reading_velocity` | — | — | [01 · Library](business-rules/01-library.md) (LIB) |
| Reading sessions & progress | Live | `reading_progress`, `progress_history`, `book_passports` | `get_last_session`, `get_reading_stats`, `get_book_passport_stats` | `generate-recap` (`passport_summary`) | — | [02 · Reading sessions](business-rules/02-reading-sessions.md) (SES) |
| Recaps | Live | `recaps` | — | `generate-recap` | `recap-images` | [03 · Recaps](business-rules/03-recaps.md) (REC) |
| Capture, resume, Memory Check | Live | `page_captures`, `book_quizzes`, `reading_quest_events` | — (triggers) | `ocr-page`, `generate-page-resume`, `generate-book-quiz` | — (images never stored) | [04 · Capture, resume & quiz](business-rules/04-capture-resume-quiz.md) (CAP) |
| Codex / lexicon | Live | `lexicon_entries`, `vocabulary_extractions`, `anki_review_sessions` | — | `extract-vocabulary` | — | [05 · Codex & lexicon](business-rules/05-codex-lexicon.md) (LEX) |
| Insights (lore) | Live | `lore_cards` | — | `generate-lore` | — | [06 · Insights](business-rules/06-insights.md) (INS) |
| Profile, stats, goals, achievements, DNA | Live | `reading_goals`, `reading_quest_events`, `achievements`, `reading_dna` | `get_reading_quest_summary`, `get_reading_calendar`, `get_monthly_reading`, `get_reading_records` | `generate-reading-dna` | — | [07 · Profile, stats & goals](business-rules/07-profile-stats-goals.md) (PRO) |
| Profile identity | Live (PWA `/profile/edit`); iOS v1 = username + display name + avatar only (D-13) | `community_profiles`, `community_profile_privacy`, `community_follow_counts` | `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available` | — | `community-avatars` | [07](business-rules/07-profile-stats-goals.md), [10 · Community](business-rules/10-community-circles.md) (COM) |
| Platform, auth, account | Live | `auth.users` | — | — (`delete-account` planned) | — | [08 · Platform, auth & account](business-rules/08-platform-auth-account.md) (PLT) |
| Weekly session goal | **Dormant** (no client caller) | `user_settings` | `upsert_weekly_goal`, `get_retention_summary` | — | — | [07](business-rules/07-profile-stats-goals.md) |
| Follow graph, discovery, reading circles | **Dormant** (no UI; much later Community phase, D-13) | `follows`, `blocks`, `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions` | 21 RPCs (§8.6) | — | — | [10 · Community & circles](business-rules/10-community-circles.md) (COM) |

Cross-domain effects (delete, complete, DNF, import, sign-out, page-count edits) are catalogued in [11 · Cross-domain](business-rules/11-cross-domain.md); rules enforced only by the PWA are in [12 · Client logic register](business-rules/12-client-logic-register.md).

---

## 3. Tables

Conventions: `id uuid` PK with default `gen_random_uuid()` unless noted. All timestamps are `timestamptz`. "→ users" = FK to `auth.users(id)`; "→ books" = FK to `books(id)`. The ON DELETE action is given on every FK. Length CHECKs use `char_length` (Unicode code points) unless noted; JavaScript `.length` and Swift `String.count` measure differently, so validate in code points.

### 3.1 Library & reading

#### `books`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **ON DELETE CASCADE** |
| `title` | text | no | — | CHECK length 1–500 |
| `author` | text | no | — | CHECK length 1–200 |
| `isbn` | text | yes | — | CHECK `^\d{9}[\dX]$\|^\d{13}$` (exactly 10 chars with optional trailing uppercase `X`, or 13 digits; no hyphens or spaces; no checksum validated anywhere) |
| `cover_url` | text | yes | — | Hot-linked external URL; unvalidated; never copied to Storage |
| `total_pages` | int | no | — | CHECK ≥ 1 (no upper bound) |
| `genre` | text | yes | — | Free text (case-sensitive in the breakdown) |
| `created_at` | timestamptz | no | `now()` | — |
| `description` | text | yes | — | Plain text |
| `source` | text | no | `'manual'` | **No CHECK.** Values written: `manual` (every interactive add), `goodreads`, `storygraph` (CSV import). Never changes after insert. "Imported" = `source <> 'manual'`. |
| `page_count_estimated` | bool | no | `false` | `true` = `total_pages` is the import placeholder (100). Cleared **by the client** whenever `total_pages` is edited; no trigger. |

Keys & indexes: no uniqueness per user (duplicate titles/ISBNs allowed; dedupe is client-only). No `updated_at` column and **no triggers** on `books`. Indexes `books_user_id_idx`, `books_user_id_id_idx`, `books_normalized_isbn_user_idx (normalize_isbn(isbn), user_id, id) WHERE isbn IS NOT NULL` (community matching only).
Written by clients via PostgREST (add, edit, import, delete). Rules: LIB-01…LIB-12, BE-09…BE-12.

#### `reading_progress`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `book_id` | uuid | no | — | → books **CASCADE** |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `current_page` | int | no | `0` | **No CHECK** (negative or > `total_pages` is storable; clients clamp to `[0, total_pages]`) |
| `updated_at` | timestamptz | no | `now()` | Overwritten with `now()` by trigger `reading_progress_updated_at` on **every** UPDATE (session start/pause/stop, DNF, page) |
| `session_start_at` | timestamptz | yes | — | Non-null = a timed session is active. Written from the client clock today. Resume shifts it forward by the paused span. |
| `session_paused_at` | timestamptz | yes | — | Non-null = session paused. No RPC reads it. |
| `dnf_at` | timestamptz | yes | — | Non-null = shelved as Did Not Finish |

Keys & indexes: UNIQUE `(book_id, user_id)` — the upsert target. No `created_at`. Indexes `reading_progress_user_id_idx`, `reading_progress_user_updated_at_idx (user_id, updated_at DESC)`, partial `reading_progress_user_book_active_idx (user_id, book_id, updated_at DESC) WHERE current_page > 0`.
Triggers: `reading_progress_updated_at`, `page_captures_delete_on_completion`, `book_quizzes_delete_on_completion` (§9). A "want to read" book has **no** row; an imported "read" book has `current_page = total_pages`; an imported DNF book has `current_page = 0` + `dnf_at`.
Rules: BE-13, BE-14, BE-17, SES rules.

#### `progress_history`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `book_id` | uuid | no | — | → books **CASCADE** |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `page` | int | no | — | CHECK ≥ 0 |
| `recorded_at` | timestamptz | no | `now()` | The PWA always sends its own device timestamp |
| `session_start_at` | timestamptz | yes | — | Non-null = a timed session ended at this row |
| `session_note` | text | yes | — | CHECK length ≤ 160 |

Keys & indexes: no uniqueness, no idempotency key, no CHECK tying `session_start_at ≤ recorded_at`. Append-only by convention (the owner ALL policy would allow update/delete; clients only update `session_note`). Indexes `idx_progress_history_book_user (book_id, user_id, recorded_at DESC)`, `progress_history_user_book_recorded_at_id_idx (user_id, book_id, recorded_at, id)`, `progress_history_user_book_recorded_at_idx` (prefix of the previous), `progress_history_user_recorded_at_desc_idx` and `progress_history_user_recorded_at_idx` (**duplicates**), partial `progress_history_user_session_start_idx (user_id, session_start_at, recorded_at) WHERE session_start_at IS NOT NULL`.
This table feeds every stats RPC (§8). Rules: BE-15, BE-16, BE-40.

#### `up_next_order`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | no | — | → books **CASCADE** |
| `sort_position` | int | no | `0` | User-defined queue order |
| `updated_at` | timestamptz | no | `now()` | — |

UNIQUE `(user_id, book_id)` (upsert target). A row is not removed when its book leaves the queue.

### 3.2 AI memory

#### `recaps`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `book_id` | uuid | no | — | → books **CASCADE** |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `progress_snapshot` | numeric(5,2) | no | — | Reading percentage at generation (2 dp) |
| `page_snapshot` | int | yes | — | Reading page at generation (`0` for a pre-start blurb) |
| `memory_jogger` | text | no | — | CHECK length > 0 |
| `concept_watchlist` | text | no | — | CHECK length > 0; comma-separated |
| `thematic_bridge` | text | no | — | CHECK length > 0 |
| `mode` | text | no | `'inferred'` | CHECK `corpus` \| `inferred` |
| `created_at` | timestamptz | no | `now()` | Server clock |
| `image_path` | text | yes | — | `{userId}/{recapId}.png` in `recap-images` |
| `image_status` | text | yes | **none** | CHECK NULL or `pending` \| `succeeded` \| `failed_safety` \| `failed_transient` \| `skipped`. `skipped` is never written; NULL = legacy row without image. |
| `image_generated_at` | timestamptz | yes | — | — |

Multiple recaps per book (no uniqueness). Indexes `recaps_book_user_idx (book_id, user_id, created_at DESC)`, `recaps_user_created_at_idx`, partial `recaps_image_status_idx WHERE image_status IS NOT NULL`. No triggers; not in any Realtime publication.
Written by: the client inserts the row today (BC-07 moves this into `generate-recap`); the edge function updates the `image_*` columns with the service role. Rules: REC-37, REC-42, BE-28.

#### `lore_cards` (Insights)

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | no | — | → books **CASCADE** |
| `title` | text | no | — | — |
| `content` | text | no | — | — |
| `type` | text | no | — | **No CHECK live.** `generate-lore` emits `History` \| `Culture` \| `Geography` \| `Technology` \| `Lore`. |
| `linked_entities` | text[] | no | `'{}'` | ≤ 5 from the edge function |
| `unlocked_at_page` | int | no | — | — |
| `unlocked_at_milestone` | int | no | — | CHECK ∈ {10, 20, …, 90} |
| `seen` | bool | no | `false` | — |
| `created_at` | timestamptz | no | `now()` | — |

UNIQUE `lore_cards_unique_milestone (user_id, book_id, unlocked_at_milestone)`: a `23505` on insert means "already unlocked". Indexes `lore_cards_user_book_idx`, `lore_cards_user_created_at_idx`. No `updated_at`, no triggers. Written by the client today (BC-08 moves generation and insert server-side). Rules: INS-31…INS-36, BE-29.

#### `book_passports`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `book_id` | uuid | no | — | **UNIQUE**; → books **CASCADE** |
| `user_id` | uuid | no | — | → users **CASCADE** (unindexed FK) |
| `total_days` | int | yes | — | From `get_book_passport_stats` |
| `peak_day` | date | yes | — | Local calendar date |
| `peak_day_pages` | int | yes | — | — |
| `vocabulary_count` | int | no | `0` | — |
| `ai_summary` | text | yes | — | 90–100-word prose from `generate-recap` `passport_summary` |
| `generated_at` | timestamptz | no | `now()` | — |

One row per **book**. Client upsert `onConflict: book_id` today (BC-05 freezes stats at completion server-side). Rules: BE-30, SES passport rules.

#### `reading_dna`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `user_id` | uuid | no | — | **PK**; → users **CASCADE** |
| `personality` | text | no | — | CHECK length 50–800 |
| `mood_tone` | text | no | — | CHECK length 1–40 |
| `mood_emojis` | text[] | no | — | CHECK `array_length` 1–5. `array_length('{}')` is NULL, so an **empty array passes**; writers must validate. |
| `suggestions` | jsonb | no | — | Unconstrained; documented shape `[{title, author, reason}]`, 3–5 items |
| `books_finished_at_generation` | int | no | — | CHECK ≥ 0. Never lowered when books are deleted. |
| `generated_at` | timestamptz | no | `now()` | No `updated_at` |

One row per user; client upsert `onConflict: user_id`. No DELETE policy. Rules: BE-31, PRO-52…PRO-63.

### 3.3 Capture, resume & Memory Check

#### `page_captures`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | no | — | → books **CASCADE** (unindexed FK) |
| `page` | int | no | — | CHECK ≥ 0. The reader's current page at save time, **never** read by OCR. |
| `text` | text | no | — | CHECK length 1–10 000 (whitespace-only passes the DB; non-blank is client-enforced) |
| `word_count` | int | no | — | CHECK ≥ 0; recomputed by the client from the final text |
| `confidence` | numeric(3,2) | no | — | CHECK 0–1 (rounded to 2 dp on storage) |
| `captured_at` | timestamptz | no | `now()` | Server clock, insert only |
| `source` | text | no | `'ocr'` | CHECK `ocr` \| `manual` \| `import`; only `ocr` is written |
| `resume` | jsonb | yes | — | `{bullets: string[1..3] (≤240 chars each), tension: string (≤240, may be "")}`. One legacy row also carries a `characters` key; decoders must ignore unknown keys. |
| `resume_generated_at` | timestamptz | yes | — | Client clock |

UNIQUE `(user_id, book_id, page)` — the upsert target. A re-capture of the same page keeps the row `id`, the original `captured_at` and the old `resume`. Indexes `idx_page_captures_user_book_page` (**duplicate** of the unique index), `page_captures_user_captured_at_idx`. Trigger `page_capture_quest_event_after_save` (§9). Images are never persisted. All captures of a book are deleted on completion (§4.5). Rules: CAP-28…CAP-47, BE-24, BE-24a.

#### `book_quizzes`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | no | — | → books **CASCADE** |
| `page_snapshot` | int | no | — | CHECK ≥ 0 |
| `questions` | jsonb | no | — | Unconstrained; shape `[{question ≤240, options [3 × ≤120], correctIndex 0–2, sourcePage int\|null}]`, 1–3 items |
| `score` | int | yes | — | CHECK NULL or 0–3 |
| `answered_at` | timestamptz | yes | — | Client clock |
| `generated_at` | timestamptz | no | `now()` | — |

UNIQUE `(user_id, book_id)` (one quiz per book; regenerating replaces it). Index `book_quizzes_book_id_idx`. Deleted on completion. Rules: CAP-61…CAP-78, BE-32.

#### `reading_quest_events` (durable XP ledger)

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | yes | — | → books **ON DELETE SET NULL** (XP survives book deletion; unindexed FK) |
| `event_type` | text | no | — | CHECK `= 'page_capture'` |
| `page` | int | yes | — | CHECK NULL or ≥ 0 |
| `source_id` | uuid | yes | — | First capture id (no FK) |
| `occurred_at` | timestamptz | no | `now()` | The capture's `captured_at`; earliest kept on conflict |
| `created_at` | timestamptz | no | `now()` | — |

Partial UNIQUE `reading_quest_events_page_capture_unique_idx (user_id, book_id, page) WHERE event_type = 'page_capture' AND book_id IS NOT NULL AND page IS NOT NULL` → one +5 XP event per distinct `(book, page)`, ever. Index `reading_quest_events_user_type_occurred_idx`. Written **only** by trigger; clients have SELECT only. Rules: BE-21, BE-22, PRO-05.

### 3.4 Codex / lexicon

#### `lexicon_entries`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | no | — | → books **CASCADE** (unindexed FK) |
| `term` | text | no | — | CHECK length 1–200 (a quote's passage is stored here, so quotes are capped at 200) |
| `definition` | text | no | — | CHECK length ≥ 1 (a quote's note is stored here, so a quote needs a non-empty note) |
| `entry_type` | text | no | `'dictionary'` | CHECK `dictionary` \| `quote` (the legacy `lore` type was retired and its rows deleted) |
| `context_sentence` | text | yes | — | Unbounded |
| `page_found` | int | yes | — | CHECK ≥ 1 (a capture at page 0 therefore cannot produce auto words) |
| `leitner_box` | int | no | `1` | CHECK 1–5 |
| `next_review_at` | **date** | no | `CURRENT_DATE` | Server **UTC** date |
| `created_at` | timestamptz | no | `now()` | Auto rows send client time |
| `source` | text | no | `'manual'` | CHECK `manual` \| `auto` |
| `mastered` | bool | no | `false` | Terminal except through undo |
| `last_reviewed_at` | timestamptz | yes | — | Client clock; drives the daily review tally |

No uniqueness on `(user, term)` or `(user, book, term)` — dedupe is client-only. No triggers. Indexes `idx_lexicon_review (user_id, next_review_at)`, `idx_lexicon_user_book (user_id, book_id)`, `lexicon_entries_user_leitner_created_idx (user_id, leitner_box, created_at DESC)`. Rules: LEX-01…LEX-09, BE-26.

#### `vocabulary_extractions` (auto-vocabulary ledger)

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `capture_id` | uuid | yes | — | **UNIQUE** (idempotency key); → `page_captures(id)` **ON DELETE SET NULL** |
| `book_id` | uuid | no | — | → books **CASCADE** (unindexed FK) |
| `page` | int | no | — | CHECK ≥ 0 |
| `words_added` | int | no | `0` | CHECK 0–5 |
| `status` | text | no | — | CHECK `pending` \| `succeeded` \| `failed` \| `skipped` (no default) |
| `error_message` | text | yes | — | — |
| `created_at` | timestamptz | no | `now()` | — |

Index `vocabulary_extractions_user_recent_idx`. Client-written; no DELETE policy; no retry or sweeper (a run interrupted after insert stays `pending`). Rules: LEX-83…LEX-92, BE-25.

#### `anki_review_sessions`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | **UNIQUE**; → users **CASCADE** |
| `last_reviewed_at` | timestamptz | no | `now()` | Client clock on upsert |
| `total_sessions` | int | no | `1` | — |
| `known_count` | int | no | `0` | — |
| `unknown_count` | int | no | `0` | — |

Lifetime aggregates only; the daily limit derives from `lexicon_entries.last_reviewed_at`. Index `idx_anki_review_sessions_user` is redundant with the unique index. Client upsert `onConflict: user_id`. Rules: LEX-55, LEX-68, BE-27.

### 3.5 Goals, gamification & settings

#### `reading_goals`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `year` | int | no | — | CHECK 2000–2100 |
| `target_books` | int | no | — | CHECK ≥ 1 (no DB maximum) |
| `created_at` | timestamptz | no | `now()` | — |
| `updated_at` | timestamptz | no | `now()` | Trigger `set_reading_goals_updated_at` |

UNIQUE `(user_id, year)`; index `reading_goals_user_year_idx` is redundant. Rules: BE-33, PRO-18…PRO-20.

#### `achievements`

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | → users **CASCADE** |
| `achievement_key` | text | no | — | **No CHECK**; the catalog (17 keys) is client-side today |
| `earned_at` | timestamptz | no | `now()` | — |

UNIQUE `(user_id, achievement_key)`. Insert-only ledger (no UPDATE/DELETE policy); trophies never regress. BC-09 moves catalog and evaluation server-side. Rules: BE-34, PRO-47…PRO-51.

#### `user_settings` (dormant)

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | **UNIQUE**; → users **CASCADE** |
| `weekly_goal` | int | no | `3` | CHECK 1–7 |
| `created_at` | timestamptz | no | `now()` | — |
| `updated_at` | timestamptz | no | `now()` | Set inside `upsert_weekly_goal` (no trigger) |

No client reads or writes it. BC-06 plans to add the reader's IANA time zone here (e.g. `time_zone`). Rules: BE-35, PRO-36.

### 3.6 Profile identity & community

#### `community_profiles`

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `user_id` | uuid | no | — | **PK**; → users **CASCADE** |
| `username` | text | no | — | CHECK `^[a-z0-9_-]{3,30}$`; UNIQUE index on `lower(username)` |
| `display_name` | text | yes | — | **No server length limit** (PWA input caps at 60) |
| `bio` | text | yes | — | CHECK NULL or length ≤ 160 |
| `avatar_url` | text | yes | — | Free text (no URL or bucket validation) |
| `is_public` | bool | no | **`false`** | The RPC defaults an omitted value to `true` (§8.4) |
| `created_at` | timestamptz | no | `now()` | Drives search order and cursors |
| `updated_at` | timestamptz | no | `now()` | Trigger `community_profiles_touch_updated_at` |

No row exists after sign-up; the first successful `upsert_my_community_profile` creates it. Insert fires `community_ensure_count_on_profile_insert`. Indexes `community_profiles_public_username_created_idx`, `community_profiles_public_display_name_created_idx`, `community_profiles_public_username_idx` (search). Rules: COM-01…COM-18.

#### `community_profile_privacy`

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` | uuid | no | — (**PK**; → `community_profiles(user_id)` **CASCADE**) |
| `progress_visibility` | `profile_visibility` | no | `'nobody'` |
| `currently_reading_visibility` | `profile_visibility` | no | `'nobody'` |
| `lexicon_visibility` | `profile_visibility` | no | `'nobody'` |
| `reader_dna_visibility` | `profile_visibility` | no | `'nobody'` |
| `created_at`, `updated_at` | timestamptz | no | `now()` (touch trigger on update) |

No DELETE policy (disappears only by cascade). Unused by iOS v1 (D-13).

#### `community_follow_counts`

`user_id` uuid **PK** (→ `community_profiles(user_id)` **CASCADE**), `followers_count` int default 0, `following_count` int default 0 (CHECK both ≥ 0), `updated_at` default `now()`. Trigger-maintained; owner SELECT only. Indexes on each count (DESC, user_id).

#### `follows` (dormant)

`follower_id` uuid, `following_id` uuid (both → users **CASCADE**), `created_at` default `now()`. PK `(follower_id, following_id)`; CHECK `follows_no_self_chk`. Indexes `follows_follower_created_idx`, `follows_following_created_idx`, `follows_following_follower_idx`.

#### `blocks` (dormant)

`blocker_id` uuid, `blocked_id` uuid (both → users **CASCADE**), `created_at` default `now()`. PK `(blocker_id, blocked_id)`; CHECK `blocks_no_self_chk`. Indexes `blocks_blocked_blocker_idx`, `blocks_blocked_created_idx`, `blocks_blocker_created_idx`.

#### `reading_circles` (dormant)

| Column | Type | Null | Default | Constraint / note |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `owner_id` | uuid | no | — | → users **CASCADE** |
| `created_by` | uuid | no | — | → users **CASCADE** (deleting the original creator deletes the circle, even after ownership moved) |
| `book_id` | uuid | no | — | → books **CASCADE** (the creator's book; deleting it deletes the circle for everyone) |
| `canonical_book_id` | uuid | yes | — | Unused; no FK |
| `normalized_isbn` | text | yes | — | `normalize_isbn(book.isbn)` snapshot |
| `title`, `author` | text | no | — | Snapshots at creation |
| `cover_url` | text | yes | — | Snapshot |
| `name` | text | no | — | CHECK `length(btrim(name))` 1–80 |
| `status` | `circle_status` | no | `'active'` | — |
| `created_at`, `updated_at` | timestamptz | no | `now()` | Touch trigger on update |

Indexes `reading_circles_book_idx`, `reading_circles_created_by_idx`, `reading_circles_isbn_idx`, `reading_circles_owner_status_idx`.

#### `circle_invitations` (dormant)

`id` uuid PK, `circle_id` (→ `reading_circles` **CASCADE**), `invited_user_id` (→ users **CASCADE**), `invited_by` (→ users **CASCADE**), `status circle_invitation_status` default `'pending'`, `created_at` default `now()`, `responded_at` nullable. Partial UNIQUE `(circle_id, invited_user_id) WHERE status = 'pending'`. Indexes on `(circle_id, status, created_at DESC)`, `invited_by`, `(invited_user_id, status, created_at DESC)`.

#### `circle_members` (dormant)

`circle_id` (→ `reading_circles` **CASCADE**), `user_id` (→ users **CASCADE**), `role circle_member_role` default `'member'`, `invitation_id` (→ `circle_invitations` **ON DELETE SET NULL**), `joined_at` default `now()`. PK `(circle_id, user_id)`; partial UNIQUE `circle_members_one_owner_idx (circle_id) WHERE role = 'owner'`. Trigger `circle_members_assert_insert` (≤ 10 members, no block with an existing member).

#### `circle_reactions` (dormant)

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `circle_id` | uuid | no | — | → `reading_circles` **CASCADE** |
| `author_id` | uuid | no | — | → users **CASCADE** |
| `book_id` | uuid | no | — | → books **CASCADE** (a member deleting their copy deletes their reactions everywhere) |
| `source_page` | int | no | — | CHECK > 0 and ≤ `source_total_pages` |
| `source_total_pages` | int | no | — | CHECK > 0 (frozen at post time) |
| `normalized_location` | numeric(6,3) | no | — | CHECK 0–100 |
| `content` | text | no | — | CHECK `length(btrim(content))` 1–280 |
| `created_at` | timestamptz | no | `now()` | — |
| `deleted_at` | timestamptz | yes | — | Unused |

### 3.7 Foreign-key summary

- **To `books(id)`** (13 FKs): `ON DELETE CASCADE` from `reading_progress`, `progress_history`, `up_next_order`, `book_passports`, `page_captures`, `book_quizzes`, `recaps`, `lexicon_entries`, `lore_cards`, `vocabulary_extractions`, `reading_circles`, `circle_reactions`; `ON DELETE SET NULL` from `reading_quest_events`.
- **To `auth.users(id)`**: `ON DELETE CASCADE` from every user-owned table (24 tables directly; `community_profile_privacy` and `community_follow_counts` via `community_profiles`).
- **Other**: `vocabulary_extractions.capture_id → page_captures` SET NULL; `circle_members.invitation_id → circle_invitations` SET NULL; `circle_invitations/members/reactions.circle_id → reading_circles` CASCADE.
- `storage.objects` has **no** FK to `auth.users`; nothing in Storage is cascaded (§7).

---

## 4. Cascades & lifecycle effects

Rules: BE-19…BE-23a, BE-71…BE-74 in [09](business-rules/09-database-invariants.md); cross-domain consequences in [11 · Cross-domain](business-rules/11-cross-domain.md).

### 4.1 Delete a book (`DELETE FROM books WHERE id = …`)

| Effect | Mechanism |
|---|---|
| **Deleted:** `reading_progress`, `progress_history`, `recaps`, `lexicon_entries` (incl. mastered), `lore_cards`, `book_passports`, `page_captures` (incl. resumes), `book_quizzes`, `up_next_order`, `vocabulary_extractions`, `circle_reactions` on that book | FK `ON DELETE CASCADE` |
| **Deleted for all members:** any `reading_circles` anchored on the book → its `circle_invitations`, `circle_members`, `circle_reactions` | `reading_circles_book_id_fkey` CASCADE → `circle_*_circle_id_fkey` CASCADE (dormant feature) |
| **Kept, detached:** `reading_quest_events.book_id → NULL` (+5 XP per captured page survives) | SET NULL |
| **Kept:** `achievements`, `reading_dna` (`books_finished_at_generation` not lowered), `reading_goals`, `anki_review_sessions`, `user_settings` | No FK to books |
| **Orphaned:** `recap-images/{uid}/{recapId}.png` objects | No Storage cascade; no cleanup code (BC-13) |
| Triggers | None on `books` |

Recomputed on the next read: XP and level can **drop** (pages, +25 completion, +10 per history row, +20 per recap, +15 per lore card vanish), the yearly quest, streaks, calendar days, monthly chart, records, sessions and hours, library breakdown. In-flight AI work for the book still completes and is billed: client inserts then fail with `23503`, and the recap-image job still uploads an orphan object (it does not check affected rows).

### 4.2 Delete a user (`auth.users` row)

| Effect | Mechanism |
|---|---|
| Deleted: every user-owned row — `books` (→ §4.1 chain), `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `lore_cards`, `book_passports`, `page_captures`, `book_quizzes`, `up_next_order`, `vocabulary_extractions`, `reading_dna`, `reading_goals`, `reading_quest_events`, `achievements`, `anki_review_sessions`, `user_settings`, `community_profiles` (→ `community_profile_privacy`, `community_follow_counts`) | `user_id` FKs CASCADE |
| Deleted on either side: `follows`, `blocks` (follow-count triggers decrement the counterparts), `circle_invitations` (as invitee or inviter), `circle_members`, `circle_reactions` (as author) | CASCADE |
| Deleted for everyone: `reading_circles` where the user is `owner_id` **or** `created_by` | CASCADE |
| **Not deleted:** `recap-images/{uid}/…`, `community-avatars/{uid}/…` | Storage is not cascaded and `storage.protect_delete` blocks SQL deletes; cleanup must use the Storage API |
| Endpoint | **None today.** D-10: a `delete-account` edge function (service role) purges both Storage prefixes, revokes the Sign in with Apple token, then calls `auth.admin.deleteUser`; FK cascades remove the rows. Confirm + re-auth on web and iOS (BC-11). |

### 4.3 Delete a community profile (owner DELETE policy)

Cascades `community_profile_privacy` and `community_follow_counts`. `follows`, `blocks` and circle memberships remain (they reference `auth.users`). No RPC or UI deletes a profile.

### 4.4 Delete a page capture

`vocabulary_extractions.capture_id → NULL` (ledger survives). Its `reading_quest_events` row (XP) survives. Deleting via the completion purge is the common path.

### 4.5 Book completion (`current_page ≥ total_pages`, `total_pages > 0`)

Server-side, client-agnostic effects (live triggers, §9):

1. `page_captures_delete_on_completion` and `book_quizzes_delete_on_completion` run `AFTER INSERT OR UPDATE OF current_page ON reading_progress`. When `NEW.current_page ≥ books.total_pages` (matched on book id **and** user id), they delete **all** of that user's captures (with their resumes) and the quiz for the book.
2. `UPDATE OF current_page` fires whenever `current_page` is in the SET list, even unchanged. Writes that fire it: page saves, start-session upserts that resend `current_page`, DNF upserts, initial-status inserts, CSV-import upserts, offline-queue replays. Writes that do not: pause/resume/clear-session updates, DNF resume (`dnf_at = null` only), any `books.total_pages` edit.
3. **A capture saved on an already-complete book is deleted in the same statement** by `record_page_capture_quest_event` (AFTER INSERT OR UPDATE on `page_captures`): the trigger first upserts the +5 XP quest event, then deletes every capture of the book. PostgREST still returns the inserted row; the follow-up `vocabulary_extractions` insert then fails with `23503` and a resume `UPDATE` matches 0 rows. Updating any capture of a complete book (e.g. writing `resume`) also purges all of that book's captures.
4. Moving progress back below the total restores nothing: purged captures and quizzes are gone; recaps, lore, lexicon and passport are untouched.
5. XP/quest: +25 XP for **manual** books only; the yearly quest counts the book in the UTC year of its `reading_progress.updated_at` (§4.9). History-based "finish" facts (`get_monthly_reading.booksFinished`, `get_reading_records.fastestFinish`) use the first history row with `page ≥ total_pages`.

Which completion paths produce which effects (today):

| Path | Purge triggers | `progress_history` row | Passport | XP +25 / quest |
|---|---|---|---|---|
| Online page save reaching the total | yes | yes | client-generated if none exists | yes (manual), dated now |
| Offline save, later replayed | at replay time | **no** | no | dated at **replay** time |
| Add book as "Already finished" | yes (INSERT) | no | no | yes (manual) |
| CSV import "read" | yes (no-op) | no | no | **no** (imported) |
| `total_pages` lowered to ≤ `current_page` | **no** (no trigger on `books`) | no | no | yes, retroactive, possibly a past year |

Planned (D-06): BC-04 `save_progress` detects completion and stamps a first-completion timestamp (`reading_progress.completed_at`) on the server clock; BC-05 makes one server owner for every completion effect (passport stats frozen + AI-summary job, purge, Insight milestones, achievements, DNA eligibility) regardless of client or path.

### 4.6 DNF shelve / resume

No server cascade: `dnf_at` is read only by `get_library_with_progress`. Shelving (an upsert that also nulls the session columns) and resuming (an update of `dnf_at` only) delete nothing and only bump `updated_at`. Every other RPC (quest XP and completions, stats, records, breakdown, velocity, public profile, also-reading, circles) ignores DNF. Saving pages does not clear `dnf_at`; a DNF book that reaches the total keeps library status `dnf` but counts as completed in the quest and has its captures purged.

### 4.7 Add with initial status, CSV import

- Initial status writes only `reading_progress` (`queued` → no row; `in progress` → page clamped to `[1, total − 1]`; `completed` → `total_pages`). It never writes `progress_history`. A manual "completed" add immediately adds +25 XP + `total_pages` XP and counts toward this year's quest, while monthly/records/calendar/streaks ignore it.
- CSV import inserts `books` in chunks of 100 (`source = goodreads|storygraph`, placeholder `total_pages = 100` with `page_count_estimated = true` when unknown), then upserts `reading_progress` (`read` → `current_page = total_pages`; DNF → `current_page 0` + `dnf_at`). It is **not transactional** and writes no history. Imported books never earn page/completion XP and are excluded from `totalPagesRead`, because `books.source` never changes — even when the book is later read in-app (its new history rows still feed streaks, sessions and charts).
- Planned: BC-15 atomic, idempotent import RPC with ISBN normalisation; BC-04 recommends a baseline history row when a book is added mid-way.

### 4.8 Offline replay (PWA today)

The PWA queues `{bookId, currentPage}` in IndexedDB and replays **only** the `reading_progress` upsert. No `progress_history` row is ever written for an offline save, the session columns are not cleared, and `updated_at` is the replay time. Replays are FIFO last-write-wins with no version check. The queue is **not user-scoped**: if another user signs in on the same browser, the replay runs under the new user. Since BC-01 the RLS book-ownership check rejects such a row with `42501`, and the record stays queued, like saves for deleted books (§5, §12 S-10). Scoping the queue per user is still a recommended PWA change. D-08 (decided): offline saves count for pages, streaks and charts, replayed with their original timestamp — implemented by BC-04.

### 4.9 `updated_at` drift

`reading_progress.updated_at` changes on every update of the row. It is the library's `lastReadAt` and sort key, the recap 72 h idle clock, and the quest's "completed this year" date. Any later write to a finished book's row (re-save, replay) moves its completion into the current UTC year. BC-04's `completed_at` replaces it for "finished this year".

### 4.10 Recap and recap-image lifecycle

```
client: stream generate-recap (text) ──fail/abort──► nothing persisted
   │ success (client parses JSON)
   ▼
client INSERT recaps (… mode, image_status='pending') ── then POST mode=recap_image
   │                                   │ 4xx/5xx/network ► row stays 'pending' forever
   ▼                                   ▼
edge 202 → UPDATE 'pending' → refine prompt (Gemini Flash; deterministic fallback) → OpenAI gpt-image-2
   ├─ ok ──────────────────────────► upload {uid}/{recapId}.png (upsert) → 'succeeded' + image_path + image_generated_at
   ├─ safety → softer prompt, retry once ─ ok ► 'succeeded' │ fail ► 'failed_safety' | 'failed_transient'
   └─ transient → wait 2 s, retry once ── ok ► 'succeeded' │ fail ► 'failed_transient'
upload/UPDATE throws, runtime kill, or 503 before the job starts ► stays 'pending' (no catch, no server timeout)
'skipped' is never written; NULL = legacy rows.
```

Updates run with the service role scoped `id = recapId AND user_id = <decoded sub>`; a 0-row update is silent. Observed timing (aggregate over successful rows): `image_generated_at − created_at` p50 ≈ 42 s, p90 ≈ 57 s. Planned: BC-07 (the edge function persists the recap itself; once paid, finish and save), BC-13 (stale `pending` → `failed_transient` after a timeout, error handling, Storage cleanup), BC-14 (Realtime on `recaps.image_status` or refresh-on-foreground).

---

## 5. Row-level security

Live policies after BC-01 (2026-10-19; all PERMISSIVE; RLS enabled, not forced). "owner\*" = `user_id = (select auth.uid())` (initplan-safe form). "owner\*+book" = owner\* **and** `exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))` — the referenced book must belong to the caller. A missing command means that command is denied to `anon`/`authenticated` through PostgREST (only `SECURITY DEFINER` functions or the service role can do it).

| Table | Role | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|---|
| `books` | authenticated | owner\* | owner\* | owner\* | owner\* | One `FOR ALL` policy |
| `reading_progress` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | Per-command policies (BC-01) |
| `progress_history` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | Per-command policies (BC-01) |
| `up_next_order` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | Per-command policies (BC-01) |
| `recaps` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | Clients could also update `image_*` |
| `book_passports` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | Per-command policies (BC-01) |
| `lexicon_entries` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | Per-command policies (BC-01) |
| `anki_review_sessions` | authenticated | owner\* | owner\* | owner\* | owner\* | `FOR ALL` |
| `lore_cards` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | — |
| `page_captures` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | — |
| `reading_dna` | authenticated | owner\* | owner\* | owner\* | — | — |
| `vocabulary_extractions` | authenticated | owner\* | owner\*+book | owner\*+book | — | — |
| `user_settings` | authenticated | owner\* | owner\* | owner\* | — | Dormant |
| `book_quizzes` | authenticated | owner\* | owner\*+book | owner\*+book | owner\* | — |
| `reading_goals` | authenticated | owner\* | owner\* | owner\* | owner\* | — |
| `achievements` | authenticated | owner\* | owner\* | — | — | Insert-only ledger |
| `reading_quest_events` | authenticated | owner\* | — | — | — | Trigger-written |
| `community_profiles` | public | own row | — | — | own row | Writes only via `upsert_my_community_profile` (BC-01) |
| `community_profile_privacy` | public | own row | own row | own row | — | — |
| `community_follow_counts` | public | own row | — | — | — | Trigger-maintained |
| `follows` | public | follower or following | — | — | as follower | Inserts only via `follow_community_user` (BC-01) |
| `blocks` | public | blocker or blocked | as blocker | — | as blocker | A blocked user can read the block row naming the blocker |
| `reading_circles` | authenticated | active member (`private.is_circle_member`) | — | — | — | All writes via RPCs |
| `circle_members` | authenticated | active member (`private.is_circle_member`) | — | — | — | — |
| `circle_invitations` | authenticated | invitee or circle owner (`private.is_circle_owner`) | — | — | — | — |
| `circle_reactions` | authenticated | author only | — | — | — | Others' reactions only via `get_visible_circle_reactions` |

Facts every client must respect:

- **Child rows must reference the caller's own book** (BC-01). Inserting or updating a row in `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `page_captures`, `lore_cards`, `up_next_order`, `book_passports`, `book_quizzes` or `vocabulary_extractions` whose `book_id` belongs to another user fails with `42501` (PostgREST 403). Offline queues must be scoped per user (PLT-46, SES-84): after an account switch, a queued save for the previous user's book is rejected, not written.
- `anon` holds **no** table privileges in `public` (except the out-of-scope `activity_logs`), so signed-out PostgREST calls get `42501` before RLS is consulted.
- `private.is_circle_member(circle_id)` / `private.is_circle_owner(circle_id)` take the user from `auth.uid()`; they are the only `private` functions `authenticated` may execute.
- Remaining per-row `auth.uid()` policies (advisor `auth_rls_initplan`) are only on `activity_logs`, which is out of scope (§14).
- Storage policies are in §7.

---

## 6. Enums

### 6.1 Database enum types

| Enum | Values (declaration order) | Used by |
|---|---|---|
| `profile_visibility` | `everyone`, `followers`, `nobody` | `community_profile_privacy.*_visibility` |
| `circle_status` | `active`, `closed` | `reading_circles.status` |
| `circle_invitation_status` | `pending`, `accepted`, `declined`, `revoked`, `expired` (`expired` is never set) | `circle_invitations.status` |
| `circle_member_role` | `owner`, `member` (so `ORDER BY role DESC` lists members first, owner last) | `circle_members.role` |

### 6.2 CHECK-constrained text values

| Column | Allowed values |
|---|---|
| `lexicon_entries.entry_type` | `dictionary` (default), `quote` |
| `lexicon_entries.source` | `manual` (default), `auto` |
| `recaps.mode` | `corpus`, `inferred` (default) |
| `recaps.image_status` | NULL, `pending`, `succeeded`, `failed_safety`, `failed_transient`, `skipped` |
| `page_captures.source` | `ocr` (default), `manual`, `import` |
| `vocabulary_extractions.status` | `pending`, `succeeded`, `failed`, `skipped` |
| `reading_quest_events.event_type` | `page_capture` |
| `lore_cards.unlocked_at_milestone` | 10, 20, 30, 40, 50, 60, 70, 80, 90 |

### 6.3 Unconstrained columns with a conventional value set

| Column | Values in use |
|---|---|
| `books.source` | `manual`, `goodreads`, `storygraph` (no CHECK) |
| `lore_cards.type` | `History`, `Culture`, `Geography`, `Technology`, `Lore` (edge-validated; no CHECK) |
| `achievements.achievement_key` | 17 client-defined keys (`first_book`, `books_5`, `books_10`, `pages_1k`, `pages_10k`, `sessions_50`, `sessions_100`, `capture_first`, `captures_50`, `recap_first`, `insight_first`, `streak_7`, `streak_30`, `century_day`, `deep_dive`, `devoured`, `night_owl`) |

### 6.4 Value sets emitted by RPCs

| RPC field | Values |
|---|---|
| `get_library_with_progress[].status` | `dnf`, `unread`, `finished`, `reading` |
| `get_reading_quest_summary.quest.status` (label) | `no_goal` ("Set your reading quest"), `complete` ("Quest complete"), `no_projection` ("Pace warming up"), `ahead` ("Ahead of pace"), `on_track` ("On track"), `behind` ("A little behind"), `comeback` ("Comeback arc available") |
| `get_reading_quest_summary.level.title` | `Page Turner`, `Chapter Seeker`, `Margin Walker`, `Lore Keeper`, `Archive Runner`, `Chapter Sage`, `Library Legend` (levels 0–6) |
| `get_retention_summary.nudgeCode` | `goal_met`, `comeback`, `start_week`, `almost_there`, `keep_going`, `signed_out` |
| Community interaction `reason` | `allowed`, `self`, `blocked`, `profile_unavailable` |
| `get_also_reading_for_book` `matchType` / `relativeStatus` | `same_book`, `same_isbn` / `same_area`, `ahead`, `behind`, `null` |

---

## 7. Storage

### 7.1 Buckets

| Bucket | Public | `file_size_limit` | MIME types | Purpose |
|---|---|---|---|---|
| `recap-images` | **no** | 10 485 760 (10 MiB) | `image/png`, `image/jpeg`, `image/webp` | One illustration per recap |
| `community-avatars` | yes | 5 242 880 (5 MiB) | `image/jpeg`, `image/png`, `image/webp` | Profile avatars |

### 7.2 Policies (`storage.objects`)

| Policy | Command | Role | Rule |
|---|---|---|---|
| `recap-images: owner can select` | SELECT | public | `bucket_id = 'recap-images'` and first folder = `auth.uid()::text` |
| `recap-images: owner can insert` | INSERT | public | same |
| `recap-images: owner can delete` | DELETE | public | same |
| — | UPDATE | — | none for `recap-images` |
| `community_avatars_owner_select` / `_insert` / `_update` / `_delete` | all four | authenticated | `bucket_id = 'community-avatars'` and first folder = `auth.jwt()->>'sub'` |

Public reads of `community-avatars` objects by URL need no policy; listing is owner-folder only.

### 7.3 Path conventions and access

| Bucket | Path | Writer | Reader |
|---|---|---|---|
| `recap-images` | `{userId}/{recapId}.png`, `contentType image/png`, `upsert: true` | `generate-recap` image job with the **service role** | Signed URLs under the user's JWT: **60 s** for a single recap panel, **3 600 s** for the book carousel and profile gallery (batch `createSignedUrls`). Re-mint on demand; cache image bytes, not URLs. An unused server helper `mintSignedUrl` exists in the function source. |
| `community-avatars` | `{userId}/avatar-{epochMs}.jpg` (lowercase uid; PWA downsizes to ≤ 512 px JPEG q0.85) | Client, upsert | Public URL `{SUPABASE_URL}/storage/v1/object/public/community-avatars/{userId}/avatar-{ms}.jpg`, stored in `community_profiles.avatar_url` |

### 7.4 Lifecycle facts

- No object is ever deleted by the database when a recap, book or user is deleted. `storage.objects` has no FK to `auth.users`, and the trigger `protect_objects_delete` (`storage.protect_delete()`) raises "Direct deletion from storage tables is not allowed. Use the Storage API instead." — cleanup must go through the Storage API (client under the owner DELETE policy, or an edge function with the service role). At audit time there were 3 orphaned recap images.
- The PWA removes older avatar files best-effort **before** saving the profile; if the save then fails, `avatar_url` points at a deleted file. Native order: upload → save → clean up.
- Planned: BC-13 (delete recap images on recap/book delete via an edge function, orphan sweep), D-10 / BC-11 (account deletion purges `recap-images/{uid}/` and `community-avatars/{uid}/`).

---

## 8. RPC catalogue

Common to all: `POST /rest/v1/rpc/<name>` with the user's JWT and a JSON body of named arguments; `SECURITY DEFINER`, `search_path = public`. JSON keys are camelCase unless noted. Timestamps are ISO-8601 with offset and 0–6 fractional digits (e.g. `2026-10-18T12:34:56.789+00:00`); date-only fields (`YYYY-MM-DD`) are **calendar dates** and must not be parsed as UTC midnight. Numeric fields may be non-integers or `null`. Every stats RPC scans the caller's full history and must finish inside the 8 s statement timeout.

### 8.1 Summary

| RPC | Signature | Exec | Guard | Day boundaries | Caller today |
|---|---|---|---|---|---|
| `get_library_with_progress` | `(p_user_id uuid) → json` | U | ✅ owner-checked | — | PWA |
| `get_reading_stats` | `(p_user_id uuid) → json` | U | ✅ guarded | **UTC** | PWA |
| `get_last_session` | `(p_user_id uuid) → json` | U | ✅ owner-checked | — | PWA |
| `get_library_breakdown` | `(p_user_id uuid) → json` | U | ✅ owner-checked | — | PWA |
| `get_reading_velocity` | `(p_user_id uuid, p_book_ids uuid[]) → table(book_id uuid, days_left int)` | U | ✅ owner-checked | **UTC** | PWA |
| `get_book_passport_stats` | `(p_user_id uuid, p_book_id uuid, p_time_zone text = 'UTC') → json` | U | ✅ guarded | local (`p_time_zone`) | PWA |
| `get_reading_calendar` | `(p_user_id uuid, p_month_start date, p_timezone text = 'UTC') → json` | U | ✅ guarded | local | PWA |
| `get_monthly_reading` | `(p_user_id uuid, p_year int, p_timezone text = 'UTC') → json` | U | ✅ guarded | local | PWA |
| `get_reading_records` | `(p_user_id uuid, p_timezone text = 'UTC') → json` | U | ✅ guarded | local | PWA |
| `get_reading_quest_summary` | `(p_user_id uuid, p_year int) → jsonb` | U | ✅ owner-checked | **UTC** year | PWA |
| `get_my_community_profile` | `() → jsonb` | U | ✅ guarded | — | PWA |
| `upsert_my_community_profile` | `(payload jsonb) → jsonb` | U | ✅ guarded | — | PWA |
| `is_username_available` | `(p_username text) → jsonb` | U | ✅ guarded | — | PWA |
| `upsert_weekly_goal` | `(p_goal int) → void` | — | ✅ guarded | — | none (dormant; not on the allowlist) |
| `get_retention_summary` | `(p_timezone text = 'UTC') → json` | — | ✅ guarded | local (validated) | none (dormant; not on the allowlist) |

"Guarded" RPCs compare `p_user_id` with `auth.uid()` inside the query and **return empty/zero data silently** for a foreign caller. "Owner-checked" RPCs (BC-01) **raise** `42501 not_allowed` (PostgREST 403) for a foreign or missing caller; the payload for the caller's own id is unchanged. Signed-out calls to any RPC fail with `42501` because `anon` has no `EXECUTE`. `upsert_weekly_goal` and `get_retention_summary` are not on the client allowlist (no client calls them); re-grant them in a migration when a client needs them. Timezone arguments are applied with `AT TIME ZONE` directly: an unknown IANA name raises `22023` (only `get_retention_summary` validates against `pg_timezone_names` and falls back to UTC). Note the spelling `p_time_zone` on `get_book_passport_stats` versus `p_timezone` elsewhere. BC-06 adds `p_timezone` to every stats RPC (D-07).

### 8.2 Library & reading

#### `get_library_with_progress(p_user_id uuid) → json` — ✅ owner-checked

- Semantics: every `books` row of `p_user_id`, LEFT JOIN its `reading_progress` row (joined on book id and `user_id = p_user_id`). Ordered by `coalesce(rp.updated_at, b.created_at) DESC` with no tiebreaker. **No pagination** (one JSON scalar; grows with the library). Includes imported books.
- Status: `dnf` if `dnf_at` is not null → else `unread` if `current_page` is 0 or there is no progress row → else `finished` if `total_pages > 0 AND current_page ≥ total_pages` → else `reading` (a negative `current_page` also yields `reading`).
- `percentage = least(100, round(current_page / total_pages × 100, 2))` (0 when no row).
- Response: `[]` or
  ```json
  [{ "id": "uuid", "title": "string", "author": "string", "coverUrl": "string|null",
     "totalPages": 123, "genre": "string|null", "isbn": "string|null", "description": "string|null",
     "source": "manual|goodreads|storygraph", "pageCountEstimated": false,
     "currentPage": 0, "percentage": 0.00, "status": "unread|reading|finished|dnf",
     "lastReadAt": "timestamptz|null", "sessionStartAt": "timestamptz|null",
     "dnfAt": "timestamptz|null", "progressId": "uuid|null" }]
  ```
- `lastReadAt` = `reading_progress.updated_at` (bumped by any update, not only page saves). Not returned: `created_at`, **`session_paused_at`** (read `reading_progress.session_paused_at` separately).
- Errors: `42501 not_allowed` when `p_user_id` is not the caller (BC-01; the parameter is kept for PWA compatibility and must equal the caller). Planned: BC-14 adds a delta / paginated variant (`changed_since`).

#### `get_reading_stats(p_user_id uuid) → json` — ✅ guarded, UTC

- Page delta per history row: `max(0, page − lag(page, 1, 0))` per book ordered by `(recorded_at, id)`. The **first** history row of a book counts its full page number (first-save inflation for books started outside the app).
- Valid ("meaningful") session: `session_start_at IS NOT NULL`, duration `recorded_at − session_start_at ≥ 60 s`, delta ≥ 1. No upper cap.
- Fields (all integers):

| Field | Formula |
|---|---|
| `pagesThisWeek` | Σ delta where `recorded_at ≥ now() − 7 days` (rolling 168 h) |
| `pagesThisMonth` | Σ delta where `recorded_at ≥ date_trunc('month', now())` (UTC calendar month) |
| `totalPagesRead` | Σ `least(greatest(current_page, 0), total_pages)` over `reading_progress` rows with `current_page > 0` of **manual** books (`coalesce(source,'manual') = 'manual'`); state-based; includes DNF |
| `totalReadingHours` | `round(Σ valid duration / 3600)` |
| `sessionsThisMonth` | `count(distinct (book_id, session_start_at))` of valid sessions in the UTC month |
| `currentStreakDays` | Length of the latest run of consecutive UTC `date(recorded_at)` days (any history row counts, even zero delta) whose last day ≥ `current_date − 1`; else 0 |
| `longestStreakDays` | Longest such run |
| `allTimeVelocityPph` | `round(Σ delta / (Σ duration / 3600))` over valid sessions; 0 when none |

- Response: `{pagesThisWeek, pagesThisMonth, totalPagesRead, totalReadingHours, sessionsThisMonth, currentStreakDays, longestStreakDays, allTimeVelocityPph}`. Foreign caller → all zeros. Device-written `recorded_at` is compared with server `now()`, so a fast device clock counts future rows immediately. Planned: BC-06 (`p_timezone`), D-08 counting rules (BC-04).

#### `get_last_session(p_user_id uuid) → json` — ✅ owner-checked

- Picks the latest `progress_history` row of any book of `p_user_id`. Previous row = the latest row of the same book with `recorded_at` strictly earlier (default page 0).
- Fields: `pagesDelta = max(0, page − previous)`, `startPage` (previous page), `endPage`, `endedAt` (`recorded_at`), `startedAt` (`session_start_at` or null), `durationSeconds` (only when timed), `velocityPph` (only when duration ≥ 60 s and delta ≥ 1), `completionDelta = round(delta / total × 1000) / 10` (percent, 1 dp), `finishPredictionSessions = ceil(remaining / max(1, rollingVelocity × lastSessionHours))` where `rollingVelocity` = Σ delta / Σ hours over the **3 most recent valid sessions across all books**; `0` when the book is finished; `sessionNote`; `bookTitle` (fallback `'Unknown Book'`).
- An **untimed** latest save makes the divisor 1, so `finishPredictionSessions` equals the remaining pages — hide the prediction when `durationSeconds` is null.
- Response: `null` (no history) or `{bookId: uuid, bookTitle: string, endedAt: timestamptz, startedAt: timestamptz|null, pagesDelta: int, startPage: int, endPage: int, durationSeconds: number|null, velocityPph: number|null, completionDelta: number|null, finishPredictionSessions: int|null, sessionNote: string|null}`. Ignores DNF and `source`. Planned: BC-01; D-08 (the Last Session card requires a real timed session, BC-04).

#### `get_library_breakdown(p_user_id uuid) → json` — ✅ owner-checked

- Status per book (all books incl. imports; **DNF ignored**): `unread` if `coalesce(current_page,0) = 0`; `finished` if `current_page ≥ total_pages AND total_pages > 0`; else `reading`.
- `genreDistribution = [{genre, count, percentage}]`: `genre = nullif(trim(genre), '')` else `'Uncategorized'`; grouping is case-sensitive; `percentage = round(count / total × 100, 1)`; ordered by count DESC (ties unordered).
- `authorsCount = count(distinct lower(trim(author)))`; `booksFinished`, `booksInProgress`, `booksUnstarted` = status counts; `avgCompletionPct = round(avg(per-book completion, capped 100) over non-unread books, 1)`.
- Response: `{genreDistribution: [{genre: string, count: int, percentage: number}], authorsCount: int, booksFinished: int, booksInProgress: int, booksUnstarted: int, avgCompletionPct: number|null}`.

#### `get_reading_velocity(p_user_id uuid, p_book_ids uuid[]) → table(book_id uuid, days_left int)` — ✅ owner-checked, UTC

- Window: the last 30 days of history for the given books owned by `p_user_id`.
- Average pages per day: the mean positive delta per timed session (needs ≥ 3 session deltas; a delta needs a previous row of the same book **inside** the window) — else the mean per UTC day of `max(page) − min(page)` (needs ≥ 3 active days; single-save days give 0 and are dropped).
- `days_left = ceil((total_pages − current_page) / average)`. Books without enough data, finished books and `total_pages = 0` are **omitted**, so `days_left ≥ 1` (it never returns 0). DNF books are not excluded.
- Response (PostgREST, **snake_case**): `[{"book_id": "uuid", "days_left": 12}]`.

#### `get_book_passport_stats(p_user_id uuid, p_book_id uuid, p_time_zone text = 'UTC') → json` — ✅ guarded

- Guard: the `authorized_book` CTE requires `p_user_id = auth.uid()` **and** that the book belongs to `p_user_id`.
- Pages clamped to `[0, total_pages]`; delta = `max(0, clampedPage − running max of earlier pages)` (backward corrections never re-count).
- `totalDays = max(1, ceil((last recorded_at − first recorded_at) / 86 400 s))` (elapsed time, not calendar days; null with no history); `peakDay` / `peakDayPages` = the local day (`(recorded_at AT TIME ZONE p_time_zone)::date`) with the largest Σ delta, ties → earliest; `vocabularyCount = count(lexicon_entries)` for the book (all types, sources, mastery states).
- Response: `{totalDays: int|null, peakDay: "YYYY-MM-DD"|null, peakDayPages: int|null, vocabularyCount: int}`. Unauthorized → `{null, null, null, 0}`.

#### `get_reading_calendar(p_user_id uuid, p_month_start date, p_timezone text = 'UTC') → json` — ✅ guarded

- `p_month_start` may be any date in the month (normalised with `date_trunc('month', …)`). A day is active when ≥ 1 history row has `(recorded_at AT TIME ZONE p_timezone)::date` on it. Per day, books are ordered by first `recorded_at`; `furthestPage = max(page)` that day; missing title → `'Unknown Book'`. Only active days, sorted by date.
- Response: `[{date: "YYYY-MM-DD", books: [{bookId: uuid, title: string, coverUrl: string|null, furthestPage: int}]}]`; foreign caller → `[]`.

#### `get_monthly_reading(p_user_id uuid, p_year int, p_timezone text = 'UTC') → json` — ✅ guarded

- Always 12 rows `[{month: int 1–12, pages: int, booksFinished: int}]` for the local year. `pages` = Σ `max(0, page − previous row of the same book with recorded_at strictly earlier, any year, default 0)` (no `id` tiebreak: rows with identical timestamps each diff against the older row). `booksFinished` = books whose **first** history row with `page ≥ total_pages` falls in that local month. No `source` filter (imports have no history unless read in-app).
- Foreign caller → 12 zero rows.

#### `get_reading_records(p_user_id uuid, p_timezone text = 'UTC') → json` — ✅ guarded

| Field | Rule |
|---|---|
| `bestDay {pages, date}` | Local day with max Σ delta (same strictly-earlier delta as monthly), > 0; ties → later day |
| `longestSession {minutes, date}` | Max `round(duration / 60)` over timed rows with `0 < duration ≤ 12 h` (no ≥ 60 s or ≥ 1-page rule); ties → latest; `date` = local day of the end |
| `fastestFinish {days, title}` | Min `finishDay − firstHistoryDay + 1` (local days, inclusive) over books with `total_pages > 0`; ties → title A→Z; books without history never qualify |
| `nightOwl` (bool) | Any such timed row whose end local hour ∈ [0, 4] |

- Response: `{bestDay: {pages: int, date: "YYYY-MM-DD"}|null, longestSession: {minutes: int, date: "YYYY-MM-DD"}|null, fastestFinish: {days: int, title: string}|null, nightOwl: bool}`; foreign caller → `{bestDay:null, longestSession:null, fastestFinish:null, nightOwl:false}`.

#### `get_reading_quest_summary(p_user_id uuid, p_year int) → jsonb` — ✅ owner-checked

- Guard (BC-01): `private.assert_is_caller(p_user_id)` raises `42501 not_allowed` when `auth.uid()` is NULL or differs from `p_user_id`. Before 2026-10-19 the check was a NULL-unsafe `<>` that let `anon` read any user's summary. `anon` has no EXECUTE.
- XP (lifetime, not per year): `totalXp = pagesRead + 25·completedBooks + 10·readingSessions + 5·pageCaptures + 20·recapsGenerated + 15·loreCardsUnlocked`.

| Source | Definition |
|---|---|
| `pagesRead` | Σ `clamp(current_page, 0, total_pages)` over **manual** books (incl. DNF) |
| `completedBooks` | Manual books with `total_pages > 0 AND current_page ≥ total_pages` (lifetime) |
| `readingSessions` | `count(*)` of **all** `progress_history` rows (every save, timed or not) |
| `pageCaptures` | `count(reading_quest_events WHERE event_type = 'page_capture')` (survives capture and book deletion) |
| `recapsGenerated`, `loreCardsUnlocked` | `count(*)` of the user's `recaps` / `lore_cards` (cascade with their book) |

- Levels (XP floor → level, title): 0 → 0 Page Turner; 1 500 → 1 Chapter Seeker; 4 000 → 2 Margin Walker; 8 000 → 3 Lore Keeper; 14 000 → 4 Archive Runner; 22 000 → 5 Chapter Sage; 34 000 → 6 Library Legend (max: `progressPercent = 100`, `nextLevelXp = 0`, `xpToNextLevel = 0`). `currentLevelXp = xp − floor`; `nextLevelXp = next − floor` (span of the level); `xpToNextLevel = max(next − xp, 0)`; `progressPercent = round((xp − floor) / (next − floor) × 100, 1)`.
- Quest: year window **UTC** `[p_year-01-01T00:00Z, p_year+1-01-01T00:00Z)`. `completedBooks(year)` = completed manual books whose `reading_progress.updated_at` falls in the window. `monthsElapsed = 1` if `now()` < year start, else `clamp((least(now(), yearEnd) − yearStart) / 2 629 800 s, 1, 12)`. `requiredBooksPerMonth = round(target / 12, 1)`; `currentBooksPerMonth = round(completed / months, 1)` and `projectedBooks = round(completed / months × 12, 1)` (both null when completed = 0); `hasProjection = projectedBooks IS NOT NULL`; `progressPercent = least(100, round(completed / target × 100, 1))` (0 without goal; `completedBooks` not capped).
- Status precedence: no goal → `no_goal`; completed ≥ target → `complete`; no projection → `no_projection`; projected ≥ 1.1 × target → `ahead`; ≥ target → `on_track`; ≥ 0.75 × target → `behind`; else `comeback`.
- Response:
  ```text
  goal:    null | { id: uuid, userId: uuid, year: int, targetBooks: int, createdAt: timestamptz, updatedAt: timestamptz }
  quest:   { year: int, targetBooks: int|null, completedBooks: int, progressPercent: number,
             requiredBooksPerMonth: number|null, currentBooksPerMonth: number|null, projectedBooks: number|null,
             hasProjection: bool, status: string, statusLabel: string }
  level:   { level: int 0–6, title: string, totalXp: int, currentLevelXp: int, nextLevelXp: int,
             xpToNextLevel: int, progressPercent: number }
  sources: { pagesRead: int, completedBooks: int, readingSessions: int, pageCaptures: int,
             recapsGenerated: int, loreCardsUnlocked: int }
  ```
- Errors: `Not allowed` (P0001, HTTP 400) for another signed-in user. Planned: BC-04 `completed_at` for "finished this year", BC-06 local year, D-08 timed-session XP.

### 8.3 Achievements, goals and other writes (tables, not RPCs)

Goals (`reading_goals` upsert `onConflict user_id,year`), achievements (`achievements` insert `ON CONFLICT DO NOTHING`), DNA (`reading_dna` upsert `onConflict user_id`), passports (`book_passports` upsert `onConflict book_id`) and quizzes (`book_quizzes` upsert `onConflict user_id,book_id`) are written directly through PostgREST today. Planned: BC-05 / BC-08 / BC-09 / BC-10 move evaluation and persistence behind RPCs or edge functions.

### 8.4 Profile identity (live; iOS v1 uses username, display name, avatar)

| RPC | Signature / Exec | Guard | Response | Errors |
|---|---|---|---|---|
| `get_my_community_profile` | `() → jsonb` · U | ✅ | `null` (no profile row, or no privacy row — the function inner-joins `community_profile_privacy`) or `{profile:{userId, username, displayName, bio, avatarUrl, isPublic, createdAt, updatedAt}, privacy:{progress, currentlyReading, lexicon, readerDna}}` | none (anon has no EXECUTE → `42501`) |
| `upsert_my_community_profile` | `(payload jsonb) → jsonb` · U | ✅ | Same shape as above | `not_authenticated`, `username_invalid`, `bio_too_long`, `visibility_invalid`, `username_taken`; raw `22P02` for a non-boolean `isPublic` |
| `is_username_available` | `(p_username text) → jsonb` · U | ✅ | `{available: bool, normalizedUsername: string}` | none |

`upsert_my_community_profile` semantics:

- Payload `{username, displayName?, bio?, avatarUrl?, isPublic?, privacy?: {progress?, currentlyReading?, lexicon?, readerDna?}}`. It is a **full replace**: omitted `displayName`/`bio`/`avatarUrl` become NULL, omitted `isPublic` becomes **`true`**, omitted privacy keys become `nobody`. Always send the complete payload. Sending `""` for `avatarUrl` removes the avatar. Planned (BC-11.8): absent keys keep their current values, so an iOS v1 client can send only `username`, `displayName` and `avatarUrl` (D-13).
- Normalisation: `username = lower(trim(…))`; other text `nullif(trim(…), '')`. Postgres `trim()` strips only ASCII spaces (tabs/newlines survive) — clients must trim all whitespace themselves.
- Validation order: the `isPublic` boolean cast runs in the DECLARE section **before** any check and outside the EXCEPTION handler, so a non-boolean string (e.g. `"maybe"`) raises a raw `22P02` (Postgres also accepts `yes/no/on/off/1/0/t/f`). Then `not_authenticated` → `username_invalid` (regex `^[a-z0-9_-]{3,30}$` or reserved `admin, api, auth, bookhero, login, profile, u`) → `bio_too_long` (> 160 code points) → `visibility_invalid` → `username_taken` (case-insensitive, another user). A concurrent `unique_violation` maps to `username_taken`.
- Writes `community_profiles` then `community_profile_privacy` (both `ON CONFLICT (user_id) DO UPDATE`), then returns `get_my_community_profile()`. Usernames can change at any time; the old name is immediately claimable.

`is_username_available` returns `available = false` for an invalid pattern, a reserved name, or a name owned by another user; the caller's own current name is `true`. Reserved names therefore look "taken".

### 8.5 Dormant: weekly session goal (no client caller)

| RPC | Signature / Exec | Guard | Semantics | Errors |
|---|---|---|---|---|
| `upsert_weekly_goal` | `(p_goal int) → void` · A, U | ✅ | Upserts `user_settings.weekly_goal`, sets `updated_at` | `Not authenticated`; `Weekly goal must be between 1 and 7`; `NULL` slips past the range check and fails NOT NULL (raw `23502`) |
| `get_retention_summary` | `(p_timezone text = 'UTC') → json` · A, U | ✅ | Week = ISO week (Monday 00:00) in the validated zone (invalid → UTC). A session = distinct `(book_id, session_start_at)` with its **first** `recorded_at` in the week (no ≥ 60 s / ≥ 1 page filter). `goalProgressPct = least(100, round(sessions / weeklyGoal × 100))`; `weeklyGoal` falls back to 3. `nudgeCode`: `goal_met` (sessions ≥ goal) → `comeback` (≥ 14 local days since the last timed session) → `start_week` (0) → `almost_there` (goal − 1) → `keep_going`; signed out → `signed_out`. | none |

Response of `get_retention_summary`: `{weekStart, weekEnd, timezone, sessionsThisWeek, weeklyGoal, goalProgressPct, activeDaysThisWeek, lastSessionAt, daysSinceLastSession, nudgeCode}`. This is a weekly **reading-session** goal, not vocabulary retention. Keep or drop is an open product question.

### 8.6 Dormant: community & circles

No client calls these today; the follow graph, discovery and circles are a much later Community phase (D-13). EXECUTE is granted to `authenticated` only — a signed-out call gets `42501`. Guard: **✅ guarded for every RPC in this subsection** — each derives the viewer from `auth.uid()` and ignores client-supplied identity. Their privacy defects, and the leaking helper functions they rely on, are listed in §12 S-04 and S-15. Typed errors are `P0001` with `message = <code>`. Full rules: [10 · Community & circles](business-rules/10-community-circles.md).

#### Follow graph, blocking, discovery

| RPC | Signature | Response | Errors / notes |
|---|---|---|---|
| `get_public_profile_by_username` | `(p_username text) → jsonb` | `null` or `{profile:{userId, username, displayName, bio, avatarUrl}, stats?:{booksRead, totalPagesRead, currentStreakDays, longestStreakDays}, currentlyReading?:{bookId, title, author, coverUrl, currentPage, totalPages, percentage}, lexiconHighlights?:[{term, bookTitle, masteredAt}], readerDna?:{personality, moodTone, moodEmojis[]}}` | `null` when unknown username (exact lowercase match), no privacy row, a block either way, or private and not owner. Sections are **omitted** (not null) when hidden or empty. Owner sees everything. `stats` includes imported and DNF books; streaks are UTC. `currentlyReading` = most recently updated book with `0 < current_page < total_pages` (DNF not excluded). `lexiconHighlights` = 6 newest entries with `leitner_box ≥ 5` (not `mastered`), quotes included, `masteredAt` = entry `created_at`. |
| `search_community_readers` | `(p_query text, p_limit int = 20, p_cursor text = null) → jsonb` | `{items:[{userId, username, displayName, bio, avatarUrl, isFollowing, followsViewer, followersCount, followingCount}], nextCursor}` | Query `lower(trim)`; < 2 chars → empty. Prefix match on username or whole display name; `%`/`_` not escaped (act as wildcards). Excludes self, private, blocked pairs. Order `created_at DESC, user_id DESC`; limit 1–50. |
| `follow_community_user` | `(p_target_user_id uuid) → jsonb` | relationship payload + `changed` | `not_authenticated`. Inserts only when reason = `allowed`; otherwise `changed:false` (no error). Idempotent. |
| `unfollow_community_user` | `(p_target_user_id uuid) → jsonb` | relationship payload + `changed` | `not_authenticated` |
| `block_community_user` | `(p_target_user_id uuid) → jsonb` | `{targetUserId, isBlockedByViewer:true, removedFollowsCount, changed}`; self → `{…, isBlockedByViewer:false, removedFollowsCount:0, changed:false, reason:'self'}` | `not_authenticated`; raw `23503` unknown user; raw `23502` null. `removedFollowsCount` is always 0 for a new block (the trigger already removed the follows). Side effects in §9. |
| `unblock_community_user` | `(p_target_user_id uuid) → jsonb` | `{targetUserId, isBlockedByViewer:false, changed}` | Follows and memberships are not restored. |
| `get_community_relationship_state` | `(p_target_user_id uuid) → jsonb` | `{targetUserId, isFollowing, followsViewer, isBlockedByViewer, hasBlockedViewer, followersCount, followingCount, canInteract, reason}` | Counts are real only when reason ∈ {`allowed`, `self`}, else 0. |
| `can_community_users_interact` | `(p_target_user_id uuid) → jsonb` | `{targetUserId, allowed, reason}` | Reason order: null ids → `profile_unavailable`; same user → `self`; block → `blocked`; not viewable → `profile_unavailable`; else `allowed`. |
| `list_community_followers` / `list_community_following` | `(p_user_id uuid, p_limit int = 20, p_cursor text = null) → jsonb` | `{items:[{userId, username, displayName, avatarUrl, followedAt, isFollowing}], nextCursor}` | Empty unless the viewer can view the target. Lists only users with a public profile and no block with the viewer. Order `followed_at DESC, user_id DESC`; limit 1–50. |
| `list_my_blocked_users` | `(p_limit int = 20, p_cursor text = null) → jsonb` | `{items:[{userId, username?, displayName?, avatarUrl?, blockedAt}], nextCursor}` | Own blocks; includes profile-less users. |
| `get_also_reading_for_book` | `(p_book_id uuid, p_isbn text = null, p_limit int = 3, p_cursor text = null) → jsonb` | `{items:[{userId, username, displayName, avatarUrl, matchType, matchedBookId, matchedIsbn?, currentPage?, totalPages?, percentage?, relativeStatus, updatedAt}], nextCursor, totalVisible}` | `not_authenticated`, `invalid_cursor` (raised even before auth). Population = users the viewer **follows** whose profile is viewable and `currently_reading_visibility` ∈ {everyone, followers}, mid-book (`0 < current_page < total_pages`, DNF included) on the same book id or normalised ISBN (in practice always `same_isbn`). Progress fields only when `progress_visibility` ∈ {everyone, followers}. `relativeStatus`: `same_area` if the percentage gap is ≤ 10 points, else `ahead`/`behind`, null when unknown. Limit 1–20. Null/unowned book → empty. |

#### Reading circles

| RPC | Signature | Response | Errors |
|---|---|---|---|
| `create_reading_circle` | `(p_book_id uuid, p_name text, p_invited_user_ids uuid[] = '{}') → jsonb` | `{circleId, created:true, invitedUserIds[], skippedUserIds[]}` | `not_authenticated`, `invalid_circle_name` (trimmed 1–80), `invalid_book` (not the caller's). Invitees accepted only if the creator follows them and no block exists. |
| `invite_reading_circle_members` | `(p_circle_id uuid, p_user_ids uuid[]) → jsonb` | `{circleId, invitedUserIds[], skippedUserIds[]}` | `not_authenticated`, `not_circle_owner` (active circle). An existing pending invitation is still reported as invited. |
| `respond_to_reading_circle_invitation` | `(p_invitation_id uuid, p_accept bool) → jsonb` | `{circleId, invitationId, status:'accepted'\|'declined', member:{userId, role:'member', joinedAt}\|null}` | `not_authenticated`, `invitation_not_pending`, `circle_not_active`, `circle_full` (≥ 10 members), `blocked`. `p_accept` null = decline. |
| `leave_reading_circle` | `(p_circle_id uuid) → jsonb` | `{circleId, left:true, newOwnerId\|null}` | `not_authenticated`, `not_circle_member`. An owner leaving promotes the earliest-joined member; nobody left → `closed`. |
| `remove_reading_circle_member` | `(p_circle_id uuid, p_user_id uuid) → jsonb` | `{circleId, userId, removed, revokedInvitation}` | `not_authenticated`, `not_circle_owner`, `use_leave_circle` (self) |
| `get_reading_circle_detail` | `(p_circle_id uuid) → jsonb` | `null` or `{circleId, name, book:{bookId, title, author, coverUrl, normalizedIsbn}, viewer:{role, currentPage, totalPages, normalizedLocation}, members:[{userId, username, displayName, avatarUrl, role, joinedAt}], pendingInvitations:[{invitationId, userId, username, displayName, avatarUrl, status, createdAt}] (owner only), createdAt}` | `not_authenticated`. `book.bookId` is the **creator's** book; no viewer book id, `status`, `ownerId` or `memberCount`; profile-less members omitted; owner listed last. |
| `list_my_reading_circles` | `(p_limit int = 20, p_cursor text = null) → jsonb` | `{items:[{type:'circle', circle:{circleId, name, book:{…}, memberCount, pendingInviteCount, latestReactionAt:null}, viewerRole} \| {type:'invitation', invitationId, circle:{…, memberCount}, invitedBy:{userId, username, displayName, avatarUrl}}], nextCursor}` | `not_authenticated`; raw `22007`/`22008` on a bad cursor. Returns up to `limit + 1` items. |
| `add_circle_reaction` | `(p_circle_id uuid, p_book_id uuid, p_source_page int, p_content text) → jsonb` | `{reactionId, circleId, normalizedLocation, createdAt}` | Order: `not_authenticated` → `not_circle_member` → `blocked` → `invalid_reaction_content` (trimmed 1–280) → `invalid_circle` → `invalid_book` (caller's book matching the circle by id or ISBN) → `invalid_page` (1…total) → `invalid_progress` (no progress or page 0) → `reaction_ahead_of_progress` (`normalized_location = round(page / total × 100, 3)` must be ≤ the caller's own location). Null page → raw `23502`. |
| `get_visible_circle_reactions` | `(p_circle_id uuid, p_min_location numeric = null, p_max_location numeric = null, p_limit int = 50, p_cursor text = null) → jsonb` | `{items:[{reactionId, circleId, author:{userId, username, displayName, avatarUrl}, content, sourcePage, sourceTotalPages, normalizedLocation, viewerEquivalentPage, createdAt}], nextCursor, viewerProgressMissing}` | Spoiler gate: `normalized_location` BETWEEN `max(p_min, 0)` and `min(p_max, viewer location, 100)`, authors blocked either way and profile-less authors excluded. `viewerEquivalentPage = clamp(ceil(location / 100 × viewer total), 1, viewer total)`. Non-member, blocked, closed and no-progress all return `{items:[], nextCursor:null, viewerProgressMissing:true}`. Limit 1–100. |

#### Cursor formats (opaque — pass back verbatim)

| RPCs | Format | Invalid cursor | Paging defect |
|---|---|---|---|
| search, followers, following, blocked | base64 of JSON `{"userId", "createdAt"}` (Postgres inserts a newline every 76 chars) | Silently treated as no cursor (page 1 again); valid JSON missing keys → empty page | None (cursor = last returned item) |
| `get_also_reading_for_book` | base64 JSON `{"updatedAt", "userId"}` | `invalid_cursor` | Cursor encodes row `limit + 1`: one item skipped per page |
| `get_visible_circle_reactions` | `created_at::text` | raw `22007`/`22008` | Row `limit + 1` skipped; same-timestamp ties dropped |
| `list_my_reading_circles` | `sort_at::text` | raw `22007`/`22008` | Returns `limit + 1` items; ties dropped |

### 8.7 Exposed internal functions

Every `public` function is reachable at `/rest/v1/rpc/<name>`. Trigger functions fail with "trigger functions can only be called as triggers". The non-trigger helpers (`prune_page_captures_for_book`, `community_remove_pair_follows`, `circle_progress_location`, `community_relationship_payload`, …) are **not** part of the contract; several are dangerous today. They are catalogued with their grants in §9.2 and §12.

### 8.8 Error codes (all RPCs)

| Code (message) | Raised by |
|---|---|
| `Not allowed` | `get_reading_quest_summary` (another signed-in user) |
| `Not authenticated`, `Weekly goal must be between 1 and 7` | `upsert_weekly_goal` |
| `not_authenticated`, `username_invalid`, `bio_too_long`, `visibility_invalid`, `username_taken` | `upsert_my_community_profile` |
| `not_authenticated`, `not_circle_member`, `not_circle_owner`, `blocked`, `circle_full`, `invalid_circle`, `invalid_circle_name`, `invalid_book`, `invalid_page`, `invalid_progress`, `invalid_reaction_content`, `reaction_ahead_of_progress`, `use_leave_circle`, `invitation_not_pending`, `circle_not_active`, `invalid_cursor` | community / circle RPCs |
| `p_keep must be at least 1` | `prune_page_captures_for_book` (internal) |
| SQLSTATE `22023` | any `AT TIME ZONE` with an unknown IANA name |

---

## 9. Triggers & internal functions

### 9.1 Triggers (14, all row-level, enabled)

| Trigger | Table | Timing / events | Function | Effect |
|---|---|---|---|---|
| `reading_progress_updated_at` | `reading_progress` | BEFORE UPDATE (any column) | `set_updated_at()` | `updated_at = now()` |
| `page_captures_delete_on_completion` | `reading_progress` | AFTER INSERT OR UPDATE OF `current_page` | `delete_page_captures_on_book_completion()` (definer) | Delete the user's captures for the book when `current_page ≥ total_pages > 0` |
| `book_quizzes_delete_on_completion` | `reading_progress` | AFTER INSERT OR UPDATE OF `current_page` | `delete_book_quizzes_on_book_completion()` (definer) | Delete the book's quiz under the same condition |
| `page_capture_quest_event_after_save` | `page_captures` | AFTER INSERT OR UPDATE | `record_page_capture_quest_event()` (definer) | Upsert the `page_capture` quest event (keep the first `source_id` and the earliest `occurred_at`), then delete **all** captures of the book if it is already complete (inner join `books ⋈ reading_progress`; no progress row → nothing purged) |
| `set_reading_goals_updated_at` | `reading_goals` | BEFORE UPDATE | `set_reading_goals_updated_at()` | `updated_at = now()` |
| `community_profiles_touch_updated_at` | `community_profiles` | BEFORE UPDATE | `community_profiles_touch_updated_at()` | `updated_at = now()` |
| `community_profile_privacy_touch_updated_at` | `community_profile_privacy` | BEFORE UPDATE | `community_profiles_touch_updated_at()` | `updated_at = now()` |
| `community_ensure_count_on_profile_insert` | `community_profiles` | AFTER INSERT | `community_ensure_count_on_profile_insert()` (definer) | Create a `(0, 0)` follow-count row (no backfill of existing follows) |
| `community_follow_counts_after_follow_insert` | `follows` | AFTER INSERT | `community_follow_counts_after_follow()` (definer) | +1 following / +1 followers (only for users with a profile) |
| `community_follow_counts_after_follow_delete` | `follows` | AFTER DELETE | same | −1, floored at 0 |
| `circle_block_cleanup_memberships` | `blocks` | AFTER INSERT | `circle_block_cleanup_memberships()` (definer) | Delete pending invitations between the pair in circles where the other is a member; delete the **blocked** user from every circle the blocker belongs to (even the owner); close **every** active circle with zero members (global sweep) |
| `community_block_cleanup_follows` | `blocks` | AFTER INSERT | `community_block_cleanup_follows()` (definer) | Delete follows in both directions |
| `reading_circles_touch_updated_at` | `reading_circles` | BEFORE UPDATE | `circle_touch_updated_at()` | `updated_at = now()` |
| `circle_members_assert_insert` | `circle_members` | BEFORE INSERT | `circle_assert_member_insert()` (definer) | Raise `circle_full` at ≥ 10 members, `blocked` if any member has a block with the new member (no lock: concurrent accepts can exceed 10) |

No triggers exist on `auth.users`, `books`, `progress_history`, `recaps`, `lexicon_entries`, `lore_cards`, `book_quizzes`, `up_next_order` or `user_settings`. Trigger functions fire regardless of `EXECUTE` grants (Postgres checks `EXECUTE` only when a trigger is created).

### 9.2 Internal functions and their grants

Since BC-01 (2026-10-19) **no client role can execute any function in this table**: `anon` and `PUBLIC` have no `EXECUTE` on any `public` function, and `authenticated` has `EXECUTE` only on the client allowlist (§8.1 RPCs, the dormant community/circle RPCs in §8, and `normalize_isbn`). `service_role` keeps its grants. The definer RPCs that call these helpers run as the owner (`postgres`), so they are unaffected.

| Function | Definer | Purpose / risk | Status |
|---|---|---|---|
| `set_updated_at`, `set_reading_goals_updated_at`, `community_profiles_touch_updated_at`, `circle_touch_updated_at` | no | Trigger functions | Not client-executable (BC-01) |
| `delete_page_captures_on_book_completion`, `delete_book_quizzes_on_book_completion`, `record_page_capture_quest_event`, `community_follow_counts_after_follow`, `community_block_cleanup_follows`, `community_ensure_count_on_profile_insert`, `circle_assert_member_insert`, `circle_block_cleanup_memberships` | yes | Trigger functions | Not client-executable (BC-01) |
| `after_page_capture_saved()` | — | Was dead (attached to nothing) | **Dropped** (BC-01) |
| `prune_page_captures_for_book(…)` | — | Was destructive with no identity check | **Dropped** (BC-01). Recreate in `private` if a capture-retention cap is ever decided. |
| `community_remove_pair_follows(p_user_a uuid, p_user_b uuid) → int` | yes | Deletes any follow edge between two users; called by `block_community_user` and the block trigger | Not client-executable (BC-01) |
| `community_ensure_follow_count(p_user_id uuid) → void` | yes | Inserts a zero row for a user who has a profile | Not client-executable (BC-01) |
| `community_reconcile_follow_counts() → void` | yes | Recomputes every counter from `follows`. Never scheduled. | Service role only (BC-01) |
| `circle_progress_location(p_circle_id uuid, p_user_id uuid)` | yes | Would leak any user's progress for books matching a circle's ISBN | Not client-executable (BC-01) |
| `community_relationship_payload`, `community_has_block_between` (true when either is NULL), `community_interaction_reason`, `community_can_view_profile` | yes | Would reveal follow/block edges between arbitrary users | Not client-executable (BC-01) |
| `circle_user_is_member`, `circle_user_is_owner`, `circle_member_count`, `circle_members_have_block`, `circle_book_matches`, `circle_users_can_share` (unused) | yes | Used inside circle RPCs; oracles when called directly | Not client-executable (BC-01); the RLS policies now use `private.is_circle_member/owner` |
| `community_cursor_payload(text)`, `community_encode_cursor(timestamptz, uuid)`, `also_reading_cursor_payload(text)`, `also_reading_encode_cursor(timestamptz, uuid)` | no | Cursor helpers | Not client-executable (BC-01) |
| `private.assert_is_caller(p_user_id uuid) → void` | no (invoker) | Raises `42501 not_allowed` unless `auth.uid()` is set and equals `p_user_id`. Called first by the owner-checked RPCs. | Not client-executable |
| `private.is_circle_member(p_circle_id uuid)`, `private.is_circle_owner(p_circle_id uuid) → boolean` | yes | Active-membership / ownership of the **caller** (`auth.uid()`); used by the `reading_circles`, `circle_members`, `circle_invitations` SELECT policies | `authenticated` only |
| `normalize_isbn(p_isbn text) → text` | no (IMMUTABLE) | `nullif(upper(regexp_replace(coalesce(p,''), '[^0-9X]', '', 'g')), '')`. The regex runs before `upper`, so a lowercase `x` is deleted. Used by the books functional index and community matching. | `authenticated` (allowlist). BC-15 normalises at write time. |

**Deviation from the plan (BC-01.5):** the helpers were not moved into the `private` schema. About thirty community RPCs call them by their schema-qualified names (`public.community_…(`), so moving them would mean rewriting every caller. Revoking `EXECUTE` closes the same hole. The one visible difference: a direct `/rest/v1/rpc/<helper>` call returns 401/403 (`42501`) instead of 404.

---

## 10. Edge functions

### 10.1 Overview

| Slug | Deployed | `verify_jwt` | In-function auth | PWA transport | Models | Env vars (names) | Repo vs deployed |
|---|---|---|---|---|---|---|---|
| `generate-recap` | v86 | true | gateway + `requireUser` (`supabase.auth.getUser`, BC-02) | raw `fetch` (no `apikey`) | `gemini-2.5-flash`, `gemini-2.5-pro` (+ Google Search), OpenAI `gpt-image-2` | `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Identical (deployed from the repo 2026-10-19) |
| `generate-lore` | v20 | true | gateway + `requireUser` (BC-02) | raw `fetch` | `gemini-2.5-flash` | `GEMINI_API_KEY` | Identical (repo synced to v18 per D-09, then deployed from the repo) |
| `ocr-page` | v4 | true | gateway + `requireUser` (BC-02) | raw `fetch` | `gemini-2.5-flash` (multimodal) | `GEMINI_API_KEY` | Identical (deployed from the repo 2026-10-19) |
| `extract-vocabulary` | v2 | true | gateway verifies; function decodes `sub` | `functions.invoke` | `gemini-2.5-flash` | `GEMINI_API_KEY` | Identical |
| `generate-reading-dna` | v8 | true | gateway + decode | `functions.invoke` | `gemini-2.5-flash` + Google Search tool | `GEMINI_API_KEY` | **Differs** — deployed is canonical (D-09) |
| `generate-page-resume` | v3 | true | gateway + decode | `functions.invoke` | `gemini-2.5-flash` | `GEMINI_API_KEY` | Identical |
| `generate-book-quiz` | v1 | true | gateway + decode | `functions.invoke` | `gemini-2.5-flash` | `GEMINI_API_KEY` | Identical |

Common rules:

- `POST` + `OPTIONS` (CORS `Access-Control-Allow-Origin: *`, allowed headers `authorization, x-client-info, apikey, content-type`, methods `POST, OPTIONS`; no `Access-Control-Expose-Headers`). All Gemini calls use `npm:@google/genai` **unpinned** (resolved at deploy).
- Send `Authorization: Bearer <user access token>` (and `apikey`, which `functions.invoke` adds). Every function runs with `verify_jwt = true` (committed in `supabase/config.toml`, BC-02): the gateway rejects a missing, forged, foreign-key or expired token **before** the function runs, with its own body — `401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}` or `401 {"code":"UNAUTHORIZED_LEGACY_JWT","message":"Invalid JWT"}` (verified 2026-10-19). Treat any 401 as "refresh the session and retry once".
- `generate-recap`, `generate-lore` and `ocr-page` additionally verify the caller in code with `requireUser` (`supabase/functions/_shared/auth.ts`, `supabase.auth.getUser`): signature, expiry and that the user still exists. The anon key as Bearer is rejected (no user). The other four functions still decode `sub` locally behind the gateway check (safe, but to be moved to `requireUser`; BC-02 follow-up).
- Every function is stateless except the `recap_image` job: clients persist all results (`recaps`, `lore_cards`, `page_captures.resume`, `book_quizzes`, `reading_dna`, `book_passports`, lexicon rows). No function enforces per-user rate limits, quotas or entitlements (BC-12).

Soft- vs hard-failure semantics:

| Function | On AI / config failure |
|---|---|
| `extract-vocabulary` | **200** `{"words": []}` (indistinguishable from "no qualifying words") |
| `generate-page-resume` | **200** `{"resume": null}` |
| `generate-book-quiz` | **200** `{"quiz": null}` |
| `ocr-page` | Hard errors (502/503/504); but a model JSON missing `text`/`confidence` returns **200** with `text: ""` / `confidence: 0` — route to manual review (empty text cannot be saved) |
| `generate-recap`, `generate-lore`, `generate-reading-dna` | Hard errors (JSON body, non-2xx) |

### 10.2 `generate-recap` (v86, `verify_jwt: true`)

Routing (`router.ts`): `mode === "recap_image"` → image job; `mode === "passport_summary"` → passport; `currentPage === 0` (strict) → pre-start blurb; anything else → mid-book recap (a body without `currentPage` routes to recap). Check order: gateway JWT check (401) → method (`405` unless `POST`) → Authorization header (401) → `requireUser` (401) → `req.json()` (malformed JSON → `400 {"error":"invalid_input"}`) → field validation (400) → `GEMINI_API_KEY` (503, all modes) → `OPENAI_API_KEY` (image) → (image mode) recap ownership (404) → dispatch.

**Text modes request**

```json
{ "title": "string", "author": "string", "isbn": "string|null",
  "percentage": 37.45, "currentPage": 112, "totalPages": 300,
  "from_page": 80,                                  // optional; previous recap's page; omit when 0
  "captures": [{ "page": 104, "text": "…" }],      // optional; non-empty → corpus path
  "mode": "passport_summary" }                      // only for the passport
```

Required: truthy `title`, `author`, `totalPages` and a defined `percentage` (also for `passport_summary`), else `400 {"error":"Missing required fields"}`. The server does not filter `captures` by page range (the client sends `from_page < page ≤ currentPage`; the PWA sends at most the 3 highest-page captures of the window, ascending) and does not cap capture length.

**Text modes success — streaming format**: `200`, `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache`, chunked raw model text — **not SSE, no framing**. The corpus path adds header `X-Recap-Mode: corpus` (readable by native clients; invisible to browsers). Blurb/recap bodies are the text of one JSON object, possibly fenced:

```json
{ "memory_jogger": "2–4 plain sentences, ≤90 words (blurb: ≤600 chars)",
  "concept_watchlist": "a, b, c (≤5 items; blurb ≤13 names)",
  "thematic_bridge": "1–2 sentences: the open thread" }
```

The passport body is plain prose (one 90–100-word paragraph). The server does **not** validate the streamed JSON. Clients accumulate the whole body, strip ``` fences or take the first `{…}`, `JSON.parse`, and require all three keys non-empty. A mid-stream failure arrives as a read error / truncated body after a 200. The server does not observe client disconnects; upstream calls already issued are not cancelled.

**Paths and models**

| Path | Behaviour |
|---|---|
| Inferred (no captures) | Extraction with `gemini-2.5-pro`, temperature 0.0, 8 192 tokens, `googleSearch` tool (+ a top-level `dynamicRetrievalConfig` that 2.5 models ignore), non-streaming. Retried while the result is unparseable or `confidence_level = "low"` (a missing confidence is accepted): up to 2 retries (≤ 3 calls), each lowering the page by 5 × attempt but never below `from_page + 1`. The prompt stops 15–20 % before the reader's page (or at `round(percentage × 0.8)` % without a chapter map). Then the composer streams with `gemini-2.5-flash`, temperature 0.7, 4 096 tokens, `thinkingBudget 0`. **No bytes are sent until extraction finishes.** The composer receives the extractor's raw JSON verbatim, including its `_internal_audit` (ending-to-avoid) block. |
| Corpus (captures) | Composer only (same model/params), framed as "what happened in this stretch", ~0.4 s to first token |
| Blurb (`currentPage === 0`) | `gemini-2.5-flash`, 0.7, 4 096, `thinkingBudget 0`; title/author/ISBN only |
| Passport | `gemini-2.5-flash`, 0.8, 4 096, `thinkingBudget 0`; plain-text stream |

**Errors** (JSON + CORS)

| Status | Body | When |
|---|---|---|
| 401 | Gateway body (§10.1), or `{"error":"No authorization header"}` / `{"error":"Unauthorized"}` | Missing or invalid token |
| 405 | `{"error":"Method not allowed"}` | Not `POST` |
| 400 | `{"error":"invalid_input"}` / `{"error":"Missing required fields"}` / `{"error":"Missing required image fields"}` | Malformed JSON / validation |
| 404 | `{"error":"recap_not_found"}` | Image mode: `recapId` is not a recap of the caller (checked before any AI call) |
| 503 | `{"error":"AI service not configured"}` / `"OpenAI image service not configured"` / `"Supabase admin client not configured"` | Missing env |
| 500 | `{"error":"AI output invalid","detail":"Provider safety block"\|"Low extraction confidence after retries"\|"No JSON block found in response"\|"Recap composition failed","finishReason"?,"blockReason"?}` | Inferred/corpus failures **before** streaming starts; a safety block is terminal (no retry) |
| 500 | `{"error":"Internal server error","requestId":"uuid"}` | Uncaught errors (e.g. blurb/passport stream-start failure). Details are logged server-side under `requestId` only (BC-02). |
| 5xx gateway | Platform body | A slow inferred path exceeding platform limits before the first byte [UNVERIFIED] |

**Image mode (`recap_image`) — the 202 job**

- Request: `{ "mode": "recap_image", "recapId": "uuid", "title": "…", "author": "…|null", "genre": "…|null", "memoryJogger": "…", "fromPage": 80, "currentPage": 112, "textStageDurationMs": 1234 }` (`fromPage`/`currentPage`/`textStageDurationMs` optional). Requires truthy `recapId`, `title`, `memoryJogger`.
- Response: **`202 {"status":"accepted"}`** immediately; the work continues in `EdgeRuntime.waitUntil`. The result arrives only through the `recaps` row (§4.10).
- Job: set `image_status = 'pending'`, `image_path = null`, `image_generated_at = null` → refine the prompt with `gemini-2.5-flash` (temperature 0.4, 4 096 tokens, no thinking override; input = title, author, genre, `memoryJogger` only; deterministic fallback prompt on error or empty output) → OpenAI `POST https://api.openai.com/v1/images/generations` `{model:"gpt-image-2", size:"1024x1024", quality:"low", n:1}` (base64 response) → upload `recap-images/{sub}/{recapId}.png` (upsert) → `succeeded` + `image_path` + `image_generated_at`.
- Errors: HTTP 429/5xx → transient; message matching `/safety|policy|moderation|content policy|blocked/i` → safety; anything else → transient. One retry: safety → re-refine with a "softer" prompt; transient → wait 2 000 ms, same prompt. Final failure → `failed_safety` or `failed_transient`.
- Before the job starts, the function checks with the service role that `recaps.id = recapId AND user_id = <verified caller>`; otherwise it returns `404 recap_not_found` and makes no AI call or upload (BC-02). All job updates use the **service role** scoped the same way. The job has `try/finally` without `catch`: an upload or DB exception leaves the row `pending` while the log reports `failed_transient`.
- Structured logs: `[generate-recap] {stage, attempt, finishReason, blockReason, safetyRatings, usage, rawTextLength, rawTextPreview}` on failures; image summary `{recap_id, text_stage_duration_ms, image_stage_duration_ms, transient_retry_used, safety_retry_used, final_image_status}`.

Planned: BC-07 (server-side eligibility: +5 % pages / 6 h cooldown / 72 h idle on the server clock; server-side corpus window; the function persists and returns the validated `recaps` row; once paid, finish and save), BC-12 (entitlement/usage check), BC-13 (job error handling, stale `pending`).

### 10.3 `generate-lore` (v20, `verify_jwt: true`)

- Request: `{ "title", "author", "isbn"?: "string|null", "currentPage", "totalPages", "percentage", "milestone": 10…90 (step 10; `Number()`-coerced, so "50" passes), "masterRecap": "non-blank string", "existingTopics"?: ["titles of this book's existing cards"] }`. All of `title, author, currentPage, totalPages, percentage, milestone, masterRecap` must be non-null; numeric types and string lengths are not validated.
- Response `200`: `{ "title": "3–8 words", "content": "90–160 words", "type": "History|Culture|Geography|Technology|Lore", "linked_entities": ["≤5 names from the recap"] }` — exactly these four fields, trimmed. The function never writes `lore_cards`; it does not return page or milestone (the client adds them). Not idempotent; no server dedupe.
- Errors: `400 {"error":"Missing required fields"}` (also invalid JSON) · `401` gateway body or `{"error":"Unauthorized"}` · `405 {"error":"Method not allowed"}` · `503 {"error":"AI service not configured"}` · `500 {"error":"AI output invalid","detail":"No JSON block found in response"|"Response was not valid JSON"|"Response failed shape validation","finishReason"?,"blockReason"?}` · `500 {"error":"Internal server error","requestId"}` (e.g. a non-array truthy `existingTopics`; no internal text since BC-02). No soft-failure 200.
- Model (deployed, canonical per D-09): `gemini-2.5-flash`, non-streaming, temperature **0.35**, 4 096 tokens; **accuracy-first** prompt ("canonical context … do NOT invent", draw from the author's established lore and companion materials, match the author's prose style); `thinkingBudget: 1000` + `includeThoughts: true` are placed at the `config` root instead of inside `thinkingConfig`, so thinking runs at the model default. The repo source was synced to v18 on 2026-10-19 (D-09); the misplaced thinking config is unchanged and still to be fixed in BC-03.
- Data sent to Google: title, author, ISBN, page numbers, the reader's recap text, prior card titles. Planned: BC-08 (server-side orchestration with recap → captures → metadata fallback, spoiler-guarded; insert `ON CONFLICT DO NOTHING`; clients only list and mark seen).

### 10.4 `ocr-page` (v4, `verify_jwt: true`)

- Request: `{ "imageBase64": "<raw base64, no data: prefix>", "mimeType": "image/jpeg" | "image/png" }`.
- Validation order: auth → body JSON (`400 InvalidRequest "Body must be JSON"`) → `imageBase64` non-empty (`"imageBase64 missing or invalid"`) → MIME (`"mimeType must be image/jpeg or image/png"`) → decoded size `floor(len × 3/4) − padding ≤ 5 MiB` (`"Image exceeds 5 MB limit"`) → `GEMINI_API_KEY`.
- Model: `gemini-2.5-flash`, temperature 0.1, 8 192 tokens, `thinkingBudget 0`. The prompt excludes printed page numbers, running headers/footers, footnote markers and ornaments; it asks for `{text, confidence 0–1 (self-assessed), notes?}` with bands 0.95–1 clean / 0.70–0.94 minor / 0.40–0.69 review / 0–0.39 retake.
- Response `200`: `{ "text": "string", "confidence": 0.0–1.0 (clamped; missing → 0), "wordCount": int (whitespace split) }`; `notes` discarded. Image bytes are never persisted.
- Errors (all `{error, message}`, except the gateway's own 401 body): `401 Unauthorized` ("Missing or invalid JWT"), `405 MethodNotAllowed` (not `POST`), `400 InvalidRequest`, `503 AiUnavailable`, **`504 OcrTimeout`** ("OCR took too long; please try again" — one 10 s budget covers both attempts; the timed-out call is not aborted), **`502 OcrUpstream`** ("Gemini call failed after retry" — one retry on any first-attempt error), `500 InternalError`. Expired or forged tokens are rejected (gateway + `requireUser`, BC-02).
- Client thresholds (PWA): auto-save at `confidence ≥ 0.90` with non-empty text; review otherwise; warning banner below 0.70. These are Gemini-calibrated. iOS uses on-device Apple Vision first and falls back to `ocr-page` on low confidence; the thresholds must be recalibrated for Vision (D-15).

### 10.5 `extract-vocabulary` (v2, `verify_jwt: true`)

- Request: `{ "ocrText": "non-blank string" }` (no length cap in the function; captures are ≤ 10 000 chars).
- Response `200`: `{ "words": [{ "word": "string (trimmed, length > 1)", "definition": "non-empty string" }] }`, 0–5 items. Also `200 {"words": []}` when the key is missing, the model output has no/invalid JSON, or anything throws.
- Errors: `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}` (valid JWT without `sub`), `405 {"error":"Method not allowed"}`.
- Model: `gemini-2.5-flash`, temperature 0.4, 1 024 tokens, `thinkingBudget 0`; up to 5 uncommon/literary words, excluding proper nouns and common words; one-sentence definitions in passage context.
- Never writes the DB and never dedupes against the user's lexicon. The client owns the `vocabulary_extractions` ledger (`pending` → `succeeded`/`skipped`/`failed`), proper-noun filtering, case-insensitive dedupe and the `lexicon_entries` insert (`source='auto'`, box 1, `next_review_at` = UTC date of now + 24 h). Returned words longer than 200 chars would fail the term CHECK and the whole batch.

### 10.6 `generate-page-resume` (v3, `verify_jwt: true`)

- Request: `{ "pageText": "non-blank string", "recapContext"?: "string" }` (`recapContext` must be a string if present — JSON `null` → 400). Server truncates `pageText` to 12 000 chars and `recapContext` to 800.
- Response `200`: `{ "resume": { "bullets": ["1–3 one-sentence strings, ≤240 chars"], "tension": "≤240 chars, may be empty" } | null }`. `null` when the page is insufficient, the key is missing, the model fails or the output is unparseable (at least one non-empty bullet is required).
- Errors: `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}`, `405`.
- Model: `gemini-2.5-flash`, temperature 0.3, 512 tokens, `thinkingBudget 0`; only the page text, the prior recap only for names, no predictions. No retry, no server timeout.
- The client persists `page_captures.resume` + `resume_generated_at` (only when bullets are non-empty) and treats `resume IS NOT NULL` as "generated once".

### 10.7 `generate-book-quiz` (v1, `verify_jwt: true`)

- Request: `{ "captures": [{ "page": number, "text": "non-blank" }, …≥1], "recapContext"?: "string" }`. Every capture must be valid or the whole request is `400 invalid_input`. The server uses only the **last 6 array elements as sent** (send in reading order), each truncated to 6 000 chars; recap ≤ 800.
- Response `200`: `{ "quiz": { "questions": [{ "question": "≤240 chars", "options": ["3 strings ≤120 chars"], "correctIndex": 0|1|2, "sourcePage": number|null }] } | null }`. 1–3 questions (invalid ones are filtered, not repaired); options are shuffled server-side (Fisher–Yates) with `correctIndex` remapped. `null` on missing key, parse failure or insufficient material.
- Errors: `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}`, `405`.
- Model: `gemini-2.5-flash`, temperature 0.4, 1 024 tokens, `thinkingBudget 0`; questions only from the provided text. No retry, no server timeout. The client upserts `book_quizzes` (`onConflict user_id,book_id`).

### 10.8 `generate-reading-dna` (v8, `verify_jwt: true`)

- Request: `{ "books": [{ "title": "string", "author": "string" }, …≥1] }` (no upper bound, no per-entry validation).
- Response `200`: `{ "personality": "50–800 chars", "moodSignature": { "tone": "1–40 chars", "emojis": ["1–5 strings"] }, "suggestions": [{ "title", "author", "reason" }] (3–5), "booksFinishedAtGeneration": books.length, "generatedAt": "server ISO timestamp" }`. Length checks use JS UTF-16 `.length`; the DB CHECKs use code points.
- Errors: `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}`, `405 {"error":"Method not allowed"}`, **`502 {"error":"ai_unavailable"}`** (missing key, no JSON, parse error, invalid shape), `500 {"error":"internal"}`.
- Model (deployed, canonical per D-09): `gemini-2.5-flash`, temperature 0.85, 2 048 tokens, `thinkingConfig.thinkingBudget 1`, **`tools: [{googleSearch: {}}]`** (Google Search grounding) and a top-level `dynamicRetrievalConfig` (misplaced; probably ignored by 2.5 models [UNVERIFIED: runtime effect not observable via SQL/MCP]). The repo copy has `thinkingBudget 0` and no tools; sync it to deployed (BC-03).
- Stateless; the client upserts `reading_dna` (`onConflict user_id`). Eligibility (≥ 2 finished books; regenerate after +2 books or 90 days) is client-side today; BC-05 moves DNA eligibility server-side.

### 10.9 Planned edge functions

| Function | Purpose | Work package |
|---|---|---|
| `delete-account` | Purge `recap-images/{uid}/` and `community-avatars/{uid}/`, revoke the Sign in with Apple token, `auth.admin.deleteUser`; confirm + re-auth (D-10) | BC-11 |
| Book-search proxy | Hide the Google key, cache, rate-limit for multi-client traffic | BC-15 |
| Storage cleanup / orphan sweep | Delete recap images on recap/book delete | BC-13 |
| Shared entitlement + AI-usage check in every AI function | Allow-all until tiers are decided (D-14) | BC-12 |

---

## 11. External APIs (client-side)

Clients call these directly; no Supabase involvement. They are unauthenticated except the optional Google key.

| API | Endpoint | Parameters | Used for | Fallback / failure |
|---|---|---|---|---|
| Google Books search | `GET https://www.googleapis.com/books/v1/volumes` | `q` (free text, or `isbn:{digits}` when the query matches an ISBN after stripping `-`/whitespace), `startIndex = (page − 1) × 20`, `maxResults = 20`, `printType = books`, `langRestrict = {device language, 2 letters}` (omitted for ISBN queries), `key?` | Add-book search, import fallback, description backfill, DNA recommendation covers | Non-OK (403/429/5xx) → treated as no results; no retry/backoff on 429 |
| Google Books ISBN lookup | same, `q = isbn:{clean}`, `key?` (no `printType`/`langRestrict`) | | Barcode scan, typed ISBN, import enrichment | No hit → full Open Library fallback; incomplete hit → Open Library gap-fill field by field |
| Google Books volume | `GET https://www.googleapis.com/books/v1/volumes/{id}` | `key?` | Book details page | Failure → blank draft |
| Google Books recommendations | `volumes` | up to 3 `q = subject:"…"` (else `subject:"{genre}"`, else `inauthor:"{author}"`), `startIndex = random 0–7`, `maxResults = 24`, `printType = books`, `orderBy = relevance`, `langRestrict`, `key?` | "More … books" | A failed query skips to the next one |
| Open Library books | `GET https://openlibrary.org/api/books` | `bibkeys = ISBN:{isbn}`, `format = json`, `jscmd = data` | ISBN fallback / gap-fill (author, cover large→medium→small, `number_of_pages`, subjects; never a description) | — |
| Open Library search | `GET https://openlibrary.org/search.json` | `title`, `author`, `limit = 3`, `fields = cover_i` | DNA recommendation covers when Google finds nothing | — |
| Open Library covers | `GET https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` | — | Covers | — |
| Free Dictionary API (Wiktionary data, CC BY-SA — attribution missing today) | `GET https://api.dictionaryapi.dev/api/v2/entries/en/{term}` | English only | Auto-definition when adding a word | 404 / error → no definition; no other provider |

Notes:

- Result mapping: cover = `thumbnail ?? smallThumbnail` with `http:` → `https:`; ISBN = first `ISBN_13`, else `ISBN_10`; genre = first `/` segment of `categories[0]` (raw in the ISBN path). Clients must normalise an ISBN to the `books_isbn_check` format before insert (strip hyphens/spaces, uppercase `X`); ISBN-10 ↔ 13 conversion and checksums are not implemented anywhere (BC-15).
- CSV-import enrichment issues up to 5 external calls per book (3 books in parallel, 150 ms between batches) and shares the Google quota.
- The Google key (`VITE_GOOGLE_BOOKS_API_KEY`) is embedded in the web bundle, and a literal key value is committed in `.env.example` — rotate and restrict it (§12 S-13). BC-15 replaces direct Google calls with a server-side proxy for every client.
- The PWA service worker caches Open Library `/api/*` (NetworkFirst, 7 days) and covers (CacheFirst, 30 days); nothing else is cached.

---

## 12. Security status

Findings verified on the live project on 2026-10-18; status updated 2026-10-19 after BC-01 (migration `bc01_security_hardening`) and BC-02 (edge-function deploys `generate-recap` v86, `generate-lore` v20, `ocr-page` v4). The repository is private (D-16). Everything still open must be fixed before any public native release.

| ID | Severity | Finding (as found 2026-10-18) | Status |
|---|---|---|---|
| S-01 | **Critical** | **IDOR in core RPCs.** `get_library_with_progress`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity` were `SECURITY DEFINER`, took `p_user_id` and never compared it with `auth.uid()`: any signed-in user could read any other user's titles, progress, DNF state, session notes and velocity by UUID. | **Fixed 2026-10-19 (BC-01).** Each raises `42501 not_allowed` unless `p_user_id = auth.uid()`. The parameter is kept, and the caller's own payload is unchanged (verified byte-identical). |
| S-02 | **Critical** | **Anon bypass of `get_reading_quest_summary`.** The guard `IF p_user_id <> (select auth.uid())` was NULL for `anon`, and `anon` held EXECUTE. | **Fixed 2026-10-19 (BC-01).** NULL-safe guard (`private.assert_is_caller`) and no anon EXECUTE; anon calls get `42501`. |
| S-03 | **High** | **Destructive anon-executable functions.** `prune_page_captures_for_book` (any user's captures), `community_remove_pair_follows` (any follow edge), `community_reconcile_follow_counts` (global recompute). | **Fixed 2026-10-19 (BC-01).** `after_page_capture_saved` and `prune_page_captures_for_book` are dropped. No client role can execute the community helpers; `community_reconcile_follow_counts` is service-role only. |
| S-04 | **High** | **Helper functions leak data.** `circle_progress_location`, `community_relationship_payload`, `community_has_block_between`, `community_interaction_reason`, `community_can_view_profile` and the `circle_*` oracles were EXECUTE to `authenticated` with arbitrary user ids. | **Fixed 2026-10-19 (BC-01).** EXECUTE is revoked from `anon` and `authenticated`. The circle RLS policies now use `private.is_circle_member/owner`, which take the user from `auth.uid()`. The helpers stay in `public` (§9.2 explains why), so a direct call returns `42501` instead of 404. |
| S-05 | **High** | **Default privileges re-open the anon surface.** `pg_default_acl` granted EXECUTE and full DML on every new object to `anon`/`authenticated`; 22 functions (17 definer) were anon-executable. | **Fixed 2026-10-19 (BC-01)** for owner `postgres`. 0 functions are anon-executable. New functions get no client EXECUTE, and new tables and sequences get no anon privileges, without an explicit grant. Defaults owned by `supabase_admin` cannot be changed from a migration, so every migration must run as `postgres`. `anon` table privileges are revoked everywhere except the out-of-scope `activity_logs`. |
| S-06 | **Critical** | **Unverified JWTs in `generate-recap`, `generate-lore`, `ocr-page`.** `verify_jwt = false` and the code only base64-decoded the payload; a forged `sub` could spend Gemini/OpenAI credits and, in `recap_image`, write via the service role. | **Fixed 2026-10-19 (BC-02).** `verify_jwt = true` at the gateway, plus `requireUser` (`supabase.auth.getUser`) in code; the hand-rolled decoders are removed. All three return 401 for a forged token (verified). `recap_image` checks recap ownership before any AI call (404 `recap_not_found`). |
| S-07 | Medium (correctness) | `generate-recap` and `ocr-page` rejected some **valid** tokens (base64url not normalised before `atob`). | **Fixed 2026-10-19 (BC-02)**: neither function decodes tokens locally any more. |
| S-08 | Medium | **Internal error text in 500s** (`detail: String(err)`). | **Fixed 2026-10-19 (BC-02).** 500s return `{"error":"Internal server error","requestId"}`, and details are logged server-side only. `generate-recap` also returns 400 for malformed JSON and 405 for non-POST; `ocr-page` returns 405 for non-POST. The fixed-string `detail` fields on AI-output errors remain; they contain no internal text. |
| S-09 | High (cost) | **No rate limiting, quota or entitlement checks** in any AI function; CORS `*`. | Open: BC-12 (shared check, allow-all until tiers exist, D-14). Restricting CORS is BC-02 OP-02.1, after BC-11 confirms the domain. |
| S-10 | Medium | **RLS did not verify `book_id` ownership** on child tables; cross-user references were accepted (concrete path: the PWA's non-user-scoped offline queue after an account switch). | **Fixed 2026-10-19 (BC-01)** on `reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `page_captures`, `lore_cards`, `up_next_order`, `book_passports`, `book_quizzes` and `vocabulary_extractions`; a foreign `book_id` gets `42501`. Clients should still scope offline queues per user (§4). |
| S-11 | Medium (dormant) | **RLS bypassed RPC business rules.** `follows_follower_insert` allowed direct follows (private users, blockers); `community_profiles_owner_insert/update` bypassed the reserved-username list and allowed arbitrary `avatar_url`/`created_at`. | **Fixed 2026-10-19 (BC-01).** The three policies are dropped; follows and profiles are written only through their `SECURITY DEFINER` RPCs. |
| S-12 | Medium | **Leaked-password protection disabled** in Auth. | Open: BC-11 |
| S-13 | Medium | The Google Books API key ships in the web bundle and a literal key is committed in `.env.example`. | Open: rotate and restrict now; BC-15 server-side proxy |
| S-14 | Low (dormant) | `community_profiles.avatar_url` is free text: any external URL is rendered by viewers (tracking / unmoderated images). | **Partly fixed (BC-01):** direct profile writes are closed. Still open: `upsert_my_community_profile` does not yet restrict `avatar_url` to the caller's `community-avatars` folder, cap `display_name` at 60 code points, or `btrim` whitespace (BC-01.7, recommended). |
| S-15 | Low (dormant) | **Community privacy leaks.** `get_also_reading_for_book` accepts a caller-controlled `p_isbn`, so a follower can probe every in-progress book of the people they follow. Public `currentlyReading` returns pages even when `progress = nobody`; `lexiconHighlights.bookTitle` reveals books when `currentlyReading = nobody`; `hasBlockedViewer` tells a blocked user; `is_public = false` is ignored inside circles; search `LIKE` wildcards are not escaped. | Open: deferred out of Phase 0 (BC-01 OP-01.3, plan §6); fix before the Community phase (D-13) |
| S-16 | High (compliance) | **No account deletion** on any client (App Store Guideline 5.1.1(v)), and Storage objects are never purged. | Open: D-10 / BC-11 `delete-account`; BC-13 (Storage hygiene & AI-job robustness) |
| S-17 | Info | Sign-out uses the `global` scope: signing out on one device ends every session (web and native). Intentional unless changed in BC-11. | Open decision BC-11 OP-11.2 (sign-out scope) |

Security advisor after BC-01 (2026-10-19):
- lint 0028 (anon-executable definer functions): **0**, down from 17.
- lint 0029 (authenticated-executable definer functions): **34**, down from 60. These are exactly the client allowlist, which is expected.
- Leaked-password protection is still disabled (§14).

---

## 13. Drift: migrations & deployed sources

The live database is canonical; D-16 committed its snapshot as [`supabase/reference/live-baseline-2026-10-18.sql`](../supabase/reference/live-baseline-2026-10-18.sql), regenerated after BC-01 as [`live-baseline-2026-10-19.sql`](../supabase/reference/live-baseline-2026-10-19.sql) (not migrations; outside `supabase/migrations/` and `supabase/schemas/` so the CLI never applies it). BC-03 squashes it into a baseline migration and enforces migration discipline.

### 13.1 Migration history vs `supabase/migrations/`

Counts cover product migrations only.

| Category | Count | Items |
|---|---|---|
| Remote history entries | 44 | — |
| Local files | 24 | — |
| Recorded remotely **and** present locally | 17 | lore_cards, session_stats, corpus_recaps, reading_velocity, rpc_performance_improvements, recap_image_columns, sessions_this_month_fix, sessions_this_calendar_month, pages_this_calendar_month, library_import (034), get_reading_calendar, get_monthly_reading, session_pause_resume, session_page_resume, book_quizzes, records_achievements, dnf_status |
| Recorded remotely, **no local file** | 27 | `initial_schema`, `add_page_snapshot_to_recaps`, `create_up_next_order`, `create_progress_history`, `create_lexicon_entries`, `create_recap_fragments`, `create_book_passports`, `create_book_maps`, `fix_reading_stats_total_pages_read`, `relax_books_isbn_check_allow_x`, `add_genre_to_library_rpc`, `add_isbn_to_library_rpc`, `reading_velocity_rpc_fix_ambiguous`, `fix_reading_stats_pages_read`, `lock_down_reading_stats_rpc_execute`, `community_profiles`, `revoke_anon_rpc_execute`, `set_updated_at_search_path`, `drop_redundant_community_indexes`, `20260503_community_follows_blocks`, `20260503_community_avatar_storage`, `…_restrict_listing`, `…_owner_upsert`, `also_reading_card`, `reading_circles`, `create_anki_review_sessions`, `lexicon_quote_entry_type` |
| Local file, **not in remote history** (applied out-of-band) | 7 | `20260428_reader_profile.sql` (reading_dna, vocabulary_extractions, lexicon source), `20260512_reading_quest_goal.sql`, `20260513_page_capture_completion_cleanup.sql`, `20260517_book_passport_stats_rpc.sql`, `20260616_book_description.sql`, `20260617_lexicon_mastered.sql`, `20260618_lexicon_last_reviewed.sql` |
| Live objects with **no migration anywhere** | — | Table `user_settings` (+ CHECK, policies), `upsert_weekly_goal`, `get_retention_summary` (`prune_page_captures_for_book` and `after_page_capture_saved` were dropped by BC-01) |
| Created by a recorded migration but **absent live** | — | Tables `recap_fragments`, `book_maps` (dropped out-of-band) |

Function-level comparison (69 live functions, normalised bodies): 14 are defined locally — 13 match the latest local definition by file order, 1 differs (`get_reading_stats`); **55 have no local definition** (the whole community/circles layer, `normalize_isbn`, `set_updated_at`, …).

Replay hazards of the local folder:

1. `get_reading_stats`: remote applied `library_import_034` **after** the three stats fixes, but local file names sort `20260619_library_import.sql` before `20260619_sessions_this_month_fix.sql`, so a replay loses the `coalesce(b.source,'manual') = 'manual'` filter on `totalPagesRead`.
2. `20260417_lore_cards.sql` adds a `type` CHECK `('History','Myth','Geography')` that does not exist live and would reject live `Lore`/`Culture` rows.
3. `20260503_recap_image_columns.sql` sets the `recap-images` limit to 524 288 (512 KiB) vs live 10 MiB — it would break 1024² PNG uploads.
4. `20260428_reader_profile.sql` declares `vocabulary_extractions.capture_id NOT NULL … ON DELETE CASCADE`, superseded by `20260513…` (nullable, SET NULL) — consistent live.
5. `20260501_reading_velocity.sql` defines a plpgsql version; live is the SQL version from `20260502…` (match).
6. The `page_captures.resume` column comment (from `20260713_session_page_resume.sql`) promises `characters: text[]`; the current function never produces it (one legacy row has it).

### 13.2 Edge-function drift (deployed is canonical, D-09)

| Function | Deployed | Repo | Action (BC-03) |
|---|---|---|---|
| `generate-lore` v20 | Accuracy-first prompt, temperature 0.35, `thinkingBudget: 1000` + `includeThoughts: true` misplaced at the `config` root | **Synced 2026-10-19** (v18 source + BC-02 auth), deployed from the repo | Move the thinking settings into `thinkingConfig` deliberately |
| `generate-reading-dna` v8 | `googleSearch` tool, top-level `dynamicRetrievalConfig`, `thinkingBudget 1` | No tools, `thinkingBudget 0` | Sync repo to deployed; drop the ignored `dynamicRetrievalConfig` |
| `generate-recap` v86 | Deployed from the repo 2026-10-19 | **Synced** (v84 source + BC-02 auth) | Drop the ignored `dynamicRetrievalConfig` in extraction |
| `ocr-page` v4 | Deployed from the repo 2026-10-19 | **Synced** (v2 source + BC-02 auth) | — |
| `extract-vocabulary` v2, `generate-page-resume` v3, `generate-book-quiz` v1 | Identical | — | — |

`supabase/config.toml` (BC-02, 2026-10-19) records `verify_jwt = true` and the import maps for the seven managed functions, so a deploy from the repo reproduces the live flags. `log-geo` (activity-log feature) is intentionally not managed there.

The BC-01 migration was applied through the SQL editor, so remote migration history does not list `bc01_security_hardening`; BC-03's `supabase migration repair` step must record it.

### 13.3 Corrections to the previous contract (2026-06-18)

This rewrite replaces the old document. Corrected statements:

- "All 25 tables" → 26 product tables; `book_quizzes` and `achievements` were missing.
- "RPCs re-assert `auth.uid()` internally" → false for four core RPCs and bypassable for the quest RPC (§12 S-01, S-02).
- `lexicon_entries.entry_type` is `dictionary|quote` (not `lore`).
- `user_settings` / `upsert_weekly_goal` / `get_retention_summary` are dormant, and `get_retention_summary` is a weekly reading-session goal, not a review/retention rollup.
- `after_page_capture_saved` and `prune_page_captures_for_book` are not trigger helpers: one is attached to nothing, the other is client-callable even by `anon`.
- The `verify_jwt = false` functions do not "validate the token themselves" — they only decode it.
- There are 7 edge functions, including `generate-book-quiz`; the recap image model is OpenAI `gpt-image-2` behind a Gemini Flash prompt refiner, and inferred extraction uses Gemini 2.5 Pro with Google Search.
- Realtime: the PWA does subscribe to `recaps`, but the publication is empty, so polling is what works.
- Writes: offline replays write no history; the post-save session clear is fire-and-forget; upserts must send only the intended column subset.
- DNF is ignored not only by stats but also by quest XP/completions and the public profile.
- Runtime limits (statement timeouts, `safeupdate`, UTC DB time zone, default ACL) were not documented.
- Capture completion behaviour: a capture saved on a finished book is deleted immediately; completion also deletes the quiz.

---

## 14. Advisors & performance

### 14.1 Advisor lints (product objects)

| Advisor | Lint | 2026-10-18 | 2026-10-19 (after BC-01) | Notes |
|---|---|---|---|---|
| Security | `anon_security_definer_function_executable` (0028) | 17 | **0** | Fixed (BC-01) |
| Security | `authenticated_security_definer_function_executable` (0029) | 60 | **34** | Remaining = exactly the client allowlist (expected) |
| Security | `auth_leaked_password_protection` | 1 | 1 | Disabled; BC-11 |
| Performance | `auth_rls_initplan` | 25 | **0** in scope | Fixed (BC-01). The 4 remaining hits are `activity_logs` policies (activity-log feature, out of scope) |
| Performance | `unindexed_foreign_keys` | 7 | **0** in scope | Fixed (BC-01). Remaining: `activity_logs.user_id` (out of scope) |
| Performance | `duplicate_index` | 1 | **0** | Fixed (BC-01) |
| Performance | `unused_index` | 11 | 18 | Dormant community/circle indexes, plus the 7 new FK indexes (unused until cascade deletes hit them) |

BC-01 also dropped the redundant indexes the advisor does not flag: `idx_page_captures_user_book_page`, `idx_anki_review_sessions_user` and `reading_goals_user_year_idx` (each duplicated a unique-constraint index). Still redundant: `progress_history_user_book_recorded_at_idx` (a prefix of `…_recorded_at_id_idx`).


### 14.2 Performance characteristics

- Every stats/quest/records RPC recomputes from base tables with a full scan of the caller's `progress_history`; `get_reading_records` and `get_monthly_reading` use per-row lateral sub-selects and are the most likely to approach the 8 s `statement_timeout` at scale. There are no materialized views and no server caches.
- `get_library_with_progress` returns the whole library as one JSON scalar (no pagination, no delta) — BC-14 adds `changed_since` / pagination.
- Un-paginated table `select`s (`books`, `lexicon_entries` by user, `lore_cards` all books) are subject to `max_rows` [UNVERIFIED default 1000]; clients must paginate with `Range` headers.
- No Realtime and no push: clients poll (recap image status) or refetch on foreground (BC-14).

---

## 15. Notes for native clients

These notes are client-agnostic (iOS with `supabase-swift`, Android with `supabase-kotlin`, and the PWA as it migrates).

### 15.1 SDK and models

- Use the official SDK for Auth, PostgREST (tables + `.rpc`), Storage (signed URLs, uploads), Functions and Realtime. Same project URL and publishable key as the web; never the service-role key.
- `supabase gen types` produces TypeScript only. Hand-write `Codable` / `kotlinx.serialization` models from §3 (tables, snake_case) and §8 (RPC JSON, camelCase — except `get_reading_velocity` rows: `book_id`, `days_left`). RPC results are untyped `json`/`jsonb` blobs.
- Decoding: ISO-8601 timestamps with offset and **0–6** fractional digits; `YYYY-MM-DD` fields (`peakDay`, calendar `date`, records `date`, `next_review_at`, `peak_day`) are calendar dates in the reader's zone, never UTC midnight; numbers may be non-integers or `null`; some keys are **absent** rather than null (public-profile sections); ignore unknown keys (e.g. legacy `resume.characters`).

### 15.2 Time

- Pass the reader's IANA identifier (`TimeZone.current.identifier`, `ZoneId.systemDefault().id`) to every `p_timezone` / `p_time_zone` argument — never an abbreviation. Unknown zones raise `22023`. Re-query time-sensitive aggregates when the zone changes.
- Until BC-06, `get_reading_stats` (streaks, week, month, sessions), `get_reading_quest_summary` (year), `get_reading_velocity` and public-profile streaks use **UTC** boundaries, while calendar/monthly/records/passport use the zone you pass. Present them consistently. D-07: all day/week/month/year boundaries move to the reader's zone, stored server-side for jobs.
- Server-clock rule: the BC-04 RPCs stamp time on the server; a client timestamp is used only for offline replays (D-08). Until then, the PWA writes `recorded_at` and `session_start_at` from the device clock, and device skew shifts streaks, sessions, records and the recap cooldown.

### 15.3 Writes

- **Target the BC-04 RPCs** (`start/pause/resume/cancel_session`, `save_progress(book, page, note, client_occurred_at, idempotency_key)`, DNF/resume RPCs that never send `current_page`). Core logic moves server-side before the iOS build (D-06); native clients should not reimplement the PWA's multi-step write sequence.
- If an interim build must write tables directly, mirror the PWA's column discipline exactly — a PostgREST upsert overwrites only the columns it sends, so encode one payload per operation (never a shared struct whose nils encode as `null`):

| Operation (PWA today) | Columns sent | Notes |
|---|---|---|
| Page save | `reading_progress {book_id, user_id, current_page}` upsert `onConflict book_id,user_id`; then insert `progress_history {book_id, user_id, page, recorded_at, session_start_at}`; then clear `session_start_at`/`session_paused_at` | Fires the completion triggers when page ≥ total. Saving while paused first shifts `session_start_at` forward by `now − session_paused_at`. |
| Start session | `current_page` (unchanged), `session_start_at = now`, `session_paused_at = null` | Refused client-side on finished or DNF books |
| Pause / resume | UPDATE `session_paused_at = now` (filtered on `session_start_at IS NOT NULL`) / UPDATE `session_start_at += now − session_paused_at`, `session_paused_at = null` | — |
| Cancel session | UPDATE both session columns to null | No history row |
| DNF | upsert `current_page, dnf_at = now, session_start_at = null, session_paused_at = null` | — |
| Resume DNF | UPDATE `dnf_at = null` only | Never sends `current_page` |
| Initial status | upsert `current_page` (clamped), `session_start_at = null` | No history |

- `safeupdate` is on: every UPDATE/DELETE needs a filter.
- Validate before writing (§3): ISBN format (strip hyphens/spaces, uppercase `X`), title 1–500, author 1–200, `total_pages ≥ 1`, `current_page` clamped to `[0, total_pages]`, `session_note ≤ 160`, capture text 1–10 000 and non-blank, lexicon `term ≤ 200`, `page_found ≥ 1`, bio ≤ 160 code points. Normalise blank strings to NULL. Clear `page_count_estimated` when editing `total_pages`.
- Only reference your own `book_id`s (RLS does not check). Never write `progress_history` for imports. Never insert `reading_quest_events` (trigger-only). Do not duplicate server cascades (completion purge, quest events).
- Idempotency today: `progress_history` has no unique key (a retried save duplicates rows — BC-04 adds `idempotency_key`); conflict targets are `reading_progress (book_id,user_id)`, `page_captures (user_id,book_id,page)`, `book_quizzes (user_id,book_id)`, `book_passports (book_id)`, `reading_dna (user_id)`, `up_next_order (user_id,book_id)`, `reading_goals (user_id,year)`, `anki_review_sessions (user_id)`; `achievements` insert `ON CONFLICT DO NOTHING`; `lore_cards` `23505` = already unlocked; `vocabulary_extractions.capture_id` unique (a retry is a no-op).

### 15.4 Retries, errors and timeouts

- Switch on `message` for `P0001` errors (§8.8); never retry them.
- Retry `57014` (statement timeout), network failures and 5xx with exponential backoff — only for reads and idempotent writes.
- On a 401 from PostgREST during a token refresh (`PGRST303`), refresh the session and retry once. On a 401 from an edge function, refresh and retry once.
- Never auto-retry `generate-recap` or `generate-lore` (costly, not idempotent); `ocr-page` already retries internally once within 10 s.
- Expect `safeupdate` and RLS rejections to surface as PostgREST errors, not empty results.

### 15.5 Edge functions, streaming and Storage

- Call `POST {SUPABASE_URL}/functions/v1/<slug>` with `Authorization: Bearer <access token>` and `apikey`.
- Recap streaming: read the body as a byte stream (`URLSession.bytes(for:)`, OkHttp streaming), accumulate UTF-8, parse at the end (strip fences / first `{…}`), require all three keys. Streams need a foreground session (a background `URLSession` cannot stream). The inferred path may take tens of seconds before the first byte. Until BC-07, aborting the stream means nothing is persisted; after BC-07 the server finishes and saves once paid.
- Recap image: after inserting the recap (or receiving it from BC-07), poll `recaps.image_status, image_path` with backoff (e.g. 2 s → 30 s) and stop after ~3 min (p90 ≈ 57 s), or use Realtime once BC-14 publishes `recaps`. Treat a long-`pending` row as failed until BC-13 sweeps it. Mint signed URLs on demand and cache image bytes, not URLs.
- OCR: on-device Apple Vision first, `ocr-page` fallback on low confidence (D-15); send raw base64 JPEG/PNG ≤ 5 MiB decoded; route a 200 with empty text to manual review; recalibrate the 0.90 / 0.70 thresholds for Vision.
- Avatars: upload `{uid}/avatar-{epochMs}.jpg` → call `upsert_my_community_profile` with the full payload → only then delete older files.

### 15.6 Auth and account

- Today: email/password and magic link. Planned (D-11, BC-11): Sign in with Apple + email/password, password reset, magic and reset links via universal links (associated domains / app links + session-from-URL handling), linking an Apple ID to an existing email account from settings (avoids empty duplicate accounts via Hide-My-Email). BC-02 must ship before Apple sign-in (base64url defect, S-07).
- Sign-out is `global` today: it ends web sessions too.
- Account deletion: immediate hard delete through the planned `delete-account` edge function with confirm + re-auth, on web and iOS (D-10).

### 15.7 Offline and sync

- Only progress writes are offline-capable; AI features, captures, recaps and community need connectivity.
- Scope every offline queue by user id; never replay under another user; drop queued operations for deleted books; detect stale replays (compare with `reading_progress.updated_at` until BC-04 adds idempotency and server-side ordering). D-08: replayed saves keep their original timestamp and count for pages, streaks and charts; session XP, session-count badges and the Last Session card require a real timed session.
- No server push or Realtime today: refresh on foreground and after mutations (BC-14 may add Realtime on `recaps.image_status` and `reading_progress`, a delta library RPC and `device_tokens` for APNs).

### 15.8 Scope and compliance

- iOS v1 profile = username + display name + avatar only (D-13): no bio, privacy or public-toggle UI. Today `upsert_my_community_profile` is a full replace that defaults an omitted `isPublic` to `true`, so until BC-11 ships partial updates (BC-11.8: absent keys keep their values), a client must read the current profile and resend `bio`, `isPublic` and the privacy values unchanged. After BC-11, iOS sends only `username`, `displayName` and `avatarUrl`. The follow graph, discovery and circles stay dormant.
- Subscriptions/paywall are undecided (D-14): entitlement and AI-usage checks will live server-side in the AI edge functions (BC-12); never gate on the client alone.
- Privacy disclosures: page photos and text go to Google (Gemini); recap text goes to OpenAI (images). Capture images are never stored by the backend.

---

## 16. Planned changes

Details, sequencing and acceptance criteria: [backend-consolidation-plan.md](backend-consolidation-plan.md). Every change keeps existing signatures working for the PWA during the transition (D-05).

| Planned change | Contract sections affected | BC |
|---|---|---|
| **Done 2026-10-19.** Owner checks in `get_library_with_progress` / `get_library_breakdown` / `get_last_session` / `get_reading_velocity` (keep `p_user_id`); NULL-safe quest guard; revoke anon/PUBLIC EXECUTE and fix `pg_default_acl`; drop `after_page_capture_saved`, drop/lock `prune_page_captures_for_book`; lock `community_remove_pair_follows`, `circle_progress_location` and other helpers; child-table RLS checks book ownership; close the direct follows-insert bypass; initplan, FK indexes, duplicate index | §1.3, §5, §8, §9.2, §12, §14 | BC-01 |
| **Done 2026-10-19.** `verify_jwt = true` and `auth.getUser` for `generate-recap`, `generate-lore`, `ocr-page`; base64 decoding removed; no internal error text in 500s; `recap_image` ownership check; `supabase/config.toml` committed. Still open: move the other four functions' local `sub` decoding to `requireUser`; CORS (OP-02.1) | §10, §12 | BC-02 |
| Baseline migration from the live snapshot; migration discipline; sync edge sources to deployed (lore v18, DNA v8) and fix the misplaced thinking config; keep this contract in sync | §13 | BC-03 |
| `start/pause/resume/cancel_session`, `save_progress(book, page, note, client_occurred_at, idempotency_key)` on the server clock; atomic progress + history + session end; completion detection and `reading_progress.completed_at`; DNF/resume RPCs; timed vs untimed history (D-08); baseline history row for mid-way adds | §3.1, §4.5–§4.9, §8.2, §15.3 | BC-04 |
| One server owner for completion effects: frozen passport stats + AI-summary job, capture/quiz purge, Insight milestones, achievements, DNA eligibility | §4.5, §10.2, §10.8 | BC-05 |
| `p_timezone` on every stats RPC (streaks, week/month, quest year, sessions this month, review daily tally, Word-of-the-Day day); persist the reader's zone (e.g. `user_settings.time_zone`) | §3.5, §8.1, §15.2 | BC-06 |
| `generate-recap` enforces eligibility on the server clock, selects the corpus window, persists and returns the validated `recaps` row; defined abort/background semantics | §3.2, §4.10, §10.2 | BC-07 |
| Insights orchestration server-side with recap → captures → metadata fallback (spoiler-guarded, D-12), backfill skipped/failed milestones, insert `ON CONFLICT DO NOTHING`; clients list and mark seen | §3.2, §10.3 | BC-08 |
| Achievement catalog and evaluation in SQL/RPC with server-authoritative `earned_at` | §3.5, §6.3 | BC-09 |
| `review_lexicon_entry(entry_id, outcome, surface)` → box / next_review_at / mastered; daily tally and due set in the reader's zone; undo | §3.4 | BC-10 |
| `delete-account` edge function (D-10), password reset, Sign in with Apple + identity linking, universal-link redirects, custom SMTP, email-confirmation decision, optional data export, leaked-password protection; partial `upsert_my_community_profile` updates for iOS v1 (absent keys keep their values, D-13) | §1.2, §4.2, §8.4, §10.9, §12, §15.8 | BC-11 |
| Entitlements table (App Store Server Notifications v2 or RevenueCat), `ai_usage` ledger, one shared check in every AI function (allow-all until tiers are decided, D-14) | §10, §12 | BC-12 |
| Delete recap images on recap/book delete (edge function), orphan sweep, stale `pending` → `failed_transient`, image-job error handling | §4.10, §7.4, §10.2 | BC-13 |
| Realtime for `recaps` (`image_status`) and `reading_progress` or refresh-on-foreground; delta/paginated library RPC (`changed_since`); `device_tokens` for APNs | §1.5, §8.2, §14.2 | BC-14 |
| ISBN normalisation (strip hyphens/spaces, uppercase X) + checksum + 10→13 before insert; server-side book-search proxy; atomic, idempotent import RPC | §3.1, §4.7, §11 | BC-15 |
