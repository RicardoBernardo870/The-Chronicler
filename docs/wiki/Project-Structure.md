# Project Structure

Last updated: 2026-05-17

BookHero is organized as a Vue PWA frontend with Supabase backend assets in the same repository.

## Top-Level Layout

```text
.
├── docs/                  Documentation and planning notes
├── public/                PWA manifest and static public assets
├── specs/                 Spec Kit feature specs, plans, contracts, and tasks
├── src/                   Vue application source
├── supabase/              Database migrations and Edge Functions
├── tests/                 Vitest unit tests
├── package.json           Scripts and dependencies
├── vite.config.ts         Vite and PWA configuration
├── vitest.config.ts       Test configuration
└── vercel.json            Vercel-compatible cache headers
```

## Frontend Source

```text
src/
├── assets/                Images, global styles, PrimeVue theme preset
├── components/            Reusable UI grouped by feature area
├── composables/           Shared Composition API logic
├── layouts/               Authenticated app shell
├── pages/                 Route-level views
├── router/                Vue Router configuration and auth guard
├── services/              Supabase client and Edge Function clients
├── stores/                Pinia stores for domain state
├── types/                 Shared domain and database row types
├── utils/                 Small domain helpers
├── App.vue                App root, global dialogs/toasts, service worker bridge
├── main.ts                App bootstrap
└── sw.ts                  Custom service worker
```

## Important Feature Areas

| Area | Main files |
| --- | --- |
| Auth | `src/stores/auth.ts`, `src/pages/AuthPage.vue`, `src/router/index.ts` |
| Library | `src/stores/books.ts`, `src/pages/LibraryPage.vue`, `src/components/library/*` |
| Dashboard | `src/pages/DashboardPage.vue`, `src/components/dashboard/*`, `src/composables/useActiveBook.ts` |
| Reading progress | `src/stores/progress.ts`, `src/composables/useReadingSession.ts`, `src/components/book/BookProgressPanel.vue` |
| Recaps | `src/stores/recaps.ts`, `src/services/recapService.ts`, `supabase/functions/generate-recap/*` |
| Page capture | `src/stores/captures.ts`, `src/composables/useCapture.ts`, `supabase/functions/ocr-page/index.ts` |
| Lexicon | `src/stores/lexicon.ts`, `src/composables/useLexicon.ts`, `src/pages/GreatLibraryPage.vue` |
| Lore | `src/stores/loreCards.ts`, `src/services/loreService.ts`, `supabase/functions/generate-lore/index.ts` |
| Book Passport | `src/stores/bookPassport.ts`, `src/pages/BookPassportPage.vue` |
| Reader Profile | `src/pages/ProfilePage.vue`, `src/stores/readingDna.ts`, `src/stores/readingQuest.ts`, `src/components/profile/*` |
| Offline sync | `src/composables/useOfflineSync.ts`, `src/sw.ts`, `src/App.vue` |

## Conventions

- Vue components use Composition API and `<script setup>`.
- Pinia stores hold domain state and Supabase persistence logic.
- Supabase database rows use `snake_case`; app domain types use `camelCase`.
- Mapping helpers live in `src/types/index.ts`.
- Route-level pages live in `src/pages`.
- Shared feature logic is extracted into `src/composables`.
- Unit tests live in `tests/unit`.
- Feature planning artifacts live in `specs/<number>-<feature-name>`.

## Documentation Artifacts

The `specs/` directory contains detailed historical design context. It is useful for maintainers, but it should not be treated as executable documentation unless the implementation still matches the current code.

