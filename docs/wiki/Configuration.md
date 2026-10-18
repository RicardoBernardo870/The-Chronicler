# Configuration

Last updated: 2026-10-18

Configuration lives in four places: Vite environment variables (public, baked into the bundle), Supabase edge-function secrets (server-side), Supabase project settings (Auth, database roles, edge-function deploy flags — mostly dashboard-only today), and compile-time constants in the code. This page lists **names and locations only**; never paste secret values into docs, issues or commits.

Normative rules: [PLT-57 … PLT-61](../business-rules/08-platform-auth-account.md#configuration-deployment--feature-flags) and [PLT-82](../business-rules/08-platform-auth-account.md#plt-82--auth-email-delivery-and-redirect-configuration).

---

## Frontend environment variables

All `VITE_*` variables are embedded in the browser bundle and are therefore **public**.

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | `src/services/supabase.ts`; edge-function URLs `${VITE_SUPABASE_URL}/functions/v1/<slug>` in `recapService.ts`, `loreService.ts`, `useCapture.ts`, `bookPassport.ts` | Project API URL |
| `VITE_SUPABASE_ANON_KEY` | yes | `src/services/supabase.ts` | Public anon key; RLS and function grants protect data |
| `VITE_GOOGLE_BOOKS_API_KEY` | no | `src/services/bookSearchService.ts`, `src/composables/useIsbn.ts` | Google Books is the **primary** book-metadata source (search, ISBN lookup, volume detail, recommendations, import enrichment). Without a key, calls run unauthenticated against Google's anonymous quota |

Runtime check: `src/services/supabase.ts` throws at module load when the URL or anon key is missing:

```text
Missing Supabase environment variables. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
```

The app then renders a blank page (the error happens before mount).

### `.env.example` and `.env.local`

```text
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_GOOGLE_BOOKS_API_KEY=<optional-google-books-key>
```

- `.gitignore` ignores `.env` and `.env.*` except `.env.example`.
- The tracked `.env.example` holds a **real-format Google API key** (39 characters, `AIza` prefix). Replace it with a placeholder, rotate the key and restrict it by HTTP referrer (PLT-D10). Because any `VITE_` key ships in the bundle anyway, the lasting fix is the server-side `book-search` proxy (BC-15).
- Its comment says Google Books is "used as fallback when Open Library ISBN lookup returns no result". That is inverted: Google Books is primary and Open Library only gap-fills (see [Architecture › External integrations](Architecture.md#external-integrations)).

---

## Edge-function secrets

Set with `supabase secrets set <NAME>=<value>` (values never in the repo). `Deno.env.get` across the seven product functions reads exactly these names:

| Secret | Read by | Notes |
|---|---|---|
| `GEMINI_API_KEY` | all seven AI functions | Missing → `generate-recap` / `generate-lore` / `ocr-page` return 503; `generate-reading-dna` returns 502 `ai_unavailable`; `extract-vocabulary`, `generate-page-resume`, `generate-book-quiz` soft-fail with 200 (`{words: []}`, `{resume: null}`, `{quiz: null}`). Confirm the key is on a paid tier (free-tier prompts may be used for training) |
| `OPENAI_API_KEY` | `generate-recap` image mode | Model `gpt-image-2`. Missing → 503 "OpenAI image service not configured" |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `generate-recap` image handler | Platform-injected. Missing → 503 "Supabase admin client not configured" |

Planned (not yet existing; proposed names): Apple credentials for Sign in with Apple token revocation in `delete-account` — `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY` (D-10 · BC-11).

## Edge-function deploy settings

There is **no `supabase/config.toml`** in the repo (the comment in `generate-recap/auth.ts` refers to one). The live `verify_jwt` flags exist only on the project:

| Function | Live `verify_jwt` | Deploy flag to reproduce production today |
|---|---|---|
| `generate-recap`, `generate-lore`, `ocr-page` | `false` | `--no-verify-jwt` |
| `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume`, `generate-book-quiz` | `true` | (default) |

`false` is the known security defect PLT-D04; BC-02 switches all seven to `true` and commits `config.toml` with per-function settings. Deploy procedure: [Deployment › Edge functions](Deployment.md#edge-functions).

Import map: `supabase/functions/deno.json` maps `@supabase/supabase-js` → `npm:@supabase/supabase-js@2`, `@supabase/functions-js` → `jsr:@supabase/functions-js` and `@google/genai` → `npm:@google/genai`. Every AI function imports `npm:@google/genai` **unpinned** (BC-03 pins one version through the shared import map). `generate-lore`, `extract-vocabulary` and `generate-reading-dna` are deployed without an import map.

---

## Feature flags

| Flag | Where | Value | Effect |
|---|---|---|---|
| `DISABLE_RECAP_LOCK` | `src/composables/useRecapLock.ts` | `false` | Compile-time, testing only. When `true` the recap button ignores the page threshold and cooldown. Must be `false` in production |

There are **no runtime or remote feature flags** today. Planned server-side flags (plan component F-1): `public.backend_flags(key, enabled)` + `get_backend_flags()`, used to switch server-side effects on once the PWA stops doing them (BC-05, BC-07, BC-08, BC-09) and `ai_consent_enforced` (BC-11/BC-12). Once BC-07 ships, any recap-lock bypass for testing is server configuration, never a client flag.

---

## Supabase project settings

| Setting | Live value | Where it lives |
|---|---|---|
| Auth providers | `email` only (password + magic link) | Dashboard → Auth |
| Email confirmation | Effectively off (inferred from data: every user confirmed within a fraction of a second) | Dashboard (not readable via SQL) |
| Leaked-password protection | Disabled (security advisor `auth_leaked_password_protection`) | Dashboard |
| Site URL, Redirect-URL allow-list, email templates, SMTP provider | Unverified (dashboard-only). No client passes a redirect URL, so links use the Site URL. The default Supabase sender has a very low hourly limit | Dashboard |
| Access-token lifetime | ~1 h (`app.settings.jwt_exp = 3600`) | Dashboard |
| PostgREST `max_rows` | Unverified (Supabase default 1000); un-paginated table selects would truncate above it | Dashboard |
| Database time zone | `UTC` (no role override) — RPCs without a zone parameter compute in UTC | Database |
| `statement_timeout` | 8 s `authenticated` / `authenticator`, 3 s `anon` | `pg_db_role_setting` |
| `lock_timeout` | 8 s (`authenticator`) | `pg_db_role_setting` |
| `session_preload_libraries` | `safeupdate` (`authenticator`): UPDATE/DELETE without a filter are rejected | `pg_db_role_setting` |
| Realtime publication | `supabase_realtime` has no tables | Database |
| Extensions | plpgsql, pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault; **no** pg_cron, pg_net | Database |

BC-11 adds per-environment Auth configuration (Apple provider, universal-link redirect URLs `https://<web-domain>/auth/callback` and `/auth/reset`, custom SMTP, password policy) and records the names in [backend contract §1](../backend-contract.md#1-connection-auth--runtime-limits). The canonical web domain is still open (PLT-Q05).

---

## Client constants that behave like configuration

| Constant | Value | Source |
|---|---|---|
| `GET_SESSION_TIMEOUT_MS` | 3000 ms | `src/stores/auth.ts` |
| `USER_SNAPSHOT_KEY` | `bookhero-auth-user` | `src/stores/auth.ts` |
| `RETRY_DELAY_MS` (PostgREST 401 retry) | 400 ms, 1 retry, `/rest/v1/` only | `src/services/retryingFetch.ts` |
| Load-failure toast cooldown | 30 000 ms | `src/composables/useLoadFailureNotice.ts` |
| SWR TTLs | 30 s – 120 s; velocity 365 days; unknown key 60 s | [Architecture › Key catalogue](Architecture.md#key-catalogue-ttls) |
| Recap lock | +5 % progress, 6 h cooldown, 72 h idle unlock | `src/composables/useRecapLock.ts` ([03 · Recaps](../business-rules/03-recaps.md)) |
| OCR thresholds | auto-save ≥ 0.90, warning < 0.70 (Gemini-calibrated; recalibrate for Apple Vision, D-15) | capture flow ([04 · Capture](../business-rules/04-capture-resume-quiz.md)) |
| Signed URL TTLs | 60 s (image panel), 3600 s (gallery, carousel) | `useRecapImage.ts`, `useRecapGallery.ts`, `BookRecapCarousel.vue` |
| Offline queue | IndexedDB `chronicler-offline` v1 / `progress_queue`; Background Sync tag `progress-sync` | `src/composables/useOfflineSync.ts` |
| SW runtime caches | `book-covers` (200 / 30 d), `isbn-api` (100 / 7 d) | `src/sw.ts` |

### Browser storage keys

| Key | Store | Scope |
|---|---|---|
| `sb-<project-ref>-auth-token` | localStorage | session (supabase-js) |
| `bookhero-auth-user` | localStorage | user snapshot `{id, email}` |
| `bookhero_theme` | localStorage | device (`dark` default / `light`) |
| `bookhero_wotd_{uid}` | localStorage | per user |
| `bookhero:dna-covers` | localStorage | signature-keyed |
| `library-view-mode`, `library-active-tab`, `library-grid-collapsed` | localStorage | device |
| `chronicler-offline` / `progress_queue` | IndexedDB | not user-scoped |

Storage keys and code identifiers keep the `bookhero` code name; they are not renamed when the product name is "The Chronicler" (D-03).

---

## Configuration files

| File | Purpose |
|---|---|
| `package.json` | Scripts (`dev`, `build`, `preview`, `test`, `test:watch` — no `lint`), dependencies, version (3.9.1), `pnpm.onlyBuiltDependencies` |
| `pnpm-lock.yaml` | pnpm lockfile (the repo uses pnpm) |
| `vite.config.ts` | `@` alias → `src`; Vue plugin; VitePWA (`registerType: 'autoUpdate'`, `injectManifest` from `src/sw.ts`, `manifest: false`, precache glob, SW disabled in dev) |
| `vitest.config.ts` | jsdom environment, globals, `@` alias |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript 6 project references; `src/sw.ts` excluded from the app project; `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch` |
| `vercel.json` | Cache headers only (no rewrites, no security headers) — see [Deployment](Deployment.md#frontend-hosting-vercel) |
| `index.html` | `<title>`, theme-color metas (follow the OS scheme), `apple-touch-icon`, `viewport-fit=cover`. **No `<link rel="manifest">`** (PLT-D34) |
| `public/manifest.webmanifest` | Name "The Chronicler", short name "Chronicler", standalone, portrait, icons, shortcuts "Current Read" and "Add Book". Not linked from `index.html`, so browsers ignore it |
| `supabase/functions/deno.json` | Shared Deno import map (see above) |
| `supabase/reference/live-baseline-2026-10-18.sql` | Read-only live schema snapshot (D-16). Not a migration |
| `supabase/config.toml` | **Missing** (BC-02 adds it) |

---

## Local vs production

| Concern | Local | Production |
|---|---|---|
| Frontend env | `.env.local` | Vercel project environment variables (names above) |
| Database | The shared hosted project (`zlndhygpqacygceivuvk`). A local stack cannot be rebuilt reliably from `supabase/migrations/` until BC-03's baseline lands | Same hosted project |
| Edge functions | `supabase functions serve` (needs the secrets in a local env file) | Deployed functions with the flags above |
| AI secrets | Local function env | Supabase function secrets |
| Service worker | Disabled under `pnpm dev`; use `pnpm build && pnpm preview` | Active; auto-update with one reload |
