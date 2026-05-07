<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useLastSession } from "@/composables/useLastSession";
import LastTimedSessionCard from "@/components/dashboard/LastTimedSessionCard.vue";
import LastUpdateCard from "@/components/dashboard/LastUpdateCard.vue";

const { lastSession, fetchLastSession } = useLastSession();

/** True when the last history row came from a timed session (not a manual page save). */
const wasTimedSession = computed(
  () => lastSession.value?.startedAt !== null && lastSession.value?.startedAt !== undefined,
);

onMounted(() => fetchLastSession());
</script>

<template>
  <Transition name="last-session-card" appear>
    <LastTimedSessionCard
      v-if="lastSession && wasTimedSession"
      :session="lastSession"
    />
    <LastUpdateCard
      v-else-if="lastSession"
      :session="lastSession"
    />
  </Transition>
</template>

<style scoped>
.last-session-card-enter-active,
.last-session-card-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.last-session-card-enter-from,
.last-session-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .last-session-card-enter-active,
  .last-session-card-leave-active {
    transition: none;
  }

  .last-session-card-enter-from,
  .last-session-card-leave-to {
    transform: none;
  }
}
</style>
