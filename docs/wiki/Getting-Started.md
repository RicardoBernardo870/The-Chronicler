# Getting Started

Last updated: 2026-05-17

This page explains how to set up BookHero locally for development.

## Prerequisites

| Requirement | Purpose |
| --- | --- |
| Node.js | Required by Vite, Vue, TypeScript, and Vitest. Exact version is not currently documented in the codebase. |
| pnpm or npm | The README uses `pnpm`; `package.json` only defines standard package scripts. |
| Supabase project | Required for authentication, database, storage, RPCs, and edge functions. |
| Supabase CLI | Needed to apply migrations, deploy functions, and set function secrets. |
| Gemini API key | Required for AI-powered edge functions. |
| Google Books API key | Optional fallback for ISBN lookup. |

## Install Dependencies

This project uses **pnpm** (`pnpm-lock.yaml`). `npm install` currently fails here, so use pnpm:

```bash
pnpm install
```

> `npm test` / `npm run build` still work for running scripts, but **dependency installs must go through pnpm** (`pnpm install`, `pnpm add <pkg>`).

## Configure Environment

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in the browser-safe values:

```text
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_GOOGLE_BOOKS_API_KEY=<optional-google-books-key>
```

Set server-side AI secrets in Supabase, not in `.env.local`:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
```

Recap image generation code also references OpenAI image generation through the `generate-recap` edge function. The exact production secret name is not currently documented in the top-level README; inspect `supabase/functions/generate-recap/openaiClient.ts` before enabling recap images.

## Database Setup

Apply the migrations under `supabase/migrations`.

```bash
supabase db push
```

If you are using a local Supabase stack:

```bash
supabase start
supabase db reset
```

The repository contains incremental migrations for newer features. The complete original base schema is also described in older Spec Kit artifacts such as `specs/001-the-chronicler/contracts/supabase-schema.sql`.

## Deploy Edge Functions Locally or Remotely

Serve functions locally:

```bash
supabase functions serve
```

Deploy functions:

```bash
supabase functions deploy generate-recap
supabase functions deploy generate-lore
supabase functions deploy ocr-page
supabase functions deploy extract-vocabulary
supabase functions deploy generate-reading-dna
```

## Run the App

```bash
pnpm dev
```

The Vite dev server prints the local URL, usually `http://localhost:5173`.

## Verify the Setup

Run unit tests:

```bash
pnpm test
```

Run a production build:

```bash
pnpm build
```

Manual smoke test:

1. Open the local app.
2. Sign up or sign in.
3. Add a book.
4. Start a reading session.
5. Save progress.
6. Complete the book and verify the Book Passport prompt appears.

## Known Setup Gaps

- Exact required Node.js version is not currently documented in the codebase.
- CI/CD setup is not currently documented in the codebase.
- Production Supabase project bootstrap steps are partially inferred from migrations and function folders.

