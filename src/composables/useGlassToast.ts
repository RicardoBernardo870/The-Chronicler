import { readonly, ref } from 'vue'

/**
 * Glass success toast — module-level singleton so any component can trigger
 * the top-center pill rendered once in App.vue (same pattern as the lore
 * generation banner, but fire-and-forget with an auto-dismiss timer).
 */
const visible = ref(false)
const summary = ref('')
const detail = ref<string | null>(null)

let dismissTimer: ReturnType<typeof setTimeout> | null = null

const show = (newSummary: string, newDetail?: string, life = 5000): void => {
  if (dismissTimer) clearTimeout(dismissTimer)
  summary.value = newSummary
  detail.value = newDetail ?? null
  visible.value = true
  dismissTimer = setTimeout(() => {
    visible.value = false
    dismissTimer = null
  }, life)
}

const dismiss = (): void => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  visible.value = false
}

export const useGlassToast = () => ({
  visible: readonly(visible),
  summary: readonly(summary),
  detail: readonly(detail),
  show,
  dismiss,
})
