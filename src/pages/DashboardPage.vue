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
import { useDashboardOnboardingState } from "@/composables/useDashboardOnboardingState";
import { useLoreCardsStore } from "@/stores/loreCards";
import { useRecapsStore } from "@/stores/recaps";
import { useRecapLock } from "@/composables/useRecapLock";
import { useAnkiSessionStore } from "@/stores/ankiSession";
import { useCapturesStore } from "@/stores/captures";

import HeroBookCard from "@/components/dashboard/HeroBookCard.vue";
import InProgressSection from "@/components/dashboard/InProgressSection.vue";
import UpNextSection from "@/components/dashboard/UpNextSection.vue";
import CompletedSection from "@/components/dashboard/CompletedSection.vue";
import LastSessionCard from "@/components/dashboard/LastSessionCard.vue";
import WordOfTheDay from "@/components/dashboard/WordOfTheDay.vue";
import Skeleton from "primevue/skeleton";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState.vue";
import CompletedOnlyState from "@/components/dashboard/CompletedOnlyState.vue";
import { useConfirm } from "primevue/useconfirm";

const router = useRouter();
const booksStore = useBooksStore();
const progressStore = useProgressStore();
const upNextStore = useUpNextStore();
const lexiconStore = useLexiconStore();
const authStore = useAuthStore();
const loreStore = useLoreCardsStore();
const ankiSessionStore = useAnkiSessionStore();
const recapsStore = useRecapsStore();
const capturesStore = useCapturesStore();
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
const { state: dashboardState } = useDashboardOnboardingState();

const currentProgress = computed(() =>
  activeBookId.value
    ? (progressStore.progressForBook(activeBookId.value) ?? null)
    : null,
);

const loading = ref(true);
const pageInput = ref<number>(0);
const saving = ref(false);
const saveError = ref<string | null>(null);
const justSaved = ref(false);
const recapTriggered = ref<boolean>(false);
const recapAbortController = ref<AbortController | null>(null);

const { recapLocked, pagesUntilUnlock, recapLockLabel } = useRecapLock(
  computed(() => activeBookId.value ?? ""),
);

const doGenerateRecap = async () => {
  if (!currentBook.value) return;
  const abort = new AbortController();
  recapAbortController.value = abort;
  recapTriggered.value = true;
  recapsStore.resetStatus();
  await recapsStore.generateRecap(currentBook.value.id, abort.signal);
};

