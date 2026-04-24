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

import RecapStream from "@/components/recap/RecapStream.vue";
import LastSessionCard from "@/components/dashboard/LastSessionCard.vue";
import SessionStartButton from "@/components/session/SessionStartButton.vue";
import Button from "primevue/button";
import ProgressBar from "primevue/progressbar";
import InputNumber from "primevue/inputnumber";
import Skeleton from "primevue/skeleton";
import EmptyState from "@/components/shared/EmptyState.vue";
import WordOfTheDay from "@/components/dashboard/WordOfTheDay.vue";
import draggable from "vuedraggable";
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

// ── Active hero book (US1, US2, 011-dashboard-state-refactor) ────────────────
const {
  activeBookId,
  activeBook,
  upNext: inProgressUpNext,
  setActive,
  onBookCompleted,
  initializeIfNeeded,
} = useActiveBook();

// currentBook alias for readability in the template
const currentBook = activeBook;

// ── Progress — always derived from activeBookId, never from a stale local ref ─
const currentProgress = computed(() =>
  activeBookId.value ? progressStore.progressForBook(activeBookId.value) : null,
);

const loading = ref(true);
const pageInput = ref<number>(0);
const saving = ref(false);
const saveError = ref<string | null>(null);
const justSaved = ref(false);

// ── Inline Recap session state (US2, 010-dashboard-ux-sync) ──────────────────
const recapTriggered = ref<boolean>(false);
const recapAbortController = ref<AbortController | null>(null);

// ── Recap lock (shared composable, FR-013) ───────────────────────────────────
const { recapLocked, pagesUntilUnlock } = useRecapLock(
  computed(() => activeBookId.value ?? ""),
);

// ── Recap handlers ────────────────────────────────────────────────────────────
const handleGetRecap = async () => {
  if (!currentBook.value) return;
  const abort = new AbortController();
  recapAbortController.value = abort;
  recapTriggered.value = true;
  recapsStore.resetStatus();
  await recapsStore.generateRecap(currentBook.value.id, abort.signal);
};

const handleRecapDismiss = () => {
  recapAbortController.value?.abort();
  recapAbortController.value = null;
  recapTriggered.value = false;
  recapsStore.resetStatus();
};

onUnmounted(() => {
  if (recapTriggered.value) handleRecapDismiss();
});

// ── Watch hero bookId changes — reset local state + abort in-flight recap ────
// Uses onCleanup form so any pending abort fires before the next effect (FR-010)
watch(activeBookId, (newId, _oldId, onCleanup) => {
  // Abort any in-flight recap stream when the hero changes
  const ctrl = recapAbortController.value;
  onCleanup(() => {
    ctrl?.abort();
  });

  if (newId) {
    // Reset UI inputs to the new book's current progress
    pageInput.value = progressStore.progressForBook(newId)?.currentPage ?? 0;
    // Dismiss any open recap panel for the old book
    if (recapTriggered.value) {
      recapTriggered.value = false;
      recapsStore.resetStatus();
    }
    // Reload pulse history for new hero
    nextHeroPulse(newId);
    // Hydrate recap history for lock state
    recapsStore.fetchRecapsForBook(newId).catch(() => {});
  }
});

// ── Reading pulse for hero continuity warning ─────────────────────────────────
// Keep a pulse instance per bookId; refresh fetchHistory when hero changes.
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
    await booksStore.fetchLibrary();
    await progressStore.fetchProgress();
    await upNextStore.fetchOrder();
    // Load all lexicon entries in a single query (powers WordOfTheDay)
    await lexiconStore.fetchEntriesForAllBooks();
    // Seed the per-day Word of the Day selection
    if (authStore.user) lexiconStore.resolveWordOfTheDay(authStore.user.id);
    // Fetch lore so chips are reactive on all visible book cards
    loreStore.fetchLoreForAllBooks().catch(() => {});

    // ── Initialize hero after stores are hydrated ──
    initializeIfNeeded();

    // Hydrate recap history so recap lock state is accurate on mount
    if (activeBookId.value)
      recapsStore.fetchRecapsForBook(activeBookId.value).catch(() => {});
    // Load reading pulse for hero card
    if (activeBookId.value) nextHeroPulse(activeBookId.value);
    // Seed page input from hero's current progress
    if (activeBookId.value) {
      pageInput.value =
        progressStore.progressForBook(activeBookId.value)?.currentPage ?? 0;
    }
  } finally {
    loading.value = false;
  }
});

