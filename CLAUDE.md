# BookHero Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-20

## Active Technologies
- TypeScript 6 + Vue 3.5+ + PrimeVue 4 (Accordion component), Pinia 3, Supabase JS v2, Vue Router 4 (master)
- Supabase PostgreSQL (existing schema — no migrations needed) (master)
- TypeScript 6 + Vue 3.5+ + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Vite PWA (injectManifest) (003-reading-suite-v3)
- Supabase PostgreSQL (primary) + IndexedDB (offline queue + Leitner state) (003-reading-suite-v3)
- TypeScript 6 + Deno (edge function) + Vue 3.5, PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Gemini 2.5 Flash (AI) (003-reading-suite-v3)
- Supabase PostgreSQL — tables: `progress_history`, `recap_fragments`, `recaps`, `book_passports` (003-reading-suite-v3)
- TypeScript 6 + Vue 3.5+ (Composition API) + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, PrimeIcons 7, VueUse (`useColorMode`) (005-lexicon-nav-ux)
- Supabase PostgreSQL (no schema changes) + `localStorage` (Word of the Day daily cache) (005-lexicon-nav-ux)
- TypeScript 6.x + Vue 3.5 (Composition API) + Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4 (005-lexicon-nav-ux)
- In-memory Pinia refs (cache metadata + payload); no new storage layer. Existing IndexedDB offline queue (progress) is unchanged. (005-lexicon-nav-ux)
- TypeScript 6 + Vue 3.5 (Composition API) + PrimeVue 4 (Tabs, Toast, Chip), Pinia 3, Supabase JS v2, Vue Router 4 (006-swr-data-caching)
- Client-side SWR cache primitive (`src/composables/useCache.ts`); module-singleton `Map<key,CacheEntry>`; auth-clear on user change (006-swr-data-caching)
- TypeScript 6 + Deno (edge function: `generate-lore`) + Gemini 2.5 Flash (AI); new Supabase table `lore_cards` (007-lore-chronoscope)
- TypeScript + Deno (edge function: `generate-recap` refactor) + Gemini 2.5 Flash; multi-module layout (prompts/, handlers/, extraction/, utils/); confidence-based retry for mid-book Recap only (008-recap-hardening)
- TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`), Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2 (009-home-inline-cards)
- Supabase PostgreSQL (existing `recaps`, `lore_cards` tables — no schema changes) (009-home-inline-cards)
- TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`) + Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, VueUse (master)
- Supabase PostgreSQL (existing — no schema changes); in-memory Pinia refs + SWR cache (master)

- TypeScript 5.x + Vue 3.5+ + PrimeVue 4.x, Pinia 2.x, Vue Router 4.x, Supabase JS v2, (001-the-chronicler)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x + Vue 3.5+: Follow standard conventions

## Recent Changes
- master: Added TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`) + Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, VueUse
- 009-home-inline-cards: Added TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`), Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2
- 008-recap-hardening: Refactored `generate-recap` edge function into multi-file modules (prompts/, handlers/, extraction/, utils/); replaced extractor + recap prompts with stricter anti-spoiler variants; added confidence-based retry (max 2 attempts, 5-page buffer) for mid-book Recap mode only — Book Blurb and Passport Summary relocated without behavioral changes


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
