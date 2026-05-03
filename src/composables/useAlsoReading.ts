import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAlsoReadingStore } from '@/stores/alsoReading'

export const useAlsoReading = (bookId: () => string) => {
  const store = useAlsoReadingStore()
  const { pages, status, error } = storeToRefs(store)

  const page = computed(() => pages.value[bookId()] ?? { items: [], nextCursor: null, totalVisible: 0 })
  const items = computed(() => page.value.items)
  const nextCursor = computed(() => page.value.nextCursor)
  const totalVisible = computed(() => page.value.totalVisible)
  const loading = computed(() => status.value === 'loading')
  const hasItems = computed(() => items.value.length > 0)
  const hasMore = computed(() => Boolean(nextCursor.value) || totalVisible.value > items.value.length)

  return {
    page,
    items,
    nextCursor,
    totalVisible,
    status,
    error,
    loading,
    hasItems,
    hasMore,
    fetchForBook: store.fetchForBook,
    clearBook: store.clearBook,
  }
}
