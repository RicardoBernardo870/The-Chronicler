<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import FollowButton from '@/components/community/FollowButton.vue'
import FollowCounts from '@/components/community/FollowCounts.vue'
import FollowListDialog from '@/components/community/FollowListDialog.vue'
import PublicProfileCard from '@/components/community/PublicProfileCard.vue'
import { useCommunityGraph } from '@/composables/useCommunityGraph'
import type { CommunityFollowListMode } from '@/stores/communityGraph'
import { useCommunityProfileStore } from '@/stores/communityProfile'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const store = useCommunityProfileStore()
const graph = useCommunityGraph()

const username = computed(() => String(route.params.username ?? '').trim().toLowerCase())
const profile = computed(() => store.publicProfiles[username.value] ?? null)
const targetUserId = computed(() => profile.value?.profile.userId ?? '')
const relationship = computed(() => (
  targetUserId.value ? graph.relationships.value[targetUserId.value] ?? null : null
))
const loading = computed(() => store.publicStatus === 'loading')
const actionError = ref<string | null>(null)
const followListVisible = ref(false)
const followListMode = ref<CommunityFollowListMode>('followers')

const unavailable = computed(() => (
  !profile.value ||
  relationship.value?.reason === 'blocked' ||
  relationship.value?.reason === 'profile_unavailable'
))

const load = async () => {
  const loaded = await store.fetchPublicProfileByUsername(username.value, { force: true })
  const userId = loaded?.profile.userId
  if (userId) await graph.fetchRelationshipState(userId, { force: true })
}

const follow = async () => {
  if (!targetUserId.value) return
  actionError.value = null
  try {
    await graph.followUser(targetUserId.value)
  } catch {
    actionError.value = 'Could not follow this reader.'
  }
}

const unfollow = async () => {
  if (!targetUserId.value) return
  actionError.value = null
  try {
    await graph.unfollowUser(targetUserId.value)
  } catch {
    actionError.value = 'Could not update this follow.'
  }
}

const openFollowList = (mode: CommunityFollowListMode) => {
  followListMode.value = mode
  followListVisible.value = true
}

const blockReader = () => {
  if (!targetUserId.value || !profile.value) return

  confirm.require({
    message: `Block @${profile.value.profile.username}? You will stop seeing each other in community surfaces.`,
    header: 'Block reader',
    icon: 'pi pi-ban',
    acceptLabel: 'Block',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: async () => {
      actionError.value = null
      try {
        await graph.blockUser(targetUserId.value)
        toast.add({
          severity: 'success',
          summary: 'Reader blocked',
          life: 2400,
        })
        store.publicProfiles[username.value] = null
      } catch {
        actionError.value = 'Could not block this reader.'
      }
    },
  })
}

onMounted(load)
watch(username, load)
</script>

<template>
  <section class="public-profile-page">
    <header class="public-profile-page__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back"
        @click="router.back()"
      />
    </header>

    <div v-if="loading" class="public-profile-page__skeleton glass-surface">
      <Skeleton shape="circle" size="4.25rem" />
      <Skeleton height="1.2rem" width="55%" />
      <Skeleton height="4rem" width="100%" />
      <Skeleton height="7rem" width="100%" />
    </div>

    <Message v-else-if="unavailable" severity="info" class="public-profile-page__unavailable">
      This reader profile is unavailable.
    </Message>

    <template v-else-if="profile">
      <Message v-if="actionError" severity="error" class="public-profile-page__unavailable">
        {{ actionError }}
      </Message>

      <div class="public-profile-page__actions glass-surface">
        <FollowCounts
          v-if="relationship"
          :followers-count="relationship.followersCount"
          :following-count="relationship.followingCount"
          @open-followers="openFollowList('followers')"
          @open-following="openFollowList('following')"
        />

        <div class="public-profile-page__buttons">
          <FollowButton
            :relationship="relationship"
            :loading="targetUserId ? graph.isBusy(targetUserId) : false"
            @follow="follow"
            @unfollow="unfollow"
          />
          <Button
            v-if="relationship?.reason === 'allowed'"
            icon="pi pi-ban"
            text
            rounded
            severity="danger"
            aria-label="Block reader"
            :disabled="targetUserId ? graph.isBusy(targetUserId) : false"
            @click="blockReader"
          />
        </div>
      </div>

      <PublicProfileCard :profile="profile" />

      <FollowListDialog
        v-if="targetUserId"
        v-model:visible="followListVisible"
        :user-id="targetUserId"
        :initial-mode="followListMode"
      />
    </template>
  </section>
</template>

<style scoped>
.public-profile-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 1rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.public-profile-page__header {
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}

.public-profile-page__skeleton {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.public-profile-page__unavailable {
  margin: 0;
}

.public-profile-page__actions {
  padding: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.public-profile-page__buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
