<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
import type { PublicCommunityProfile } from '@/types'

defineProps<{
  profile: PublicCommunityProfile
}>()
</script>

<template>
  <article class="public-profile-card glass-surface">
    <header class="public-profile-card__header">
      <img
        v-if="profile.profile.avatarUrl"
        :src="profile.profile.avatarUrl"
        :alt="profile.profile.displayName ?? profile.profile.username"
        class="public-profile-card__avatar"
      >
      <div v-else class="public-profile-card__avatar public-profile-card__avatar--fallback">
        {{ profile.profile.username.slice(0, 1).toUpperCase() }}
      </div>

      <div class="public-profile-card__identity">
        <h1>{{ profile.profile.displayName || profile.profile.username }}</h1>
        <p>@{{ profile.profile.username }}</p>
      </div>
    </header>

    <p v-if="profile.profile.bio" class="public-profile-card__bio">
      {{ profile.profile.bio }}
    </p>

    <section v-if="profile.readerDna" class="public-profile-card__section">
      <h2>Reader DNA</h2>
      <p class="public-profile-card__dna">{{ profile.readerDna.personality }}</p>
      <p class="public-profile-card__muted">
        {{ profile.readerDna.moodTone }}
        <span v-if="profile.readerDna.moodEmojis.length">
          · {{ profile.readerDna.moodEmojis.join(' ') }}
        </span>
      </p>
    </section>

    <section v-if="profile.currentlyReading" class="public-profile-card__section">
      <h2>Currently Reading</h2>
      <div class="public-profile-card__book">
        <img
          v-if="profile.currentlyReading.coverUrl"
          :src="profile.currentlyReading.coverUrl"
          :alt="profile.currentlyReading.title"
          class="public-profile-card__cover"
        >
        <div v-else class="public-profile-card__cover public-profile-card__cover--fallback" />

        <div class="public-profile-card__book-copy">
          <h3>{{ profile.currentlyReading.title }}</h3>
          <p>{{ profile.currentlyReading.author }}</p>
          <ProgressBar :value="profile.currentlyReading.percentage" />
          <span>
            p.{{ profile.currentlyReading.currentPage }} of {{ profile.currentlyReading.totalPages }}
          </span>
        </div>
      </div>
    </section>

    <section v-if="profile.stats" class="public-profile-card__section">
      <h2>Stats</h2>
      <div class="public-profile-card__stats">
        <div>
          <strong>{{ profile.stats.booksRead }}</strong>
          <span>Books read</span>
        </div>
        <div>
          <strong>{{ profile.stats.totalPagesRead }}</strong>
          <span>Pages read</span>
        </div>
        <div>
          <strong>{{ profile.stats.currentStreakDays }}d</strong>
          <span>Current streak</span>
        </div>
        <div>
          <strong>{{ profile.stats.longestStreakDays }}d</strong>
          <span>Longest streak</span>
        </div>
      </div>
    </section>

    <section
      v-if="profile.lexiconHighlights?.length"
      class="public-profile-card__section"
    >
      <h2>Recently Mastered Words</h2>
      <div class="public-profile-card__words">
        <span
          v-for="word in profile.lexiconHighlights"
          :key="`${word.term}-${word.masteredAt}`"
          class="public-profile-card__word"
        >
          {{ word.term }}
        </span>
      </div>
    </section>
  </article>
</template>

<style scoped>
.public-profile-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.public-profile-card__header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.public-profile-card__avatar {
  width: 4.25rem;
  height: 4.25rem;
  border-radius: 999px;
  object-fit: cover;
  flex: 0 0 auto;
  border: 1px solid var(--surface-border);
}

.public-profile-card__avatar--fallback {
  display: grid;
  place-items: center;
  font-size: 1.35rem;
  font-weight: 800;
  background: var(--surface-card);
}

.public-profile-card__identity {
  min-width: 0;
}

.public-profile-card__identity h1,
.public-profile-card__book-copy h3 {
  margin: 0;
  overflow-wrap: anywhere;
}

.public-profile-card__identity h1 {
  font-size: 1.35rem;
}

.public-profile-card__identity p,
.public-profile-card__book-copy p,
.public-profile-card__book-copy span,
.public-profile-card__muted {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  opacity: 0.68;
}

.public-profile-card__bio {
  margin: 0;
  line-height: 1.5;
}

.public-profile-card__section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.public-profile-card__section h2 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
}

.public-profile-card__dna {
  margin: 0;
  font-weight: 700;
  line-height: 1.4;
}

.public-profile-card__book {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
}

.public-profile-card__cover {
  width: 4.5rem;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 6px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  flex: 0 0 auto;
}

.public-profile-card__book-copy {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.public-profile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.public-profile-card__stats div {
  padding: 0.8rem;
  border-radius: 8px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.public-profile-card__stats strong {
  font-size: 1.1rem;
}

.public-profile-card__stats span {
  font-size: 0.75rem;
  opacity: 0.66;
}

.public-profile-card__words {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.public-profile-card__word {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  font-size: 0.83rem;
  font-weight: 700;
}
</style>
