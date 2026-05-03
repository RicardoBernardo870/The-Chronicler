<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ReadingCircleDialog from '@/components/community/ReadingCircleDialog.vue'
import ReadingCircleInviteDialog from '@/components/community/ReadingCircleInviteDialog.vue'
import { useReadingCircles } from '@/composables/useReadingCircles'

const props = defineProps<{
  bookId: string
  currentPage: number | null
  progressPercentage: number | null
}>()

const circles = useReadingCircles(() => props.bookId)
const createVisible = ref(false)
const detailVisible = ref(false)
const inviteVisible = ref(false)
const selectedCircleId = ref<string | null>(null)

const circleItems = computed(() => circles.circles.value)
const invitationItems = computed(() => circles.invitations.value)
const shouldRender = computed(() => circles.loading.value || circles.hasItems.value)

const openCircle = async (circleId: string) => {
  selectedCircleId.value = circleId
  detailVisible.value = true
  await circles.fetchDetail(circleId, { force: true })
  await circles.fetchReactions(circleId, { force: true })
}

const accept = async (invitationId: string) => {
  await circles.respondToInvitation(invitationId, true, props.bookId)
}

const decline = async (invitationId: string) => {
  await circles.respondToInvitation(invitationId, false, props.bookId)
}

const load = async (force = false) => {
  if (!props.bookId) return
  await circles.fetchForBook(props.bookId, { force })
}

watch(
  () => props.bookId,
  () => { void load(false) },
  { immediate: true },
)

watch(
  () => props.progressPercentage,
  () => {
    if (selectedCircleId.value && detailVisible.value) {
      void circles.fetchDetail(selectedCircleId.value, { force: true })
      void circles.fetchReactions(selectedCircleId.value, { force: true })
    }
  },
)
</script>

<template>
  <section v-if="shouldRender" class="reading-circles-panel glass-surface" aria-labelledby="reading-circles-title">
    <header class="reading-circles-panel__header">
      <div>
        <h2 id="reading-circles-title">Reading Circles</h2>
        <p>Small, spoiler-safe rooms for this book.</p>
      </div>
      <Button
        icon="pi pi-plus"
        label="Create"
        size="small"
        @click="createVisible = true"
      />
    </header>

    <div v-if="circles.loading.value && !circles.hasItems.value" class="reading-circles-panel__list">
      <Skeleton v-for="n in 2" :key="n" height="2.75rem" border-radius="12px" />
    </div>

    <div v-else class="reading-circles-panel__list">
      <article
        v-for="item in invitationItems"
        :key="item.invitationId"
        class="reading-circles-panel__row"
      >
        <div class="reading-circles-panel__copy">
          <strong>{{ item.circle.name }}</strong>
          <span>Invitation from {{ item.invitedBy.displayName || item.invitedBy.username }}</span>
        </div>
        <div class="reading-circles-panel__actions">
          <Button icon="pi pi-check" rounded size="small" :aria-label="`Accept ${item.circle.name}`" @click="accept(item.invitationId)" />
          <Button icon="pi pi-times" rounded text size="small" severity="secondary" :aria-label="`Decline ${item.circle.name}`" @click="decline(item.invitationId)" />
        </div>
      </article>

      <article
        v-for="item in circleItems"
        :key="item.circle.circleId"
        class="reading-circles-panel__row"
      >
        <button
          type="button"
          class="reading-circles-panel__identity"
          @click="openCircle(item.circle.circleId)"
        >
          <strong>{{ item.circle.name }}</strong>
          <span>{{ item.circle.memberCount }} members</span>
        </button>
        <div class="reading-circles-panel__actions">
          <Tag v-if="item.viewerRole === 'owner'" value="owner" severity="secondary" rounded />
          <Tag
            v-if="circles.hasCurrentPageIndicator(item.circle.circleId, progressPercentage)"
            value="here"
            icon="pi pi-comment"
            severity="info"
            rounded
          />
        </div>
      </article>
    </div>

    <ReadingCircleInviteDialog
      v-model:visible="createVisible"
      :book-id="bookId"
      mode="create"
      @saved="() => load(true)"
    />

    <ReadingCircleDialog
      v-model:visible="detailVisible"
      v-model:invite-visible="inviteVisible"
      :circle-id="selectedCircleId"
      :book-id="bookId"
    />
  </section>

  <Button
    v-else
    class="reading-circles-panel__create"
    label="Create Reading Circle"
    icon="pi pi-users"
    outlined
    size="small"
    @click="createVisible = true"
  />

  <ReadingCircleInviteDialog
    v-if="!shouldRender"
    v-model:visible="createVisible"
    :book-id="bookId"
    mode="create"
    @saved="() => load(true)"
  />
</template>

<style scoped>
.reading-circles-panel {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.reading-circles-panel__header,
.reading-circles-panel__row,
.reading-circles-panel__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.reading-circles-panel__header h2,
.reading-circles-panel__header p {
  margin: 0;
}

.reading-circles-panel__header h2 {
  font-size: 1rem;
}

.reading-circles-panel__header p,
.reading-circles-panel__copy span,
.reading-circles-panel__identity span {
  color: var(--p-text-muted-color);
  font-size: 0.82rem;
}

.reading-circles-panel__list,
.reading-circles-panel__copy,
.reading-circles-panel__identity {
  display: flex;
  flex-direction: column;
}

.reading-circles-panel__list {
  gap: 0.55rem;
}

.reading-circles-panel__copy,
.reading-circles-panel__identity {
  min-width: 0;
  align-items: flex-start;
  gap: 0.1rem;
}

.reading-circles-panel__identity {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.reading-circles-panel__copy strong,
.reading-circles-panel__copy span,
.reading-circles-panel__identity strong,
.reading-circles-panel__identity span {
  overflow-wrap: anywhere;
}

.reading-circles-panel__create {
  align-self: flex-start;
}

@media (max-width: 430px) {
  .reading-circles-panel__row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
