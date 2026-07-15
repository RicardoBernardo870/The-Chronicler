<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBooksStore } from "@/stores/books";
import { useProgressStore } from "@/stores/progress";
import { useRecapsStore } from "@/stores/recaps";
import { useBookPassportStore } from "@/stores/bookPassport";
import { useLexiconStore } from "@/stores/lexicon";
import { useLoreCardsStore } from "@/stores/loreCards";
import { useRecapLock } from "@/composables/useRecapLock";
import { useCapturesStore } from "@/stores/captures";
import { searchBooks, getBookDetail } from "@/services/bookSearchService";
import BookDetailHeader from "@/components/book/BookDetailHeader.vue";
import BookProgressPanel from "@/components/book/BookProgressPanel.vue";
import RecapDialog from "@/components/recap/RecapDialog.vue";
import BookRecapCarousel from "@/components/book/BookRecapCarousel.vue";
import LoreChronoscopeCard from "@/components/lore/LoreChronoscopeCard.vue";
import AddWordDialog from "@/components/lexicon/AddWordDialog.vue";
import MemoryCheckDialog from "@/components/session/MemoryCheckDialog.vue";
import SessionCaptureField from "@/components/session/SessionCaptureField.vue";
import Button from "primevue/button";
import Skeleton from "primevue/skeleton";
import { useConfirm } from "primevue/useconfirm";
import { createCompletionPromptTarget } from "@/utils/completionPrompt";

const route = useRoute();
const router = useRouter();
const booksStore = useBooksStore();
const progressStore = useProgressStore();
const recapsStore = useRecapsStore();
const capturesStore = useCapturesStore();
const passportStore = useBookPassportStore();
const lexiconStore = useLexiconStore();
const loreStore = useLoreCardsStore();
const confirm = useConfirm();

const bookId = computed(() => route.params.id as string);
const book = computed(() => booksStore.bookById(bookId.value));
const progress = computed(() => progressStore.progressForBook(bookId.value) ?? null);

const currentPageInput = ref<number>(0);
const progressLoading = ref(false);
const progressError = ref<string | null>(null);
const recapTriggered = ref(false);
const addWordVisible = ref(false);
const memoryCheckVisible = ref(false);

// ── Post-session capture prompt ──────────────────────────────────────────
// Shown inline on this page right after a session ends — so the user sees
// the capture prompt immediately without having to navigate to the Dashboard.
const showCaptureField = ref(false);
const captureHistoryRowId = ref<string | null>(null);
const captureBookId = ref<string | null>(null);

watch(() => progressStore.lastSessionEnded, (event) => {
  if (event && event.bookId === bookId.value) {
    captureHistoryRowId.value = event.historyRowId;
    captureBookId.value = event.bookId;
    showCaptureField.value = true;
  }
});

const handleCaptureComplete = () => {
  showCaptureField.value = false;
  captureHistoryRowId.value = null;
  captureBookId.value = null;
  progressStore.consumeSessionEnded();
};

const handleCancelSession = () => {
  confirm.require({
    message: "Cancel this session? No progress will be saved.",
    header: "Cancel session?",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Cancel session",
    rejectLabel: "Keep session",
    acceptClass: "p-button-danger",
    accept: async () => {
      try { await progressStore.clearSession(bookId.value) } catch { /* silent */ }
    },
  });
};

const lexiconCount = computed(() => lexiconStore.entriesByBook[bookId.value]?.length ?? 0);

onMounted(async () => {
  if (!book.value) await booksStore.fetchLibrary();
  if (!progress.value) await progressStore.fetchProgress();
  await recapsStore.fetchRecapsForBook(bookId.value);
  if (progress.value) currentPageInput.value = progress.value.currentPage;
  await passportStore.fetchPassport(bookId.value);
  await lexiconStore.fetchEntriesForBook(bookId.value);
  await loreStore.markBookLoreSeen(bookId.value);
  void backfillDescription();
});

