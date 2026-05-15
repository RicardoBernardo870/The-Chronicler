# BookHero

BookHero is a mobile-first reading companion for people who want their physical and digital reading life in one place. It tracks books, sessions, page progress, vocabulary, recaps, lore, and long-term reading identity through a Vue PWA backed by Supabase.

The app is built around a simple idea: reading progress should feel alive. BookHero helps readers return to the right book, remember what happened, capture meaningful passages, and build a personal profile from the books they finish.

## Highlights

- Personal library with dashboard, in-progress, up-next, completed, and book detail views
- Reading progress tracking with session notes, recent activity, and progress history
- AI-generated recaps for current reads and completed books through Supabase Edge Functions
- Camera-based page capture and OCR for physical books
- Lexicon and spaced-review flow for vocabulary collected while reading
- Lore Chronoscope cards for characters, places, themes, and world details
- Book Passport views that collect recap history, milestones, and book memory
- Reader Profile with Reading DNA, lifetime stats, library breakdown, yearly goals, and reader levels
- Offline-friendly PWA architecture with service worker support and client-side cache primitives

## Tech Stack

- Vue 3.5 with Composition API and `<script setup>`
- TypeScript 6 in strict mode
- Vite and Vite PWA
- Pinia for state management
- Vue Router for app navigation
- PrimeVue 4 and PrimeIcons for UI
- Supabase JS v2 for auth, database access, RPC calls, and Edge Functions
- Supabase PostgreSQL with row-level security
- Deno-based Supabase Edge Functions
- Gemini 2.5 Flash for recap, OCR, vocabulary, lore, and reading profile generation
- Vitest and Vue Test Utils for unit tests

## Project Structure

```text
src/
  components/       Reusable app UI grouped by feature area
  composables/      Shared Vue logic for cache, reading, capture, lexicon, and profile flows
  layouts/          App layout shell
  pages/            Route-level views
  router/           Vue Router configuration
  services/         Supabase and Edge Function clients
  stores/           Pinia stores
  types/            Shared TypeScript types
  utils/            Formatting and domain helpers
supabase/
  functions/        Deno Edge Functions for AI and OCR workflows
  migrations/       Database migrations and RPC definitions
tests/
  unit/             Unit test coverage
specs/
  */                Feature specs, implementation plans, and contracts
```

## Getting Started

### Prerequisites

- Node.js compatible with the Vite toolchain
- pnpm
- A Supabase project
- Optional: Google Books API key for ISBN fallback lookup
- Optional: Gemini API key for AI-powered Edge Functions

### Install

```bash
pnpm install
```

### Environment

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Fill in the required browser-safe Supabase values:

```text
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

The Gemini key must stay server-side as a Supabase Edge Function secret:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-key>
```

### Run Locally

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

## Supabase Notes

BookHero expects the Supabase schema and RPC functions defined in the migration files under `supabase/migrations`. The client relies on row-level security so each reader can only access their own books, progress, captures, recaps, profile data, and goals.

AI features are implemented as Edge Functions in `supabase/functions`. Deploy the functions and configure required secrets before using recap, OCR, lore, vocabulary extraction, or Reading DNA generation in a live environment.

## Core Routes

- `/` - dashboard and active reading flow
- `/library` - library browsing
- `/books/add` - add a book manually or through ISBN lookup
- `/books/:id` - book detail, progress, session, capture, and recap actions
- `/books/:id/recaps` - recap history
- `/books/:id/passport` - book passport
- `/lexicon` - vocabulary library
- `/anki-review` - spaced vocabulary review
- `/profile` - reader profile, quest goal, stats, and Reading DNA

## Development Workflow

The repository keeps feature planning artifacts in `specs/`. Current implementation context is usually captured in the latest feature plan, and the app follows the conventions in `AGENTS.md`.

Useful commands:

```bash
pnpm dev
pnpm test
pnpm build
```

## License

No license has been published yet. Add one before distributing or accepting external contributions.
