# 08 · Platform — Auth, Account, Navigation, Caching & Offline — Business Rules
> **Prefix:** PLT · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-19 (BC-01 and BC-02 shipped)

## Overview

This area is the shell every feature runs inside. It covers:

- **Identity:** sign-in methods, the session and token lifecycle, sign-out and user switch.
- **Account lifecycle:** what sign-up creates, what deletion cascades, and the missing reset/deletion/export flows.
- **Navigation:** routes, the auth gate, the bottom navigation bar and back-navigation conventions.
- **Data plumbing:** the SWR cache primitive (keys, TTLs, invalidation), the PostgREST retry layer, error and toast surfacing.
- **Offline:** the progress queue and the service worker / PWA shell.
- **Conventions:** configuration and feature flags, timezone and date/number formatting, theme tokens.
- **Posture:** the platform-level security status (RLS, RPC caller checks, edge-function auth) and legal/compliance obligations.

Product name: **The Chronicler**; "BookHero" is the internal code name for the repo, the Supabase project and code identifiers (D-03). Every rule is written client-agnostically. The PWA stays live, and iOS, Android and web share one Supabase backend, so every backend change must keep the PWA working (D-05).

| Web route (name) | Page / surface | Purpose |
|---|---|---|
| `/login` (`login`) | `src/pages/AuthPage.vue` | Sign in / Sign up / magic link. Public; a signed-in user is redirected to the dashboard. |
| `/` (layout) | `src/layouts/DefaultLayout.vue` | Auth-gated parent of every app route; renders the bottom nav when a user is signed in. |
| `/` (`dashboard`) | `src/pages/DashboardPage.vue` | Home tab. Its ordered mount sequence and the load-failure notice are platform concerns (PLT-36). |
| `/:pathMatch(.*)*` (`not-found`) | `src/pages/NotFoundPage.vue` | "Page not found" + "Go home". Public, rendered without the nav. |
| Bottom nav + "More" sheet | `src/components/shared/AppBottomNav.vue` | Home · Library · Codex · Profile · More (Add Book, Light/Dark mode, Sign out). |
| Full-page splash | `src/App.vue:2`, `src/components/shared/LoadingSpinner.vue` | "Loading..." until auth initialisation resolves. |
| Global overlays | `src/App.vue:4-7` | ConfirmDialog, PrimeVue Toast (bottom), lore-generation banner, glass toast (top). |
| Service worker | `src/sw.ts` | App-shell precache, SPA navigation fallback, runtime caches, Background Sync relay. |

