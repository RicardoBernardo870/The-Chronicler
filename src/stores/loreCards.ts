import { defineStore } from 'pinia'
import { reactive, computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { supabase } from '@/services/supabase'
import { loreService } from '@/services/loreService'
import { mapLoreCard, type LoreCard, type LoreCardRow } from '@/types'
import { buildMasterRecap } from '@/utils/masterRecap'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useRecapsStore } from '@/stores/recaps'
import {
  swrStatus,
  swrRun,
  swrTouch,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

const TTL = 120_000 // 2 minutes per lore-api.md

export const useLoreCardsStore = defineStore('loreCards', () => {
  // Hoisted at setup time — useToast() relies on Vue's inject() which is only
  // available synchronously during component/store initialisation, not inside
  // async actions.
  const toast = useToast()

  // ── State ──────────────────────────────────────────────────────────────────
  // keyed by bookId; values sorted by unlocked_at_milestone asc
  const loreByBook = reactive<Record<string, LoreCard[]>>({})

  // Set of bookIds currently generating lore (for the global "generating" banner).
  // Using a ref<Set> keeps reactivity simple — we reassign on mutation.
  const generatingBookIds = ref<Set<string>>(new Set())

  const isGenerating = computed<boolean>(() => generatingBookIds.value.size > 0)

  const isGeneratingForBook = (bookId: string): boolean =>
    generatingBookIds.value.has(bookId)

  // ── fetchLoreForBook ───────────────────────────────────────────────────────
  const fetchLoreForBook = async (bookId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.lore(authStore.user.id, bookId)
    const fetcher = async () => {
      const { data, error: err } = await supabase
        .from('lore_cards')
        .select('*')
        .eq('book_id', bookId)
        .order('unlocked_at_milestone', { ascending: true })
      if (err) throw err
      loreByBook[bookId] = (data as LoreCardRow[]).map(mapLoreCard)
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  // ── fetchLoreForAllBooks ───────────────────────────────────────────────────
  const fetchLoreForAllBooks = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.loreAll(authStore.user.id)
    const uid = authStore.user.id

    const fetcher = async () => {
      const { data, error: err } = await supabase
        .from('lore_cards')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err

      // Partition by book_id and merge into loreByBook
      const byBook: Record<string, LoreCard[]> = {}
      for (const row of data as LoreCardRow[]) {
        const card = mapLoreCard(row)
        if (!byBook[card.bookId]) byBook[card.bookId] = []
        byBook[card.bookId].push(card)
      }
      // Sort each book's cards by milestone asc and write to reactive state
      for (const [bid, cards] of Object.entries(byBook)) {
        loreByBook[bid] = cards.sort((a, b) => a.unlockedAtMilestone - b.unlockedAtMilestone)
        // Touch per-book keys so they're treated as fresh
        swrTouch(cacheKeys.lore(uid, bid))
      }
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  // ── maybeUnlockForMilestone ────────────────────────────────────────────────
  // Fire-and-forget entry point. MUST never throw (FR-008).
  const maybeUnlockForMilestone = async (
    bookId: string,
    milestone: number,
    currentPage: number,
  ): Promise<void> => {
    try {
      const authStore = useAuthStore()
      if (!authStore.user) return

      // 1. Cost gate: ensure local state is current, then check for existing card
      await fetchLoreForBook(bookId)
      const existing = loreByBook[bookId]?.find(c => c.unlockedAtMilestone === milestone)
      if (existing) return // FR-003: dedup

      // 2. Spoiler wall: build Master Recap
      const recapsStore = useRecapsStore()
      await recapsStore.fetchRecapsForBook(bookId)
      const masterRecap = buildMasterRecap(recapsStore.recapHistoryForBook(bookId), currentPage)
      if (!masterRecap) return // FR-004: no qualifying recaps

      // 3. Book metadata
      const booksStore = useBooksStore()
      const book = booksStore.bookById(bookId)
      if (!book) return

      const percentage = book.totalPages > 0
        ? Math.round((currentPage / book.totalPages) * 100)
        : 0

      // 4. Call edge function — pass existing titles so AI won't repeat topics
      // Mark this book as generating so the global banner shows
      generatingBookIds.value = new Set(generatingBookIds.value).add(bookId)

      let card
      try {
        card = await loreService.generate({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          currentPage,
          totalPages: book.totalPages,
          percentage,
          milestone,
          masterRecap,
          existingTopics: (loreByBook[bookId] ?? []).map(c => c.title),
        })
      } finally {
        const next = new Set(generatingBookIds.value)
        next.delete(bookId)
        generatingBookIds.value = next
      }

      // 5. Persist
      const { data, error: insertErr } = await supabase
        .from('lore_cards')
        .insert({
          user_id: authStore.user.id,
          book_id: bookId,
          title: card.title,
          content: card.content,
          type: card.type,
          linked_entities: card.linked_entities,
          unlocked_at_page: currentPage,
          unlocked_at_milestone: milestone,
          seen: false,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      // 6. Local cache update
      const mapped = mapLoreCard(data as LoreCardRow)
      loreByBook[bookId] = [...(loreByBook[bookId] ?? []), mapped]
        .sort((a, b) => a.unlockedAtMilestone - b.unlockedAtMilestone)

      swrTouch(cacheKeys.lore(authStore.user.id, bookId))
      swrTouch(cacheKeys.loreAll(authStore.user.id))

      // 7. Toast notification (FR-025)
      toast.add({
        severity: 'success',
        summary: 'New Lore Unlocked',
        detail: book.title,
        life: 4000,
      })
    } catch (e) {
      // FR-008: silent failure — never surface to the user
      console.error('[loreCards] maybeUnlockForMilestone failed:', e)
    }
  }

  // ── markBookLoreSeen ───────────────────────────────────────────────────────
  // Idempotent — safe to call on every Book Detail mount (FR-028).
  const markBookLoreSeen = async (bookId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const unseen = loreByBook[bookId]?.filter(c => !c.seen) ?? []
    if (unseen.length === 0) return

    const { error: updateErr } = await supabase
      .from('lore_cards')
      .update({ seen: true })
      .eq('book_id', bookId)
      .eq('seen', false) // RLS handles user_id

    if (updateErr) { console.error('[loreCards] markBookLoreSeen failed:', updateErr); return }

    // Optimistic local mutate
    unseen.forEach(c => { c.seen = true })
    swrTouch(cacheKeys.lore(authStore.user.id, bookId))
    swrTouch(cacheKeys.loreAll(authStore.user.id))
  }

  // ── Read helpers ───────────────────────────────────────────────────────────

  const loreForBook = (bookId: string): LoreCard[] =>
    loreByBook[bookId] ?? []

  const hasUnseenLore = (bookId: string): boolean =>
    (loreByBook[bookId] ?? []).some(c => !c.seen)

  const randomLoreForBook = (bookId: string): LoreCard | null => {
    const cards = loreByBook[bookId] ?? []
    if (cards.length === 0) return null
    return cards[Math.floor(Math.random() * cards.length)]
  }

  const allLore = computed<LoreCard[]>(() =>
    Object.values(loreByBook).flat(),
  )

  return {
    loreByBook,
    generatingBookIds,
    isGenerating,
    isGeneratingForBook,
    fetchLoreForBook,
    fetchLoreForAllBooks,
    maybeUnlockForMilestone,
    markBookLoreSeen,
    loreForBook,
    hasUnseenLore,
    randomLoreForBook,
    allLore,
  }
})
