# BookHero — Backend Contract

**Status**: Authoritative reference, reconciled against the **live Supabase database** on 2026-06-18.

**Why this exists**: The local `supabase/migrations` folder and the `docs/wiki` are **incomplete/stale** relative to the deployed database (e.g. an entire community + reading-circles layer is live but barely documented, and several RPCs were patched directly on the remote). For the iOS port (and the PWA), **the live database is the source of truth.** This document captures that truth so the native client and any Spec Kit specs can code against a stable contract.

> Reconciliation note: local migrations have drifted from prod. Going forward, treat the live DB as canonical; new changes should be applied as migrations *and* mirrored here. A one-time "baseline" migration squash from the live schema is recommended before the iOS work starts in earnest.

---

## 1. Connection & Auth

- **Project URL**: `https://zlndhygpqacygceivuvk.supabase.co`
- **Auth**: Supabase Auth (email/password + magic link today). For iOS, add **Sign in with Apple** (required by App Review if any third-party/social login is offered).
- **Authorization model**: Row-Level Security on every `public` table (all 25 tables have RLS enabled). Owner-scoped: a user only sees rows where `user_id = auth.uid()` (community/circle tables use relationship-gated policies — see §6).
- **Aggregates**: read paths that need cross-row computation go through **`SECURITY DEFINER` RPCs** that re-assert `auth.uid()` internally, not raw table reads.
- **Extensions in use**: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `plpgsql` (everything else available but not installed).

---

## 2. Domain map

| Domain | Tables | Primary client surfaces |
|--------|--------|-------------------------|
| **Library & reading** | `books`, `reading_progress`, `progress_history`, `up_next_order` | Library, Dashboard, reading sessions |
| **AI memory** | `recaps`, `lore_cards`, `book_passports`, `reading_dna` | Recaps, Lore Chronoscope, Passport, Profile DNA |
| **Capture & vocab** | `page_captures`, `vocabulary_extractions`, `lexicon_entries`, `anki_review_sessions` | OCR capture, Great Library, Word of the Day, Anki review |
| **Goals & gamification** | `reading_goals`, `reading_quest_events`, `user_settings` | Profile quest/goals, settings |
| **Community** | `community_profiles`, `community_profile_privacy`, `follows`, `blocks`, `community_follow_counts` | Public profiles, follow/block |
| **Reading circles** | `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions` | Private spoiler-safe book circles |

**iOS scope note**: the **Community** and **Reading Circles** domains are large and likely **out of scope for the first iOS release** — they have their own RPC surface and privacy rules. Recommend iOS v1 = Library/reading + AI memory + capture/vocab + goals; defer social.

---

## 3. Tables (live schema)

All `id` are `uuid default gen_random_uuid()` unless noted; all timestamps are `timestamptz`. `user_id`/owner FKs → `auth.users.id`.

### Library & reading

**`books`** (RLS: owner ALL) — rows ~42
- `user_id`, `title` (1–500), `author` (1–200), `isbn` (nullable, `^\d{9}[\dX]$|^\d{13}$`), `cover_url` (nullable), `total_pages` (≥1), `genre` (nullable), `description` (nullable), `created_at`
- `source` (text, **not null default `'manual'`**) — provenance: `'manual'` (scan/manual/search) vs `'goodreads'`/`'storygraph'` (CSV import, 034). **Imported = `source <> 'manual'`**; period-based stat RPCs exclude these (see below), library-composition RPCs include them.
- `page_count_estimated` (bool, **not null default `false`**) — `true` = `total_pages` is a flagged placeholder a CSV import couldn't resolve; the reader corrects it later (cleared automatically when `total_pages` is edited).
- FK target for nearly every other table (`book_id`).

**`reading_progress`** (RLS: owner ALL) — one row per book/user (`onConflict: book_id,user_id`)
- `book_id`, `user_id`, `current_page` (default 0), `updated_at`, `session_start_at` (nullable — non-null = active timed session)

**`progress_history`** (RLS: owner ALL) — append-only, ~127 rows
- `book_id`, `user_id`, `page` (≥0), `recorded_at`, `session_start_at` (nullable — **non-null = a real timed session ended here**), `session_note` (≤160)
- This table feeds all the reading-stats RPCs.

**`up_next_order`** (RLS: owner ALL) — `book_id`, `sort_position`, `updated_at`. User-defined ordering for the up-next queue.

### AI memory

**`recaps`** (RLS: owner ALL) — ~43 rows
- `book_id`, `user_id`, `progress_snapshot` (numeric), `page_snapshot` (nullable), `memory_jogger`, `concept_watchlist`, `thematic_bridge` (all non-empty), `mode` (`corpus`|`inferred`, default inferred), `image_path` (nullable), `image_status` (`pending|succeeded|failed_safety|failed_transient|skipped` or null), `image_generated_at`, `created_at`
- Recap images stored in the private `recap-images` bucket (see §5).

