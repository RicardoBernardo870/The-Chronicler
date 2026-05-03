<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import { useAlsoReading } from '@/composables/useAlsoReading'
import type { AlsoReadingItem, AlsoReadingRelativeStatus } from '@/types'

const props = defineProps<{
  visible: boolean
  bookId: string
  isbn: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()
const alsoReading = useAlsoReading(() => props.bookId)
const actionError = ref<string | null>(null)

const hasMore = computed(() => alsoReading.hasMore.value)

const relativeLabel = (status: AlsoReadingRelativeStatus): string | null => {
  if (status === 'same_area') return 'same area'
  return status
}

const progressLabel = (reader: AlsoReadingItem): string => {
  if (reader.currentPage && reader.totalPages) return `p. ${reader.currentPage} of ${reader.totalPages}`
  return 'Progress private'
}

const matchLabel = (reader: AlsoReadingItem): string => (
  reader.matchType === 'same_isbn' ? 'same work' : 'same book'
)

const load = async (cursor: string | null = null) => {
  if (!props.bookId) return
  actionError.value = null
  const page = await alsoReading.fetchForBook(props.bookId, props.isbn, { cursor })
  if (!page.items.length && alsoReading.error.value) actionError.value = alsoReading.error.value
}

const openProfile = (username: string) => {
  emit('update:visible', false)
  void router.push({ name: 'public-profile', params: { username } })
}

watch(
  () => props.visible,
  visible => {
    if (visible) void load()
  },
)
</script>

<template>
  <Dialog
    :visible="visible"
    header="Also reading"
    modal
    class="also-reading-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="also-reading-dialog__body">
      <Message v-if="actionError" severity="error" class="also-reading-dialog__message">
        {{ actionError }}
      </Message>

      <div v-if="alsoReading.loading.value && !alsoReading.hasItems.value" class="also-reading-dialog__list">
        <div v-for="n in 4" :key="n" class="also-reading-dialog__row">
          <Skeleton shape="circle" size="2.5rem" />
          <div class="also-reading-dialog__copy">
            <Skeleton height="1rem" width="55%" />
            <Skeleton height="0.75rem" width="40%" />
          </div>
        </div>
      </div>

      <Message v-else-if="!alsoReading.items.value.length" severity="info" class="also-reading-dialog__message">
        No visible readers to show here.
      </Message>

      <div v-else class="also-reading-dialog__list">
        <article
          v-for="reader in alsoReading.items.value"
          :key="reader.userId"
          class="also-reading-dialog__row"
        >
          <Avatar
            :image="reader.avatarUrl || undefined"
            :label="reader.avatarUrl ? undefined : reader.username.slice(0, 1).toUpperCase()"
            shape="circle"
            size="large"
          />

          <button
            type="button"
            class="also-reading-dialog__identity"
            :aria-label="`View ${reader.displayName || reader.username}'s public profile`"
            @click="openProfile(reader.username)"
          >
            <strong>{{ reader.displayName || reader.username }}</strong>
            <span>@{{ reader.username }}</span>
          </button>

          <div class="also-reading-dialog__meta">
            <span>{{ progressLabel(reader) }}</span>
            <Tag
              v-if="relativeLabel(reader.relativeStatus)"
              :value="relativeLabel(reader.relativeStatus) ?? undefined"
              severity="secondary"
              rounded
            />
            <Tag v-else :value="matchLabel(reader)" severity="secondary" rounded />
          </div>
        </article>

        <Button
          v-if="hasMore"
          label="Load more"
          icon="pi pi-angle-down"
          text
          :loading="alsoReading.loading.value"
          @click="load(alsoReading.nextCursor.value)"
        />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.also-reading-dialog__body {
  width: min(82vw, 34rem);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.also-reading-dialog__message {
  margin: 0;
}

.also-reading-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.also-reading-dialog__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.2rem;
}

.also-reading-dialog__copy,
.also-reading-dialog__identity {
  min-width: 0;
}

.also-reading-dialog__identity {
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

.also-reading-dialog__identity strong,
.also-reading-dialog__identity span {
  overflow-wrap: anywhere;
}

.also-reading-dialog__identity span,
.also-reading-dialog__meta span {
  color: var(--p-text-muted-color);
  font-size: 0.82rem;
}

.also-reading-dialog__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  min-width: max-content;
}

@media (max-width: 460px) {
  .also-reading-dialog__row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .also-reading-dialog__meta {
    grid-column: 2;
    justify-content: flex-start;
    flex-wrap: wrap;
    min-width: 0;
  }
}
</style>
