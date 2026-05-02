<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import PublicProfileCard from '@/components/community/PublicProfileCard.vue'
import { useCommunityProfileStore } from '@/stores/communityProfile'

const route = useRoute()
const router = useRouter()
const store = useCommunityProfileStore()

const username = computed(() => String(route.params.username ?? '').trim().toLowerCase())
const profile = computed(() => store.publicProfiles[username.value] ?? null)
const loading = computed(() => store.publicStatus === 'loading')

const load = () => store.fetchPublicProfileByUsername(username.value, { force: true })

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

    <PublicProfileCard v-else-if="profile" :profile="profile" />

    <Message v-else severity="info" class="public-profile-page__unavailable">
      This reader profile is unavailable.
    </Message>
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
</style>
