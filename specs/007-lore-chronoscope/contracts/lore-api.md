# Lore API Contract

Defines the HTTP contract for the `generate-lore` Supabase edge function and the Pinia store surface that wraps it.

---

## Edge Function: `POST /functions/v1/generate-lore`

### Request

**Headers**:
- `Authorization: Bearer <user-jwt>` — required; edge function manually decodes via `atob` (same pattern as `generate-recap`, `verify_jwt: false` in `config.toml`).
- `Content-Type: application/json`

**Body**:
```typescript
{
  title: string              // book title (required)
  author: string             // book author (required)
  isbn?: string              // optional, passed through for provenance
  currentPage: number        // reader's current page at moment of trigger (required)
  totalPages: number         // book length (required)
  percentage: number         // derived reader percentage (required, 0-100)
  milestone: number          // 10-90, the specific milestone being unlocked (required)
  masterRecap: string        // concatenated Master Recap text (required, non-empty)
}
```

**Request-body validation**:
- Reject with 400 if any required field is missing or `masterRecap` is empty string.
- Reject with 400 if `milestone` is not in `[10, 20, 30, 40, 50, 60, 70, 80, 90]`.
- Reject with 401 if JWT is missing or cannot be decoded.

### Response — 200 OK

```typescript
{
  title: string                    // 3–8 word evocative title
  content: string                  // 150–300 words of lore
  type: 'History' | 'Myth' | 'Geography'
  linked_entities: string[]        // up to 5 entries, names from Master Recap
}
```

**Headers**: `Content-Type: application/json`.

### Response — Error shapes

| HTTP | Body | When |
|---|---|---|
| 400 | `{ error: "Missing required fields" }` | Input validation fails. |
| 401 | `{ error: "Unauthorized" }` | No/invalid JWT. |
| 503 | `{ error: "AI service not configured" }` | `GEMINI_API_KEY` missing. |
| 500 | `{ error: "Internal server error", detail: string }` | Any unhandled error. |
| 500 | `{ error: "AI output invalid", detail: string }` | AI response fails JSON-schema validation. |

All error responses are **not retried** by the client (FR-008). The client logs and moves on.

### AI call inside the edge function

- Provider: Google Gemini via `@google/genai`.
- Model: `gemini-2.5-flash`.
- Config: `temperature: 0.6`, `maxOutputTokens: 2048`, no streaming.
- System instruction: the "Chronicler Historian" prompt from `research.md § Decision 4`.
- User message: includes book metadata, current-progress summary, and the Master Recap verbatim.

**Post-processing**:
1. Strip markdown code fences if present.
2. `JSON.parse` the result.
3. Validate shape: `title` is non-empty string; `content` is non-empty string; `type` ∈ the allowed enum; `linked_entities` is a string array with ≤ 5 elements.
4. On validation failure, return 500 `"AI output invalid"`.

---

## Store Surface: `useLoreCardsStore`

**File**: `src/stores/loreCards.ts` (new)

### State

```typescript
loreByBook: Record<string, LoreCard[]>   // key = bookId; values sorted by unlocked_at_milestone asc
```

### Actions

#### `fetchLoreForBook(bookId: string): Promise<void>`

**Purpose**: SWR-aware fetch of lore cards for a single book.

**Contract**:
- Uses `cacheKeys.lore(authStore.user.id, bookId)` with TTL 120 000 ms.
- `fresh` → return immediately (no network).
- `background` → return immediately; fire silent revalidation.
- `loading` → await the fetcher.
- Registers a revalidator so tab-focus revalidation works (via feature 006 `registerRevalidator`).

**Fetcher query**:
```typescript
supabase
  .from('lore_cards')
  .select('*')
  .eq('book_id', bookId)
  .order('unlocked_at_milestone', { ascending: true })
```

The `user_id = auth.uid()` filter is applied implicitly by RLS.

---

#### `fetchLoreForAllBooks(): Promise<void>`

**Purpose**: One-shot fetch of all lore for the current user; used by the Great Library → Lore Cards tab for the "all books" view and by the Library page to compute unseen chips.

**Cache key**: `cacheKeys.loreAll(uid)` (add to `useCache.ts`), TTL 120 000 ms.

**Fetcher query**:
```typescript
supabase
  .from('lore_cards')
  .select('*')
  .order('created_at', { ascending: false })
```

**Post-process**: Partition results by `book_id` and merge into `loreByBook`.

---

#### `maybeUnlockForMilestone(bookId, milestone, currentPage): Promise<void>`

**Purpose**: The core unlock entry point. Called fire-and-forget from `progress.ts:updateProgress` after a server-confirmed save that crossed a milestone.

