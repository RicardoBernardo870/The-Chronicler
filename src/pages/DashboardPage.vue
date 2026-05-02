<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useBooksStore } from "@/stores/books";
import { useProgressStore } from "@/stores/progress";
import { useUpNextStore } from "@/stores/upNext";
import { useLexiconStore } from "@/stores/lexicon";
import { useAuthStore } from "@/stores/auth";
import { useReadingPulse } from "@/composables/useReadingPulse";
import { useActiveBook } from "@/composables/useActiveBook";
import { useLoreCardsStore } from "@/stores/loreCards";
import { useRecapsStore } from "@/stores/recaps";
import { useRecapLock } from "@/composables/useRecapLock";

import HeroBookCard from "@/components/dashboard/HeroBookCard.vue";
import InProgressSection from "@/components/dashboard/InProgressSection.vue";
import UpNextSection from "@/components/dashboard/UpNextSection.vue";
import CompletedSection from "@/components/dashboard/CompletedSection.vue";
import LastSessionCard from "@/components/dashboard/LastSessionCard.vue";
import WordOfTheDay from "@/components/dashboard/WordOfTheDay.vue";
import Button from "primevue/button";
import Skeleton from "primevue/skeleton";
import EmptyState from "@/components/shared/EmptyState.vue";
import { useConfirm } from "primevue/useconfirm";
import ConfirmDialog from "primevue/confirmdialog";

const router = useRouter();
const booksStore = useBooksStore();
const progressStore = useProgressStore();
const upNextStore = useUpNextStore();
const lexiconStore = useLexiconStore();
const authStore = useAuthStore();
const loreStore = useLoreCardsStore();
const recapsStore = useRecapsStore();
const confirm = useConfirm();

// ── Active hero book ─────────────────────────────────────────────
const {
  activeBookId,
  activeBook,
  upNext: inProgressUpNext,
  setActive,
  onBookCompleted,
  initializeIfNeeded,
} = useActiveBook();

const currentBook = activeBook;

const currentProgress = computed(() =>
  activeBookId.value ? (progressStore.progressForBook(activeBookId.value) ?? null) : null,
);

const loading = ref(true)
const pageInput = ref<number>(0)
const saving = ref(false)
const saveError = ref<string | null>(null)
const justSaved = ref(false)
const recapTriggered = ref<boolean>(false)
const recapAbortController = ref<AbortController | null>(null)

const { recapLocked, pagesUntilUnlock } = useRecapLock(
  computed(() => activeBookId.value ?? ""),
);

const handleGetRecap = async () => {
  if (!currentBook.value) return;
  const abort = new AbortController();
  recapAbortController.value = abort;
  recapTriggered.value = true;
  recapsStore.resetStatus();
  await recapsStore.generateRecap(currentBook.value.id, abort.signal);
};

const handleDismissRecap = () => {
  recapAbortController.value?.abort();
  recapAbortController.value = null;
  recapTriggered.value = false;
  recapsStore.resetStatus();
};

onUnmounted(() => {
  if (recapTriggered.value) handleDismissRecap();
});

watch(activeBookId, (newId, _oldId, onCleanup) => {
  const ctrl = recapAbortController.value;
  onCleanup(() => { ctrl?.abort(); });

  if (newId) {
    pageInput.value = progressStore.progressForBook(newId)?.currentPage ?? 0;
    if (recapTriggered.value) {
      recapTriggered.value = false;
      recapsStore.resetStatus();
    }
    nextHeroPulse(newId);
    recapsStore.fetchRecapsForBook(newId).catch(() => {});
  }
});

let _pulseBookId: string | null = null;
let _pulse: ReturnType<typeof useReadingPulse> | null = null;

const nextHeroPulse = (bookId: string) => {
  if (_pulseBookId !== bookId) {
    _pulseBookId = bookId;
    _pulse = useReadingPulse(bookId);
  }
  _pulse?.fetchHistory();
};

const heroPulse = computed(() => {
  if (!activeBookId.value) return null;
  if (_pulseBookId !== activeBookId.value) {
    _pulseBookId = activeBookId.value;
    _pulse = useReadingPulse(activeBookId.value);
  }
  return _pulse;
});

const heroWarning = computed(() => (heroPulse.value?.continuityScore.value ?? 100) < 40)

onMounted(async () => {
  try {
    // 017 — single RPC replaces sequential fetchLibrary + fetchProgress pair
    await booksStore.fetchLibraryWithProgress()
    await Promise.all([
      progressStore.fetchProgress(),
      upNextStore.fetchOrder(),
    ])
    await lexiconStore.fetchEntriesForAllBooks()
    if (authStore.user) lexiconStore.resolveWordOfTheDay(authStore.user.id)
    loreStore.fetchLoreForAllBooks().catch(() => {})
    initializeIfNeeded()
    const id = activeBookId.value
    if (id) {
      recapsStore.fetchRecapsForBook(id).catch(() => {})
      nextHeroPulse(id)
      pageInput.value = progressStore.progressForBook(id)?.currentPage ?? 0
    }
  } finally { loading.value = false }
})

const upNextBooks = computed(() => {
  const zeroBooks = booksStore.books.filter(
    (b) => progressStore.percentageForBook(b.id) === 0,
  );
  const orderedIds = upNextStore.sortedBookIds();
  return [
    ...zeroBooks
      .filter((b) => orderedIds.includes(b.id))
      .sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
    ...zeroBooks.filter((b) => !orderedIds.includes(b.id)),
  ];
});