// ── In Progress Others (swap candidates) ─────────────────────────────────────
// inProgressUpNext from useActiveBook = in-progress books excluding the hero.
// T021: shown only when there are items; otherwise section is hidden.

// ── Up Next section (0%-progress books, drag-to-reorder — unchanged) ─────────
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

// Mutable list for vuedraggable
const upNextDraggable = computed({
  get: () => upNextBooks.value,
  set: (newOrder) => {
    upNextStore.saveOrder(newOrder.map((b) => b.id));
  },
});

// Completed section
const completedPreview = computed(() =>
  progressStore.completedBooks.slice(0, 2),
);
const completedOverflow = computed(() =>
  Math.max(0, progressStore.completedBooks.length - 2),
);

const pendingSync = computed(() => progressStore.pendingSync);

const hasAnyBooks = computed(() => booksStore.books.length > 0);

const saveProgress = async () => {
  if (!currentBook.value) return;
  const page = Math.max(
    0,
    Math.min(pageInput.value ?? 0, currentBook.value.totalPages),
  );
  saving.value = true;
  saveError.value = null;
  justSaved.value = false;
  try {
    const heroId = currentBook.value.id;
    const prevPct = progressStore.progressForBook(heroId)?.percentage ?? 0;
    await progressStore.updateProgress(heroId, page);
    justSaved.value = true;
    setTimeout(() => {
      justSaved.value = false;
    }, 2000);

    // Trigger hero promotion if current book was just completed (FR-005)
    const newPct =
      currentBook.value.totalPages > 0
        ? (page / currentBook.value.totalPages) * 100
        : 0;
    if (newPct >= 100 && prevPct < 100) {
      onBookCompleted(heroId);
    }
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : "Failed to save";
  } finally {
    saving.value = false;
  }
};

const coverFallback = (e: Event) => {
  const img = e.target as HTMLImageElement;
  img.style.display = "none";
};

