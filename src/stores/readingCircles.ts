import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  cacheKeys,
  invalidate,
  registerRevalidator,
  swrRun,
  swrStatus,
  swrTouch,
} from '@/composables/useCache'
import type {
  CircleReactionCreateResult,
  CircleReactionPage,
  ReadingCircleCreateResult,
  ReadingCircleDetail,
  ReadingCircleInvitationResponse,
  ReadingCircleInviteResult,
  ReadingCircleLeaveResult,
  ReadingCircleListItem,
  ReadingCircleListPage,
  ReadingCircleRemoveMemberResult,
} from '@/types'

export type ReadingCirclesStatus = 'idle' | 'loading' | 'saving' | 'error'

const TTL = 30_000
const DEFAULT_LIMIT = 20
const REACTION_LIMIT = 50

const emptyListPage = (): ReadingCircleListPage => ({ items: [], nextCursor: null })
const emptyReactionPage = (): CircleReactionPage => ({ items: [], nextCursor: null, viewerProgressMissing: false })

const rpcErrorMessage = (error: { message?: string; details?: string } | null): string => (
  error?.message || error?.details || 'Reading Circles request failed'
)

const mergeListPage = (
  current: ReadingCircleListPage | undefined,
  incoming: ReadingCircleListPage,
  append: boolean,
): ReadingCircleListPage => {
  if (!append) return incoming

  const seen = new Set<string>()
  const items: ReadingCircleListItem[] = []
  for (const item of [...(current?.items ?? []), ...incoming.items]) {
    const key = item.type === 'circle' ? `circle:${item.circle.circleId}` : `invitation:${item.invitationId}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return { items, nextCursor: incoming.nextCursor }
}

const mergeReactionPage = (
  current: CircleReactionPage | undefined,
  incoming: CircleReactionPage,
  append: boolean,
): CircleReactionPage => {
  if (!append) return incoming

  const seen = new Set<string>()
  const items = []
  for (const item of [...(current?.items ?? []), ...incoming.items]) {
    if (seen.has(item.reactionId)) continue
    seen.add(item.reactionId)
    items.push(item)
  }
  return {
    items,
    nextCursor: incoming.nextCursor,
    viewerProgressMissing: incoming.viewerProgressMissing,
  }
}

export const useReadingCirclesStore = defineStore('readingCircles', () => {
  const listPages = ref<Record<string, ReadingCircleListPage>>({})
  const details = ref<Record<string, ReadingCircleDetail | null>>({})
  const reactionPages = ref<Record<string, CircleReactionPage>>({})
  const status = ref<ReadingCirclesStatus>('idle')
  const error = ref<string | null>(null)
  const busyCircleIds = ref<Record<string, boolean>>({})
  const channels = new Map<string, RealtimeChannel>()
  const refreshTimers = new Map<string, number>()

  const requireUserId = (): string => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')
    return authStore.user.id
  }

  const bookItems = computed(() => (bookId: string) => listPages.value[bookId]?.items ?? [])
  const hasBookItems = computed(() => (bookId: string) => bookItems.value(bookId).length > 0)
  const hasCurrentPageIndicator = computed(() => (circleId: string, normalizedLocation: number | null | undefined) => {
    if (normalizedLocation == null) return false
    const page = reactionPages.value[circleId]
    if (!page) return false
    return page.items.some(item => Math.abs(item.normalizedLocation - normalizedLocation) <= 0.75)
  })

  const invalidateSurfaces = (bookId?: string, circleId?: string): void => {
    const uid = useAuthStore().user?.id
    if (!uid) return
    if (bookId) invalidate(cacheKeys.readingCircles(uid, bookId))
    else invalidate(`readingCircles:${uid}:`, { prefix: true })
    if (circleId) {
      invalidate(cacheKeys.readingCircleDetail(uid, circleId))
      invalidate(cacheKeys.readingCircleReactions(uid, circleId))
    }
  }

  const fetchForBook = async (
    bookId: string,
    options: { cursor?: string | null; force?: boolean } = {},
  ): Promise<ReadingCircleListPage> => {
    const uid = requireUserId()
    const key = cacheKeys.readingCircles(uid, bookId)
    const cursor = options.cursor ?? null
    const append = !!cursor

    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('list_my_reading_circles', {
        p_limit: DEFAULT_LIMIT,
        p_cursor: cursor,
      })
      if (err) throw err
      const incoming = (data as ReadingCircleListPage | null) ?? emptyListPage()
      const filtered: ReadingCircleListPage = {
        items: incoming.items.filter(item => item.circle.book.bookId === bookId),
        nextCursor: incoming.nextCursor,
      }
      listPages.value[bookId] = mergeListPage(listPages.value[bookId], filtered, append)
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))
    const cacheState = append || options.force ? 'loading' : swrStatus(key, TTL)
    if (!append && cacheState === 'fresh') return listPages.value[bookId] ?? emptyListPage()
    if (!append && cacheState === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return listPages.value[bookId] ?? emptyListPage()
    }

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return listPages.value[bookId] ?? emptyListPage()
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return listPages.value[bookId] ?? emptyListPage()
    }
  }

  const fetchDetail = async (circleId: string, options: { force?: boolean } = {}): Promise<ReadingCircleDetail | null> => {
    const uid = requireUserId()
    const key = cacheKeys.readingCircleDetail(uid, circleId)
    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('get_reading_circle_detail', {
        p_circle_id: circleId,
      })
      if (err) throw err
      details.value[circleId] = data as ReadingCircleDetail | null
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))
    const cacheState = options.force ? 'loading' : swrStatus(key, TTL)
    if (cacheState === 'fresh') return details.value[circleId] ?? null
    if (cacheState === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return details.value[circleId] ?? null
    }

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return details.value[circleId] ?? null
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return null
    }
  }

  const fetchReactions = async (
    circleId: string,
    options: { cursor?: string | null; force?: boolean; minLocation?: number | null; maxLocation?: number | null } = {},
  ): Promise<CircleReactionPage> => {
    const uid = requireUserId()
    const key = cacheKeys.readingCircleReactions(uid, circleId)
    const cursor = options.cursor ?? null
    const append = !!cursor
    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('get_visible_circle_reactions', {
        p_circle_id: circleId,
        p_min_location: options.minLocation ?? null,
        p_max_location: options.maxLocation ?? null,
        p_limit: REACTION_LIMIT,
        p_cursor: cursor,
      })
      if (err) throw err
      const incoming = (data as CircleReactionPage | null) ?? emptyReactionPage()
      reactionPages.value[circleId] = mergeReactionPage(reactionPages.value[circleId], incoming, append)
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))
    const cacheState = append || options.force ? 'loading' : swrStatus(key, TTL)
    if (!append && cacheState === 'fresh') return reactionPages.value[circleId] ?? emptyReactionPage()
    if (!append && cacheState === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return reactionPages.value[circleId] ?? emptyReactionPage()
    }

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return reactionPages.value[circleId] ?? emptyReactionPage()
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return reactionPages.value[circleId] ?? emptyReactionPage()
    }
  }

  const createCircle = async (
    bookId: string,
    name: string,
    invitedUserIds: string[],
  ): Promise<ReadingCircleCreateResult> => {
    requireUserId()
    status.value = 'saving'
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('create_reading_circle', {
        p_book_id: bookId,
        p_name: name,
        p_invited_user_ids: invitedUserIds,
      })
      if (err) throw err
      const result = data as ReadingCircleCreateResult
      invalidateSurfaces(bookId, result.circleId)
      await fetchForBook(bookId, { force: true })
      status.value = 'idle'
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      throw err
    }
  }

  const inviteMembers = async (circleId: string, userIds: string[]): Promise<ReadingCircleInviteResult> => {
    requireUserId()
    busyCircleIds.value[circleId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('invite_reading_circle_members', {
        p_circle_id: circleId,
        p_user_ids: userIds,
      })
      if (err) throw err
      const result = data as ReadingCircleInviteResult
      invalidateSurfaces(undefined, circleId)
      await fetchDetail(circleId, { force: true })
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyCircleIds.value[circleId] = false
    }
  }

  const respondToInvitation = async (
    invitationId: string,
    accept: boolean,
    bookId: string,
  ): Promise<ReadingCircleInvitationResponse> => {
    requireUserId()
    status.value = 'saving'
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('respond_to_reading_circle_invitation', {
        p_invitation_id: invitationId,
        p_accept: accept,
      })
      if (err) throw err
      const result = data as ReadingCircleInvitationResponse
      invalidateSurfaces(bookId, result.circleId)
      await fetchForBook(bookId, { force: true })
      status.value = 'idle'
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      throw err
    }
  }

  const addReaction = async (
    circleId: string,
    bookId: string,
    sourcePage: number,
    content: string,
  ): Promise<CircleReactionCreateResult> => {
    requireUserId()
    busyCircleIds.value[circleId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('add_circle_reaction', {
        p_circle_id: circleId,
        p_book_id: bookId,
        p_source_page: sourcePage,
        p_content: content,
      })
      if (err) throw err
      const result = data as CircleReactionCreateResult
      invalidateSurfaces(bookId, circleId)
      await fetchReactions(circleId, { force: true })
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyCircleIds.value[circleId] = false
    }
  }

  const leaveCircle = async (circleId: string, bookId: string): Promise<ReadingCircleLeaveResult> => {
    requireUserId()
    busyCircleIds.value[circleId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('leave_reading_circle', {
        p_circle_id: circleId,
      })
      if (err) throw err
      const result = data as ReadingCircleLeaveResult
      delete details.value[circleId]
      delete reactionPages.value[circleId]
      invalidateSurfaces(bookId, circleId)
      await fetchForBook(bookId, { force: true })
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyCircleIds.value[circleId] = false
    }
  }

  const removeMember = async (
    circleId: string,
    userId: string,
  ): Promise<ReadingCircleRemoveMemberResult> => {
    requireUserId()
    busyCircleIds.value[circleId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('remove_reading_circle_member', {
        p_circle_id: circleId,
        p_user_id: userId,
      })
      if (err) throw err
      const result = data as ReadingCircleRemoveMemberResult
      invalidateSurfaces(undefined, circleId)
      await fetchDetail(circleId, { force: true })
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyCircleIds.value[circleId] = false
    }
  }

  const subscribeToCircle = (circleId: string): void => {
    if (!circleId || channels.has(circleId)) return

    const refetch = () => {
      void fetchReactions(circleId, { force: true })
      void fetchDetail(circleId, { force: true })
    }

    const channel = supabase
      .channel(`reading-circle:${circleId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'circle_reactions',
        filter: `circle_id=eq.${circleId}`,
      }, refetch)
      .subscribe()

    channels.set(circleId, channel)
    const timer = window.setInterval(refetch, 2_000)
    refreshTimers.set(circleId, timer)
  }

  const unsubscribeFromCircle = (circleId: string): void => {
    const channel = channels.get(circleId)
    if (channel) {
      void supabase.removeChannel(channel)
      channels.delete(circleId)
    }
    const timer = refreshTimers.get(circleId)
    if (timer) {
      window.clearInterval(timer)
      refreshTimers.delete(circleId)
    }
  }

  const clearAll = (): void => {
    for (const circleId of channels.keys()) unsubscribeFromCircle(circleId)
    listPages.value = {}
    details.value = {}
    reactionPages.value = {}
    error.value = null
    status.value = 'idle'
  }

  const touchDetail = (circleId: string): void => {
    const uid = useAuthStore().user?.id
    if (uid) swrTouch(cacheKeys.readingCircleDetail(uid, circleId))
  }

  return {
    listPages,
    details,
    reactionPages,
    status,
    error,
    busyCircleIds,
    bookItems,
    hasBookItems,
    hasCurrentPageIndicator,
    fetchForBook,
    fetchDetail,
    fetchReactions,
    createCircle,
    inviteMembers,
    respondToInvitation,
    addReaction,
    leaveCircle,
    removeMember,
    subscribeToCircle,
    unsubscribeFromCircle,
    clearAll,
    invalidateSurfaces,
    touchDetail,
  }
})
