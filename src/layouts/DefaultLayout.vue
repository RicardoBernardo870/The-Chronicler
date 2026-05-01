<template>
  <div class="default-layout">
    <main class="default-layout__main">
      <router-view />
    </main>
    <AppBottomNav v-if="authStore.user" />
  </div>
</template>

<script setup lang="ts">
import AppBottomNav from '@/components/shared/AppBottomNav.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<style scoped>
.default-layout {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}

.default-layout__main {
  flex: 1;
  /* Page-level bottom padding is handled per-page via --app-nav-bottom-clearance */
}

</style>
