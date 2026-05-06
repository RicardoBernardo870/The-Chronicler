# Data Model: Anki Flashcard Review

## New Table: `anki_review_sessions`

One row per user. Upserted (not inserted) on each session completion or partial exit (≥1 card reviewed).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | Row identifier |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE, UNIQUE | One row per user |
| `last_reviewed_at` | `timestamptz` | NOT NULL, `DEFAULT now()` | Drives the 3-day prompt interval |
| `total_sessions` | `integer` | NOT NULL, `DEFAULT 1` | Running count of completed/partial sessions |
| `known_count` | `integer` | NOT NULL, `DEFAULT 0` | Cumulative lifetime "Knew it" count |
| `unknown_count` | `integer` | NOT NULL, `DEFAULT 0` | Cumulative lifetime "Didn't know" count |

**Upsert behaviour**: On session save, `last_reviewed_at = now()`, `total_sessions += 1`, `known_count += sessionKnown`, `unknown_count += sessionUnknown`.

---

## Modified Table: `lexicon_entries` (no schema changes)

The review feature reads and writes the existing `leitner_box` and `next_review_at` columns via the existing `lexiconStore.updateLeitner()` action. No column additions or migrations required.

---

## New Pinia Store: `ankiSession`

**File**: `src/stores/ankiSession.ts`

| State | Type | Purpose |
|-------|------|---------|
| `lastReviewedAt` | `string \| null` | ISO timestamp of last session from Supabase |
| `totalSessions` | `number` | Cumulative session count |
| `_loaded` | `boolean` | Hydration guard |

**Key computed**:
- `isDueForReview`: `lastReviewedAt === null OR daysSince(lastReviewedAt) >= 3`
- Combined with `lexiconStore.allEntries.length >= 5` in `WordOfTheDay.vue`

**Key actions**:
- `fetchSession(userId)` — loads the user's row from `anki_review_sessions` (or sets defaults if none)
- `saveSession(userId, known, unknown)` — upserts the row; updates `lastReviewedAt` to now

---

## New Composable: `useAnkiSession`

**File**: `src/composables/useAnkiSession.ts`

Manages the in-progress review session state (cards queue, current index, per-session known/unknown counts). Owns the swipe result → Leitner update pipeline. Separates ephemeral session state (which cards remain) from persistent store state (when last reviewed).

| Ref | Type | Purpose |
|-----|------|---------|
| `cards` | `LexiconEntry[]` | Snapshot of due words for this session (max 20) |
| `currentIndex` | `number` | Index into `cards` |
| `sessionKnown` | `number` | Known count for this session |
| `sessionUnknown` | `number` | Unknown count for this session |
| `isComplete` | `boolean` | All cards swiped |

---

## New Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `SwipeableFlashcard` | `src/components/anki/SwipeableFlashcard.vue` | Single card: front/back flip + swipe gesture + exit animation. Emits `known` / `unknown`. |
| `AnkiSessionSummary` | `src/components/anki/AnkiSessionSummary.vue` | Post-session summary screen: total, known, unknown counts + return button. |

**Custom component justification** (`SwipeableFlashcard`):
No PrimeVue component exists for tinder-style swipe-to-dismiss cards with real-time drag tracking and directional exit animation. PrimeVue `Card` is a static container with no swipe API. Custom component is the only viable path per Constitution Principle VI exception clause (a).
