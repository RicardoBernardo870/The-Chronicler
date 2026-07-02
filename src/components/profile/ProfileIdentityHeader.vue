<script setup lang="ts">
// Profile identity header: avatar wrapped in the yearly-goal progress ring,
// reader name, level badge, and goal caption. Tapping it opens the Trophy
// Room (profile stats page) where the full quest card lives.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCommunityIdentity } from '@/composables/useCommunityIdentity'
import { useReadingQuestStore } from '@/stores/readingQuest'
import { coverFallback } from '@/utils/coverFallback'

const RING_RADIUS = 33
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const router = useRouter()
const { readerName, avatarUrl, initials } = useCommunityIdentity()
const questStore = useReadingQuestStore()

const quest = computed(() => questStore.summary?.quest ?? null)
const level = computed(() => questStore.summary?.level ?? null)

const ringPercent = computed(() => {
  if (!quest.value?.targetBooks) return 0
  return Math.min(100, Math.max(0, quest.value.progressPercent))
})

const ringDash = computed(() => {
  const filled = (ringPercent.value / 100) * RING_CIRCUMFERENCE
  return `${filled} ${RING_CIRCUMFERENCE}`
})

const goalCaption = computed(() => {
  if (!quest.value?.targetBooks) return 'Set a yearly goal'
  return `${quest.value.completedBooks} of ${quest.value.targetBooks} books this year`
})

const openProfileEdit = () => router.push({ name: 'profile-edit' })
</script>

<template>
  <header
    class="identity-header"
    role="button"
    tabindex="0"
    :aria-label="`Customize your profile. ${goalCaption}`"
    @click="openProfileEdit"
    @keydown.enter="openProfileEdit"
    @keydown.space.prevent="openProfileEdit"
  >
    <div class="identity-header__ring-wrap">
      <svg
        class="identity-header__ring"
        viewBox="0 0 76 76"
        aria-hidden="true"
      >
        <circle
          class="identity-header__ring-track"
          cx="38"
          cy="38"
          :r="RING_RADIUS"
        />
        <circle
          class="identity-header__ring-progress"
          cx="38"
          cy="38"
          :r="RING_RADIUS"
          :stroke-dasharray="ringDash"
          transform="rotate(-90 38 38)"
        />
      </svg>

      <div class="identity-header__avatar">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt=""
          class="identity-header__avatar-img"
          @error="coverFallback"
        />
        <span class="identity-header__avatar-initials">{{ initials }}</span>
      </div>

      <span v-if="level" class="identity-header__level-badge">
        Lv {{ level.level }}
      </span>
    </div>

    <div class="identity-header__meta">
      <h1 class="identity-header__name">{{ readerName }}</h1>
      <p v-if="level" class="identity-header__title">{{ level.title }}</p>
      <p class="identity-header__goal">{{ goalCaption }}</p>
    </div>

    <i class="pi pi-pencil identity-header__chevron" aria-hidden="true" />
  </header>
</template>

<style scoped>
.identity-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.25rem 0.25rem 0.25rem 0;
  cursor: pointer;
  border-radius: 16px;
}

.identity-header:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 2px;
}

.identity-header__ring-wrap {
  position: relative;
  width: 76px;
  height: 76px;
  flex: none;
}

.identity-header__ring {
  width: 76px;
  height: 76px;
}

.identity-header__ring-track,
.identity-header__ring-progress {
  fill: none;
  stroke-width: 5;
}

.identity-header__ring-track {
  stroke: var(--p-content-border-color);
}

.identity-header__ring-progress {
  stroke: var(--p-primary-color);
  stroke-linecap: round;
  transition: stroke-dasharray 0.6s ease;
}

.identity-header__avatar {
  position: absolute;
  inset: 10px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, var(--p-primary-color) 30%, var(--p-content-background));
}

.identity-header__avatar-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.identity-header__avatar-initials {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.identity-header__level-badge {
  position: absolute;
  right: -6px;
  bottom: 0;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.identity-header__meta {
  min-width: 0;
  flex: 1;
}

.identity-header__name {
  margin: 0;
  overflow: hidden;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-header__title {
  margin: 0.1rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  font-weight: 650;
}

.identity-header__goal {
  margin: 0.25rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
}

.identity-header__chevron {
  flex: none;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

@media (prefers-reduced-motion: reduce) {
  .identity-header__ring-progress {
    transition: none;
  }
}
</style>
