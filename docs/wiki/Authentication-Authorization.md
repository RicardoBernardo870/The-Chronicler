# Authentication & Authorization

Last updated: 2026-10-18

The Chronicler uses **Supabase Auth** for identity and sessions, and **Postgres row-level security plus SECURITY DEFINER RPCs** for authorization. There is no custom backend server. Client-side checks improve UX only; the database and the edge functions are the security boundary.

Normative rules: [08 · Platform, auth & account](../business-rules/08-platform-auth-account.md) (PLT) and [09 · Database invariants](../business-rules/09-database-invariants.md) (BE). Live detail: [backend contract §1, §5, §12](../backend-contract.md#1-connection-auth--runtime-limits). The repo is being made private (D-16), so security findings are documented in full.

Verified against web `master` @ `8d8701c` and the live project on 2026-10-18.

---

## Summary

| Topic | Today | Target |
|---|---|---|
| Sign-in methods | Email + password (sign-in, sign-up) and email magic link. Live: every identity uses the `email` provider; no MFA, no anonymous users | + Sign in with Apple, identity linking (D-11 · BC-11) |
| Password reset / change | None | Reset on web and iOS via universal links (D-11) |
| Account deletion | None in-app | `delete-account` edge function, immediate hard delete, confirm + re-auth, web and iOS (D-10) |
| Email confirmation | Effectively off (every user confirmed within a fraction of a second of sign-up; dashboard setting not readable) | Decide (PLT-Q02, OP-11.1) |
| Leaked-password protection | Disabled (security advisor) | Enable (BC-11) |
| Sign-out | `global` scope (all devices); fails silently offline | Open: PLT-Q01 / OP-11.2 |
| RLS | Enabled on all 26 product tables; ownership by `user_id` only | Child tables also check book ownership (BC-01) |
| RPC caller checks | Inconsistent; 4 unguarded read RPCs; NULL-bypassable quest guard | Owner checks everywhere (BC-01) |
| Edge-function auth | 3 of 7 functions accept forged tokens | Verified JWT in all 7 (BC-02) |

---

## Authentication

### Methods (`src/stores/auth.ts`, `src/pages/AuthPage.vue`)

| Method | Call | Notes |
|---|---|---|
| Sign in | `signInWithPassword({ email, password })` | Default mode |
| Sign up | `signUp({ email, password })` | No options, no redirect URL, no confirm-password field, no ToS checkbox |
| Magic link | `signInWithOtp({ email })` | No `emailRedirectTo`, so the link lands on the Supabase Site URL. Also **creates an account** for an unknown email (no `shouldCreateUser: false`) |
| Sign out | `signOut()` | supabase-js default scope `global` |

Not present (verified by grep over `src/`): password reset, password or email change, account deletion, data export, OAuth / Sign in with Apple, phone OTP, MFA.

### Auth screen behaviour

| Item | Behaviour |
|---|---|
| Modes | `signin` (default) · `signup` · `magic`. Submit labels "Sign in" / "Create account" / "Send magic link" |
| Validation | HTML `required` + `type="email"`; no length or strength rules. Server policy applies |
| Errors | Supabase `err.message` shown verbatim (e.g. "Invalid login credentials"); fallback "Something went wrong. Please try again." Cleared on submit and on magic toggle, not on tab switch |
| After password sign-in/up | `router.push('/')` — always the dashboard; the originally requested deep link is lost (PLT-D18) |
| After magic link sent | "Magic link sent! Check your email." and the form is hidden until reload; no resend or "use another email" (PLT-D17) |
| Branding | "The Chronicler — Your AI reading companion" (D-03) |

### Client configuration (`src/services/supabase.ts`)

| Option | Value | Effect |
|---|---|---|
| `persistSession` | `true` | Session in localStorage key `sb-<project-ref>-auth-token` |
| `autoRefreshToken` | `true` | Refresh paused/resumed on `visibilitychange` by auth-js |
| `detectSessionInUrl` | `true` | Consumes magic-link tokens on landing |
| Flow type | `implicit` (auth-js default) | Magic-link tokens arrive in the URL fragment; links work in any browser but always land on the web app |
| `global.fetch` | `createRetryingFetch()` | One retry on a PostgREST 401 (see [Session lifetime](#session-lifetime)) |

Access-token lifetime is about 1 h (DB GUC `app.settings.jwt_exp = 3600`; the Auth setting itself is dashboard-only).

### Session restore (cold start)

```mermaid
sequenceDiagram
  participant App as App.vue / router guard
  participant Auth as auth store
  participant SB as supabase-js
  participant LS as localStorage
  App->>Auth: initialize() (idempotent, cached promise)
  Auth->>SB: getSession() raced against 3000 ms
  alt session found
    Auth->>LS: write bookhero-auth-user {id, email}
  else no session
    Auth->>LS: remove bookhero-auth-user
  else timeout (e.g. expired token + offline)
    Auth->>LS: read bookhero-auth-user snapshot (may be null)
  end
  Auth->>Auth: ready = true, then subscribe onAuthStateChange
  App->>App: guard resolves route; splash hidden
```

| Rule | Detail |
|---|---|
| Bounded wait | 3000 ms (`GET_SESSION_TIMEOUT_MS`), then the last-known user is trusted and RLS protects data |
| User model | `{ id, email }` only (`email = ''` when absent); no metadata read |
| Snapshot | Rewritten on every auth event; removed when the user becomes null; storage errors swallowed |
| Failure edge | `initialize()` has no `catch`: if `getSession()` rejects, the rejected promise stays cached and the "Loading..." splash never clears (PLT-D16) |
| Shared flag | `authStore.loading` drives both initialisation and the auth-form spinner |

### Route guard (`src/router/index.ts`)

Order on every navigation:

1. If `!authStore.ready`, await `initialize()`.
2. If the route requires auth and there is no user → `{ name: 'login' }` (no `redirect` query).
3. If the route is `login` and a user exists → `{ name: 'dashboard' }`.

| Protected (child of the auth-gated layout) | Public |
|---|---|
| `/`, `/library`, `/library/dnf`, `/books/add`, `/books/add/details/:source/:key(.*)`, `/books/:id`, `/books/:id/recaps`, `/books/:id/passport`, `/lexicon`, `/profile`, `/profile/trophy-room`, `/profile/stats`, `/profile/edit`, `/anki-review` | `/login`, `/:pathMatch(.*)*` (404, outside the layout; "Go home" → `/`, which leads to `/login` when signed out) |

Full route table: [Architecture › Routes & layouts](Architecture.md#routes--layouts).

### Session lifetime

| Behaviour | Detail |
|---|---|
| Identity change | Every auth event where the user id changes (sign-in, sign-out, switch) calls SWR `clearAll()`. Same-user token refreshes do not |
| Cross-tab | One localStorage session per origin; auth events broadcast to other tabs (`BroadcastChannel`). Each tab clears its SWR metadata and updates `user` |
| Session loss | If the refresh token fails or another device signs out globally, `user` becomes null and the bottom nav disappears, but the page stays until the next navigation hits the guard (PLT-D15) |
| Cold-start 401 race | PostgREST may reject a valid token (`PGRST303`) during the refresh burst. `retryingFetch` retries a `/rest/v1/` 401 once after 400 ms, then shows "Some things didn't load" (max once per 30 s) |
| Edge-function tokens | Raw-`fetch` callers (`recapService`, `loreService`, `useCapture`, `bookPassport`) read `getSession()` just before the call, throw `'Not authenticated'` without a token, send only `Authorization` (no `apikey`) and bypass the 401 retry. `functions.invoke` callers (`useBookQuiz`, `usePageResume`, `useVocabularyExtraction`, `readingDna`) get headers from supabase-js |

### Sign-out

| Step | Behaviour |
|---|---|
| Trigger | More sheet → "Sign out" → `signOut()` → `router.push('/login')` |
| Scope | `global`: every refresh token of the user is revoked, on every device (web and future iOS) |
| Server 401/403/404 | Ignored by auth-js; the local session is removed and sign-out succeeds |
| Network failure | The store throws, the handler has no catch: no message, the reader stays signed in (PLT-D14) |
| Cleared | Supabase session, `bookhero-auth-user`, SWR metadata |
| **Not** cleared | Pinia stores, module singletons, the IndexedDB offline queue (not user-scoped), `bookhero_wotd_{uid}`, `bookhero:dna-covers`, theme and library view prefs; in-flight AI jobs are not cancelled. No page reload |

Consequences: the previous user's data can flash for the next user; their queued saves replay under the next user's id and create orphan `reading_progress` rows on someone else's `book_id` (RLS allows it); achievement dates can leak across accounts ([PLT-D12](../business-rules/08-platform-auth-account.md#known-defects), [11 · Cross-domain](../business-rules/11-cross-domain.md)).

---

## Authorization

### Roles

| Role | Used by | Notes |
|---|---|---|
| `anon` | supabase-js before sign-in (`Authorization: Bearer <anon key>`) | `auth.uid()` is NULL. `statement_timeout` 3 s. Should execute no product function (BC-01) |
| `authenticated` | every signed-in reader | Single role for every product feature; no per-user roles or permissions. `statement_timeout` 8 s |
| `service_role` | `generate-recap` image handler only (`SUPABASE_SERVICE_ROLE_KEY`) | Updates `recaps` and uploads to `recap-images`, scoped by `recapId` + the token's `sub` |

### Row-level security

RLS is enabled on all **26** product tables. Supabase grants full DML on every table to `anon` and `authenticated`, so the policies are the only barrier.

| Table group | Policies |
|---|---|
| `books`, `reading_progress`, `progress_history`, `recaps`, `up_next_order`, `lexicon_entries`, `book_passports`, `anki_review_sessions` | `ALL` with `auth.uid() = user_id` (older policies granted to role `public`; they match nothing for anon) |
| `lore_cards`, `page_captures`, `reading_goals`, `book_quizzes` | Per-command owner policies (SELECT/INSERT/UPDATE/DELETE) |
| `reading_dna`, `vocabulary_extractions`, `user_settings`, `community_profile_privacy` | No DELETE policy (rows go only by cascade). UPDATE without `WITH CHECK` reuses `USING`, so still owner-only |
| `achievements` | SELECT/INSERT only (insert-only ledger) |
| `reading_quest_events` | SELECT only (written by trigger) |
| `community_profiles`, `community_profile_privacy`, `community_follow_counts` | Own row only |
| `follows`, `blocks` | Rows where the caller is either side; INSERT checks only `follower_id/blocker_id = auth.uid()`, so direct inserts bypass the follow eligibility rules (dormant, D-13) |
| `reading_circles`, `circle_members`, `circle_invitations`, `circle_reactions` | SELECT-only for `authenticated`; writes only through SECURITY DEFINER RPCs (dormant) |

**Gap:** no policy checks that a referenced `book_id` belongs to the caller. A client can attach progress, history, recaps, lexicon entries, captures or lore to another user's book id (the FK only checks existence) ([PLT-76](../business-rules/08-platform-auth-account.md#plt-76--rls-on-every-table-ownership-checked-on-user_id-only), PLT-D06 → BC-01).

Client conventions that RLS relies on: every insert supplies `user_id` explicitly; `reading_progress` upserts use `onConflict: 'book_id,user_id'`; every UPDATE/DELETE carries a filter (`safeupdate`).

### RPC caller checks

| RPC | Guard (live) | `anon` EXECUTE | Mismatched caller gets |
|---|---|---|---|
| `get_reading_stats` | silent filter `p_user_id = auth.uid()` | no | zeros |
| `get_reading_records`, `get_monthly_reading`, `get_reading_calendar`, `get_book_passport_stats` | silent filter (passport also requires the book to belong to `p_user_id`) | **yes** | zeros / `[]` / nulls |
| `get_reading_quest_summary` | `if p_user_id <> auth.uid() then raise 'Not allowed'` — **NULL-bypassable** | **yes** | anon reads any user's goal, completions, XP/level and activity counts (PLT-D02) |
| `get_library_with_progress`, `get_library_breakdown`, `get_last_session`, `get_reading_velocity` | **none** (SECURITY DEFINER, filter only by caller-supplied `p_user_id`) | no | any signed-in user reads another user's library, progress, private session notes and velocity (PLT-D01) |
| `prune_page_captures_for_book(p_user_id, p_book_id, p_keep)` | **none** | **yes** | anyone with the anon key deletes all but one of another user's captures for a book (PLT-D03) |
| `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available`, all community/circle RPCs | identity from `auth.uid()` | — | own data only |

Totals: 60 SECURITY DEFINER functions are executable by `authenticated` and 17 by `anon`, including trigger and helper functions (`community_remove_pair_follows`, `circle_progress_location`, `community_relationship_payload`, the unreferenced `after_page_capture_saved`). Root cause: `pg_default_acl` on schema `public` re-grants EXECUTE to `anon` and `authenticated` on every **new** function ([PLT-77](../business-rules/08-platform-auth-account.md#plt-77--rpc-caller-identity-checks-are-inconsistent), PLT-D05).

Until BC-01 ships, **every client passes only its own uid** for `p_user_id` and scopes every local cache by `user_id`.

### Edge-function auth

| Function (live version) | `verify_jwt` | In-function auth | Web transport |
|---|---|---|---|
| `generate-recap` (v84) | **false** | `manualJwtDecode` → `sub`; no signature or `exp` check | raw `fetch` |
| `generate-lore` (v18) | **false** | `decodeJwt` → `sub`; no signature or `exp` check | raw `fetch` |
| `ocr-page` (v2) | **false** | `manualJwtDecode`; 401 `{error:"Unauthorized", message:"Missing or invalid JWT"}` | raw `fetch` |
| `extract-vocabulary` (v2), `generate-reading-dna` (v8), `generate-page-resume` (v3), `generate-book-quiz` (v1) | true | gateway verification, then `decodeJwt` for `sub` | `functions.invoke` |

All seven: `POST` + `OPTIONS`, CORS `*`, allowed headers `authorization, x-client-info, apikey, content-type`. Every function requires a `sub` claim, so the anon key used as a bearer is rejected.

Defects ([PLT-78](../business-rules/08-platform-auth-account.md#plt-78--three-ai-edge-functions-accept-forged-tokens)):

- **Forged tokens** (PLT-D04): anyone can spend Gemini/OpenAI credits on the three `false` functions with a made-up `sub`; `generate-recap` image mode then writes with the service role under the forged id.
- **base64url bug** (PLT-D07): `manualJwtDecode` in `generate-recap` and `ocr-page` calls `atob` without mapping `-`/`_`, so a genuine token with non-ASCII claims (e.g. an Apple full name) can get a spurious 401.
- **Error leak** (PLT-D08): `generate-recap` 500 bodies include `detail: String(err)`.
- **Config not in repo** (PLT-D11): no `supabase/config.toml`; a redeploy from the repo flips the three functions to `verify_jwt: true`.

The "ES256 compat" reason given in the `generate-recap/auth.ts` comment is unverified (the project's signing-key algorithm is not visible via SQL); the four `verify_jwt: true` functions work with current tokens.

### Storage policies

| Bucket | Public | Path rule (`storage.objects` RLS) | Writer |
|---|---|---|---|
| `recap-images` | no (signed URLs; 60 s per panel, 3600 s gallery/carousel) | first folder = `auth.uid()`; SELECT/INSERT/DELETE, no UPDATE | `generate-recap` service role at `{uid}/{recapId}.png` |
| `community-avatars` | yes | first folder = `auth.jwt()->>'sub'`; SELECT/INSERT/UPDATE/DELETE for `authenticated` | client at `{uid}/avatar-{ms}.jpg` (≤ 512 px JPEG) |

`storage.objects` has a delete-protection trigger, so objects can only be removed through the Storage API.

---

## Account lifecycle

| Event | What happens today |
|---|---|
| Sign-up | Only the `auth.users` row is created. No trigger in schema `auth`, no profile or settings row; `community_profiles` is created on the first save of `/profile/edit` |
| Delete `auth.users` (dashboard only) | Every product table cascades (all 26; `community_profile_privacy` and `community_follow_counts` via `community_profiles`). Reading circles the user owns are deleted for every member. **Storage objects survive** (`recap-images/{uid}/`, `community-avatars/{uid}/`) |
| Delete a book | Hard delete; all per-book rows cascade, `reading_quest_events.book_id` → NULL (XP kept). Recap images stay in Storage. A circle anchored on the book is deleted with every member's rows |
| In-app deletion, reset, export | Not available (PLT-72) |

Rules: [PLT-71 … PLT-75](../business-rules/08-platform-auth-account.md#account-lifecycle--data-deletion).

---

## Planned changes (BC-01, BC-02, BC-11)

| Package | Change |
|---|---|
| [BC-01](../backend-consolidation-plan.md#bc-01--security-hardening) | Assert `p_user_id = auth.uid()` in `get_library_with_progress`, `get_library_breakdown`, `get_last_session`, `get_reading_velocity` (parameter kept for PWA compatibility); NULL-safe guard in `get_reading_quest_summary`; revoke `anon`/`PUBLIC` EXECUTE across public functions and fix `pg_default_acl`; drop `after_page_capture_saved`, drop or lock `prune_page_captures_for_book`; lock leaking helpers; book-ownership checks in child-table RLS; close the direct follows-insert bypass |
| [BC-02](../backend-consolidation-plan.md#bc-02--edge-function-auth) | `verify_jwt = true` (or real `supabase.auth.getUser` / `getClaims` verification) in `generate-recap`, `generate-lore`, `ocr-page`; shared `requireUser`; drop hand-rolled decoding; no internal error text; commit `supabase/config.toml`. Recommended PWA change: send `apikey` on raw-fetch calls and refresh + retry once on a 401 |
| [BC-11](../backend-consolidation-plan.md#bc-11--account-lifecycle--auth) | `delete-account` edge function (D-10); Sign in with Apple + identity linking from Settings (D-11); password reset on both clients; magic and reset links via universal links (`emailRedirectTo` / `redirectTo`, PKCE on iOS); custom SMTP; leaked-password protection; decide email confirmation |

### Target: delete account (D-10)

1. Settings → "Delete account" → confirmation listing what is deleted → re-authentication (password, fresh Apple credential or OTP; last authentication within 5 minutes).
2. `delete-account` (`verify_jwt = true`, body `{"confirm":"DELETE"}`): purge `recap-images/{uid}/` and `community-avatars/{uid}/` through the Storage API → revoke the Sign in with Apple token (failure logged, does not block) → `auth.admin.deleteUser(uid)` → FK cascades remove every row.
3. The client wipes all local per-user state and signs out.

Flows: [F-10 Sign in with Apple](../business-rules/08-platform-auth-account.md#f-10--target-sign-in-with-apple--identity-linking-d-11--bc-11), [F-11 Password reset](../business-rules/08-platform-auth-account.md#f-11--target-password-reset-d-11--bc-11), [F-12 Delete account](../business-rules/08-platform-auth-account.md#f-12--target-delete-account-d-10--bc-11).

### Open decisions

| ID | Question |
|---|---|
| PLT-Q01 / OP-11.2 | Sign-out scope (device vs global) and offline failure handling. Recommendation: local by default + "Sign out of all devices"; sign out locally even if the call fails |
| PLT-Q02 / OP-11.1 | Turn on email confirmation before Sign in with Apple ships (safe identity linking) |
| PLT-Q05 / OP-11.7 | Canonical web domain for redirects and `apple-app-site-association` |
| OP-11.4 / OP-11.5 | Apple refresh-token storage; Hide-My-Email duplicate-account handling |

---

## Security checklist

- Keep AI provider keys and the service-role key in edge-function secrets only. `VITE_*` variables ship in the browser bundle and must be safe to expose ([Configuration](Configuration.md)).
- The anon key is public by design; RLS and function grants must be correct for every table and function.
- New functions: SECURITY DEFINER with pinned `search_path`, identity from `(select auth.uid())`, `revoke all … from public, anon`, explicit `grant execute … to authenticated` (plan principle P6).
- New user-owned tables: RLS with owner policies for every command, plus a book-ownership check when the table has `book_id`.
- Edge functions: verify the JWT (signature and expiry), never trust a decoded `sub`; never return internal error text.
- Preserve the protective invariants: capture images never persisted; captures private and purged on completion; recap images private; community privacy defaults `nobody` (PLT-80).
- Fix BC-01 and BC-02 before any public native build: a native binary makes the anon key and endpoints trivially extractable.

Native-client notes (Keychain session, PKCE, universal links, full local wipe on user change, `apikey` on every edge call): [08 · Platform › Notes for native clients](../business-rules/08-platform-auth-account.md#notes-for-native-clients).
