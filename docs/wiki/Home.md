# The Chronicler Wiki

Last updated: 2026-10-18

**The Chronicler** is a mobile-first reading companion for readers who want their physical and digital reading life in one place. It tracks books, reading sessions and progress, captured pages, vocabulary, AI recaps, Insights, book journeys and long-term reader identity. It runs as a Vue 3 PWA backed by Supabase. **BookHero** is the internal code name for the repository, the Supabase project and code identifiers (D-03).

It solves a practical problem: after time away from a book, a reader needs a quick way to remember where they are, what happened, what they learned and what to read next.

## Start here

| Document | What it is for |
|---|---|
| [Features](Features.md) | Overview of every user-facing feature as it works today, with links into the rules |
| [Business-rules catalog](../business-rules/README.md) | **Authoritative** numbered rules with stable IDs, plus known defects, open decisions, the glossary and the owner decisions log D-01…D-17 |
| [Backend contract](../backend-contract.md) | The live, verified shape of the shared Supabase backend: tables, cascades, RLS, storage, RPCs, triggers, edge functions, security status, drift and planned changes |
| [Backend consolidation plan](../backend-consolidation-plan.md) | Phase 0 work packages BC-01…BC-15, the backend work that lands before the native iOS build |
| [Live schema reference](../../supabase/reference/README.md) | Read-only DDL snapshot of the live database (`live-baseline-2026-10-18.sql`). Not a migration |
| [Changelog & release notes](Changelog-Release-Notes.md) | What changed and when, including the 2026-10-18 documentation overhaul |

### Business-rules files

| File | Prefix | Covers |
|---|---|---|
| [01 · Library](../business-rules/01-library.md) | LIB | Add (search, scan, manual, CSV import), views, queue, edit, delete, DNF, ebooks |
| [02 · Reading sessions](../business-rules/02-reading-sessions.md) | SES | Sessions, page saves, completion, Book Passport, Dashboard, Focus mode, offline queue |
| [03 · Recaps](../business-rules/03-recaps.md) | REC | Recap lock, corpus / inferred modes, blurb, passport summary, recap images, history |
| [04 · Capture, Resume & Quiz](../business-rules/04-capture-resume-quiz.md) | CAP | Page capture and OCR, "Previously" resume, Memory Check |
| [05 · Codex & Lexicon](../business-rules/05-codex-lexicon.md) | LEX | Words and quotes, Leitner review, Word of the Day, daily limit, auto-extraction |
| [06 · Insights](../business-rules/06-insights.md) | INS | Milestone Insights (lore cards) |
| [07 · Profile, Stats & Goals](../business-rules/07-profile-stats-goals.md) | PRO | XP, levels, yearly quest, stats RPCs, achievements, Reading DNA, profile customization |
| [08 · Platform, Auth & Account](../business-rules/08-platform-auth-account.md) | PLT | Auth, account lifecycle, navigation, caching, offline, service worker, time zones, security posture |
| [09 · Database invariants](../business-rules/09-database-invariants.md) | BE | What the backend guarantees whatever the client |
| [10 · Community & Circles](../business-rules/10-community-circles.md) | COM | Dormant social backend (profiles, follows, circles) |
| [11 · Cross-domain](../business-rules/11-cross-domain.md) | XD | Delete / complete / DNF / import / sign-out / edit / delete-account effect matrices |
| [12 · Client logic register](../business-rules/12-client-logic-register.md) | CL | Rules enforced only by the web client, and where each moves server-side |

### Native app (iOS first, Android later)

