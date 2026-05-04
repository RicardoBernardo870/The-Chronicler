<script setup lang="ts">
import { computed } from 'vue'
import { useRecapsStore } from '@/stores/recaps'
import Button from 'primevue/button'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import RecapImagePanel from '@/components/recap/RecapImagePanel.vue'

const props = defineProps<{
  bookId: string
}>()

const emit = defineEmits<{
  retry: []
}>()

const recapsStore = useRecapsStore()

const status = computed(() => recapsStore.generationStatus)
const streamingText = computed(() => recapsStore.streamingText)
const error = computed(() => recapsStore.error)
const currentRecap = computed(() => recapsStore.latestRecapForBook(props.bookId))

// Parse streaming text as JSON sections when complete
const parsedRecap = computed(() => {
  if (status.value !== 'complete') return null
  try {
    const trimmed = streamingText.value.trim()
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const objectMatch = trimmed.match(/\{[\s\S]*\}/)
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : objectMatch ? objectMatch[0] : trimmed
    const parsed = JSON.parse(jsonStr)
    const watchlist = (parsed.concept_watchlist ?? '') as string
    return {
      memoryJogger: parsed.memory_jogger ?? '',
      conceptWatchlistItems: watchlist.split(',').map((s: string) => s.trim()).filter(Boolean),
      thematicBridge: parsed.thematic_bridge ?? '',
    }
  } catch {
    return {
      memoryJogger: streamingText.value,
      conceptWatchlistItems: [] as string[],
      thematicBridge: '',
    }
  }
})
</script>

<template>
  <!-- Shimmer skeleton while streaming -->
  <div v-if="status === 'streaming'" class="recap-stream">
    <div class="recap-stream__header">
      <div class="recap-stream__spinner">
        <i class="pi pi-spin pi-spinner" style="font-size: 1.25rem" />
      </div>
      <span class="recap-stream__label">Generating your recap…</span>
    </div>

    <div class="recap-stream__sections">
      <div v-for="i in 3" :key="i" class="recap-section glass-subtle">
        <div class="recap-section__title shimmer shimmer--short" />
        <div class="recap-section__line shimmer" />
        <div class="recap-section__line shimmer shimmer--medium" />
        <div class="recap-section__line shimmer shimmer--short" />
      </div>
    </div>
  </div>

  <!-- Complete recap -->
   <div v-else-if="status === 'complete' && parsedRecap" class="recap-stream recap-stream--done">
    <RecapImagePanel
      v-if="currentRecap"
      :recap-id="currentRecap.id"
      :image-status="currentRecap.imageStatus"
      :image-path="currentRecap.imagePath"
    />

    <Accordion :value="['0']" multiple class="recap-accordion">
      <AccordionPanel value="0">
        <AccordionHeader class="recap-accordion__header recap-accordion__header--memory">
          <span class="recap-section__badge recap-section__badge--memory">
            <i class="pi pi-book" />
            Memory Jogger
          </span>
        </AccordionHeader>
        <AccordionContent>
          <p class="recap-section__body">{{ parsedRecap.memoryJogger }}</p>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="1">
        <AccordionHeader class="recap-accordion__header recap-accordion__header--concepts">
          <span class="recap-section__badge recap-section__badge--concepts">
            <i class="pi pi-list" />
            Concept Watchlist
          </span>
        </AccordionHeader>
        <AccordionContent>
          <div class="recap-section__chips">
            <span
              v-for="item in parsedRecap.conceptWatchlistItems"
              :key="item"
              class="recap-chip"
            >{{ item }}</span>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="2">
        <AccordionHeader class="recap-accordion__header recap-accordion__header--bridge">
          <span class="recap-section__badge recap-section__badge--bridge">
            <i class="pi pi-compass" />
            Thematic Bridge
          </span>
        </AccordionHeader>
        <AccordionContent>
          <p class="recap-section__body">{{ parsedRecap.thematicBridge }}</p>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>

  <!-- Error state -->
  <div v-else-if="status === 'error'" class="recap-stream glass-surface recap-stream--error">
    <div class="recap-stream__error-icon">
      <i class="pi pi-exclamation-circle" style="font-size: 2rem; color: var(--p-red-400)" />
    </div>
    <p class="recap-stream__error-msg">{{ error ?? 'Something went wrong generating your recap.' }}</p>
    <Button
      label="Try Again"
      icon="pi pi-refresh"
      class="glass-surface"
      outlined
      @click="emit('retry')"
    /> 
  </div>