// ── Session conflict handling (T014, 013) ─────────────────────────────────
// When SessionStartButton emits conflictWarning, we show a confirm dialog.
// On confirmation, startSession() is called again to overwrite the old one.
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
    <!-- ConfirmDialog for session-conflict prompt (013) -->
    <ConfirmDialog />

    <h1 class="dashboard__heading">Your Reading</h1>

    <!-- Loading -->
    <template v-if="loading">
      <div class="dashboard__current glass-surface">
        <Skeleton height="160px" border-radius="12px" />
        <Skeleton height="1.25rem" width="55%" style="margin-top: 1rem" />
        <Skeleton height="0.875rem" width="35%" style="margin-top: 0.5rem" />
      </div>
    </template>

    <!-- No books at all -->
    <EmptyState
      v-else-if="!hasAnyBooks"
      icon="pi-book"
      title="No current read"
      description="Add your first book to start tracking your reading journey."
    >
      <template #action>
        <Button
          label="Add a book"
          icon="pi pi-plus"
          @click="router.push('/books/add')"
        />
      </template>
    </EmptyState>

    <template v-else>
      <!-- Hero: currently-active book (useActiveBook) -->
      <article
        v-if="currentBook"
        class="dashboard__current glass-surface"
        :class="{ 'dashboard__current--warning': heroWarning }"
      >
        <!-- New Lore chip -->
        <button
          v-if="loreStore.hasUnseenLore(currentBook.id)"
          class="dashboard__new-lore-chip"
          aria-label="New lore unlocked — tap to view"
          @click.stop="
            router.push({ name: 'book-detail', params: { id: currentBook.id } })
          "
        >
          <i class="pi pi-sparkles" />
          New Lore
        </button>

        <div class="dashboard__hero">
          <div class="dashboard__cover-wrap">
            <img
              v-if="currentBook.coverUrl"
              :src="currentBook.coverUrl"
              :alt="`Cover of ${currentBook.title}`"
              class="dashboard__cover"
              @error="coverFallback"
            />
            <div v-else class="dashboard__cover-placeholder">
              <i class="pi pi-book" style="font-size: 2.5rem; opacity: 0.35" />
            </div>
          </div>

          <div class="dashboard__meta">
            <span v-if="currentBook.genre" class="dashboard__genre">{{
              currentBook.genre
            }}</span>
            <h2 class="dashboard__title">{{ currentBook.title }}</h2>
            <p class="dashboard__author">{{ currentBook.author }}</p>

            <div class="dashboard__progress-row">
              <ProgressBar
                :value="currentProgress?.percentage ?? 0"
                :show-value="false"
                class="dashboard__progress-bar"
              />
              <span class="dashboard__pct"
                >{{ (currentProgress?.percentage ?? 0).toFixed(1) }}%</span
              >
            </div>

            <p class="dashboard__page-hint">
              Page {{ currentProgress?.currentPage ?? 0 }} of
              {{ currentBook.totalPages }}
            </p>
          </div>
        </div>

        <div class="dashboard__update">
          <InputNumber
            v-model="pageInput"
            :min="0"
            :max="currentBook.totalPages"
            placeholder="Update page"
            show-buttons
            :step="1"
            fluid
            class="dashboard__page-input"
          />
          <Button
            :icon="justSaved ? 'pi pi-check' : 'pi pi-check'"
            :loading="saving"
            :severity="justSaved ? 'success' : 'primary'"
            :aria-label="justSaved ? 'Saved!' : 'Save progress'"
            v-tooltip.top="justSaved ? 'Saved!' : 'Save'"
            @click="saveProgress"
          />
          <SessionStartButton
            v-if="currentBook"
            :book-id="currentBook.id"
            :icon-only="true"
            @conflict-warning="handleSessionConflict"
          />
        </div>

        <p v-if="saveError" class="dashboard__error">
          <i class="pi pi-exclamation-triangle" /> {{ saveError }}
        </p>

        <div v-if="heroWarning" class="dashboard__continuity-warning">
          <i class="pi pi-exclamation-triangle" />
          It's been a while — time for a Memory Jogger?
        </div>

        <div v-if="pendingSync" class="dashboard__offline-badge">
          <i class="pi pi-wifi" style="opacity: 0.5" />
          Progress will sync when you're back online
        </div>

        <div class="dashboard__actions">
          <Button
            v-if="!recapTriggered && recapLocked"
            :label="`🔒 ${pagesUntilUnlock} more pages`"
            disabled
            class="dashboard__action-btn dashboard__action-btn--locked"
            v-tooltip.top="
              'You unlock a new recap every 5% of progress, or after 3 days away'
            "
          />
          <Button
            v-else
            :label="recapTriggered ? 'Recap open' : 'Get Recap'"
            icon="pi pi-sparkles"
            class="dashboard__action-btn"
            :disabled="recapTriggered"
            @click="handleGetRecap"
          />
          <!-- View Book: only navigation path to BookDetailsPage (FR-004) -->
          <Button
            label="View Book"
            icon="pi pi-book"
            class="glass-surface dashboard__action-btn"
            outlined
            @click="
              router.push({
                name: 'book-detail',
                params: { id: currentBook!.id },
              })
            "
          />
        </div>

      </article>

      <!-- Inline Recap Panel (US2, 010-dashboard-ux-sync) -->
      <div v-if="recapTriggered" class="dashboard__inline-panel glass-surface">
        <div class="dashboard__inline-panel-header">
          <span class="dashboard__inline-panel-title">AI Recap</span>
          <button
            class="dashboard__inline-dismiss"
            aria-label="Dismiss recap"
            @click="handleRecapDismiss"
          >
            <i class="pi pi-times" />
          </button>
        </div>
        <RecapStream :bookId="currentBook!.id" />
      </div>

      <!-- Word of the Day -->
      <WordOfTheDay />

      <!-- Last Session Card (US4, 011-dashboard-state-refactor) -->
      <LastSessionCard />

      <!-- In Progress section — other in-progress books, swap-capable (US2) -->
      <section
        v-if="inProgressUpNext.length > 0"
        class="dashboard__section glass-surface"
      >
        <h3 class="dashboard__section-title">
          <i class="pi pi-book-open" /> In Progress
        </h3>
        <ul class="dashboard__book-list">
          <li
            v-for="book in inProgressUpNext"
            :key="book.id"
            class="dashboard__book-item glass-subtle"
            role="button"
            tabindex="0"
            :aria-label="`Switch to ${book.title}`"
            @click="setActive(book.id)"
            @keydown.enter="setActive(book.id)"
          >
            <button
              v-if="loreStore.hasUnseenLore(book.id)"
              class="dashboard__new-lore-chip dashboard__new-lore-chip--sm"
              aria-label="New lore unlocked — tap to view"
              @click.stop="
                router.push({ name: 'book-detail', params: { id: book.id } })
              "
            >
              <i class="pi pi-sparkles" />
              New Lore
            </button>
            <img
              v-if="book.coverUrl"
              :src="book.coverUrl"
              :alt="book.title"
              class="dashboard__book-thumb"
              @error="coverFallback"
            />
            <div
              v-else
              class="dashboard__book-thumb dashboard__book-thumb--placeholder"
            >
              <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
            </div>
            <div class="dashboard__book-info">
              <span class="dashboard__book-title">{{ book.title }}</span>
              <span class="dashboard__book-author">{{ book.author }}</span>
              <div class="dashboard__book-progress-row">
                <ProgressBar
                  :value="progressStore.percentageForBook(book.id)"
                  :show-value="false"
                  class="dashboard__book-bar"
                />
                <span class="dashboard__book-pct"
                  >{{
                    progressStore.percentageForBook(book.id).toFixed(0)
                  }}%</span
                >
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Up Next section (0%-progress books, drag-to-reorder — unchanged) -->
      <section
        v-if="upNextBooks.length > 0"
        class="dashboard__section glass-surface"
      >
        <h3 class="dashboard__section-title">
          <i class="pi pi-clock" /> Up Next
        </h3>
        <draggable
          v-model="upNextDraggable"
          item-key="id"
          handle=".up-next__handle"
          :animation="150"
          tag="ul"
          class="dashboard__book-list"
        >
          <template #item="{ element: book }">
            <li
              class="dashboard__book-item glass-subtle up-next__item"
              @click="setActive(book.id)"
              @keydown.enter="setActive(book.id)"
            >
              <span class="up-next__handle" @click.stop title="Drag to reorder"
                >⠿</span
              >
              <img
                v-if="book.coverUrl"
                :src="book.coverUrl"
                :alt="book.title"
                class="dashboard__book-thumb"
                @error="coverFallback"
              />
              <div
                v-else
                class="dashboard__book-thumb dashboard__book-thumb--placeholder"
              >
                <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
              </div>
              <div class="dashboard__book-info">
                <span class="dashboard__book-title">{{ book.title }}</span>
                <span class="dashboard__book-author">{{ book.author }}</span>
              </div>
            </li>
          </template>
        </draggable>
      </section>

      <!-- Completed section -->
      <section
        v-if="completedPreview.length > 0"
        class="dashboard__section glass-surface"
      >
        <h3 class="dashboard__section-title">
          <i class="pi pi-check-circle" /> Completed
        </h3>
        <ul class="dashboard__book-list">
          <li
            v-for="item in completedPreview"
            :key="item.book.id"
            class="dashboard__book-item glass-subtle"
            @click="
              router.push({ name: 'book-detail', params: { id: item.book.id } })
            "
          >
            <img
              v-if="item.book.coverUrl"
              :src="item.book.coverUrl"
              :alt="item.book.title"
              class="dashboard__book-thumb"
              @error="coverFallback"
            />
            <div
              v-else
              class="dashboard__book-thumb dashboard__book-thumb--placeholder"
            >
              <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
            </div>
            <div class="dashboard__book-info">
              <span class="dashboard__book-title">{{ item.book.title }}</span>
              <span class="dashboard__book-author">{{ item.book.author }}</span>
              <span class="dashboard__book-complete-badge">
                <i class="pi pi-check" /> Finished
              </span>
            </div>
          </li>
        </ul>

        <p v-if="completedOverflow > 0" class="dashboard__overflow-hint">
          <i class="pi pi-info-circle" />
          and {{ completedOverflow }} more —
          <button
            class="dashboard__overflow-link"
            @click="router.push('/library')"
          >
            check your Library
          </button>
        </p>
      </section>
    </template>
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