**`lore_cards`** (RLS: owner select/insert/update/delete) — ~45 rows
- `book_id`, `user_id`, `title`, `content`, `type`, `linked_entities` (text[]), `unlocked_at_page`, `unlocked_at_milestone` (10..90 by 10s), `seen` (bool), `created_at`

**`book_passports`** (RLS: owner ALL) — one per book (`book_id` unique)
- `total_days`, `peak_day`, `peak_day_pages`, `vocabulary_count` (default 0), `ai_summary` (nullable), `generated_at`

**`reading_dna`** (RLS: owner select/insert/update) — PK `user_id` (one per user)
- `personality` (50–800), `mood_tone` (1–40), `mood_emojis` (text[], 1–5), `suggestions` (jsonb: `[{title,author,reason}]`, 3–5), `books_finished_at_generation`, `generated_at`

### Capture & vocab

**`page_captures`** (RLS: owner select/insert/update/delete) — ~13 rows
- `book_id`, `user_id`, `page` (≥0; **sourced from `reading_progress.current_page`, never OCR**), `text` (1–10000, post-edit OCR), `word_count`, `confidence` (0–1; UI warns <0.7), `captured_at`, `source` (`ocr`|`manual`|`import`, always `ocr` in v1)
- **Images are not persisted.** Captured text is deleted on book completion (trigger), but the extraction ledger + quest XP survive.

**`vocabulary_extractions`** (RLS: owner select/insert/update) — ledger, ~78 rows; idempotent by `capture_id` (unique, nullable)
- `book_id`, `page`, `words_added` (0–5), `status` (`pending|succeeded|failed|skipped`), `error_message`, `created_at`

**`lexicon_entries`** (RLS: owner ALL) — ~343 rows
- `book_id`, `user_id`, `term` (1–200), `definition` (≥1), `entry_type` (`dictionary`|`lore`), `context_sentence` (nullable), `page_found` (≥1, nullable), `leitner_box` (1–5, default 1), `next_review_at` (**date**, default CURRENT_DATE), `source` (`manual`|`auto`), `mastered` (bool, default false — feature 031), `last_reviewed_at` (nullable timestamptz — feature 032), `created_at`

**`anki_review_sessions`** (RLS: owner ALL) — one per user (`user_id` unique)
- `last_reviewed_at`, `total_sessions`, `known_count`, `unknown_count` — lifetime aggregates only (no per-day data; the daily-limit tally derives from `lexicon_entries.last_reviewed_at`).

### Goals & gamification

**`reading_goals`** (RLS: owner, role `authenticated`) — `year` (2000–2100), `target_books` (≥1), timestamps.

**`reading_quest_events`** (RLS: owner SELECT only; inserts via trigger) — durable XP ledger, ~83 rows
- `book_id` (nullable), `event_type` (only `page_capture` today), `page`, `source_id`, `occurred_at`. Survives page-capture deletion so lifetime XP is stable.

**`user_settings`** (RLS: owner select/insert/update) — `weekly_goal` (1–7, default 3), timestamps. Written via `upsert_weekly_goal`.

### Community (likely iOS-deferred)

- **`community_profiles`** (PK `user_id`) — `username` (`^[a-z0-9_-]{3,30}$`), `display_name`, `bio` (≤160), `avatar_url`, `is_public` (default false). Avatars in public `community-avatars` bucket.
- **`community_profile_privacy`** — per-surface visibility enums (`profile_visibility`: everyone|followers|nobody) for progress / currently-reading / lexicon / reader-DNA.
- **`follows`** (PK follower+following), **`blocks`** (PK blocker+blocked), **`community_follow_counts`** (denormalized counts, trigger-maintained).

### Reading circles (likely iOS-deferred)

- **`reading_circles`** — private invite-only circles around a book/work; `owner_id`, `created_by`, `book_id`, `canonical_book_id`, `normalized_isbn`, `title/author/cover_url`, `name` (1–80), `status` (`circle_status`: active|closed).
- **`circle_invitations`** — `status` (`circle_invitation_status`: pending|accepted|declined|revoked|expired).
- **`circle_members`** — PK circle+user, `role` (`circle_member_role`: owner|member).
- **`circle_reactions`** — page/location-gated short reactions (≤280); **read only via `get_visible_circle_reactions`** (spoiler-safe location gating), not direct select.

---

## 4. Enums

- `profile_visibility`: `everyone | followers | nobody`
- `circle_status`: `active | closed`
- `circle_invitation_status`: `pending | accepted | declined | revoked | expired`
- `circle_member_role`: `owner | member`