// Best-effort, once per book: fetch a missing description (imported/scanned
// books) from the book-search service and persist it, so it never refetches.
const backfillDescription = async () => {
  const b = book.value;
  if (!b || b.description) return;
  try {
    const query = b.isbn ?? `${b.title} ${b.author}`;
    const results = await searchBooks(query, 1);
    const key = results[0]?.key;
    if (!key) return;
    const draft = await getBookDetail("googlebooks", key);
    if (draft.description) {
      await booksStore.updateBook(b.id, { description: draft.description });
    }
  } catch {
    /* silent — the hero simply shows no description */
  }
};

watch(progress, (p) => {
  if (p && !progressLoading.value) currentPageInput.value = p.currentPage;
});

const percentage = computed(() => progress.value?.percentage ?? 0);
const isComplete = computed(() => percentage.value >= 100);
const canViewJourney = computed(() => book.value?.source === 'manual');
const recapCount = computed(() => recapsStore.recapHistoryForBook(bookId.value).length);
const completedRecapImages = computed(() =>
  recapsStore.recapHistoryForBook(bookId.value)
    .filter((recap) => Boolean(recap.id) && recap.imageStatus === "succeeded" && Boolean(recap.imagePath)),
);

const { recapLocked, pagesUntilUnlock, recapLockLabel } = useRecapLock(bookId);

const saveProgress = async () => {
  if (!book.value) return;
  const page = Math.max(0, Math.min(currentPageInput.value ?? 0, book.value.totalPages));
  const currentStoredPage = progress.value?.currentPage ?? 0;
  const sessionActive = Boolean(progress.value?.sessionStartAt);

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
        try { await progressStore.clearSession(bookId.value) } catch { /* silent */ }
      },
    });
    return;
  }

  progressLoading.value = true;
  progressError.value = null;
  try {
    const prevPct = progress.value?.percentage ?? 0;
    await progressStore.updateProgress(bookId.value, page);
    const newPct = book.value.totalPages > 0
      ? (page / book.value.totalPages) * 100
      : 0;
    const completionTarget = createCompletionPromptTarget(
      bookId.value,
      book.value.title,
      prevPct,
      newPct,
    );
    if (completionTarget) {
      confirm.require({
        header: `Finished: ${completionTarget.bookTitle}`,
        message: "Your reading journey is ready. Open your Book Passport to see the story so far.",
        icon: "pi pi-sparkles",
        acceptLabel: "View Journey",
        rejectLabel: "Continue",
        accept: () => {
          router.push({ name: "book-passport", params: { id: completionTarget.bookId } });
        },
      });
    }
  } catch (e: unknown) {
    progressError.value = e instanceof Error ? e.message : "Failed to save progress";
  } finally { progressLoading.value = false; }
};

const doGenerateRecap = async () => {
  recapTriggered.value = true;
  recapsStore.resetStatus();
  await recapsStore.generateRecap(bookId.value);
};

