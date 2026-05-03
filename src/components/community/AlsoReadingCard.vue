<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import AlsoReadingListDialog from '@/components/community/AlsoReadingListDialog.vue'
import { useAlsoReading } from '@/composables/useAlsoReading'
import type { AlsoReadingItem, AlsoReadingRelativeStatus } from '@/types'

const props = defineProps<{
  bookId: string
  isbn: string | null
  viewerProgressPercentage: number | null
}>()

const router = useRouter()
const dialogVisible = ref(false)
const alsoReading = useAlsoReading(() => props.bookId)

const visibleItems = computed(() => alsoReading.items.value.slice(0, 3))
const shouldRender = computed(() => alsoReading.loading.value || alsoReading.hasItems.value)
const summary = computed(() => {
  const count = alsoReading.totalVisible.value
  if (count <= 1) return '1 person you follow is here too.'
  return `${count} people you follow are here too.`
})

const relativeLabel = (status: AlsoReadingRelativeStatus): string | null => {
  if (status === 'same_area') return 'same area'
  return status
}

const progressLabel = (reader: AlsoReadingItem): string => {
  if (reader.currentPage && reader.totalPages) return `p. ${reader.currentPage}`
  return 'Progress private'
}

const matchLabel = (reader: AlsoReadingItem): string => (
  reader.matchType === 'same_isbn' ? 'same work' : 'same book'
)

const openProfile = (username: string) => {
  void router.push({ name: 'public-profile', params: { username } })
}

const load = async (force = false) => {
  if (!props.bookId) return
  await alsoReading.fetchForBook(props.bookId, props.isbn, { force })
}

watch(
  () => [props.bookId, props.isbn] as const,
  () => { void load(false) },
  { immediate: true },
)

watch(
  () => props.viewerProgressPercentage,
  () => { void load(true) },
)
</script>

<template>
  <section v-if="shouldRender" class="also-reading-card glass-surface" aria-labelledby="also-reading-title">
    <header class="also-reading-card__header">
      <div>
        <h2 id="also-reading-title">Also reading</h2>
        <p v-if="alsoReading.hasItems.value">{{ summary }}</p>
      </div>
      <Button
        v-if="alsoReading.hasMore.value"
        label="View more"
        icon="pi pi-users"
        text
        size="small"
        @click="dialogVisible = true"
      />
    </header>

    <div v-if="alsoReading.loading.value && !alsoReading.hasItems.value" class="also-reading-card__list">
      <div v-for="n in 3" :key="n" class="also-reading-card__row">
        <Skeleton shape="circle" size="2.5rem" />
        <div class="also-reading-card__copy">
          <Skeleton height="1rem" width="55%" />
          <Skeleton height="0.75rem" width="40%" />
        </div>
      </div>
    </div>

    <div v-else class="also-reading-card__list">
      <article
        v-for="reader in visibleItems"
        :key="reader.userId"
        class="also-reading-card__row"
      >
        <Avatar
          :image="reader.avatarUrl || undefined"
          :label="reader.avatarUrl ? undefined : reader.username.slice(0, 1).toUpperCase()"
          shape="circle"
          size="large"
        />

        <button
          type="button"
          class="also-reading-card__identity"
          :aria-label="`View ${reader.displayName || reader.username}'s public profile`"
          @click="openProfile(reader.username)"
        >
          <strong>{{ reader.displayName || reader.username }}</strong>
          <span>@{{ reader.username }}</span>
        </button>

        <div class="also-reading-card__meta">
          <span>{{ progressLabel(reader) }}</span>
          <Tag
            v-if="relativeLabel(reader.relativeStatus)"
            :value="relativeLabel(reader.relativeStatus) ?? undefined"
            severity="secondary"
            rounded
          />
          <Tag
            v-else
            :value="matchLabel(reader)"
            severity="secondary"
            rounded
          />
        </div>
      </article>
    </div>

    <AlsoReadingListDialog
      v-model:visible="dialogVisible"
      :book-id="bookId"
      :isbn="isbn"
    />
  </section>
</template>

<style scoped>
.also-reading-card {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.also-reading-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.also-reading-card__header h2,
.also-reading-card__header p {
  margin: 0;
}

.also-reading-card__header h2 {
  font-size: 1rem;
  font-weight: 700;
}

.also-reading-card__header p {
  margin-top: 0.15rem;
  color: var(--p-text-muted-color);
  font-size: 0.84rem;
}

.also-reading-card__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.also-reading-card__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  min-height: 3rem;
}

.also-reading-card__copy,
.also-reading-card__identity {
  min-width: 0;
}

.also-reading-card__identity {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  cursor: pointer;
}

.also-reading-card__identity strong,
.also-reading-card__identity span {
  overflow-wrap: anywhere;
}

.also-reading-card__identity span,
.also-reading-card__meta span {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.also-reading-card__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  min-width: max-content;
}

@media (max-width: 420px) {
  .also-reading-card__row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .also-reading-card__meta {
    grid-column: 2;
    justify-content: flex-start;
    flex-wrap: wrap;
    min-width: 0;
  }
}
</style>
