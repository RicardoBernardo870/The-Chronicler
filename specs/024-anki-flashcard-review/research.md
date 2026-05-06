# Research: Anki Flashcard Review

## Swipe Gesture Implementation

**Decision**: Use VueUse `useSwipe` composable for touch detection.

**Rationale**: VueUse is already a project dependency. `useSwipe` wraps native `touchstart`/`touchmove`/`touchend` events and exposes `direction` (left/right/up/down) + `distanceX` + `isSwiping`. No new packages required. Threshold of ~60px horizontal distance before a swipe is committed — prevents accidental dismissals on slight touch drift.

**Alternatives considered**:
- `@vueuse/gesture` (hammer.js wrapper) — rejected, adds ~20KB and an extra dependency for functionality already in `useSwipe`
- Native pointer events — more verbose, cross-browser edge cases; `useSwipe` handles them

---

## Card Flip Animation

**Decision**: CSS 3D transform (`rotateY`) with `transform-style: preserve-3d` and two absolutely-positioned faces (front/back).

**Rationale**: Identical pattern to the existing `LexiconCard.vue` in `src/components/lexicon/`. Reusing the same CSS approach keeps visual language consistent. Vue `<Transition>` is not used here because the flip is a continuous 3D rotation, not a simple enter/leave.

**Alternatives considered**:
- Vue `<Transition>` with opacity cross-fade — simpler but loses the 3D card-flip metaphor
- CSS animation keyframes only — harder to drive reactively from JS state

---

## Card Dismiss Animation

**Decision**: CSS transform (`translateX` + slight `rotate`) + opacity fade driven by computed style while swiping, then committed on release when threshold exceeded.

**Rationale**: The card tracks the finger in real-time during `isSwiping` (via inline style binding to `distanceX`), providing direct manipulation feel. On release, if `|distanceX| > 80px`, a CSS class is toggled that triggers a fast exit transition (`translateX(±120%)`, `opacity: 0`, 200ms). The card is removed from the array after `transitionend`.

---

## Session State Management

**Decision**: Pinia store `ankiSession` backed by Supabase `anki_review_sessions` table (one row per user, upserted via `ON CONFLICT (user_id) DO UPDATE`).

**Rationale**: Single-row-per-user pattern (same as `reading_dna` and `progress`) is the lightest possible schema. Upsert on session completion means first-time users get an INSERT, subsequent sessions get an UPDATE. Consistent with IV (Data Integrity) — cross-device prompt interval is accurate.

**Alternatives considered**:
- localStorage — rejected, prompt interval would reset per device (breaks cross-device consistency per clarification Q1)
- One row per session (append-only log) — overkill; we only need `last_reviewed_at` to drive the prompt, not a full session history

---

## Session Card Selection Query

**Decision**: Client-side filter over the already-loaded lexicon store (`allEntries`), no new Supabase query.

**Rationale**: `lexiconStore.fetchEntriesForAllBooks()` is already called on dashboard load and cached via SWR. Filtering `allEntries` for `nextReviewAt <= today`, sorting by `leitnerBox` ascending, then slicing to 20 is O(n) in memory and avoids an extra network round-trip. For typical library sizes (< 500 words) this is instantaneous.

**Alternatives considered**:
- New Supabase RPC `get_due_review_words` — only worthwhile if lexicon size grows to thousands; deferred to future optimisation

---

## "Ready for Review" Prompt Visibility

**Decision**: Computed property in `WordOfTheDay.vue` that reads `ankiSessionStore.isDueForReview` (derived from `last_reviewed_at` + ≥5 entry count).

**Rationale**: Keeps the prompt logic in the store, testable independently of the component. `isDueForReview` is a pure derived boolean — no async fetch required at render time because `ankiSessionStore` hydrates once on app init alongside other stores.
