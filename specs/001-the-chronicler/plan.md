# Implementation Plan: The Chronicler — AI Reading Companion PWA

**Branch**: `001-the-chronicler` | **Date**: 2026-04-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-the-chronicler/spec.md`

---

## Summary

The Chronicler is a Vue 3 PWA reading companion that eliminates the friction of returning to
a book after a break. The core flow: readers log their page progress → request an AI-generated
three-part spoiler-free recap → receive the Memory Jogger, Concept Watchlist, and Thematic
Bridge tiered briefing. Supporting flows: ISBN barcode scan to add physical books with
auto-populated metadata, offline-buffered progress sync via IndexedDB + Background Sync, and
a recap history view.

**Stack**: Vue 3 + TypeScript + Vite 6 · PrimeVue 4 (liquid glass preset) · Supabase (Auth +
Postgres + Realtime) · Claude Haiku 4.5 (proxied via Supabase Edge Function) · Quagga2 (ISBN
scan) · Open Library API (metadata) · vite-plugin-pwa (PWA/service worker).

---

## Technical Context

**Language/Version**: TypeScript 5.x + Vue 3.5+
**Primary Dependencies**: PrimeVue 4.x, Pinia 2.x, Vue Router 4.x, Supabase JS v2,
  Anthropic SDK (Edge Function only), Quagga2, vite-plugin-pwa
**Storage**: Supabase PostgreSQL (cloud) + IndexedDB (offline queue)
**Testing**: Vitest + Vue Test Utils + Playwright (E2E)
**Target Platform**: PWA — iOS Safari, Android Chrome, modern desktop browsers
**Project Type**: Web application (single-project Vue PWA)
**Performance Goals**: Recap stream begins within 3 seconds; progress sync ≤ 5 seconds
  cross-device; Lighthouse PWA score ≥ 90
**Constraints**: Anthropic API key must never reach the browser bundle (Edge Function proxy);
  offline progress buffering required (FR-009); no app store dependency
**Scale/Scope**: Single-user library; MVP targets personal use; ~5 Supabase tables

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Memory Continuity | ✅ PASS | Recap Engine enforces spoiler-free constraint at prompt level and persists output |
| II. Physical-to-Digital Bridge | ✅ PASS | Quagga2 + Open Library covers ISBN scan + metadata; manual entry fallback present |
| III. AI-First Recap Engine | ✅ PASS | Claude Haiku via Edge Function; streaming enabled; structured JSON output |
| IV. Data Integrity | ✅ PASS | Supabase primary store; IndexedDB offline queue + Background Sync; RLS enforced |
| V. PWA-First | ✅ PASS | vite-plugin-pwa; Lighthouse ≥ 90 target; two-tap core flow |

**Post-design re-check**: All five principles remain satisfied after Phase 1 design.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-the-chronicler/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── supabase-schema.sql
│   ├── claude-recap-api.md
│   ├── isbn-lookup-api.md
│   └── pinia-store-interfaces.ts
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── assets/
│   ├── styles/
│   │   ├── main.css          # Global styles, CSS custom properties
│   │   └── glass.css         # Glassmorphism utilities (backdrop-filter layer)
│   └── icons/                # PWA icons
├── components/
│   ├── books/
│   │   ├── BookCard.vue
│   │   ├── BookForm.vue
│   │   └── IsbnScanner.vue
│   ├── recap/
│   │   ├── RecapCard.vue
│   │   ├── RecapStream.vue
│   │   └── RecapHistory.vue
│   └── shared/
│       ├── AppHeader.vue
│       ├── LoadingSpinner.vue
│       └── EmptyState.vue
├── composables/
│   ├── useScanner.ts         # Quagga2 barcode scanner wrapper
│   ├── useIsbn.ts            # Open Library + Google Books lookup
│   └── useOfflineSync.ts     # IndexedDB queue management
├── layouts/
│   └── DefaultLayout.vue
├── pages/
│   ├── DashboardPage.vue     # Home: current read + recap CTA
│   ├── LibraryPage.vue       # Full book list
│   ├── BookDetailPage.vue    # Progress update + recap for one book
│   ├── RecapHistoryPage.vue  # Historical recaps for one book
│   ├── AddBookPage.vue       # ISBN scan + manual entry flow
│   ├── AuthPage.vue          # Sign in / sign up / magic link
│   └── NotFoundPage.vue
├── router/
│   └── index.ts
├── services/
│   ├── supabase.ts           # Supabase client singleton
│   └── recapService.ts       # Edge Function caller + stream handler
├── stores/
│   ├── auth.ts               # useAuthStore
│   ├── books.ts              # useBooksStore
│   ├── progress.ts           # useProgressStore
│   └── recaps.ts             # useRecapsStore
├── types/
│   └── index.ts              # Domain types (Book, ReadingProgress, Recap, etc.)
├── App.vue
└── main.ts

supabase/
├── functions/
│   └── generate-recap/
│       └── index.ts          # Edge Function: JWT verify → Claude API → stream back
└── migrations/
    └── 001_initial_schema.sql  # Tables from contracts/supabase-schema.sql

public/
├── manifest.webmanifest
├── sw.js                     # Generated by vite-plugin-pwa
└── icons/                    # PWA icon set (192, 512, maskable)

tests/
├── unit/
│   ├── stores/
│   └── composables/
└── e2e/
    └── flows/
        ├── add-book.spec.ts
        ├── update-progress.spec.ts
        └── generate-recap.spec.ts
```

**Structure Decision**: Single-project Vue PWA layout. Backend logic lives entirely in
Supabase (database, auth, Edge Functions). No separate `backend/` directory — Supabase
replaces a traditional API server.

---

## Complexity Tracking

> No constitution violations requiring justification. All principles pass.

---

## Design System: Liquid Glass

The app's visual identity uses a glassmorphism approach on top of PrimeVue 4:

**Custom preset strategy** (`src/assets/styles/preset.ts`):
- Extend `Lara` dark preset via `definePreset`.
- Override surface tokens to semi-transparent RGBA (e.g., `surface.800 → rgba(30,30,40,0.6)`).
- Add custom semantic tokens: `--glass-blur: 16px`, `--glass-brightness: 1.1`.

**Global glass layer** (`glass.css`):
```css
.glass-surface {
  background: rgba(var(--surface-rgb), 0.55);
  backdrop-filter: blur(var(--glass-blur)) brightness(var(--glass-brightness));
  -webkit-backdrop-filter: blur(var(--glass-blur)) brightness(var(--glass-brightness));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--border-radius-xl);
}
```

Apply `.glass-surface` to cards, panels, modals, and nav components. Avoid `overflow: hidden`
on parent containers to preserve `backdrop-filter` rendering.

**Dark mode**: Enabled via PrimeVue's `useColorMode` composable + system preference detection.
Dark mode is the default to match low-light reading environments (constitution principle,
UX section).

---

## Phase 0 Artifacts

- [research.md](research.md) — All technology decisions with rationale

## Phase 1 Artifacts

- [data-model.md](data-model.md) — Entity definitions, RLS policies, state transitions
- [contracts/supabase-schema.sql](contracts/supabase-schema.sql) — Production-ready DDL
- [contracts/claude-recap-api.md](contracts/claude-recap-api.md) — Claude API request/response contract
- [contracts/isbn-lookup-api.md](contracts/isbn-lookup-api.md) — Open Library + Google Books lookup flow
- [contracts/pinia-store-interfaces.ts](contracts/pinia-store-interfaces.ts) — TypeScript store/service interfaces
- [quickstart.md](quickstart.md) — Setup and validation guide
