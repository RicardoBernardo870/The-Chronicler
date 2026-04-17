# UI Component Contracts: Lexicon & Navigation UX Improvements

**Feature**: 005-lexicon-nav-ux
**Date**: 2026-04-17

---

## AddWordDialog (modified)

### Props

```typescript
interface AddWordDialogProps {
  visible: boolean
  bookId?: string          // CHANGED: now optional (was required)
  defaultPageFound?: number // NEW: pre-fills pageFound when opened from BookDetailPage
}
```

### Emits

```typescript
interface AddWordDialogEmits {
  'update:visible': [value: boolean]
  saved: [entry: LexiconEntry]   // CHANGED: now emits the created entry (was void)
}
```

### Behavior

| Condition | Dialog behavior |
|---|---|
| `bookId` is provided | Book selector hidden. Book is locked to prop value. No "Book" field visible. |
| `bookId` is absent | Book selector shown as a required field. "Save" button disabled until a book is selected. |
| `defaultPageFound` is provided | `pageFound` input pre-filled with the given value. User can still change it. |
| Saving with `bookId` absent and no book selected | Validation error: "Please select a book" |

---

## LexiconPage (modified)

### Internal state change

```typescript
// BEFORE (bug):
const activeBookId = computed(() => selectedBookId.value ?? booksStore.books[0]?.id ?? '')

// AFTER (fix):
// Pass selectedBookId.value directly (null → undefined → dialog shows selector)
// Remove activeBookId entirely
```

### AddWordDialog binding

```html
<!-- BEFORE -->
<AddWordDialog :book-id="activeBookId" ... />

<!-- AFTER -->
<AddWordDialog :book-id="selectedBookId ?? undefined" ... />
```

---

## BookDetailPage (modified)

### New: Add Word section

Added below the VelocityBadge inside the progress section.

```typescript
// New state
const addWordVisible = ref(false)
const lexiconCount = computed(() => lexiconStore.entriesByBook[bookId.value]?.length ?? 0)
```

```html
<!-- Add Word affordance -->
<div class="book-detail__vocab-row">
  <Button
    label="Add Word"
    icon="pi pi-plus"
    size="small"
    outlined
    @click="addWordVisible = true"
  />
  <RouterLink
    v-if="lexiconCount > 0"
    :to="{ name: 'lexicon', query: { bookId: bookId } }"
    class="book-detail__vocab-count"
  >
    {{ lexiconCount }} word{{ lexiconCount !== 1 ? 's' : '' }} saved
  </RouterLink>
</div>

<AddWordDialog
  v-if="addWordVisible"
  :visible="addWordVisible"
  :book-id="bookId"
  :default-page-found="progress?.currentPage"
  @update:visible="addWordVisible = $event"
  @saved="addWordVisible = false"
/>
```

---

## AppBottomNav (new component)

### File: `src/components/shared/AppBottomNav.vue`

### Props

None. Reads `useRoute()` internally for active-state detection.

### Structure

```html
<nav class="app-bottom-nav glass-surface">
  <RouterLink to="/" class="app-bottom-nav__item" :class="{ active: isHome }">
    <i class="pi pi-home" />
    <span class="app-bottom-nav__label">Home</span>
  </RouterLink>
  <RouterLink to="/library" class="app-bottom-nav__item" :class="{ active: isLibrary }">
    <i class="pi pi-th-large" />
    <span class="app-bottom-nav__label">Library</span>
  </RouterLink>
  <RouterLink to="/lexicon" class="app-bottom-nav__item" :class="{ active: isLexicon }">
    <i class="pi pi-language" />
    <span class="app-bottom-nav__label">Lexicon</span>
  </RouterLink>
  <button class="app-bottom-nav__item" @click="moreVisible = true">
    <i class="pi pi-ellipsis-h" />
    <span class="app-bottom-nav__label">More</span>
  </button>
</nav>

<!-- More sheet (popover / bottom sheet) -->
<div v-if="moreVisible" class="app-bottom-nav__sheet glass-surface">
  <RouterLink to="/books/add" class="app-bottom-nav__sheet-item" @click="moreVisible = false">
    <i class="pi pi-plus" /> Add Book
  </RouterLink>
  <button class="app-bottom-nav__sheet-item" @click="toggleTheme">
    <i :class="`pi ${isDark ? 'pi-sun' : 'pi-moon'}`" />
    {{ isDark ? 'Light mode' : 'Dark mode' }}
  </button>
  <button class="app-bottom-nav__sheet-item" @click="handleSignOut">
    <i class="pi pi-sign-out" /> Sign out
  </button>
</div>
```

