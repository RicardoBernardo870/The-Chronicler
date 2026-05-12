# BookHero Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-12

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
- TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`) + Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, VueUse (master)
- Supabase PostgreSQL — `reading_progress` (modified), `progress_history` (modified); no new tables (master)
- TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`) + Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, VueUse (013-session-stats-card)
- Supabase PostgreSQL — `reading_progress` + `progress_history` extended with `session_start_at` + `session_note` columns (013-session-stats-card)
- TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`) + Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, date-fns v4 (014-vue-modernization)
- Pure frontend refactor — no schema changes; adds `src/utils/date.ts` + `src/utils/coverFallback.ts`; extracts HeroBookCard, InProgressSection, UpNextSection, CompletedSection, BookDetailHeader, BookProgressPanel (014-vue-modernization)
- TypeScript 6 (strict) on Vue 3.5 (Composition API, `<script setup>`); Deno runtime for Supabase edge functions + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, VueUse, date-fns v4. New runtime dependency: native `navigator.mediaDevices.getUserMedia()` for camera access — no new npm packages required. (015-corpus-recaps)
- Supabase PostgreSQL — new `page_captures` table; existing `recaps` table extended with a `mode text` column. No new buckets in Supabase Storage (images are not persisted). (015-corpus-recaps)
- TypeScript 6 (strict) + Vue 3.5 (`<script setup>`) + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Deno (edge functions), Gemini 2.5 Flash (016-reader-profile-page)
- Supabase PostgreSQL — new `reading_dna` table, new `vocabulary_extractions` ledger table, `lexicon_entries.source` column extension. All Profile-page stats are computed client-side from existing stores; no new derived tables. (016-reader-profile-page)
- TypeScript 6.x, Vue 3.5 Composition API + Vue Router 4, Pinia 3, Supabase JS v2, PrimeVue 4, VueUse, existing SWR cache primitive (021-first-run-onboarding)
- Existing Supabase PostgreSQL tables (`books`, `reading_progress`, `progress_history`, `up_next_order`) plus existing in-memory Pinia/SWR cache; no new storage layer planned (021-first-run-onboarding)
- TypeScript 6.x with Vue 3.5 Composition API and `<script setup>` + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, VueUse, native `navigator.mediaDevices.getUserMedia()` (027-capture-review-viewport)
- Existing Supabase `page_captures` write path via `useCapturesStore`; no schema changes and no image persistence (027-capture-review-viewport)
- TypeScript 6 strict; Vue 3.5 Composition API with `<script setup>`; SQL migrations for Supabase PostgreSQL + Vue 3.5, Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4, existing SWR cache primitive (028-reading-quest-goal)
- Supabase PostgreSQL; new `reading_goals` table; existing `books`, `reading_progress`, `progress_history`, `recaps`, `page_captures`, `lore_cards` (028-reading-quest-goal)

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
- 028-reading-quest-goal: Added TypeScript 6 strict; Vue 3.5 Composition API with `<script setup>`; SQL migrations for Supabase PostgreSQL + Vue 3.5, Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4, existing SWR cache primitive
- 027-capture-review-viewport: Added TypeScript 6.x with Vue 3.5 Composition API and `<script setup>` + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, VueUse, native `navigator.mediaDevices.getUserMedia()`
- 021-first-run-onboarding: Implemented first-run Dashboard and add-book onboarding refinements: automatic one-active-book hero focus, compact no-book/queued/completed-only states, initial add-book status choices, non-session progress writes for completed/currently-reading imports, completed-import safeguards against session/capture/recap/lore/passport prompts, and no new storage layer.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan: specs/028-reading-quest-goal/plan.md
<!-- SPECKIT END -->
