<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import FollowButton from '@/components/community/FollowButton.vue'
import { useCommunityGraph } from '@/composables/useCommunityGraph'
import type { CommunityFollowListMode } from '@/stores/communityGraph'

const props = defineProps<{
  visible: boolean
  userId: string
  initialMode: CommunityFollowListMode
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()
const graph = useCommunityGraph()
const mode = ref<CommunityFollowListMode>(props.initialMode)
const loading = ref(false)
const actionError = ref<string | null>(null)

const title = computed(() => mode.value === 'followers' ? 'Followers' : 'Following')
const page = computed(() => graph.followListFor(mode.value, props.userId).value)

const load = async (cursor: string | null = null) => {
  if (!props.userId) return
  loading.value = true
  actionError.value = null
  try {
    if (mode.value === 'followers') await graph.fetchFollowers(props.userId, cursor)
    else await graph.fetchFollowing(props.userId, cursor)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.initialMode,
  value => { mode.value = value },
)

watch(
  () => props.visible,
  visible => {
    if (visible) void load()
  },
)

watch(mode, () => {
  if (props.visible) void load()
})

const openProfile = (username: string) => {
  emit('update:visible', false)
  void router.push({ name: 'public-profile', params: { username } })
}

const follow = async (userId: string) => {
  actionError.value = null
  try {
    await graph.followUser(userId)
    await load()
  } catch {
    actionError.value = 'Could not follow this reader.'
  }
}

const unfollow = async (userId: string) => {
  actionError.value = null
  try {
    await graph.unfollowUser(userId)
    await load()
  } catch {
    actionError.value = 'Could not update this follow.'
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="title"
    modal
    class="follow-list-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="follow-list-dialog__body">
      <div class="follow-list-dialog__switch" aria-label="Follow list">
        <Button
          label="Followers"
          size="small"
          :outlined="mode !== 'followers'"
          @click="mode = 'followers'"
        />
        <Button
          label="Following"
          size="small"
          :outlined="mode !== 'following'"
          @click="mode = 'following'"
        />
      </div>

      <Message v-if="actionError" severity="error" class="follow-list-dialog__message">
        {{ actionError }}
      </Message>

      <div v-if="loading && !page.items.length" class="follow-list-dialog__list">
        <div v-for="n in 3" :key="n" class="follow-list-dialog__row">
          <Skeleton shape="circle" size="2.5rem" />
          <div class="follow-list-dialog__copy">
            <Skeleton height="1rem" width="50%" />
            <Skeleton height="0.75rem" width="35%" />
          </div>
        </div>
      </div>

      <Message v-else-if="!page.items.length" severity="info" class="follow-list-dialog__message">
        No readers to show here yet.
      </Message>

      <div v-else class="follow-list-dialog__list">
        <div
          v-for="reader in page.items"
          :key="reader.userId"
          class="follow-list-dialog__row"
        >
          <Avatar
            :image="reader.avatarUrl || undefined"
            :label="reader.avatarUrl ? undefined : reader.username.slice(0, 1).toUpperCase()"
            shape="circle"
            size="large"
          />

          <button
            type="button"
            class="follow-list-dialog__identity"
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
          :loading="loading"
          @click="load(page.nextCursor)"
        />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>

.follow-list-dialog__body {
  width: min(80vw, 32rem);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;

}

.follow-list-dialog__switch {
  display: flex;
  gap: 0.5rem;
}

.follow-list-dialog__message {
  margin: 0;
}

.follow-list-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.follow-list-dialog__row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.25rem;
}

.follow-list-dialog__copy,
.follow-list-dialog__identity {
  min-width: 0;
  flex: 1 1 auto;
}

.follow-list-dialog__identity {
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

.follow-list-dialog__identity strong,
.follow-list-dialog__identity span {
  overflow-wrap: anywhere;
}

.follow-list-dialog__identity span {
  font-size: 0.82rem;
  opacity: 0.66;
}
</style>
