import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useReadingCirclesStore } from '@/stores/readingCircles'

export const useReadingCircles = (bookId: () => string) => {
  const store = useReadingCirclesStore()
  const { listPages, details, reactionPages, status, error, busyCircleIds } = storeToRefs(store)

  const page = computed(() => listPages.value[bookId()] ?? { items: [], nextCursor: null })
  const items = computed(() => page.value.items)
  const circles = computed(() => items.value.filter(item => item.type === 'circle'))
  const invitations = computed(() => items.value.filter(item => item.type === 'invitation'))
  const hasItems = computed(() => items.value.length > 0)
  const loading = computed(() => status.value === 'loading')
  const saving = computed(() => status.value === 'saving')

  return {
    page,
    items,
    circles,
    invitations,
    hasItems,
    loading,
    saving,
    status,
    error,
    details,
    reactionPages,
    busyCircleIds,
    fetchForBook: store.fetchForBook,
    fetchDetail: store.fetchDetail,
    fetchReactions: store.fetchReactions,
    createCircle: store.createCircle,
    inviteMembers: store.inviteMembers,
    respondToInvitation: store.respondToInvitation,
    addReaction: store.addReaction,
    leaveCircle: store.leaveCircle,
    removeMember: store.removeMember,
    subscribeToCircle: store.subscribeToCircle,
    unsubscribeFromCircle: store.unsubscribeFromCircle,
    hasCurrentPageIndicator: store.hasCurrentPageIndicator,
  }
}
