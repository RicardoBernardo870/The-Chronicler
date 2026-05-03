<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import type { CircleReaction } from '@/types'

defineProps<{
  reactions: CircleReaction[]
  loading?: boolean
}>()
</script>

<template>
  <div class="circle-reaction-list" aria-live="polite">
    <p v-if="!loading && reactions.length === 0" class="circle-reaction-list__empty">
      No visible reactions yet.
    </p>

    <article
      v-for="reaction in reactions"
      :key="reaction.reactionId"
      class="circle-reaction-list__item"
    >
      <Avatar
        :image="reaction.author.avatarUrl || undefined"
        :label="reaction.author.avatarUrl ? undefined : reaction.author.username.slice(0, 1).toUpperCase()"
        shape="circle"
      />
      <div class="circle-reaction-list__body">
        <div class="circle-reaction-list__meta">
          <strong>{{ reaction.author.displayName || reaction.author.username }}</strong>
          <Tag
            :value="reaction.viewerEquivalentPage ? `p. ${reaction.viewerEquivalentPage}` : `${reaction.normalizedLocation}%`"
            severity="secondary"
            rounded
          />
        </div>
        <p>{{ reaction.content }}</p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.circle-reaction-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.circle-reaction-list__empty {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  margin: 0;
}

.circle-reaction-list__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  align-items: flex-start;
}

.circle-reaction-list__body {
  min-width: 0;
}

.circle-reaction-list__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.circle-reaction-list__meta strong,
.circle-reaction-list__body p {
  overflow-wrap: anywhere;
}

.circle-reaction-list__body p {
  margin: 0.25rem 0 0;
  line-height: 1.45;
}
</style>
