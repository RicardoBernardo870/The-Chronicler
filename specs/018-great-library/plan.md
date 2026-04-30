# Implementation Plan: The Great Library

**Branch**: `018-great-library` | **Date**: 2026-04-30 | **Spec**: [spec.md](spec.md)

## Summary

Upgrade the existing `GreatLibraryPage.vue` (which already has a `/lexicon` route and loads all entries into memory) to support server-side search, type filtering, and infinite scroll pagination. A new `useGreatLibrarySearch` composable drives paginated Supabase queries with debounced search and combined filters. A new `GreatLibraryEntryCard` component renders entries in a scannable list style (with book title) rather than the flip-card style used for flashcard review.

---

## Technical Context

**Language/Version**: TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`)
**Primary Dependencies**: Pinia 3, Supabase JS v2, PrimeVue 4, Vue Router 4, VueUse
**Storage**: Supabase PostgreSQL (`lexicon_entries` + `books` tables — no schema changes)
**Testing**: Manual browser verification
**Target Platform**: PWA (web browser, mobile + desktop)
**Performance Goals**: First page (20 entries) loads in < 2s on mobile; search results appear within 1s after 300ms debounce
**Constraints**: No new tables; no new npm packages; TypeScript strict; PrimeVue-first (Principle VI); VueUse already available for `useIntersectionObserver`
**Scale/Scope**: Single-user per session; up to ~1 000 lexicon entries

---

## Constitution Check

### Principle I — Memory Continuity ✅
No change to recap or progress tracking.

### Principle II — Physical-to-Digital Bridge ✅
No change to ISBN lookup or page number semantics.

### Principle III — AI-First Recap Engine ✅
No change to AI pipeline.

### Principle IV — Data Integrity & Synchronization ✅
Read-only page. The existing `lexiconStore.addEntry` write path is unchanged. No offline queue changes.

### Principle V — PWA-First ✅
No new npm packages — `useIntersectionObserver` comes from VueUse which is already a dependency. Infinite scroll reduces initial payload vs. loading all entries at once.

### Principle VI — Component Architecture & UI Standards ✅
- `InputText` (PrimeVue) for the search field
- `SelectButton` (PrimeVue) for the All/Dictionary/Lore type toggle
- `Select` (PrimeVue) for the book dropdown (already used)
- `Skeleton` (PrimeVue) for loading state
- `Message` (PrimeVue) for empty and error states
- `LexiconCard.vue` extended with an optional `bookTitle` prop — shown on the front face when provided. No new component needed; all existing flip animation and Leitner controls are preserved.
- `GreatLibraryPage.vue` remains a page orchestrator; search + filter state lives in the composable.

**No violations. No entries required in Complexity Tracking.**

---

## Project Structure

### Documentation (this feature)

```text
specs/018-great-library/
├── plan.md              ← this file
├── research.md          ← D1–D6 decisions
├── data-model.md        ← new types + query contract
├── quickstart.md        ← step-by-step setup + verification
└── contracts/
    └── query-contract.md  ← Supabase query shapes + TypeScript interfaces
```

### Source Code Changes

```text
src/
├── types/
│   └── index.ts                           ← add LexiconSearchResult interface
├── composables/
│   └── useGreatLibrarySearch.ts           ← new: paginated search composable
├── components/
│   └── lexicon/
│       └── LexiconCard.vue                ← update: add optional bookTitle prop (front face)
└── pages/
    └── GreatLibraryPage.vue               ← update: add search bar, type toggle, infinite scroll to Lexicon tab
```

No new tables. No new npm packages. No edge functions.

---

## Complexity Tracking

> No Constitution violations requiring justification beyond the `GreatLibraryEntryCard` note above (documented in Constitution Check § Principle VI).
