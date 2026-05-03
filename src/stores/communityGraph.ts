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
  swrTouch,
} from '@/composables/useCache'
import type {
  CommunityBlockedUser,
  CommunityBlockResult,
  CommunityCursorPage,
  CommunityFollowListItem,
  CommunityInteractionResult,
  CommunityReaderSearchResult,
  CommunityRelationshipState,
} from '@/types'

export type CommunityGraphStatus = 'idle' | 'loading' | 'saving' | 'error'
export type CommunityFollowListMode = 'followers' | 'following'

const TTL = 45_000
const DEFAULT_PAGE_SIZE = 20

const emptyPage = <T>(): CommunityCursorPage<T> => ({ items: [], nextCursor: null })

const rpcErrorMessage = (error: { message?: string; details?: string } | null): string => (
  error?.message || error?.details || 'Community graph request failed'
)

const mergePage = <T extends { userId: string }>(
  current: CommunityCursorPage<T> | undefined,
  incoming: CommunityCursorPage<T>,
  append: boolean,
): CommunityCursorPage<T> => {
  if (!append) return incoming

  const seen = new Set<string>()
  const items: T[] = []
  for (const item of [...(current?.items ?? []), ...incoming.items]) {
    if (seen.has(item.userId)) continue
    seen.add(item.userId)
    items.push(item)
  }

  return { items, nextCursor: incoming.nextCursor }
}