| Document | What it is for |
|---|---|
| [iOS implementation plan](../ios-implementation-plan.md) | Phased plan for the native app: iOS 26+, iPhone first, native Liquid Glass (D-04) |
| [iOS native migration details](../ios-native-migration-details.md) | How each PWA feature and backend call maps to SwiftUI and Apple frameworks |
| [iOS phase prompts](../ios-phase-prompts.md) | Claude Code (Opus 5.5, ultracode mode) kickoff briefs per phase. No Spec Kit (D-02) |
| [iOS foundation](../ios-foundation/README.md) | Constitution (source of the iOS repo's `CLAUDE.md`), design brief, design tokens, screen and component inventories |
| [Legal & compliance review](../legal-compliance-review.md) | Privacy, copyright and third-party processor obligations before a public launch |

## Key features

| Area | Summary |
|---|---|
| Library | Add books by Google Books search, ISBN scan, manual entry or Goodreads / StoryGraph CSV import. Library search, Up Next queue, DNF shelf. |
| Reading sessions | Timed sessions with pause / resume, End Session page sheet, quiet page corrections, Focus mode with wake lock and reading-goal chips, offline page-save queue. |
| Pre-session recall | A "Previously" resume of the last captured page, or a Memory Check quiz after 2+ days away. |
| Completion journey | Completion prompt and Book Passport (stats + AI "Your Story So Far"). |
| AI recaps | Mid-book recaps grounded on the reader's captures (corpus) or inferred, with a lock (+5 % / 6 h / 72 h), illustrated recap images and a recap history. |
| Page capture | Camera or screenshot upload, OCR with auto-save at high confidence. Text only; images are never stored. |
| Codex | Words and keepsake quotes, Leitner review through Word of the Day and Vocabulary Review (20 words a day), auto-extracted vocabulary. |
| Insights | Spoiler-safe background cards at 10 % milestones (they need a recap today). |
| Reader profile | Identity header, Reading DNA, Trophy Room (yearly quest, XP levels, 17 achievements), Reading Stats (monthly chart, calendar, records, breakdown), profile customization. |
| Community | Built in the backend only and dormant until a later phase (D-13). |

## Wiki pages

- [Getting Started](Getting-Started.md)
- [Project Structure](Project-Structure.md)
- [Configuration](Configuration.md)
- [Architecture](Architecture.md)
- [Features](Features.md)
- [API Documentation](API-Documentation.md)
- [API Quick Reference](API-Quick-Reference.md)
- [Database Data Model](Database-Data-Model.md)
- [Authentication & Authorization](Authentication-Authorization.md)
- [Development Workflow](Development-Workflow.md)
- [Testing](Testing.md)
- [Deployment](Deployment.md)
- [Troubleshooting](Troubleshooting.md)
- [FAQ](FAQ.md)
- [Contributing](Contributing.md)
- [Changelog & Release Notes](Changelog-Release-Notes.md)
- [Wiki Publishing](Wiki-Publishing.md)

**When a wiki page disagrees with the business-rules catalog or the backend contract, those two win.**

The links on this page are relative to `docs/wiki/` in the repository. Links that point outside the wiki folder (`../business-rules/`, `../backend-contract.md`, `../../supabase/`) resolve only when browsing the repository, not in a separately published GitHub Wiki.

## Current status (2026-10-18)

- **The PWA is live** at version **3.9.1** (`package.json`), web `master` @ `8d8701c`. It stays live (D-05).
- **Next: Phase 0 backend consolidation** (BC-01…BC-15).
  - Security hardening and edge-function auth come first.
  - Core logic then moves server-side: atomic progress saves, recap eligibility, Insights, achievements and completion effects (D-06).
- **Then the native iOS app**: iOS 26+, iPhone first, native Liquid Glass. It is built with Claude Code (Opus 5.5, ultracode mode), not Spec Kit (D-02, D-04).
- **Android later**, on the same backend (D-05).
- **Not decided:** subscriptions and a paywall (D-14).

## Repository signals

- Frontend: Vue 3.5, TypeScript 6, Vite 8, Pinia 3, PrimeVue 4, Vue Router 4, VueUse, date-fns 4, `vite-plugin-pwa` (injectManifest, Workbox).
- Backend: Supabase Auth (email only today), PostgreSQL with RLS and RPC functions, Storage (`recap-images` private, `community-avatars` public), and 7 product Deno edge functions.
  - The edge functions are `generate-recap`, `generate-lore`, `ocr-page`, `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume` and `generate-book-quiz`.
  - AI providers: Gemini 2.5 Flash / Pro, and OpenAI `gpt-image-2` for recap images.
- Package manager: **pnpm**. Commands: `pnpm dev`, `pnpm test` (Vitest), `pnpm build` (`vue-tsc -b && vite build`). There is no lint script and no CI workflow.
- Hosting: `vercel.json` sets cache headers only. It has no SPA rewrite and no security headers.
