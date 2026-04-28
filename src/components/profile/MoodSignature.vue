<script setup lang="ts">
// 016 — MoodSignature: tone pill (glass-tinted) + emoji row.
defineProps<{
  tone: string;
  emojis: string[];
}>();
</script>

<template>
  <div class="mood-signature">
    <span class="mood-signature__tone">{{ tone }}</span>
    <span class="mood-signature__emojis" aria-label="Mood emoji signature">
      <span v-for="(e, i) in emojis" :key="i">{{ e }}</span>
    </span>
  </div>
</template>

<style scoped>
.mood-signature {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.mood-signature__tone {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  background: rgba(99, 102, 241, 0.18);
  border: 1px solid rgba(99, 102, 241, 0.25);
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
}

.mood-signature__emojis {
  display: inline-flex;
  gap: 0.2rem;
  font-size: 1.4rem;
  line-height: 1;
}
</style>
