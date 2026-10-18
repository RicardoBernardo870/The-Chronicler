# 10 · Community & Reading Circles (backend dormant) — Business Rules
> **Prefix:** COM · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-18

## Overview

This domain covers the reader's **community identity** (username, display name, bio, avatar, a public toggle and four per-surface privacy settings), the **follow graph**, **blocking**, **discovery** (reader search, public profiles, follower and following lists), **"also reading"** (people you follow who are mid-way through the same book), and **Reading Circles**: invite-only groups of up to 10 readers of one book who post spoiler-gated reactions.

> **Status (2026-10-18).**
> - **Backend fully built and live:** 9 tables, 4 enums, 24 client RPCs, 26 helper and trigger functions, and 1 Storage bucket. All of it was applied as 8 remote-only migrations, none of which exist in `supabase/migrations/`.
> - **PWA consumption:** only the identity slice — `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available` and the `community-avatars` bucket. The other **21 RPCs have no client**.
> - **iOS v1 (D-13):** username + display name + avatar **only**. No bio, no privacy settings, no public toggle.
> - **Later:** the follow graph, discovery and circles belong to a much later Community phase. Until then their backend stays dormant.
> - **Phase 0:** BC-01 locks the leaking helpers and the direct-table bypasses now. Every other community defect is deferred to the Community phase ([consolidation plan §6](../backend-consolidation-plan.md#6-out-of-scope-for-phase-0)).
>
> Every rule is still catalogued so that phase starts from a verified baseline.

| Web route / surface | Purpose | Rules |
|---|---|---|
| `/` Dashboard greeting (`DashboardGreeting.vue`) | Salutation + reader name + avatar → `/profile`; when the identity is loaded and no profile exists, the "Set up your reader profile" CTA → `/profile/edit` | COM-01, COM-109 |
| `/profile` identity header (`ProfileIdentityHeader.vue`) | Avatar and reader name; tap / Enter / Space → `/profile/edit` | COM-109 |
| `/profile/edit` (route `profile-edit`) | First-run creation or edit: avatar, username with live availability, display name, bio, public toggle, four privacy selects | COM-03…COM-19, COM-99, COM-100, COM-110 |
| *(no UI)* public profile — reserved name `u` implies `/u/{username}` | Privacy-filtered profile of another reader | COM-20…COM-32 (`get_public_profile_by_username`) |
| *(no UI)* discovery, lists, follow button, block menu, Settings → Blocked | Search, follow / unfollow, relationship state, followers / following / blocked lists | COM-33…COM-54 |
| *(no UI)* Book Detail "also reading" card | People you follow who are mid-way through the same book (ISBN match) | COM-55…COM-65 |
| *(no UI)* Circles tab / inbox, circle screen, composer, feed | Create, invite, accept / decline, leave, remove, detail, list, post and read reactions | COM-66…COM-93 |

**Designed but not built anywhere** (neither DB nor client): a feed of followed readers' updates (design-notes table + fan-out triggers), book clubs, public book pages (`get_book_community_stats`), Realtime reactions, push notifications, a username profanity-filter edge function, invite links / tokens, reporting and moderation, reaction edit / delete, an "N reactions at this page" RPC, vocabulary leaderboards / endorsements / rare-word badges, and subscription gating of community features.

**Owning objects** (names only; shapes in [backend-contract](../backend-contract.md) §3 Tables, §5 Row-level security, §6 Enums, §7 Storage, §8 RPC catalogue, §9 Triggers & internal functions, §12 Security status):

| Kind | Objects |
|---|---|
| Tables | `community_profiles`, `community_profile_privacy`, `community_follow_counts`, `follows`, `blocks`, `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions` |
| Enums | `profile_visibility` (everyone, followers, nobody), `circle_status` (active, closed), `circle_invitation_status` (pending, accepted, declined, revoked, expired), `circle_member_role` (owner, member) |
| Identity RPCs (PWA) | `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available` |
| Social RPCs (dormant) | `get_public_profile_by_username`, `search_community_readers`, `follow_community_user`, `unfollow_community_user`, `get_community_relationship_state`, `can_community_users_interact`, `block_community_user`, `unblock_community_user`, `list_community_followers`, `list_community_following`, `list_my_blocked_users`, `get_also_reading_for_book` |
| Circle RPCs (dormant) | `create_reading_circle`, `invite_reading_circle_members`, `respond_to_reading_circle_invitation`, `leave_reading_circle`, `remove_reading_circle_member`, `get_reading_circle_detail`, `list_my_reading_circles`, `add_circle_reaction`, `get_visible_circle_reactions` |
| Helpers | `community_has_block_between`, `community_can_view_profile`, `community_interaction_reason`, `community_relationship_payload`, `community_remove_pair_follows`, `community_ensure_follow_count`, `community_reconcile_follow_counts`, `community_cursor_payload`, `community_encode_cursor`, `also_reading_cursor_payload`, `also_reading_encode_cursor`, `circle_user_is_member`, `circle_user_is_owner`, `circle_member_count`, `circle_members_have_block`, `circle_progress_location`, `circle_book_matches`, `circle_users_can_share` (defined, unused), `normalize_isbn` (shared with Library) |
| Triggers | `community_ensure_count_on_profile_insert`, `community_profiles_touch_updated_at`, `community_profile_privacy_touch_updated_at`, `community_follow_counts_after_follow_insert` / `_delete`, `circle_block_cleanup_memberships`, `community_block_cleanup_follows`, `reading_circles_touch_updated_at`, `circle_members_assert_insert` |
| Storage | bucket `community-avatars` (public) |
| Edge functions, Realtime, cron | **None.** No edge function touches community tables, no community table is in the `supabase_realtime` publication, and neither `pg_cron` nor `pg_net` is installed |
| Cross-domain reads (via `SECURITY DEFINER`) | `books`, `reading_progress`, `progress_history`, `lexicon_entries`, `reading_dna` |

**Related domains:**

- [01 · Library](01-library.md): ISBN storage and normalisation ([LIB-04](01-library.md#lib-04--isbn-storage-format), [LIB-117](01-library.md#lib-117--normalize_isbn-semantics)), the book-delete cascade that can delete whole circles ([LIB-88](01-library.md#lib-88--delete-cascade)).
- [02 · Reading Sessions](02-reading-sessions.md): `reading_progress` is the only progress source for circle gating; offline saves do not count until replayed ([SES-77](02-reading-sessions.md#ses-77--what-an-offline-save-does-and-skips)).
- [05 · Codex & Lexicon](05-codex-lexicon.md): public lexicon highlights use `leitner_box >= 5`, not the `mastered` flag ([LEX-32](05-codex-lexicon.md#lex-32--mastery-has-no-other-effect), LEX-100).
- [07 · Profile, Stats & Goals](07-profile-stats-goals.md): the profile-edit form UX ([PRO-73…PRO-92](07-profile-stats-goals.md#pro-73--profile-row-lifecycle)), identity derivations ([PRO-90](07-profile-stats-goals.md#pro-90--identity-derivations-and-page-copy)), greeting ([PRO-92](07-profile-stats-goals.md#pro-92--dashboard-greeting)), Reading DNA (shown as `readerDna`).
- [08 · Platform, Auth & Account](08-platform-auth-account.md): retry-once on 401 ([PLT-33](08-platform-auth-account.md#plt-33--retry-once-on-postgrest-401)), sign-out state ([PLT-15](08-platform-auth-account.md#plt-15--sign-out-clears-almost-nothing-locally)), account deletion ([PLT-72](08-platform-auth-account.md#plt-72--no-account-deletion-export-reset-or-credential-change-exists), [PLT-73](08-platform-auth-account.md#plt-73--deleting-the-auth-user-cascades-every-user-table)).
- [09 · Database invariants](09-database-invariants.md): BE-51…BE-74 summarise this domain; the canonical rules are the COM rules here.
- [11 · Cross-domain](11-cross-domain.md): delete, complete, DNF, sign-out. [12 · Client logic register](12-client-logic-register.md).

**Traceability.** This file is the spec of record for the domain: no spec folder exists for any community feature. It supersedes the following statements in older docs:

| Older doc | Superseded statement | Live behaviour |
|---|---|---|
| `docs/community-design-notes.md` | Table names (`user_profiles`) | `community_profiles` + `community_profile_privacy` |
| | `is_public default true` | Column default is `false` |
| | Reactions keyed by page; `reaction.page <= viewer.current_page` | `source_page` + `normalized_location`, gated by percentage (COM-90) |
| | "Members can post at any page" | Only at or behind their saved position (COM-86) |
| | Materialized-view follow counts | Trigger-maintained table (COM-41) |
| | Blocking in RLS | Blocking in RPC helpers |
| | Realtime; profanity edge function | Neither exists |
| `docs/community-speckit-prompts.md` (the de-facto requirements) | "Stable" usernames | Free changes (COM-09) |
| | Canonical-book matching | `canonical_book_id` never set (COM-67) |
| | Page-based gating | Percentage location (COM-90) |
| | Realtime within 2 s | No publication |
| | "Blocked users cannot remain together" | Only the blocked user is evicted (COM-39) |
| | Correct counts | Drift (COM-41) |
| | Gap-free pagination | Skips (COM-D09…COM-D11) |
| Wiki features page | "Also reading surfaces **followers**" | People **you follow**, ISBN-matched (COM-57, COM-59) |
| iOS planning docs | "~35 / ~40 community RPCs" | 24 client RPCs + 26 helpers |
| | Username uniqueness via an edge function | RPC `is_username_available` |
| | Spoiler-safe RLS on reactions | Others' reactions are readable only through `get_visible_circle_reactions` |

**Live snapshot (2026-10-18, aggregates only):**

| Measure | Value |
|---|---|
| Community profiles | 5, of 7 auth users; all 5 have `is_public = true` and at least one privacy surface ≠ `nobody` |
| Privacy rows / follow-count rows | 5 / 5. Follow-count drift vs `follows`: 0 rows |
| `follows` / `blocks` | 2 / 0 |
| Circles | 1 (`active`, ISBN present), 2 members, 1 invitation (0 pending), 2 reactions. `canonical_book_id` set: 0. `deleted_at` set: 0 |
| Avatars | `avatar_url` set on 5 profiles: 4 point into the bucket and 1 elsewhere (COM-13). Of the 4 bucket URLs, 1 points at a missing object (COM-D33). 4 objects in 4 folders; 1 object is referenced by no profile |

---

## Rules

### A. Community profile identity

#### COM-01 · No profile row at sign-up
No `community_profiles` row exists after sign-up. It is created by the caller's first successful `upsert_my_community_profile`, which the PWA calls only from `/profile/edit`. Nothing on `auth.users` creates one, and `get_my_community_profile` returning `null` is a normal state, never an error.
- **Enforced:** `server:rpc` (`upsert_my_community_profile`, `get_my_community_profile`); no trigger exists on `auth.users`.
- **Source:** `src/composables/useCommunityIdentity.ts:6-11`; `src/pages/ProfileEditPage.vue:1-5`; live `pg_trigger`.
- **Target:** iOS v1 creates and edits the row through `upsert_my_community_profile`, sending only `username`, `displayName` and `avatarUrl`, once BC-11 makes absent keys keep their current values (BC-11.8). A missing profile is created with its privacy row and defaults (D-13 · BC-11).

#### COM-02 · `get_my_community_profile` null cases
Returns `null` when the caller is unauthenticated, or when **either** the profile row or the privacy row is missing: the privacy table is inner-joined. Otherwise it returns `{profile:{userId, username, displayName, bio, avatarUrl, isPublic, createdAt, updatedAt}, privacy:{progress, currentlyReading, lexicon, readerDna}}`.
- **Enforced:** `server:rpc` (`get_my_community_profile`).
- **Source:** live function.
- **Note:**
  - A profile inserted directly without a privacy row (COM-108) reads as "no profile", so the PWA shows the first-run Create form ⚠ COM-D03.
  - The unauthenticated branch is unreachable over the API (COM-102).

#### COM-03 · Username normalisation
- **Server:** `lower(trim(coalesce(username, '')))`. `trim` strips ASCII spaces only (COM-10).
- **PWA:** `trim().toLowerCase()` before the availability check and before save.
- **Enforced:** `server:rpc` (`upsert_my_community_profile`, `is_username_available`, `get_public_profile_by_username`); `client`.
- **Source:** live functions; `src/pages/ProfileEditPage.vue:100-101,181`.

#### COM-04 · Username format
After normalisation the username must match `^[a-z0-9_-]{3,30}$` (lowercase letters, digits, `_`, `-`; 3–30 characters), else `username_invalid`.
- **Enforced:** `server:rpc` (`username_invalid`); `server:db` (CHECK `community_profiles_username_format_chk`); `client` (`USERNAME_PATTERN`, input `maxlength=30`).
- **Source:** `src/composables/useCommunityIdentity.ts:17`; `src/pages/ProfileEditPage.vue:284`.

#### COM-05 · Reserved usernames
The names `admin, api, auth, bookhero, login, profile, u` are reserved.
- `upsert_my_community_profile` rejects them as `username_invalid`.
- `is_username_available` reports `available:false`.
- The list lives **only** inside those two RPCs. No table constraint holds it, so a direct table write can claim a reserved name ⚠ COM-D03.
- The PWA has no copy of the list: a reserved name shows "taken" while typing and the format error on save ⚠ COM-D35.
- **Enforced:** `server:rpc` only.
- **Source:** live `upsert_my_community_profile`, `is_username_available`.
- **Target:** the direct INSERT and UPDATE policies on `community_profiles` are dropped, so every write goes through an RPC (BC-01). The BC-11 partial upsert keeps enforcing the same list (D-13 · BC-11).
- **Note:** extending the list (for example with the product name, D-03) is part of COM-Q14.

#### COM-06 · Case-insensitive uniqueness
Usernames are unique case-insensitively through the unique index `community_profiles_username_lower_uidx` on `lower(username)`. The RPC pre-checks the name (`username_taken`) and also maps a concurrent `unique_violation` to `username_taken`.
- **Enforced:** `server:db` (unique index); `server:rpc` (pre-check + exception handler).
- **Source:** live index; `upsert_my_community_profile` EXCEPTION block.

#### COM-07 · Your own username is available to you
`is_username_available` excludes the caller's own row (`cp.user_id <> auth.uid()`), so the caller's current username is `available:true`. The PWA also short-circuits to `available` without a call when the typed value equals the loaded username.
- **Enforced:** `server:rpc`; `client`.
- **Source:** live `is_username_available`; `src/pages/ProfileEditPage.vue:118-121`.

#### COM-08 · `is_username_available` result
The result is `{available, normalizedUsername}`. `available` is `false` for an unauthenticated caller, an invalid format, a reserved name, or a name taken by someone else. `normalizedUsername` is always echoed. The result cannot distinguish reserved from taken from invalid.
- **Enforced:** `server:rpc`.
- **Source:** live `is_username_available`.

#### COM-09 · Usernames change freely
A username can change at any time: no cooldown, no history, no redirect. The old name becomes claimable by anyone immediately.
- **Enforced:** `server:rpc` (`on conflict (user_id) do update set username = excluded.username`).
- **Source:** live `upsert_my_community_profile`.
- **Note:** contradicts the "stable username" requirement in `docs/community-speckit-prompts.md`. The policy is COM-Q14.

#### COM-10 · Trimming and empty → NULL
- `displayName`, `bio` and `avatarUrl` are trimmed server-side, and an empty value becomes `NULL`.
- Postgres `trim()` / `btrim()` without a character list strip **only ASCII spaces**; tabs and newlines survive. So a bio of only `"\n"` is stored as-is, not as NULL, and a username with a trailing newline or tab fails the regex.
- The PWA hides this, because JS `.trim()` strips all whitespace before sending ⚠ COM-D28.
- **Enforced:** `server:rpc`; `client` (`ProfileEditPage.vue:100,182-183`).
- **Source:** live `upsert_my_community_profile` (`nullif(trim(...), '')`).
- **Target (recommended — BC-01):** the profile write path trims with `btrim(x, E' \t\r\n')`. The BC-11 partial upsert applies the same rule (D-13 · BC-11).

#### COM-11 · Bio ≤ 160 code points
After trimming, `char_length(bio) > 160` raises `bio_too_long`; CHECK `community_profiles_bio_len_chk` enforces the same limit. `char_length` counts Unicode code points. The PWA counter and `maxlength` use JS `.length` (UTF-16 units), which is stricter than the server for astral characters such as most emoji ⚠ COM-D36.
- **Enforced:** `server:rpc`; `server:db`; `client`.
- **Source:** `src/pages/ProfileEditPage.vue:26,337`; live CHECK.
- **Note:** iOS v1 has no bio field (D-13), so it must preserve a bio set on the web (COM-14).

#### COM-12 · Display name has no server-side limit
Neither the RPC nor the table limits the display name's length. The PWA caps the input at 60 characters (`maxlength`) ⚠ COM-D36.
- **Enforced:** `client` only.
- **Source:** `src/pages/ProfileEditPage.vue:317`.
- **Target (recommended — BC-01):** ≤ 60 code points enforced server-side in `upsert_my_community_profile`, including the BC-11 partial writes (D-13 · BC-11).

#### COM-13 · Avatar URL is free text
`avatarUrl` is an arbitrary string on the server, with no URL, bucket or owner validation. Every viewer's client renders whatever URL is stored: a tracking pixel, an IP-leaking third-party host, or an unmoderated image ⚠ COM-D04.
- **Enforced:** none.
- **Source:** live `upsert_my_community_profile`.
- **Target (recommended — BC-01):** `avatar_url` must be a public URL of `community-avatars` under the caller's uid, checked in `upsert_my_community_profile`, including the BC-11 partial writes (D-13 · BC-11).
- **Note:** live, 1 of 5 profiles stores a URL outside the bucket.

#### COM-14 · Upsert is a full replace
`upsert_my_community_profile` is not a patch: any omitted field is reset.
- `displayName`, `bio` and `avatarUrl` → `NULL`;
- `isPublic` → **`true`**;
- every privacy key → `'nobody'`.

Every caller must send the complete payload.
- **Enforced:** `server:rpc` (coalesce defaults).
- **Source:** live `upsert_my_community_profile`; the PWA always sends all fields (`ProfileEditPage.vue:180-187`).
- **Target:** absent keys keep their current values, so iOS v1 sends only username, display name and avatar and never resets bio, `is_public` or privacy. The PWA's full payload behaves as before (D-13 · BC-11.8, PRO-Q20).
- **Note:** until that change ships, a native client that calls the upsert must first read the profile and send bio, `isPublic` and privacy back unchanged.

#### COM-15 · `isPublic` defaults and the boolean cast
The default differs by layer: the column defaults to `false`, the RPC to `true` (when the key is omitted or JSON `null`), and the PWA first-run form to `true` ⚠ COM-D26.

The cast `(payload->>'isPublic')::boolean` sits in the function's DECLARE initialiser, and a PL/pgSQL block's own EXCEPTION clause does not cover its declarations. A non-boolean value (e.g. `"maybe"`) therefore surfaces as a **raw `22P02`** "invalid input syntax for type boolean" (HTTP 400), not `visibility_invalid` ⚠ COM-D27.

Accepted spellings, case-insensitive: `true/false`, `yes/no`, `on/off`, `1/0`, `t/f`, and JSON `1` / `0`.
- **Enforced:** `server:db` (column default); `server:rpc`; `client` (`ProfileEditPage.vue:50`).
- **Source:** live function source; the declare-time behaviour was reproduced read-only on 2026-10-18 with an equivalent nested `DO` block.
- **Note:** a bad `isPublic` never produces `visibility_invalid`; that code comes only from the privacy-key check (COM-16). Which default is canonical is COM-Q01.

#### COM-16 · Validation order of the upsert
1. The DECLARE-time `isPublic` cast (raw `22P02`) runs first, even before the auth check.
2. `not_authenticated`.
3. `username_invalid` (format or reserved).
4. `bio_too_long`.
5. `visibility_invalid`: an explicit text `NOT IN` check on the four privacy keys.
6. `username_taken`: the pre-check, or the `unique_violation` handler on a race.

Only the first failure is reported. The `invalid_text_representation → visibility_invalid` handler is dead code: after step 5 the privacy casts cannot fail, and the boolean cast fails outside the handler's scope.
- **Enforced:** `server:rpc`.
- **Source:** live `upsert_my_community_profile`.

#### COM-17 · The upsert writes both tables atomically
In one transaction the RPC writes `community_profiles`, then `community_profile_privacy` (both `on conflict (user_id) do update`), and returns `get_my_community_profile()` — the same shape as COM-02. BEFORE UPDATE triggers `community_profiles_touch_updated_at` and `community_profile_privacy_touch_updated_at` (the latter reuses the function `community_profiles_touch_updated_at()`) bump `updated_at` on every save, even when nothing changed.
- **Enforced:** `server:rpc`; `server:db` (triggers).
- **Source:** live function and triggers.

#### COM-18 · A follow-count row is created with the profile
The AFTER INSERT trigger `community_ensure_count_on_profile_insert` creates `community_follow_counts (0, 0)` for the new profile. It does **not** backfill follows that already exist (COM-41).
- **Enforced:** `server:db`.
- **Source:** live trigger.

### B. Privacy & visibility

#### COM-19 · Four per-surface visibilities
`progress`, `currentlyReading`, `lexicon` and `readerDna` are independent `profile_visibility` values (`everyone | followers | nobody`). Column defaults, RPC defaults and the PWA's `DEFAULT_PRIVACY` are all `'nobody'`. The PWA form lists them in the order Currently reading, Reading progress, Lexicon, Reading DNA ([PRO-83](07-profile-stats-goals.md#pro-83--privacy-settings)).
- **Enforced:** `server:db` (enum + defaults); `server:rpc`; `client`.
- **Source:** `src/composables/useCommunityIdentity.ts:28-33`; `src/pages/ProfileEditPage.vue:64-75`.
- **Target:** iOS v1 has no privacy UI and never writes privacy values (D-13 · BC-11, COM-14).

#### COM-20 · `is_public = false` is a master switch — except inside circles
For anyone other than the owner, a private profile:
- makes `get_public_profile_by_username` return `null`, whatever the per-surface settings;
- is excluded from search, from other people's follower and following lists, and from also-reading;
- cannot be followed (`community_can_view_profile`).

Followers of a private profile see nothing.

`is_public` has **no effect inside Reading Circles**. These surfaces inner-join `community_profiles` **without** an `is_public` filter:
- `get_reading_circle_detail` `members[]` and `pendingInvitations[]`;
- `list_my_reading_circles` `invitedBy`;
- `get_visible_circle_reactions` authors.

A private user is therefore shown by username, display name and avatar to everyone who shares a circle with them ⚠ COM-D07.
- **Enforced:** `server:rpc` (`community_can_view_profile` and every caller).
- **Source:** live functions.

#### COM-21 · "Followers" means the viewer follows the owner
`followers` visibility is satisfied iff a row `follows(follower_id = viewer, following_id = owner)` exists. A mutual follow is not required.
- **Enforced:** `server:rpc` (`get_public_profile_by_username`, `v_is_follower`; `get_also_reading_for_book`).
- **Source:** live functions.

#### COM-22 · The owner sees everything (preview)
The owner calling `get_public_profile_by_username` on their own username sees every section, whatever `is_public` and the privacy settings say.
- **Enforced:** `server:rpc` (`v_is_owner` branches).
- **Source:** live function.

#### COM-23 · A block hides the profile both ways
A block in either direction makes `get_public_profile_by_username` return `null` for both parties.
- **Enforced:** `server:rpc` (`v_blocked`).
- **Source:** live function.

#### COM-24 · Interaction reason
`community_interaction_reason(viewer, target)` is evaluated in this order:
1. either id is null → `profile_unavailable`;
2. viewer = target → `self`;
3. a block in either direction → `blocked`;
4. the target has no profile, or `is_public = false` → `profile_unavailable`;
5. otherwise → `allowed`.

These four strings are the full value set.
- **Enforced:** `server:rpc`.
- **Source:** live `community_interaction_reason`.

#### COM-25 · Can the viewer see the target's profile?
`community_can_view_profile(viewer, target)`:
- false if either id is null;
- for self, true iff the viewer's own profile row exists;
- false if there is a block in either direction;
- otherwise true iff the target's profile exists **and** `is_public`.
- **Enforced:** `server:rpc` (helper).
- **Source:** live function.

#### COM-26 · Relationship payload masks counts, not flags
`community_relationship_payload` returns:
- `followersCount` / `followingCount` — real only when the reason is `allowed` or `self`, otherwise `0`;
- `isFollowing`, `followsViewer`, `isBlockedByViewer`, `hasBlockedViewer` — always computed from the raw rows.

A blocked user can therefore learn that they are blocked (`hasBlockedViewer: true`) ⚠ COM-D06.
- **Enforced:** `server:rpc` (`get_community_relationship_state`, `follow_community_user`, `unfollow_community_user`).
- **Source:** live function.
- **Note:** whether to expose this is COM-Q04.

### C. Public profile payload (`get_public_profile_by_username`)

#### COM-27 · Always-present section
When the profile is visible, the payload always includes `profile {userId, username, displayName, bio, avatarUrl}`. It carries no `isPublic`, no counts and no relationship; those come from `get_community_relationship_state`.
- **Enforced:** `server:rpc`.
- **Source:** live function.
- **Note:**
  - The lookup compares the stored username with the normalised input (COM-03). Stored usernames are always lowercase (COM-04), so the lookup is effectively case-insensitive.
  - A profile without a privacy row returns `null` (COM-02).

#### COM-28 · `stats` (gated by `progress`)
| Field | Definition |
|---|---|
| `booksRead` | Count of the owner's books with `total_pages > 0` and `reading_progress.current_page >= total_pages`. DNF (`dnf_at`) and `books.source` are ignored, so imported books count |
| `totalPagesRead` | `Σ least(greatest(current_page, 0), total_pages)` over all books. Imports are **included**, unlike `get_reading_stats`, which excludes `source <> 'manual'` |
| `currentStreakDays` / `longestStreakDays` | From distinct `date(progress_history.recorded_at)` in the DB time zone (UTC). The current streak counts only if its last day is `current_date` or `current_date - 1` (UTC) |

These numbers diverge from the owner's own stats ⚠ COM-D23.
- **Enforced:** `server:rpc`.
- **Source:** live function.
- **Target:** the signature stays unchanged and the streak days use the **owner's** stored time zone (D-07 · BC-06).
- **Note:** aligning the remaining definitions (imports, DNF, `completed_at` from BC-04) is COM-Q17.

#### COM-29 · `currentlyReading` (gated by `currentlyReading`, not by `progress`)
The single most recently updated book (`reading_progress.updated_at desc`) with `0 < current_page < total_pages`. Fields: `bookId, title, author, coverUrl, currentPage, totalPages, percentage`, where `percentage = least(100, round(current_page / total_pages × 100, 2))`. The key is omitted when no book qualifies.
- DNF-shelved books are **not** excluded ⚠ COM-D25.
- `currentPage` and `percentage` are returned even when `progress` is `nobody` ⚠ COM-D06.
- **Enforced:** `server:rpc`.
- **Source:** live function.
- **Note:** the scope differs from also-reading, which reveals **any** matching in-progress book (COM-57).

#### COM-30 · `lexiconHighlights` (gated by `lexicon`)
Up to **6** `lexicon_entries` with `leitner_box >= 5`, newest `created_at` first. Fields:
- `term`;
- `bookTitle` — left join, may be null;
- `masteredAt` — the entry's `created_at`, not a mastery time.

The key is omitted when the array is empty.

The rule does **not** use the `mastered` flag (LEX-32) and does **not** exclude `entry_type = 'quote'` ⚠ COM-D24. `bookTitle` reveals books even when `currentlyReading` is `nobody` ⚠ COM-D06.
- **Enforced:** `server:rpc`.
- **Source:** live function; [05 · Codex & Lexicon](05-codex-lexicon.md) LEX-100.

#### COM-31 · `readerDna` (gated by `readerDna`)
`{personality, moodTone, moodEmojis[]}` from `reading_dna`; `moodEmojis` defaults to `[]`. The key is omitted when no row exists.
- **Enforced:** `server:rpc`.
- **Source:** live function. `reading_dna` is written by the `generate-reading-dna` flow ([07](07-profile-stats-goals.md)).

#### COM-32 · Hidden and empty look the same
A section hidden by privacy and an empty section are indistinguishable: in both cases the key is **absent**, not `null`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### D. Follow graph

#### COM-33 · Follows are asymmetric; no self-follow
`follows` has the primary key `(follower_id, following_id)`. Self-follow is impossible: CHECK `follows_no_self_chk` rejects it, and the RPC returns reason `self` without inserting.
- **Enforced:** `server:db`; `server:rpc`.
- **Source:** live constraints; `follow_community_user`.
- **Target:** the direct-insert policy `follows_follower_insert` is dropped, so follows are written only by `follow_community_user` (BC-01).

#### COM-34 · Follow only when allowed; never an exception
`follow_community_user(target)` inserts only when the interaction reason is `allowed` (the target has a public profile and there is no block). Otherwise it returns the relationship payload with `changed:false` and the `reason` — **no exception**. A duplicate follow is idempotent (`on conflict do nothing`, `changed:false`).
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-35 · The follower needs no profile
Only the target's profile is checked: a user without a community profile can follow ⚠ COM-D17.
- **Enforced:** `server:rpc`.
- **Source:** live `follow_community_user`.
- **Note:** whether social actions should require a profile is COM-Q05.

#### COM-36 · Unfollow always works
`unfollow_community_user` deletes the viewer's edge regardless of blocks or privacy; `changed` = a row was deleted. It never raises except `not_authenticated`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-37 · Follows survive the target going private
An existing follow is kept when the target sets `is_public = false`. The reason becomes `profile_unavailable` and counts are masked to 0, but `isFollowing` stays `true`, so clients should still offer Unfollow.
- **Enforced:** `server:rpc` (consequence of COM-24 / COM-26).
- **Source:** live functions.

### E. Blocking

#### COM-38 · Block RPC
`block_community_user(target)`:
- **Self:** returns `{targetUserId, isBlockedByViewer:false, removedFollowsCount:0, changed:false, reason:'self'}`.
- **Otherwise:** inserts `blocks(viewer, target)` (`on conflict do nothing`).
- **Target existence:** the target need not have a profile. A non-existent user id raises FK `23503` (`blocks_blocked_id_fkey`); a null id raises NOT NULL `23502`.
- **Response:** `{targetUserId, isBlockedByViewer:true, removedFollowsCount, changed}`. `removedFollowsCount` is always **0** for a new block, because the trigger in COM-39 deletes the follows before the RPC's own `community_remove_pair_follows` call ⚠ COM-D12.
- **Enforced:** `server:rpc`; `server:db`.
- **Source:** live function.

#### COM-39 · Block side effects
When a new `blocks` row is inserted, by RPC or directly (COM-108), AFTER INSERT triggers fire in alphabetical order:

1. **`circle_block_cleanup_memberships`:**
   - **Deletes** (does not revoke) every **pending** `circle_invitations` row whose invitee is one of the pair, in any circle where one of the pair is a member.
   - **Deletes the blocked user's `circle_members` row** from every circle where the blocker is a member — including when the blocked user is that circle's **owner** (ownerless circle ⚠ COM-D13).
   - Sets `status = 'closed'` on **every** active circle in the system that has zero members. The sweep is global, so whether an unrelated orphan circle is still "active" depends on other users' blocks.
2. **`community_block_cleanup_follows` → `community_remove_pair_follows`:** deletes follows in **both** directions; the follow triggers decrement the counts.

The blocker is never evicted.
- **Enforced:** `server:db` (triggers).
- **Source:** live `circle_block_cleanup_memberships`, `community_block_cleanup_follows`.
- **Note:** `community_remove_pair_follows` is also directly callable by `anon` ⚠ COM-D01. Owner-eviction policy is COM-Q11.

#### COM-40 · Unblock restores nothing
Unblock deletes only the viewer's own block row; `changed` = a row was deleted. Follows, memberships and invitations are **not** restored. A block placed by the other party is untouched.
- **Enforced:** `server:rpc` (`unblock_community_user`).
- **Source:** live function.

### F. Follow counts

#### COM-41 · Trigger-maintained counts
`community_follow_counts(user_id, followers_count, following_count)` is maintained by the trigger function `community_follow_counts_after_follow()`, which branches on `TG_OP`:
- **AFTER INSERT on `follows`:** ensure rows exist (only for users **with** a profile), then +1 `following_count` for the follower and +1 `followers_count` for the target.
- **AFTER DELETE:** `greatest(x − 1, 0)`.

A profile-less follower's `following_count` is never tracked. When that user later creates a profile, their row starts at `(0, 0)` ⚠ COM-D20.
- **Enforced:** `server:db`.
- **Source:** live triggers `community_follow_counts_after_follow_insert` / `_delete`.
- **Note:** live drift on 2026-10-18 is 0 rows.

#### COM-42 · Reconciliation exists but never runs
`community_reconcile_follow_counts()` recomputes every count from `follows` for users with profiles. It is never scheduled (no `pg_cron`), no client calls it, and today any authenticated user can execute it ⚠ COM-D02, COM-D20.
- **Enforced:** none (manual only).
- **Source:** live function and grants.
- **Target:** service-role only (BC-01). Scheduling it belongs to the Community phase.

#### COM-43 · Counts are broader than lists
Counts include follows from and to profile-less and private users. They are shown only when the reason is `allowed` or `self` (COM-26), while lists exclude those users (COM-49), so a displayed count can exceed the list length ⚠ COM-D30.
- **Enforced:** `server:rpc`.
- **Source:** live functions.

### G. Discovery — search

#### COM-44 · Search input
`search_community_readers(p_query, p_limit = 20, p_cursor = null)` normalises the query with `lower(trim())`. A query of **fewer than 2 characters** returns `{items:[], nextCursor:null}`, and so does an unauthenticated call.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-45 · Prefix matching on username or whole display name
Matching is a case-insensitive **prefix** match on `username` **or** on the whole `display_name` (`LIKE query || '%'`). There is no infix or word match: a surname inside a display name does not match.

`%` and `_` in the query are **not escaped** and act as SQL wildcards, so a query such as `%%` enumerates every public profile despite the 2-character minimum ⚠ COM-D08.
- **Enforced:** `server:rpc`.
- **Source:** live function; indexes `community_profiles_public_username_created_idx`, `community_profiles_public_display_name_created_idx`.

#### COM-46 · Search exclusions
Candidates exclude the viewer, profiles with `is_public = false`, and any user with a block in either direction.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-47 · Ordering is by profile age, not relevance
Results are ordered `created_at desc, user_id desc` (newest profiles first). The limit is clamped to `[1, 50]`.
- **Enforced:** `server:rpc`.
- **Source:** live function.
- **Note:** `created_at` can be set by a direct table write (COM-108). Search semantics are COM-Q15.

#### COM-48 · Search item fields
Each item carries `userId, username, displayName, bio, avatarUrl, isFollowing, followsViewer, followersCount, followingCount`. Counts are unmasked, because every listed user is `allowed`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### H. Follower, following & blocked lists

#### COM-49 · Who appears in follower / following lists
`list_community_followers(p_user_id, …)` and `list_community_following(p_user_id, …)` return nothing unless the viewer can view the target (`community_can_view_profile`: public and unblocked, or self).

Listed users must have a profile, be `is_public`, and have no block with the **viewer**; a block with the target is irrelevant. Even the owner cannot see their private or profile-less followers through the RPC.

Direct REST reads, however, expose raw edges (ids only):
- RLS `follows_participant_select` lets either participant SELECT a follow row;
- `blocks_participant_select` lets a **blocked** user SELECT the block row that names who blocked them ⚠ COM-D06.
- **Enforced:** `server:rpc`; `server:db` (RLS).
- **Source:** live functions and policies.
- **Note:** owner visibility of their own followers is COM-Q06.

#### COM-50 · List ordering and fields
Lists are ordered `follows.created_at desc, user_id desc`. Item fields: `userId, username, displayName, avatarUrl, followedAt, isFollowing`, where `isFollowing` = the viewer follows that listed user. The limit defaults to 20, clamped to `[1, 50]`.
- **Enforced:** `server:rpc`.
- **Source:** live functions.

#### COM-51 · Blocked list
`list_my_blocked_users(p_limit = 20, p_cursor)` returns the viewer's own blocks only, ordered `blocked_at desc, user_id desc`. Profiles are `LEFT JOIN`ed, so `username`, `displayName` and `avatarUrl` may be null for users without a profile.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### I. Cursors & pagination

#### COM-52 · Community cursor format
`search`, followers / following and blocked lists use `community_encode_cursor(ts, userId)`: base64 of the JSON text `{"userId": "...", "createdAt": "<timestamptz ISO>"}`. The key is `createdAt` even when the value is a `followedAt` or `blockedAt`. Postgres `encode(…, 'base64')` inserts a newline every 76 characters, so the cursor string contains `\n`. Treat it as opaque and pass it back verbatim.
- **Enforced:** `server:rpc`.
- **Source:** live `community_encode_cursor`.

#### COM-53 · Community cursor decode errors are lenient and inconsistent
| Cursor | Result |
|---|---|
| Bad base64 or bad JSON | Silently treated as **no cursor**: page 1 is returned again (`community_cursor_payload` swallows errors) ⚠ COM-D40 |
| Decodable JSON whose `createdAt` is not a timestamp | Raw `22007` |
| Decodable JSON whose `userId` is not a uuid | Raw `22P02` |
| Valid JSON missing `createdAt` or `userId` | The row comparison `(created_at, user_id) < (NULL, NULL)` is NULL, so the result is `{items:[], nextCursor:null}`: an empty last page with no error |

- Both casts run in the DECLARE section, before the auth check.
- The base64 decoder ignores embedded whitespace, so a cursor whose `\n` was stripped still decodes.
- A URL-safe base64 rewrite (`-` / `_`) does not decode and silently resets to page 1.
- **Enforced:** `server:rpc`.
- **Source:** live `community_cursor_payload` and callers.

#### COM-54 · Community list paging is gap-free
Community lists use keyset paging: fetch `limit + 1` rows, return `limit`. `nextCursor` is the key of the **last returned** (oldest) item, and the next page takes rows strictly `<` that key. Search, followers / following and blocked lists therefore page correctly, with no gaps.
- **Enforced:** `server:rpc`.
- **Source:** live functions.

#### COM-55 · Also-reading, reaction and circle-list cursors
- **Also-reading:** base64 JSON `{"updatedAt", "userId"}`. An invalid cursor raises **`invalid_cursor`**, strictly, unlike COM-53. `also_reading_cursor_payload` requires both keys and maps `22007` / `22P02` cast failures to `invalid_cursor`. It runs in the DECLARE initialiser of `get_also_reading_for_book`, so a bad cursor raises `invalid_cursor` **before** `not_authenticated` and even when `p_book_id` is null.
- **Reactions and the circles list:** plain `timestamptz::text`, e.g. `2026-10-18 12:34:56.789012+00`. An invalid cursor surfaces as raw `22007` / `22008` ⚠ COM-D40.

Paging bugs: COM-65, COM-84, COM-92.
- **Enforced:** `server:rpc`.
- **Source:** live `also_reading_cursor_payload`, `get_visible_circle_reactions`, `list_my_reading_circles`.

### J. Also reading (`get_also_reading_for_book`)

#### COM-56 · Auth and the viewer's own book
The caller must be authenticated (`not_authenticated` is raised). A null `p_book_id`, or one the caller does not own, returns `{items:[], nextCursor:null, totalVisible:0}`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-57 · Population = people the viewer follows
The population is users **the viewer follows** (`follows.follower_id = viewer`), not the viewer's followers. Each must pass `community_can_view_profile` (public, no block) and have `currently_reading_visibility ∈ {everyone, followers}`. Because the viewer follows them, `followers` qualifies, and `nobody` excludes the user entirely.

The **viewer's** own profile, `is_public` and privacy settings are irrelevant: a viewer who is profile-less, private, or has `currentlyReading = nobody` still sees the readers they follow.

`p_isbn` overrides the viewer's own book ISBN, and only ownership of `p_book_id` is checked. A viewer can therefore probe arbitrary ISBNs and enumerate **every** in-progress book of the readers they follow whose `currentlyReading` ≠ `nobody` — not just their latest one (COM-29) ⚠ COM-D05.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-58 · The candidate's copy must be in progress
The candidate's book must have `total_pages > 0` and `0 < current_page < total_pages`. Completed books (`current_page >= total_pages`) are excluded; DNF books (`dnf_at`) are **not** ⚠ COM-D25.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-59 · Matching by ISBN only, in practice
- **`same_book`:** `rp.book_id = p_book_id`.
- **`same_isbn`:** `normalize_isbn(their book.isbn) = normalize_isbn(coalesce(nullif(btrim(p_isbn), ''), viewer book.isbn))`.

`books` rows are per user, so another user can never hold the viewer's `book_id`. **In practice every match is `same_isbn`, and books without an ISBN never match** ⚠ COM-D18.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-60 · `normalize_isbn`
`normalize_isbn(x) = nullif(upper(regexp_replace(coalesce(x, ''), '[^0-9X]', '', 'g')), '')`. It keeps digits and **uppercase** `X` only; a lowercase `x` is stripped **before** `upper` ⚠ COM-D19. There is no ISBN-10 ↔ ISBN-13 conversion, so different editions or formats never match.
- **Enforced:** `server:rpc` (immutable invoker function; also backs the index `books_normalized_isbn_user_idx`).
- **Source:** live function; [LIB-117](01-library.md#lib-117--normalize_isbn-semantics).
- **Target:** `normalize_isbn` uppercases before stripping, and new and edited ISBNs are normalised on write (BC-15). ISBN-10 → 13 conversion on save is open (OP-15.1); if adopted, the two forms of one edition match.
- **Note:** the lowercase-`x` bug affects only `p_isbn` input, because the `books.isbn` CHECK already forbids lowercase (COM-106).

#### COM-61 · One row per followed user
Rows are reduced with `DISTINCT ON (user_id)`, preferring match rank 0 (`same_book`), then the most recent `updated_at`, then `matched_book_id`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-62 · Progress fields follow the candidate's `progress` visibility
`currentPage`, `totalPages` and `percentage` are returned only when the candidate's `progress_visibility ∈ {everyone, followers}`, otherwise `null`. `percentage = least(100, round(current / total × 100, 2))`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-63 · `relativeStatus`
| Condition | Value |
|---|---|
| Their progress is hidden, the viewer has no `reading_progress` row for `p_book_id`, or a percentage is null | `null` |
| `|theirPct − viewerPct| <= 10` percentage points (inclusive) | `'same_area'` |
| Theirs is greater | `'ahead'` |
| Otherwise | `'behind'` |

`viewerPct` is computed from the viewer's own row and the viewer's total pages. A row with `current_page = 0` gives 0, so a reader who has not started sees everyone as `ahead` or `same_area`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-64 · Other also-reading fields
- `updatedAt` (their `reading_progress.updated_at`) is **always** returned, even when progress is hidden ⚠ COM-D06.
- `matchedIsbn` is returned only for `same_isbn`.
- `totalVisible` counts every match before pagination and ignores the cursor; it powers "N people you follow…".
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-65 · Also-reading ordering and paging
Results are ordered `updated_at desc, user_id asc`; the limit defaults to **3**, clamped to `[1, 20]`. `nextCursor` encodes row `limit + 1`, and the next page starts strictly after it, so **one item per page is skipped** ⚠ COM-D09.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### K. Reading circles — creation

#### COM-66 · `create_reading_circle` input
`create_reading_circle(p_book_id, p_name, p_invited_user_ids = '{}')`:
- **Name:** `btrim`med; it must be 1–80 characters, else `invalid_circle_name`. CHECK `reading_circles_name_not_blank` backs this.
- **Book:** must be owned by the caller, else `invalid_book`.
- **Check order:** `not_authenticated` → `invalid_circle_name` → `invalid_book`.
- **No other requirements:** no ISBN, no in-progress state, no community profile for the creator, and no limit on circles per user or per book.

`btrim` strips only spaces, so a name made only of tabs or newlines passes both the RPC and the CHECK ⚠ COM-D28. `length()` counts code points (80 code points, not UTF-16 units or graphemes).
- **Enforced:** `server:rpc`; `server:db`.
- **Source:** live function and CHECK.

#### COM-67 · Snapshot at creation
The circle snapshots `title`, `author`, `cover_url` and `normalized_isbn = normalize_isbn(book.isbn)` at creation. Later edits to the creator's book are **not** propagated. `owner_id = created_by = caller`, `status = 'active'`, and `canonical_book_id` is never set (unused column) ⚠ COM-D18.
- **Enforced:** `server:rpc`.
- **Source:** live function; live snapshot (0 circles with `canonical_book_id`).

#### COM-68 · The creator becomes the owner
The creator is inserted into `circle_members` with `role = 'owner'`. The unique partial index `circle_members_one_owner_idx` enforces one owner per circle.
- **Enforced:** `server:rpc`; `server:db`.
- **Source:** live function and index.

#### COM-69 · Initial invitations
Each id is processed in array order:
- null or self → skipped;
- the caller does not follow the target (`follows(caller → target)`), or a block exists in either direction → skipped;
- a pending invitation already exists in this circle (e.g. a duplicate id in the array) → skipped;
- otherwise a pending invitation is inserted and the id goes to `invitedUserIds`.

The response is `{circleId, created:true, invitedUserIds[], skippedUserIds[]}`; `skippedUserIds` may contain `null`.

Eligibility is **only** "a `follows(caller → target)` row exists and there is no block":
- the target need not follow back;
- the target's current `is_public` and profile existence are not re-checked, so a user who went private after being followed (COM-37) can still be invited;
- neither create nor invite checks the 10-member cap, which is enforced only at accept time (COM-73).
- **Enforced:** `server:rpc`.
- **Source:** live function.

### L. Invitations

#### COM-70 · Inviting more members
`invite_reading_circle_members(p_circle_id, p_user_ids)`: the caller must be the owner of an **active** circle (`circle_user_is_owner` requires `status = 'active'`), else `not_circle_owner`.

Each id is processed as follows:
- null or self, not followed by the caller, or blocked → skipped;
- already a member → skipped;
- otherwise `insert … on conflict do nothing`, and the id is **always reported as invited**, even when a pending invitation already existed and no row was inserted ⚠ COM-D15.

Members who left or were removed are no longer members, so they can be re-invited immediately.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-71 · One pending invitation per (circle, user)
The unique partial index `circle_invitations_pending_unique_idx` allows at most one pending invitation per circle and user. Non-pending history rows accumulate. A declined or revoked user can be re-invited immediately: there is no cooldown, no cap on pending invitations, and the member cap is not checked at invite time.
- **Enforced:** `server:db`.
- **Source:** live index.
- **Note:** policy is COM-Q09.

#### COM-72 · Invitation states
| Transition | Trigger |
|---|---|
| `pending → accepted` | The invitee accepts |
| `pending → declined` | The invitee declines |
| `pending → revoked` | The owner calls `remove_reading_circle_member` on that user |
| `pending → (row deleted)` | A block between the invitee and a member (COM-39) |

**`expired` is never set**: invitations never expire. Pending invitations on circles that later close stay `pending` forever ⚠ COM-D22.
- **Enforced:** `server:rpc`; `server:db` (block trigger).
- **Source:** live functions and enum.

#### COM-73 · Responding to an invitation
`respond_to_reading_circle_invitation(p_invitation_id, p_accept)` locks the invitation row `FOR UPDATE`.
- **Not pending:** not found, not addressed to the caller, or not pending → `invitation_not_pending`.
- **`p_accept` null:** treated as a decline.
- **Accept:** requires circle `status = 'active'`, else `circle_not_active`. Decline also works on closed circles.
- **Membership insert:** accepting inserts `circle_members(role = 'member', invitation_id)`. The BEFORE INSERT trigger `circle_members_assert_insert` raises `circle_full` when the circle already has **≥ 10** members, or `blocked` when any existing member has a block with the invitee. Either error rolls back the whole call, so the invitation stays pending.
- **Not re-checked:** that the owner still follows the invitee, or that the invitee owns the book.
- **Enforced:** `server:rpc`; `server:db` (trigger).
- **Source:** live function; trigger function `circle_assert_member_insert`.

#### COM-74 · Response shape
`{circleId, invitationId, status: 'accepted' | 'declined', member: {userId, role:'member', joinedAt} | null}`. The RPC sets `responded_at = now()`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### M. Membership, leave, remove, close

#### COM-75 · Member cap: 10 including the owner
The BEFORE INSERT trigger `circle_members_assert_insert` → `circle_assert_member_insert()` raises `circle_full` when `circle_member_count >= 10`. The circle row is not locked; only the invitation row is (COM-73). Two concurrent accepts of different invitations can therefore push the circle past 10 — inferred from READ COMMITTED count-then-insert, not exercised ⚠ COM-D21.
- **Enforced:** `server:db` (trigger).
- **Source:** live trigger function.

#### COM-76 · Leaving a circle
`leave_reading_circle(p_circle_id)`: the caller must be a member of an **active** circle, else `not_circle_member`. The RPC deletes the caller's membership.
- **Owner leaves:** the remaining member with the earliest `joined_at` (tie → lowest `user_id`) becomes `owner` and `reading_circles.owner_id` is updated. If nobody remains, `status = 'closed'`.
- **Non-owner leaves:** the circle is never closed, even by the last member to leave. This matters for the ownerless case (COM-D13).
- **Response:** `{circleId, left:true, newOwnerId | null}`.
- **Kept:** pending invitations stay `pending`, even on a closed circle. The leaver's reactions stay, and so do the reactions of removed (COM-77) and block-evicted (COM-39) users: `get_visible_circle_reactions` checks only that the author has a profile and no block with the viewer, never that they are still a member ⚠ COM-D32.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-77 · Removing a member or revoking an invitation
`remove_reading_circle_member(p_circle_id, p_user_id)` is for the owner of an active circle only (`not_circle_owner`); targeting yourself raises `use_leave_circle`. It deletes the membership and revokes any pending invitation for that user, and raises no error if neither existed. The response is `{circleId, userId, removed, revokedInvitation}`. This is the **only** path that revokes an invitation.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-78 · Circle status
`circle_status` moves `active → closed` only when:
- the owner leaves as the last member (COM-76); or
- block cleanup leaves the circle with zero members (COM-39).

There is no reopen, rename, delete or explicit-close RPC. Closed circles disappear from every RPC, because all of them gate on `status = 'active'`.
- **Enforced:** `server:rpc`; `server:db`.
- **Source:** live functions.

### N. Circle detail & list

#### COM-79 · Who can open a circle's detail
`get_reading_circle_detail(p_circle_id)` returns `null` unless the caller is a member of an active circle and no member has a block with the caller (`circle_members_have_block`).
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-80 · Detail `members[]`
- **Inner join to profiles:** members without a profile are omitted ⚠ COM-D17.
- **No count field:** the detail has no `memberCount`, `status` or `ownerId`. Profile-less members are still counted in `list_my_reading_circles` `circle.memberCount`, so the list count can exceed `members.length` ⚠ COM-D30.
- **Owner:** identified only by `role:'owner'` within `members[]`, and missing when the owner has no profile.
- **Block exclusion:** users blocked with the viewer are excluded. This is redundant, because a block with any member already makes the detail `null`.
- **Order:** `role desc, joined_at asc`. With the enum order `owner (1) < member (2)`, this lists **members first and the owner last** ⚠ COM-D14.
- **Enforced:** `server:rpc`.
- **Source:** live function; `pg_enum`.

#### COM-81 · Detail `pendingInvitations[]`
Populated only for the owner (otherwise `[]`): pending invitations only, newest first, inner-joined to profiles.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-82 · Detail `viewer` and the circle's book id
`viewer {role, currentPage, totalPages, normalizedLocation}` comes from `circle_progress_location(circle, viewer)` (COM-88). All of it is null when the viewer has no matching progress. No RPC exposes other members' progress — but the helper itself can be called directly with any user id ⚠ COM-D02.

`circle_progress_location` returns the viewer's matched `book_id`, but the detail payload **drops it**. `book.bookId` in the detail and the list is the **creator's** book (`reading_circles.book_id`), which no other member owns.

To call `add_circle_reaction`, a non-creator client must pick **its own** matching book locally: the same id (creator only), or `normalize_isbn(book.isbn) == book.normalizedIsbn`. Passing `book.bookId` from the payload returns `invalid_book` for everyone except the creator ⚠ COM-D31.
- **Enforced:** `server:rpc`.
- **Source:** live functions.
- **Note:** adding `viewer.bookId` is COM-Q19.

#### COM-83 · My circles and invitations feed
`list_my_reading_circles(p_limit = 20, p_cursor)` returns the union of:
- **(a) circles:** active circles where the caller is a member and no member has a block with the caller, sorted by `reading_circles.updated_at`. That changes only on owner hand-off or close, so it is effectively the creation time.
- **(b) invitations:** pending invitations to the caller in active circles whose inviter has no block with the caller **and has a community profile** (inner join), sorted by `invitation.created_at`.

The merged order is `sort_at desc`. Ties are broken by the type text for row numbering, but not within the aggregated array.

Payload fields:
- `pendingInviteCount` is filled only for owners, and counts **all** pending invitations, including those to profile-less invitees. The detail's `pendingInvitations[]` inner-joins profiles, so the two can disagree ⚠ COM-D30.
- `latestReactionAt` is always `null` (placeholder).

Invitation rows check only for a block between the viewer and the **inviter**; they do not run `circle_members_have_block`. An invitation to a circle where another member has a block with the viewer is therefore listed, but accepting it fails with `blocked` ⚠ COM-D29. Invitations whose inviter has since left or been evicted are still listed and acceptable.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-84 · Circles-list paging
The circles list returns **up to `limit + 1` items** per page. `nextCursor` is `sort_at::text` of item `limit + 1`, and the next page takes `sort_at < cursor`. Items that share the cursor timestamp are dropped ⚠ COM-D11. The limit is clamped to `[1, 50]`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### O. Reactions — posting (`add_circle_reaction`)

#### COM-85 · Check order and inputs
1. `not_authenticated`.
2. `not_circle_member` (active circle).
3. `blocked` (any member has a block with the caller).
4. `invalid_reaction_content` (trimmed length < 1 or > 280).
5. `invalid_circle` — unreachable after the membership check.
6. `invalid_book` — the book is not owned by the caller, or does not match the circle by id or `normalized_isbn`. The `total_pages <= 0` branch is unreachable, because `books_total_pages_check` enforces `total_pages >= 1`; every `total_pages > 0` guard in this domain is always true.
7. `invalid_page` (`p_source_page < 1` or `> total_pages`).
8. `invalid_progress` (no `reading_progress` row for the passed book, or `current_page <= 0`).
9. `reaction_ahead_of_progress`.

Progress is read from the `reading_progress` row of the **passed** `p_book_id`, not from `circle_progress_location`. A user with two matching copies can therefore be gated differently when posting than when viewing.

Content is `btrim`med, which strips only spaces: newline- or tab-only content passes both the RPC and the CHECK ⚠ COM-D28. Length is measured in code points (`length()`).
- **Enforced:** `server:rpc`; `server:db`.
- **Source:** live function.

#### COM-86 · Location math: post only at or behind your saved position
`normalized_location = clamp(round(source_page / total_pages × 100, 3), 0, 100)`. The author's progress location is computed the same way from `current_page`, and the post is rejected when the reaction location > the progress location. Authors can only post **at or behind** their own saved server-side position.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-87 · What is stored
The RPC stores `circle_id, author_id, book_id, source_page, source_total_pages` (= the book's `total_pages` at post time), `normalized_location` and the trimmed `content`.

Table CHECKs:
- `circle_reactions_content_length` (content 1–280 trimmed);
- `circle_reactions_location_range` (0–100);
- `circle_reactions_page_positive` (`source_page > 0`);
- `circle_reactions_page_in_range` (`source_page <= source_total_pages`);
- `circle_reactions_total_pages_positive` (`source_total_pages > 0`).

The response is `{reactionId, circleId, normalizedLocation, createdAt}`. No edit, delete, soft delete (`deleted_at` is unused), report or rate limit exists. A null `p_source_page` slips past the checks and fails with raw `23502`.
- **Enforced:** `server:rpc`; `server:db`.
- **Source:** live function and CHECKs.

### P. Reactions — reading (`get_visible_circle_reactions`)

#### COM-88 · The viewer's position
The viewer's position is `circle_progress_location(circle, viewer)`:
- the book is either the circle's `book_id` (preferred) or one whose `normalize_isbn(isbn) = circle.normalized_isbn`;
- it needs `total_pages > 0` and `current_page > 0` (a completed book qualifies);
- the most recently updated match wins;
- location = `clamp(round(current / total × 100, 3), 0, 100)`.
- **Enforced:** `server:rpc` (helper).
- **Source:** live function.

#### COM-89 · No access and no progress look the same
Non-members, blocked viewers, closed circles **and** viewers without progress all get `{items:[], nextCursor:null, viewerProgressMissing:true}` ⚠ COM-D16.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-90 · The visible window
- `v_min = max(coalesce(p_min_location, 0), 0)`.
- `v_max = min(coalesce(p_max_location, viewerLoc), viewerLoc, 100)`.

Visible items have `normalized_location BETWEEN v_min AND v_max` (inclusive: a reaction at exactly the viewer's location is visible) and `deleted_at is null`; their author has no block with the viewer and **has a community profile** (inner join) ⚠ COM-D17.

Gating is by **percentage of the book**, not by page number, so different editions line up.
- **Enforced:** `server:rpc`.
- **Source:** live function; index `circle_reactions_circle_location_idx`.

#### COM-91 · `viewerEquivalentPage`
`viewerEquivalentPage = clamp(ceil(normalized_location / 100 × viewer.total_pages), 1, viewer.total_pages)`: the reaction's position translated into the viewer's edition.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-92 · Reaction ordering and paging
Reactions are ordered `created_at desc, id asc` (newest first). The limit defaults to 50, clamped to `[1, 100]`. `nextCursor` is `created_at::text` of item `limit + 1`, and the next page takes `created_at < cursor`. **One item per page is skipped**, and items sharing the cursor timestamp are dropped ⚠ COM-D10. When the viewer has progress, `viewerProgressMissing` is `false`.
- **Enforced:** `server:rpc`.
- **Source:** live function.

#### COM-93 · Gating follows the current server position
Gating is evaluated on every call from current server state. If the viewer's saved progress goes backwards, previously visible reactions become hidden again.
- **Enforced:** `server:rpc`.
- **Source:** live function.

### Q. Cascades & lifecycle interactions with the reading domain

#### COM-94 · Deleting a book can delete a whole circle
- **Creator deletes the anchoring book:** `reading_circles.book_id → books ON DELETE CASCADE` deletes the **entire circle** — all members, invitations and reactions — even after ownership moved to someone else.
- **Member deletes their copy:** `circle_reactions.book_id → books ON DELETE CASCADE` deletes all of that member's reactions on that copy, in every circle.
- **Enforced:** `server:db` (FKs).
- **Source:** `src/stores/books.ts:417` (the client delete); live FKs; [LIB-88](01-library.md#lib-88--delete-cascade), [BE-72](09-database-invariants.md#be-72--deleting-a-book).
- **Note:** policy is COM-Q08.

#### COM-95 · Deleting a user
Deleting an `auth.users` row cascades:
- `community_profiles`, `community_profile_privacy`, `community_follow_counts`;
- `follows`, `blocks`;
- memberships;
- invitations, as invitee or as inviter;
- reactions;
- every circle where the user is `owner_id` **or** `created_by`.

Storage objects are not touched (COM-105).
- **Enforced:** `server:db` (FKs).
- **Source:** live FKs; [BE-73](09-database-invariants.md#be-73--deleting-a-user).
- **Target:** account deletion is an immediate hard delete through the `delete-account` edge function with confirmation and re-auth, on web and iOS:
  1. Purge `community-avatars/{uid}/` (and `recap-images/{uid}/`) through the Storage API.
  2. Revoke the Sign in with Apple token.
  3. Call `auth.admin.deleteUser`; the FK cascades remove the rows.

  The confirmation copy lists the (dormant) circles the user owns (D-10 · BC-11).

#### COM-96 · Deleting only the community profile
RLS (`community_profiles_owner_delete`) allows a direct DELETE of one's own profile row. It cascades to privacy and counts, but follows, blocks and circles remain (they reference `auth.users`). No RPC or UI deletes a profile.
- **Enforced:** `server:db` (RLS + FKs).
- **Source:** live policy; [BE-74](09-database-invariants.md#be-74--deleting-a-community-profile).
- **Note:** a "leave community" action is COM-Q16.

#### COM-97 · Completion, DNF and page edits have no community triggers
- **Completion:** moves a reader out of also-reading (COM-58) and out of public `currentlyReading` (COM-29). Nothing is deleted.
- **DNF:** does not remove the book from either (COM-D25).
- **`total_pages` edits:** change future location math, but not stored reactions (`source_total_pages` is frozen at post time).

The `reading_progress` triggers do not touch community tables.
- **Enforced:** `server:db` (absence of triggers).
- **Source:** live trigger list; [11 · Cross-domain](11-cross-domain.md).

#### COM-98 · Only server-side progress counts for circles
Progress unlocks reactions and allows posting only after it reaches `reading_progress` on the server. An offline-queued save does neither until it is replayed.
- **Enforced:** `server:rpc` (reads `reading_progress` only).
- **Source:** live functions; [SES-77](02-reading-sessions.md#ses-77--what-an-offline-save-does-and-skips).
- **Target:** offline saves replay through `save_progress` with their original timestamp (D-08 · BC-04); circle gating still sees them only after the replay lands.

### R. Avatar storage

#### COM-99 · `community-avatars` bucket
- **Bucket:** **public** — any object is readable by its public URL with no auth. Size limit 5 MiB (`file_size_limit 5242880`); MIME types `image/jpeg`, `image/png`, `image/webp`.
- **Storage RLS:** `community_avatars_owner_insert/select/update/delete`, role `authenticated`. The first path segment must equal `auth.jwt()->>'sub'`, the **lowercase** UUID text.
- **Listing:** owner-only.
- **Enforced:** `server:db` (Storage RLS + bucket settings).
- **Source:** live `storage.buckets`, `storage.objects` policies; [BE-70](09-database-invariants.md#be-70--community-avatars-bucket).
- **Target (recommended — BC-13):** a daily sweep deletes `{uid}/` objects older than 24 h that are not the profile's current `avatar_url`. The delete-account purge is decided (D-10 · BC-11).

#### COM-100 · PWA avatar path and URL
The PWA uploads to `{userId}/avatar-{Date.now()}.jpg` with `contentType: 'image/jpeg'` and `upsert: true`, and stores `getPublicUrl(path)` as `avatar_url`. Timestamped names defeat CDN caching, because a path is never overwritten.
- **Enforced:** `client`.
- **Source:** `src/composables/useCommunityIdentity.ts:121-146`; [PRO-86](07-profile-stats-goals.md#pro-86--avatar-upload).
- **Note:** the public URL form is `{SUPABASE_URL}/storage/v1/object/public/community-avatars/{uid}/avatar-{ms}.jpg`. Order and cleanup are COM-110.

#### COM-105 · Storage objects cannot be deleted from SQL
`storage.objects` carries the trigger `protect_objects_delete` (`storage.protect_delete()`, statement-level BEFORE DELETE). It raises `42501` "Direct deletion from storage tables is not allowed. Use the Storage API instead." unless `storage.allow_delete_query` is set. Avatar cleanup — on profile deletion, account deletion or replacement — therefore **cannot** be a SQL cascade or trigger: it must call the Storage API, for example from an edge function using the service role.
- **Enforced:** `server:db` (Supabase Storage trigger).
- **Source:** live trigger; [BE-71](09-database-invariants.md#be-71--the-database-never-deletes-storage-objects).
- **Target:** `delete-account` purges the folder through the Storage API (D-10 · BC-11).

### S. Timezone

#### COM-101 · Timestamps are UTC; nothing takes a time zone
- **JSON:** community timestamps are `timestamptz`, serialised in JSON as ISO-8601 with an offset, e.g. `2026-10-18T12:34:56.789012+00:00`. Postgres trims trailing zeros, so the fractional part has 0–6 digits (`…:56+00:00`, `…:56.7+00:00`).
- **Cursors:** the two `::text` cursors use Postgres text format (COM-55).
- **Date bucketing:** the only date-bucketed logic is the public-profile streaks (COM-28), in UTC dates.
- **Settings:** DB `TimeZone = UTC` and `DateStyle = ISO, MDY`, with no per-role override (verified 2026-10-18). No community RPC takes `p_timezone`.
- **Enforced:** `server:db`.
- **Source:** live settings.
- **Target:** public streaks use the owner's stored IANA zone; the signature is unchanged (D-07 · BC-06).

### T. Transport, grants & direct-table access

#### COM-102 · Who can call what
EXECUTE on every community and circle RPC is granted to `authenticated` (plus `service_role` / `postgres`) only, **not `anon`**. A signed-out client (anon key, no user JWT) therefore gets PostgREST `42501 permission denied for function …` (HTTP 401), never the in-function soft paths. The `v_viewer is null` branches (`null` profile, `available:false`, empty search and lists, `not_authenticated`) are unreachable over the API, because an `authenticated` JWT always carries `sub`.

Exceptions — anon / PUBLIC-executable:

| Function | Kind | Risk |
|---|---|---|
| `community_remove_pair_follows` | SECURITY DEFINER | Destructive ⚠ COM-D01 |
| `community_ensure_follow_count` | SECURITY DEFINER | Benign |
| `community_cursor_payload`, `community_encode_cursor` | Invoker | Pure |
| `community_block_cleanup_follows`, `community_ensure_count_on_profile_insert`, `community_follow_counts_after_follow`, `community_profiles_touch_updated_at` | Trigger functions | Cannot be called directly |

All other helpers are executable by any `authenticated` user ⚠ COM-D02.
- **Enforced:** `server:db` (grants).
- **Source:** live `has_function_privilege` scan (2026-10-18).
- **Target:**
  - Revoke `anon` / PUBLIC EXECUTE and fix `pg_default_acl`.
  - Move every `community_*`, `circle_*` and cursor helper into the non-exposed schema `private`, repointing the two RLS policies. `normalize_isbn` stays in `public`.
  - Make `community_reconcile_follow_counts` service-role only.
  - Keep the dormant community and circle RPCs on the `authenticated` allowlist (BC-01). Whether to keep them callable before the Community phase is COM-Q20.

#### COM-103 · Statement timeout
Role `authenticated` has `statement_timeout = 8s` and `anon` 3 s (`pg_db_role_setting`). A community RPC that exceeds it fails with `57014 canceling statement due to statement timeout`; clients treat this as retryable.
- **Enforced:** `server:db`.
- **Source:** live role settings.

#### COM-104 · HTTP mapping a client will see
| SQLSTATE | Cause | HTTP |
|---|---|---|
| `P0001` | Every named error code; body `{code:"P0001", message:"<code>", details:null, hint:null}` | 400 |
| `23503` | FK, e.g. blocking an unknown user id | 409 |
| `23505` | Unique, only on races the RPC does not map | 409 |
| `23502` | NOT NULL (null `p_source_page`, null block target) | 400 |
| `22P02` / `22007` / `22008` | Bad uuid, boolean or timestamp cursor | 400 |
| `42501` | Missing privilege | 401 (anon) / 403 (authenticated) |
| `57014` | Statement timeout (COM-103) | — |

- **Enforced:** PostgREST.
- **Source:** PostgREST's documented SQLSTATE → HTTP table. **UNVERIFIED:** not exercised against this project.

#### COM-106 · `books` constraints the circle logic relies on
| Constraint | Effect |
|---|---|
| `books_isbn_check` (`^\d{9}[\dX]$` or `^\d{13}$`) | Stored ISBNs are already normalised: `normalize_isbn(books.isbn) = books.isbn` |
| `books_total_pages_check` (`>= 1`) | Every `total_pages > 0` guard is tautological |
| `books.title` / `author` NOT NULL | Circle snapshots always have a title and author |

`normalized_isbn` on a circle is NULL exactly when the source book has no ISBN.
- **Enforced:** `server:db`.
- **Source:** live CHECKs; [LIB-04](01-library.md#lib-04--isbn-storage-format).
- **Target:** BC-15 adds an ISBN normalisation trigger on `books`; stored ISBNs stay normalised.

#### COM-107 · `community_has_block_between` fails closed
`community_has_block_between(a, b)` returns **true** when either argument is NULL. Callers guard nulls first, so this matters only to direct callers of the helper.
- **Enforced:** `server:rpc` (helper).
- **Source:** live function.
- **Target:** the helper moves to the non-exposed `private` schema (BC-01).

#### COM-108 · Direct-table write surface
RLS lets a signed-in user write some community tables directly through PostgREST, bypassing the RPC rules:

| Table | Direct writes RLS allows | RPC rules bypassed |
|---|---|---|
| `community_profiles` | INSERT / UPDATE / DELETE own row (`community_profiles_owner_*`, role `public`) | Reserved names (COM-05), trimming (COM-10), defaults, `avatar_url` hygiene (COM-13); `created_at` can be set, and it drives search order and cursors (COM-47); a profile without a privacy row is possible (COM-02) |
| `community_profile_privacy` | INSERT / UPDATE own row | None beyond the enum |
| `follows` | INSERT / DELETE as follower | Follow eligibility (COM-34): a user can follow private profiles, users who blocked them, or users with no profile, inflating counts. A direct DELETE equals an unfollow |
| `blocks` | INSERT / DELETE as blocker | None: the same triggers fire (COM-39). A direct DELETE equals an unblock |
| `community_follow_counts` | SELECT own row only | — triggers only |
| `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions` | SELECT only (role `authenticated`) | — every write goes through the `SECURITY DEFINER` RPCs |

Table grants give `anon` and `authenticated` full DML. For `anon`, `auth.uid()` is NULL, so the policies match no rows.

A profile without a privacy row is **not** invisible everywhere:
- `get_public_profile_by_username`, `get_my_community_profile` and also-reading inner-join privacy, so they return null or exclude it;
- search, follower / following lists, `follow_community_user` and the circle surfaces read only `community_profiles`, so they still show or accept it ⚠ COM-D03.
- **Enforced:** `server:db` (RLS).
- **Source:** live `pg_policies` (2026-10-18).
- **Target:** drop `follows_follower_insert` and the `community_profiles` owner INSERT / UPDATE policies, so follows and profiles are written only through RPCs. Revoking `anon` table privileges is recommended (BC-01).

### U. Web identity client (PWA today)

#### COM-109 · Identity load states and retry budget
`fetchIdentity()` keeps module-singleton state keyed by user id:
1. No auth user → no call.
2. Already fetched for this user → no call. No caller passes `force`.
3. A different user than the last attempt → reset the profile, loaded flag and failure count.
4. 3 failed attempts for this user → no further call in this page session.
5. Call `get_my_community_profile`:
   - **success** → store the payload or `null`, mark fetched and loaded, reset failures;
   - **failure** → `console.warn` and increment the counter only, so the next mount retries.

Consumers render three states:

| State | Greeting / header |
|---|---|
| Not loaded (in flight, or every attempt failed) | Salutation only: no name, no avatar |
| Loaded, no profile | The setup CTA replaces the greeting |
| Loaded, with profile | Name + avatar |

`/profile/edit` cannot tell "no profile" from "fetch failed". After a failed fetch, or once the budget is spent, it renders the first-run Create form with the suggested username, and saving would **overwrite** the existing profile with defaults through the full-replace upsert (COM-14) ⚠ COM-D34.
- **Enforced:** `client`.
- **Source:** `src/composables/useCommunityIdentity.ts:44-91`; `src/components/dashboard/DashboardGreeting.vue:13-74`; `src/pages/ProfilePage.vue:44`; `src/pages/ProfileEditPage.vue:79-96`.
- **Note:**
  - Display derivations — reader name = display name ‖ username ‖ email local part, initials, suggested username, greeting hours — are [PRO-90](07-profile-stats-goals.md#pro-90--identity-derivations-and-page-copy) and [PRO-92](07-profile-stats-goals.md#pro-92--dashboard-greeting).
  - A missing email is coerced to `""`, so the name is empty, not "Reader".

#### COM-110 · Profile save sequence (web)
Save is enabled when the username pattern is valid, the live check is not `taken`, and no save is running; saving while the check is `checking` is allowed ([PRO-79](07-profile-stats-goals.md#pro-79--save-enablement)).

1. **New avatar picked:**
   - downscale to ≤ 512 px on the longest side, JPEG quality 0.85;
   - upload `{uid}/avatar-{ms}.jpg`;
   - **fire-and-forget**: list `{uid}/` and remove every other file;
   - return the public URL.

   An upload failure stops the save with "The image could not be uploaded. Try again."
2. **Upsert:** `upsert_my_community_profile` with the full payload. `avatarUrl` = the new URL, else the current one, else `null`.
3. **Success:** the module state is replaced by the RPC response, toast "Profile saved" (2.5 s), then navigate to `/profile`. On error the form stays and shows the mapped copy ([PRO-88](07-profile-stats-goals.md#pro-88--save-error--copy-mapping)).

Step 1 deletes the old avatar **before** step 2. A failed save (e.g. `username_taken`) therefore leaves `avatar_url` pointing at a deleted file and the new upload orphaned, and a retry uploads yet another file ⚠ COM-D33. There is no "remove photo" control, although the RPC accepts `avatarUrl: null`.
- **Enforced:** `client`.
- **Source:** `src/pages/ProfileEditPage.vue:144-201`; `src/composables/useCommunityIdentity.ts:93-146,199-227`; pick validation and processing [PRO-84](07-profile-stats-goals.md#pro-84--avatar-pick-validation), [PRO-85](07-profile-stats-goals.md#pro-85--avatar-processing).
- **Target (recommended — BC-13):** upload → save → delete old files only after success, with the orphan sweep (COM-99) as the safety net.

---

## Flows

### F1. Identity fetch (web)
See COM-109. Nothing is persisted: memory only. Failure paths:
- each failure leaves the user unfetched, and the next mount retries;
- after 3 failures for the same user the greeting stays at salutation-only for the rest of the page session;
- `/profile/edit` falls into Create (COM-D34).

### F2. Profile create / edit (web today)
1. **Mount:** `fetchIdentity()`.
   - Profile → hydrate the form.
   - `null` → prefill the suggested username: the email local part, lowercased, stripped to `[a-z0-9_-]`, ≤ 30 characters, and `''` if shorter than 3.
   - A skeleton shows until done.
2. **Typing:** `checking` → debounced 400 ms (max wait 1500 ms) →
   - empty → `idle`;
   - fails the pattern → `invalid`;
   - equals the current username → `available`;
   - otherwise the RPC answers `available` / `taken`; a network error → `idle`, and the server re-verifies on save.
3. **Avatar pick:** must be `image/*` and ≤ 8 MB, else an inline warning; local blob preview.
4. **Save:** COM-110. **Persisted:**
   - Storage objects are written and deleted immediately (step 1).
   - Both community tables are written atomically in one RPC transaction (step 2).

### F3. Profile write — target clients
- **Web (D-05):** keeps the full-payload upsert. Recommended BC-13 order: upload new → upsert → on success delete the other files.
- **iOS v1 (D-13 · BC-11):**
  1. `get_my_community_profile`. A `null` success means no profile; a failure shows retry and disables Save.
  2. `is_username_available` with a debounce.
  3. Optional avatar upload.
  4. `upsert_my_community_profile` with only `username`, `displayName` and `avatarUrl` (the BC-11 partial write). It creates the rows when missing (`is_public` default per COM-Q01) and never resets bio, `is_public` or privacy.
  5. On success, remove old avatar files.

### F4. Follow / unfollow
```
none ──follow_community_user (reason = allowed)──► following
following ──unfollow_community_user (always)──────► none
following ──block in either direction────────────► none   (both directions removed)
```
Each transition updates `community_follow_counts` by trigger in the same transaction. Every response is the relationship payload + `changed`. A disallowed follow returns `changed:false` + `reason` (data, not an error).

### F5. Block / unblock
1. `block_community_user` → INSERT `blocks`.
2. Trigger 1 (COM-39): delete the pair's pending invitations in circles where either is a member → evict the blocked user from the blocker's circles → close **every** empty active circle.
3. Trigger 2: delete follows both ways → the count triggers fire.
4. Response `{targetUserId, isBlockedByViewer:true, removedFollowsCount: 0, changed}`.

`unblock_community_user` removes only the block row; nothing is restored.

### F6. Circle lifecycle
```
create_reading_circle ──► ACTIVE ──(owner leaves, no members left)──────────► CLOSED (terminal)
                            │  └──(block cleanup leaves 0 members, global sweep)──► CLOSED
                            └──(creator deletes anchoring book; creator or owner account deleted)──► row DELETED (cascade)
```
The ownerless variant (COM-D13): when the owner is block-evicted, the circle stays ACTIVE with `owner_id` still pointing at the evicted user.
- Nobody can invite or remove.
- Pending invitations the evicted owner sent remain listed and acceptable.
- When the last member leaves, the circle is **not** closed; it closes only when some later block anywhere runs the global sweep.

### F7. Invitation lifecycle
```
(create / invite) ─► PENDING ─accept (circle active, < 10 members, no block with any member)─► ACCEPTED (+ circle_members row)
                        ├─decline (any circle status; p_accept null = decline)────────────► DECLINED
                        ├─owner remove_reading_circle_member───────────────────────────────► REVOKED
                        ├─block between invitee and a member───────────────────────────────► row DELETED
                        └─(never)──────────────────────────────────────────────────────────► EXPIRED (enum value unused)
```
A failed accept (`circle_full`, `blocked`, `circle_not_active`) rolls back, and the invitation stays PENDING.

### F8. Membership roles
`member → owner` happens only by automatic promotion when the owner leaves (earliest `joined_at`, then lowest `user_id`). `owner → gone` happens by leaving or by block eviction; eviction does **not** promote. There is no manual ownership transfer and there are no co-owners.

### F9. Post a reaction
1. The client resolves **its own** matching copy: same `book.id` (creator only) or `normalize_isbn(isbn) == circle.book.normalizedIsbn` (COM-82).
2. It makes sure the latest page is saved server-side: flush the offline queue first (COM-98).
3. It validates locally: content trimmed (all whitespace) 1–280 code points; page in `[1, total_pages]` and ≤ the saved current page.
4. `add_circle_reaction(circleId, ownBookId, page, content)` makes a single insert; nothing else is persisted.
5. Error mapping:
   - `reaction_ahead_of_progress` / `invalid_progress` → "Save your page first";
   - `invalid_book` → "Add this book (same ISBN) to your library";
   - `not_circle_member` / `blocked` → refresh the circle list.

### F10. Read reactions
1. `get_visible_circle_reactions(circleId, p_min?, p_max?, limit, cursor)`.
2. `viewerProgressMissing:true` means either "not a member / not visible" or "log your progress to see reactions". Disambiguate with `get_reading_circle_detail` (null = no access).
3. Re-fetch after every progress save to reveal newly unlocked reactions. Going backwards hides them again (COM-93).
4. De-duplicate by `reactionId` and expect gaps while COM-D10 is open.

### F11. Account deletion (target)
`delete-account` (D-10 · BC-11), in order:
1. Re-auth check.
2. Purge `community-avatars/{uid}/` and `recap-images/{uid}/` through the Storage API. A failure aborts before the user is deleted, so a retry is safe.
3. Revoke the Apple token.
4. `auth.admin.deleteUser`: the cascade of COM-95 runs, deleting every circle the user created or owns, for all members.

The confirmation copy lists those circles.

### F12. Offline
No community or circle operation is queued offline: they are plain RPCs that fail without a network. Only reading progress has an offline queue, which delays circle gating (COM-98).

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| `USERNAME_PATTERN` | `^[a-z0-9_-]{3,30}$` | Username format | `useCommunityIdentity.ts:17`; CHECK `community_profiles_username_format_chk`; `upsert_my_community_profile` |
| Reserved usernames | `admin, api, auth, bookhero, login, profile, u` | Rejected names (RPC only) | `upsert_my_community_profile`, `is_username_available` |
| `BIO_MAX` | 160 | Bio length (server: code points; PWA: UTF-16 units) | `ProfileEditPage.vue:26`; CHECK `community_profiles_bio_len_chk` |
| Display-name input | 60 (client only) | `maxlength` | `ProfileEditPage.vue:317` |
| Username input | 30 | `maxlength` | `ProfileEditPage.vue:284` |
| `AVATAR_MAX_BYTES` | 8 MiB | Pre-upload pick limit | `ProfileEditPage.vue:27` |
| `AVATAR_MAX_DIMENSION` | 512 px | Longest side after downscale | `useCommunityIdentity.ts:14` |
| `AVATAR_JPEG_QUALITY` | 0.85 | JPEG encode quality | `useCommunityIdentity.ts:15` |
| Bucket limits | 5 MiB; jpeg / png / webp | Server-side storage cap | `storage.buckets` `community-avatars` |
| `MAX_FETCH_ATTEMPTS` | 3 | Identity fetch attempts per user per page session | `useCommunityIdentity.ts:51` |
| Username debounce | 400 ms / max wait 1500 ms | Availability check | `ProfileEditPage.vue:128` |
| Save toast life | 2500 ms | "Profile saved" | `ProfileEditPage.vue:192` |
| Transient-401 retry | 400 ms, once | REST retry that also covers RPCs ([PLT-33](08-platform-auth-account.md#plt-33--retry-once-on-postgrest-401)) | `src/services/retryingFetch.ts` `RETRY_DELAY_MS` |
| Default privacy | all `nobody` | Per-surface default | `useCommunityIdentity.ts:28-33`; column defaults; RPC |
| `isPublic` default | column `false` / RPC `true` / PWA `true` | Discoverability (COM-Q01) | column default; `upsert_my_community_profile`; `ProfileEditPage.vue:50` |
| Search minimum length | 2 characters | Below → empty result | `search_community_readers` |
| Search / follower / following / blocked limit | default 20, clamp 1–50 | Page size | respective RPCs |
| Also-reading limit | default 3, clamp 1–20 | Page size | `get_also_reading_for_book` |
| Same-area band | ±10 percentage points (inclusive) | `relativeStatus` | `get_also_reading_for_book` |
| Percentage precision | 2 dp, capped at 100 | Also-reading, `currentlyReading` | same |
| Lexicon highlights | 6 entries, `leitner_box >= 5` | Public profile | `get_public_profile_by_username` |
| Current-streak window | Last day = today or yesterday (UTC) | Public stats | `get_public_profile_by_username` |
| Circle name | 1–80 code points, trimmed (spaces only) | Validation | `create_reading_circle`; CHECK `reading_circles_name_not_blank` |
| Circle member cap | 10 including the owner | `circle_full` | trigger `circle_members_assert_insert` → `circle_assert_member_insert` |
| Reaction content | 1–280 code points, trimmed (spaces only) | Validation | `add_circle_reaction`; CHECK `circle_reactions_content_length` |
| Location precision | 3 dp, clamp 0–100 | `normalized_location` (`numeric(6,3)`) | `add_circle_reaction`, `circle_progress_location` |
| Reactions limit | default 50, clamp 1–100 | Page size | `get_visible_circle_reactions` |
| Circles-list limit | default 20, clamp 1–50 | Page size (returns ≤ limit + 1) | `list_my_reading_circles` |
| Statement timeout | `authenticated` 8 s, `anon` 3 s | Per-request DB cap → `57014` | `pg_db_role_setting` |
| `books.total_pages` | ≥ 1 | Makes every `total_pages > 0` guard tautological | CHECK `books_total_pages_check` |
| `books.isbn` format | `^\d{9}[\dX]$` or `^\d{13}$` | Stored ISBNs are already normalised | CHECK `books_isbn_check` |
| Text-length unit | Code points | `char_length` / `length` for bio 160, circle name 80, reaction 280 | RPCs + CHECKs |
| Trim semantics | ASCII space only | `trim` / `btrim` default; tabs and newlines kept | same RPCs |

---

## Data touchpoints

| Object | Read / write | By whom | Contract |
|---|---|---|---|
| `community_profiles`, `community_profile_privacy` | Read via `get_my_community_profile`; write via `upsert_my_community_profile` (target iOS: the BC-11 partial write) | PWA today; iOS v1 (identity fields only, D-13) | [backend-contract](../backend-contract.md) §3, §5, §8 |
| `community_profiles` (others') | Read via public profile, search, lists, circle RPCs | Dormant | §8 |
| `community_follow_counts` | Written by triggers; read via relationship / search payloads | Server only | §3, §9 |
| `follows`, `blocks` | Written by follow / block RPCs and triggers (plus direct RLS writes, COM-108) | Dormant | §3, §5, §9 |
| `reading_circles`, `circle_members`, `circle_invitations`, `circle_reactions` | Written by circle RPCs and the block trigger; SELECT-only RLS | Dormant | §3, §4, §5 |
| `books`, `reading_progress`, `progress_history`, `lexicon_entries`, `reading_dna` | Read (`SECURITY DEFINER`, bypassing owner RLS) by the public profile, also-reading and circle RPCs | Server | §3, §8 |
| Storage `community-avatars/{uid}/avatar-{ms}.jpg` | upload, list, remove, `getPublicUrl` | PWA; iOS v1 | §7 |
| Storage purge on account deletion | Storage API (service role) | `delete-account` edge function (target, D-10) | §10, §16 |

Client types: `ProfileVisibility`, `CommunityPrivacy`, `CommunityProfile`, `MyCommunityProfile` (`src/types/index.ts:865-891`). No TypeScript types exist for any other community or circle payload.

---

## Client-side logic & server migration

Every client must implement the rules below today. "Moves to" names the work package that takes a rule server-side (D-06); "stays" means it remains client logic. The social and circle rows apply only once the Community phase starts.

| # | Rule(s) | Today | Moves to / stays |
|---|---|---|---|
| 1 | Username normalisation `trim().toLowerCase()` + pattern before calling (COM-03, COM-04) | Client + server | **Stays client** for UX; the server stays authoritative |
| 2 | Availability states `idle / checking / available / taken / invalid`; network failure → `idle`; own name short-circuit; save allowed while checking (COM-07, PRO-77, PRO-79) | Client | **Stays client**. Add a distinct "reserved" state (COM-D35) |
| 3 | Display name ≤ 60 (COM-12) | Client only | **Moves → BC-01 / BC-11** (server check in the upsert, including partial writes); the client keeps the input cap |
| 4 | Whitespace trimming of all text fields (COM-10) | Client (JS trim) | **Moves → BC-01 / BC-11** for profile fields; circle names and reactions wait for the Community phase. Clients keep trimming |
| 5 | Code-point counting for bio / name / reaction limits (COM-11, COM-66, COM-85) | Client counts UTF-16 (web) | **Stays client**: count Unicode scalars to match the server |
| 6 | Avatar pipeline: type check, ≤ 8 MB pick, ≤ 512 px JPEG 0.85, metadata strip, timestamped path, lowercase-uid folder (COM-99, COM-100, PRO-84…PRO-86) | Client | **Stays client** (consolidation plan §5). The BC-13 sweep is the safety net; URL validation → BC-01 / BC-11 |
| 7 | Save order: upload → save → cleanup (COM-110) | Client (wrong order on web) | **Stays client**; fix order (BC-13, recommended) |
| 8 | Full-payload upsert (COM-14) | Client | **Moves → BC-11** for iOS (absent keys keep their values); the web keeps the full upsert |
| 9 | Distinguish "no profile" (null success) from "fetch failed"; retry budget (COM-109) | Client | **Stays client** (fix COM-D34) |
| 10 | Error-code → copy mapping by message substring (PRO-88) | Client | **Stays client**: switch on the exact `message` code |
| 11 | Identity derivations (reader name, initials, suggested username) and greeting hours (PRO-90, PRO-92) | Client | **Stays client** |
| 12 | Own-copy resolution for circles; port `normalize_isbn` as "keep `[0-9X]`, uppercase" (COM-60, COM-82) | Not built | **Stays client** unless COM-Q19 adds `viewer.bookId` (then server) |
| 13 | Flush progress before posting; refetch reactions after each save (COM-93, COM-98) | Not built | **Stays client** |
| 14 | Relationship UI: reason → copy, follow-button state machine, hide counts unless `allowed` / `self`, Unfollow while `isFollowing` (COM-24, COM-26, COM-37) | Not built | **Stays client** |
| 15 | Cursor loops: opaque cursors, stop when a cursor repeats, de-duplicate by id (COM-52…COM-55) | Not built | **Stays client**; the server fixes COM-D09…COM-D11 in the Community phase |
| 16 | "N reactions at this page" indicator from a narrow `p_min/p_max` window (COM-90) | Not built | **Stays client** (or a later RPC) |

---

## Caching & offline

| Item | Behaviour | Source |
|---|---|---|
| SWR keys | **None** for community data | `src/composables/useCache.ts` |
| Identity singleton | Module-level refs keyed by user id; reset when a **different** user fetches; not reset on sign-out (harmless — the next user resets it). The global `clearAll()` on identity change does not touch it | `useCommunityIdentity.ts:55-75`; `src/stores/auth.ts:89` |
| After save | The RPC response is written straight into the singleton, so the greeting and header update without a refetch | `useCommunityIdentity.ts:105` |
| Staleness | `force` is never used: a profile edited elsewhere (another tab, or the iOS app) is not refetched within the PWA page session — including sign-out → sign-in as the same user, because `_fetchedForUserId` survives ⚠ COM-D39 | `useCommunityIdentity.ts:64-67` |
| Account switch | The first render of `DashboardGreeting` can show the **previous** user's name and avatar, because the reset happens inside `fetchIdentity` in `onMounted`, after first paint ⚠ COM-D39 | `DashboardGreeting.vue:16`; `useCommunityIdentity.ts:70-75` |
| Avatar CDN | Unique timestamped filenames defeat CDN caching (never overwrite a path) | `useCommunityIdentity.ts:126` |
| Browser storage | No `localStorage` / IndexedDB keys for community | — |
| Offline | No offline support; RPCs fail offline. The progress queue indirectly delays circle gating (COM-98) | [SES-77](02-reading-sessions.md#ses-77--what-an-offline-save-does-and-skips) |
| Realtime / push | None: no publication, no device tokens. Invitations are discoverable only by polling `list_my_reading_circles` | live publication |
| **Target** | Native: an identity cache scoped per user, wiped on sign-out, refreshed on foreground. BC-14 adds `device_tokens` and Realtime for other tables; community Realtime and push are Community-phase work | — |

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| COM-D01 | `community_remove_pair_follows(a, b)` is `SECURITY DEFINER` and EXECUTE-able by `anon` / `PUBLIC` (COM-39, COM-102) | Anyone with the anon key can delete arbitrary follow edges between any two users | **BC-01** (revoke anon / PUBLIC; move to `private`) |
| COM-D02 | Helpers callable by any `authenticated` user with arbitrary ids: `circle_progress_location` returns any user's page / total for a circle book; `community_relationship_payload`, `community_has_block_between`, `community_interaction_reason` and `community_can_view_profile` reveal follow / block edges; `circle_user_is_member/owner`, `circle_member_count`, `circle_members_have_block`, `circle_book_matches` and `circle_users_can_share` are oracles; `community_reconcile_follow_counts` runs a global recompute (COM-42, COM-82, COM-102) | Cross-user data leaks that bypass `progress_visibility`; load abuse | **BC-01** (move to `private`; service-role-only reconcile) |
| COM-D03 | Direct-table RLS bypasses the RPC rules: `follows` INSERT ignores eligibility; `community_profiles` INSERT / UPDATE ignore reserved names, trimming and URL hygiene, can set `created_at`, and can create a profile without a privacy row (COM-02, COM-05, COM-108) | Following private or blocking users; inflated counts; reserved names; manipulated search order; half-visible profiles | **BC-01** (drop `follows_follower_insert` and the profile INSERT / UPDATE policies) |
| COM-D04 | `avatar_url` is unvalidated free text (COM-13); live, 1 of 5 profiles points outside the bucket | Tracking pixels, IP leaks, unmoderated images for every viewer | **BC-01** recommended bucket-prefix check in the upsert; it also applies to the **BC-11** partial writes |
| COM-D05 | Also-reading accepts a caller-controlled `p_isbn` (COM-57) | A viewer can enumerate every in-progress book of the readers they follow | Ignore `p_isbn`, or require it to equal the viewer's own book ISBN (Community phase) |
| COM-D06 | Cross-surface privacy leaks: `currentlyReading` returns page / % when `progress` = `nobody`; `lexiconHighlights.bookTitle` reveals books when `currentlyReading` = `nobody`; also-reading always returns `updatedAt`; `hasBlockedViewer` and `blocks_participant_select` tell a blocked user who blocked them (COM-26, COM-29, COM-30, COM-49, COM-64) | Settings do not mean what the UI says | Gate each field by every surface it reveals (COM-Q02, COM-Q04) — Community phase |
| COM-D07 | Private profiles are not private inside circles: username, avatar and reactions are shown to co-members (COM-20) | Surprising exposure | COM-Q18 |
| COM-D08 | Search does not escape `%` / `_` (COM-45) | `%%` enumerates every public profile despite the 2-character minimum | Escape wildcards (`replace` + `ESCAPE`) — Community phase |
| COM-D09 | Also-reading `nextCursor` encodes row `limit + 1`; the next page starts after it (COM-65) | One reader skipped per page | Encode row `limit` — Community phase |
| COM-D10 | Reactions `nextCursor` = row `limit + 1`; the next page uses `created_at < cursor` (COM-92) | One reaction skipped per page; same-timestamp ties dropped | Keyset on `(created_at, id)` from row `limit` — Community phase |
| COM-D11 | The circles list returns `limit + 1` items and drops ties at the cursor timestamp (COM-84) | Oversized pages; missing items | Return `limit`; keyset on `(sort_at, type, id)` — Community phase |
| COM-D12 | `removedFollowsCount` is always 0 for a new block (COM-38) | Clients cannot report removed follows | Count the follows before inserting the block, or drop the field |
| COM-D13 | A block can evict a circle's **owner**: the circle stays active with no owner, `owner_id` is stale, nobody can invite or remove, the evicted owner's pending invitations stay acceptable, and the last member leaving does not close it — only a later global block sweep does (COM-39, COM-76) | Orphan circles whose state depends on unrelated users | COM-Q11; close or promote on eviction; never leave `owner_id` stale |
| COM-D14 | Detail `members[]` lists the owner **last** (`order by role desc`, enum `owner < member`) (COM-80) | Wrong default ordering | `order by role asc, joined_at` |
| COM-D15 | `invite_reading_circle_members` reports users with an existing pending invitation as invited (COM-70) | Misleading result | Report them as `alreadyInvited` or skipped |
| COM-D16 | `viewerProgressMissing:true` also means not a member, blocked or closed (COM-89) | The client cannot explain an empty feed | Separate `access: 'none'` from `progressMissing` (additive) |
| COM-D17 | Profile-less users are silently invisible: their reactions are hidden from everyone (including themselves), their membership is missing from `members[]`, and their invitations never reach invitees — yet follow, create, accept and react require no profile (COM-35, COM-80, COM-83, COM-90) | Ghost members and lost invitations | COM-Q05 (require a profile for social writes) |
| COM-D18 | Circles on ISBN-less books are unusable for other members; `same_book` matching in also-reading is dead code; `canonical_book_id` is never populated (COM-59, COM-67) | Circles that only the creator can use | COM-Q07 |
| COM-D19 | `normalize_isbn` strips a lowercase `x` before `upper()` (COM-60) | A typed `…x` ISBN-10 never matches | **BC-15** (uppercase before stripping) |
| COM-D20 | Follow counts drift for users who followed before creating a profile; reconciliation is never scheduled (COM-41, COM-42) | Wrong counts | Backfill counts on profile insert; schedule the reconcile in the Community phase (BC-01 makes it service-role only) |
| COM-D21 | Member-cap race: no lock on the circle in `circle_assert_member_insert` (COM-75) | More than 10 members possible under concurrency (inferred) | `SELECT … FOR UPDATE` on `reading_circles` before counting |
| COM-D22 | Invitations never expire; pending invitations on closed circles are never cleaned up (COM-72) | Unbounded pending rows | COM-Q09 (TTL + sweep) |
| COM-D23 | Public `stats` diverge from the owner's own stats: imports included in `booksRead` / `totalPagesRead`, DNF counted, UTC streaks (COM-28) | Public numbers differ from Profile numbers | **BC-06** (owner zone for streaks); COM-Q17 for the rest |
| COM-D24 | `lexiconHighlights` use `leitner_box >= 5`, not the `mastered` flag; `masteredAt` = creation time; quotes are not excluded (COM-30) | The highlighted set differs from what the app calls "Mastered"; quotes could be published | COM-Q03 |
| COM-D25 | DNF-shelved books appear as `currentlyReading` and in also-reading (COM-29, COM-58, COM-97) | Shelved books shown as being read | COM-Q13 |
| COM-D26 | The `isPublic` default is inconsistent (column `false` / RPC `true` / PWA `true`), and the PWA intro says "everything is private until you say otherwise" while the Public-profile toggle is pre-set **ON** (COM-15) | Users become discoverable without realising | COM-Q01 |
| COM-D27 | A non-boolean `isPublic` raises raw `22P02` before `not_authenticated`; the `visibility_invalid` handler is dead code (COM-15, COM-16) | An unmapped error for native clients | Validate `jsonb_typeof(payload->'isPublic') = 'boolean'` in the body and raise `visibility_invalid` (with BC-01 / BC-11 profile work) |
| COM-D28 | Whitespace-only content is accepted: `trim` / `btrim` strip spaces only, so newline- or tab-only bios, circle names and reactions pass every server check (COM-10, COM-66, COM-85) | Blank-looking content | `btrim(x, E' \t\r\n')` or a `~ '\S'` check — profile in **BC-01** (recommended), circles in the Community phase |
| COM-D29 | `list_my_reading_circles` lists an invitation whose acceptance must fail with `blocked` (COM-83) | A dead-end invitation | Apply `circle_members_have_block` to invitation rows |
| COM-D30 | List `memberCount` ≠ detail `members.length`; `pendingInviteCount` ≠ `pendingInvitations.length`; follow counts > list lengths (COM-43, COM-80, COM-83) | Inconsistent numbers on screen | Count the same set that is listed (COM-Q05, COM-Q06) |
| COM-D31 | The detail omits the viewer's own matching book id, although `circle_progress_location` computes it (COM-82) | Every non-creator client must re-derive it by ISBN; passing `book.bookId` fails | COM-Q19 (additive `viewer.bookId`) |
| COM-D32 | Reactions of members who left, were removed or were block-evicted remain visible to the others (COM-76) | Removed members' content persists | COM-Q10 |
| COM-D33 | Web avatar cleanup runs **before** the profile save (COM-110). Live: 1 profile URL points at a missing object and 1 object is unreferenced | A failed save leaves a broken avatar and an orphaned file | Upload → save → cleanup; **BC-13** orphan sweep (recommended) |
| COM-D34 | A failed identity fetch on `/profile/edit` renders the first-run Create form; saving overwrites the existing profile with defaults (COM-109) | Silent loss of display name, bio, privacy and `isPublic` | Show an error with retry and disable Save when the fetch failed |
| COM-D35 | Reserved usernames show "taken" while typing and the format message on save; the suggestion can propose a reserved name (e.g. an `admin@…` email) (COM-05, COM-08) | Misleading copy | A distinct "reserved" reason from `is_username_available` (additive field) + a client check of the list |
| COM-D36 | The bio counter uses UTF-16 length (stricter than the server); the display name has no server limit (COM-11, COM-12) | Counter and server disagree; unbounded names via API | Count code points; server limit (**BC-01** recommended / **BC-11**) |
| COM-D37 | Avatar pipeline edge cases: a `createImageBitmap` failure (e.g. unsupported HEIC) surfaces the browser's raw message; with no 2D context the original file is uploaded labelled `image/jpeg`, and an 8 MB pick can exceed the 5 MB bucket cap (COM-110) | Confusing errors; failed uploads | Map decode errors to "Choose a JPEG, PNG or WebP image"; never upload undecoded originals |
| COM-D38 | All community and circle DDL (8 migrations) is missing from `supabase/migrations/`; no tests cover `useCommunityIdentity` or `ProfileEditPage` | Unreproducible schema; regressions | **BC-03** (baseline migration from the live snapshot); add unit tests |
| COM-D39 | Identity cache staleness: never force-refreshed; can show the previous user's name and avatar on first paint after an account switch (Caching & offline) | Stale or wrong identity | Reset on user change before render; refresh on foreground / focus |
| COM-D40 | Cursor error handling is inconsistent: a corrupt community cursor silently returns page 1 (infinite-scroll loop risk); reaction and circle-list cursors raise raw `22007` / `22008`; also-reading raises `invalid_cursor` (COM-53, COM-55) | Loops and unmapped errors | One typed `invalid_cursor` everywhere — Community phase; clients stop on a repeated cursor |
| COM-D41 | Placeholders and dead schema: `latestReactionAt` always null, `circle_reactions.deleted_at` never set, `expired` never used, `canonical_book_id` never set, `circle_users_can_share` unused (COM-67, COM-72, COM-83, COM-87) | Misleading contract | Implement or remove when the Community phase defines them |

---

## Open decisions

D-01…D-17 resolve these former questions; they appear as Target lines instead:
- iOS v1 community scope and the profile-edit phase (D-13);
- community monetisation (D-14 · BC-12: any gating is server-side, tiers undecided);
- account deletion and avatar purge (D-10 · BC-11);
- the public-streak time zone (D-07 · BC-06);
- fix-forward priority — BC-01 locks the helpers and direct-table bypasses now, and the remaining defects are deferred (consolidation plan §6, OP-01.3);
- the server-side `avatar_url` bucket check and display-name limit (BC-01, recommended; they also apply to the BC-11 partial writes).

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| COM-Q01 | **Default discoverability** for new profiles, including those created from iOS, which has no public toggle and sends no `isPublic` (OP-11.6) | Column `false`, RPC `true`, PWA toggle pre-set ON while its copy says "private until you say otherwise" (COM-15, COM-D26) | **Private by default**: a profile created without `isPublic` gets `is_public = false` (BC-11.8); the PWA first-run toggle defaults OFF, matching its copy. The PWA always sends `isPublic`, so this is backward compatible (D-05) |
| COM-Q02 | **Cross-surface gating**: should `currentlyReading` page / % require `progress` visibility; should lexicon `bookTitle` require `currentlyReading`; should also-reading `updatedAt` be gated? | Each section is gated by one surface only (COM-D06) | A field is returned only when **every** surface it reveals is visible: page / % need `progress`; `bookTitle` needs `currentlyReading`; also-reading `updatedAt` needs `progress` (else omit) |
| COM-Q03 | **Public lexicon highlights**: the `mastered` flag, a real mastery time, quotes? | `leitner_box >= 5`, `created_at`, quotes included (COM-30) | Use `mastered = true`, `masteredAt = last_reviewed_at` of the mastering review, and exclude `entry_type = 'quote'` (legal review: quotes are third-party text) |
| COM-Q04 | **Blocked visibility**: should a blocked user learn they are blocked (`hasBlockedViewer`, direct SELECT of `blocks`)? | Exposed (COM-26, COM-49) | No: return `hasBlockedViewer: false` and reason `profile_unavailable` to the blocked party; restrict `blocks` SELECT to the blocker |
| COM-Q05 | **Profile requirement for social writes** (follow, create circle, accept invitation, react) | Not required; profile-less users become invisible (COM-D17) | Require a community profile for every social **write** (new typed error `profile_required`); reads stay allowed |
| COM-Q06 | **Owner's own lists and counts**: should owners see private / profile-less followers; should counts equal list lengths? | Lists hide them; counts include them (COM-43, COM-49) | Counts = the size of the set the viewer can list; owners see all their followers that have a profile |
| COM-Q07 | **Circle book identity**: require an ISBN at creation? Edition matching? Canonical work id? | No ISBN required; exact normalised ISBN only; `canonical_book_id` unused (COM-D18) | Require an ISBN to create a circle (`book_isbn_required`); adopt ISBN-10 → 13 (OP-15.1); keep `canonical_book_id` for a later work-level match |
| COM-Q08 | **Circle survival** when the creator deletes the anchoring book, or the creator or owner deletes their account | The whole circle is deleted for all members (COM-94, COM-95) | Circles survive on their snapshot: `book_id` and `created_by` FKs → `ON DELETE SET NULL`; the owner's account deletion runs the leave hand-off; the circle closes only when empty. Warn before deleting a book that anchors a circle |
| COM-Q09 | **Invitation policy**: TTL, pending cap, cooldown after decline, mutual follow? | None; `expired` unused (COM-71, COM-72) | TTL 14 days (expire lazily on read + daily sweep); pending ≤ 10 − members; 7-day re-invite cooldown after a decline; no mutual-follow requirement |
| COM-Q10 | **Reaction lifecycle & moderation**: edit / delete own reactions, the fate of departed members' reactions, report / hide (App Store Guideline 1.2) | None; departed members' reactions stay visible (COM-87, COM-D32) | Author soft delete (`deleted_at`) and owner hide; keep the reactions of members who left voluntarily, hide those of removed or block-evicted members; report flow + moderation queue before **any** social surface ships |
| COM-Q11 | **Block inside a circle**: who leaves when a member blocks the owner? | The blocked party is evicted, even the owner (COM-D13) | The **blocker** leaves when the blocked user is the owner; otherwise evict the blocked member. Never leave a circle ownerless: promote through the leave path |
| COM-Q12 | **Spoiler unit**: is gating by percentage location (inclusive at equal location) the intended rule? | Percentage, 3 dp, inclusive (COM-86, COM-90) | Keep percentage + inclusive, and show the reaction's `viewerEquivalentPage` in the UI |
| COM-Q13 | **DNF books** in `currentlyReading` and also-reading | Included (COM-D25) | Exclude `dnf_at is not null` from both, matching the client's in-progress definition |
| COM-Q14 | **Username policy**: change cooldown, old-name reservation, profanity filter, a larger reserved list (product name per D-03), the "stable username" requirement | Free changes; 7 reserved names; no profanity filter (COM-05, COM-09) | Before any public surface: a server-side profanity / impersonation filter and an extended reserved list (`chronicler`, `thechronicler`, `support`, `help`, `settings`, `www`, …). With the Community phase: a 30-day change cooldown and a 30-day reservation of the old name |
| COM-Q15 | **Search semantics**: prefix-only + newest first, or relevance / word matching? | Prefix on username or whole display name; `created_at desc`; wildcards unescaped (COM-45, COM-47) | Escape wildcards (COM-D08); rank exact username → username prefix → display-name word prefix, then profile age |
| COM-Q16 | **"Leave community"** separate from account deletion? | Direct profile DELETE only (COM-96) | Not in v1. In the Community phase add `delete_my_community_profile` (edge function: profile + follows + memberships + avatar purge) |
| COM-Q17 | **Public stats definitions**: match the owner's own stats? | Imports and DNF included; UTC (COM-28) | After BC-04 / BC-06, derive from the same server definitions as `get_reading_stats`: imports excluded from pages, `booksRead` = books with `completed_at`, the owner's zone |
| COM-Q18 | **Private profiles inside circles**: show a private user's identity to co-members? | Shown (COM-D07) | Keep showing it — joining an invite-only circle is consent — and state it on the accept screen ("Members of this circle will see your name and photo") |
| COM-Q19 | **Detail payload additions**: `viewer.bookId`, `memberCount`, `status`, `ownerId`? | Absent (COM-80, COM-82) | Add all four (additive, D-05) |
| COM-Q20 | **Dormant RPC exposure** before the Community phase | BC-01 keeps the 21 unconsumed social and circle RPCs on the `authenticated` allowlist, with known leaks (COM-D05, COM-D06, COM-D08) | Revoke EXECUTE on the unconsumed RPCs until the Community phase, then re-grant after its fixes. No current client calls them, so there is zero PWA impact |

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

**Scope.** Per D-13, v1 uses only:
- `get_my_community_profile`;
- `is_username_available`;
- the identity write — `upsert_my_community_profile` with only `username`, `displayName` and `avatarUrl` once BC-11 keeps absent keys; until then, the full current payload echoed back (COM-14);
- the `community-avatars` bucket.

Do not call any social or circle RPC. Never write bio, `isPublic` or privacy values, because a web user may have set them.

**Profile states.** Treat a `null` profile as "not set up", never as an error (COM-01). A failed fetch is a separate state: show retry and disable Save, unlike the PWA (COM-D34). Scope the identity cache per user, wipe it on sign-out, and refresh on foreground (COM-D39).

**RPC calls.**
- Parameter names must match exactly (`p_username`; the upsert takes a single `payload` object).
- Errors arrive as HTTP 400 with `code: "P0001"` and `message` = the exact code: switch on `message`.
- Expect raw `22P02` for a non-boolean `isPublic` (COM-15): always send JSON booleans.
- Signed-out calls fail with `42501` (COM-102).
- Treat `57014` (8 s timeout) as retryable (COM-103).

**Decoding.**
- Absent keys are not `null` (COM-32).
- Timestamps are ISO-8601 with 0–6 fractional digits and a `+00:00` offset; use a tolerant decoder (COM-101).
- Percentages and locations are JSON numbers with 2–3 decimals; decode them as `Decimal`/`Double`.

**Text input.**
- Trim all whitespace and newlines before sending; the server trims spaces only (COM-10).
- Lowercase the username and validate `^[a-z0-9_-]{3,30}$` locally.
- Check the reserved list locally and show a distinct "reserved" message (COM-05, COM-D35).
- Cap the display name at 60 (COM-12).
- Count limits in **Unicode scalars**, i.e. code points (COM-11).

**Avatars.**
- Path: `{uid lowercased}/avatar-{epochMs}.jpg`. Storage RLS compares the folder with the lowercase JWT `sub` (COM-99).
- Upload → save → delete old files only after success (COM-110).
- Strip EXIF/GPS. Keep ≤ 512 px and JPEG 0.85, and stay under 5 MiB.
- The avatar is **world-readable** by its public URL even though no social surface exists: say so in the copy and the privacy label.

**Sign in with Apple (D-11).**
- Do not derive a suggested username or reader name from a Hide-My-Email relay address; prompt for a username instead.
- Apple returns the user's name only on the first authorization. Offer it as the display name, and save it only with consent.

**Account deletion (D-10).** Use `delete-account`: it purges `community-avatars/{uid}/` and cascades every community row. Every circle the user created or owns is deleted for all its members (COM-95).

**When the Community phase starts.**
- Port `normalize_isbn` as "keep `[0-9X]`, uppercase" and resolve the user's own copy for circles (COM-82).
- Flush the offline progress queue before posting a reaction, and refetch reactions after each save (COM-93, COM-98).
- Treat cursors as opaque bytes and never parse or URL-rewrite them (COM-52…COM-55). Stop on a repeated cursor and de-duplicate by id until COM-D09…COM-D11 are fixed.
- Treat a disallowed follow (`changed:false` + `reason`) as data, not an error (COM-34).
- There is no Realtime and no push: use refresh on foreground and pull-to-refresh, and badge invitations from `list_my_reading_circles` polling. APNs needs `device_tokens` (BC-14) plus Community-phase backend.
- Ship report and block UI and moderation before any surface shows another user's content (Guideline 1.2; COM-Q10).

### iOS-specific (iOS 26+, iPhone first — D-04)

- **Avatar pick:**
  - Use `PhotosPicker` (PhotosUI) → `Data`.
  - Downscale with ImageIO (`CGImageSourceCreateThumbnailAtIndex`, `kCGImageSourceThumbnailMaxPixelSize = 512`, `kCGImageSourceCreateThumbnailWithTransform = true`).
  - Encode JPEG at 0.85 with metadata removed. HEIC input is handled natively, which avoids COM-D37.
  - Build the path with `user.id.uuidString.lowercased()`; `uuidString` is uppercase and would be rejected by Storage RLS.
- **Username field:**
  - `.textInputAutocapitalization(.never)`, `.autocorrectionDisabled()`, `.keyboardType(.asciiCapable)`, lowercase on change.
  - Debounce 400 ms with a cancellable `Task` and cancel in-flight checks.
  - Show a non-editable "@" prefix and a trailing state symbol (progress / `checkmark.circle` / `xmark.circle`).
- **Counters:** `text.unicodeScalars.count`, not `String.count`. Grapheme clusters undercount: 👨‍👩‍👧 is 1 grapheme but 5 scalars.
- **Glass:** the identity header and the avatar button may sit on native Liquid Glass (`.glassEffect`, grouped in a `GlassEffectContainer`). There is no pre-iOS-26 fallback. Respect Reduce Transparency and Increase Contrast.
- **Accessibility:**
  - Avatar images are labelled "{name}'s profile photo".
  - The avatar button is labelled "Change profile photo".
  - Username availability changes are announced (`AccessibilityNotification.Announcement`).
  - Support Dynamic Type for names and, later, for 280-character reactions.
- **Deep links (later):** reserved `u` implies `https://<web-domain>/u/{username}`. Add it to the Associated Domains / `apple-app-site-association` set up for auth links (D-11), then call `get_public_profile_by_username`.
- **App Store:**
  - Guideline 5.1.1(v): in-app account deletion through `delete-account` (D-10).
  - Privacy nutrition label: User Content → Photos (avatar, publicly reachable by URL), Identifiers → username and user ID, linked to the user.
  - Guideline 1.2 (UGC) obligations — filter, report, block and published contact — apply once another user's profile or reactions are shown in-app. Not in v1.
