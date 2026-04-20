<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBooksStore } from "@/stores/books";
import { useLexiconStore } from "@/stores/lexicon";
import LexiconCard from "@/components/lexicon/LexiconCard.vue";
import AddWordDialog from "@/components/lexicon/AddWordDialog.vue";
import LoreCardList from "@/components/lore/LoreCardList.vue";
import TabMenu from "primevue/tabmenu";
import Button from "primevue/button";
import Select from "primevue/select";

const route = useRoute();
const router = useRouter();

const booksStore = useBooksStore();
const lexiconStore = useLexiconStore();

// ── Tab state ──────────────────────────────────────────────────────────────
const activeIndex = ref<number>(route.query.tab === "lore" ? 1 : 0);

const tabItems = [
  { label: "Lexicon", icon: "pi pi-book" },
  { label: "Lore Cards", icon: "pi pi-sparkles" },
];

// ── Shared book filter (FR-014) ─────────────────────────────────────────────
const selectedBookId = ref<string | null>(
  (route.query.bookId as string) || null,
);

// Keep query params in sync with state (no full-page navigation)
watch([activeIndex, selectedBookId], () => {
  const q: Record<string, string> = {};
  if (activeIndex.value === 1) q.tab = "lore";
  if (selectedBookId.value) q.bookId = selectedBookId.value;
  router.replace({ query: q });
});

// ── Loading ────────────────────────────────────────────────────────────────
const loading = ref(lexiconStore.allEntries.length === 0);

onMounted(async () => {
  await booksStore.fetchLibrary();
  await Promise.all(
    booksStore.books.map((b) => lexiconStore.fetchEntriesForBook(b.id)),
  );

  // Honour ?bookId deep-link (e.g. from Chronoscope card)
  const queryBook = route.query.bookId as string | undefined;
  if (queryBook) selectedBookId.value = queryBook;

  // Honour ?tab deep-link set after mount (router guard may fire after onMounted)
  if (route.query.tab === "lore") activeIndex.value = 1;

  loading.value = false;
});

// ── Book filter options ────────────────────────────────────────────────────
const bookOptions = computed(() => [
  { label: "All Books", value: null },
  ...booksStore.books.map((b) => ({ label: b.title, value: b.id })),
]);

// ── Lexicon tab ────────────────────────────────────────────────────────────
const filteredLexiconEntries = computed(() =>
  selectedBookId.value
    ? (lexiconStore.entriesByBook[selectedBookId.value] ?? [])
    : lexiconStore.allEntries,
);

const addDialogVisible = ref(false);
const onAdvance = (entryId: string) =>
  lexiconStore.updateLeitner(entryId, "advance");
const onReset = (entryId: string) =>
  lexiconStore.updateLeitner(entryId, "reset");
</script>

<template>
  <div class="great-library">
    <!-- Page header -->
    <header class="great-library__header">
      <h1 class="great-library__title">Great Library</h1>
    </header>

    <!-- Shared book filter — sits above both tabs (FR-014) -->
    <div class="great-library__filters">
      <Select
        v-model="selectedBookId"
        :options="bookOptions"
        option-label="label"
        option-value="value"
        placeholder="All Books"
        style="min-width: 180px"
      />
    </div>

    <!-- Tab menu (FR-012, FR-013) -->
    <TabMenu
      v-model:activeIndex="activeIndex"
      :model="tabItems"
      class="great-library__tabmenu"
    />

    <!-- ── Lexicon panel ──────────────────────────────────────────────────── -->
    <div v-show="activeIndex === 0" class="great-library__panel">
      <div class="great-library__tab-actions">
        <Button
          icon="pi pi-plus"
          label="Add Word"
          size="small"
          @click="addDialogVisible = true"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="great-library__loading">
        <i
          class="pi pi-spin pi-spinner"
          style="font-size: 1.5rem; opacity: 0.4"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="filteredLexiconEntries.length === 0"
        class="great-library__empty glass-surface"
      >
        <i
          class="pi pi-book"
          style="font-size: 2rem; opacity: 0.25; margin-bottom: 0.5rem"
        />
        <p>No words saved yet.</p>
        <p style="font-size: 0.85rem; opacity: 0.55">
          Add a word while reading to build your vocabulary vault.
        </p>
      </div>

      <!-- Cards -->
      <div v-else class="great-library__list">
        <LexiconCard
          v-for="entry in filteredLexiconEntries"
          :key="entry.id"
          :entry="entry"
          @advance="onAdvance(entry.id)"
          @reset="onReset(entry.id)"
        />
      </div>
    </div>

    <!-- ── Lore Cards panel ───────────────────────────────────────────────── -->
    <div v-show="activeIndex === 1" class="great-library__panel">
      <LoreCardList :book-id="selectedBookId ?? undefined" />
    </div>

    <AddWordDialog
      v-if="addDialogVisible"
      :visible="addDialogVisible"
      :book-id="selectedBookId ?? undefined"
      @update:visible="addDialogVisible = $event"
      @saved="addDialogVisible = false"
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

.great-library__filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* ── TabMenu pill shape ───────────────────────────────────────────────────── */

/* Remove the nav bottom divider line */
.great-library__tabmenu .p-tabmenu-tablist {
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: none !important;
  background: transparent !important;

  .p-tabmenu-item-link {
    border-radius: 15px;
  }
}

/* Each tab: pill shape + glass border */
.great-library__tabmenu .p-tabmenuitem .p-menuitem-link {
  border-radius: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  /* Suppress the bottom-border active indicator — we use background instead */
  margin-bottom: 0 !important;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

/* Active pill: indigo border to complement the glass tint */
.great-library__tabmenu .p-tabmenuitem.p-highlight .p-menuitem-link {
  border-color: rgba(99, 102, 241, 0.4) !important;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.18);
}

/* Light mode overrides */
@media (prefers-color-scheme: light) {
  .great-library__tabmenu .p-tabmenuitem .p-menuitem-link {
    border-color: rgba(0, 0, 0, 0.09) !important;
  }
  .great-library__tabmenu .p-tabmenuitem.p-highlight .p-menuitem-link {
    border-color: rgba(99, 102, 241, 0.3) !important;
  }
}

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

.great-library__loading {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.great-library__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 16px;
  gap: 0.25rem;
}

.great-library__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
</style>
