<script setup lang="ts">
// 016 — StatTile: one number + label + icon. glass-subtle surface.
defineProps<{
  icon: string; // PrimeIcons class name e.g. "pi-book"
  label: string;
  value: string | number;
}>();
</script>

<template>
  <div class="stat-tile glass-subtle">
    <i class="pi stat-tile__icon" :class="icon" />
    <div class="stat-tile__value">{{ value }}</div>
    <div class="stat-tile__label">{{ label }}</div>
  </div>
</template>

<style scoped>
.stat-tile {
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.stat-tile__icon {
  font-size: 1rem;
  color: var(--p-indigo-400);
  opacity: 0.85;
  margin-bottom: 0.3rem;
}

.stat-tile__value {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.stat-tile__label {
  font-size: 0.73rem;
  opacity: 0.55;
  font-weight: 500;
}
</style>
