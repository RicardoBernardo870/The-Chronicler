<script setup lang="ts">
import { ref, computed, onMounted, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBooksStore } from "@/stores/books";
import { useProgressStore } from "@/stores/progress";
import { useRecapsStore } from "@/stores/recaps";
import { useBookPassportStore } from "@/stores/bookPassport";
import { useLexiconStore } from "@/stores/lexicon";
import { useLoreCardsStore } from "@/stores/loreCards";
import BookDetailHeader from "@/components/book/BookDetailHeader.vue";
import BookProgressPanel from "@/components/book/BookProgressPanel.vue";
import RecapStream from "@/components/recap/RecapStream.vue";
import LoreChronoscopeCard from "@/components/lore/LoreChronoscopeCard.vue";
import AddWordDialog from "@/components/lexicon/AddWordDialog.vue";
import Button from "primevue/button";
import Skeleton from "primevue/skeleton";
import { useConfirm } from "primevue/useconfirm";
import ConfirmDialog from "primevue/confirmdialog";

const route = useRoute();
const router = useRouter();
const booksStore = useBooksStore();
const progressStore = useProgressStore();
const recapsStore = useRecapsStore();
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
const showNoteField = ref(false);
const pendingHistoryRowId = ref<string | null>(null);

watchEffect(() => {
  const event = progressStore.lastSessionEnded;
  if (event && event.bookId === bookId.value) {
    pendingHistoryRowId.value = event.historyRowId;
    showNoteField.value = true;
  }
});

const handleNoteComplete = () => { showNoteField.value = false; pendingHistoryRowId.value = null; };

const handleSessionConflict = (startedAt: Date) => {
  const timeStr = startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  confirm.require({
    message: `You have an unfinished session started at ${timeStr}. Start a new one?`,
    header: "Replace session?",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Start new session",
    rejectLabel: "Cancel",
    accept: async () => {
      try { await progressStore.startSession(bookId.value) } catch { /* surfaced by SessionStartButton */ }
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
});

watch(progress, (p) => {
  if (p && !progressLoading.value) currentPageInput.value = p.currentPage;
});

const percentage = computed(() => progress.value?.percentage ?? 0);
const isComplete = computed(() => percentage.value >= 100);
const isGenerating = computed(() => recapsStore.generationStatus === "streaming");
const recapCount = computed(() => recapsStore.recapHistoryForBook(bookId.value).length);

const RECAP_TIME_UNLOCK_DAYS = 3;
const lastRecapPct = computed(() => recapsStore.latestRecapForBook(bookId.value)?.progressSnapshot ?? 0);
const unlockPage = computed(() => {
  if (!book.value || lastRecapPct.value === 0) return 0;
  return Math.ceil(((lastRecapPct.value + 5) / 100) * book.value.totalPages);
});
const recapLockedByPages = computed(
  () => lastRecapPct.value > 0 && (progress.value?.currentPage ?? 0) < unlockPage.value,
);
const daysSinceLastSession = computed(() => {
  const updatedAt = progress.value?.updatedAt;
  if (!updatedAt) return 0;
  return (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
});
const recapLocked = computed(
  () => recapLockedByPages.value && daysSinceLastSession.value < RECAP_TIME_UNLOCK_DAYS,
);
const pagesUntilUnlock = computed(() =>
  Math.max(0, unlockPage.value - (progress.value?.currentPage ?? 0)),
);

const saveProgress = async () => {
  if (!book.value) return;
  const page = Math.max(0, Math.min(currentPageInput.value ?? 0, book.value.totalPages));
  progressLoading.value = true;
  progressError.value = null;
  try {
    await progressStore.updateProgress(bookId.value, page);
  } catch (e: unknown) {
    progressError.value = e instanceof Error ? e.message : "Failed to save progress";
  } finally { progressLoading.value = false; }
};

const getRecap = async () => { recapTriggered.value = true; recapsStore.resetStatus(); await recapsStore.generateRecap(bookId.value); };
const retryRecap = () => { recapsStore.resetStatus(); getRecap(); };
</script>

<template>
  <div class="book-detail">
    <ConfirmDialog />

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
        :show-note-field="showNoteField"
        :pending-history-row-id="pendingHistoryRowId"
        :percentage="percentage"
        :is-complete="isComplete"
        :lexicon-count="lexiconCount"
        :recap-locked="recapLocked"
        :pages-until-unlock="pagesUntilUnlock"
        @update:current-page-input="(v) => (currentPageInput = v)"
        @save="saveProgress"
        @note-complete="handleNoteComplete"
        @session-conflict="handleSessionConflict"
        @view-journey="router.push({ name: 'book-passport', params: { id: bookId } })"
        @open-add-word="addWordVisible = true"
        @view-lexicon="router.push({ name: 'lexicon', query: { bookId } })"
      />

      <LoreChronoscopeCard :book-id="bookId" :collapsible="true" :initial-collapsed="true" />

      <section v-if="!isComplete" class="book-detail__recap glass-surface">
        <div class="book-detail__recap-header">
          <h2 class="book-detail__section-title">AI Recap</h2>
          <Button
            v-if="!isGenerating && recapLocked"
            :label="`🔒 Read ${pagesUntilUnlock} more pages to unlock`"
            disabled
            class="book-detail__recap-locked"
            v-tooltip.top="'You unlock a new recap every 10% of progress'"
          />
          <Button
            v-else-if="!isGenerating"
            :label="recapTriggered ? 'New Recap' : 'Get Recap'"
            icon="pi pi-sparkles"
            @click="getRecap"
          />
        </div>
        <p v-if="!recapTriggered && !isGenerating" class="book-detail__recap-hint">
          Get a spoiler-free summary of your progress so far.
        </p>
        <RecapStream v-if="isGenerating || recapTriggered" :bookId="bookId" @retry="retryRecap" />
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
.book-detail__recap-locked { opacity: 0.55; cursor: not-allowed !important; font-size: 0.82rem; }
.book-detail__history-link { display: flex; justify-content: flex-end; }
.book-detail__skeleton { border-radius: var(--p-border-radius-xl, 16px); padding: 1.5rem; }
</style>
