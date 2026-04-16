# UI Contracts: Reading Suite v3

## Library Page Additions

### View Toggle
```
<Button icon="pi pi-list" @click="viewMode = 'list'" :class="{ 'p-button-text': viewMode !== 'list' }" />
<Button icon="pi pi-th-large" @click="viewMode = 'grid'" :class="{ 'p-button-text': viewMode !== 'grid' }" />
```
- `viewMode` persisted to `localStorage['library-view-mode']`
- Default: `'list'`

### BookGridCard.vue
Props: `book: Book`, `progress: ReadingProgress | null`
```
┌──────────────────┐
│                  │  ← cover image (aspect 2:3, object-fit: cover)
│                  │
│                  │
│ ░░░░░░░░░░░░░░░░ │  ← frosted scrim bottom
│ Title truncated  │  ← 2-line clamp, white text
│ Author           │  ← 1-line, muted
└──────────────────┘
  ████░░░░░░░░░░░  ← progress bar, 3px, indigo fill
```
- Tap → navigate to `BookDetailPage`
- No edit/delete from grid (those remain in list view action menu)

### BookCard Edit/Delete (list view)
- Add `⋮` overflow button to existing `BookCard.vue`
- Dropdown: "Edit book" → opens `BookEditDialog`, "Remove book" → confirms then calls `booksStore.removeBook()`
- Confirmation: PrimeVue `ConfirmDialog` ("Remove this book and all its data? This cannot be undone.")

### BookEditDialog.vue
- Wraps existing `BookForm.vue` in a PrimeVue `Dialog`
- Pre-fills all fields from `book` prop
- On save: calls `booksStore.updateBook(id, changes)` then closes

---

## Dashboard Additions

### Up Next Section
Placed below Completed section, hidden if no 0%-progress books.
```
── Up Next ──────────────────────────────
  ⠿  📖 The Way of Kings         Sanderson
  ⠿  📖 Project Hail Mary        Weir
  ⠿  📖 Dune                     Herbert
```
- `⠿` = drag handle (touch-friendly, 44px hit area)
- Book cover thumb (32×48px) if available
- Tap row → `BookDetailPage`
- Drag reorder → debounced upsert to `up_next_order`

### Word of the Day Card
Placed above In Progress section. Hidden if `lexiconStore.wordOfTheDay` is null.
```
┌─────────────────────────────────────────┐
│  📖 Word of the Day                      │
│                                          │
│  ephemeral  [ɪˈfɛm(ə)r(ə)l]             │
│  adj. lasting for a very short time      │
│                                          │
│  from: The Name of the Wind   p.47  [→]  │
└─────────────────────────────────────────┘
```
- Tap card → navigates to that entry in LexiconPage
- "→" icon = mark as reviewed (advances Leitner box)

---

## Recap Button — Milestone Lock State

### Unlocked (≥10% since last recap OR no prior recap)
```
[ ✨ Get Recap ]   (existing button, unchanged)
```

### Locked (< 10% progress since last recap)
```
[ 🔒  Read 14 more pages to unlock ]
```
- Button is disabled, cursor `not-allowed`
- Tooltip on hover: "You unlock a new recap every 10% of progress"
- Color: `glass-subtle` with reduced opacity

---

## Lexicon Page

### Route: `/lexicon`
### Layout: full page with book filter tabs at top

```
Lexicon
[ All Books ▾ ]  [ + Add Word ]

  ┌ ephemeral ── Dictionary ──────────────────┐
  │ (tap to flip)                             │
  └───────────────────────────────────────────┘
  
  ┌ Shai'tan ── Lore ─────────────────────────┐
  │ (tap to flip)                             │
  └───────────────────────────────────────────┘
```

### LexiconCard.vue — Flip Animation
Props: `entry: LexiconEntry`

**Front face:**
```
┌─────────────────────────────────────────┐
│  DICTIONARY                  from p.142  │
│                                          │
│  ephemeral                               │
│                                          │
│  (tap to see definition)                 │
└─────────────────────────────────────────┘
```

**Back face (after flip):**
```
┌─────────────────────────────────────────┐
│  adj. lasting for a very short time.     │
│                                          │
│  "The ephemeral nature of the magic      │
│   left him breathless."                  │
│                                          │
│  [ ✓ I know this ]   [ ✗ Review again ] │
└─────────────────────────────────────────┘
```
- CSS: `transform: rotateY(180deg)` with `transition: 0.5s`
- "I know this" → advances Leitner box
- "Review again" → resets to box 1

### AddWordDialog.vue
```
Add Word

Word:          [ ephemeral        ]
Definition:    [ fetching... ↻    ]  ← auto-fetched on blur
Type:          (●) Dictionary  ( ) Lore
Context:       [ "The ephemeral nature..." ] (optional)
Page:          [ 142 ] (optional)

               [ Cancel ]  [ Save ]
```

---

## VelocityBadge.vue

Shown on `BookDetailPage` when ≥2 progress history entries exist.
```
📈 42 pages/hr  ·  ~3h 20m to finish
```
- Computed from `useReadingPulse(bookId)`
- Hidden if insufficient data

---

## Hero Card — Continuity Warning State

When `continuityScore < 40`:
```
Before:  background: glass-surface (indigo/blue tones)
After:   background: linear-gradient with amber overlay
         + pulsing amber border
         + "⚠ It's been a while — Time for a Memory Jogger?" text
```

---

## Book Passport Page

### Route: `/books/:id/passport`
### Access: from BookDetailPage when progress = 100%

```
✦ Reading Journey: The Name of the Wind ✦

  📅  Finished in 18 days
  ⚡  Peak day: Apr 12 — 94 pages
  📖  12 words added to Lexicon
  
  ── Your Story So Far ──────────────────
  
  [ streaming AI summary here... ]

  [ Share Journey ]
```
- Celebratory gradient background (different from app default)
- PrimeVue `Divider` between stats and summary
- "Share Journey" → Web Share API (text + title)

---

## Streak Indicator (LibraryPage)

Displayed on each BookCard in list view, below the progress bar:
```
🔥 5-day streak
```
- Hidden if streak = 0
- Computed from `useReadingPulse(bookId).streak`
