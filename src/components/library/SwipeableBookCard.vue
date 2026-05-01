<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Book } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import BookCard from '@/components/books/BookCard.vue'

// ── Module-level shared state: only one card open at a time ───────────────
const openCardId = ref<string | null>(null)

const props = defineProps<{
  book: Book
  daysLeft?: VelocityResult
}>()

const emit = defineEmits<{
  edit: [book: Book]
  delete: [book: Book]
}>()

// ── Touch / swipe state ───────────────────────────────────────────────────

const translateX = ref(0)
const ACTION_WIDTH = 152  // total width of the two action buttons (px)
const THRESHOLD   = 72    // minimum drag distance to snap open (px)

let startX           = 0
let startTranslateX  = 0  // translateX captured at touch-start
let isDragging       = false

// Only activate swipe on pointer-coarse (touch) devices
const isTouchDevice = computed(() =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
)

// Actions are only visible while the card is actually displaced
const isOpen = computed(() => translateX.value < 0)

// Close this card when another one opens
watch(openCardId, (id) => {
  if (id !== props.book.id) translateX.value = 0
})

onUnmounted(() => {
  if (openCardId.value === props.book.id) openCardId.value = null
})

const snapOpen = () => {
  translateX.value = -ACTION_WIDTH
  openCardId.value = props.book.id
}

const snapClose = () => {
  translateX.value = 0
  if (openCardId.value === props.book.id) openCardId.value = null
}

const onTouchStart = (e: TouchEvent) => {
  if (!isTouchDevice.value) return
  startX          = e.touches[0].clientX
  startTranslateX = translateX.value   // remember where we started
  isDragging      = true
}

const onTouchMove = (e: TouchEvent) => {
  if (!isDragging || !isTouchDevice.value) return
  const delta = e.touches[0].clientX - startX
  // Offset from wherever the card already was, clamped to [-ACTION_WIDTH, 0]
  translateX.value = Math.max(-ACTION_WIDTH, Math.min(0, startTranslateX + delta))
}

const onTouchEnd = (e: TouchEvent) => {
  if (!isDragging || !isTouchDevice.value) return
  isDragging = false
  const delta = e.changedTouches[0].clientX - startX
  const finalX = startTranslateX + delta

  if (finalX < -THRESHOLD) snapOpen()
  else snapClose()
}

// Tap the card itself while open → close it
const onCardClick = () => {
  if (isOpen.value) snapClose()
}

const onEdit = (e: Event) => {
  e.stopPropagation()
  snapClose()
  emit('edit', props.book)
}

const onDelete = (e: Event) => {
  e.stopPropagation()
  snapClose()
  emit('delete', props.book)
}
</script>

<template>
  <div
    class="swipeable-wrap"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Action buttons — only mounted in the DOM when the card is displaced -->
    <div v-show="isOpen" class="swipeable-actions" aria-hidden="true">
      <button class="swipeable-action swipeable-action--edit" @click="onEdit">
        <i class="pi pi-pencil" />
        <span>Edit</span>
      </button>
      <button class="swipeable-action swipeable-action--delete" @click="onDelete">
        <i class="pi pi-trash" />
        <span>Delete</span>
      </button>
    </div>

    <!-- Book card — translated left on swipe to reveal actions -->
    <div
      class="swipeable-card"
      :style="{ transform: `translateX(${translateX}px)` }"
      @click="onCardClick"
    >
      <BookCard :book="book" :days-left="daysLeft" />
    </div>
  </div>
</template>

<style scoped>
.swipeable-wrap {
  position: relative;
  /* Clip action buttons so they never bleed outside the card bounds */
  overflow: hidden;
  border-radius: var(--glass-border-radius, 20px);
}

/* ── Action button strip ──────────────────────────────────────────────── */

.swipeable-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 152px;
  display: flex;
  z-index: 0;          /* behind the card (z-index: 1) */
  border-radius: 0 var(--glass-border-radius, 20px) var(--glass-border-radius, 20px) 0;
  overflow: hidden;
}

.swipeable-action {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  border: none;
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #fff;
  transition: filter 0.12s;
}

.swipeable-action:active {
  filter: brightness(0.85);
}

.swipeable-action .pi {
  font-size: 1.05rem;
}

.swipeable-action--edit {
  background: transparent;
  color: var(--text-color);
}

.swipeable-action--delete {
  background: transparent;
  color: var(--text-color);
}

/* ── Sliding card layer ───────────────────────────────────────────────── */

.swipeable-card {
  position: relative;
  z-index: 1;
  transition: transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform;
  /* Ensure the card surface is fully opaque so actions can't bleed through */
  border-radius: inherit;
}
</style>
