<template>
  <div class="not-found">
    <div class="not-found__card glass-surface">
      <i class="pi pi-search not-found__icon" />
      <h1 class="not-found__title">Page not found</h1>
      <p class="not-found__desc">The page you're looking for doesn't exist.</p>
      <RouterLink to="/">
        <Button label="Go home" icon="pi pi-home" />
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
</script>

<style scoped>
.not-found {
  min-height: 80svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.not-found__card {
  text-align: center;
  padding: 3rem 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 360px;
  width: 100%;
}

.not-found__icon {
  font-size: 3rem;
  opacity: 0.25;
}

.not-found__title {
  font-size: 1.4rem;
  font-weight: 700;
}

.not-found__desc {
  opacity: 0.5;
  font-size: 0.9rem;
}
</style>
