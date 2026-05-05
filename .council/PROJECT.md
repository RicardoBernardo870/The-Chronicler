# BookHero
Reading companion app for readers who want to track books, remember sessions, generate grounded recaps, build vocabulary, and archive completed books.

**Stack:** TypeScript · Vue · Vite · PrimeVue · Pinia · Vue Router · Deno edge functions
**DB:** Supabase PostgreSQL via Supabase JS, RPCs, and SQL migrations
**Integrations:** Supabase auth/storage/functions · Gemini/OpenAI for recaps, OCR, blurbs, recap images, vocabulary, passports · Quagga barcode scanning
**Auth:** Supabase Auth
**Tests:** Vitest unit tests in `tests/unit`

**Structure:**
- `src/pages` — routed Vue screens
- `src/components` — PrimeVue-oriented UI components
- `src/stores` — Pinia state and Supabase data flows
- `src/services` — Supabase client and feature service wrappers
- `src/composables` — shared Composition API behavior and SWR cache helpers
- `src/utils` — pure frontend helpers
- `src/types` — shared TypeScript types and mappers
- `supabase/migrations` — PostgreSQL schema, RLS, indexes, and RPC changes
- `supabase/functions` — Deno edge functions for AI, OCR, storage, and recap workflows
- `tests/unit` — Vitest specs
- `specs` — Spec Kit feature plans and task artifacts

**Conventions:**
- See `AGENTS.md` and current `specs/*/plan.md`.
- Prefer existing PrimeVue, Pinia, Supabase, SWR cache, and Spec Kit patterns.
- Keep SQL additive, RLS-aware, and compatible with Supabase hosted Postgres.
- No email or payments integration.

**Context files:** `AGENTS.md`, `CLAUDE.md`, `README.md`, `package.json`