**Contract (must never throw — swallows all errors)**:

```typescript
async maybeUnlockForMilestone(bookId, milestone, currentPage) {
  try {
    const authStore = useAuthStore()
    if (!authStore.user) return

    // 1. Cost gate: card for this milestone already exists?
    await fetchLoreForBook(bookId)  // ensures local state matches server
    const existing = loreByBook[bookId]?.find(c => c.unlockedAtMilestone === milestone)
    if (existing) return  // FR-003

    // 2. Spoiler wall: compute Master Recap
    const recapsStore = useRecapsStore()
    await recapsStore.fetchRecapsForBook(bookId)  // SWR — cheap on repeat
    const masterRecap = buildMasterRecap(recapsStore.recapHistoryForBook(bookId), currentPage)
    if (!masterRecap) return  // FR-004: no qualifying recaps

    // 3. Book metadata
    const booksStore = useBooksStore()
    const book = booksStore.bookById(bookId)
    if (!book) return

    // 4. Call edge function
    const card = await loreService.generate({ title, author, isbn, currentPage, totalPages, percentage, milestone, masterRecap })

    // 5. Persist
    const { data, error } = await supabase.from('lore_cards').insert({
      user_id: authStore.user.id,
      book_id: bookId,
      title: card.title,
      content: card.content,
      type: card.type,
      linked_entities: card.linked_entities,
      unlocked_at_page: currentPage,
      unlocked_at_milestone: milestone,
      seen: false,
    }).select().single()
    if (error) throw error

    // 6. Local cache update + notify
    const mapped = mapLoreCard(data as LoreCardRow)
    loreByBook[bookId] = [...(loreByBook[bookId] ?? []), mapped].sort((a, b) => a.unlockedAtMilestone - b.unlockedAtMilestone)
    swrTouch(cacheKeys.lore(authStore.user.id, bookId))
    swrTouch(cacheKeys.loreAll(authStore.user.id))

    toast.add({ severity: 'success', summary: 'New Lore Unlocked', detail: book.title, life: 4000 })
  } catch (e) {
    console.error('[loreCards] maybeUnlockForMilestone failed:', e)
    // FR-008: no user-facing error
  }
}
```

---

#### `markBookLoreSeen(bookId: string): Promise<void>`

**Purpose**: Called from `onMounted` of `BookDetailPage.vue` to clear the "New Lore" indicator.

```typescript
async markBookLoreSeen(bookId) {
  const authStore = useAuthStore()
  if (!authStore.user) return

  const unseen = loreByBook[bookId]?.filter(c => !c.seen) ?? []
  if (unseen.length === 0) return

  const { error } = await supabase
    .from('lore_cards')
    .update({ seen: true })
    .eq('book_id', bookId)
    .eq('seen', false)  // RLS handles user_id
  if (error) { console.error(error); return }

  // Optimistic local mutate
  unseen.forEach(c => { c.seen = true })
  swrTouch(cacheKeys.lore(authStore.user.id, bookId))
  swrTouch(cacheKeys.loreAll(authStore.user.id))
}
```

---

### Read helpers

```typescript
loreForBook(bookId): LoreCard[]             // sorted by unlocked_at_milestone asc
hasUnseenLore(bookId): boolean              // any card with seen === false
randomLoreForBook(bookId): LoreCard | null  // returns one at random (for Chronoscope card)
allLore: ComputedRef<LoreCard[]>            // flattened for Great Library "all books" view
```

---

## Service: `loreService.generate(request)`

**File**: `src/services/loreService.ts` (new)

Thin wrapper over `fetch` that attaches the Supabase access token and calls the edge function.

```typescript
export const loreService = {
  async generate(req: LoreGenerateRequest): Promise<LoreGenerateResponse> {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-lore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return res.json()
  }
}
```

---

## Cache key contract (addition to `useCache.ts`)

```typescript
export const cacheKeys = {
  // ...existing...
  lore:    (uid: string, bookId: string) => `lore:${uid}:${bookId}`,
  loreAll: (uid: string)                 => `lore:${uid}:all`,
}
```

---

## Invariants

1. The edge function is the only path that calls Gemini for lore.
2. The DB unique constraint makes the client's pre-check an optimisation, not a correctness requirement.
3. `maybeUnlockForMilestone` NEVER throws — every failure path leads to `console.error` + return.
4. `markBookLoreSeen` is idempotent — safe to call on every Book Detail mount.
5. Cache keys always include `uid` prefix so `clearAll()` on user switch wipes everything correctly.
