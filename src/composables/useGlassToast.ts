import { readonly, ref } from 'vue'

/**
 * Glass toast — module-level singleton so any component can trigger the
 * top-center pill rendered once in App.vue (same pattern as the lore
 * generation banner).
 *
 * Variants:
 *  - success: green check, auto-dismisses (default 5s)
 *  - loading: spinner, persists until dismissed or replaced by another show
 *  - warn:    amber triangle, auto-dismisses (default 6s)
 */
export type GlassToastVariant = 'success' | 'loading' | 'warn'

const visible = ref(false)
const variant = ref<GlassToastVariant>('success')
const summary = ref('')
const detail = ref<string | null>(null)

let dismissTimer: ReturnType<typeof setTimeout> | null = null

const display = (
  newVariant: GlassToastVariant,
  newSummary: string,
  newDetail: string | undefined,
  life: number,
): void => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  variant.value = newVariant
  summary.value = newSummary
  detail.value = newDetail ?? null
  visible.value = true
  if (life > 0) {
    dismissTimer = setTimeout(() => {
      visible.value = false
      dismissTimer = null
    }, life)
  }
}

const show = (newSummary: string, newDetail?: string, life = 5000): void =>
  display('success', newSummary, newDetail, life)

const showLoading = (newSummary: string, newDetail?: string): void =>
  display('loading', newSummary, newDetail, 0)

const showWarn = (newSummary: string, newDetail?: string, life = 6000): void =>
  display('warn', newSummary, newDetail, life)

const dismiss = (): void => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  visible.value = false
}

export const useGlassToast = () => ({
  visible: readonly(visible),
  variant: readonly(variant),
  summary: readonly(summary),
  detail: readonly(detail),
  show,
  showLoading,
  showWarn,
  dismiss,
})
