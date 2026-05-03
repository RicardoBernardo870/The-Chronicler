<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import CircleReactionComposer from '@/components/community/CircleReactionComposer.vue'
import CircleReactionList from '@/components/community/CircleReactionList.vue'
import ReadingCircleInviteDialog from '@/components/community/ReadingCircleInviteDialog.vue'
import { useReadingCirclesStore } from '@/stores/readingCircles'

const props = defineProps<{
  circleId: string | null
  bookId: string
}>()

const visible = defineModel<boolean>('visible', { required: true })
const inviteVisible = defineModel<boolean>('inviteVisible', { default: false })

const circlesStore = useReadingCirclesStore()

const detail = computed(() => props.circleId ? circlesStore.details[props.circleId] ?? null : null)
const reactionPage = computed(() => props.circleId ? circlesStore.reactionPages[props.circleId] ?? { items: [], nextCursor: null } : { items: [], nextCursor: null })
const isOwner = computed(() => detail.value?.viewer.role === 'owner')
const isBusy = computed(() => props.circleId ? !!circlesStore.busyCircleIds[props.circleId] : false)
const viewerProgress = computed(() => detail.value?.viewer ?? null)

watch(
  () => [visible.value, props.circleId] as const,
  ([isVisible, circleId], previous) => {
    const previousCircleId = previous?.[1]
    if (previousCircleId && previousCircleId !== circleId) circlesStore.unsubscribeFromCircle(previousCircleId)
    if (!isVisible || !circleId) return
    void circlesStore.fetchDetail(circleId, { force: true })
    void circlesStore.fetchReactions(circleId, { force: true })
    circlesStore.subscribeToCircle(circleId)
  },
  { immediate: true },
)

watch(
  () => visible.value,
  isVisible => {
    if (!isVisible && props.circleId) circlesStore.unsubscribeFromCircle(props.circleId)
  },
)

onBeforeUnmount(() => {
  if (props.circleId) circlesStore.unsubscribeFromCircle(props.circleId)
})

const addReaction = async (page: number, content: string) => {
  if (!props.circleId) return
  await circlesStore.addReaction(props.circleId, props.bookId, page, content)
}

const leave = async () => {
  if (!props.circleId) return
  await circlesStore.leaveCircle(props.circleId, props.bookId)
  visible.value = false
}

const removeMember = async (userId: string) => {
  if (!props.circleId) return
  await circlesStore.removeMember(props.circleId, userId)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="detail?.name || 'Reading Circle'"
    :style="{ width: 'min(94vw, 40rem)' }"
  >
    <div v-if="detail" class="reading-circle-dialog">
      <header class="reading-circle-dialog__book">
        <div>
          <p>{{ detail.book.title }}</p>
          <span>{{ detail.book.author }}</span>
        </div>
        <Tag :value="detail.viewer.role" severity="secondary" rounded />
      </header>

      <section class="reading-circle-dialog__section">
        <div class="reading-circle-dialog__section-header">
          <h3>Members</h3>
          <Button
            v-if="isOwner"
            label="Invite"
            icon="pi pi-user-plus"
            text
            size="small"
            @click="inviteVisible = true"
          />
        </div>

        <div class="reading-circle-dialog__members">
          <article
            v-for="member in detail.members"
            :key="member.userId"
            class="reading-circle-dialog__member"
          >
            <Avatar
              :image="member.avatarUrl || undefined"
              :label="member.avatarUrl ? undefined : member.username.slice(0, 1).toUpperCase()"
              shape="circle"
              size="normal"
              
            />
            <div>
              <strong>{{ member.displayName || member.username }}</strong>
              <span>@{{ member.username }}</span>
            </div>
            <Tag v-if="member.role === 'owner'" value="owner" severity="secondary" rounded />
            <Button
              v-else-if="isOwner"
              icon="pi pi-user-minus"
              text
              rounded
              severity="secondary"
              :loading="isBusy"
              :aria-label="`Remove ${member.displayName || member.username}`"
              @click="removeMember(member.userId)"
            />
          </article>
        </div>
      </section>

      <section v-if="isOwner && detail.pendingInvitations.length" class="reading-circle-dialog__section">
        <h3>Pending</h3>
        <div class="reading-circle-dialog__members">
          <article
            v-for="invite in detail.pendingInvitations"
            :key="invite.invitationId"
            class="reading-circle-dialog__member"
          >
            <Avatar
              :image="invite.avatarUrl || undefined"
              :label="invite.avatarUrl ? undefined : invite.username.slice(0, 1).toUpperCase()"
              shape="circle"
            />
            <div>
              <strong>{{ invite.displayName || invite.username }}</strong>
              <span>@{{ invite.username }}</span>
            </div>
            <Button
              icon="pi pi-times"
              text
              rounded
              severity="secondary"
              :aria-label="`Revoke invite for ${invite.displayName || invite.username}`"
              @click="removeMember(invite.userId)"
            />
          </article>
        </div>
      </section>

      <section class="reading-circle-dialog__section">
        <h3>Reactions</h3>
        <Message v-if="reactionPage.viewerProgressMissing" severity="secondary" size="small">
          Set a valid current page for this book to see page-gated reactions.
        </Message>
        <CircleReactionList :reactions="reactionPage.items" :loading="circlesStore.status === 'loading'" />
      </section>

      <section class="reading-circle-dialog__section">
        <CircleReactionComposer
          :current-page="viewerProgress?.currentPage ?? null"
          :total-pages="viewerProgress?.totalPages ?? null"
          :saving="isBusy"
          @submit="addReaction"
        />
      </section>

      <div class="reading-circle-dialog__footer">
        <Button
          label="Leave"
          icon="pi pi-sign-out"
          severity="secondary"
          text
          :loading="isBusy"
          @click="leave"
        />
        <Button label="Close" text @click="visible = false" />
      </div>

      <ReadingCircleInviteDialog
        v-if="circleId"
        v-model:visible="inviteVisible"
        :book-id="bookId"
        :circle-id="circleId"
        mode="invite"
        @saved="() => circleId && circlesStore.fetchDetail(circleId, { force: true })"
      />
    </div>

    <Message v-else severity="secondary">
      Loading Reading Circle.
    </Message>
  </Dialog>
</template>

<style scoped>
.reading-circle-dialog,
.reading-circle-dialog__section,
.reading-circle-dialog__members {
  display: flex;
  flex-direction: column;
}

.reading-circle-dialog {
  gap: 1rem;
}

.reading-circle-dialog__book,
.reading-circle-dialog__section-header,
.reading-circle-dialog__member,
.reading-circle-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.reading-circle-dialog__book p,
.reading-circle-dialog__book span,
.reading-circle-dialog__section h3,
.reading-circle-dialog__member strong,
.reading-circle-dialog__member span {
  margin: 0;
}

.reading-circle-dialog__book span,
.reading-circle-dialog__member span {
  color: var(--p-text-muted-color);
  font-size: 0.82rem;
}

.reading-circle-dialog__section {
  gap: 0.65rem;
}

.reading-circle-dialog__section h3 {
  font-size: 0.95rem;
}

.reading-circle-dialog__members {
  gap: 0.55rem;
}

.reading-circle-dialog__member {
  min-height: 2.5rem;
}

.reading-circle-dialog__member > div {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.reading-circle-dialog__member strong,
.reading-circle-dialog__member span {
  overflow-wrap: anywhere;
}

.reading-circle-dialog__footer {
  justify-content: flex-end;
}
</style>
