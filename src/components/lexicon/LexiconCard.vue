<script setup lang="ts">
import { ref } from 'vue'
import type { LexiconEntry } from '@/types'
import Button from 'primevue/button'

defineProps<{ entry: LexiconEntry }>()
const emit = defineEmits<{ advance: []; reset: [] }>()

const flipped = ref(false)
</script>

<template>
  <div class="lc-wrap" @click="flipped = !flipped">
    <div class="lc-inner" :class="{ 'lc-inner--flipped': flipped }">

      <!-- Front -->
      <div class="lc-face lc-front glass-surface">
        <div class="lc-front__top">
          <span class="lc-badge" :class="entry.entryType === 'dictionary' ? 'lc-badge--dict' : 'lc-badge--lore'">
            {{ entry.entryType === 'dictionary' ? 'Dictionary' : 'Lore' }}
          </span>
          <span v-if="entry.pageFound" class="lc-page">p.{{ entry.pageFound }}</span>
        </div>
        <p class="lc-term">{{ entry.term }}</p>
        <p class="lc-hint">tap to see definition</p>
      </div>

      <!-- Back -->
      <div class="lc-face lc-back glass-surface" @click.stop>
        <p class="lc-definition">{{ entry.definition }}</p>
        <p v-if="entry.contextSentence" class="lc-context">"{{ entry.contextSentence }}"</p>
        <div class="lc-actions">
          <Button
            label="✓ I know this"
            size="small"
            severity="success"
            outlined
            @click="emit('advance'); flipped = false"
          />
          <Button
            label="✗ Review again"
            size="small"
            severity="secondary"
            outlined
            @click="emit('reset'); flipped = false"
          />
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.lc-wrap {
  perspective: 900px;
  cursor: pointer;
  min-height: 140px;
}

.lc-inner {
  position: relative;
  width: 100%;
  min-height: 160px;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.lc-inner--flipped { transform: rotateY(180deg); }

.lc-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 140px;
}

.lc-back { transform: rotateY(180deg); }

/* Front */
.lc-front__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lc-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.lc-badge--dict {
  background: rgba(20, 184, 166, 0.15);
  color: #2dd4bf;
}

.lc-badge--lore {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.lc-page {
  font-size: 0.72rem;
  opacity: 0.5;
}

.lc-term {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  flex: 1;
  display: flex;
  align-items: center;
}

.lc-hint {
  margin: 0;
  font-size: 0.72rem;
  opacity: 0.35;
  font-style: italic;
}

/* Back */
.lc-definition {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  flex: 1;
}

.lc-context {
  margin: 0;
  font-size: 0.8rem;
  font-style: italic;
  opacity: 0.65;
  line-height: 1.45;
  border-left: 2px solid rgba(99,102,241,0.4);
  padding-left: 0.6rem;
}

.lc-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}
</style>