const completedPreview = computed(() => progressStore.completedBooks.slice(0, 2))
const completedOverflow = computed(() => Math.max(0, progressStore.completedBooks.length - 2))
const pendingSync = computed(() => progressStore.pendingSync)
const hasAnyBooks = computed(() => booksStore.books.length > 0)

const saveProgress = async () => {
  if (!currentBook.value) return;
  const page = Math.max(0, Math.min(pageInput.value ?? 0, currentBook.value.totalPages));
  saving.value = true;
  saveError.value = null;
  justSaved.value = false;
  try {
    const heroId = currentBook.value.id;
    const prevPct = progressStore.progressForBook(heroId)?.percentage ?? 0;
    await progressStore.updateProgress(heroId, page);
    justSaved.value = true;
    setTimeout(() => { justSaved.value = false; }, 2000);
    const newPct =
      currentBook.value.totalPages > 0
        ? (page / currentBook.value.totalPages) * 100
        : 0;
    if (newPct >= 100 && prevPct < 100) onBookCompleted(heroId);
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : "Failed to save";
  } finally {
    saving.value = false;
  }
};

const handleSessionConflict = (startedAt: Date) => {
  if (!activeBookId.value) return;
  const bookId = activeBookId.value;
  const timeStr = startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  confirm.require({
    message: `You have an unfinished session started at ${timeStr}. Start a new one?`,
    header: "Replace session?",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Start new session",
    rejectLabel: "Cancel",
    accept: async () => {
      try {
        await progressStore.startSession(bookId);
      } catch {
        // error surfaced by SessionStartButton internally
      }
    },
  });
};
</script>

<template>
  <div class="dashboard">
    <ConfirmDialog />
    <h1 class="dashboard__heading">Your Reading</h1>

    <Transition name="dashboard-switch" mode="out-in" appear>
    <!-- Loading -->
    <template v-if="loading" key="loading">
      <div class="dashboard__skeleton glass-surface">
        <Skeleton height="160px" border-radius="12px" />
        <Skeleton height="1.25rem" width="55%" style="margin-top: 1rem" />
        <Skeleton height="0.875rem" width="35%" style="margin-top: 0.5rem" />
      </div>
    </template>

    <!-- No books -->
    <EmptyState
      v-else-if="!hasAnyBooks"
      key="empty"
      icon="pi-book"
      title="No current read"
      description="Add your first book to start tracking your reading journey."
    >
      <template #action>
        <Button label="Add a book" icon="pi pi-plus" @click="router.push('/books/add')" />
      </template>
    </EmptyState>

    <TransitionGroup
      v-else
      key="sections"
      name="dashboard-section"
      tag="div"
      class="dashboard__sections"
      appear
    >
      <div v-if="currentBook" :key="`hero-${currentBook.id}`" class="dashboard__section">
        <HeroBookCard
          :book="currentBook"
          :progress="currentProgress"
          :saving="saving"
          :just-saved="justSaved"
          :save-error="saveError"
          :page-input="pageInput"
          :hero-warning="heroWarning"
          :pending-sync="pendingSync"
          :recap-triggered="recapTriggered"
          :recap-locked="recapLocked"
          :pages-until-unlock="pagesUntilUnlock"
          @update:page-input="(v) => (pageInput = v)"
          @save="saveProgress"
          @get-recap="handleGetRecap"
          @dismiss-recap="handleDismissRecap"
          @view-book="router.push({ name: 'book-detail', params: { id: currentBook!.id } })"
          @session-conflict="handleSessionConflict"
        />
      </div>

      <div key="word-of-day" class="dashboard__section">
        <WordOfTheDay />
      </div>

      <div key="last-session" class="dashboard__section">
        <LastSessionCard />
      </div>

      <div v-if="inProgressUpNext.length > 0" key="in-progress" class="dashboard__section">
        <InProgressSection
          :books="inProgressUpNext"
          @select="setActive"
          @view-book="(id) => router.push({ name: 'book-detail', params: { id } })"
        />
      </div>

      <div v-if="upNextBooks.length > 0" key="up-next" class="dashboard__section">
        <UpNextSection
          :books="upNextBooks"
          @update:books="(newOrder) => upNextStore.saveOrder(newOrder.map((b) => b.id))"
          @select="setActive"
        />
      </div>

      <div v-if="completedPreview.length > 0" key="completed" class="dashboard__section">
        <CompletedSection
          :books="completedPreview"
          :overflow="completedOverflow"
          @view-book="(id) => router.push({ name: 'book-detail', params: { id } })"
          @view-library="router.push('/library')"
        />
      </div>
    </TransitionGroup>
    </Transition>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard__heading {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.dashboard__skeleton {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
}

.dashboard__sections {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard__section {
  min-width: 0;
  will-change: transform, opacity;
}

.dashboard-switch-enter-active,
.dashboard-switch-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.dashboard-switch-enter-from,
.dashboard-switch-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.dashboard-section-enter-active,
.dashboard-section-leave-active,
.dashboard-section-move {
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.dashboard-section-enter-from,
.dashboard-section-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.dashboard-section-leave-active {
  position: absolute;
  width: calc(100% - 2rem);
  max-width: 680px;
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-switch-enter-active,
  .dashboard-switch-leave-active,
  .dashboard-section-enter-active,
  .dashboard-section-leave-active,
  .dashboard-section-move {
    transition: none;
  }

  .dashboard-switch-enter-from,
  .dashboard-switch-leave-to,
  .dashboard-section-enter-from,
  .dashboard-section-leave-to {
    transform: none;
  }
}
</style>
