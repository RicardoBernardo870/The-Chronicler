<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useIntersectionObserver } from "@vueuse/core";
import { useBooksStore } from "@/stores/books";
import { useLexiconStore } from "@/stores/lexicon";
import { useGreatLibrarySearch } from "@/composables/useGreatLibrarySearch";
import LexiconCard from "@/components/lexicon/LexiconCard.vue";
import AddWordDialog from "@/components/lexicon/AddWordDialog.vue";
import LoreCardList from "@/components/lore/LoreCardList.vue";
import TabMenu from "primevue/tabmenu";
import Button from "primevue/button";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Skeleton from "primevue/skeleton";

const route = useRoute();
const router = useRouter();

const booksStore = useBooksStore();
const lexiconStore = useLexiconStore();

const {
  entries,
  loading,
  loadingMore,
  error,
  hasMore,
  searchQuery,
  typeFilter,
  bookFilter,
  bookOptions,
  search,
  loadNextPage,
  retry,
} = useGreatLibrarySearch();

// ── Tab state ──────────────────────────────────────────────────────────────
const activeIndex = ref<number>(route.query.tab === "lore" ? 1 : 0);

const tabItems = [
  { label: "Lexicon", icon: "pi pi-book" },
  { label: "Lore Cards", icon: "pi pi-sparkles" },
];

// ── Lore tab book filter (separate from lexicon composable filter) ──────────
const loreBookId = ref<string | null>((route.query.bookId as string) || null);

// Keep query params in sync with state (no full-page navigation)
watch([activeIndex, loreBookId], () => {
  const q: Record<string, string> = {};
  if (activeIndex.value === 1) q.tab = "lore";
  if (loreBookId.value) q.bookId = loreBookId.value;
  router.replace({ query: q });
});

// ── Book options for Lore tab (all books from booksStore) ──────────────────
const loreBookOptions = computed(() => [
  { label: "All Books", value: null },
  ...booksStore.books.map((b) => ({ label: b.title, value: b.id })),
]);

// ── Lexicon filter options ─────────────────────────────────────────────────
const typeFilterOptions = [
  { label: "All", value: "all" },
  { label: "Dictionary", value: "dictionary" },
  { label: "Lore", value: "lore" },
];

const lexiconBookOptions = computed(() => [
  { label: "All Books", value: null },
  ...bookOptions.value.map((o) => ({ label: o.bookTitle, value: o.bookId })),
]);

// ── Leitner handlers ───────────────────────────────────────────────────────
const onAdvance = (entryId: string) =>
  lexiconStore.updateLeitner(entryId, "advance");
const onReset = (entryId: string) =>
  lexiconStore.updateLeitner(entryId, "reset");

// ── Add word dialog ────────────────────────────────────────────────────────
const addDialogVisible = ref(false);

const onWordSaved = () => {
  addDialogVisible.value = false;
  // Re-fetch so the new entry appears at the top
  search();
};

// ── Infinite scroll sentinel ───────────────────────────────────────────────
const sentinelRef = ref<HTMLElement | null>(null);

useIntersectionObserver(
  sentinelRef,
  ([entry]) => {
    if (entry.isIntersecting) loadNextPage();
  },
  { threshold: 0.1 },
);

// ── Empty state helpers ────────────────────────────────────────────────────
const isSearchActive = computed(
  () =>
    searchQuery.value.trim().length > 0 ||
    typeFilter.value !== "all" ||
    bookFilter.value !== null,
);

const clearSearch = () => {
  searchQuery.value = "";
  typeFilter.value = "all";
  bookFilter.value = null;
};

// ── Mount ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Load books for Lore tab filter
  await booksStore.fetchLibrary();

  // Honour ?bookId deep-link for Lore tab
  const queryBook = route.query.bookId as string | undefined;
  if (queryBook) loreBookId.value = queryBook;

  // Honour ?tab deep-link
  if (route.query.tab === "lore") activeIndex.value = 1;

  // Initial load of lexicon entries via composable
  await search();
});
</script>

