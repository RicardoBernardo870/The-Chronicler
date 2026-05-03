<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { useCommunityGraph } from '@/composables/useCommunityGraph'

const graph = useCommunityGraph()
const toast = useToast()
const loading = ref(true)
const actionError = ref<string | null>(null)

const load = async (cursor: string | null = null) => {
  loading.value = true
  actionError.value = null
  try {
    await graph.fetchBlockedUsers(cursor)
  } catch {
    actionError.value = 'Could not load blocked readers.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })

const unblock = async (userId: string) => {
  actionError.value = null
  try {
    await graph.unblockUser(userId)
    await load()
    toast.add({
      severity: 'success',
      summary: 'Reader unblocked',
      life: 2400,
    })
  } catch {
    actionError.value = 'Could not unblock this reader.'
  }
}
</script>

<template>
  <section class="blocked-users-panel glass-surface">
    <header class="blocked-users-panel__header">
      <div>
        <h2>Blocked readers</h2>
        <p>Manage readers hidden from your community surfaces.</p>
      </div>
      <Button
        icon="pi pi-refresh"
        text
        rounded
        aria-label="Refresh blocked readers"
        :loading="loading"
        @click="load()"
      />
    </header>

    <Message v-if="actionError" severity="error" class="blocked-users-panel__message">
      {{ actionError }}
    </Message>

    <div v-if="loading && !graph.blockedPage.value.items.length" class="blocked-users-panel__list">
      <div v-for="n in 2" :key="n" class="blocked-users-panel__row">
        <Skeleton shape="circle" size="2.5rem" />
        <div class="blocked-users-panel__copy">
          <Skeleton height="1rem" width="50%" />
          <Skeleton height="0.75rem" width="35%" />
        </div>
      </div>
    </div>

    <Message
      v-else-if="!graph.blockedPage.value.items.length"
      severity="info"
      class="blocked-users-panel__message"
    >
      You have not blocked anyone.
    </Message>

    <div v-else class="blocked-users-panel__list">
      <div
        v-for="reader in graph.blockedPage.value.items"
        :key="reader.userId"
        class="blocked-users-panel__row"
      >
        <Avatar
          :image="reader.avatarUrl || undefined"
          :label="reader.avatarUrl ? undefined : (reader.username || '?').slice(0, 1).toUpperCase()"
          shape="circle"
          size="large"
        />
        <div class="blocked-users-panel__identity">
          <strong>{{ reader.displayName || reader.username || 'Deleted profile' }}</strong>
          <span v-if="reader.username">@{{ reader.username }}</span>
        </div>
        <Button
          label="Unblock"
          icon="pi pi-unlock"
          text
          :loading="graph.isBusy(reader.userId)"
          @click="unblock(reader.userId)"
        />
      </div>

      <Button
        v-if="graph.blockedPage.value.nextCursor"
        label="Load more"
        icon="pi pi-angle-down"
        text
        :loading="loading"
        @click="load(graph.blockedPage.value.nextCursor)"
      />
    </div>
  </section>
</template>

<style scoped>
.blocked-users-panel {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.blocked-users-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.blocked-users-panel__header h2,
.blocked-users-panel__header p {
  margin: 0;
}

.blocked-users-panel__header h2 {
  font-size: 1rem;
}

.blocked-users-panel__header p {
  margin-top: 0.15rem;
  font-size: 0.84rem;
  opacity: 0.66;
}

.blocked-users-panel__message {
  margin: 0;
}

.blocked-users-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.blocked-users-panel__row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 3.25rem;
}

.blocked-users-panel__copy,
.blocked-users-panel__identity {
  min-width: 0;
  flex: 1 1 auto;
}

.blocked-users-panel__identity {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.blocked-users-panel__identity strong,
.blocked-users-panel__identity span {
  overflow-wrap: anywhere;
}

.blocked-users-panel__identity span {
  font-size: 0.82rem;
  opacity: 0.66;
}
</style>
