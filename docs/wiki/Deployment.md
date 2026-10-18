# Deployment

Last updated: 2026-10-18

The Chronicler ships as a static Vite PWA on **Vercel** plus one shared **Supabase** project (`zlndhygpqacygceivuvk`; Postgres, Auth, Storage, edge functions). The PWA stays live while native clients are built on the same backend (D-05), so **every backend deploy must keep the current PWA working** (expand → migrate → contract).

There is no CI/CD pipeline in the repo (`.github/` is absent). Vercel project settings, the deploy trigger and the production domain are not in the repo and are unverified here.

---

## Build

```bash
pnpm install
pnpm build      # vue-tsc -b && vite build → dist/
pnpm preview    # serve dist/ locally; the only way to exercise the service worker
```

| Output | Source |
|---|---|
| `dist/index.html`, `dist/assets/*` (hashed) | Vite |
| `dist/sw.js` | VitePWA `injectManifest` compiles `src/sw.ts` and injects the precache list (`**/*.{js,css,html,ico,png,svg,woff2}` + `icons/*`) |
| `dist/registerSW.js` | VitePWA registration script (`window.load`, scope `/`) |
| `dist/manifest.webmanifest` | Copied from `public/` (not linked from `index.html`, PLT-D34) |

---

## Frontend hosting (Vercel)

### `vercel.json` (headers only)

| Path | Cache-Control |
|---|---|
| `/assets/(.*)` | `public, max-age=31536000, immutable` |
| `/index.html` | `no-cache` |
| `/(.*).webmanifest` | `no-cache` |

