import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  type CommunityFollowListMode,
  useCommunityGraphStore,
} from '@/stores/communityGraph'
import type { CommunityRelationshipState } from '@/types'

const canShowFollowAction = (state: CommunityRelationshipState | null | undefined): boolean => (
  !!state && state.reason === 'allowed'
)

const canShowUnavailableState = (state: CommunityRelationshipState | null | undefined): boolean => (
  !!state && (state.reason === 'blocked' || state.reason === 'profile_unavailable')
)

const followLabel = (state: CommunityRelationshipState | null | undefined): string => {
  if (!state) return 'Follow'
  if (state.isFollowing) return 'Following'
  return state.followsViewer ? 'Follow back' : 'Follow'
}

export const useCommunityGraph = () => {
  const store = useCommunityGraphStore()
  const {
    relationships,
    searchPages,
    followersPages,
    followingPages,
    blockedPage,
    status,
    error,
  } = storeToRefs(store)

  const loading = computed(() => status.value === 'loading')
  const saving = computed(() => status.value === 'saving')

  const relationshipFor = (targetUserId: string) => computed(() => (
    relationships.value[targetUserId] ?? null
  ))

  const followListFor = (mode: CommunityFollowListMode, userId: string) => computed(() => (
    mode === 'followers'
      ? followersPages.value[userId] ?? { items: [], nextCursor: null }
      : followingPages.value[userId] ?? { items: [], nextCursor: null }
  ))

  return {
    relationships,
    searchPages,
    followersPages,
    followingPages,
    blockedPage,
    status,
    error,
    loading,
    saving,
    relationshipFor,
    followListFor,
    canShowFollowAction,
    canShowUnavailableState,
    followLabel,
    fetchRelationshipState: store.fetchRelationshipState,
    followUser: store.followUser,
    unfollowUser: store.unfollowUser,
    searchReaders: store.searchReaders,
    fetchFollowers: store.fetchFollowers,
    fetchFollowing: store.fetchFollowing,
    blockUser: store.blockUser,
    unblockUser: store.unblockUser,
    fetchBlockedUsers: store.fetchBlockedUsers,
    canInteract: store.canInteract,
    isBusy: store.isBusy,
  }
}
