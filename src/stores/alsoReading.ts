import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  cacheKeys,
  invalidate,
  registerRevalidator,
  swrRun,
  swrStatus,
} from '@/composables/useCache'
import type { AlsoReadingItem, AlsoReadingPage } from '@/types'

export type AlsoReadingStatus = 'idle' | 'loading' | 'error'

const TTL = 45_000
const DEFAULT_LIMIT = 3
const DIALOG_LIMIT = 20

const emptyPage = (): AlsoReadingPage => ({ items: [], nextCursor: null, totalVisible: 0 })

const rpcErrorMessage = (error: { message?: string; details?: string } | null): string => (
  error?.message || error?.details || 'Also Reading request failed'
)

const mergePage = (
  current: AlsoReadingPage | undefined,
  incoming: AlsoReadingPage,
  append: boolean,
): AlsoReadingPage => {
  if (!append) return incoming

  const seen = new Set<string>()
  const items: AlsoReadingItem[] = []
  for (const item of [...(current?.items ?? []), ...incoming.items]) {
    if (seen.has(item.userId)) continue
    seen.add(item.userId)
    items.push(item)
  }

  return {
    items,
    nextCursor: incoming.nextCursor,
    totalVisible: incoming.totalVisible,
  }
}

export const useAlsoReadingStore = defineStore('alsoReading', () => {
  const pages = ref<Record<string, AlsoReadingPage>>({})
  const status = ref<AlsoReadingStatus>('idle')
  const error = ref<string | null>(null)

  const hasVisibleItems = computed(() => (bookId: string) => (pages.value[bookId]?.items.length ?? 0) > 0)

  const requireUserId = (): string => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')
    return authStore.user.id
  }

  const fetchForBook = async (
    bookId: string,
    isbn: string | null,
    options: { cursor?: string | null; force?: boolean; limit?: number } = {},
  ): Promise<AlsoReadingPage> => {
    const uid = requireUserId()
    if (!bookId) return emptyPage()

    const cursor = options.cursor ?? null
    const append = !!cursor
    const key = cacheKeys.alsoReading(uid, bookId)
    const limit = options.limit ?? (append ? DIALOG_LIMIT : DEFAULT_LIMIT)

    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('get_also_reading_for_book', {
        p_book_id: bookId,
        p_isbn: isbn,
        p_limit: limit,
        p_cursor: cursor,
      })
      if (err) throw err
      const incoming = (data as AlsoReadingPage | null) ?? emptyPage()
      pages.value[bookId] = mergePage(pages.value[bookId], incoming, append)
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const cacheState = append || options.force ? 'loading' : swrStatus(key, TTL)
    if (!append && cacheState === 'fresh') return pages.value[bookId] ?? emptyPage()

    if (!append && cacheState === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return pages.value[bookId] ?? emptyPage()
    }

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return pages.value[bookId] ?? emptyPage()
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return pages.value[bookId] ?? emptyPage()
    }
  }

  const clearBook = (bookId: string): void => {
    if (!bookId) return
    delete pages.value[bookId]
    const uid = useAuthStore().user?.id
    if (uid) invalidate(cacheKeys.alsoReading(uid, bookId))
  }

  const invalidateAll = (): void => {
    const uid = useAuthStore().user?.id
    if (!uid) return
    invalidate(`alsoReading:${uid}:`, { prefix: true })
  }

  return {
    pages,
    status,
    error,
    hasVisibleItems,
    fetchForBook,
    clearBook,
    invalidateAll,
  }
})
