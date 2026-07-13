<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useRecapsStore } from '@/stores/recaps'
import RecapImagePanel from '@/components/recap/RecapImagePanel.vue'

// Fresh-recap modal (replaces the inline RecapStream panel). Opens the moment
// Get Recap is pressed: shimmer while streaming, then an image-first story
// layout — illustration, byline, arc prose, watchlist chips, open-thread
// quote. Content reads from the persisted recap row (inserted before the
// store flips to 'complete'), not from the raw stream text.
const props = defineProps<{
  bookId: string
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  retry: []
}>()

const router = useRouter()
const recapsStore = useRecapsStore()

const status = computed(() => recapsStore.generationStatus)
const error = computed(() => recapsStore.error)
const currentRecap = computed(() => recapsStore.latestRecapForBook(props.bookId))
const history = computed(() => recapsStore.recapHistoryForBook(props.bookId))
const previousRecap = computed(() => history.value[1] ?? null)

const showRecap = computed(() => status.value === 'complete' && Boolean(currentRecap.value))

const rangeLabel = computed(() => {
  const to = currentRecap.value?.pageSnapshot
  if (to == null) return ''
  const from = Math.max(0, previousRecap.value?.pageSnapshot ?? 0) + 1
  return from >= to ? `page ${to}` : `pages ${from}–${to}`
})

const bylineText = computed(() => {
  const parts: string[] = []
  if (currentRecap.value?.mode === 'corpus') parts.push('From your captures')
  if (previousRecap.value && currentRecap.value) {
    const gapMs = new Date(currentRecap.value.createdAt).getTime()
      - new Date(previousRecap.value.createdAt).getTime()
    const days = Math.floor(gapMs / 86_400_000)
    if (days >= 1) parts.push(days === 1 ? '1 day later' : `${days} days later`)
  }
  return parts.join(' · ')
})

