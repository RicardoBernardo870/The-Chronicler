<script setup lang="ts">
import { onMounted } from "vue";
import { useLastSession } from "@/composables/useLastSession";
import { useProgressStore } from "@/stores/progress";
import { useBooksStore } from "@/stores/books";
import { formatRelative } from "@/composables/useRelativeTime";
import VelocityBadge from "@/components/pulse/VelocityBadge.vue";

const { lastSession, fetchAllHistory } = useLastSession();
const booksStore = useBooksStore();
const progressStore = useProgressStore();

onMounted(() => fetchAllHistory());
</script>

<template>
  <section v-if="lastSession" class="last-session glass-surface">
    <h3 class="last-session__title">
      <i class="pi pi-history" /> Last Session
    </h3>
    <div>
      <p class="last-session__book">{{ lastSession.bookTitle }}</p>
      <div class="last-session__stats">
        <span class="last-session__recency">
          {{ formatRelative(lastSession.endedAt) }} - {{ lastSession.pagesDelta }}
          {{ lastSession.pagesDelta === 1 ? "page" : "pages" }}
        </span>


        <VelocityBadge
          v-if="lastSession.pagesDelta > 0"
          :book-id="lastSession.bookId"
          :total-pages="
            booksStore.bookById(lastSession.bookId)?.totalPages ?? 0
          "
          :current-page="
            progressStore.progressForBook(lastSession.bookId)?.currentPage ?? 0
          "
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.last-session {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.last-session__title {
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

.last-session__book {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.last-session__stats {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  flex-wrap: wrap;
  justify-content: space-between;
}

.last-session__recency {
  color: var(--p-indigo-300);
  font-weight: 600;
}

.last-session__sep {
  opacity: 0.35;
}

.last-session__pages {
  opacity: 0.8;
}
</style>