## 5. Storage buckets

| Bucket | Public | Limit | MIME | Use |
|--------|--------|-------|------|-----|
| `recap-images` | **private** | 10 MB | png/jpeg/webp | Per-user recap images; access via **signed URLs**, path prefixed by `auth.uid()` |
| `community-avatars` | public | 5 MB | jpeg/png/webp | Community profile avatars |

---

## 6. RPC functions (client-callable)

All are `SECURITY DEFINER` and re-assert the caller's identity. **Reads that need aggregation go through these, not table selects.** Exact JSON shapes for the core reading RPCs are mirrored in the web client's `src/types/index.ts` (`ReadingStats`, `LibraryBookEntry`, `LastSession`, `LibraryBreakdown`, etc.) — use those as the response schema until a generated Swift model exists.

### Library & reading
| RPC | Args | Returns | Purpose |
|-----|------|---------|---------|
| `get_library_with_progress` | `p_user_id uuid` | json | Library list + progress in one call (avoids N+1). *034: each row also returns `source` + `pageCountEstimated` so the UI can badge imported books / flag placeholder page counts.* |
| `get_reading_stats` | `p_user_id uuid` | json | Lifetime stats (pages this week/month, total pages, hours, **sessions this month**, streaks, velocity). *Recently fixed: month stats are calendar-month; sessions count meaningful sessions only.* *034: `totalPagesRead` excludes imported books (`source <> 'manual'`); all other fields derive from `progress_history`, which imports never write.* |
| `get_last_session` | `p_user_id uuid` | json | Most-recent session card data |
| `get_library_breakdown` | `p_user_id uuid` | json | Genre distribution, author/finished/in-progress counts. *Includes imported books (lifetime composition) — intentionally not filtered.* |
| `get_reading_velocity` | `p_user_id uuid, p_book_ids uuid[]` | table(book_id, days_left) | Per-book finish prediction |
| `get_book_passport_stats` | `p_user_id, p_book_id, p_time_zone text` | json | Completed-book passport stats (TZ-aware) |
| `get_reading_quest_summary` | `p_user_id, p_year int` | jsonb | XP, level, quest/goal summary. *034: `progress_rows` excludes imported books (`source <> 'manual'`) so imports add no quest XP and don't count toward the yearly reading goal.* |
| `get_retention_summary` | `p_timezone text` | json | Review/retention rollup |
| `get_reading_calendar` | `p_user_id uuid, p_month_start date, p_timezone text default 'UTC'` | json | Per-day distinct books read for a month, from `progress_history` (`[{date, books:[{bookId,title,coverUrl,furthestPage}]}]`). Day boundaries in the caller's IANA timezone; re-asserts `auth.uid()` internally (returns `[]` for anyone else). Powers the Trophy Room reading calendar. Migration: `supabase/migrations/20260702_get_reading_calendar.sql`. |
| `get_monthly_reading` | `p_user_id uuid, p_year int, p_timezone text default 'UTC'` | json | `[{month, pages, booksFinished}]` ×12 — monthly page deltas + first-finish months from `progress_history`; timezone-aware, auth-guarded, organic-only (imports write no history). Trophy Room "Your year" chart. Migration: `20260703_get_monthly_reading.sql`. |

**Schema notes (2026-07):** `reading_progress.session_paused_at timestamptz` (pause/resume — resume shifts `session_start_at` forward by the paused span, so all `recorded_at − session_start_at` duration math is unchanged); `lexicon_entries.entry_type` CHECK is now `('dictionary','quote')` — the manual `lore` type was retired (rows deleted by user decision) and `quote` entries are keepsakes excluded from review client-side.

### Settings
| `upsert_weekly_goal` | `p_goal int` | void | Set weekly reading goal |

### Community (social layer deferred for iOS v1)
> The PWA profile now consumes the first three of these: `get_my_community_profile` hydrates the profile identity header (`useCommunityIdentity`, email-initials fallback when no row exists), and `upsert_my_community_profile` + `is_username_available` back the `/profile/edit` customization page (which is the **only** place a `community_profiles` row gets created — sign-up does not create one). Avatars upload to `community-avatars/{userId}/…` (RLS requires the uid folder prefix).

`get_my_community_profile`, `upsert_my_community_profile(payload jsonb)`, `get_public_profile_by_username(p_username)`, `is_username_available(p_username)`, `search_community_readers(p_query,p_limit,p_cursor)`, `follow_community_user`, `unfollow_community_user`, `block_community_user`, `unblock_community_user`, `get_community_relationship_state`, `can_community_users_interact`, `list_community_followers`, `list_community_following`, `list_my_blocked_users`, `get_also_reading_for_book(p_book_id,p_isbn,p_limit,p_cursor)`.