/* ── Hero card ────────────────────────────────────────────────── */
.dashboard__current {
  position: relative;
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard__hero {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.dashboard__cover-wrap {
  flex-shrink: 0;
}

.dashboard__cover {
  width: 88px;
  height: 128px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.dashboard__cover-placeholder {
  width: 88px;
  height: 128px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dashboard__genre {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-400);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  align-self: flex-start;
  margin-bottom: 0.2rem;
}

.dashboard__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dashboard__author {
  margin: 0;
  font-size: 0.85rem;
}

.dashboard__progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.dashboard__progress-bar {
  flex: 1;
}
.dashboard__pct {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 40px;
  text-align: right;
}
.dashboard__page-hint {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
}

/* Continuity warning state */
.dashboard__current--warning {
  background:
    linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.12) 0%,
      rgba(245, 158, 11, 0.06) 100%
    ),
    var(--glass-surface-bg, rgba(255, 255, 255, 0.04));
  border-color: rgba(251, 191, 36, 0.35) !important;
  animation: pulse-amber 2.5s ease-in-out infinite;
}

@keyframes pulse-amber {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.15);
  }
}

.dashboard__continuity-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fbbf24;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.25);
  align-self: flex-start;
}

.dashboard__update {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.dashboard__page-input {
  flex: 1;
}
.dashboard__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}

