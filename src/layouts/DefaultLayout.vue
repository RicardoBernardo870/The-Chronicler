<template>
  <div class="default-layout">
    <AppHeader />
    <main class="default-layout__main">
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/shared/AppHeader.vue'
</script>

<style scoped>
.default-layout {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}

.default-layout__main {
  flex: 1;
  padding-top: 1.5rem;
}

/* Page transition */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
