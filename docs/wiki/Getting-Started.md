# Getting Started

Last updated: 2026-10-18

This page explains how to set up The Chronicler (internal code name BookHero, D-03) locally for development.

## Prerequisites

| Requirement | Purpose |
| --- | --- |
| Node.js | Required by Vite, Vue, TypeScript, and Vitest. Exact version is not currently documented in the codebase. |
| pnpm | Required for installs (`pnpm-lock.yaml`); `npm install` fails in this repo. |
| Supabase project | Required for authentication, database, storage, RPCs, and edge functions. |
| Supabase CLI | Needed to serve and deploy edge functions and set function secrets. Database changes follow the rules in [Deployment › Database changes](Deployment.md#database-changes). |
| Gemini API key | Required for AI-powered edge functions. |
| OpenAI API key | Required for recap images (`generate-recap` image mode). |
| Google Books API key | Optional. Google Books is the primary book-metadata source; without a key, calls use Google's anonymous quota. |

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
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>   # recap images
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform. Names only: [Configuration › Edge-function secrets](Configuration.md#edge-function-secrets).

## Database Setup

Development uses the shared hosted project. **Do not run `supabase db push` or `supabase db reset` from `supabase/migrations/`**: the folder has drifted from production, and replaying it regresses `get_reading_stats`, re-adds a stale `lore_cards.type` CHECK and sets a 512 KB `recap-images` limit (BC-03).

- The reference for the current schema is the read-only snapshot [`supabase/reference/live-baseline-2026-10-18.sql`](../../supabase/reference/README.md) and the [backend contract](../backend-contract.md). It is not a migration.
- A local stack cannot be rebuilt reliably until BC-03's baseline migration lands.
- Every schema change is one new migration file, applied as-is: [Deployment › Database changes](Deployment.md#database-changes).

## Edge Functions

Serve functions locally:

```bash
supabase functions serve
```

Deploy only as described in [Deployment › Edge functions](Deployment.md#edge-functions). There is no `supabase/config.toml` yet, so the `verify_jwt` flags must be passed by hand, and `generate-lore` and `generate-reading-dna` must **not** be deployed from the repo until their sources are synced to the deployed (canonical) versions (D-09 · BC-03). There are seven product functions: `generate-recap`, `generate-lore`, `ocr-page`, `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume` and `generate-book-quiz`.

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
- A fresh Supabase project cannot be bootstrapped from the repo until BC-03's baseline migration and `supabase/config.toml` (BC-02) land.