export const useCommunityGraphStore = defineStore('communityGraph', () => {
  const relationships = ref<Record<string, CommunityRelationshipState>>({})
  const searchPages = ref<Record<string, CommunityCursorPage<CommunityReaderSearchResult>>>({})
  const followersPages = ref<Record<string, CommunityCursorPage<CommunityFollowListItem>>>({})
  const followingPages = ref<Record<string, CommunityCursorPage<CommunityFollowListItem>>>({})
  const blockedPage = ref<CommunityCursorPage<CommunityBlockedUser>>(emptyPage())
  const status = ref<CommunityGraphStatus>('idle')
  const error = ref<string | null>(null)
  const busyTargets = ref<Record<string, boolean>>({})

  const isBusy = computed(() => (targetUserId: string) => !!busyTargets.value[targetUserId])

  const requireUserId = (): string => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')
    return authStore.user.id
  }

  const invalidateGraphSurfaces = (targetUserId?: string): void => {
    const uid = useAuthStore().user?.id
    if (!uid) return

    invalidate(cacheKeys.communitySearch(uid, ''), { prefix: true })
    invalidate(cacheKeys.communityFollowers(uid, ''), { prefix: true })
    invalidate(cacheKeys.communityFollowing(uid, ''), { prefix: true })
    invalidate(cacheKeys.communityBlocked(uid))
    invalidate(`alsoReading:${uid}:`, { prefix: true })
    invalidate('publicProfile:', { prefix: true })
    if (targetUserId) invalidate(cacheKeys.communityRelationship(uid, targetUserId))
  }

  const fetchRelationshipState = async (
    targetUserId: string,
    options: { force?: boolean } = {},
  ): Promise<CommunityRelationshipState | null> => {
    const uid = requireUserId()
    if (!targetUserId) return null

    const key = cacheKeys.communityRelationship(uid, targetUserId)
    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('get_community_relationship_state', {
        p_target_user_id: targetUserId,
      })
      if (err) throw err
      if (data) relationships.value[targetUserId] = data as CommunityRelationshipState
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const cacheState = options.force ? 'loading' : swrStatus(key, TTL)
    if (cacheState === 'fresh') return relationships.value[targetUserId] ?? null

    if (cacheState === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return relationships.value[targetUserId] ?? null
    }

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return relationships.value[targetUserId] ?? null
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return null
    }
  }

  const mutateRelationship = async (
    targetUserId: string,
    rpcName: 'follow_community_user' | 'unfollow_community_user',
  ): Promise<CommunityRelationshipState> => {
    const uid = requireUserId()
    busyTargets.value[targetUserId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc(rpcName, {
        p_target_user_id: targetUserId,
      })
      if (err) throw err
      const state = data as CommunityRelationshipState
      relationships.value[targetUserId] = state
      swrTouch(cacheKeys.communityRelationship(uid, targetUserId))
      invalidateGraphSurfaces(targetUserId)
      return state
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyTargets.value[targetUserId] = false
    }
  }

  const followUser = (targetUserId: string) => mutateRelationship(targetUserId, 'follow_community_user')

  const unfollowUser = (targetUserId: string) => mutateRelationship(targetUserId, 'unfollow_community_user')

  const searchReaders = async (
    query: string,
    cursor: string | null = null,
  ): Promise<CommunityCursorPage<CommunityReaderSearchResult>> => {
    const uid = requireUserId()
    const normalized = query.trim().toLowerCase()
    const key = cacheKeys.communitySearch(uid, normalized)
    const append = !!cursor

    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('search_community_readers', {
        p_query: normalized,
        p_limit: DEFAULT_PAGE_SIZE,
        p_cursor: cursor,
      })
      if (err) throw err
      const incoming = (data as CommunityCursorPage<CommunityReaderSearchResult>) ?? emptyPage()
      searchPages.value[normalized] = mergePage(searchPages.value[normalized], incoming, append)
      for (const item of incoming.items) {
        relationships.value[item.userId] = {
          targetUserId: item.userId,
          isFollowing: item.isFollowing,
          followsViewer: item.followsViewer,
          isBlockedByViewer: false,
          hasBlockedViewer: false,
          followersCount: item.followersCount,
          followingCount: item.followingCount,
          canInteract: true,
          reason: 'allowed',
        }
      }
    }

    const cacheState = append ? 'loading' : swrStatus(key, TTL)
    if (!append && cacheState === 'fresh') return searchPages.value[normalized] ?? emptyPage()

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return searchPages.value[normalized] ?? emptyPage()
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return searchPages.value[normalized] ?? emptyPage()
    }
  }

  const fetchFollowList = async (
    mode: CommunityFollowListMode,
    userId: string,
    cursor: string | null = null,
  ): Promise<CommunityCursorPage<CommunityFollowListItem>> => {
    const uid = requireUserId()
    const key = mode === 'followers'
      ? cacheKeys.communityFollowers(uid, userId)
      : cacheKeys.communityFollowing(uid, userId)
    const append = !!cursor
    const storeTarget = mode === 'followers' ? followersPages : followingPages

    const fetcher = async () => {
      const rpcName = mode === 'followers' ? 'list_community_followers' : 'list_community_following'
      const { data, error: err } = await supabase.rpc(rpcName, {
        p_user_id: userId,
        p_limit: DEFAULT_PAGE_SIZE,
        p_cursor: cursor,
      })
      if (err) throw err
      const incoming = (data as CommunityCursorPage<CommunityFollowListItem>) ?? emptyPage()
      storeTarget.value[userId] = mergePage(storeTarget.value[userId], incoming, append)
      for (const item of incoming.items) {
        relationships.value[item.userId] = {
          targetUserId: item.userId,
          isFollowing: item.isFollowing,
          followsViewer: false,
          isBlockedByViewer: false,
          hasBlockedViewer: false,
          followersCount: relationships.value[item.userId]?.followersCount ?? 0,
          followingCount: relationships.value[item.userId]?.followingCount ?? 0,
          canInteract: true,
          reason: 'allowed',
        }
      }
    }

    const cacheState = append ? 'loading' : swrStatus(key, TTL)
    if (!append && cacheState === 'fresh') return storeTarget.value[userId] ?? emptyPage()

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return storeTarget.value[userId] ?? emptyPage()
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return storeTarget.value[userId] ?? emptyPage()
    }
  }

  const fetchFollowers = (userId: string, cursor: string | null = null) => fetchFollowList('followers', userId, cursor)

  const fetchFollowing = (userId: string, cursor: string | null = null) => fetchFollowList('following', userId, cursor)

  const blockUser = async (targetUserId: string): Promise<CommunityBlockResult> => {
    requireUserId()
    busyTargets.value[targetUserId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('block_community_user', {
        p_target_user_id: targetUserId,
      })
      if (err) throw err
      const result = data as CommunityBlockResult
      relationships.value[targetUserId] = {
        ...(relationships.value[targetUserId] ?? {
          targetUserId,
          isFollowing: false,
          followsViewer: false,
          hasBlockedViewer: false,
          followersCount: 0,
          followingCount: 0,
        }),
        isFollowing: false,
        followsViewer: false,
        isBlockedByViewer: result.isBlockedByViewer,
        canInteract: false,
        reason: result.reason ?? 'blocked',
      }
      invalidateGraphSurfaces(targetUserId)
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyTargets.value[targetUserId] = false
    }
  }

  const unblockUser = async (targetUserId: string): Promise<CommunityBlockResult> => {
    requireUserId()
    busyTargets.value[targetUserId] = true
    error.value = null
    try {
      const { data, error: err } = await supabase.rpc('unblock_community_user', {
        p_target_user_id: targetUserId,
      })
      if (err) throw err
      const result = data as CommunityBlockResult
      invalidateGraphSurfaces(targetUserId)
      await fetchRelationshipState(targetUserId, { force: true }).catch(() => null)
      return result
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      throw err
    } finally {
      busyTargets.value[targetUserId] = false
    }
  }

  const fetchBlockedUsers = async (
    cursor: string | null = null,
  ): Promise<CommunityCursorPage<CommunityBlockedUser>> => {
    const uid = requireUserId()
    const key = cacheKeys.communityBlocked(uid)
    const append = !!cursor
    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('list_my_blocked_users', {
        p_limit: DEFAULT_PAGE_SIZE,
        p_cursor: cursor,
      })
      if (err) throw err
      const incoming = (data as CommunityCursorPage<CommunityBlockedUser>) ?? emptyPage()
      blockedPage.value = mergePage(blockedPage.value, incoming, append)
    }

    const cacheState = append ? 'loading' : swrStatus(key, TTL)
    if (!append && cacheState === 'fresh') return blockedPage.value

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, fetcher)
      status.value = 'idle'
      return blockedPage.value
    } catch (err) {
      error.value = rpcErrorMessage(err as { message?: string; details?: string })
      status.value = 'error'
      return blockedPage.value
    }
  }

  const canInteract = async (targetUserId: string): Promise<CommunityInteractionResult | null> => {
    requireUserId()
    const { data, error: err } = await supabase.rpc('can_community_users_interact', {
      p_target_user_id: targetUserId,
    })
    if (err) {
      error.value = rpcErrorMessage(err)
      return null
    }
    return data as CommunityInteractionResult | null
  }

  return {
    relationships,
    searchPages,
    followersPages,
    followingPages,
    blockedPage,
    status,
    error,
    isBusy,
    fetchRelationshipState,
    followUser,
    unfollowUser,
    searchReaders,
    fetchFollowers,
    fetchFollowing,
    blockUser,
    unblockUser,
    fetchBlockedUsers,
    canInteract,
  }
})
