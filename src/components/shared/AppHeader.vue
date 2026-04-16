<template>
  <header class="app-header glass-surface">
    <div class="app-header__inner">
      <!-- Brand -->
      <RouterLink to="/" class="app-header__brand">
        <i class="pi pi-book" />
        <span class="app-header__brand-name">Chronicler</span>
      </RouterLink>

      <!-- Nav links (desktop) -->
      <nav class="app-header__nav">
        <RouterLink to="/" class="app-header__nav-link" :class="{ active: route.path === '/' }">
          Home
        </RouterLink>
        <RouterLink to="/library" class="app-header__nav-link" :class="{ active: route.path.startsWith('/library') }">
          Library
        </RouterLink>
      </nav>

      <!-- Actions -->
      <div class="app-header__actions">
        <!-- Dark mode toggle -->
        <button class="app-header__icon-btn" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleMode">
          <i :class="`pi ${isDark ? 'pi-sun' : 'pi-moon'}`" />
        </button>

        <!-- Add book -->
        <RouterLink to="/books/add" class="app-header__icon-btn" title="Add book">
          <i class="pi pi-plus" />
        </RouterLink>

        <!-- Sign out -->
        <button
          v-if="authStore.user"
          class="app-header__icon-btn"
          title="Sign out"
          @click="handleSignOut"
        >
          <i class="pi pi-sign-out" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useColorMode } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const colorMode = useColorMode({
  attribute: 'data-p-theme',
  modes: { dark: 'dark', light: 'light' },
})

const isDark = computed(() => colorMode.value === 'dark')

function toggleMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}

async function handleSignOut() {
  await authStore.signOut()
  await router.push('/auth')
}
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0.75rem;
  z-index: 100;
  margin: 0.75rem 1rem 0;
  border-radius: 18px;
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: -0.02em;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.app-header__brand .pi {
  font-size: 1.1rem;
  opacity: 0.85;
}

.app-header__nav {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.app-header__nav-link {
  padding: 0.4rem 0.75rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0.55;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.15s, background 0.15s;
}

.app-header__nav-link:hover,
.app-header__nav-link.active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
}

.app-header__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s, background 0.15s;
  text-decoration: none;
}

.app-header__icon-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

.app-header__icon-btn .pi {
  font-size: 1rem;
}

@media (max-width: 480px) {
  .app-header__brand-name {
    display: none;
  }

  .app-header__nav-link {
    padding: 0.4rem 0.5rem;
  }
}
</style>
