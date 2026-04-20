<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppTheme } from '@/composables/useAppTheme'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const { isDark, toggle: toggleTheme } = useAppTheme()
const moreVisible = ref(false)

const isHome = computed(() => route.path === '/')
const isLibrary = computed(() => route.path.startsWith('/library') || route.path.startsWith('/books'))
const isLexicon = computed(() => route.path.startsWith('/lexicon'))

const closeMore = () => { moreVisible.value = false }

const handleToggleTheme = () => {
  toggleTheme()
  closeMore()
}

const handleSignOut = async () => {
  closeMore()
  await authStore.signOut()
  await router.push('/login')
}

const handleAddBook = () => {
  closeMore()
  router.push('/books/add')
}
</script>

<template>
  <!-- Backdrop — closes More sheet on outside click -->
  <Transition name="fade">
    <div v-if="moreVisible" class="app-bottom-nav__backdrop" @click="closeMore" />
  </Transition>

  <!-- More sheet -->
  <Transition name="sheet">
    <div v-if="moreVisible" class="app-bottom-nav__sheet glass-surface">
      <button class="app-bottom-nav__sheet-item" @click="handleAddBook">
        <i class="pi pi-plus" />
        <span>Add Book</span>
      </button>
      <button class="app-bottom-nav__sheet-item" @click="handleToggleTheme">
        <i :class="`pi ${isDark ? 'pi-sun' : 'pi-moon'}`" />
        <span>{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
      </button>
      <button class="app-bottom-nav__sheet-item" @click="handleSignOut">
        <i class="pi pi-sign-out" />
        <span>Sign out</span>
      </button>
    </div>
  </Transition>

  <!-- Bottom nav bar -->
  <nav class="app-bottom-nav glass-surface">
    <RouterLink to="/" class="app-bottom-nav__item" :class="{ active: isHome }">
      <i class="pi pi-home" />
      <span class="app-bottom-nav__label">Home</span>
    </RouterLink>
    <RouterLink to="/library" class="app-bottom-nav__item" :class="{ active: isLibrary }">
      <i class="pi pi-th-large" />
      <span class="app-bottom-nav__label">Library</span>
    </RouterLink>
    <RouterLink to="/lexicon" class="app-bottom-nav__item" :class="{ active: isLexicon }">
      <i class="pi pi-language" />
      <span class="app-bottom-nav__label">Great Library</span>
    </RouterLink>
    <button
      class="app-bottom-nav__item"
      :class="{ active: moreVisible }"
      @click="moreVisible = !moreVisible"
    >
      <i class="pi pi-ellipsis-h" />
      <span class="app-bottom-nav__label">More</span>
    </button>
  </nav>
</template>

<style scoped>
/* ── Bottom nav bar ──────────────────────────────────────────────────────── */

.app-bottom-nav {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
  left: 0.75rem;
  right: 0.75rem;
  height: 4rem;
  border-radius: 18px;
  z-index: 200;
  display: flex;
  align-items: stretch;
  padding: 0 0.25rem;
}

.app-bottom-nav__item {
  flex: 1;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  opacity: 0.5;
  transition: opacity 0.15s, color 0.15s;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-decoration: none;
  border-radius: 14px;
  padding: 0;
}

.app-bottom-nav__item:hover {
  opacity: 0.75;
}

.app-bottom-nav__item.active {
  opacity: 1;
  color: var(--p-indigo-400);
}

.app-bottom-nav__item .pi {
  font-size: 1.15rem;
}

.app-bottom-nav__label {
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1;
}

/* ── More sheet ──────────────────────────────────────────────────────────── */

.app-bottom-nav__backdrop {
  position: fixed;
  inset: 0;
  z-index: 198;
  background: transparent;
}

.app-bottom-nav__sheet {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem);
  left: 0.75rem;
  right: 0.75rem;
  border-radius: 16px;
  padding: 0.5rem;
  z-index: 199;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.app-bottom-nav__sheet-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.15s;
}

.app-bottom-nav__sheet-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.app-bottom-nav__sheet-item .pi {
  font-size: 1rem;
  opacity: 0.75;
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}

/* Light mode sheet hover */
html[data-p-theme='light'] .app-bottom-nav__sheet-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* ── Transitions ──────────────────────────────────────────────────────────── */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