</template>

<style scoped>
.recap-stream {
  border-radius: var(--p-border-radius-xl, 16px);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.recap-stream__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.recap-stream__sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recap-section {
  border-radius: var(--p-border-radius-lg, 12px);
  padding: 1rem 1.25rem;
}

.recap-section__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
}

.recap-section__badge--memory {
  background: rgba(99, 102, 241, 0.18);
  color: #818cf8;
}

.recap-section__badge--concepts {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.recap-section__badge--bridge {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.recap-section__body {
  margin: 0;
  line-height: 1.65;
  font-size: 0.95rem;
  opacity: 0.90;
}

.recap-section__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.recap-chip {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  opacity: 0.90;
  border: 1px solid rgba(99, 102, 241, 0.20);
}

/* Shimmer skeleton */
.shimmer {
  border-radius: 6px;
  height: 14px;
  margin-bottom: 8px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 400% 100%;
  animation: shimmer-sweep 1.6s ease-in-out infinite;
  width: 100%;
}

.shimmer--medium { width: 78%; }
.shimmer--short  { width: 55%; }

.recap-section__title {
  height: 12px;
  width: 40%;
  margin-bottom: 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}

/* Light theme — white-on-white is invisible; use dark overlays instead */
html[data-p-theme='light'] .shimmer {
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.04) 0%,
    rgba(0, 0, 0, 0.11) 50%,
    rgba(0, 0, 0, 0.04) 100%
  );
  background-size: 400% 100%;
}

html[data-p-theme='light'] .recap-section__title {
  background: rgba(0, 0, 0, 0.08);
}

@keyframes shimmer-sweep {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

/* Error state */
.recap-stream--error {
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  padding: 20px;
}

.recap-stream__error-msg {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

/* Fade-in for complete state */
.recap-stream--done {
  animation: fade-in 0.4s ease;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Accordion overrides */
.recap-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recap-accordion :deep(.p-accordionpanel) {
  border-radius: var(--p-border-radius-lg, 12px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.recap-accordion :deep(.p-accordionheader) {
  background: none !important;
  padding: 0.75rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Kill PrimeVue's ugly gray hover */
.recap-accordion :deep(.p-accordionpanel:not(.p-accordionpanel-active):not(.p-disabled) > .p-accordionheader:hover) {
  background-color: none !important;
}

/* Toggle chevron — locked to indigo in every state */
.recap-accordion :deep(.p-accordionheader-toggle-icon),
.recap-accordion :deep(.p-accordionheader:hover .p-accordionheader-toggle-icon),
.recap-accordion :deep(.p-accordionheader:focus .p-accordionheader-toggle-icon),
.recap-accordion :deep(.p-accordionheader:focus-visible .p-accordionheader-toggle-icon),
.recap-accordion :deep(.p-accordionpanel-active > .p-accordionheader .p-accordionheader-toggle-icon),
.recap-accordion :deep(.p-accordionpanel-active > .p-accordionheader:hover .p-accordionheader-toggle-icon),
.recap-accordion :deep(.p-accordionpanel-active > .p-accordionheader:focus .p-accordionheader-toggle-icon) {
  color: #818cf8 !important;
  opacity: 0.85;
}

/* Content area — inherit text color, no background, generous padding */
.recap-accordion :deep(.p-accordioncontent-content) {
  padding: 0.5rem 1.25rem 1.125rem;
  background: none !important;
  color: inherit;
}

/* Remove default PrimeVue accordion separator lines */
.recap-accordion :deep(.p-accordionpanel + .p-accordionpanel) {
  border-top: none;
}
</style>
