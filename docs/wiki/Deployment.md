# Deployment

Last updated: 2026-05-17

BookHero builds as a static Vite PWA and depends on Supabase for backend services.

## Build

```bash
pnpm build
```

The build runs:

```bash
vue-tsc -b && vite build
```

Preview the production build locally:

```bash
pnpm preview
```

## Frontend Hosting

The repository includes `vercel.json`, so the frontend is compatible with Vercel-style static hosting.

Configured cache behavior:

| Path | Cache behavior |
| --- | --- |
| `/assets/(.*)` | Public, immutable, one-year cache. |
| `/index.html` | No cache. |
| `/(.*).webmanifest` | No cache. |

Exact production hosting and project settings are not currently documented in the codebase.

## Production Environment Variables

Set these in the frontend hosting provider:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_GOOGLE_BOOKS_API_KEY=<optional-google-books-key>
```

Set AI secrets in Supabase:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

Recap image generation may require an OpenAI image-generation secret. The exact secret name should be confirmed from `supabase/functions/generate-recap/openaiClient.ts`.

## Supabase Deployment

Apply migrations:

```bash
supabase db push
```

Deploy functions:

```bash
supabase functions deploy generate-recap
supabase functions deploy generate-lore
supabase functions deploy ocr-page
supabase functions deploy extract-vocabulary
supabase functions deploy generate-reading-dna
```

## Deployment Checklist

- Frontend env variables are set.
- Supabase migrations are applied.
- Edge Functions are deployed.
- Function secrets are set.
- RLS policies are enabled and verified.
- Storage bucket and policies for recap images are available.
- `pnpm test` passes.
- `pnpm build` passes.

## Rollback

Rollback process is not currently documented in the codebase.

Suggested approach:

- Revert frontend deployment to the previous known-good build through the hosting provider.
- Avoid rolling back database migrations unless a reversible migration strategy exists.
- For Edge Functions, redeploy the previous function version if available from source control.

## CI/CD

CI/CD pipeline configuration is not currently documented in the codebase.

