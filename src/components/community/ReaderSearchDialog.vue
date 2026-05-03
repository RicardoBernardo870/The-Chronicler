<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import FollowButton from '@/components/community/FollowButton.vue'
import { useCommunityGraph } from '@/composables/useCommunityGraph'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()
const graph = useCommunityGraph()
const query = ref('')
const searching = ref(false)
const actionError = ref<string | null>(null)

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const page = computed(() => graph.searchPages.value[normalizedQuery.value] ?? { items: [], nextCursor: null })
const showEmptyPrompt = computed(() => normalizedQuery.value.length < 2)

const search = async (cursor: string | null = null) => {
  actionError.value = null
  if (showEmptyPrompt.value) return
  searching.value = true
  try {
    await graph.searchReaders(normalizedQuery.value, cursor)
  } finally {
    searching.value = false
  }
}

watchDebounced(
  normalizedQuery,
  () => { void search() },
  { debounce: 300, maxWait: 900 },
)

const openProfile = (username: string) => {
  emit('update:visible', false)
  void router.push({ name: 'public-profile', params: { username } })
}

const follow = async (userId: string) => {
  actionError.value = null
  try {
    await graph.followUser(userId)
    await search()
  } catch {
    actionError.value = 'Could not follow this reader.'
  }
}

const unfollow = async (userId: string) => {
  actionError.value = null
  try {
    await graph.unfollowUser(userId)
    await search()
  } catch {
    actionError.value = 'Could not update this follow.'
  }
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    header="Find Readers"
    class="reader-search-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="reader-search-dialog__body">
      <span class="reader-search-dialog__search p-input-icon-left">
        <i class="pi pi-search" />
        <InputText
          v-model="query"
          placeholder="Search username or display name"
          autocomplete="off"
        />
      </span>

      <Message v-if="actionError" severity="error" class="reader-search-dialog__message">
        {{ actionError }}
      </Message>

      <p v-if="showEmptyPrompt" class="reader-search-dialog__hint">
        Search by username or display name.
      </p>

      <div v-else-if="searching && !page.items.length" class="reader-search-dialog__list">
        <div v-for="n in 3" :key="n" class="reader-search-dialog__row">
          <Skeleton shape="circle" size="2.5rem" />
          <div class="reader-search-dialog__copy">
            <Skeleton height="1rem" width="50%" />
            <Skeleton height="0.75rem" width="35%" />
          </div>
        </div>
      </div>

      <Message v-else-if="!page.items.length" severity="info" class="reader-search-dialog__message">
        No matching readers yet.
      </Message>

      <div v-else class="reader-search-dialog__list">
        <div
          v-for="reader in page.items"
          :key="reader.userId"
          class="reader-search-dialog__row"
        >
          <Avatar
            :image="reader.avatarUrl || undefined"
            :label="reader.avatarUrl ? undefined : reader.username.slice(0, 1).toUpperCase()"
            shape="circle"
            size="large"
          />

          <button
            type="button"
            class="reader-search-dialog__identity"
            @click="openProfile(reader.username)"
          >
            <strong>{{ reader.displayName || reader.username }}</strong>
            <span>@{{ reader.username }}</span>
          </button>

          <FollowButton
            :relationship="graph.relationships.value[reader.userId] ?? null"
            :loading="graph.isBusy(reader.userId)"
            @follow="follow(reader.userId)"
            @unfollow="unfollow(reader.userId)"
          />
        </div>

        <Button
          v-if="page.nextCursor"
          label="Load more"
          icon="pi pi-angle-down"
          text
          :loading="searching"
          @click="search(page.nextCursor)"
        />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.reader-search-dialog__body {
  width: min(92vw, 34rem);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.reader-search-dialog__search :deep(.p-inputtext) {
  width: 100%;
}

.reader-search-dialog__message {
  margin: 0;
}

.reader-search-dialog__hint {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.68;
}

.reader-search-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.reader-search-dialog__row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.25rem;
}

.reader-search-dialog__copy,
.reader-search-dialog__identity {
  min-width: 0;
  flex: 1 1 auto;
}

.reader-search-dialog__identity {
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

.reader-search-dialog__identity strong,
.reader-search-dialog__identity span {
  overflow-wrap: anywhere;
}

.reader-search-dialog__identity span {
  font-size: 0.82rem;
  opacity: 0.66;
}
</style>