const watchlistItems = computed(() =>
  (currentRecap.value?.conceptWatchlist ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const viewHistory = () => {
  emit('update:visible', false)
  router.push({ name: 'recap-history', params: { id: props.bookId } })
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="false"
    class="recap-dialog"
    :style="{ width: '92vw', maxWidth: '480px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="recap-dialog__header">
        <i class="pi pi-sparkles" aria-hidden="true" />
        <span class="recap-dialog__title">Recap</span>
        <span v-if="showRecap && rangeLabel" class="recap-dialog__range">{{ rangeLabel }}</span>
      </div>
    </template>

    <!-- Streaming (and pre-stream idle, so the dialog never opens empty) -->
    <div v-if="status === 'streaming' || status === 'idle'" class="recap-dialog__stream">
      <div class="recap-dialog__stream-header">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>Generating your recap…</span>
      </div>
      <div v-for="i in 3" :key="i" class="recap-dialog__skeleton">
        <div class="recap-dialog__shimmer recap-dialog__shimmer--short" />
        <div class="recap-dialog__shimmer" />
        <div class="recap-dialog__shimmer recap-dialog__shimmer--medium" />
      </div>
    </div>

    <!-- Complete: image-first story layout -->
    <div v-else-if="showRecap && currentRecap" class="recap-dialog__body">
      <div class="recap-dialog__image">
        <RecapImagePanel
          :recap-id="currentRecap.id"
          :image-status="currentRecap.imageStatus"
          :image-path="currentRecap.imagePath"
        />
        <p v-if="currentRecap.imageStatus === 'pending'" class="recap-dialog__illustrating">
          Illustrating this stretch…
        </p>
      </div>

      <p v-if="bylineText" class="recap-dialog__byline">
        <i
          v-if="currentRecap.mode === 'corpus'"
          class="pi pi-camera"
          aria-hidden="true"
        />
        {{ bylineText }}
      </p>

      <p class="recap-dialog__prose">{{ currentRecap.memoryJogger }}</p>

      <template v-if="watchlistItems.length">
        <p class="recap-dialog__chips-label">Keep an eye on</p>
        <div class="recap-dialog__chips">
          <span v-for="item in watchlistItems" :key="item" class="recap-dialog__chip">
            {{ item }}
          </span>
        </div>
      </template>

      <p v-if="currentRecap.thematicBridge" class="recap-dialog__thread">
        {{ currentRecap.thematicBridge }}
      </p>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="recap-dialog__error">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <p>{{ error ?? 'Something went wrong generating your recap.' }}</p>
      <Button label="Try Again" icon="pi pi-refresh" outlined @click="emit('retry')" />
    </div>

    <template v-if="showRecap" #footer>
      <div class="recap-dialog__footer">
        <Button
          :label="`View history (${history.length})`"
          icon="pi pi-history"
          link
          class="recap-dialog__history-link"
          @click="viewHistory"
        />
        <Button
          label="Done"
          class="recap-dialog__done"
          @click="emit('update:visible', false)"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.recap-dialog__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recap-dialog__header .pi {
  color: var(--p-indigo-300);
  font-size: 0.9rem;
}

.recap-dialog__title {
  font-size: 1rem;
  font-weight: 600;
}

.recap-dialog__range {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.18);
  color: var(--p-indigo-300);
  white-space: nowrap;
}

/* ── Streaming ── */
.recap-dialog__stream {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recap-dialog__stream-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.9rem;
  opacity: 0.85;
}

.recap-dialog__skeleton {
  border-radius: var(--p-border-radius-lg, 12px);
  padding: 0.9rem 1rem;
  background: rgba(255, 255, 255, 0.04);
}

.recap-dialog__shimmer {
  border-radius: 6px;
  height: 13px;
  margin-bottom: 8px;
  width: 100%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 400% 100%;
  animation: recap-shimmer-sweep 1.6s ease-in-out infinite;
}

.recap-dialog__shimmer--medium { width: 78%; }
.recap-dialog__shimmer--short  { width: 50%; }

html[data-p-theme='light'] .recap-dialog__shimmer {
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.04) 0%,
    rgba(0, 0, 0, 0.11) 50%,
    rgba(0, 0, 0, 0.04) 100%
  );
  background-size: 400% 100%;
}

@keyframes recap-shimmer-sweep {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

/* ── Complete ── */
.recap-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: recap-dialog-fade 0.4s ease;
}

@keyframes recap-dialog-fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.recap-dialog__image {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* Stretch the shared image panel edge-to-edge inside the dialog */
.recap-dialog__image :deep(.recap-image-panel) {
  max-width: none;
}

.recap-dialog__illustrating {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.55;
  text-align: center;
  font-style: italic;
}

.recap-dialog__byline {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-emerald-300, #6ee7b7);
}

.recap-dialog__byline .pi { font-size: 0.75rem; }

.recap-dialog__prose {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.65;
  opacity: 0.92;
}

.recap-dialog__chips-label {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.5;
}

.recap-dialog__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.recap-dialog__chip {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
  opacity: 0.9;
}

.recap-dialog__thread {
  margin: 0.15rem 0 0;
  padding-left: 0.75rem;
  border-left: 2px solid var(--p-indigo-300);
  font-size: 0.88rem;
  font-style: italic;
  opacity: 0.8;
}

/* ── Error ── */
.recap-dialog__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0.5rem;
  text-align: center;
}

.recap-dialog__error .pi-exclamation-circle {
  font-size: 2rem;
  color: var(--p-red-400);
}

.recap-dialog__error p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

/* ── Footer ── */
.recap-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.recap-dialog__history-link {
  padding-left: 0 !important;
  font-size: 0.82rem;
}

.recap-dialog__done {
  flex: none;
  font-weight: 700;
}

[data-p-theme='light'] .recap-dialog__range,
[data-p-theme='light'] .recap-dialog__header .pi {
  color: var(--p-primary-700, #4338ca);
}

[data-p-theme='light'] .recap-dialog__byline {
  color: var(--p-emerald-600, #059669);
}
</style>