const getRecap = async () => {
  const fromPage = recapsStore.recapHistoryForBook(bookId.value)?.[0]?.pageSnapshot ?? 0;
  const currentPage = progress.value?.currentPage ?? 0;
  await capturesStore.fetchCapturesForBook(bookId.value).catch(() => {});
  const inRange = capturesStore.capturesInRange(bookId.value, fromPage, currentPage);

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

const retryRecap = () => { recapsStore.resetStatus(); doGenerateRecap(); };

const closeRecapDialog = () => {
  recapTriggered.value = false;
  recapsStore.resetStatus();
};

const viewJourney = async () => {
  await router.push({ name: "book-passport", params: { id: bookId.value } });
};
</script>

<template>
  <div class="book-detail">
    <div v-if="!book && !booksStore.loading" class="book-detail__not-found glass-surface">
      <i class="pi pi-exclamation-circle" style="font-size: 3rem; opacity: 0.4" />
      <p>Book not found.</p>
      <Button label="Back to Library" icon="pi pi-arrow-left" outlined @click="router.push('/library')" />
    </div>

    <template v-else-if="book">
      <BookDetailHeader :book="book" />

      <BookProgressPanel
        :book="book"
        :progress="progress"
        :current-page-input="currentPageInput"
        :progress-loading="progressLoading"
        :progress-error="progressError"
        :percentage="percentage"
        :is-complete="isComplete"
        :can-view-journey="canViewJourney"
        :lexicon-count="lexiconCount"
        @update:current-page-input="(v) => (currentPageInput = v)"
        @save="saveProgress"
        @cancel-session="handleCancelSession"
        @view-journey="viewJourney"
        @open-add-word="addWordVisible = true"
        @view-lexicon="router.push({ name: 'lexicon', query: { bookId } })"
        @open-memory-check="memoryCheckVisible = true"
      />

      <!-- On-demand Memory Check (035) — quiz built from this book's captures -->
      <MemoryCheckDialog
        :book-id="bookId"
        v-model:visible="memoryCheckVisible"
        mode="ondemand"
      />

      <!-- Post-session page capture prompt (appears immediately after saving progress with an active session) -->
      <SessionCaptureField
        v-if="showCaptureField && captureHistoryRowId && captureBookId"
        :history-row-id="captureHistoryRowId"
        :book-id="captureBookId"
        @saved="handleCaptureComplete"
        @skipped="handleCaptureComplete"
      />

      <LoreChronoscopeCard :book-id="bookId" :collapsible="true" :initial-collapsed="true" />

      <!-- Recap memories — images carousel + recap generation, both states -->
      <section class="book-detail__recap glass-surface">
        <div class="book-detail__recap-header">
          <h2 class="book-detail__section-title">Recap memories</h2>
          <Button
            v-if="!isComplete"
            :label="recapTriggered ? 'Recap open' : recapLocked ? (recapLockLabel || 'Locked') : 'Get Recap'"
            icon="pi pi-sparkles"
            size="small"
            class="book-detail__recap-btn"
            :disabled="recapTriggered || recapLocked"
            :title="recapLocked ? (recapLockLabel || `Read ${pagesUntilUnlock} more pages`) : undefined"
            @click="getRecap"
          />
        </div>

        <RecapDialog
          :book-id="bookId"
          :visible="recapTriggered"
          @update:visible="(v) => { if (!v) closeRecapDialog(); }"
          @retry="retryRecap"
        />

        <BookRecapCarousel :recaps="completedRecapImages" />

        <div v-if="recapCount > 0" class="book-detail__history-link">
          <Button
            :label="`View Recap History (${recapCount})`"
            icon="pi pi-history"
            link
            @click="router.push({ name: 'recap-history', params: { id: bookId } })"
          />
        </div>
      </section>
    </template>

    <template v-else>
      <div class="book-detail__skeleton glass-surface">
        <Skeleton height="200px" border-radius="12px" />
        <Skeleton height="1.5rem" width="60%" style="margin-top: 1rem" />
        <Skeleton height="1rem" width="40%" style="margin-top: 0.5rem" />
      </div>
    </template>

    <AddWordDialog
      v-if="addWordVisible"
      :visible="addWordVisible"
      :book-id="bookId"
      :default-page-found="progress?.currentPage"
      @update:visible="addWordVisible = $event"
      @saved="addWordVisible = false"
    />
  </div>
</template>

<style scoped>
.book-detail {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
}

.book-detail__not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  border-radius: var(--p-border-radius-xl, 16px);
  text-align: center;
  color: var(--p-text-muted-color);
}

.book-detail__recap {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-detail__recap-header { display: flex; justify-content: space-between; align-items: center; }
.book-detail__section-title { margin: 0; font-size: 1rem; font-weight: 600; }
.book-detail__recap-hint { margin: 0; font-size: 0.85rem; opacity: 0.6; }
.book-detail__recap-btn {
  background: rgba(99, 102, 241, 0.18) !important;
  color: var(--p-indigo-300) !important;
}
.book-detail__recap-locked { opacity: 0.55; cursor: not-allowed !important; font-size: 0.82rem; }
.book-detail__history-link { display: flex; justify-content: flex-end; }

.book-detail__about-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.book-detail__about-toggle:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 4px;
  border-radius: 8px;
}

.book-detail__about-chevron {
  font-size: 0.75rem;
  opacity: 0.5;
  transition: transform 0.18s ease;
}

.book-detail__about-chevron--open { transform: rotate(180deg); }

.book-detail__about-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
  opacity: 0.8;
  white-space: pre-line;
}
.book-detail__skeleton { border-radius: var(--p-border-radius-xl, 16px); padding: 1.5rem; }
</style>
