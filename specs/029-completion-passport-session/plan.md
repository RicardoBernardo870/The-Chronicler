# Implementation Plan: Completion Passport Session

**Branch**: `029-completion-passport-session` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/029-completion-passport-session/spec.md`

## Summary

Fix the post-completion reading handoff so a newly selected book can start a session immediately, and add a clear completion prompt that routes readers to the completed book's Book Passport. The technical approach is to upsert or initialize `reading_progress` when starting a session for a selected book with no progress row, surface completion through a PrimeVue confirmation/toast-style journey prompt, and keep active-book state consistent through the existing `useActiveBook` boundary.

## Technical Context

**Language/Version**: TypeScript 6 strict; Vue 3.5 Composition API with `<script setup>`  
**Primary Dependencies**: Vue 3.5, Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4, existing SWR cache primitive  
**Storage**: Supabase PostgreSQL existing tables (`books`, `reading_progress`, `progress_history`, `book_passports`); no new tables planned  
**Testing**: Vitest unit tests plus `npm test` and `npm run build`; manual mobile/desktop viewport validation for the completion prompt  
**Target Platform**: BookHero PWA on mobile and desktop browsers  
**Project Type**: Single Vue PWA with Supabase backend services  
**Performance Goals**: Start Session responds with one confirmed write for books with or without existing progress; completion prompt appears during the same successful progress-save interaction  
**Constraints**: Preserve offline progress queue behavior; Start Session remains online-only; avoid duplicate prompts on refresh; use PrimeVue-first UI; do not change schema unless implementation reveals an unavoidable compatibility gap  
**Scale/Scope**: One post-completion dashboard/book-detail UX flow and one progress-store session-start bug fix

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: PASS. The feature improves the transition back into reading after a book is completed and keeps Book Passport discovery tied to the reader's journey.
- **II. Physical-to-Digital Bridge**: PASS. Progress continues to use absolute page numbers and existing edition-specific totals.
- **III. AI-First Recap Engine**: PASS. No recap prompt or generation behavior changes; Book Passport generation remains server-backed and existing.
- **IV. Data Integrity & Synchronization**: PASS. The session-start fix writes through `reading_progress` before confirming an active session and keeps refresh state consistent.
- **V. PWA-First & Frictionless Portability**: PASS. The prompt is mobile-first, non-blocking, and reachable in the existing PWA flow.
- **VI. Component Architecture & UI Standards**: PASS. UI work will use existing single-responsibility dashboard/book-detail components and PrimeVue confirmation/dialog/button primitives.

## Project Structure

### Documentation (this feature)

```text
specs/029-completion-passport-session/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- progress-session.md
|   `-- completion-passport-prompt.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- components/
|   |-- dashboard/
|   |   `-- HeroBookCard.vue
|   |-- book/
|   |   `-- BookProgressPanel.vue
|   `-- session/
|       `-- SessionStartButton.vue
|-- composables/
|   |-- useActiveBook.ts
|   `-- useReadingSession.ts
|-- pages/
|   |-- DashboardPage.vue
|   `-- BookDetailPage.vue
|-- stores/
|   |-- progress.ts
|   `-- bookPassport.ts
tests/
`-- unit/
    |-- progressSession.spec.ts
    `-- completionPassportPrompt.spec.ts
```

**Structure Decision**: Use the existing single Vue PWA structure. The persistence fix belongs in `src/stores/progress.ts` and `src/composables/useReadingSession.ts`; the prompt belongs at the page/component boundary where completion is detected and routing can occur.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Key decisions:

- Change Start Session from update-only to create-or-update for eligible books with no `reading_progress` row.
- Use a non-blocking PrimeVue completion prompt with a direct Book Passport action instead of silently relying on the completed list.
- Keep completion prompt deduplication client-side and event-based for this scoped fix; do not add a prompt ledger table.

## Phase 1: Design

See:

- [data-model.md](./data-model.md)
- [contracts/progress-session.md](./contracts/progress-session.md)
- [contracts/completion-passport-prompt.md](./contracts/completion-passport-prompt.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **I. Memory Continuity**: PASS. The journey prompt and immediate next-session path reduce friction at the exact moment a reader transitions between books.
- **II. Physical-to-Digital Bridge**: PASS. No page-number model changes; first-session behavior continues to ask for or use page state through existing UI.
- **III. AI-First Recap Engine**: PASS. Existing passport generation remains fire-and-forget and the prompt handles pending content gracefully.
- **IV. Data Integrity & Synchronization**: PASS. Session start remains server-confirmed; the plan avoids confirming a session without a persisted `reading_progress` row.
- **V. PWA-First & Frictionless Portability**: PASS. The completion action is one tap from prompt to passport and remains dismissible on mobile.
- **VI. Component Architecture & UI Standards**: PASS. Contracts require PrimeVue primitives and preserve existing component boundaries.
