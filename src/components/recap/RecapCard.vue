<script setup lang="ts">
import type { Recap } from '@/types'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'

const props = defineProps<{
  recap: Recap
}>()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
</script>

<template>
  <article class="recap-card glass-surface">
    <header class="recap-card__header">
      <span class="recap-card__progress">
        <i class="pi pi-chart-bar" />
        page {{ recap.pageSnapshot ?? '—' }} · {{ recap.progressSnapshot }}%
      </span>
      <time class="recap-card__date" :datetime="recap.createdAt">
        {{ formatDate(recap.createdAt) }}
      </time>
    </header>

    <Accordion :value="['0']" multiple class="recap-accordion">
      <AccordionPanel value="0">
        <AccordionHeader>
          <span class="recap-card__section-label recap-card__section-label--memory">
            <i class="pi pi-book" /> Memory Jogger
          </span>
        </AccordionHeader>
        <AccordionContent>
          <p class="recap-card__section-body">{{ recap.memoryJogger }}</p>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="1">
        <AccordionHeader>
          <span class="recap-card__section-label recap-card__section-label--concepts">
            <i class="pi pi-list" /> Concept Watchlist
          </span>
        </AccordionHeader>
        <AccordionContent>
          <div class="recap-card__chips">
            <span
              v-for="item in recap.conceptWatchlist.split(',').map((s: string) => s.trim()).filter(Boolean)"
              :key="item"
              class="recap-chip"
            >{{ item }}</span>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="2">
        <AccordionHeader>
          <span class="recap-card__section-label recap-card__section-label--bridge">
            <i class="pi pi-compass" /> Thematic Bridge
          </span>
        </AccordionHeader>
        <AccordionContent>
          <p class="recap-card__section-body">{{ recap.thematicBridge }}</p>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </article>
</template>

<style scoped>
.recap-card {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recap-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.recap-card__progress {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--p-indigo-300);
}

.recap-card__date {
  font-size: 0.75rem;
  opacity: 0.55;
}

.recap-card__section-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}

.recap-card__section-label--memory {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.recap-card__section-label--concepts {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.recap-card__section-label--bridge {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}

.recap-card__section-body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  opacity: 0.90;
}

.recap-card__chips {
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

/* Accordion overrides */
.recap-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recap-accordion :deep(.p-accordionpanel) {
  overflow: hidden;
}

.recap-accordion :deep(.p-accordionheader) {
  background: none !important;
  padding: 0.625rem 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Kill PrimeVue's ugly gray hover */
.recap-accordion :deep(.p-accordionpanel:not(.p-accordionpanel-active):not(.p-disabled) > .p-accordionheader:hover) {
  background: none !important;
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
  padding: 0.5rem 1rem 1rem;
  background: none !important;
  color: inherit;
}

.recap-accordion :deep(.p-accordionpanel + .p-accordionpanel) {
  border-top: none;
}
</style>