### Reading circles (deferred for iOS v1)
`create_reading_circle`, `invite_reading_circle_members`, `respond_to_reading_circle_invitation`, `leave_reading_circle`, `remove_reading_circle_member`, `get_reading_circle_detail`, `list_my_reading_circles`, `add_circle_reaction`, `get_visible_circle_reactions(p_circle_id,p_min_location,p_max_location,p_limit,p_cursor)`.

### Internal (triggers / helpers — not called directly)
`after_page_capture_saved`, `delete_page_captures_on_book_completion`, `record_page_capture_quest_event`, `prune_page_captures_for_book`, `set_updated_at`, `set_reading_goals_updated_at`, `normalize_isbn`, plus the `circle_*` / `community_*` SECURITY DEFINER helpers used inside RLS policies and the circle/community RPCs.

---

## 7. Edge functions (Deno, deployed)

| Function | verify_jwt | Auth | Purpose |
|----------|-----------|------|---------|
| `generate-recap` | false | own (Bearer → `auth.ts`) | Three-tier recaps: pre-start blurb, mid-book recap (corpus or inferred), completion passport summary, **and recap images**. Largest function (multi-module: prompts/handlers/extraction/router). Uses Gemini 2.5 Flash + an image model. |
| `generate-lore` | false | own | Lore cards from the master recap, milestone-gated, spoiler-safe |
| `ocr-page` | false | own | Camera page → OCR text + confidence (Gemini multimodal). Images never stored. |
| `extract-vocabulary` | true | platform JWT | After a capture, extract ≤5 vocab terms → `lexicon_entries` (`source='auto'`); ledgered in `vocabulary_extractions` |
| `generate-reading-dna` | true | platform JWT | Reader DNA (personality, mood, suggestions) → `reading_dna` |

> For iOS: these are plain HTTPS POST endpoints (`{project}/functions/v1/{slug}`) with a `Bearer` access token. The `verify_jwt:false` ones validate the token themselves; send the user's access token regardless. **Secrets** (Gemini/OpenAI keys) live in Supabase function env, not the client — keep it that way. **Entitlement checks** (subscriptions) should be enforced *here*, server-side, before spending AI tokens.

---

## 8. Known issues / tech debt (from advisors)

Performance lints worth resolving before/while building iOS (none are blockers):
- **RLS `initplan`** on the older core tables (`books`, `reading_progress`, `recaps`, `progress_history`, `lexicon_entries`, `book_passports`, `up_next_order`, `lore_cards`, `page_captures`, `reading_dna`, `vocabulary_extractions`, `user_settings`, `anki_review_sessions`): policies call `auth.uid()` per-row instead of `(select auth.uid())`. The newer community/circle policies already do it right. Cheap fix, meaningful at scale.
- **Unindexed FKs**: `book_id` on `lexicon_entries`, `lore_cards`, `page_captures`, `reading_quest_events`, `up_next_order`, `vocabulary_extractions`; `user_id` on `book_passports`.
- **Duplicate index** on `progress_history` (`..._user_recorded_at_desc_idx` vs `..._user_recorded_at_idx`) — drop one.
- **Unused indexes** (~13, mostly community/circle) — candidates for removal.
- Full **security** advisor output was too large to inline; review separately via `get_advisors(security)` (covers function search_path, definer exposure, etc.) before App Store launch.

---

## 9. Notes for the iOS client

- **SDK**: `supabase-swift` covers auth, PostgREST (table reads/writes with RLS), RPC (`.rpc`), Storage (signed URLs), and Functions invoke. No need to hand-roll REST.
- **Reads**: prefer the aggregate RPCs (§6) over composing table queries — they exist specifically to avoid N+1 and race conditions.
- **Writes**: progress/session writes go to `reading_progress` (+ a `progress_history` insert) exactly as the web `progress` store does; mirror the "insert history then clear `session_start_at`" sequence.
- **Realtime**: not currently used by the web app; optional for iOS (e.g. live circle reactions later).
- **Type generation**: run `supabase gen types` for an always-accurate schema, but RPC return shapes are JSON-blob-typed — model those from `src/types/index.ts`.
- **Subscriptions (new backend work)**: add an `entitlements`/`subscriptions` table fed by RevenueCat/StoreKit webhooks, and gate the AI edge functions on it. This does not exist yet.
- **Offline**: server is the source of truth; the web app uses an IndexedDB progress queue. iOS should use SwiftData/GRDB with a sync-on-reconnect queue for progress writes.

---

*Generated from a live introspection of the Supabase project on 2026-06-18 (tables, columns, constraints, RLS policies, functions, edge functions, enums, buckets, extensions, advisors). Re-run the introspection and update this file whenever the backend changes.*
