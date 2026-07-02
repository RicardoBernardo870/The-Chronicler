<script setup lang="ts">
// Library search input — instant client-side filter over the loaded library.
// Styled with the existing pill/glass vocabulary; no new colors or fonts.
const query = defineModel<string>({ required: true })
</script>

<template>
  <div class="library-search">
    <i class="pi pi-search library-search__icon" aria-hidden="true" />
    <input
      v-model="query"
      type="search"
      class="library-search__input"
      placeholder="Search your library…"
      aria-label="Search your library by title or author"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
    />
    <button
      v-if="query"
      type="button"
      class="library-search__clear"
      aria-label="Clear search"
      @click="query = ''"
    >
      <i class="pi pi-times-circle" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.library-search {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.9rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
}

.library-search__icon {
  flex: none;
  font-size: 0.85rem;
  opacity: 0.5;
}

.library-search__input {
  flex: 1;
  min-width: 0;
  padding: 0.15rem 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.9rem;
}

.library-search__input:focus {
  outline: none;
}

.library-search:focus-within {
  border-color: rgba(99, 102, 241, 0.45);
}

.library-search__input::placeholder {
  color: inherit;
  opacity: 0.4;
}

.library-search__input::-webkit-search-cancel-button {
  display: none;
}

.library-search__clear {
  flex: none;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0.15rem;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.5;
  font-size: 0.9rem;
}

.library-search__clear:hover {
  opacity: 0.8;
}

/* ── Light mode overrides (mirrors .pill-tabs) ────────────────────────── */
:root[data-p-theme="light"] .library-search {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
}

:root[data-p-theme="light"] .library-search:focus-within {
  border-color: rgba(99, 102, 241, 0.45);
}
</style>
