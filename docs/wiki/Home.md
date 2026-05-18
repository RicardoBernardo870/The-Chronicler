# BookHero Wiki

Last updated: 2026-05-17

BookHero is a mobile-first reading companion for readers who want their physical and digital reading life in one place. It tracks books, reading progress, sessions, captured pages, vocabulary, recaps, lore, book journeys, and long-term reader identity through a Vue PWA backed by Supabase.

The application solves a practical reading problem: when readers step away from a book, they need a quick way to remember where they are, what happened, what they learned, and what to read next.

## Key Features

| Area | Summary |
| --- | --- |
| Personal library | Add books, organize current reads, queue upcoming books, and browse completed books. |
| Reading sessions | Start and end sessions, save page progress, add session notes, and track reading history. |
| Completion journey | Completed books move out of active reading and lead readers to the Book Passport view. |
| AI recaps | Generate spoiler-aware blurbs, mid-book recaps, completed-book passport summaries, and recap images. |
| Page capture | Capture physical book pages with the camera, review OCR output, and save text snippets. |
| Lexicon | Save vocabulary manually or through capture-based extraction, then review terms later. |
| Lore Chronoscope | Unlock spoiler-safe lore cards at progress milestones. |
| Reader Profile | View lifetime stats, library breakdown, Reading DNA, reading quest goals, and reader levels. |
| Offline support | Queue progress updates offline and flush them when the app reconnects. |

## Quick Links

- [[Getting Started]]
- [[Project Structure]]
- [[Configuration]]
- [[Architecture]]
- [[Features]]
- [[API Documentation]]
- [[Database Data Model]]
- [[Authentication Authorization]]
- [[Development Workflow]]
- [[Testing]]
- [[Deployment]]
- [[Troubleshooting]]
- [[FAQ]]
- [[Contributing]]
- [[Changelog Release Notes]]

## Current Project Status

The repository is an active Vue 3, TypeScript, Vite PWA application. Recent feature artifacts show ongoing work on reading goals, page capture, profile features, Book Passport statistics, and a completion/passport prompt flow.

The README identifies the app as BookHero. Some internal comments, prompts, and PWA manifest metadata still use "The Chronicler"; treat this as historical naming until product naming is normalized.

## Repository Signals

- App version in `package.json`: `3.5.0`
- Frontend: Vue 3.5, TypeScript 6, Vite 8, Pinia, PrimeVue, Vue Router
- Backend: Supabase Auth, PostgreSQL, Storage, RPC functions, and Deno Edge Functions
- Test runner: Vitest with Vue Test Utils and jsdom
- Deployment hints: Vercel cache configuration exists, but CI/CD is not currently documented in the codebase