### CSS requirements

```css
.app-bottom-nav {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0);
  left: 0.75rem;
  right: 0.75rem;
  height: 4rem;
  z-index: 200;
  border-radius: 18px;
  margin-bottom: 0.75rem;   /* floating gap above screen edge */
  display: flex;
  align-items: stretch;
}

.app-bottom-nav__item {
  flex: 1;
  min-height: 44px;   /* SC-007 tap target */
  min-width: 44px;
}
```

---

## DefaultLayout (modified)

```html
<!-- BEFORE -->
<template>
  <div class="default-layout">
    <AppHeader />
    <main class="default-layout__main">
      <router-view ... />
    </main>
  </div>
</template>

<!-- AFTER -->
<template>
  <div class="default-layout">
    <main class="default-layout__main">
      <router-view ... />
    </main>
    <AppBottomNav v-if="authStore.user" />
  </div>
</template>
```

```css
/* Global CSS variable for page padding compensation */
:root {
  --app-nav-bottom-clearance: 5.5rem;   /* nav height (4rem) + gap (0.75rem) + buffer */
}

.default-layout__main {
  flex: 1;
  /* remove padding-top: 1.5rem — no top header anymore */
  padding-top: 0;
}
```

---

## Lexicon Store (modified)

### New action: `fetchEntriesForAllBooks()`

```typescript
const fetchEntriesForAllBooks = async () => {
  const authStore = useAuthStore()
  if (!authStore.user) return
  const { data, error } = await supabase
    .from('lexicon_entries')
    .select('*')
    .eq('user_id', authStore.user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  // Group by book_id into entriesByBook
  const grouped: Record<string, LexiconEntry[]> = {}
  for (const row of data as LexiconEntryRow[]) {
    const entry = mapLexiconEntry(row)
    if (!grouped[entry.bookId]) grouped[entry.bookId] = []
    grouped[entry.bookId].push(entry)
  }
  entriesByBook.value = grouped
}
```

### Modified: `wordOfTheDay` computed + `resolveWordOfTheDay()` action

```typescript
const _wotdEntryId = ref<string | null>(null)
const _wotdIsPreview = ref(false)

const resolveWordOfTheDay = (userId: string) => {
  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `bookhero_wotd_${userId}`
  const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null')

  if (cached?.date === today) {
    _wotdEntryId.value = cached.entryId
    _wotdIsPreview.value = cached.isPreview ?? false
    return
  }

  const all = Object.values(entriesByBook.value).flat()
  if (!all.length) { _wotdEntryId.value = null; return }

  const { getDueWord } = useLeitner()
  let pick = getDueWord(all)
  let isPreview = false

  if (!pick) {
    // Fallback: soonest upcoming entry
    pick = all.slice().sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))[0]
    isPreview = true
  }

  _wotdEntryId.value = pick?.id ?? null
  _wotdIsPreview.value = isPreview
  localStorage.setItem(cacheKey, JSON.stringify({ date: today, entryId: pick?.id, isPreview }))
}

const wordOfTheDay = computed(() => {
  if (!_wotdEntryId.value) return null
  return Object.values(entriesByBook.value).flat().find(e => e.id === _wotdEntryId.value) ?? null
})

const isWordOfTheDayPreview = computed(() => _wotdIsPreview.value)
```