All other routes are owned by feature files and listed in [Routing & navigation](#routing--navigation).

**Backend objects** (names only; shapes live in the [backend contract](../backend-contract.md)):

- **Auth:** Supabase Auth (`auth.users`, `auth.identities`, `auth.sessions`). Only the `email` provider is in use. There are no triggers in schema `auth` (§1 Connection, auth & runtime limits).
- **Tables touched by platform code:** `reading_progress` (offline-queue replay). `user_settings` exists, but no client reads or writes it (PLT-83).
- **RPCs:** none are owned here. The caller-identity guard status of the read RPCs is tracked here (PLT-77; §8 RPC catalogue, §12 Security status).
- **Edge functions:** none are owned here. The auth mode of all seven product functions is tracked here (PLT-78; §10 Edge functions). Planned: `delete-account` (D-10 · BC-11).
- **Storage:** buckets `recap-images` and `community-avatars` matter for account deletion (PLT-74; §7 Storage).
- **Cascades:** every user-owned table cascades from `auth.users` (PLT-73; §4 Cascades & lifecycle effects).
- **Live snapshot:** `supabase/reference/live-baseline-2026-10-18.sql` (D-16).

---

## Rules

### Authentication methods

#### PLT-01 · Supported sign-in methods
The only methods are:
- email + password sign-in (`signInWithPassword`);
- email + password sign-up (`signUp({ email, password })`, with no `options` and no redirect URL);
- email magic link (`signInWithOtp({ email })`, with no `emailRedirectTo`, so the link lands on the project's configured Site URL).

There is no OAuth, no Sign in with Apple, no phone/OTP-code entry, no MFA and no anonymous auth.
- **Enforced:** `client` (`src/stores/auth.ts`); Supabase Auth project config (dashboard-only).
- **Source:** `src/stores/auth.ts:106-137`. Live: `auth.identities` holds provider `email` only (7 identities); 0 MFA factors; 0 anonymous users.
- **Target:** two methods on web **and** iOS: Sign in with Apple, and email + password. Password reset ships on both clients. Magic links and reset links open through universal links. An existing email user can link an Apple ID from Settings, so Apple's Hide-My-Email relay address does not create a duplicate, empty account (D-11 · BC-11). Flows F-10 and F-11.
- **Note:** Guideline 4.8 makes Sign in with Apple mandatory only when a third-party/social login is offered. D-11 adopts it anyway, which adds an Apple-token revocation duty on account deletion (PLT-72).

#### PLT-02 · Magic link doubles as sign-up
`signInWithOtp` is called without `shouldCreateUser: false`, so an unknown email silently gets a new account when the link is opened.
- **Enforced:** `client` (Supabase default).
- **Source:** `src/stores/auth.ts:132`.
- **Target:** the link's redirect URL becomes a universal link that both the PWA and the iOS app handle (D-11 · BC-11). Whether it still creates accounts is part of PLT-Q02.

#### PLT-03 · No client-side password policy
The only client validation is HTML `required` + `type="email"` on email and `required` on password. There is no minimum length, strength meter or confirm-password field. The password policy is whatever Supabase Auth enforces, and leaked-password (HaveIBeenPwned) protection is **disabled** ⚠ PLT-D09.
- **Enforced:** `client` (HTML attributes only); Supabase Auth.
- **Source:** `src/pages/AuthPage.vue:39-60`; security advisor lint `auth_leaked_password_protection`.
- **Note:** every client should show the server's minimum length before submit, so the reader does not discover it through an error.

#### PLT-04 · Auth errors are shown verbatim
A thrown `Error` puts its Supabase `message` (English, e.g. "Invalid login credentials") into an error banner. Any other throw shows "Something went wrong. Please try again." The banner is cleared on each submit and when toggling magic-link mode, but **not** when switching the Sign in / Sign up tabs ⚠ PLT-D17.
- **Enforced:** `client`.
- **Source:** `src/pages/AuthPage.vue:26-28,109-116,127-129`.
- **Note:** native clients should map the common error codes (`invalid_credentials`, `user_already_exists`, `over_email_send_rate_limit`, `email_not_confirmed`) to friendly copy and fall back to the server message.

#### PLT-05 · After sign-in the reader always lands on the dashboard
A successful password sign-in or sign-up runs `router.push('/')`. The guard sends signed-out readers to `{ name: 'login' }` with no `redirect` query, so the deep link they originally requested is lost ⚠ PLT-D18.
- **Enforced:** `client`.
- **Source:** `src/pages/AuthPage.vue:121-125`; `src/router/index.ts:113-115`.
- **Note:** this matters more once universal links exist (PLT-Q05). Native clients should hold a pending deep link across the auth screen.

#### PLT-06 · Sign-up assumes an immediate session (email confirmation effectively off)
After `signUp` the page immediately pushes `/`. If "Confirm email" were on, the guard would bounce the reader back to `/login` with no "check your inbox" message. Live data shows confirmation is effectively off: 0 unconfirmed users, and `email_confirmed_at − created_at` is under 0.1 s for every user (consistent with autoconfirm).
- **Enforced:** Supabase Auth config (dashboard-only); `client` (no post-sign-up screen).
- **Source:** `src/pages/AuthPage.vue:120-122`; live aggregate over `auth.users`.
- **Target:** BC-11 decides email confirmation (PLT-Q02). Whatever is chosen, every client needs a "Check your inbox" state for the confirmation-required case.
- **Note:** [UNVERIFIED: the "Confirm email" switch itself is only visible in the Supabase dashboard; inferred from data.]

#### PLT-07 · Auth screen modes and copy
- **Modes:** `signin` (default), `signup` and `magic`.
- **Magic mode:** the password field is hidden and neither tab is highlighted. The toggle ("Sign in with magic link instead" / "← Back to password sign in") always returns to `signin`, never to `signup`.
- **Submit labels:** "Sign in" / "Create account" / "Send magic link".
- **Autocomplete:** email is `email`; password is `current-password` (sign in) or `new-password` (sign up).
- **Brand header:** "The Chronicler" / "Your AI reading companion".
- **Enforced:** `client`.
- **Source:** `src/pages/AuthPage.vue:5-23,50-61,72-80,96-112`.

#### PLT-08 · Magic-link success is a terminal state
After "Send magic link" succeeds, the page shows "Magic link sent! Check your email." and hides the form and the magic toggle until reload (`magicLinkSent` is never reset). The tabs stay clickable but do not bring the form back. There is no resend, no cooldown display and no "use a different email" path ⚠ PLT-D17.
- **Enforced:** `client`.
- **Source:** `src/pages/AuthPage.vue:30-36,73-75,119`.

#### PLT-82 · Auth email delivery and redirect configuration
Supabase Auth sends every auth email (today only magic links) and builds each link from the project Site URL, because no client passes a redirect URL. None of these are visible from the repo or SQL: the Redirect-URL allow-list, the email templates, and whether a custom SMTP provider is configured.
- **Enforced:** Supabase Auth project config.
- **Source:** `src/stores/auth.ts:122,132` (no `emailRedirectTo` / `redirectTo`).
- **Target:** custom SMTP. Universal-link redirect URLs for magic-link, password-reset and (if enabled) confirmation emails are added to the allow-list and passed by every client (D-11 · BC-11).
- **Note:** [UNVERIFIED: SMTP provider and allow-list contents are dashboard-only.] The default Supabase sender has a very low hourly limit, so launch traffic would throttle magic links and resets.

### Session & token handling

#### PLT-09 · Session persistence
supabase-js runs with `persistSession: true`, so the session is kept in localStorage under the default key `sb-<project-ref>-auth-token`. It also runs with `autoRefreshToken: true` and `detectSessionInUrl: true`, which consumes magic-link tokens on landing. The default auth flow is **implicit**: magic-link tokens arrive in the URL fragment.
- **Enforced:** `client` (supabase-js 2.103.2).
- **Source:** `src/services/supabase.ts:14-19`; auth-js `GoTrueClient` default `flowType: 'implicit'`.
- **Note:** access-token lifetime is about 1 h (DB GUC `app.settings.jwt_exp = 3600`; `src/services/retryingFetch.ts:11`). [UNVERIFIED: the Auth access-token lifetime itself is a dashboard setting.]

#### PLT-10 · Bounded, offline-tolerant session restore
`initialize()` is idempotent: it caches its promise, and both the router guard and `App.vue` await it. It races `supabase.auth.getSession()` against a **3000 ms** timeout:
- **Session found:** `user = { id, email }`, and the snapshot is persisted.
- **No session:** `user = null`, and the snapshot is removed.
- **Timeout** (typical: expired access token + offline): `user` is set from the localStorage snapshot `bookhero-auth-user` (`{ id, email }`), which may be null.

Then `ready = true`, and only after that does it subscribe to `onAuthStateChange`.
- **Enforced:** `client`.
- **Source:** `src/stores/auth.ts:14-18,48-96`.
- **Note:**
  - **No `catch`:** `initialize()` uses `try/finally`. If `getSession()` itself rejects, `ready` stays false and the rejected promise stays cached and is never retried. The guard's `await` then throws, and `App.vue` never clears its splash, so the reader sees a permanent "Loading..." until reload ⚠ PLT-D16. This is low-probability, because supabase-js normally resolves with `{ error }`.
  - **Shared spinner flag:** `authStore.loading` is true during initialisation and also drives the AuthPage submit spinner.
  - **Teardown:** `dispose()` runs only in `App.vue` `onUnmounted`, i.e. never in normal use (`src/stores/auth.ts:98-104`; `src/App.vue:44-48`).

#### PLT-11 · User snapshot
The snapshot is written on every auth state change and removed when the user becomes null. Storage failures are swallowed.
- **Enforced:** `client`.
- **Source:** `src/stores/auth.ts:20-36,67,91`.

#### PLT-12 · Client user model
The client user is `{ id, email }`, with `email = ''` when absent. No profile or metadata is read from Auth. The display identity comes from `community_profiles` ([10 · Community](10-community-circles.md)).
- **Enforced:** `client`.
- **Source:** `src/types/index.ts:127-130`; `src/stores/auth.ts:64-66,83-85`.

#### PLT-17 · Edge-function calls carry the access token
Edge-function calls get their token in one of two ways:
- **Raw `fetch` callers** (`recapService`, `loreService`, `useCapture`, `bookPassport`) read the token with `supabase.auth.getSession()` just before the call and throw `'Not authenticated'` when there is none. They send `Authorization: Bearer <access_token>` but **no `apikey` header**, and they bypass both supabase-js' `fetchWithAuth` and the 401-retry wrapper (PLT-33).
- **`supabase.functions.invoke` callers** (`useBookQuiz`, `usePageResume`, `useVocabularyExtraction`, `readingDna`) get both headers from supabase-js. With no session, supabase-js sends the anon key as the bearer.
- **Enforced:** `client`.
- **Source:** `src/services/recapService.ts:54-55,130`; `src/services/loreService.ts:30-32`; `src/composables/useCapture.ts:114-115`; `src/stores/bookPassport.ts:130`; `src/composables/useBookQuiz.ts:129`; `src/composables/usePageResume.ts:42`; `src/composables/useVocabularyExtraction.ts:82`; `src/stores/readingDna.ts:85`.
- **Target:** every edge function verifies the JWT (BC-02). Every client must therefore send a valid user access token **and** `apikey` on every call ⚠ PLT-D46.

#### PLT-17a · Auth state is shared across tabs
supabase-js keeps one session per origin in localStorage and broadcasts auth events to other tabs over a `BroadcastChannel` named after the storage key. auth-js pauses and resumes token auto-refresh on `visibilitychange`, so a refresh coincides with the SWR refocus burst (PLT-30, PLT-33). Signing in, out or switching accounts in one tab fires the listener in every open tab: each runs `clearAll()` and updates `user`, but does not redirect (PLT-16).
- **Enforced:** `client` (auth-js 2.103.2 `GoTrueClient`).
- **Source:** `node_modules/.pnpm/@supabase+auth-js@2.103.2/.../GoTrueClient.js:186-191,4210-4219`.

### Sign-out & user switch

#### PLT-13 · SWR metadata is cleared on every identity change
On every auth event where the user id changes, the SWR cache metadata and its refocus revalidators are cleared with `clearAll()`. That covers sign-in (null→A), sign-out (A→null) and account switch (A→B). A token refresh for the same user does not clear them.
- **Enforced:** `client`.
- **Source:** `src/stores/auth.ts:86-89`; `src/composables/useCache.ts:132-138`.

#### PLT-14 · Sign-out is global and fails silently offline
More → "Sign out" closes the sheet, calls `supabase.auth.signOut()` with the default scope **`global`** (revokes the user's refresh tokens on every device, the iOS app included), sets `user = null` and pushes `/login`.
- **Server 401/403/404 on logout:** ignored by auth-js. The local session is still removed and sign-out succeeds; this is the already-expired, revoked or deleted-user case.
- **Network failure or other server error:** `signOut` returns `{ error }`, the store throws, and the reader stays signed in. The sheet handler has no `catch`, so nothing is shown and the promise rejects unhandled ⚠ PLT-D14.
- **Enforced:** `client` (auth-js `_signOut` semantics).
- **Source:** `src/stores/auth.ts:139-148`; `src/components/shared/AppBottomNav.vue:36-40`; auth-js 2.103.2 `GoTrueClient.js:3141-3172`.
- **Target:** under D-05 several clients share one account. The scope and offline behaviour are PLT-Q01.

#### PLT-15 · Sign-out clears almost nothing locally
Sign-out clears only:
- the Supabase session;
- the `bookhero-auth-user` snapshot;
- SWR metadata (PLT-13).

It does **not** clear: Pinia store contents, module-singleton composable state, the IndexedDB offline queue (`chronicler-offline`, which is not user-scoped), `bookhero_wotd_<uid>`, `bookhero:dna-covers`, theme, library UI prefs, Cache Storage, or in-flight AI jobs. There is no page reload. The full inventory is in Flow F-4 ⚠ PLT-D12, PLT-D13.
- **Enforced:** `client`.
- **Source:** `src/stores/auth.ts:139-148`; `src/components/shared/AppBottomNav.vue:36-40`.
- **Note:** other domains depend on this rule: LIB-114 ([01](01-library.md)), SES-97 ([02](02-reading-sessions.md)), INS-58 ([06](06-insights.md)), PRO-47–51 achievements ([07](07-profile-stats-goals.md)), and the Anki totals ([05](05-codex-lexicon.md)). Every client must wipe **all** per-user state on any user change (F-4; *Notes for native clients*).

#### PLT-16 · No reactive redirect on session loss
When the session ends mid-use, `user` becomes null and the bottom nav disappears (`v-if="authStore.user"`), but the current page stays until the next navigation hits the guard ⚠ PLT-D15. This covers a refresh-token failure, a global sign-out from another device, and a sign-out in another tab (PLT-17a).
- **Enforced:** `client`.
- **Source:** `src/layouts/DefaultLayout.vue:6`; `src/router/index.ts:110-124`.

### Routing & navigation

Route table (`src/router/index.ts`). Every component is lazy-loaded, the layout included. History mode is `createWebHistory(import.meta.env.BASE_URL)` with `BASE_URL = '/'`.

| Path | Name | Page | Auth | Params / query | Owner |
|---|---|---|---|---|---|
| `/` | `dashboard` | `DashboardPage.vue` | auth | — | [02](02-reading-sessions.md) |
| `/library` | `library` | `LibraryPage.vue` | auth | — | [01](01-library.md) |
| `/library/dnf` | `library-dnf` | `DnfListPage.vue` | auth | — | [01](01-library.md) |
| `/books/add` | `add-book` | `AddBookPage.vue` | auth | — (manifest shortcut target) | [01](01-library.md) |
| `/books/add/details/:source/:key(.*)` | `add-book-details` | `BookSearchDetailPage.vue` | auth | `source` ∈ `googlebooks`\|`openlibrary`; `key` percent-encoded into one segment, read with `decodeURIComponent` | [01](01-library.md) |
| `/books/:id` | `book-detail` | `BookDetailPage.vue` | auth | `id` = book uuid (`props: true`) | [01](01-library.md)–[06](06-insights.md) |
| `/books/:id/recaps` | `recap-history` | `RecapHistoryPage.vue` | auth | `id` | [03](03-recaps.md) |
| `/books/:id/passport` | `book-passport` | `BookPassportPage.vue` | auth | `id` | [02](02-reading-sessions.md) |
| `/lexicon` | `lexicon` | `GreatLibraryPage.vue` (labelled "Codex") | auth | `?tab=lore` → Insights tab; `?bookId=<uuid>` → book filter | [05](05-codex-lexicon.md), [06](06-insights.md) |
| `/anki-review` | `anki-review` | `AnkiReviewPage.vue` | auth | — | [05](05-codex-lexicon.md) |
| `/profile` | `profile` | `ProfilePage.vue` | auth | — | [07](07-profile-stats-goals.md) |
| `/profile/trophy-room` | `trophy-room` | `TrophyRoomPage.vue` (quest ring, level/XP, achievements) | auth | — | [07](07-profile-stats-goals.md) |
| `/profile/stats` | `profile-stats` | `ReadingStatsPage.vue` (monthly chart, calendar, lifetime stats, records, book lengths, breakdown) | auth | — | [07](07-profile-stats-goals.md) |
| `/profile/edit` | `profile-edit` | `ProfileEditPage.vue` | auth | — | [10](10-community-circles.md) |
| `/login` | `login` | `AuthPage.vue` | public (signed-in → dashboard) | — | this file |
| `/:pathMatch(.*)*` | `not-found` | `NotFoundPage.vue` | public, outside layout | — | this file |

The routing rules (PLT-18 to PLT-23) and the bottom navigation (PLT-22) follow.

#### PLT-18 · Guard order
On every navigation:
1. If `!authStore.ready`, await `initialize()`.
2. If the route `requiresAuth` and there is no `user`, redirect to `{ name: 'login' }`.
3. If `to.name === 'login'` and there is a `user`, redirect to `{ name: 'dashboard' }`.
- **Enforced:** `client`.
- **Source:** `src/router/index.ts:110-124`.
- **Note:** the guard is UX only. Data isolation is RLS plus the RPC guards (PLT-76, PLT-77).

#### PLT-19 · Every app route requires auth
Every route except `/login` and the 404 catch-all inherits `meta.requiresAuth: true` from the layout parent. The 404 renders outside the layout, with no nav. Its "Go home" links to `/`, which lands on `/login` when signed out. Copy: "Page not found" / "The page you're looking for doesn't exist."
- **Enforced:** `client`.
- **Source:** `src/router/index.ts:9-13,95-104`; `src/pages/NotFoundPage.vue:1-11`.

#### PLT-20 · Every navigation scrolls to top
`scrollBehavior` always returns `{ top: 0 }`, browser Back included. No saved position is restored.
- **Enforced:** `client`.
- **Source:** `src/router/index.ts:7`.
- **Note:** native stacks should preserve scroll position on back; don't copy this.

#### PLT-21 · Back-navigation fallbacks
| Page | Back behaviour |
|---|---|
| Trophy Room, Reading Stats, Profile Edit | `window.history.length > 1 ? router.back() : push({ name: 'profile' })` |
| Recap History | same heuristic, falling back to `book-detail` |
| Book Search Detail | bare `router.back()` |
| Book Passport | back → `book-detail` |
| Book Detail not-found state | "Back to Library" → `/library` |
| Anki review "done" | `onExit`, then `dashboard` |

`window.history.length` counts the whole tab. A deep link opened in a tab that already has history therefore makes `router.back()` leave the app.
- **Enforced:** `client`.
- **Source:** `src/pages/TrophyRoomPage.vue:24-25`; `src/pages/ReadingStatsPage.vue:30-31`; `src/pages/ProfileEditPage.vue:204-205`; `src/pages/RecapHistoryPage.vue:24-27`; `src/pages/BookSearchDetailPage.vue:175`; `src/pages/BookPassportPage.vue:55`; `src/pages/BookDetailPage.vue:256`; `src/pages/AnkiReviewPage.vue:35-38`.

#### PLT-22 · Bottom navigation and "More" sheet
The nav renders only while `authStore.user` is non-null.

| Order | Label | Icon | Target | Active when |
|---|---|---|---|---|
| 1 | Home | `pi-home` | `/` | `path === '/'` |
| 2 | Library | `pi-th-large` | `/library` | path starts with `/library` **or** `/books` (detail, add, recaps, passport) |
| 3 | Codex | `pi-language` | `/lexicon` | path starts with `/lexicon` |
| 4 | Profile | `pi-user` | `/profile` | path starts with `/profile` |
| 5 | More | `pi-ellipsis-h` | toggles the sheet | while the sheet is open |

- **No tab highlight:** `/anki-review` highlights no tab.
- **Sheet items:** "Add Book" (`pi-plus`) → `/books/add`. The theme item reads "Light mode" + `pi-sun` when dark, and "Dark mode" + `pi-moon` when light. "Sign out" (`pi-sign-out`).
- **Closing:** every sheet action closes the sheet first, and so does tapping the transparent backdrop.
- **Route changes:** they do **not** close the sheet. The nav (z 200) sits above the backdrop (z 198), so tapping a tab while the sheet is open navigates and leaves the sheet over the new page ⚠ PLT-D19.
- **Colours:** active is `var(--p-indigo-400)`; inactive items are at 50 % opacity.
- **Enforced:** `client`.
- **Source:** `src/components/shared/AppBottomNav.vue:13-20,27-50,63-127,158,175-178`; `src/layouts/DefaultLayout.vue:6`.

#### PLT-23 · Codex deep links
Three entry points deep-link into the Codex:
- Word of the Day → `/lexicon?bookId=<id>`;
- Book Detail → `/lexicon?bookId=<id>`;
- Lore Chronoscope → `/lexicon?bookId=<id>&tab=lore`.

The page writes its tab and book filter back into the query with `router.replace`, so no history entries are added.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/WordOfTheDay.vue:41`; `src/pages/BookDetailPage.vue:278`; `src/components/lore/LoreChronoscopeCard.vue:85`; `src/pages/GreatLibraryPage.vue:45,63-71,133-138`.

### SWR cache primitive (`src/composables/useCache.ts`)

#### PLT-24 · The cache stores freshness metadata only
Each key holds `{ fetchedAt, ttlMs, inflight, subscriberCount }` in a module-level `Map`. The data itself lives in Pinia and composable refs. Nothing is persisted, so the cache is lost on reload.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:14-30`.

#### PLT-25 · Freshness states
`swrStatus(key, ttl)` returns:
- `'loading'` when `fetchedAt === 0`;
- `'fresh'` when `Date.now() − fetchedAt <= ttlMs` (inclusive);
- `'background'` otherwise.

The TTL is fixed when the entry is created (first `swrStatus` call). Later calls with another TTL are ignored.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:36-43,53-65`.

#### PLT-26 · Store contract per state
| State | Store behaviour |
|---|---|
| `'fresh'` | return without network |
| `'background'` | fire `swrRun` and return; errors are swallowed silently |
| `'loading'` | `await swrRun`; stores set `loading` |

On the `'loading'` path the books store also sets `error`. Its value is the raw error message (postgrest-js `PostgrestError extends Error`), and "Failed to load library" is only the fallback for non-`Error` throws. `error` is never rendered; the Dashboard turns it into the load-failure toast (PLT-36). `progressStore.fetchProgress` sets no loading or error flags.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:5-10`; `src/stores/books.ts:57-74,115-132`; `src/stores/progress.ts:154-171`.

#### PLT-27 · Run de-duplication and failure semantics
`swrRun` shares one in-flight promise per key.
- **Success:** `fetchedAt = now`.
- **Failure:** `inflight` is cleared, `fetchedAt` stays unchanged, and the error is re-thrown.
- **Unknown key:** `swrRun` creates the entry with a 60 s TTL.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:72-92`; `tests/unit/useCache.spec.ts:192-215`.

#### PLT-28 · Invalidate means "blocking reload", not "background refresh"
`invalidate(key | prefix)` and `revalidate(key)` set `fetchedAt = 0`, so the next access is a `'loading'` (blocking) fetch. Reactive data is kept, but stores flip `loading = true`, and skeletons can flash over data the reader already has. The source comment promises "a background revalidation"; the tests confirm `'loading'` ⚠ PLT-D20.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:103-126`; `tests/unit/useCache.spec.ts:100-111,179-189`.

#### PLT-29 · Touch marks fresh
`swrTouch(key)` sets `fetchedAt = now` on an existing entry and does nothing for an unknown key. Stores use it after applying a mutation locally.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:98-101`.

#### PLT-30 · Refocus revalidation storm
On `visibilitychange → visible`, the revalidator is called (background, errors silent) for every entry that is:
- stale (`fetchedAt > 0` and older than its TTL);
- not in flight;
- "live" (`subscriberCount > 0` **or** a registered revalidator).

`cacheSubscribe` and `cacheUnsubscribe` are never called, and revalidators are registered on every fetch and never unregistered (only `clearAll` empties them). So "live" means "ever visited this session", and on refocus every stale key ever visited revalidates at once: every book's recaps, lexicon, lore, passport and so on. Invalidated keys (`fetchedAt = 0`) are skipped ⚠ PLT-D20.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:143-181`.

#### PLT-31 · Key catalogue and invalidation matrix
The key catalogue, TTLs and the mutation → invalidation matrix in [Caching & offline](#caching--offline) are normative for every client.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:185-205` and the stores cited there.

#### PLT-32 · Dev-only cache inspector
Dev builds expose `window.__bookheroCache` (`keys()`, `get(k)`, `stats()`). Production builds do not.
- **Enforced:** `client`.
- **Source:** `src/composables/useCache.ts:209-221`.

### Network resilience & error surfacing

#### PLT-33 · Retry-once on PostgREST 401
All supabase-js traffic goes through `createRetryingFetch()`. A 401 is retried **once**, after **400 ms**, with a cloned `Request` body replayed, when both of these hold:
- the URL contains `/rest/v1/` (tables and RPC only; never `/auth/v1/`, `/storage/v1/` or `/functions/v1/`);
- the request carries an `Authorization` header.

If the retry is still 401, `notifyLoadFailure()` fires. Every other status passes through untouched. supabase-js always sends `Authorization` (access token, or the anon key when signed out), so in practice every `/rest/v1/` 401 is retried; the "no Authorization = genuinely signed out" branch never triggers ⚠ PLT-D45.
- **Enforced:** `client`.
- **Source:** `src/services/supabase.ts:20-23`; `src/services/retryingFetch.ts:19,27-32,40-66`; `tests/unit/retryingFetch.spec.ts:19-80`.

#### PLT-34 · Why the 401 retry exists, and the library's own retry
**Why:** PostgREST intermittently returns `PGRST303` for a valid token during the refresh burst on a cold start after the token lifetime, and supabase-js does not retry 401.

**The library's own retry** (postgrest-js 2.103.2):
- It applies only to **GET/HEAD/OPTIONS** requests, i.e. table `select`s. `.rpc()` is POST, and inserts, upserts and updates are never retried.
- It retries up to **3** times on a network error or HTTP **520/503**.
- Backoff is **1 s → 2 s → 4 s** (cap 30 s) or `Retry-After`, with header `X-Retry-Count`.

Offline, a table `select` therefore takes about 7 s to fail while RPC reads fail at once. The 401 wrapper runs inside each attempt, so the two layers stack. The code comment's "408/409/503/504" is wrong for this version ⚠ PLT-D39.
- **Enforced:** `client` (library default + app wrapper).
- **Source:** `src/services/retryingFetch.ts:3-17`; `node_modules/.pnpm/@supabase+postgrest-js@2.103.2/.../dist/index.mjs:5,19,23,94-99,255-289`.

#### PLT-35 · One de-duplicated load-failure notice
`notifyLoadFailure()` shows a single warn glass toast at most once per **30 000 ms** (module-level timestamp). Copy: summary "Some things didn't load", detail "Reopen the app or refresh the page to try again."
- **Enforced:** `client`.
- **Source:** `src/composables/useLoadFailureNotice.ts:12-24`.

#### PLT-36 · Dashboard mount sequence
The Dashboard mounts in this strict order:
1. `fetchLibraryWithProgress`, then notify if `booksStore.error` is set.
2. `Promise.all([fetchProgress, upNext.fetchOrder])`.
3. `lexicon.fetchEntriesForAllBooks`.
4. Word of the Day + Anki session (non-blocking).
5. Lore for all books (non-blocking).
6. Active-book init.
7. Recaps for the active book.

A throw in any awaited step aborts the rest and calls `notifyLoadFailure()`.
- **Enforced:** `client`.
- **Source:** `src/pages/DashboardPage.vue:155-189`.

#### PLT-37 · Glass toast semantics
There is one global slot, and a new `show*` replaces the current toast and resets its timer.

| Variant | Default life | Icon |
|---|---|---|
| `show` (success) | 5000 ms | `pi-check-circle` |
| `showLoading` | 0 (persists until `dismiss()` or the next show) | `pi-spin pi-spinner` |
| `showWarn` | 6000 ms | `pi-exclamation-triangle` |

- **Interaction:** tapping dismisses it, except the `loading` variant.
- **Position and size:** top-center below the safe area (`safe-area + 0.85rem`); z-index 1210; max width `calc(100vw − 2rem)`.
- **Accessibility:** `role="status"`, `aria-live="polite"`.
- **Overlap:** the lore banner (`safe-area + 0.75rem`, z 1200) occupies the same slot, so a toast fully hides it while visible ⚠ PLT-D38.
- **Producers:** only the capture flow (loading "Reading the page…", success "Page captured" / "Text analysed successfully.", plus a warn) and `notifyLoadFailure`.
- **Enforced:** `client`.
- **Source:** `src/composables/useGlassToast.ts:8-59`; `src/components/shared/GlassToast.vue:7-16,21-26,40-52`; `src/components/lore/LoreGenerationBanner.vue:35-39`; `src/components/session/SessionCaptureField.vue:68-185`.

#### PLT-38 · PrimeVue Toast for page-level outcomes
PrimeVue Toast carries page-level success and error feedback in four files: `SessionCaptureField.vue`, `DnfListPage.vue`, `LibraryPage.vue` and `ProfileEditPage.vue`. Together they use severity `error` ×6 and `success` ×2, with life 2500–4000 ms. The toast sits bottom-center, 280 px wide, lifted by `--app-nav-bottom-clearance` (`calc(6rem + env(safe-area-inset-bottom))`). The global ConfirmDialog is 90 % wide and is used by Book Detail (×5), Dashboard (×4) and Library (×1).
- **Enforced:** `client`.
- **Source:** `src/App.vue:4-5`; `src/assets/styles/main.css:11`; `src/main.ts:35-36`.

#### PLT-39 · Edge-function error transport
- **Raw-fetch callers:** they throw `Error(body.error ?? 'HTTP <status>')`. OCR uses `body.message ?? body.error ?? 'OCR failed (HTTP <status>)'`.
- **Error bodies:** edge functions answer JSON `{ error, … }` with 400/401/405/500/503.
- **`ocr-page`:** returns 504 `{error:"OcrTimeout"}` after its 10 s Gemini timeout, and 502 `{error:"OcrUpstream"}` after its single retry fails.
- **`generate-reading-dna`:** can return 502.
- **`generate-recap`:**
  - image mode returns **202** `{status:"accepted"}`;
  - it returns 503 when the service-role client or the OpenAI key is missing;
  - a non-POST request gets 405 and a malformed JSON body 400 `invalid_input`;
  - its top-level 500 body is `{"error":"Internal server error","requestId"}`, with details logged server-side only (since 2026-10-19, BC-02).
- **`ocr-page`** also answers 405 to a non-POST request, and its 500 body is `{error:"InternalError", message:"Unexpected error"}`.
- **Enforced:** `server:edge`; `client`.
- **Source:** `src/services/recapService.ts:69-76,151-158`; `src/services/loreService.ts:45-48`; `src/composables/useCapture.ts:126-134`; `supabase/functions/generate-recap/index.ts`, `handlers/recapImage.ts`; `supabase/functions/_shared/errors.ts`; `supabase/functions/ocr-page/index.ts`; deployed `generate-recap` v86, `ocr-page` v4.

### Theme

#### PLT-40 · Two themes, dark by default, no system mode
There are two themes: `'dark'` (default) and `'light'`. The choice is persisted in localStorage key **`bookhero_theme`**. Any other stored value, or unreadable storage, resolves to dark. There is no "follow system" mode, and `prefers-color-scheme` is never consulted for the app theme.
- **Enforced:** `client`.
- **Source:** `src/composables/useAppTheme.ts:3,8-16`.
- **Note:** this is a per-device preference, not synced and not user-scoped. The native default is PLT-Q06. `CLAUDE.md` and `main.css:38` describe VueUse `useColorMode`; that is stale, the real mechanism is this composable ⚠ PLT-D39.

#### PLT-41 · Theme application
At module load, `useAppTheme` sets `data-p-theme="<dark|light>"` on `<html>`. `main.ts` imports it before mount, so the wrong theme never flashes. It is set again on every change, and PrimeVue's dark selector is `[data-p-theme="dark"]`.
- **Enforced:** `client`.
- **Source:** `src/composables/useAppTheme.ts:18-27`; `src/main.ts:13-15,37-45`.

#### PLT-42 · Browser chrome colour follows the OS, not the app theme
`<meta name="theme-color">` is `#0a0a14` for OS dark and `#f0f4ff` for OS light. The manifest declares `#0a0a14` ⚠ PLT-D37.
- **Enforced:** `client`.
- **Source:** `index.html:11-12`; `public/manifest.webmanifest`.

#### PLT-42a · Theme tokens (values only)
- **Base preset:** PrimeVue **Lara**, with `primary` = the **indigo** scale (50–950) and `primary.contrastColor #ffffff`. Primary buttons force white text in both schemes.
- **Dark:**
  - background `#0a0a14`, with radial glows `#1a1040` (20 %/20 %) and `#0d1a3a` (80 %/80 %);
  - text `rgba(255,255,255,0.90)`, muted 0.55;
  - content surface `rgba(18,18,28,0.55)`; borders `rgba(255,255,255,0.10)`;
  - form fields `rgba(255,255,255,0.08)`, with focus border `primary.400`.
- **Light:**
  - background `#f0f4ff`, with glows `#e8e0f8` / `#dce8f8`;
  - text `rgba(15,15,30,0.90)`, muted 0.55;
  - content `rgba(255,255,255,0.65)`; focus border `primary.500`.
- **Glass:**
  - surface `rgba(18,18,28,0.50)` + blur 20 px / brightness 1.08 / saturate 1.6, radius 20 px, border `rgba(255,255,255,0.12)`;
  - light variant `rgba(255,255,255,0.55)`; `.glass-subtle` blurs 8 px.
  - Overlays (menus, dialogs, select popups) are forced opaque: `#1c1c2e` dark, `#ffffff` light.
- **Layout:**
  - system font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', …`), root 16 px;
  - `.page-container` max-width 680 px with 1 rem side padding;
  - `html` has `padding-top: env(safe-area-inset-top)`;
  - accent for active nav and tabs is indigo-400 (dark) / primary-600 (light tab menu).
- **Enforced:** `client`.
- **Source:** `src/assets/styles/preset.ts:11-200`; `src/assets/styles/main.css:24-58,86-91,141-212`; `src/assets/styles/glass.css:5-56`.
- **Note:** `docs/ios-foundation/design-tokens.md` already carries these values. Natively, glass is Liquid Glass (D-04), not this CSS recipe.

### Offline progress queue

Owned jointly with [02 · Reading sessions](02-reading-sessions.md) (SES-76–78, SES-91). This file owns the storage, triggers and drain mechanics.

#### PLT-43 · Queueing is decided by `navigator.onLine` at save time
A page save is queued only when `navigator.onLine === false` at the moment `updateProgress` runs. A save that fails while the browser believes it is online is rolled back and re-thrown, not queued. Only page saves are ever queued: Start, Pause and Resume refuse to run offline ("You appear to be offline. Start Session requires a connection." and the same for "Pause requires…" and "Resume requires…").
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:551-555,633-664`; `src/composables/useReadingSession.ts:94-112`.
- **Target:** queue on real connectivity failures too, which is safe once saves carry an `idempotency_key` (BC-04). See SES-76.

#### PLT-44 · Queue storage
IndexedDB database **`chronicler-offline`**, version **1**, object store **`progress_queue`** (`keyPath: 'id'`, autoIncrement). Record: `{ id, type: 'progress_update', payload: { bookId, currentPage, updatedAt }, retries: 0 }`. The record carries no user id. `retries` is never incremented, and `payload.updatedAt` is never sent ⚠ PLT-D12.
- **Enforced:** `client`.
- **Source:** `src/composables/useOfflineSync.ts:12-14,31-47`; `src/types/index.ts:148-158`.
- **Target:** each record is a typed, user-scoped `save_progress` operation (`book_id`, `page`, `note`, `client_occurred_at`, `idempotency_key`, `user_id`) (D-08 · BC-04).

#### PLT-45 · What an offline save does and skips
**Done offline:**
- optimistic local progress and library-snapshot update;
- `invalidate(library)`, enqueue, `pendingSync = true`, Background Sync registration;
- `lastPageSavedAt[bookId]` set to the optimistic time and never rolled back;
- a paused session's local `sessionPausedAt` cleared (the server keeps `session_paused_at`);
- an uncapped optimistic percentage.

**Not done, neither offline nor at replay:**
- the `progress_history` insert;
- the session clear (`session_start_at` stays set on the server);
- the session-ended capture prompt;
- the Insight milestone unlock and the completion-passport auto-generation;
- the `lastSession` / `readingStats` / `readingQuest` / `velocity` invalidations.

If enqueueing fails, the error is thrown after the optimistic update, with no rollback ⚠ PLT-D25.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:495-550,656-664`.
- **Target:** the replay writes the history row at its original time, ends the session and runs the completion pipeline server-side. Offline page changes count for pages, streaks and charts (D-08 · BC-04 · BC-05).
- **Note:** server cascades do run at replay. The replay upsert is `INSERT … ON CONFLICT DO UPDATE OF current_page`. So `page_captures_delete_on_completion` and `book_quizzes_delete_on_completion` fire when a queued save completes the book, as they also do for CSV-imported completed books and the add-book "Already finished" status.

#### PLT-46 · Replay is a FIFO bare upsert as the current user
The flush runs `getAll()` in FIFO order. For each record it calls `syncToSupabase(bookId, currentPage)`, which upserts `reading_progress { book_id, user_id: <currently signed-in user>, current_page }` on conflict `book_id,user_id`, then deletes the record. Failures stay queued silently and are retried forever, including a record for a deleted book, which fails on the FK on every drain ⚠ PLT-D28. When nobody is signed in, `syncToSupabase` throws `'Not authenticated'`, the records stay queued, and they are later flushed under **whichever** user signs in next ⚠ PLT-D12.
- **Enforced:** `client`.
- **Source:** `src/composables/useOfflineSync.ts:76-88`; `src/stores/progress.ts:52-79`.
- **Target:** replay through `save_progress` with `client_occurred_at` and `idempotency_key`. Drop records that hit permanent errors, and drop records belonging to another user (BC-04). The stale-replay conflict policy is SES-Q18 ([02](02-reading-sessions.md)).

#### PLT-47 · Drain triggers
The queue drains on any of three triggers:
1. window `online` (`progress.ts:86-95`);
2. the SW `sync` event with tag `progress-sync`, which posts `{type:'FLUSH_PROGRESS_QUEUE'}` to every window client, and `App.vue` then calls `drainQueue()`;
3. every progress `_fetcher` run while online (`progress.ts:131,149`).

Background Sync is registered on every app boot and every offline save, even when signed out. It is Chromium-only and silently skipped elsewhere (iOS Safari). The SW has no token, so with no window open nothing is flushed; the comment "even after the tab has been closed" is false ⚠ PLT-D39. The three triggers share no mutex, so concurrent drains can replay the same record twice; the upsert is idempotent, so this only wastes work ⚠ PLT-D27.
- **Enforced:** `client`.
- **Source:** `src/composables/useOfflineSync.ts:6-7,91-100`; `src/sw.ts:63-74`; `src/App.vue:29-33,40-41`; `src/stores/progress.ts:81-95,131,149,663`.

#### PLT-48 · Pending-sync flag is optimistic and not persisted
`drainQueue()` sets `pendingSync = false` after any flush attempt, **even if records failed and remain**. `pendingSync` is not rehydrated from IndexedDB on reload. The only indicator is the hero-card tag "Progress will sync when you're back online" ⚠ PLT-D26.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:81-84`; `src/components/dashboard/HeroBookCard.vue:240-247`.

#### PLT-49 · `updated_at` is stamped at replay and on every row update
Trigger `reading_progress_updated_at` (`BEFORE UPDATE FOR EACH ROW`, no column filter, function `set_updated_at()` → `now()`) and the column default `now()` stamp `reading_progress.updated_at`. They fire at **replay time**, not offline-save time, and on **every** update of the row: session start, pause, resume and clear, and DNF mark and resume. `updated_at` drives `lastReadAt` and the `get_library_with_progress` order (`coalesce(rp.updated_at, b.created_at) desc`). It also dates completions in `get_reading_quest_summary` (finished rows whose `updated_at` falls in the UTC year). So a session start re-sorts the library, and any later write to a finished book's row moves its completion year ⚠ PLT-D29.
- **Enforced:** `server:db` (trigger `reading_progress_updated_at`).
- **Source:** live `pg_trigger`, `information_schema.columns`, `pg_get_functiondef`.
- **Target:** a first-completion timestamp `reading_progress.completed_at`, stamped once by `save_progress`, drives "finished this year" (BC-04).

### Service worker & PWA

#### PLT-50 · Service-worker build and registration
The SW is built with strategy `injectManifest` from `src/sw.ts`, and VitePWA uses `registerType: 'autoUpdate'`. It is registered by the generated `registerSW.js` on `window.load` with `scope: '/'`. It is disabled in dev (`devOptions.enabled: false`).
- **Enforced:** `client` (build).
- **Source:** `vite.config.ts:14-27`; `dist/registerSW.js`.

#### PLT-51 · Precache
The precache holds every build output matching `**/*.{js,css,html,ico,png,svg,woff2}` plus `includeAssets: icons/*.png, icons/*.svg`. Outdated precaches are cleaned up.
- **Enforced:** `client` (SW).
- **Source:** `vite.config.ts:16,21-23`; `src/sw.ts:23-24`.

#### PLT-52 · SPA navigation fallback
Every navigation request is served the precached `index.html` (`NavigationRoute(createHandlerBoundToURL('index.html'))`, no allow/deny list). The app shell loads offline, but **data is not cached offline**.
- **Enforced:** `client` (SW).
- **Source:** `src/sw.ts:26-29`.

#### PLT-53 · Runtime caches
| Host / path | Strategy | Cache | Limits |
|---|---|---|---|
| `covers.openlibrary.org` | CacheFirst | `book-covers` | 200 entries, 30 days |
| `openlibrary.org/api/*` | NetworkFirst | `isbn-api` | 100 entries, 7 days |

Not cached: Supabase (REST/RPC/Auth/Storage/Functions), the Google Books API and Google cover thumbnails, `openlibrary.org/search.json`, and dictionaryapi.dev. The `book-covers` route almost certainly caches nothing. `<img>` requests are `no-cors` and return opaque (status 0) responses, Workbox `CacheFirst` without `CacheableResponsePlugin({statuses:[0,200]})` stores only status 200, and no `<img>` in `src/` sets `crossorigin` ⚠ PLT-D33.
- **Enforced:** `client` (SW).
- **Source:** `src/sw.ts:31-47`; `node_modules/workbox-strategies/StrategyHandler.js:497-500`.

#### PLT-54 · Silent auto-update with one reload
The SW calls `skipWaiting()` at install and `clients.claim()` on activate. `main.ts` reloads the page **once** on `controllerchange`, but only if the page already had a controller at startup, so a first install never reloads. There is no prompt, so an in-progress form, sheet or session UI is interrupted ⚠ PLT-D36.
- **Enforced:** `client`.
- **Source:** `src/sw.ts:13-20`; `src/main.ts:17-29`.

#### PLT-55 · HTTP cache headers and hosting
`vercel.json` sets:
- `/assets/(.*)` → `public, max-age=31536000, immutable`;
- `/index.html` → `no-cache`;
- `/(.*).webmanifest` → `no-cache`.

It configures no rewrites, no redirects and no security headers. The `no-cache` rule keys on the literal path `/index.html`, so `/` and deep links get Vercel's default HTML caching, and `sw.js` / `registerSW.js` have no explicit header. Without an SPA rewrite, a first visit or hard reload of a deep link with no active SW is likely a Vercel 404 ⚠ PLT-D35.
- **Enforced:** hosting config.
- **Source:** `vercel.json:2-29`.
- **Note:** [UNVERIFIED: Vercel project-level settings and default headers are not in the repo.] Universal links (D-11) need `/.well-known/apple-app-site-association` served from this host with `Content-Type: application/json` and no redirect (PLT-Q05).

#### PLT-56 · PWA metadata (manifest not linked)
`public/manifest.webmanifest` declares:
- name "The Chronicler", short_name "Chronicler";
- `display standalone`, `orientation portrait-primary`, `start_url /`;
- theme/background `#0a0a14`, `lang en`;
- icons 192, 512 and maskable 512;
- shortcuts "Current Read" (`/`) and "Add Book" (`/books/add`).

**No `<link rel="manifest">` exists**, because `VitePWA({ manifest: false })` injects none. Browsers therefore ignore the shortcuts, `display` and `orientation`. The iOS home-screen icon comes from `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">`, the status bar is `black-translucent`, and the viewport is `viewport-fit=cover`. Only the non-prefixed `mobile-web-app-capable` meta is set ⚠ PLT-D34.
- **Enforced:** `client` (static files).
- **Source:** `public/manifest.webmanifest`; `index.html:5-14`; `vite.config.ts:17`.

#### PLT-87 · User-facing product name
Every user-facing surface says **"The Chronicler"**: `<title>`, manifest, auth screen and the AI system prompts ("You are The Chronicler…"). "BookHero" appears only in code identifiers (package name `bookhero`, storage keys `bookhero_*`, the Supabase project). The vocabulary tab is labelled "Codex"; its route is `/lexicon` and its page `GreatLibraryPage`.
- **Enforced:** `client`; `server:edge` (prompts).
- **Source:** `index.html:14`; `public/manifest.webmanifest`; `src/pages/AuthPage.vue:7`; `package.json:2`; `supabase/functions/generate-book-quiz`, `supabase/functions/generate-recap/prompts/recap.ts`.
- **Target:** "The Chronicler" is the App Store / product name. "BookHero" stays the internal code name, and storage keys and identifiers are not renamed (D-03).

### Configuration, deployment & feature flags

#### PLT-57 · Frontend environment variables
All frontend variables are public, because they are embedded in the bundle:
- `VITE_SUPABASE_URL` (required; also used to build edge-function URLs `${VITE_SUPABASE_URL}/functions/v1/<slug>`);
- `VITE_SUPABASE_ANON_KEY` (required);
- `VITE_GOOGLE_BOOKS_API_KEY` (optional; Google Books search and ISBN lookup).

A missing URL or key throws at module load ("Missing Supabase environment variables. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."), which leaves a blank page. The tracked `.env.example` holds a real-format Google API key (39 chars, `AIza` prefix; value not reproduced) ⚠ PLT-D10.
- **Enforced:** `client`.
- **Source:** `src/services/supabase.ts:4-12`; `src/composables/useCapture.ts:37`; `src/services/recapService.ts:33`; `src/stores/bookPassport.ts:10`; `src/services/loreService.ts:34`; `src/composables/useIsbn.ts:38`; `src/services/bookSearchService.ts:25`; `.env.example`.
- **Target:** a server-side book-search proxy hides the Google key and adds caching and rate limits (BC-15).

#### PLT-58 · Edge-function secrets
Across all seven product edge functions, `Deno.env.get` reads exactly these secrets:
- `GEMINI_API_KEY` (×7, every AI function);
- `OPENAI_API_KEY` (×1; recap images, model `gpt-image-2`);
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (platform-injected; ×1 each, the `generate-recap` image handler's admin client).
- **Enforced:** `server:edge`.
- **Source:** `supabase/functions/*/index.ts`; `supabase/functions/generate-recap/aiClient.ts:16`; `supabase/functions/generate-recap/openaiClient.ts:7,12`; `supabase/functions/generate-recap/handlers/recapImage.ts:36-37`.
- **Note:** `delete-account` will need the service role. Sign in with Apple token revocation needs Apple credentials as secrets (proposed names, not yet existing: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY`) (D-10 · BC-11).

#### PLT-59 · Feature flags are compile-time only
The only flag is `DISABLE_RECAP_LOCK = false` (`useRecapLock.ts:12`, used at `:111`); when true, the recap button ignores the page threshold and cooldown. It is for testing only. There are no runtime or remote feature flags.
- **Enforced:** `client`.
- **Source:** `src/composables/useRecapLock.ts:12,111`.
- **Target:** the recap lock is enforced in `generate-recap` on the server clock, so any bypass for testing becomes server-side configuration, never a client flag (BC-07).

#### PLT-60 · Build, tooling and tests
| Item | Value |
|---|---|
| Build | `vue-tsc -b && vite build` |
| Package manager | **pnpm** (`pnpm-lock.yaml`) |
| Tests | `vitest run` (jsdom, globals) |
| Lint / CI | no `lint` script, no CI workflow (`.github/` absent) |
| TypeScript | `src/sw.ts` excluded from the app tsconfig; flags `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch` |

Runtime versions:
- `@supabase/supabase-js` 2.103.2 (auth-js, postgrest-js, functions-js, storage-js, realtime-js 2.103.2);
- `vue` ^3.5.32, `vue-router` ^4.6.4, `pinia` ^3.0.4, `primevue` ^4.5.5, `@vueuse/core` ^14.2.1, `date-fns` ^4.1.0;
- `papaparse` ^5.5.4, `@ericblade/quagga2` ^1.12.1, `vuedraggable` ^4.1.0;
- dev: `typescript` ~6.0.2, `vite` ^8.0.4, `vite-plugin-pwa` ^1.2.0, `vitest` ^4.1.4, `jsdom` ^29, workbox-* ^7.4.0.

The repo has 26 unit spec files (about 121 cases). Platform coverage is limited to `useCache.spec.ts` (11) and `retryingFetch.spec.ts` (6). There are no tests for the auth store, router guard, offline queue, service worker, theme, toast cooldown, RPC contracts or edge functions, and no E2E ⚠ PLT-D41.
- **Enforced:** tooling.
- **Source:** `package.json:4-52`; `vitest.config.ts:5-6`; `tsconfig.app.json:11-17`; `tests/unit/`.
- **Note:** `CLAUDE.md`'s "npm test; npm run lint" is stale: there is no lint script, and the repo uses pnpm.

#### PLT-61 · Edge-function deploy settings are not version-controlled
Since 2026-10-19 (BC-02) `supabase/config.toml` is committed with the project id and `verify_jwt = true` for `generate-recap`, `generate-lore`, `ocr-page`, `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume` and `generate-book-quiz`, so a deploy from the repo reproduces the live flags (PLT-78). Local `supabase/migrations/` have drifted from live ⚠ PLT-D11.
- **Enforced:** Configuration (`supabase/config.toml`).
- **Source:** `supabase/config.toml`; live `list_edge_functions`; `supabase/reference/README.md`.
- **Target:**
  - keep the live baseline and squash it into a baseline migration (BC-03);
  - sync repo edge sources to the **deployed** versions, which are canonical: `generate-lore` v18 (accuracy-first, temperature 0.35) and `generate-reading-dna` v8 (Google Search grounding) (D-09 · BC-03).

### Timezone, dates & formatting

#### PLT-62 · Device IANA zone is passed to four RPCs (two spellings)
The client passes the browser IANA zone `Intl.DateTimeFormat().resolvedOptions().timeZone`:
- as `p_timezone` to `get_monthly_reading`, `get_reading_calendar` and `get_reading_records`;
- as **`p_time_zone`** (different spelling) to `get_book_passport_stats`, with a `'UTC'` fallback.

All four RPCs default to `'UTC'` server-side. An invalid zone string raises SQLSTATE `22023`.
- **Enforced:** `client` (zone choice); `server:rpc` (`at time zone`).
- **Source:** `src/composables/useMonthlyReading.ts:37`; `src/composables/useReadingCalendar.ts:40`; `src/composables/useReadingRecords.ts:35`; `src/stores/bookPassport.ts:19-25,35`; live `pg_get_functiondef`.
- **Target:** every stats RPC takes the reader's zone (D-07 · BC-06). Existing parameter names stay accepted for PWA compatibility (D-05).

#### PLT-63 · RPCs without a zone parameter compute in UTC
The DB `TimeZone` is `UTC`, so these RPCs bucket in UTC:
- **`get_reading_stats`:** "pages this week" = rolling `now() − 7 days`; "month" = `date_trunc('month', now())`; the streak is current if the last day is ≥ `current_date − 1`.
- **`get_reading_quest_summary`:** year window `make_timestamptz(p_year,1,1,…,'UTC')`; a "month" is 2 629 800 s.
- **`get_reading_velocity`:** day buckets `date_trunc('day', recorded_at)`, 30-day window.
- **`get_last_session`.**

So the same reading day can count differently across screens for non-UTC readers ⚠ PLT-D30.
- **Enforced:** `server:rpc`.
- **Source:** live function definitions; `current_setting('TimeZone') = 'UTC'`.
- **Target:** the reader's IANA zone is used for every day, week, month and year boundary: streaks, this week/month, quest year, sessions this month, the review daily tally and the Word-of-the-Day day (D-07 · BC-06).

#### PLT-64 · Quest year: local year on the client, UTC window on the server
The client picks the quest year with local `new Date().getFullYear()`, while the RPC uses UTC year boundaries. Around New Year, in non-UTC zones, the "current year" and the counted window can disagree ⚠ PLT-D30.
- **Enforced:** `client` + `server:rpc`.
- **Source:** `src/stores/readingQuest.ts:111`; live `get_reading_quest_summary`.
- **Target:** quest year boundaries in the reader's zone (D-07 · BC-06).

#### PLT-65 · Lexicon mixes UTC and local "today"
- **UTC date (`toISOString()`):** the Word-of-the-Day day key and `dueTodayCount`.
- **Local date (`_startOfTodayLocal`, `formatISODate`):** the daily review tally and `eligibleReviewWords`.
- **DB default:** `lexicon_entries.next_review_at` is a `date` defaulting to `CURRENT_DATE` (UTC) ⚠ PLT-D30.
- **Enforced:** `client`; `server:db` (column default).
- **Source:** `src/stores/lexicon.ts:133,334,355-359,377-378`.
- **Target:** the review daily tally, due set and Word-of-the-Day day in the reader's zone, via RPC (D-07 · BC-06 · BC-10). Detail: [05 · Codex & Lexicon](05-codex-lexicon.md).

#### PLT-66 · Who stamps which timestamp
- **Client clock** (ISO-8601 UTC via `toISOString()`): `reading_progress.session_start_at`, `session_paused_at` and `dnf_at`; `progress_history.recorded_at`; `importedAt` for DNF imports.
- **Server:** `reading_progress.updated_at` (trigger) and every `created_at`.

A device clock running ahead writes future timestamps that count at once in `pagesThisWeek` / `pagesThisMonth` and stay the "latest" row for `get_last_session` until real time catches up.
- **Enforced:** `client`; `server:db`.
- **Source:** `src/stores/progress.ts:230,247-249,284,365,523,563`; `src/stores/books.ts:286`.
- **Target:** server clock for every session and history timestamp. Client time is used only for offline replays, as `client_occurred_at` (D-06 · BC-04).

#### PLT-67 · Relative time
Under 120 s the helper shows "Just now"; otherwise date-fns `formatDistanceToNow(d, { addSuffix: true })` in en-US ("3 minutes ago", "about 2 hours ago", "1 day ago", "about 1 month ago", …). date-fns never emits "Yesterday" or weeks, so the doc comments in `useRelativeTime.ts:3-10` and `date.ts:16-19` are wrong ⚠ PLT-D39. A future timestamp (clock skew) gives `secondsAgo < 0`, which shows "Just now".
- **Enforced:** `client`.
- **Source:** `src/utils/date.ts:16-25`.

#### PLT-68 · Absolute dates and date-only parsing
| Helper / surface | Format | Zone / locale |
|---|---|---|
| `formatShortDate` | date-fns `'MMM d, yyyy'` | English month names, device zone |
| `formatISODate` | `'yyyy-MM-dd'` | local |
| Book Passport | `toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'})` | device locale |

Parsing differs. date-fns `parseISO('2026-04-24')` gives **local** midnight, but the passport's `new Date('2026-04-24')` gives **UTC** midnight. The passport `peakDay` is a SQL `date` local to `p_time_zone`, so readers west of UTC see the **previous day** ⚠ PLT-D31.
- **Enforced:** `client`.
- **Source:** `src/utils/date.ts:30-37`; `src/pages/BookPassportPage.vue:35-37`.
- **Note:** every client must treat RPC `YYYY-MM-DD` fields as floating calendar dates (no zone): `get_reading_calendar.date`, `get_reading_records.bestDay.date` and passport `peakDay`.

#### PLT-69 · Numbers and plurals
Numbers use `Number.prototype.toLocaleString()` with the device locale (thousands separators) in about 12 places. Plurals are hand-written English (`page`/`pages`, `word`/`words`).
- **Enforced:** `client`.
- **Source:** e.g. `src/components/dashboard/HeroBookCard.vue:226`; `src/components/profile/ReaderLevelStrip.vue:5,19`; `src/components/profile/MonthlyReadingChart.vue:115,119`.

#### PLT-70 · Language
UI copy is hard-coded English, with `<html lang="en">` and manifest `lang: en`. Two behaviours depend on language:
- Google Books free-text search adds `langRestrict=<first two letters of navigator.language>`; ISBN queries drop it.
- Dictionary lookups always hit `/entries/en/`.
- **Enforced:** `client`.
- **Source:** `src/services/bookSearchService.ts:31-34,104`; `src/composables/useLexicon.ts:4`.
- **Note:** localisation is PLT-Q08.

#### PLT-83 · The reader's timezone is not stored server-side
No table stores the reader's IANA zone. `user_settings` has only `id, user_id, weekly_goal, created_at, updated_at`, and no client reads or writes it (PLT-Q13). A server-side job therefore cannot compute "today" for a reader, and every zone-aware RPC depends on the caller passing the zone.
- **Enforced:** —
- **Source:** live `information_schema.columns` (`user_settings`).
- **Target:** persist the reader's zone, e.g. `user_settings.time_zone`. Every client updates it on launch and when the device zone changes, and jobs use it (D-07 · BC-06).

### Account lifecycle & data deletion

#### PLT-71 · Sign-up creates only the auth user
Sign-up creates only the `auth.users` row (plus its identity). There is no trigger on `auth.users`, and no profile or settings row is created. `community_profiles` is created on the first save of `/profile/edit`; until then, `get_my_community_profile` returning `null` is a valid state.
- **Enforced:** `server:db` (no auth triggers); `client`.
- **Source:** live `pg_trigger` (none in schema `auth`); `src/composables/useCommunityIdentity.ts:6-11`.
- **Note:** the iOS v1 profile is username + display name + avatar only (D-13; [10 · Community](10-community-circles.md)).

#### PLT-72 · No account deletion, export, reset or credential change exists
No client offers: in-app account deletion, data export, password reset ("Forgot password?"), password change or email change. A grep of `src/` finds no `updateUser`, `resetPasswordForEmail` or deletion code. App Store Guideline 5.1.1(v) requires in-app deletion whenever account creation exists, and GDPR requires erasure and access rights ⚠ PLT-D09.
- **Enforced:** —
- **Source:** grep over `src/`; `docs/legal-compliance-review.md` §3.
- **Target:**
  - **Account deletion** (F-12): immediate hard delete on **web and iOS** through a new `delete-account` edge function (D-10 · BC-11). It requires confirmation plus re-authentication, purges Storage `recap-images/{uid}/` and `community-avatars/{uid}/`, revokes the Sign in with Apple token, and calls `auth.admin.deleteUser`; FK cascades remove all rows (PLT-73).
  - **Password reset** (F-11): on both clients, through universal links (D-11 · BC-11).
  - **Data export:** optional (BC-11, PLT-Q07).

#### PLT-73 · Deleting the auth user cascades every user table
Every user-owned table in `public` has an FK to `auth.users(id) ON DELETE CASCADE`. That is 24 tables directly, plus `community_profile_privacy` and `community_follow_counts` through `community_profiles`, so all 26 product tables are emptied for the user.

Direct: `achievements`, `anki_review_sessions`, `blocks` (both sides), `book_passports`, `book_quizzes`, `books`, `circle_invitations` (both sides), `circle_members`, `circle_reactions`, `community_profiles`, `follows` (both sides), `lexicon_entries`, `lore_cards`, `page_captures`, `progress_history`, `reading_circles` (`owner_id`, `created_by`), `reading_dna`, `reading_goals`, `reading_progress`, `reading_quest_events`, `recaps`, `up_next_order`, `user_settings`, `vocabulary_extractions`.

Deleting a user who owns a reading circle deletes that circle and **every member's** rows in it.
- **Enforced:** `server:db` (`*_user_id_fkey` and the other FKs above).
- **Source:** live `pg_constraint`; `supabase/reference/live-baseline-2026-10-18.sql`.
- **Target:** `delete-account` relies on this cascade, so no per-table deletes are needed (D-10 · BC-11). Circles are dormant (D-13), so today no other member is affected (PLT-Q16).
- **Note:** auth-side rows (`auth.identities`, `auth.sessions`, `auth.one_time_tokens`, MFA tables) cascade too.

#### PLT-74 · Storage objects are not cascaded
These objects survive user deletion:
- `recap-images/{uid}/…` (private, 10 MB, png/jpeg/webp);
- `community-avatars/{uid}/…` (public, 5 MB, jpeg/png/webp).

`storage.objects` has no FK to `auth.users`, and its `protect_objects_delete` statement trigger blocks SQL deletes. Cleanup must therefore go through the Storage API with the service role (BE-71, [09](09-database-invariants.md)).
- **Enforced:** `server:db` (`storage.protect_objects_delete`).
- **Source:** live `storage.buckets`, `pg_trigger`.
- **Target:**
  - `delete-account` lists and removes both prefixes **before** `auth.admin.deleteUser` (D-10 · BC-11);
  - recap and book deletes also remove their images;
  - an orphan sweep catches the rest (BC-13).

#### PLT-75 · Book deletion is a hard cascade (summary)
`removeBook` hard-deletes the `books` row, and every per-book row cascades. The exception is `reading_quest_events.book_id` → `SET NULL`, so capture XP survives. A book that anchors a reading circle takes the circle, and **other members'** memberships, invitations and reactions, with it ⚠ PLT-D43. Recap images stay in Storage. Completion (`current_page >= total_pages`) deletes the book's `page_captures` and `book_quizzes` server-side for any writer; DNF has no server cascade.
- **Enforced:** `server:db` (FKs; triggers `page_captures_delete_on_completion`, `book_quizzes_delete_on_completion`).
- **Source:** `src/stores/books.ts:413-435`; live `pg_constraint`, `pg_trigger`.
- **Note:** owned by [01 · Library](01-library.md) (LIB-88). The cross-domain consequences of a delete are in [11 · Cross-domain](11-cross-domain.md).

### Platform security posture (live)

Full detail and remediation live in [09 · Database invariants](09-database-invariants.md) and the [backend contract](../backend-contract.md) §12 Security status. The repo will be made private, so findings are documented in full (D-16).

#### PLT-76 · RLS on every table; ownership checked on `user_id` only
RLS is enabled on all **26** product tables.

| Table group | Policies |
|---|---|
| `books`, `anki_review_sessions` | `ALL` with `user_id = (select auth.uid())` |
| `reading_progress`, `progress_history`, `recaps`, `up_next_order`, `lexicon_entries`, `book_passports` | per-command owner policies (split by BC-01) |
| `reading_quest_events` | SELECT-only (writes by trigger) |
| `achievements` | SELECT/INSERT (insert-only ledger) |
| `lore_cards`, `page_captures`, `reading_goals`, `book_quizzes` | per-command owner policies |
| `reading_dna`, `vocabulary_extractions`, `user_settings`, `community_profile_privacy` | **no DELETE policy** (rows disappear only by cascade) |
| circle tables | SELECT-only for `authenticated` (writes through SECURITY DEFINER RPCs) |
| `community_follow_counts` | owner SELECT only, role `public` (trigger-maintained) |

Since 2026-10-19 (BC-01), INSERT and UPDATE on the child tables (`reading_progress`, `progress_history`, `recaps`, `lexicon_entries`, `page_captures`, `lore_cards`, `up_next_order`, `book_passports`, `book_quizzes`, `vocabulary_extractions`) also require the referenced `book_id` to belong to the caller; otherwise the write fails with `42501`. Clients can no longer insert `follows` or write `community_profiles` directly (BE-05).
- **Enforced:** `server:db` (RLS).
- **Source:** live `pg_class.relrowsecurity`, `pg_policies`; migration `20261018120000_bc01_security_hardening.sql`.

#### PLT-77 · RPC caller-identity checks are inconsistent
| RPC | Guard (live) | `anon` EXECUTE | Effect for a mismatched caller |
|---|---|---|---|
| `get_reading_stats` | silent filter `p_user_id = auth.uid()` | no | zeros |
| `get_reading_records`, `get_monthly_reading`, `get_reading_calendar`, `get_book_passport_stats` | silent filter | no (revoked 2026-10-19) | zeros / `[]` / nulls |
| `get_reading_quest_summary` | raises `not_allowed` (`42501`) when `auth.uid()` is NULL or differs from `p_user_id` (NULL-safe since 2026-10-19) | no (revoked 2026-10-19) | 401 (anon) / 403 |
| `get_library_with_progress`, `get_library_breakdown`, `get_last_session`, `get_reading_velocity` | same `not_allowed` (`42501`) guard (since 2026-10-19); the parameter is kept for PWA compatibility | no | 403 |

`after_page_capture_saved` and `prune_page_captures_for_book` were dropped. Since 2026-10-19 (BC-01) no `public` function is executable by `anon` or PUBLIC, and `authenticated` may execute only the client allowlist (BE-06): trigger and helper functions such as `community_remove_pair_follows` are not client-callable, and the `postgres`-owned default ACL no longer grants EXECUTE on new functions.
- **Enforced:** `server:rpc` (guards); `server:db` (function grants).
- **Source:** migration `20261018120000_bc01_security_hardening.sql`; live `pg_get_functiondef`, `has_function_privilege`, `get_advisors(security)`; BE-06, BE-07 ([09](09-database-invariants.md)).
- **Note:** every client passes only its own uid.

#### PLT-78 · Three AI edge functions accept forged tokens
| Function (live version) | `verify_jwt` | In-function auth | Web transport |
|---|---|---|---|
| `generate-recap` (v86) | true | `supabase.auth.getUser` (`_shared/auth.ts`): signature, expiry, user exists | raw `fetch` |
| `generate-lore` (v20) | true | `supabase.auth.getUser` (`_shared/auth.ts`) | raw `fetch` |
| `ocr-page` (v4) | true | `supabase.auth.getUser` (`_shared/auth.ts`); 401 `{error:"Unauthorized", message:"Missing or invalid JWT"}` | raw `fetch` |
| `extract-vocabulary` (v2), `generate-reading-dna` (v8), `generate-page-resume` (v3), `generate-book-quiz` (v1) | true | gateway, then `decodeJwt` for `sub` | `functions.invoke` |

Common to all seven:
- methods `POST` + `OPTIONS`;
- CORS `Access-Control-Allow-Origin: *`;
- allowed headers `authorization, x-client-info, apikey, content-type`.

Since 2026-10-19 (BC-02) the gateway and the function both verify the token for `generate-recap`, `generate-lore` and `ocr-page`, so a forged, expired or anon-key bearer gets 401 before any AI call, and the base64url decoding bug is gone. The `recap_image` mode checks that the recap belongs to the caller before any AI call (404 `recap_not_found`). Until then these three ran with `verify_jwt = false` and only decoded the payload, so forged tokens were accepted (PLT-D04, PLT-D07, both fixed). The other four functions still decode `sub` by hand after the gateway check. There is no rate limit (BC-12).
- **Enforced:** `server:edge`.
- **Source:** live `list_edge_functions`; `supabase/config.toml`; `supabase/functions/_shared/auth.ts`; `supabase/functions/generate-recap/index.ts`, `supabase/functions/generate-lore/index.ts`, `supabase/functions/ocr-page/index.ts`.
- **Target:**
  - drop the hand-rolled `sub` decoding from the other four functions and use the shared check (BC-02 scope, not yet done);
  - one shared entitlement and AI-usage check in every AI function (BC-12).

#### PLT-84 · No realtime; cross-device freshness is TTL- and refocus-driven
Publication `supabase_realtime` contains **no tables**. The PWA's Postgres-changes subscription on `recaps` therefore never fires, and recap image status arrives by polling ([03 · Recaps](03-recaps.md)). A change made on another device (for example a session started on the web) appears only after the SWR TTL, a refocus, or a reload.
- **Enforced:** `server:db` (publication).
- **Source:** live `pg_publication_tables`; `src/composables/useRecapImage.ts:79-94`.
- **Target:** add `recaps` (`image_status`) and `reading_progress` to the publication, **or** define refresh-on-foreground as the contract. Also: a delta/paginated library RPC (`changed_since`) and `device_tokens` for APNs later (BC-14; PLT-Q12).

#### PLT-85 · No entitlements or AI-usage metering
No table, RPC or edge-function check gates any feature or meters AI usage. Every signed-in user can call every AI function without limit. (Until BC-02 on 2026-10-19, so could anyone with a forged token on three of them.)
- **Enforced:** —
- **Source:** live schema (no entitlement or usage tables); `supabase/functions/*`.
- **Target:** add an `entitlements` table (App Store Server Notifications v2 or RevenueCat), an `ai_usage` ledger and one shared check in every AI edge function, allowing all calls until tiers are decided. Tiers and prices are undecided, and any tier table is a non-binding draft (D-14 · BC-12; PLT-Q14).

#### PLT-86 · Per-request database budget
Each PostgREST request runs under a fixed database budget:
- `statement_timeout` is **8 s** for `authenticated` and `authenticator`, and **3 s** for `anon`;
- `lock_timeout` is 8 s;
- `authenticator` preloads **`safeupdate`**.

So any RPC or table call is cancelled with SQLSTATE `57014` once it exceeds the budget. An `UPDATE` or `DELETE` without a filter is rejected.
- **Enforced:** `server:db` (`pg_db_role_setting`).
- **Source:** live `pg_db_role_setting`; BE-08a ([09](09-database-invariants.md)).
- **Note:** every stats/quest RPC full-scans the caller's `progress_history`, so it must finish inside 8 s.

### Legal & compliance (current state)

#### PLT-79 · No legal surfaces exist
The UI has none of these: privacy policy, terms of service, minimum-age gate, AI-content disclaimer, data-processing disclosure, or Wiktionary (CC BY-SA) attribution for dictionary definitions ⚠ PLT-D47.
- **Enforced:** —
- **Source:** grep over `src/`; `docs/legal-compliance-review.md` §3, §5.
- **Note:** the App Store requires a privacy-policy URL in App Store Connect and in-app, and the App Privacy labels. The third-party processors to disclose are Supabase, Google Gemini (including Google Search grounding for inferred recaps and DNA), OpenAI (recap images), Google Books, Open Library and dictionaryapi.dev (PLT-Q04). Confirm that `GEMINI_API_KEY` is on a paid tier, because free-tier prompts may be used for training (`docs/legal-compliance-review.md` §4).

#### PLT-80 · Protective invariants to preserve
Every client and backend change must keep these properties:
- capture images are never persisted;
- captures are private, never aggregated across users, and deleted on book completion (trigger `page_captures_delete_on_completion`);
- recap images are private (signed URLs, 1 h TTL in the gallery);
- community privacy defaults to `nobody`;
- CSV import never harvests Google (`cover_url: null`).
- **Enforced:** `server:db` (trigger, bucket privacy); `client`.
- **Source:** `docs/legal-compliance-review.md:15-22,72-79`; `src/stores/books.ts:306`; `src/composables/useCommunityIdentity.ts:28-33`; `src/components/book/BookRecapCarousel.vue:40`.

#### PLT-81 · No consent before personal data reaches third-party AI
Personal data reaches Google Gemini and OpenAI with no prior disclosure or consent step on any client: page photos and text, notes, reading history and book lists. Nothing records consent server-side. App Store Guideline 5.1.2(i) requires disclosure and explicit consent before personal data is shared with third-party AI ⚠ PLT-D47.
- **Enforced:** —
- **Source:** grep over `src/`; edge functions `ocr-page`, `generate-recap`, `generate-lore`, `extract-vocabulary`, `generate-page-resume`, `generate-book-quiz`, `generate-reading-dna`.
- **Note:** this file owns the consent flow; [04 · Capture](04-capture-resume-quiz.md) defers to it. Where consent is shown and stored is PLT-Q03.

---

## Flows

### F-1 · Cold start (web)
1. `main.ts` loads `useAppTheme`, which reads `bookhero_theme` and sets `data-p-theme`. It then registers the `controllerchange` listener (only if the browser is SW-capable), creates the app with Pinia, the router, the Confirmation and Toast services and PrimeVue, and mounts.
2. `App.vue` shows the full-page "Loading..." splash while `initializing`. In parallel, the router's first navigation awaits `authStore.initialize()`.
3. `initialize()` races `getSession()` against a 3 s timeout (PLT-10). The only thing persisted is the snapshot.
   - Session found → `user` set and the snapshot written.
   - No session → `user = null` and the snapshot removed.
   - Timeout → `user` = snapshot (may be null).

   Then `ready = true`, and the auth listener subscribes.
4. The guard resolves the route (→ `/login` if there is no user). `App.vue` sets `initializing = false`. It then calls `progressStore.setupListeners()`, which adds the `online` listener and registers Background Sync tag `progress-sync`, and subscribes to SW messages. All three are installed even when nobody is signed in.
5. The page mounts and fires its own fetches (Dashboard: PLT-36). The PostgREST burst right after a token refresh is where the 401 retry (PLT-33) applies.
6. Failure paths:
   - **Offline:** step 3 times out after 3 s. RPC (POST) reads fail at once, while table reads (GET) spend about 7 s in postgrest-js backoff, so some sections stay on skeletons longer. The Dashboard shows "Some things didn't load".
   - **Offline with no snapshot:** the reader lands on `/login`, and sign-in fails with the network error message.
   - **Missing env:** the app throws before mount (blank page).
   - **`getSession()` rejects:** permanent splash (PLT-D16).

### F-2 · Auth page state machine (`AuthPage.vue`)
```
            ┌──── tab "Sign up" ────┐
[signin] ◄──┤                       ├──► [signup]
   ▲  │     └──── tab "Sign in" ────┘       │
   │  └── "Sign in with magic link" ──► [magic] ◄── (from signup too)
   └──────── "← Back to password sign in" ──┘
submit(signin) → signInWithPassword → ok: push('/') | err: errorMsg
submit(signup) → signUp            → ok: push('/') | err: errorMsg
submit(magic)  → signInWithOtp     → ok: [magicSent] (terminal until reload) | err: errorMsg
```
`authStore.loading` drives the submit spinner. The page persists nothing; supabase-js persists the session.

### F-3 · Magic-link round trip (today)
1. `signInWithOtp({ email })` makes Supabase email a link to the project Site URL (no `emailRedirectTo`).
2. The reader opens the link, in the same or another browser. The app loads at the Site URL, `detectSessionInUrl` consumes the URL-fragment tokens (implicit flow), `getSession()` returns the new session, and the guard lets `/` through. If the email was unknown, a new account is created (PLT-02).
3. Failure: a link opened on another device works, but it always lands in the web app and never in an installed native app. An expired or used link lands on the Site URL with an error fragment that the app does not surface.

**Target (D-11 · BC-11):**
- every client passes `emailRedirectTo = https://<canonical-domain>/auth/callback` (proposed path, PLT-Q05), which is in the Redirect-URL allow-list;
- iOS claims that path as a universal link, and the PWA serves the same route;
- native clients use the PKCE flow and exchange the code for a session;
- an error state offers "Send a new link".

### F-4 · Sign-out / user switch (today)
1. More → "Sign out" closes the sheet and calls `supabase.auth.signOut()` (scope **global**).
2. On success, Supabase clears the local session and fires `SIGNED_OUT`. The listener sees the id change, so it runs `clearAll()`, sets `user = null` and removes the snapshot. The store sets `user = null` again, and the handler pushes `/login`.
3. A server 401/403/404 (session already expired or revoked, user deleted) is not a failure: auth-js removes the local session and the flow continues as step 2.
4. On a network failure the promise rejects. Nothing changes, no message is shown and there is no navigation (PLT-D14).
5. Other open tabs receive the broadcast: they clear SWR, set `user = null` and hide the nav, but stay on their page (PLT-17a, PLT-16).
6. There is **no page reload**. The `online` listener and the SW message listener stay attached.

What is and is not cleared:

| Item | Location | Cleared on sign-out? | On the next user's sign-in |
|---|---|---|---|
| Supabase session | localStorage `sb-<ref>-auth-token` | yes (supabase-js) | new |
| User snapshot | localStorage `bookhero-auth-user` (`src/stores/auth.ts:18-27`) | yes | rewritten |
| SWR metadata + refocus revalidators | `src/composables/useCache.ts:26,30` | **yes** (`clearAll`) | every key reloads (`'loading'`) |
| `books`, `libraryEntries` | `src/stores/books.ts:28-29` | no | replaced when the library RPC lands; the old library flashes on pages that render first (LIB-114) |
| progress map, `sessionPausedAt`, `lastPageSavedAt*`, `lastSessionEnded`, `pendingSync` | `src/stores/progress.ts:31-46` | no | map replaced on fetch; the rest persist (keyed by book id, inert) |
| `upNextOrder` | `src/stores/upNext.ts:11` | no | replaced on fetch |
| `entriesByBook`, Word-of-the-Day refs, `extraAllotment` | `src/stores/lexicon.ts:25-29,342` | no | per-book keys overwritten; stale keys remain |
| Anki totals | `src/stores/ankiSession.ts:9-13` | no | **can be written into the new user's row** if the session is saved before `fetchSession` ([05](05-codex-lexicon.md)) |
| `recapsByBook`, `generationStatus`, `streamingText` | `src/stores/recaps.ts:21-24` | no | per-book overwrite |
| `passportByBook`, `generating`, `streamingText` | `src/stores/bookPassport.ts:51-53` | no | per-book overwrite |
| `loreByBook`, `generatingBookIds` | `src/stores/loreCards.ts:24,28` | no | **the old user's cards stay in Codex "All Books"**; the banner can persist over `/login` (INS-55/58) |
| `capturesByBook`, `loadedBookIds` | `src/stores/captures.ts:18-19` | no (`clearCachedCaptures` is never called) | inert (different book ids) |
| quest `summary` | `src/stores/readingQuest.ts:106` | no | refetched (SWR) |
| Reading DNA | `src/stores/readingDna.ts:27-29` | no | reset on the next `fetchDna` (PRO-54) |
| achievements `_earned`, `_earnedLoaded` | `src/composables/useAchievements.ts:19-20` | no | **never reloaded**: the new user sees the old user's earned dates, and `sync()` skips those keys (PRO-47–51) |
| quiz cache `quizByBook` | `src/composables/useBookQuiz.ts:33` | no | inert (book ids) |
| hero `activeBookId`, `selectionSource` | `src/composables/useActiveBook.ts:18-19` | no | re-inferred (book not found) |
| Add Book search state | `src/composables/useBookSearch.ts:15-24` | no | **old query and results shown** on `/books/add` |
| Codex search state + results cache | `src/composables/useGreatLibrarySearch.ts:22-44` | no | cleared on the first `search()` by a different uid |
| community identity | `src/composables/useCommunityIdentity.ts:55-59` | no | reset when the uid differs |
| recap gallery | `src/composables/useRecapGallery.ts:23-26` | no | refetched (uid check) |
| calendar months / monthly years | `src/composables/useReadingCalendar.ts:14-16`; `src/composables/useMonthlyReading.ts:17-19` | no | reset on uid change |
| stats / records / breakdown / last-session / velocity refs | `useReadingProfile.ts:28-29`, `useReadingRecords.ts:23-24`, `useLibraryBreakdown.ts:24-25`, `useLastSession.ts:44-45`, `useReadingVelocity.ts:24` | no | refetched by SWR; old values visible until then |
| DNA recommendation covers | localStorage `bookhero:dna-covers` | no | signature mismatch → re-resolve |
| Word-of-the-Day daily cache | localStorage `bookhero_wotd_{uid}` | no (user-scoped key) | separate key per user |
| Theme, library view mode, active tab, grid collapse | localStorage `bookhero_theme`, `library-view-mode`, `library-active-tab`, `library-grid-collapsed` | no (device prefs) | kept |
| Offline queue | IndexedDB `chronicler-offline/progress_queue` | **no, and not user-scoped** | **drained as the new user**: RLS accepts the upsert with the new `user_id`, creating an orphan progress row on another user's `book_id` (PLT-D12) |
| Background Sync tag `progress-sync` | `src/sw.ts:63-74` | no | the SW posts `FLUSH_PROGRESS_QUEUE` to whoever is signed in |
| Cache Storage | workbox precache, `book-covers`, `isbn-api` | no | shared (not user data, except cover URLs) |
| In-flight AI jobs (lore, passport, recap stream, vocabulary, resume) | — | **not cancelled** | a lore card can be inserted for the new user against the old user's book (INS-58) |
| Glass toast / load-failure de-dup | `src/composables/useGlassToast.ts:15-20`; `src/composables/useLoadFailureNotice.ts:14` | no | cosmetic |

**Required for every client** (decided behaviour: PLT-Q01):
- on any user change, wipe every per-user item above, including the queue (after an attempted flush or an explicit discard) and module singletons;
- cancel in-flight per-user jobs, or bind them to the user who started them;
- keep only device preferences.

### F-5 · Session loss while using the app
1. `autoRefreshToken` fails (refresh token revoked or expired, global sign-out elsewhere, account deleted on another device). Supabase emits `SIGNED_OUT`, so `clearAll()` runs, `user = null` and the nav hides.
2. In-flight API calls return 401 and are retried once each, then "Some things didn't load" appears.
3. The page stays until the next navigation, which hits the guard and goes to `/login` (PLT-16).

Native target: route to the auth screen immediately on `signedOut`, and wipe state as in F-4.

### F-6 · SWR fetch lifecycle (per key)
```
(no entry) --swrStatus--> created(fetchedAt=0) => 'loading' --await swrRun--> success: fetchedAt=now ('fresh' while ≤ TTL)
                                                                           └ failure: fetchedAt stays 0 → next access 'loading' again
'fresh' --(age > TTL)--> 'background' --swrRun (fire & forget)--> success: fresh | failure: silent, still stale
any --invalidate / revalidate--> fetchedAt=0 → next access 'loading' (blocking)
any --swrTouch--> fresh
any --clearAll (user change)--> entry and revalidator deleted
visibilitychange 'visible' → every stale, registered, not-in-flight key: revalidator (background)
```

### F-7 · Progress save, online vs offline (platform view)
Full rules: [02 · Reading sessions](02-reading-sessions.md).

**Online** (`navigator.onLine === true`):
1. Optimistic update, then upsert `reading_progress`.
2. `swrTouch(progress)`, and invalidate `library`, `lastSession`, `readingStats` and `readingQuest:*`.
3. Insert `progress_history`; a failure here is ignored.
4. If a session was active, clear `session_start_at` / `session_paused_at` fire-and-forget, and invalidate `library` and `velocity`.
5. Emit the session-ended event if a history row was created.
6. Auto-generate the passport on the first ≥ 100 %, then run the lore milestone check.

A server error triggers a full rollback and a rethrow.

**Offline:**
1. Optimistic update, then `invalidate(library)`.
2. Enqueue `{bookId, currentPage, updatedAt}` and set `pendingSync = true`.
3. `registerBackgroundSync()`.

The only thing persisted is the IndexedDB record. A later replay sends the upsert only (PLT-46).

**Target:**
1. Both paths call `save_progress(book_id, page, note, client_occurred_at, idempotency_key)`.
2. Offline, the client stores that exact call (user-scoped) and replays it with its original `client_occurred_at`.
3. The server writes progress, history and session end atomically and runs completion effects (D-08 · BC-04 · BC-05).

### F-8 · Background-sync flush (Chromium only)
1. An offline save registers tag `progress-sync`.
2. When connectivity returns, the SW `sync` event fires and posts `{type:'FLUSH_PROGRESS_QUEUE'}` to every window client (`includeUncontrolled: true`).
3. `App.vue` calls `progressStore.drainQueue()`.

If no window is open, nothing is flushed, because the SW has no token.

### F-9 · Service-worker update
1. After a deploy, the browser fetches the new `sw.js` on its next update check.
2. The SW installs and calls `skipWaiting()`, then activates and calls `clients.claim()`.
3. Open tabs fire `controllerchange`, and `main.ts` reloads once (only if the tab had a controller at startup).
4. `cleanupOutdatedCaches()` deletes the old precaches.

Any unsaved input is lost (PLT-D36).

### F-10 · Target: Sign in with Apple + identity linking (D-11 · BC-11)
1. **Backend config:** enable the Apple provider in Supabase Auth (Services ID / key) and enable manual identity linking. Decide email confirmation first (PLT-Q02).
2. **Sign-in screen (both clients):** offer "Sign in with Apple", email + password, magic link, and "Forgot password?".
   - iOS: `ASAuthorizationAppleIDProvider` with a SHA-256-hashed nonce → `signInWithIdToken(provider: .apple, idToken:, nonce:)`.
   - Web: Supabase's Apple OAuth redirect to the universal-link callback.
3. **First Apple sign-in:** Apple returns the reader's name only once. Store it as `community_profiles.display_name` only with the reader's consent (D-13).
4. **Existing email readers:** before the first Apple authorisation on a device, show "Already have a Chronicler account? Sign in with email, then link Apple in Settings". Settings → "Link Apple ID" calls `linkIdentity`. This avoids a Hide-My-Email relay address creating a second, empty account. Email-matched automatic linking is safe only for **verified** emails.
5. **Failure paths:**
   - Apple cancel → stay on the sign-in screen;
   - nonce or ID-token rejection → generic error;
   - `linkIdentity` on an Apple ID already bound to another account → explain, and suggest signing in with Apple and deleting the duplicate.

[UNVERIFIED: the auto-linking and manual-linking settings are dashboard-only.]

### F-11 · Target: Password reset (D-11 · BC-11)
1. Sign-in → "Forgot password?" → enter email → `resetPasswordForEmail(email, { redirectTo: https://<canonical-domain>/auth/reset })`.
2. Always show a neutral confirmation ("If an account exists for this email, we sent a link"), so account existence is not revealed. Map rate-limit errors to copy.
3. The link opens the universal link: the iOS app, or the PWA route on other devices.
4. Exchange the code (PKCE), which yields a recovery session (`PASSWORD_RECOVERY`).
5. Show "Set a new password" (with the server minimum length shown) → `updateUser({ password })` → signed in → Home.
6. Expired or used link → error screen with "Send a new link". Nothing is persisted until `updateUser` succeeds.
7. The PWA needs new public routes for the callback and reset. Today none exist, and the SPA rewrite gap (PLT-D35) must be fixed for direct opens.

### F-12 · Target: Delete account (D-10 · BC-11)
1. **Entry point (both clients):** Settings → "Delete account".
2. **Explanation screen.** It states that deletion is immediate and irreversible, and that it removes:
   - all books, progress, sessions, words, recaps and recap images, Insights, passports, DNA, goals and achievements;
   - the community profile and avatar.

   It also warns that every device is signed out, and that unsynced offline saves on this device are discarded.
3. **Re-authentication:** password (email readers) or a fresh Sign in with Apple authorisation (Apple readers). The Apple flow yields a fresh `authorizationCode`, which the client forwards for token revocation.
4. **Explicit confirm:** destructive button "Delete account"; Cancel is the default.
5. **Client call:** `delete-account` with the access token, `apikey`, and optionally `{ appleAuthorizationCode }`.
6. **Server** (service role; `verify_jwt = true` + `getUser`):
   - **a.** Verify the caller, and require a recent authentication, e.g. the newest `amr` timestamp within 5 min (proposed; PLT-Q16).
   - **b.** For an Apple identity, exchange the code and revoke the token at `appleid.apple.com/auth/revoke`.
   - **c.** List and remove every object under `recap-images/{uid}/` and `community-avatars/{uid}/` through the Storage API, paginated.
   - **d.** Call `auth.admin.deleteUser(uid)` (hard delete). The FK cascades empty all 26 tables (PLT-73).
   - **e.** Return `200 { deleted: true }`.
7. **Failure semantics:**
   - (a) fails → 401/403; nothing changes.
   - (c) fails → 5xx retryable; the account still exists, and a retry is idempotent.
   - (d) fails after (c) → 5xx retryable; rows remain, images are already gone, and a retry completes.
   - (b) fails → handling is PLT-Q16 (recommendation: log and continue).
   - No internal error text appears in any response (BC-02).
8. **Client after success:**
   - wipe all local per-user state (F-4 list) and sign out locally (the server now answers 401/403, which auth-js ignores);
   - show the auth screen with "Your account was deleted";
   - other devices lose their refresh token and hit F-5.
9. **Late writes:** in-flight AI jobs for the deleted user fail on FKs. A recap-image job can still upload an orphan after step (c); the BC-13 orphan sweep removes it.

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| `GET_SESSION_TIMEOUT_MS` | 3000 ms | Max wait for `getSession()` before the snapshot fallback | `src/stores/auth.ts:14` |
| `USER_SNAPSHOT_KEY` | `bookhero-auth-user` | localStorage `{id,email}` snapshot | `src/stores/auth.ts:18` |
| Supabase session key | `sb-<project-ref>-auth-token` | localStorage session | supabase-js default |
| Auth flow (web) | `implicit` | magic-link tokens in the URL fragment | auth-js default |
| Access-token lifetime | ~3600 s | `app.settings.jwt_exp`; observed ~1 h | live GUC; `src/services/retryingFetch.ts:11` |
| Sign-out scope | `global` | revokes every device's refresh token | supabase-js default |
| `RETRY_DELAY_MS` | 400 ms | delay before the single PostgREST 401 retry | `src/services/retryingFetch.ts:19` |
| 401 retry count / URL filter | 1 / contains `/rest/v1/` | PostgREST tables and RPC only | `src/services/retryingFetch.ts:57-61` |
| postgrest-js built-in retry | 3 retries, 1/2/4 s (cap 30 s) or `Retry-After`; GET/HEAD/OPTIONS; network error or 520/503 | library default | postgrest-js 2.103.2 `dist/index.mjs:5,19,23,94-99` |
| `COOLDOWN_MS` | 30 000 ms | min gap between "Some things didn't load" toasts | `src/composables/useLoadFailureNotice.ts:12` |
| Glass toast lives | success 5000 ms · warn 6000 ms · loading 0 (persist) | defaults | `src/composables/useGlassToast.ts:44-50` |
| PrimeVue toast lives | 2500–4000 ms | per call site | grep `life:` |
| Theme key / attribute / default | `bookhero_theme` / `data-p-theme` / `dark` | theme persistence | `src/composables/useAppTheme.ts:3-13` |
| SWR default TTL (unknown key) | 60 000 ms | `swrRun` fallback | `src/composables/useCache.ts:73` |
| SWR TTLs | see [Caching & offline](#caching--offline) | per key | stores/composables |
| Velocity TTL | 365 days | explicit invalidation only | `src/composables/useReadingVelocity.ts:25` |
| IndexedDB DB / store / version | `chronicler-offline` / `progress_queue` / 1 | offline queue | `src/composables/useOfflineSync.ts:12-14` |
| Background Sync tag | `progress-sync` | SW sync | `src/composables/useOfflineSync.ts:96`; `src/sw.ts:64` |
| SW → client message | `{ type: 'FLUSH_PROGRESS_QUEUE' }` | drain request | `src/sw.ts:72`; `src/App.vue:30` |
| `book-covers` cache | CacheFirst, 200 entries / 30 days | Open Library covers | `src/sw.ts:32-38` |
| `isbn-api` cache | NetworkFirst, 100 entries / 7 days | Open Library `/api/*` | `src/sw.ts:41-47` |
| Precache glob | `**/*.{js,css,html,ico,png,svg,woff2}` | app shell | `vite.config.ts:22` |
| Asset cache header | `public, max-age=31536000, immutable` | `/assets/*` | `vercel.json:4-11` |
| `--app-nav-bottom-clearance` | `calc(6rem + env(safe-area-inset-bottom))` | page bottom padding / toast offset | `src/assets/styles/main.css:11` |
| Bottom nav geometry | height 4rem; bottom `safe-area + 0.75rem`; sides 0.75rem; radius 18 px; tap target ≥ 44×44 px | layout | `src/components/shared/AppBottomNav.vue:133-152` |
| z-index stack | backdrop 198 · sheet 199 · nav 200 · lore banner 1200 · glass toast 1210 · splash 9999 | overlays | `AppBottomNav.vue:140,196,207`; `LoreGenerationBanner.vue:39`; `GlassToast.vue:45`; `LoadingSpinner.vue:39` |
| Splash | `rgba(0,0,0,0.4)` + blur 4 px, 40 px spinner, "Loading..." | cold start | `src/components/shared/LoadingSpinner.vue:20,36-42` |
| Page container | max-width 680 px, side padding 1 rem | layout | `src/assets/styles/main.css:86-91` |
| Relative time "Just now" | < 120 s | formatting | `src/utils/date.ts:23` |
| Short date format | `MMM d, yyyy` | formatting | `src/utils/date.ts:31` |
| `DISABLE_RECAP_LOCK` | `false` | test-only compile-time flag | `src/composables/useRecapLock.ts:12` |
| DB `TimeZone` | `UTC` | implicit day buckets in non-zone RPCs | live `current_setting` |
| `statement_timeout` | authenticated/authenticator 8 s · anon 3 s | per-request DB budget | live `pg_db_role_setting` |
| `lock_timeout` / `safeupdate` | 8 s / on (authenticator) | lock budget; filterless UPDATE/DELETE rejected | live `pg_db_role_setting` |
| Storage bucket limits | `recap-images` 10 MB private png/jpeg/webp · `community-avatars` 5 MB public jpeg/png/webp | uploads | live `storage.buckets` |
| Recap image signed-URL TTL | 3600 s (gallery) | private images | `src/components/book/BookRecapCarousel.vue:40` |
| `user_settings.weekly_goal` | 1–7, default 3 | dead feature (PLT-Q13) | live `upsert_weekly_goal` |
| Recent-auth window for deletion (proposed) | 5 min | `delete-account` re-auth check | proposal (PLT-Q16) |

---

## Data touchpoints

| Object | Read / write | By whom | Contract |
|---|---|---|---|
| Supabase Auth (`auth.users`, `auth.identities`, `auth.sessions`) | sign-in/up, magic link, refresh, sign-out | supabase-js on every client | [backend contract](../backend-contract.md) §1 |
| `reading_progress` | UPSERT `{book_id, user_id, current_page}` on conflict `book_id,user_id` (offline replay) | web offline queue | §3 Tables |
| `user_settings` | none today; target `time_zone` (BC-06) | — | §3 Tables, §16 Planned changes |
| Read RPCs (`get_library_with_progress`, `get_reading_stats`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity`, `get_reading_quest_summary`, `get_reading_records`, `get_reading_calendar`, `get_monthly_reading`, `get_book_passport_stats`) | read; guard status per PLT-77 | feature domains | §8 RPC catalogue, §12 Security status |
| Edge functions (7 product functions) | auth mode per PLT-78 | feature domains | §10 Edge functions |
| `delete-account` (planned) | service role: Storage purge + `auth.admin.deleteUser` | Settings on web + iOS | §16 Planned changes |
| Storage `recap-images`, `community-avatars` | purge on account deletion (planned) | `delete-account` | §7 Storage |
| FK cascades from `auth.users` | delete | Postgres | §4 Cascades & lifecycle effects |
| localStorage / IndexedDB / Cache Storage | read/write | web client only | [Caching & offline](#caching--offline) |

---

## Client-side logic & server migration

| # | Logic | Today | Under D-06 / BC | After migration |
|---|---|---|---|---|
| 1 | Caller isolation for library / last-session / breakdown / velocity RPCs | client must pass its own uid | **BC-01**: server asserts `p_user_id = auth.uid()` | clients keep passing their uid (compatibility); the server enforces |
| 2 | Edge-function identity | three functions trust a decoded `sub` | **BC-02**: verified JWT | clients send token + `apikey` |
| 3 | Offline replay semantics (PLT-43–49) | page-only upsert, no history | **BC-04**: `save_progress` with `client_occurred_at` + `idempotency_key` | client keeps queue storage and drain triggers; server owns semantics |
| 4 | Session / history / DNF timestamps | device clock | **BC-04**: server clock | client sends `client_occurred_at` only for replays |
| 5 | Day / week / month / year boundaries | mixed UTC / device | **BC-06**: `p_timezone` everywhere + stored zone | client sends the device IANA zone and keeps the stored zone current |
| 6 | Completion side effects | six paths fire different subsets | **BC-05** | clients render results only |
| 7 | "Finished this year" date | `reading_progress.updated_at` | **BC-04**: `completed_at` | — |
| 8 | Recap lock incl. `DISABLE_RECAP_LOCK` | client | **BC-07** | client mirrors labels only |
| 9 | Account deletion | none | **BC-11**: `delete-account` | client: confirm, re-auth, call, local wipe |
| 10 | Password reset, Sign in with Apple, linking, SMTP, redirect URLs | none | **BC-11** (Supabase Auth config) | client UI + deep-link handling |
| 11 | Entitlements / AI usage | none | **BC-12** | client shows server decisions |
| 12 | Percentage cap and library status | client mapper uncapped (PLT-D32); status mirrors server | — | use the server values (`least(100, …)`, `current_page >= total_pages`) |

**Stays client-side on every platform:**
- auth UX: the guard order, the redirect away from login and a held deep link;
- the bounded cold-start restore (PLT-10);
- the full per-user wipe on user change (F-4);
- SWR TTLs and the invalidation map;
- the PostgREST 401 retry-once (PLT-33) and an explicit read-retry policy (PLT-Q10);
- load-failure de-duplication;
- theme, toasts and confirmation dialogs; back-navigation conventions;
- date-only parsing (PLT-68), relative and absolute formatting, number formatting.

---

## Caching & offline

### SWR key catalogue (in memory; cleared on any user change)

| Key | TTL | Fetcher (owner) | Refocus revalidator | Source |
|---|---|---|---|---|
| `books:{uid}` | 60 s | `booksStore.fetchLibrary` (`books.select('*').order(created_at desc)`) | yes | `src/stores/books.ts:25,49-75` |
| `library:{uid}` | 60 s | `booksStore.fetchLibraryWithProgress` (RPC `get_library_with_progress`; also rebuilds `books`) | yes | `src/stores/books.ts:81-133` |
| `progress:{uid}` | 30 s | `progressStore.fetchProgress` (derived from `libraryEntries` if present, else `reading_progress` select; drains the queue when online) | yes | `src/stores/progress.ts:20,99-171` |
| `lexicon:{uid}:{bookId}` | 60 s | `lexiconStore.fetchEntriesForBook` | yes | `src/stores/lexicon.ts:16,61-73` |
| `lexicon:{uid}:all` | 60 s | `lexiconStore.fetchEntriesForAllBooks` | yes | `src/stores/lexicon.ts:75-88` |
| `recaps:{uid}:{bookId}` | 60 s | `recapsStore.fetchRecapsForBook` | yes | `src/stores/recaps.ts:18,28-48` |
| `recaps:all:{uid}` (ad hoc, not in `cacheKeys`) | 60 s | `recapsStore.fetchRecapsForAllBooks` | yes | `src/stores/recaps.ts:184-212` |
| `bookPassport:{uid}:{bookId}` | 60 s | `bookPassportStore.fetchPassport` | yes | `src/stores/bookPassport.ts:8,85-111` |
| `upNext:{uid}` | 60 s | `upNextStore.fetchOrder` | yes | `src/stores/upNext.ts:8,27-38` |
| `lore:{uid}:{bookId}` | 120 s | `loreStore.fetchLoreForBook` | yes | `src/stores/loreCards.ts:19,36-57` |
| `lore:{uid}:all` | 120 s | `loreStore.fetchLoreForAllBooks` (also touches each per-book key) | yes | `src/stores/loreCards.ts:60-95` |
| `readingStats:{uid}` | 120 s | `useReadingProfile` (RPC `get_reading_stats`) | yes | `src/composables/useReadingProfile.ts:22,54-66` |
| `lastSession:{uid}` | 30 s | `useLastSession` (RPC `get_last_session`) | yes | `src/composables/useLastSession.ts:40,71-83` |
| `libraryBreakdown:{uid}` | 120 s | `useLibraryBreakdown` (RPC) | yes | `src/composables/useLibraryBreakdown.ts:20,48-60` |
| `readingQuest:{uid}:{year}` | 60 s | `readingQuestStore.fetchQuestSummary` (RPC; prefix-invalidated) | yes | `src/stores/readingQuest.ts:20,115-143` |
| `velocity:{uid}` | 365 d | `useReadingVelocity` (RPC with the current `bookIds`; key ignores them ⚠ PLT-D21) | **no** | `src/composables/useReadingVelocity.ts:25,60-80` |
| `readingRecords:{uid}` | 120 s | `useReadingRecords` (RPC) | yes | `src/composables/useReadingRecords.ts:19,46-58` |

### Mutation → cache effect matrix

T = `swrTouch` (fresh). I = `invalidate` (next access is a blocking reload). I* = prefix invalidation.

| Mutation (source) | books | library | progress | lexicon:* | recaps:{book} | passport:{book} | breakdown | stats | lastSession | quest:* | velocity | lore | upNext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `addBook` (`books.ts:206-210`) | T | I | | | | | I | | | I* | | | |
| `addBookWithInitialStatus` (`books.ts:236-242`) | T | I | I | | | | I | I | | I* | I | | |
| `importBooks` (`books.ts:355-362`, then library refetch) | T | I | I | | | | I | I | | I* | I | | |
| `updateBook` (`books.ts:407-410`) | T | I | | | | | I | | | I* | | | |
| `removeBook` (`books.ts:427-434`) | T | I | I | I* `lexicon:{uid}` | I | I | I | | | I* | | | |
| `startSession` (`progress.ts:313-314`) | | I | T | | | | | | | | | | |
| `clearSession` (`progress.ts:343`) | | I | | | | | | | | | | | |
| `markDnf` / `resumeDnf` (`progress.ts:386-387,415-416`) | | I | T | | | | | | | | | | |
| `setInitialProgress` (`progress.ts:458-463`) | | I | T | | | | I | I | | I* | I | | |
| `updateProgress` online (`progress.ts:549,555-560,603-604,653`) | | I | T | | | | | I | I | I* | I (only if a session ended) | | |
| `updateProgress` offline (`progress.ts:549`) | | I | | | | | | | | | | | |
| `saveCapture` (`captures.ts:113`) | | | | | | | | | | I* | | | |
| `generateRecap` insert (`recaps.ts:156-157`) | | | | | I | | | | | I* | | | |
| `maybeUnlockForMilestone` (`loreCards.ts:175-177`) | | | | | | | | | | I* | | T book+all | |
| `markBookLoreSeen` (`loreCards.ts:206-207`) | | | | | | | | | | | | T book+all | |
| `saveGoal` (`readingQuest.ts:171`) | | | | | | | | | | I* | | | |
| lexicon `addEntry` / `updateLeitner` / `masterWord` / `restoreEntryState` (`lexicon.ts:124-125,217-218,267-268,306-307`) | | | | T book+all | | | | | | | | | |
| `saveOrder` (`upNext.ts:80`) | | | | | | | | | | | | | T |
| passport `refreshPassportStats` / `generatePassport` (`bookPassport.ts:82,183`) | | | | | | T | | | | | | | |

Never invalidated by any mutation (TTL or refocus only):
- `readingRecords:{uid}`;
- `recaps:all:{uid}` ⚠ PLT-D22;
- `lore:*` after a book delete;
- `lastSession` after a book delete or DNF;
- `readingStats` after `removeBook` or `markDnf`.

`lexiconStore.invalidateAll()` calls `swrTouch` (marks fresh) despite its name, and has no callers ⚠ PLT-D23. The cross-domain gaps (delete, edit, DNF, completion) are listed in [11 · Cross-domain](11-cross-domain.md).

### Session-lifetime (non-SWR) module caches

| Cache | Scope / reset | Invalidation | Source |
|---|---|---|---|
| Reading-calendar months | per user; reset on user change only | none: stale after new reading until reload, despite the comment ⚠ PLT-D24 | `src/composables/useReadingCalendar.ts:8-32` |
| Monthly-reading years | per user; reset on user change only | none, same wrong comment ⚠ PLT-D24 | `src/composables/useMonthlyReading.ts:5-30` |
| Codex search results | per uid; cleared when the uid changes | `force` option | `src/composables/useGreatLibrarySearch.ts:42,150-160` |
| Book quiz | module-level | quiz eligibility rules ([04](04-capture-resume-quiz.md)) | `src/composables/useBookQuiz.ts:31-33` |
| Community identity | per user, at most 3 failed fetch attempts | `force` (no caller) | `src/composables/useCommunityIdentity.ts:51-91` |
| Captures | once per book per app session | patched locally | `src/stores/captures.ts:18-19` |

### Browser persistence inventory

| Store | Key | Value | User-scoped | Cleared on sign-out | Source |
|---|---|---|---|---|---|
| localStorage | `sb-<ref>-auth-token` | Supabase session | yes | yes | supabase-js |
| localStorage | `bookhero-auth-user` | `{id,email}` | yes | yes | `src/stores/auth.ts:18-27` |
| localStorage | `bookhero_theme` | `dark` / `light` | no (device pref) | no | `src/composables/useAppTheme.ts:3` |
| localStorage | `bookhero_wotd_{uid}` | `{date (UTC), entryId, isPreview}` | yes | no | `src/stores/lexicon.ts:22,132-175` |
| localStorage | `bookhero:dna-covers` | `{signature, items}` | no (signature-keyed) | no | `src/composables/useDnaRecommendations.ts:19,41-53` |
| localStorage | `library-view-mode` | `list` / `grid` | no | no | `src/pages/LibraryPage.vue:35-37` |
| localStorage | `library-active-tab` | `queue` / `completed` | no | no | `src/components/library/LibraryListView.vue:29-32` |
| localStorage | `library-grid-collapsed` | JSON map | no | no | `src/components/library/LibraryGridView.vue:48,59` |
| IndexedDB | `chronicler-offline` / `progress_queue` | queued progress | **no** (replayed as the current user) | no | `src/composables/useOfflineSync.ts:12-14` |
| Cache Storage | workbox precache, `book-covers`, `isbn-api` | shell / covers / ISBN JSON | no | no | `src/sw.ts` |

### Offline behaviour summary

**Works offline:**
- the app shell (SW precache + navigation fallback);
- the cold start with the last-user snapshot;
- page saves, queued in IndexedDB;
- cached Open Library ISBN JSON.

**Not available offline:**
- every data read, because nothing persists between reloads;
- starting, pausing and resuming sessions;
- captures, imports and book search;
- every AI feature;
- sign-out, which fails silently.

**Target per client:** a persistent per-user local cache, so offline cold starts show the last library and progress. A user-scoped operation queue replays through `save_progress`. "Pending sync" is derived from the queue's real contents (D-08 · BC-04; [02](02-reading-sessions.md)).

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| PLT-D01 | `get_library_with_progress`, `get_library_breakdown`, `get_last_session` and `get_reading_velocity` have no caller check (PLT-77) | Any signed-in user reads another user's library, progress, private session notes and velocity, given their uuid | BC-01 **Fixed 2026-10-19 (BC-01):** all four raise `42501 not_allowed` unless `p_user_id = auth.uid()`. |
| PLT-D02 | `get_reading_quest_summary` guard `p_user_id <> auth.uid()` is NULL-bypassable, and anon has EXECUTE (PLT-77) | Anyone with the public anon key reads any user's goal, completions, XP/level and activity counts | BC-01 (`is distinct from` + `auth.uid() is null` check; revoke anon) **Fixed 2026-10-19 (BC-01):** NULL-safe guard; anon `EXECUTE` revoked. |
| PLT-D03 | `prune_page_captures_for_book` is SECURITY DEFINER, unguarded and anon-executable (PLT-77) | Destructive cross-user delete of captures (keeps 1) | BC-01 (drop or lock) **Fixed 2026-10-19 (BC-01):** dropped. |
| PLT-D04 | `generate-recap`, `generate-lore` and `ocr-page` use `verify_jwt=false` + decode-only auth (PLT-78) | Unauthenticated AI spend; service-role image writes scoped by a forged id | BC-02 **Fixed 2026-10-19 (BC-02):** `verify_jwt = true` and `supabase.auth.getUser` (`generate-recap` v86, `generate-lore` v20, `ocr-page` v4). |
| PLT-D05 | 60 DEFINER functions are executable by `authenticated` and 17 by `anon`, including trigger/helper functions; the default ACL re-grants anon on new functions (PLT-77) | Wide attack surface that reopens with every migration | BC-01 (revoke + fix `pg_default_acl`) **Fixed 2026-10-19 (BC-01):** nothing in `public` is executable by `anon`/PUBLIC, `authenticated` only the client allowlist; the `postgres`-owned default ACL no longer grants `EXECUTE` (`supabase_admin` defaults unchanged). |
| PLT-D06 | RLS checks only `user_id`, never `book_id` ownership (PLT-76) | Rows can reference another user's book (reachable through the shared offline queue) | BC-01 **Fixed 2026-10-19 (BC-01):** child-table INSERT/UPDATE require book ownership. |
| PLT-D07 | `manualJwtDecode` uses `atob` on base64url without `-`/`_` normalisation (PLT-78) | Genuine tokens with non-ASCII claims (e.g. an Apple full name) get a 401 from `generate-recap` / `ocr-page` | BC-02 (verify, don't decode) **Fixed 2026-10-19 (BC-02):** the decoders are gone from `generate-recap` and `ocr-page`. |
| PLT-D08 | `generate-recap` 500 body returns `detail: String(err)` (PLT-39) | Internal error text leaks to any caller | BC-02 **Fixed 2026-10-19 (BC-02):** 500 body is `{"error":"Internal server error","requestId"}`. |
| PLT-D09 | Leaked-password protection is off; no password reset, change or account deletion (PLT-03, PLT-72) | Weak passwords accepted; a forgotten password locks the reader out; App Store 5.1.1(v) and GDPR blockers | Enable HIBP protection; BC-11 (D-10, D-11) |
| PLT-D10 | Tracked `.env.example` holds a real-format Google API key (PLT-57) | Key exposure; all `VITE_*` keys ship in the bundle anyway | Replace with a placeholder, rotate and referrer-restrict; BC-15 proxy |
| PLT-D11 | No `supabase/config.toml`; `verify_jwt` exists only on the live project; migrations drift (PLT-61) | A redeploy silently changes auth mode; the repo does not reproduce prod | BC-02 + BC-03 **Partly fixed 2026-10-19 (BC-02):** `supabase/config.toml` committed; migration drift remains (BC-03). |
| PLT-D12 | Sign-out leaves all Pinia, module and IndexedDB state, and the offline queue is not user-scoped (PLT-15, PLT-44, PLT-46) | Previous user's data visible on shared devices; their queued saves replay as the next user and create orphan rows; Anki totals and achievement dates can leak across accounts | Wipe every per-user store on user change (F-4); user-scoped queue (BC-04) |
| PLT-D13 | In-flight AI jobs are not cancelled or bound to their user on sign-out or switch (INS-58) | A lore card can be inserted for user B against user A's book; the lore banner persists over `/login` | Capture the user id at job start, abort on change; cancel on sign-out |
| PLT-D14 | Sign-out failure (offline) is silent and the promise rejects unhandled (PLT-14) | The reader believes they signed out but stays signed in | PLT-Q01 (recommended: sign out locally anyway, with feedback) |
| PLT-D15 | No reactive redirect on session loss (PLT-16) | Stale page with no nav after an expired session or a remote sign-out | Route to the auth screen on `SIGNED_OUT` |
| PLT-D16 | `initialize()` has no `catch`, and a rejected promise stays cached (PLT-10) | Permanent "Loading..." splash until reload | Catch, set `ready`, fall back to the snapshot, reset `_initPromise` |
| PLT-D17 | Magic-link success is a dead end; errors are not cleared on tab switch; raw English Supabase errors (PLT-04, PLT-08) | No resend or change-email path; confusing copy | Resend with cooldown, "Use another email", error-code mapping |
| PLT-D18 | The requested deep link is lost through the login redirect (PLT-05) | Universal links (D-11) would land on Home after sign-in | Carry a `redirect` and restore it after auth |
| PLT-D19 | The More sheet stays open after tab navigation (PLT-22) | Sheet covers the new page | Close on route change |
| PLT-D20 | `invalidate` forces a blocking reload; revalidators are never unregistered; `cacheSubscribe` and `revalidate` are unused (PLT-28, PLT-30) | Skeleton flashes; refocus storm of every visited key | Make invalidation stale-while-revalidate; track live subscribers |
| PLT-D21 | `velocity:{uid}` ignores `p_book_ids`, with a 365-day TTL | A book that starts without a session gets no forecast until a session ends or reload | Key by (uid, sorted book ids) or merge per book |
| PLT-D22 | `recaps:all:{uid}` is outside `cacheKeys` and never invalidated by `generateRecap` | New recaps missing from all-books views for up to 60 s or until refocus | Invalidate on insert |
| PLT-D23 | `lexiconStore.invalidateAll()` calls `swrTouch` and has no callers | Misleading API; marks stale data fresh if used | Fix or delete |
| PLT-D24 | Calendar and monthly session caches never refetch the current month or year (comments claim they do) | Reading Stats is stale after new reading until reload | Expire the current period, or invalidate on save |
| PLT-D25 | Offline saves skip history, session end, prompt, passport, Insight and invalidations (PLT-45) | Offline reading never appears in stats, streaks or calendar; zombie sessions | D-08 · BC-04 · BC-05 |
| PLT-D26 | `pendingSync` is cleared after a failed flush and not rehydrated on reload (PLT-48) | False "synced" impression; unsynced saves invisible | Derive the flag from queue contents |
| PLT-D27 | Three drain triggers share no mutex (PLT-47) | Duplicate replays (harmless today, harmful once replays write history) | Single-flight drain; `idempotency_key` (BC-04) |
| PLT-D28 | A queued save for a deleted book fails on the FK forever (PLT-46) | Queue never empties; repeated failing requests | Drop on permanent errors (23503, 403) |
| PLT-D29 | `reading_progress.updated_at` bumps on every update, including session and DNF writes (PLT-49) | Library re-sorts on session start; quest completion year moves on later writes | BC-04 (`completed_at`; separate last-read time) |
| PLT-D30 | Mixed UTC and local day boundaries (PLT-63, PLT-64, PLT-65) | The same day counts differently across screens; New-Year quest mismatch | D-07 · BC-06 |
| PLT-D31 | Passport `peakDay` parsed with `new Date()` as UTC midnight (PLT-68) | Previous day shown west of UTC | Parse as a floating calendar date |
| PLT-D32 | `mapReadingProgress` percentage is uncapped while server percentages cap at 100 | A value over 100 % where `current_page > total_pages` | Cap, or use the server value |
| PLT-D33 | `book-covers` CacheFirst stores nothing (opaque responses); Google covers are not routed (PLT-53) | No offline covers | `CacheableResponsePlugin({statuses:[0,200]})` or CORS images |
| PLT-D34 | Manifest not linked; no `apple-mobile-web-app-capable` (PLT-56) | Shortcuts, standalone display and orientation are ignored | Link the manifest (or let VitePWA inject it) |
| PLT-D35 | No SPA rewrite in `vercel.json` (PLT-55) | A cold deep link without the SW is likely a 404, which breaks universal-link fallbacks | Add a rewrite to `/index.html` (keep `/.well-known/*` and assets) |
| PLT-D36 | Silent auto-reload on SW update (PLT-54) | Interrupts an open page-save sheet or form | PLT-Q09 |
| PLT-D37 | `theme-color` follows the OS scheme, not the app theme (PLT-42) | Mismatched browser chrome | Update the meta from `useAppTheme` |
| PLT-D38 | Glass toast and lore banner share one screen slot (PLT-37) | The toast hides the banner | Stack or offset them |
| PLT-D39 | Misleading code comments and docs: `retryingFetch.ts:14-15` (library retry), `useCache.ts:104-107` (invalidate), `useOfflineSync.ts:6-7` (closed-tab flush), `useRelativeTime.ts:3-10` + `date.ts:16-19` ("Yesterday", weeks), calendar/monthly refetch comments, `CLAUDE.md` / `main.css:38` (`useColorMode`) | Engineers and agents copy wrong behaviour | Correct the comments |
| PLT-D40 | Dead surface: `src/pages/LexiconPage.vue`, `src/components/HelloWorld.vue`, `src/style.css`, `src/assets/{hero.png,vite.svg,vue.svg}`, empty `src/composables/__tests__/` and `scripts/`; DB `upsert_weekly_goal`, `get_retention_summary`, `user_settings.weekly_goal`, `after_page_capture_saved`; unused `OfflineProgressMutation.retries` / `payload.updatedAt` | Confusion; anon-executable dead functions | Delete (DB part: BC-01; `user_settings` reuse: PLT-Q13) |
| PLT-D41 | No lint script or CI; `CLAUDE.md` commands are stale; no tests for auth, router, queue, SW or theme (PLT-60) | Regressions in platform code go unnoticed | Add lint + CI; cover the auth store, guard and queue |
| PLT-D42 | `function` declarations violate the arrow-functions-only rule (`useOfflineSync.ts`, `stores/recaps.ts`, `App.vue:29`, `services/recapService.ts:47`) | Style drift | Convert to arrow functions |
| PLT-D43 | Deleting a book that anchors a reading circle deletes other members' circle data (PLT-75) | Silent cross-user data loss (dormant feature) | Owned by [01](01-library.md) / [10](10-community-circles.md) |
| PLT-D44 | `get_library_breakdown` ignores `dnf_at`, while `get_library_with_progress` returns `'dnf'` | DNF books counted as reading/unread in the breakdown | Owned by [07](07-profile-stats-goals.md) (PRO-95) |
| PLT-D45 | `retryingFetch`'s "no Authorization header" branch never triggers (PLT-33) | Signed-out 401s are retried too (harmless) | Check for a user JWT rather than header presence |
| PLT-D46 | Raw-fetch edge callers omit `apikey` and bypass `fetchWithAuth` (PLT-17) | Calls may be rejected once BC-02 enables gateway verification | Send `apikey` on every call, or route through `functions.invoke` (coordinate with BC-02) |
| PLT-D47 | No privacy policy, ToS, age gate, AI disclosure or consent, or Wiktionary attribution (PLT-79, PLT-81) | App Store (5.1.1, 5.1.2(i)) and GDPR blockers | PLT-Q03, PLT-Q04; attribution line in Codex |

---

## Open decisions

D-01…D-17 answered these questions, so they are not repeated: product name (D-03), Sign in with Apple and linking (D-11), password reset (D-11), account-deletion model (D-10), offline-save semantics (D-08), timezone convention (D-07), security-fix timing (BC-01/BC-02 Required), completion-year attribution (BC-04 `completed_at`), the one owner for completion effects (D-06 · BC-05), and the background-AI "once paid, finish and save" rule (BC-07). Stale offline replays are SES-Q18 ([02](02-reading-sessions.md)), and book delete vs circles belongs to [01](01-library.md) / [10](10-community-circles.md).

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| PLT-Q01 | **Sign-out semantics:** device or global scope? What if logout fails offline? What happens to unsynced saves? | `global` scope; an offline failure is silent and the reader stays signed in; the queue survives and replays as the next user | Default **local** (this device) sign-out, plus a separate "Sign out of all devices" action; deletion and password change revoke everything. On a network failure, sign out locally anyway and say so. Before wiping, try one flush; if saves remain, warn and let the reader discard them. Always wipe all per-user state (F-4). |
| PLT-Q02 | **Email confirmation:** turn on "Confirm email" (and keep magic-link sign-up)? | Effectively off (autoconfirm); a magic link creates accounts silently | **Enable it** before Sign in with Apple ships. Email-matched identity auto-linking is only safe for verified emails; otherwise someone could pre-register a victim's email and later be linked to the victim's Apple sign-in. Add a "Check your inbox" screen with resend. Keep magic-link sign-up (it is email-verified by construction). Requires custom SMTP (BC-11). |
| PLT-Q03 | **Third-party AI consent (Guideline 5.1.2(i)):** where is consent shown and stored, and what happens without it? | No disclosure or consent; data flows to Gemini and OpenAI | A one-time consent sheet on each client before the first AI feature (capture, recap, Insight, DNA, quiz, resume, vocabulary). Store it server-side (e.g. `user_settings.ai_consent_at` + `ai_consent_version`) so it is client-agnostic. Enforce it in the BC-12 shared edge check, with non-AI features still usable without consent. |
| PLT-Q04 | **Legal pages and age gate:** who authors the privacy policy and ToS, where are they hosted, and is there a minimum age? | None exist | Host both on the canonical web domain as public routes (outside the auth gate); link them from the auth screen and Settings on both clients and from App Store Connect. Add a 16+ self-declaration at sign-up (covers the strictest EU default). Add the Wiktionary attribution line. |
| PLT-Q05 | **Canonical domain and universal-link scope:** which domain serves `apple-app-site-association`, and which paths does iOS claim? | No AASA file; links land on the Site URL; no SPA rewrite | One canonical production domain for Site URL, redirects and AASA. v1 claims `/auth/*` (callback, reset). Add `/books/*` and `/lexicon` later. Fix PLT-D35 first. |
| PLT-Q06 | **Theme default:** follow system appearance, or dark-first with a manual toggle? | Web: dark default, manual toggle, no system mode | Add a "System" option on both clients and make it the default for new installs; keep any stored explicit choice. iOS respects Reduce Transparency / Increase Contrast (D-04). |
| PLT-Q07 | **Data export (GDPR Art. 20):** in-app export in v1? | None | Defer the in-app UI. Honour requests manually in v1, and add an `export-account` edge function (JSON of all user tables + signed image URLs) later (BC-11 optional). |
| PLT-Q08 | **Localisation:** English-only v1? Should dates follow the device locale? | Hard-coded English copy and date-fns English dates; numbers follow the device locale | English-only content for v1, but i18n-ready from day 1 (String Catalog on iOS; extracted strings on web). Use locale-aware date formatters on both. |
| PLT-Q09 | **Web update UX:** silent reload, or an "Update ready" prompt? | Silent auto-reload once per new SW | Defer the reload while a session, sheet or form is open. Otherwise reload on the next navigation, or show a small "Update ready — reload" pill. |
| PLT-Q10 | **Read-retry policy for native clients** | Web gets 3× backoff on GET table reads (library default) plus the 401 retry | Retry idempotent reads on network errors / 503 / 520 with 1/2/4 s backoff. Never auto-retry writes unless they carry an `idempotency_key` (BC-04). Keep the 401 retry-once. Show a manual "Retry" after the budget. |
| PLT-Q11 | **Multiple accounts on one device:** is fast switching supported? | Possible, but unsafe (PLT-D12) | Support one signed-in account per device; switching = full sign-out + wipe. |
| PLT-Q12 | **Realtime vs refresh-on-foreground (BC-14)** | Publication empty; polling for recap images | v1: refresh-on-foreground + bounded polling for image status. Add `recaps` and `reading_progress` to the publication when cross-device sessions or Live Activities need push. |
| PLT-Q13 | **Dead `user_settings` / weekly-goal backend** | No client caller; since BC-01 (2026-10-19) the functions are not client-executable | Same question as BE-Q01 ([09](09-database-invariants.md), which owns the backend decision) and PRO-Q07. Drop `upsert_weekly_goal`, `get_retention_summary` and `weekly_goal` unless a weekly-goal feature is on the roadmap. Keep `user_settings` as the home of `time_zone` (BC-06) and consent flags (PLT-Q03). |
| PLT-Q14 | **Entitlement source (BC-12):** App Store Server Notifications v2 directly, or RevenueCat? | No entitlements | Keep the schema provider-agnostic (`entitlements(user_id, product, source, status, expires_at)` + `ai_usage`) with allow-all checks now. Pick the provider when tiers are decided (D-14). |
| PLT-Q15 | **Crash reporting and diagnostics for native clients** | Web has none | Apple-native (MetricKit / Xcode Organizer) first. Any third-party SDK must collect no book titles, words, notes or recap text, and must appear in the privacy manifest and App Privacy labels. |
| PLT-Q16 | **Account-deletion edge cases:** recent-auth window; Apple revocation failure; owned circles with other members | No deletion exists | 5-minute recent-auth window. An Apple revocation failure does not block deletion (log for retry). Warn only if owned circles have other members (none while circles are dormant, D-13). |

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

- **Auth methods (D-11):** Sign in with Apple + email/password, magic link, password reset. Every email link uses the universal-link redirect (F-3, F-10, F-11). Map common auth error codes to friendly copy (PLT-04). Add resend and "use another email" to the magic-link screen (PLT-D17).
- **Cold start:** restore the stored session without blocking on network. Show cached UI at once, with a bounded wait like the web's 3 s (PLT-10), and let RLS protect data if the session was revoked.
- **Session loss:** route to the auth screen immediately on `signedOut` (PLT-D15).
- **User change:** wipe **all** per-user state on any user change: local DB/cache, queue, image caches, day caches, user-scoped preferences, in-flight jobs, widgets. Keep device preferences only (F-4, PLT-Q01). Bind long-running AI jobs to the user who started them.
- **Sign-out:** follow PLT-Q01. Treat a logout 401/403/404 as success (auth-js semantics).
- **RPC caller ids:** always pass the signed-in user's id for `p_user_id`, never another value. Do not rely on BC-01 for isolation in local caches; scope every local record by `user_id`.
- **Edge calls:** send `Authorization: Bearer <access_token>` **and** `apikey: <anon key>` on every call (PLT-D46).
- **Timeouts:** honour the 8 s statement timeout. Set request timeouts ≥ 10 s, treat SQLSTATE `57014` as retryable once, and always filter UPDATE/DELETE (`safeupdate`) (PLT-86).
- **401 retry:** add a retry-once-after-400 ms interceptor for PostgREST 401s (PLT-33). The cold-start token race is gateway-side and likely platform-independent. Choose an explicit read-retry policy (PLT-Q10).
- **SWR semantics:** port the useful parts, not the quirks:
  - fresh / background / loading states with the TTLs above, and per-key de-duplication;
  - refresh on app foreground only for keys whose screens are visible (avoid PLT-D20's storm);
  - `invalidate` = "stale, show cached, refresh in background";
  - key velocity by book set (PLT-D21); invalidate all-recaps on recap insert (PLT-D22).
- **Local cache:** persist it, so offline cold starts show the last library and progress.
- **Offline queue:** user-scoped `save_progress` operations with `client_occurred_at`, `idempotency_key` and retry metadata. Drain on connectivity, on foreground and opportunistically in the background. Drop operations that hit permanent errors. Detect offline from actual request failures, not only reachability. Show "pending sync" from the queue's contents (D-08 · BC-04).
- **Time and dates:**
  - send the device IANA zone to every zone-aware RPC (mind `p_time_zone` on the passport stats), and keep the stored server zone current (BC-06);
  - re-query zone-sensitive aggregates when the device zone changes;
  - parse RPC `YYYY-MM-DD` fields as floating calendar dates (PLT-68);
  - send ISO-8601 UTC timestamps with fractional seconds only where the server still accepts client time (offline replay).
- **Write validation:** validate before writing, using the server CHECKs. Book title is 1–500 chars, author 1–200, ISBN 10/13 normalised, `total_pages ≥ 1`, session note ≤ 160. Clamp `current_page` to `0…total_pages`, because the DB does not. Detail: [01](01-library.md), [02](02-reading-sessions.md).
- **Server cascades:** don't re-implement them. Completion purges captures and quizzes; book and account deletes cascade. After those writes, purge the affected local caches.
- **Navigation:** four tabs, Home · Library · Codex · Profile. The web's "More" items move to native surfaces: Add Book as a `+` in Library/Home toolbars; theme, Sign out, Delete account, legal links and consent in a Settings screen pushed from Profile. Typed routes mirror the web table. Preserve scroll position on back (PLT-20). Unknown deep links open Home; no 404 screen.
- **Compliance before any public build:**
  - BC-01 and BC-02 shipped;
  - in-app account deletion (D-10);
  - privacy-policy URL; App Privacy labels;
  - AI disclosure and consent (PLT-Q03);
  - Wiktionary attribution;
  - Gemini paid-tier confirmation.

### iOS-specific (iOS 26+, iPhone first — D-04)

- **supabase-swift:** use `AuthClient` with its Keychain-backed session storage and the PKCE flow. Handle universal links with `.onOpenURL { try await supabase.auth.session(from: url) }` and register the redirect URLs in Supabase Auth (PLT-82). supabase-swift auto-refreshes when the app returns to the foreground, the same moment foreground refreshes fire, so keep the 401 interceptor. [UNVERIFIED: supabase-swift lifecycle hooks were not inspected.]
- **Sign in with Apple:**
  - use `ASAuthorizationAppleIDProvider` with a hashed nonce → `signInWithIdToken(provider: .apple, …)`;
  - linking: `linkIdentity` from Settings (F-10);
  - deletion re-auth requests a fresh authorisation so `delete-account` can revoke the Apple token (F-12);
  - the base64url decode bug (PLT-D07) that would have hit Apple users with non-ASCII names on `generate-recap` / `ocr-page` was fixed by BC-02 (2026-10-19).
- **Account deletion (Guideline 5.1.1(v)):** reachable in-app from Settings, never only through a website. It uses the confirm + re-auth flow above.
- **Universal links:** add the Associated Domains entitlement for the canonical domain (PLT-Q05). The `apple-app-site-association` file is served from the web host (PLT-55, PLT-D35).
- **Theme:** `preferredColorScheme(nil)` for System, with an optional Light/Dark override in `@AppStorage("bookhero_theme")`, a device preference (PLT-Q06).
- **Glass:** native Liquid Glass (`.glassEffect`, `GlassEffectContainer`) is the only glass implementation; there is no pre-iOS-26 fallback (D-04). Standard `TabView`, toolbars, sheets and menus adopt it automatically. Keep text-dense dialogs and menus opaque (the web forces `#1c1c2e` / `#ffffff`). Respect Reduce Transparency (solid surfaces), Increase Contrast and Reduce Motion.
- **Overlays:**
  - glass toast → a top overlay with the same three variants and lifetimes (PLT-37); post `AccessibilityNotification.Announcement` for the web's `aria-live` regions;
  - PrimeVue bottom toasts → inline errors or a bottom banner above the tab bar;
  - ConfirmDialog → `.confirmationDialog` / `.alert`;
  - lore banner → top overlay.
- **App lifecycle mapping:**

  | Web | iOS |
  |---|---|
  | `visibilitychange` | `scenePhase == .active` |
  | `navigator.onLine` / `online` | `NWPathMonitor`, plus request-failure detection |
  | Background Sync | `BGAppRefreshTask` (best-effort only) |
  | Screen Wake Lock (Focus mode) | `UIApplication.shared.isIdleTimerDisabled` while shown |
  | `navigator.vibrate` | `UINotificationFeedbackGenerator` / Core Haptics |
  | Web Share | `ShareLink` |
  | manifest shortcuts | Home Screen quick actions ("Current Read", "Add Book") |
  | `orientation: portrait-primary` | portrait-only on iPhone |

- **Privacy:**
  - privacy manifest (`PrivacyInfo.xcprivacy`) with the required-reason APIs actually used (e.g. UserDefaults `CA92.1`) and `NSPrivacyTracking = false`;
  - `NSCameraUsageDescription` for ISBN scanning and page capture; `PhotosPicker` needs no photo-library permission;
  - App Privacy labels: email, user content (photos, captured text, notes, words, library), product interaction, user ID; processors as in PLT-79.
- **OCR (D-15):** on-device Vision runs first, with fallback to `ocr-page`. Thresholds are recalibrated for Vision ([04](04-capture-resume-quiz.md)). Camera consent and AI consent (PLT-Q03) are separate prompts.
- **Accessibility:** Dynamic Type everywhere (the web uses fixed rem sizes), ≥ 44 pt targets, VoiceOver labels.
- **Data on first iOS launch:** server data is already there, because it is the same Supabase project. Device-local web state is **not** migrated: theme, library view prefs, the Word-of-the-Day cache, DNA cover cache, hero selection and **unsynced web queue items**. Those items flush only when the PWA is reopened online.
