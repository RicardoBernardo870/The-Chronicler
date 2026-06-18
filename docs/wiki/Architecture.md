# Architecture

Last updated: 2026-06-18

BookHero is a client-heavy Vue PWA backed by Supabase. The browser app owns routing, UI state, caching, offline progress queueing, and most user workflows. Supabase provides authentication, persistence, storage, database RPCs, and edge functions for AI workflows.

> The patterns below remain accurate. Two areas have grown since this page was first written: a **Community + Reading Circles** layer (RPC-heavy, RLS relationship-gated) and the **Search & Add** book flow (Google Books primary, Open Library gap-fill). Full backend surface: [`docs/backend-contract.md`](../backend-contract.md).

## System Overview

```mermaid
flowchart LR
  User["Reader"] --> PWA["Vue PWA"]
  PWA --> Pinia["Pinia stores"]
  PWA --> Router["Vue Router"]
  PWA --> SW["Service Worker"]
  Pinia --> SupabaseClient["Supabase JS client"]
  SupabaseClient --> Auth["Supabase Auth"]
  SupabaseClient --> DB["Supabase PostgreSQL"]
  SupabaseClient --> Storage["Supabase Storage"]
  SupabaseClient --> RPC["Postgres RPC functions"]
  PWA --> Edge["Supabase Edge Functions"]
  Edge --> Gemini["Gemini API"]
  Edge --> OpenAI["OpenAI image API"]
  SW --> IndexedDB["IndexedDB progress queue"]
```

## Frontend Layers

| Layer | Responsibility |
| --- | --- |
| Pages | Route-level composition and workflow screens. |
| Components | Reusable UI within dashboard, book, library, capture, recap, profile, and lexicon areas. |
| Composables | Shared stateful logic such as active book selection, reading session timer, cache, OCR capture, ISBN lookup, and profile stats. |
| Pinia stores | Domain state, Supabase reads/writes, cache invalidation, and cross-feature effects. |
| Services | Thin clients for Supabase and Edge Function HTTP calls. |
| Utils | Pure helpers for milestone detection, completion prompts, dates, cover fallback, and master recap lookup. |

## Data Flow: Reading Progress

```mermaid
sequenceDiagram
  participant U as Reader
  participant UI as Vue Page/Component
  participant Store as progress store
  participant DB as Supabase DB
  participant SW as Service Worker
  participant IDB as IndexedDB

  U->>UI: Save page progress
  UI->>Store: updateProgress(bookId, page)
  Store->>DB: upsert reading_progress
  Store->>DB: insert progress_history
  alt Network failure
    Store->>IDB: queue progress_update
    SW->>UI: FLUSH_PROGRESS_QUEUE when sync fires
    UI->>Store: drainQueue()
  end
  Store->>UI: Update local progress and library snapshot
```

## Data Flow: AI Recap

```mermaid
sequenceDiagram
  participant UI as Recap UI
  participant Store as recaps store
  participant Edge as generate-recap function
  participant AI as Gemini
  participant DB as Supabase DB
  participant Storage as Supabase Storage

  UI->>Store: Generate recap
  Store->>Edge: POST book/progress/captures with Bearer token
  Edge->>AI: Generate blurb, recap, or passport summary
  Edge-->>Store: Stream text response
  Store->>DB: Insert recap row
  Store->>Edge: Request recap image when applicable
  Edge->>Storage: Upload generated image
  Edge->>DB: Update recap image status/path
```

## Key Design Decisions

- Use Supabase Auth session persistence in the browser through `supabase-js`.
- Use RLS-backed tables and user-scoped queries rather than a custom backend server.
- Keep AI provider keys out of the browser by routing AI work through Edge Functions.
- Use Postgres RPCs for aggregate profile, library, velocity, quest, and passport statistics.
- Use a client-side SWR cache primitive for fast re-entry and explicit invalidation.
- Use IndexedDB only for offline progress queueing; most app data remains in Supabase.
- Avoid persisting captured page images; the app persists reviewed OCR text instead.

## External Integrations

| Integration | Purpose |
| --- | --- |
| Supabase Auth | Email/password, magic link, session persistence. |
| Supabase PostgreSQL | Books, progress, recaps, captures, lexicon, lore, profile data, goals. |
| Supabase Storage | Recap images in the `recap-images` bucket. |
| Supabase Edge Functions | AI and OCR workflows. |
| Gemini | Text generation, OCR interpretation, vocabulary/lore/profile generation. |
| OpenAI image generation | Recap image generation. |
| Open Library | ISBN lookup and cover metadata. |
| Google Books | Optional ISBN fallback lookup. |
| Dictionary API | Vocabulary lookup in `useLexicon`. |