Gaps ([PLT-55](../business-rules/08-platform-auth-account.md#plt-55--http-cache-headers-and-hosting)):

| Gap | Effect | Fix |
|---|---|---|
| No SPA rewrite | A first visit or hard reload of a deep link (`/library`, `/books/:id`) with no active service worker is likely a Vercel 404; this also breaks universal-link fallbacks (PLT-D35) | Rewrite everything except assets and `/.well-known/*` to `/index.html` |
| `no-cache` keys on the literal `/index.html` | `/` and deep links get Vercel's default HTML caching (unverified) | Add a catch-all HTML rule |
| No header for `sw.js` / `registerSW.js` | SW update checks may be delayed by HTTP caching | `Cache-Control: no-cache` on both |
| No security headers | No CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` | Add once the canonical domain is decided |
| No `/.well-known/apple-app-site-association` | Needed for iOS universal links (auth callback and reset, D-11) | Serve it as `application/json`, no redirect (PLT-Q05) |

### Environment variables (Vercel project)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_BOOKS_API_KEY` (optional). They are compiled into the bundle, so changing one needs a rebuild. Names and semantics: [Configuration](Configuration.md#frontend-environment-variables).

### What readers get after a deploy

The service worker calls `skipWaiting()` and `clients.claim()`, and `main.ts` reloads each open tab **once** on `controllerchange` (not on a first install). There is no "update available" prompt, so an open page-save sheet or form is interrupted (PLT-D36, PLT-Q09). Readers who keep the app open get the new build on the next SW update check (navigation or registration).

---

## Supabase

### Database changes

The repo's `supabase/migrations/` folder **does not reproduce production** (BC-03):

- remote history has 44 product migrations with 14-digit versions; the repo has 24 product files with 8-digit date prefixes, so no version matches;
- 55 of 69 live public functions have no local migration; `user_settings`, `upsert_weekly_goal`, `get_retention_summary`, `prune_page_captures_for_book` and `after_page_capture_saved` have no migration anywhere; seven local files were applied out-of-band;
- replaying the folder would regress `get_reading_stats`, re-add a stale `lore_cards.type` CHECK that rejects live rows, and set the `recap-images` bucket limit to 512 KB instead of 10 MiB.

**Therefore, today:**

| Do | Don't |
|---|---|
| Write each change as **one new, timestamped migration file** in the repo and apply exactly that file (Supabase MCP `apply_migration` with the same name, or the CLI once BC-03 has repaired history) | `supabase db push` or `supabase db reset` against production from the current folder |
| Treat `supabase/reference/live-baseline-2026-10-18.sql` as the reference for current definitions | Run ad-hoc SQL in the dashboard |
| Regenerate the live snapshot (new dated file) and update [backend-contract.md](../backend-contract.md) in the same PR | Leave the contract or catalog out of date |

**Target workflow (BC-03):** squash live into `supabase/migrations/20261018000000_baseline.sql`, archive the old files, run `supabase migration repair` so `supabase migration list` shows local == remote, then require an empty `supabase db diff --linked` before every deploy. Every change after that is `supabase migration new` + CLI apply.

**Privilege checklist for every new function** (the schema's default ACL re-grants `anon` EXECUTE on new functions):

```sql
-- inside the same migration as CREATE FUNCTION
revoke all on function public.<name>(<args>) from public, anon;
grant execute on function public.<name>(<args>) to authenticated;
```

Plus: SECURITY DEFINER only with `set search_path = public` (or a `private` schema for helpers), identity from `(select auth.uid())`, and `DROP` + `CREATE` (not a second overload) when adding parameters, otherwise PostgREST fails with `PGRST203`. Conventions: [plan §1.3](../backend-consolidation-plan.md#13-conventions-for-every-new-or-changed-backend-surface).

### Edge functions

Seven product functions are deployed. Because there is no `supabase/config.toml`, the CLI default (`verify_jwt = true`) does not match production for three of them:

```bash
# Reproduces today's production auth mode (verify_jwt = false is the known defect PLT-D04, fixed by BC-02)
supabase functions deploy generate-recap --no-verify-jwt
supabase functions deploy ocr-page --no-verify-jwt

# Gateway JWT verification (production: verify_jwt = true)
supabase functions deploy extract-vocabulary
supabase functions deploy generate-page-resume
supabase functions deploy generate-book-quiz
```

**Do not deploy `generate-lore` or `generate-reading-dna` from the repo** until their sources are synced (D-09). The deployed versions are canonical and differ from the repo:

| Function | Deployed (canonical) | Repo |
|---|---|---|
| `generate-lore` v18 | Accuracy-first "canonical context" prompt, temperature **0.35**, thinking budget (misplaced at the config root) | "Expanded context, may introduce new details" prompt, temperature 0.85, thinking off |
| `generate-reading-dna` v8 | Google Search grounding (`tools: [{googleSearch: {}}]`), thinking budget 1 | No tools, thinking budget 0 |

To sync: `supabase functions download generate-lore` (and `generate-reading-dna`), commit the downloaded source, then apply the BC-03 fixes (move `thinkingBudget` into `thinkingConfig`, drop the misplaced `dynamicRetrievalConfig`, pin `@google/genai`). Deploy with `--no-verify-jwt` for `generate-lore` until BC-02.

After BC-02: all seven run with `verify_jwt = true`, `supabase/config.toml` holds the per-function settings, and a plain `supabase functions deploy` reproduces production (acceptance 02-5). Before flipping the flag, check on a staging slug that the gateway accepts the project's current signing keys.

Secrets (names only; [Configuration › Edge-function secrets](Configuration.md#edge-function-secrets)):

```bash
supabase secrets set GEMINI_API_KEY=<value>
supabase secrets set OPENAI_API_KEY=<value>
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform
```

### Storage

| Bucket | Live settings |
|---|---|
| `recap-images` | private, 10 MiB, `image/png`, `image/jpeg`, `image/webp`; owner-folder policies (SELECT/INSERT/DELETE) |
| `community-avatars` | public, 5 MiB, `image/jpeg`, `image/png`, `image/webp`; owner-folder policies for `authenticated` |

The local `recap_image_columns` migration sets a 512 KB limit; never re-apply it.

### Auth settings

Dashboard-only today: Site URL, Redirect-URL allow-list, email templates, SMTP, email confirmation, leaked-password protection (disabled). BC-11 adds the Apple provider, universal-link redirect URLs, custom SMTP and a password policy, per environment ([Configuration › Supabase project settings](Configuration.md#supabase-project-settings)).

---

## Deployment checklist

**Every release**

- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes (includes `vue-tsc -b`).
- [ ] Vercel environment variables are set (names above).
- [ ] Verified with `pnpm preview` when the SW, routing or offline behaviour changed.

**Backend changes**

- [ ] One new migration file, applied as-is; no dashboard SQL; no `db push` from the drifted folder.
- [ ] New functions: grants revoked from `public, anon`, granted to `authenticated`; pinned `search_path`; identity from `auth.uid()`.
- [ ] New user-owned tables: RLS for every command (+ book-ownership check when there is a `book_id`); indexes for FKs and time-ordered queries.
- [ ] Backward compatible with the current PWA (new parameters last with defaults; versioned edge contracts via `apiVersion`).
- [ ] Edge functions deployed with the `verify_jwt` flags above; `generate-lore` / `generate-reading-dna` not overwritten with stale sources.
- [ ] Secrets present.
- [ ] Live snapshot regenerated; [backend-contract.md](../backend-contract.md) and the affected catalog rules updated in the same PR.
- [ ] Security advisor checked (no new `anon`-executable SECURITY DEFINER functions).

---

## Rollback

| Layer | How |
|---|---|
| Frontend | Promote the previous Vercel deployment (Vercel UI; unverified project setup). Open tabs pick it up on the next SW update and reload once |
| Database | Forward-fix with a new migration. No down-migrations exist; never edit a migration that has been applied |
| Edge functions | Redeploy the previous source **with the same `verify_jwt` flag**. The repo is not a reliable copy of deployed code for `generate-lore` / `generate-reading-dna` until BC-03; `supabase functions download <slug>` before a deploy keeps a rollback copy |

---

## Future: multiple clients

iOS (and later Android) use the same project. Backend deploys follow the plan's expand → migrate → contract rule: add new RPCs and columns first, move the PWA and native clients, and retire legacy paths only after the legacy-write counters read zero for 14 days ([plan §1.2](../backend-consolidation-plan.md#12-principles)). The App Store build needs BC-01, BC-02 and BC-11 (account deletion, Sign in with Apple) shipped first ([Architecture › Architecture direction](Architecture.md#architecture-direction)).
