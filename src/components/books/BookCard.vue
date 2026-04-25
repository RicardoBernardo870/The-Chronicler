<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Book } from '@/types'
import { useProgressStore } from '@/stores/progress'
import { useBooksStore } from '@/stores/books'
import { useLoreCardsStore } from '@/stores/loreCards'
import { useConfirm } from 'primevue/useconfirm'
import { useReadingPulse } from '@/composables/useReadingPulse'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Menu from 'primevue/menu'
import BookEditDialog from '@/components/books/BookEditDialog.vue'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{
  book: Book
}>()

const router = useRouter()
const progressStore = useProgressStore()
const booksStore = useBooksStore()
const loreStore = useLoreCardsStore()
const confirm = useConfirm()

const percentage = computed(() => progressStore.percentageForBook(props.book.id))
const hasNewLore  = computed(() => loreStore.hasUnseenLore(props.book.id))

const initials = computed(() =>
  props.book.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)

const navigate = () => router.push({ name: 'book-detail', params: { id: props.book.id } })

// "New Lore" chip tap — stopPropagation, then navigate to book detail
// (markBookLoreSeen fires on BookDetailPage mount, clearing the chip)
const onNewLoreChip = (e: Event) => {
  e.stopPropagation()
  navigate()
}

// Overflow menu
const menu = ref()
const editVisible = ref(false)

const menuItems = [
  {
    label: 'Edit book',
    icon: 'pi pi-pencil',
    command: () => { editVisible.value = true },
  },
  {
    label: 'Remove book',
    icon: 'pi pi-trash',
    command: () => {
      confirm.require({
        message: 'Remove this book and all its data? This cannot be undone.',
        header: 'Remove Book',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: 'Cancel',
        acceptLabel: 'Remove',
        acceptClass: 'p-button-danger',
        accept: () => booksStore.removeBook(props.book.id),
      })
    },
  },
]

const toggleMenu = (event: Event) => {
  event.stopPropagation()
  menu.value.toggle(event)
}

// Reading streak
const pulse = useReadingPulse(props.book.id)
pulse.fetchHistory()
const streak = pulse.streak
</script>

<template>
  <BookEditDialog v-if="editVisible" :book="book" :visible="editVisible" @update:visible="editVisible = $event" @close="editVisible = false" />

  <article class="book-card glass-surface" role="button" tabindex="0" @click="navigate" @keydown.enter="navigate">
    <!-- "New Lore" chip (FR-026, FR-027) -->
    <button
      v-if="hasNewLore"
      class="book-card__new-lore-chip"
      aria-label="New lore unlocked — tap to view"
      @click="onNewLoreChip"
    >
      <i class="pi pi-sparkles" />
      New Lore
    </button>

    <!-- Overflow menu button -->
    <Menu ref="menu" :model="menuItems" popup />
    <Button
      icon="pi pi-ellipsis-v"
      text
      rounded
      size="small"
      class="book-card__menu-btn"
      aria-label="Book options"
      @click="toggleMenu"
    />

    <div class="book-card__cover-wrap">
      <img
        v-if="book.coverUrl"
        :src="book.coverUrl"
        :alt="`Cover of ${book.title}`"
        class="book-card__cover"
        @error="coverFallback"
      />
      <div class="book-card__cover-placeholder" :class="{ 'book-card__cover-placeholder--hidden': book.coverUrl }">
        <span class="book-card__initials">{{ initials }}</span>
      </div>
    </div>

    <div class="book-card__body">
      <Chip v-if="book.genre" :label="book.genre" class="book-card__genre" />
      <h3 class="book-card__title">{{ book.title }}</h3>
      <p class="book-card__author">{{ book.author }}</p>

      <div class="book-card__progress">
        <div class="book-card__progress-track glass-track">
          <div class="book-card__progress-fill" :style="{ width: `${percentage}%` }" />
        </div>
        <span class="book-card__progress-pct">{{ percentage.toFixed(0) }}%</span>
      </div>

      <div v-if="streak > 0" class="book-card__streak">
        🔥 {{ streak }}-day streak
      </div>
    </div>
  </article>
</template>

<style scoped>
.book-card {
  position: relative;
  display: flex;
  gap: 1rem;
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1rem;
  padding-right: 2.5rem; /* room for the ⋮ button */
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.book-card__menu-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.25rem;
  width: 32px !important;
  height: 32px !important;
  opacity: 0.55;
  transition: opacity 0.15s;
  z-index: 1;
}

.book-card:hover .book-card__menu-btn { opacity: 1; }

.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}

.book-card:active { transform: scale(0.98); }

.book-card__cover-wrap {
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 92px;
}

.book-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.book-card__cover-placeholder {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2));
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-card__cover-placeholder--hidden {
  display: none;
}

.book-card__initials {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--p-indigo-200);
  letter-spacing: -0.02em;
}

.book-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.book-card__genre {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: rgba(99,102,241,0.15);
  align-self: flex-start;
  margin-bottom: 0.15rem;
}

.book-card__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card__author {
  margin: 0;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.book-card__progress-track {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
}

.book-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--p-indigo-400), var(--p-violet-400, #a78bfa));
  border-radius: 999px;
  transition: width 0.4s ease;
}

.book-card__progress-pct {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 32px;
  text-align: right;
}

.book-card__streak {
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 0.3rem;
  opacity: 0.8;
}

/* ── New Lore chip (FR-026) ───────────────────────────────────────────────── */

.book-card__new-lore-chip {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.25rem 0.55rem 0.25rem 0.45rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(167, 139, 250, 0.85));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition: opacity 0.15s, transform 0.15s;
}

.book-card__new-lore-chip:hover {
  opacity: 0.9;
  transform: scale(1.04);
}

.book-card__new-lore-chip .pi {
  font-size: 0.65rem;
}
</style>