const handleGetRecap = async () => {
  if (!currentBook.value) return;
  const bookId = currentBook.value.id;
  const fromPage = recapsStore.recapHistoryForBook(bookId)?.[0]?.pageSnapshot ?? 0;
  const currentPage = currentProgress.value?.currentPage ?? 0;
  await capturesStore.fetchCapturesForBook(bookId).catch(() => {});
  const inRange = capturesStore.capturesInRange(bookId, fromPage, currentPage);

  if (inRange.length === 0) {
    confirm.require({
      message: "Without scanned pages, this recap is generated from your book's metadata and may be less accurate or contain spoilers. Continue?",
      header: "Inferred recap",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Generate anyway",
      rejectLabel: "Cancel",
      accept: () => { doGenerateRecap(); },
    });
    return;
  }
  await doGenerateRecap();
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
  onCleanup(() => {
    ctrl?.abort();
  });

  if (newId) {
    pageInput.value = progressStore.progressForBook(newId)?.currentPage ?? 0;
    if (recapTriggered.value) {
      recapTriggered.value = false;
      recapsStore.resetStatus();
    }
    nextHeroPulse(newId);
    recapsStore.fetchRecapsForBook(newId).catch(() => {});
  } else {
    pageInput.value = 0;
    if (recapTriggered.value) {
      recapTriggered.value = false;
      recapsStore.resetStatus();
    }
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

const heroWarning = computed(
  () => (heroPulse.value?.continuityScore.value ?? 100) < 40,
);

onMounted(async () => {
  try {
    // 017 — single RPC replaces sequential fetchLibrary + fetchProgress pair
    await booksStore.fetchLibraryWithProgress();
    await Promise.all([
      progressStore.fetchProgress(),
      upNextStore.fetchOrder(),
    ]);
    await lexiconStore.fetchEntriesForAllBooks();
    if (authStore.user) {
      lexiconStore.resolveWordOfTheDay(authStore.user.id)
      ankiSessionStore.fetchSession(authStore.user.id).catch(() => {})
    }
    loreStore.fetchLoreForAllBooks().catch(() => {});
    initializeIfNeeded();
    const id = activeBookId.value;
    if (id) {
      recapsStore.fetchRecapsForBook(id).catch(() => {});
      nextHeroPulse(id);
      pageInput.value = progressStore.progressForBook(id)?.currentPage ?? 0;
    }
  } finally {
    loading.value = false;
  }
});

watch(
  () =>
    progressStore.inProgressBooks
      .map((item) => `${item.book.id}:${item.progress.updatedAt}`)
      .join("|"),
  () => {
    if (!loading.value) initializeIfNeeded();
  },
);

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

const completedPreview = computed(() =>
  progressStore.completedBooks.slice(0, 2),
);
const completedOverflow = computed(() =>
  Math.max(0, progressStore.completedBooks.length - 2),
);
const pendingSync = computed(() => progressStore.pendingSync);
const showReadingSupportSections = computed(
  () =>
    dashboardState.value.kind === "standard" ||
    dashboardState.value.kind === "oneInProgress",
);
const showInProgressSection = computed(
  () => showReadingSupportSections.value && inProgressUpNext.value.length > 0,
);
const showUpNextSection = computed(
  () =>
    dashboardState.value.kind === "standard" && upNextBooks.value.length > 0,
);
const showCompletedSection = computed(
  () =>
    dashboardState.value.kind !== "completedOnly" &&
    completedPreview.value.length > 0,
);

const saveProgress = async () => {
  if (!currentBook.value) return;
  const heroId = currentBook.value.id;
  const page = Math.max(
    0,
    Math.min(pageInput.value ?? 0, currentBook.value.totalPages),
  );
  const currentStoredPage = progressStore.progressForBook(heroId)?.currentPage ?? 0;
  const sessionActive = Boolean(progressStore.progressForBook(heroId)?.sessionStartAt);

  if (sessionActive && page === currentStoredPage) {
    confirm.require({
      message: "You need to update your page count to save a session.",
      header: "No pages read",
      icon: "pi pi-info-circle",
      acceptLabel: "Update pages",
      rejectLabel: "Cancel session",
      rejectClass: "p-button-danger",
      accept: () => { /* dismiss — user will update page input */ },
      reject: async () => {
        try { await progressStore.clearSession(heroId) } catch { /* silent */ }
      },
    });
    return;
  }

  saving.value = true;
  saveError.value = null;
  justSaved.value = false;
  try {
    const prevPct = progressStore.progressForBook(heroId)?.percentage ?? 0;
    await progressStore.updateProgress(heroId, page);
    justSaved.value = true;
    setTimeout(() => {
      justSaved.value = false;
    }, 2000);
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

const handleCancelSession = () => {
  if (!activeBookId.value) return;
  const bookId = activeBookId.value;
  confirm.require({
    message: "Cancel this session? No progress will be saved.",
    header: "Cancel session?",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Cancel session",
    rejectLabel: "Keep session",
    acceptClass: "p-button-danger",
    accept: async () => {
      try { await progressStore.clearSession(bookId) } catch { /* silent */ }
    },
  });
};
</script>

<template>
  <div class="dashboard">
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
      <DashboardEmptyState
        v-else-if="dashboardState.kind === 'empty'"
        key="empty"
        variant="empty"
        @add-book="router.push('/books/add')"
      />

      <DashboardEmptyState
        v-else-if="dashboardState.kind === 'oneQueued'"
        key="one-queued"
        variant="queued"
        :book="dashboardState.singleQueuedBook"
        @add-book="router.push('/books/add')"
        @start-book="
          (id) => router.push({ name: 'book-detail', params: { id } })
        "
      />

      <CompletedOnlyState
        v-else-if="dashboardState.kind === 'completedOnly'"
        key="completed-only"
        :books="dashboardState.recentCompletedBooks"
        :count="dashboardState.completedBookCount"
        @add-book="router.push('/books/add')"
        @view-book="
          (id) => router.push({ name: 'book-detail', params: { id } })
        "
        @view-library="router.push('/library')"
      />

      <TransitionGroup
        v-else
        key="sections"
        name="dashboard-section"
        tag="div"
        class="dashboard__sections"
        appear
      >
        <div
          v-if="currentBook"
          :key="`hero-${currentBook.id}`"
          class="dashboard__section"
        >
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
            :recap-lock-label="recapLockLabel"
            @update:page-input="(v) => (pageInput = v)"
            @save="saveProgress"
            @get-recap="handleGetRecap"
            @dismiss-recap="handleDismissRecap"
            @view-book="
              router.push({
                name: 'book-detail',
                params: { id: currentBook!.id },
              })
            "
            @cancel-session="handleCancelSession"
          />
        </div>

        <div
          v-if="showReadingSupportSections"
          key="word-of-day"
          class="dashboard__section"
        >
          <WordOfTheDay />
        </div>

        <div
          v-if="showReadingSupportSections"
          key="last-session"
          class="dashboard__section"
        >
          <LastSessionCard />
        </div>

        <div
          v-if="showInProgressSection"
          key="in-progress"
          class="dashboard__section"
        >
          <InProgressSection
            :books="inProgressUpNext"
            @select="setActive"
            @view-book="
              (id) => router.push({ name: 'book-detail', params: { id } })
            "
          />
        </div>

        <div v-if="showUpNextSection" key="up-next" class="dashboard__section">
          <UpNextSection
            :books="upNextBooks"
            @update:books="
              (newOrder) => upNextStore.saveOrder(newOrder.map((b) => b.id))
            "
            @select="setActive"
          />
        </div>

        <div
          v-if="showCompletedSection"
          key="completed"
          class="dashboard__section"
        >
          <CompletedSection
            :books="completedPreview"
            :overflow="completedOverflow"
            @view-book="
              (id) => router.push({ name: 'book-detail', params: { id } })
            "
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
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
