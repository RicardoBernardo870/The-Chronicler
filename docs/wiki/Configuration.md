# Configuration

Last updated: 2026-05-17

BookHero uses Vite environment variables for browser-safe frontend configuration and Supabase Edge Function secrets for server-side API keys.

## Frontend Environment Variables

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | `src/services/supabase.ts`, edge clients | Public Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes | `src/services/supabase.ts` | Public anon key. RLS must protect data. |
| `VITE_GOOGLE_BOOKS_API_KEY` | No | ISBN lookup flow | Optional fallback when Open Library lookup misses. |

## Example `.env.local`

```text
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_GOOGLE_BOOKS_API_KEY=<optional-google-books-key>
```

Do not commit real local secrets. The current `.env.example` contains placeholder Supabase values but includes a concrete-looking Google Books value; replace it with a placeholder before sharing outside trusted development contexts.

## Supabase Edge Function Secrets

| Secret | Required for | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Recaps, OCR, vocabulary extraction, lore, Reading DNA | Must be set in Supabase, not in Vite env. |
| OpenAI image key | Recap image generation | Referenced by recap image code, but exact setup is not currently documented in the README. |

Set function secrets:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

## Important Config Files

| File | Purpose |
| --- | --- |
| `package.json` | Scripts, dependencies, app version. |
| `vite.config.ts` | Vite and PWA build configuration. |
| `vitest.config.ts` | Unit test configuration. |
| `tsconfig*.json` | TypeScript project configuration. |
| `vercel.json` | Cache headers for assets, `index.html`, and manifest files. |
| `public/manifest.webmanifest` | PWA metadata, icons, display mode, and app shortcuts. |
| `supabase/functions/deno.json` | Deno import map for Supabase functions. |

## Local vs Production

| Concern | Local | Production |
| --- | --- | --- |
| Frontend env | `.env.local` | Hosting provider environment variables. |
| Database | Local Supabase or remote project | Supabase hosted project. |
| Edge functions | `supabase functions serve` | Deployed Supabase functions. |
| AI secrets | Local Supabase secrets or function env | Supabase function secrets. |
| PWA | Vite dev server has limited production parity | Production build and service worker behavior. |

## Runtime Checks

`src/services/supabase.ts` throws at startup if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing.

