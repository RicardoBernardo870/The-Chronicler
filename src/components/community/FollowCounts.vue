<script setup lang="ts">
defineProps<{
  followersCount: number
  followingCount: number
  disabled?: boolean
}>()

defineEmits<{
  openFollowers: []
  openFollowing: []
}>()
</script>

<template>
  <div class="follow-counts" aria-label="Reader network counts">
    <button
      type="button"
      class="follow-counts__item"
      :disabled="disabled"
      @click="$emit('openFollowers')"
    >
      <strong>{{ followersCount }}</strong>
      <span>Followers</span>
    </button>

    <button
      type="button"
      class="follow-counts__item"
      :disabled="disabled"
      @click="$emit('openFollowing')"
    >
      <strong>{{ followingCount }}</strong>
      <span>Following</span>
    </button>
  </div>
</template>

<style scoped>
.follow-counts {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.follow-counts__item {
  min-width: 6rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  cursor: pointer;
}

.follow-counts__item:disabled {
  cursor: default;
  opacity: 0.65;
}

.follow-counts__item strong {
  font-size: 1rem;
}

.follow-counts__item span {
  font-size: 0.76rem;
  opacity: 0.68;
}
</style>
