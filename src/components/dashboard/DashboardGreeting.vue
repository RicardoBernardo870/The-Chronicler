<script setup lang="ts">
// Dashboard greeting. Three states:
//  - loading → neutral salutation + date (no flash of the setup CTA)
//  - profile configured → salutation + name, avatar on the right (→ profile)
//  - no profile yet → "Set up your reader profile" row (→ profile edit)
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { useCommunityIdentity } from '@/composables/useCommunityIdentity'
import { coverFallback } from '@/utils/coverFallback'

const router = useRouter()
const { readerName, avatarUrl, initials, hasProfile, identityLoaded, fetchIdentity } =
  useCommunityIdentity()

onMounted(() => void fetchIdentity())

const salutation = computed(() => {
  const hour = new Date().getHours()
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

const dateLine = computed(() => format(new Date(), 'EEEE, MMMM d'))

const openProfile = () => router.push({ name: 'profile' })
const openProfileSetup = () => router.push({ name: 'profile-edit' })
</script>

<template>
  <!-- Profile not configured: setup call-to-action -->
  <button
    v-if="identityLoaded && !hasProfile"
    type="button"
    class="dashboard-greeting dashboard-greeting--setup"
    @click="openProfileSetup"
  >
    <span class="dashboard-greeting__setup-avatar" aria-hidden="true">
      <i class="pi pi-user" />
    </span>
    <span class="dashboard-greeting__setup-meta">
      <span class="dashboard-greeting__setup-title">Set up your reader profile</span>
      <span class="dashboard-greeting__setup-sub">Pick a username and an avatar</span>
    </span>
    <i class="pi pi-arrow-right dashboard-greeting__setup-arrow" aria-hidden="true" />
  </button>

  <!-- Configured (or still loading: name falls back gracefully, no avatar yet) -->
  <header v-else class="dashboard-greeting">
    <div class="dashboard-greeting__meta">
      <h1 class="dashboard-greeting__title">
        {{ salutation }}{{ identityLoaded ? `, ${readerName}` : '' }}
      </h1>
      <p class="dashboard-greeting__date">{{ dateLine }}</p>
    </div>
    <button
      v-if="identityLoaded"
      type="button"
      class="dashboard-greeting__avatar"
      aria-label="Open your profile"
      @click="openProfile"
    >
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        alt=""
        class="dashboard-greeting__avatar-img"
        @error="coverFallback"
      />
      <span class="dashboard-greeting__avatar-initials">{{ initials }}</span>
    </button>
  </header>
</template>

<style scoped>
.dashboard-greeting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.dashboard-greeting__meta {
  min-width: 0;
}

.dashboard-greeting__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  font-family: var(--p-font-family-sans);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-greeting__date {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  opacity: 0.55;
}

.dashboard-greeting__avatar {
  position: relative;
  flex: none;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 50%;
  background: color-mix(in srgb, var(--p-primary-color) 30%, var(--p-content-background));
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.dashboard-greeting__avatar:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.dashboard-greeting__avatar-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dashboard-greeting__avatar-initials {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* ── Setup CTA state ─────────────────────────────────────────────────────── */

.dashboard-greeting--setup {
  width: 100%;
  margin: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(99, 102, 241, 0.26);
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dashboard-greeting--setup:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.dashboard-greeting__setup-avatar {
  flex: none;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  font-size: 1rem;
}

.dashboard-greeting__setup-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.dashboard-greeting__setup-title {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.dashboard-greeting__setup-sub {
  font-size: 0.78rem;
  opacity: 0.6;
}

.dashboard-greeting__setup-arrow {
  flex: none;
  color: var(--p-indigo-300);
  font-size: 0.9rem;
}

:root[data-p-theme="light"] .dashboard-greeting__setup-avatar {
  background: rgba(99, 102, 241, 0.12);
  color: var(--p-indigo-600);
}

:root[data-p-theme="light"] .dashboard-greeting__setup-arrow {
  color: var(--p-indigo-600);
}
</style>
