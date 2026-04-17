import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'bookhero_theme'
const ATTRIBUTE = 'data-p-theme'

// ── Module-level singleton — shared across all useAppTheme() calls ────────────

const readStored = (): 'dark' | 'light' => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light') return 'light'
  } catch { /* localStorage unavailable */ }
  return 'dark' // default: dark mode (low-light reading — constitution §V)
}

const theme = ref<'dark' | 'light'>(readStored())

const applyTheme = (value: 'dark' | 'light') => {
  document.documentElement.setAttribute(ATTRIBUTE, value)
  try { localStorage.setItem(STORAGE_KEY, value) } catch { /* non-fatal */ }
}

// Apply immediately when module first loads (before Vue mounts)
applyTheme(theme.value)

// Keep the DOM in sync whenever theme changes
watch(theme, applyTheme)

// ── Composable ────────────────────────────────────────────────────────────────

export const useAppTheme = () => {
  const isDark = computed(() => theme.value === 'dark')

  const toggle = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, isDark, toggle }
}
