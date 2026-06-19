<script setup lang="ts">
import { computed } from 'vue'
import type { ImportSummary } from '@/types'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const props = defineProps<{
  summary: ImportSummary
}>()

const failedCount = computed(() => props.summary.failed.length)
</script>

<template>
  <div class="import-summary">
    <p class="import-summary__headline">
      <i class="pi pi-check-circle" /> Import complete
    </p>

    <div class="import-summary__chips">
      <Tag severity="success" :value="`${summary.imported} imported`" />
      <Tag
        v-if="summary.skippedDuplicate > 0"
        severity="warn"
        
        :value="`${summary.skippedDuplicate} already in library`"
      />
      <Tag
        v-if="failedCount > 0"
        severity="warn"
        :value="`${failedCount} skipped`"
      />
    </div>

    <Message
      v-if="summary.estimatedPageCounts > 0"
      severity="info"
      :closable="false"
      class="import-summary__note"
    >
      {{ summary.estimatedPageCounts }}
      {{ summary.estimatedPageCounts === 1 ? 'book needs' : 'books need' }}
      a page count — open a book to set the real number.
    </Message>

    <details v-if="failedCount > 0" class="import-summary__failed">
      <summary>Show skipped rows</summary>
      <ul>
        <li v-for="f in summary.failed" :key="f.row">
          Row {{ f.row }}<span v-if="f.title"> — “{{ f.title }}”</span>: {{ f.reason }}
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.import-summary {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.import-summary__headline {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--p-green-400);
}

.import-summary__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.import-summary__note {
  font-size: 0.82rem;
}

.import-summary__failed {
  font-size: 0.8rem;
  opacity: 0.8;
}

.import-summary__failed summary {
  cursor: pointer;
  user-select: none;
}

.import-summary__failed ul {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  max-height: 9rem;
  overflow-y: auto;
}

.import-summary__failed li {
  margin-bottom: 0.2rem;
}
</style>