<template>
  <div class="great-library">
    <!-- Page header -->
    <header class="great-library__header">
      <h1 class="great-library__title">Great Library</h1>
    </header>

    <!-- Tab menu -->
    <TabMenu
      v-model:activeIndex="activeIndex"
      :model="tabItems"
      class="great-library__tabmenu"
    />

    <!-- ── Lexicon panel ──────────────────────────────────────────────────── -->
    <div v-show="activeIndex === 0" class="great-library__panel">
      <!-- Lexicon filters -->
      <div class="great-library__lexicon-filters">
        <InputText
          v-model="searchQuery"
          placeholder="Search terms or definitions…"
          class="great-library__search"
        />
        <div class="great-library__filter-row">
          <Select
            v-model="bookFilter"
            :options="lexiconBookOptions"
            option-label="label"
            option-value="value"
            placeholder="All Books"
            :filter="true"
            fluid
            show-clear
          />
          <SelectButton
            v-model="typeFilter"
            :options="typeFilterOptions"
            option-label="label"
            option-value="value"
            fluid
            class="great-library__type-toggle"
          />
        </div>
      </div>

      <!-- Add word button -->
      <div class="great-library__tab-actions">
        <Button
          icon="pi pi-plus"
          label="Add Word"
          size="small"
          @click="addDialogVisible = true"
        />
      </div>

      <!-- Error state -->
      <Message v-if="error" severity="error" class="great-library__error">
        <span>{{ error }}</span>
        <Button
          label="Retry"
          size="small"
          text
          @click="retry"
          style="margin-left: 0.5rem"
        />
      </Message>

      <!-- Skeleton loading (first page) -->
      <div v-if="loading" class="great-library__skeleton-list">
        <Skeleton v-for="i in 3" :key="i" height="90px" border-radius="14px" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!loading && entries.length === 0"
        class="great-library__empty glass-surface"
      >
        <i
          class="pi pi-book"
          style="font-size: 2rem; opacity: 0.25; margin-bottom: 0.5rem"
        />
        <template v-if="isSearchActive">
          <p>No results found.</p>
          <p style="font-size: 0.85rem; opacity: 0.55">
            Try a different search term or filter.
          </p>
          <Button
            label="Clear filters"
            size="small"
            text
            @click="clearSearch"
            style="margin-top: 0.5rem"
          />
        </template>
        <template v-else>
          <p>No words saved yet.</p>
          <p style="font-size: 0.85rem; opacity: 0.55">
            Add a word while reading to build your vocabulary vault.
          </p>
        </template>
      </div>

      <!-- Cards -->
      <div v-else class="great-library__list">
        <LexiconCard
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :book-title="entry.bookTitle"
          @advance="onAdvance(entry.id)"
          @reset="onReset(entry.id)"
        />
      </div>

      <!-- Load more spinner -->
      <div v-if="loadingMore" class="great-library__loading-more">
        <i
          class="pi pi-spin pi-spinner"
          style="font-size: 1.25rem; opacity: 0.4"
        />
      </div>

      <!-- Infinite scroll sentinel -->
      <div
        v-if="hasMore && !loading"
        ref="sentinelRef"
        class="great-library__sentinel"
      />

      <!-- All entries loaded -->
      <p
        v-if="!hasMore && entries.length > 0 && !loading"
        class="great-library__all-loaded"
      >
        All entries loaded
      </p>
    </div>

    <!-- ── Lore Cards panel ───────────────────────────────────────────────── -->
    <div v-show="activeIndex === 1" class="great-library__panel">
      <!-- Lore tab book filter -->
      <div class="great-library__filters">
        <Select
          v-model="loreBookId"
          :options="loreBookOptions"
          option-label="label"
          option-value="value"
          placeholder="All Books"
          show-clear
          filter
          fluid
        />
      </div>
      <LoreCardList :book-id="loreBookId ?? undefined" />
    </div>

    <AddWordDialog
      v-if="addDialogVisible"
      :visible="addDialogVisible"
      :book-id="bookFilter ?? undefined"
      @update:visible="addDialogVisible = $event"
      @saved="onWordSaved"
    />
  </div>
</template>

<style>
.great-library {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.great-library__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.great-library__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* ── Lexicon filters ─────────────────────────────────────────────────────── */

.great-library__lexicon-filters {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.great-library__search {
  width: 100%;
}

.great-library__filter-row {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;
}




/* Lore tab filter */
.great-library__filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* ── TabMenu pill shape ───────────────────────────────────────────────────── */

.great-library__tabmenu .p-tabmenu-tablist {
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: none !important;
  background: transparent !important;

  .p-tabmenu-item-link {
    border-radius: 15px;
  }
}

.great-library__tabmenu .p-tabmenuitem .p-menuitem-link {
  border-radius: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  margin-bottom: 0 !important;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.great-library__tabmenu .p-tabmenuitem.p-highlight .p-menuitem-link {
  border-color: rgba(99, 102, 241, 0.4) !important;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.18);
}

@media (prefers-color-scheme: light) {
  .great-library__tabmenu .p-tabmenuitem .p-menuitem-link {
    border-color: rgba(0, 0, 0, 0.09) !important;
  }
  .great-library__tabmenu .p-tabmenuitem.p-highlight .p-menuitem-link {
    border-color: rgba(99, 102, 241, 0.3) !important;
  }
}

/* ── Panel ───────────────────────────────────────────────────────────────── */

.great-library__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.great-library__tab-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.25rem;
}

/* ── Loading / skeleton ──────────────────────────────────────────────────── */

.great-library__skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.great-library__loading-more {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0;
}

/* ── Entry list ──────────────────────────────────────────────────────────── */

.great-library__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

.great-library__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 16px;
  gap: 0.25rem;
}

/* ── Error ───────────────────────────────────────────────────────────────── */

.great-library__error {
  align-items: center;
}

/* ── Sentinel + footer ───────────────────────────────────────────────────── */

.great-library__sentinel {
  height: 1px;
  width: 100%;
}

.great-library__all-loaded {
  text-align: center;
  font-size: 0.78rem;
  opacity: 0.35;
  margin: 0.25rem 0 0;
  letter-spacing: 0.03em;
}
</style>
