<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import type { LexiconEntry } from '@/types'
import Button from 'primevue/button'

defineProps<{ entry: LexiconEntry; bookTitle?: string }>()
const emit = defineEmits<{ advance: []; reset: [] }>()

const flipped = ref(false)
const frontRef = ref<HTMLElement | null>(null)
const backRef = ref<HTMLElement | null>(null)
const innerHeight = ref(0)

// Measure the active face and drive the container height so the card
// always fits its content regardless of which face is showing.
const measureHeight = async (isFlipped: boolean) => {
  await nextTick()
  const el = isFlipped ? backRef.value : frontRef.value
  if (el) innerHeight.value = el.scrollHeight
}

onMounted(() => measureHeight(false))
watch(flipped, measureHeight)
</script>

<template>
  <div class="lc-wrap" @click="flipped = !flipped">
    <div
      class="lc-inner"
      :class="{ 'lc-inner--flipped': flipped }"
      :style="{ height: innerHeight ? innerHeight + 'px' : undefined }"
    >
      <!-- Front -->
      <div ref="frontRef" class="lc-face lc-front glass-surface">
        <div class="lc-front__top">
          <span class="lc-badge" :class="entry.entryType === 'dictionary' ? 'lc-badge--dict' : 'lc-badge--lore'">
            {{ entry.entryType === 'dictionary' ? 'Dictionary' : 'Lore' }}
          </span>
          <span v-if="entry.pageFound" class="lc-page">p.{{ entry.pageFound }}</span>
        </div>
        <p class="lc-term">{{ entry.term }}</p>
        <p v-if="bookTitle" class="lc-book-title">{{ bookTitle }}</p>
        <p class="lc-hint">tap to see definition</p>
      </div>

      <!-- Back -->
      <div ref="backRef" class="lc-face lc-back glass-surface" @click.stop>
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
}

.lc-inner {
  position: relative;
  width: 100%;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1),
              height 0.35s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.lc-inner--flipped { transform: rotateY(180deg); }

.lc-face {
  /* Anchored to top/left/right only — height is driven by content, not the
     container, so scrollHeight measurement reflects the true content size. */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  padding: 0.5rem 0;
}

.lc-book-title {
  margin: 0;
  font-size: 0.72rem;
  opacity: 0.45;
  font-weight: 500;
  letter-spacing: 0.01em;
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
