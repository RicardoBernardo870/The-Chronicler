# BookHero Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-16

## Active Technologies
- TypeScript 6 + Vue 3.5+ + PrimeVue 4 (Accordion component), Pinia 3, Supabase JS v2, Vue Router 4 (master)
- Supabase PostgreSQL (existing schema — no migrations needed) (master)
- TypeScript 6 + Vue 3.5+ + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Vite PWA (injectManifest) (003-reading-suite-v3)
- Supabase PostgreSQL (primary) + IndexedDB (offline queue + Leitner state) (003-reading-suite-v3)

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
- 003-reading-suite-v3: Added TypeScript 6 + Vue 3.5+ + PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Vite PWA (injectManifest)
- 003-reading-suite-v3: Added Lexicon Vocabulary Vault — LexiconEntry type (dictionary/lore), Leitner 5-box spaced repetition (intervals [1,2,4,8,16] days), useLeitner composable, lexicon Pinia store, LexiconPage, LexiconCard (CSS 3D flip), AddWordDialog (auto-fetch from Free Dictionary API), WordOfTheDay dashboard widget
- 003-reading-suite-v3: Added Reading Pulse analytics — useReadingPulse composable (session grouping at 2h gap, PPH velocity avg last 3 sessions, continuityScore = max(0, 100 - daysSince*15), streak counter), VelocityBadge component, progress_history insert on every page save
- 003-reading-suite-v3: Added Milestone Recap fragments — RecapFragment type + store, fire-and-forget extraction at every 10% boundary crossing (extract_only mode), fragment cache passed to generate-recap edge function to skip Pass 1 on recap generation
- 003-reading-suite-v3: Added Reading Odyssey / Book Passport — BookPassport type + store, auto-generate on first 100% completion, full_summary AI mode (no spoiler constraints), BookPassportPage with stats (totalDays, peakDay, peakDayPages, vocabularyCount) + streaming AI summary + Web Share API
- 003-reading-suite-v3: Updated generate-recap edge function to v24 — supports extract_only, full_summary, and fragment cache modes
- 003-reading-suite-v3: Library UX polish — 4-tier sort (active→stale→unstarted→done), grid/list toggle (BookGridCard), BookEditDialog, overflow menu on BookCard, iOS gradient fix (html element + env(safe-area-inset-top) + viewport-fit=cover)
- 003-reading-suite-v3: Milestone recap lock — unlock new recap every 10% progress, locked state shows pages remaining
- master: Added TypeScript 6 + Vue 3.5+ + PrimeVue 4 (Accordion component), Pinia 3, Supabase JS v2, Vue Router 4

- 001-the-chronicler: Added TypeScript 5.x + Vue 3.5+ + PrimeVue 4.x, Pinia 2.x, Vue Router 4.x, Supabase JS v2,

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
