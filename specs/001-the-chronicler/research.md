# Research: The Chronicler

**Phase**: 0 — Research & Decision Log
**Date**: 2026-04-15
**Branch**: `001-the-chronicler`

---

## 1. ISBN Metadata API

**Decision**: Open Library API (primary) → Google Books API (fallback)

**Rationale**:
- Open Library is free, requires no API key, and has native browser CORS support — calls can
  be made directly from the Vue client with zero backend proxy.
- Google Books provides a richer fallback especially for cover art, but has undocumented
  rate limits and may require a backend proxy for production use.
- ISBNdb ($10+/month) offers the best data quality but is overkill for a hobby-scale PWA.

**Alternatives considered**: ISBNdb (rejected: cost), Google Books as primary (rejected: CORS
uncertainty, key management overhead).

**Open Library endpoint**:
`https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`

**Cover art**:
`https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`

---

## 2. Barcode Scanning Library

**Decision**: **Quagga2** (`@ericblade/quagga2`)

**Rationale**:
- Actively maintained fork of the original QuaggaJS, unlike html5-qrcode (unmaintained) or
  ZXing-js (maintenance mode).
- Native 1D barcode support (EAN-13 / ISBN-13) without pulling in the full ZXing multi-format
  bundle.
- Works on mobile Safari and Chrome camera streams with no native app dependency.
- Plain JavaScript; wraps cleanly inside a Vue 3 composable (`useScanner`).

**Alternatives considered**:
- `html5-qrcode`: Simple API but unmaintained — rejected.
- `vue-qrcode-reader v4`: Good Vue integration but relies on ZXing-js in maintenance mode —
  rejected for the same reason.
- `@zxing/browser`: Comprehensive but heavy and in maintenance mode — rejected.

---

## 3. PrimeVue 4 + Liquid Glass Theming

**Decision**: Custom preset extending Lara Dark + global CSS glassmorphism layer

**Rationale**:
- PrimeVue 4 uses a three-tier token system (primitive → semantic → component) backed by
  CSS custom properties. The token system allows surface opacity and color overrides.
- PrimeVue 4 does not have built-in `backdrop-filter` tokens, so glassmorphism must be
  layered on top via:
  1. A custom `definePreset` that extends Lara, setting surface backgrounds to semi-transparent
     RGBA values (e.g., `rgba(255,255,255,0.1)` in dark mode).
  2. Global CSS targeting `.p-component` surfaces and the app's card/panel containers with
     `backdrop-filter: blur(16px) brightness(1.1)`.
- Import path (PrimeVue ≥ 4.3.0): `@primeuix/themes` (not `@primevue/themes`).

**Design tokens to customize**:
- `surface.0` through `surface.900` — semi-transparent for glass effect
- `primary.color` — accent color for progress indicators
- `content.background` — card/panel background with opacity

**Implementation note**: `backdrop-filter` requires parent elements to NOT have `overflow:
hidden` set — plan component hierarchy accordingly.

---

## 4. Offline Sync Strategy

**Decision**: IndexedDB queue + Background Sync API (Service Worker)

**Rationale**:
- Supabase JS v2 has no native offline support.
- An IndexedDB-backed mutation queue provides instant local UI feedback and survives browser
  closure (unlike a simple `online` event listener + in-memory queue).
- The Service Worker Background Sync API flushes the queue when connectivity is restored,
  even if the browser tab was closed.
- PowerSync/RxDB offer richer CRDT-style sync but introduce external dependencies that are
  not justified for a single-writer (per-user) progress tracking use case.

**Scope**: Offline support covers progress updates only (FR-009). Recap generation and ISBN
lookup require connectivity.

**Queue schema** (IndexedDB `offline_queue` store):
```
{ id: auto, type: 'progress_update', payload: { book_id, current_page, updated_at }, retries: 0 }
```

---

## 5. Claude API — Model & Prompt Strategy

**Decision**: `claude-haiku-4-5-20251001` with system-prompt caching

**Rationale**:
- Recap generation is structured content synthesis (3 named sections from book metadata +
  progress %). Haiku handles this task with high quality at 60–90% lower cost than Sonnet/Opus.
- The system prompt is static and long (spoiler-free instructions + output format spec).
  Marking it with `cache_control: { type: "ephemeral" }` activates prompt caching, reducing
  repeated costs to ~10% of input token price after the first call.
- Streaming SHOULD be enabled: perceived responsiveness on mobile is substantially better
  with incremental token delivery even at the cost of slightly longer total time.

**Prompt structure**:
```
[SYSTEM — cached]
  You are a reading companion. Generate a three-part briefing...
  Spoiler rule: NEVER reference events, characters, or plot points beyond {pct}% of the book.
  Output format: JSON with keys memory_jogger, concept_watchlist, thematic_bridge.

[USER — not cached]
  Book: "{title}" by {author}
  Reader is at {pct}% ({page} of {total} pages).
  Generate the briefing now.
```

**Streaming**: Use the Anthropic SDK `stream()` helper; accumulate partial JSON until
`message_stop`, then parse and persist the completed recap.

---

## 6. Technology Stack — Final Decisions

| Concern | Choice | Version |
|---|---|---|
| Framework | Vue 3 (Composition API + `<script setup>`) | 3.5+ |
| Language | TypeScript | 5.x |
| Build tool | Vite | 6.x |
| State management | Pinia | 2.x |
| Routing | Vue Router | 4.x |
| Component library | PrimeVue | 4.x |
| PWA | vite-plugin-pwa | latest |
| Backend / Auth / DB | Supabase JS v2 | 2.x |
| AI recap | Claude API (Anthropic SDK) | haiku-4-5 |
| ISBN lookup | Open Library API | — |
| Barcode scanning | Quagga2 | latest |
| Offline queue | IndexedDB + Background Sync | native browser |
| Styling | PrimeVue tokens + custom CSS | — |
| Testing | Vitest + Vue Test Utils | latest |