.dashboard__offline-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  align-self: flex-start;
}

.dashboard__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.dashboard__action-btn {
  flex: 1;
  min-width: 120px;
}

/* ── Shared section ───────────────────────────────────────────── */
.dashboard__section {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashboard__section-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dashboard__book-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dashboard__book-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.dashboard__book-item:hover {
  opacity: 0.85;
}

.dashboard__book-thumb {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.dashboard__book-thumb--placeholder {
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard__book-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.dashboard__book-title {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dashboard__book-author {
  font-size: 0.78rem;
  opacity: 0.6;
}

.dashboard__book-progress-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
}
.dashboard__book-bar {
  flex: 1;
}
.dashboard__book-pct {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 32px;
  text-align: right;
}

.dashboard__book-complete-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: #34d399;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.2rem;
}

/* Up Next drag handle */
.up-next__item {
  touch-action: none;
}
.up-next__handle {
  font-size: 1.1rem;
  cursor: grab;
  opacity: 0.45;
  padding: 0 0.25rem;
  flex-shrink: 0;
  min-width: 28px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
.up-next__handle:active {
  cursor: grabbing;
}

/* ── New Lore chip ────────────────────────────────────────────── */
.dashboard__new-lore-chip {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.25rem 0.55rem 0.25rem 0.45rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.85),
    rgba(167, 139, 250, 0.85)
  );
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.dashboard__new-lore-chip:hover {
  opacity: 0.9;
  transform: scale(1.04);
}
.dashboard__new-lore-chip .pi {
  font-size: 0.65rem;
}
/* Smaller variant for list items */
.dashboard__new-lore-chip--sm {
  top: 0.4rem;
  right: 0.4rem;
  font-size: 0.6rem;
  padding: 0.2rem 0.45rem 0.2rem 0.35rem;
}

/* Overflow hint */
.dashboard__overflow-hint {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}
.dashboard__overflow-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--p-indigo-300);
  font-size: inherit;
  font-weight: 600;
  text-decoration: underline;
}

/* ── Inline panels (recap + lore, 010-dashboard-ux-sync) ─────────── */
.dashboard__inline-panel {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dashboard__inline-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard__inline-panel-title {
  font-size: 0.9rem;
  font-weight: 600;
  opacity: 0.8;
}

.dashboard__inline-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.45;
  padding: 0.2rem 0.35rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}

.dashboard__inline-dismiss:hover {
  opacity: 0.9;
}

.dashboard__inline-dismiss .pi {
  font-size: 0.8rem;
}

/* Locked recap button */
.dashboard__action-btn--locked {
  opacity: 0.55;
  cursor: not-allowed !important;
  font-size: 0.82rem;
}
</style>
