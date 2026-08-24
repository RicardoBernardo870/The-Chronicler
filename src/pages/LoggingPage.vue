<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import { Button, Skeleton } from 'primevue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useActivityLog, type ActivityLogEntry } from '@/composables/useActivityLog'
import { formatRelativeToNow, formatShortDate, isSameCalendarDay } from '@/utils/date'
import EmptyState from '@/components/shared/EmptyState.vue'

const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const { entries, loading, error, fetchEntries, clearEntries } = useActivityLog()

interface DayGroup {
  day: string
  label: string
  items: ActivityLogEntry[]
}

const groups = computed<DayGroup[]>(() => {
  const out: DayGroup[] = []
  for (const entry of entries.value) {
    const last = out[out.length - 1]
    if (last && isSameCalendarDay(last.day, entry.createdAt)) {
      last.items.push(entry)
    } else {
      out.push({
        day: entry.createdAt,
        label: formatShortDate(entry.createdAt),
        items: [entry],
      })
    }
  }
  return out
})

const timeOf = (iso: string): string => format(parseISO(iso), 'HH:mm')

const deviceSummary = (ua: string | null): string => {
  if (!ua) return 'Unknown device'
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac os x/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Unknown OS'
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /firefox|fxios/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'browser'
  return `${os} · ${browser}`
}

const routeName = (entry: ActivityLogEntry): string | null => {
  const name = entry.metadata?.name
  return typeof name === 'string' ? name : null
}

interface GeoMeta {
  city?: string
  region?: string
  countryCode?: string
  country?: string
}

const geoLabel = (entry: ActivityLogEntry): string | null => {
  const geo = entry.metadata?.geo as GeoMeta | undefined
  if (!geo) return null
  const parts = [geo.city, geo.region, geo.countryCode ?? geo.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

const eventLabel = (entry: ActivityLogEntry): string => {
  if (entry.event === 'app_open') return 'Opened the app'
  if (entry.event === 'route_view') return `Viewed ${routeName(entry) ?? 'a page'}`
  return entry.event.replaceAll('_', ' ')
}

const formatDuration = (seconds: number | null): string | null => {
  if (seconds == null || seconds <= 0) return null
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`
}

const confirmClear = () => {
  confirm.require({
    header: 'Clear log?',
    message: 'This permanently deletes every recorded entry.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Clear',
    rejectLabel: 'Cancel',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await clearEntries()
        toast.add({
          severity: 'success',
          summary: 'Log cleared',
          life: 3000,
        })
      } catch {
        toast.add({
          severity: 'error',
          summary: 'Clear failed',
          detail: 'Could not clear the log. Try again.',
          life: 3000,
        })
      }
    },
  })
}

onMounted(fetchEntries)
</script>

<template>
  <div class="logging-page">
    <header class="logging-page__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back"
        @click="router.back()"
      />
      <h1 class="logging-page__title">Activity Log</h1>
      <span v-if="entries.length > 0" class="logging-page__count">{{ entries.length }}</span>
      <div class="logging-page__actions">
        <Button
          icon="pi pi-refresh"
          text
          rounded
          aria-label="Refresh log"
          :loading="loading"
          @click="fetchEntries"
        />
        <Button
          v-if="entries.length > 0"
          icon="pi pi-trash"
          text
          rounded
          severity="danger"
          aria-label="Clear log"
          @click="confirmClear"
        />
      </div>
    </header>

    <div v-if="loading && entries.length === 0" class="logging-page__list">
      <div v-for="i in 3" :key="i" class="glass-surface logging-entry">
        <Skeleton width="3rem" height="0.9rem" />
        <div class="logging-entry__meta">
          <Skeleton height="0.9rem" width="55%" />
          <Skeleton height="0.75rem" width="35%" />
        </div>
      </div>
    </div>

    <EmptyState
      v-else-if="error"
      icon="pi-exclamation-circle"
      title="Couldn't load the log"
      :description="error"
    >
      <template #action>
        <Button label="Retry" icon="pi pi-refresh" outlined @click="fetchEntries" />
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="entries.length === 0"
      icon="pi-eye"
      title="No activity yet"
      description="Entries appear here whenever a tracked account opens the app."
    />

    <template v-else>
      <section v-for="group in groups" :key="group.day" class="logging-page__group">
        <h2 class="logging-page__day">{{ group.label }}</h2>
        <div class="logging-page__list">
          <article v-for="entry in group.items" :key="entry.id" class="glass-surface logging-entry">
            <span class="logging-entry__time">{{ timeOf(entry.createdAt) }}</span>
            <div class="logging-entry__meta">
              <p class="logging-entry__event">{{ eventLabel(entry) }}</p>
              <p class="logging-entry__detail">
                {{ deviceSummary(entry.userAgent) }}
                <template v-if="entry.path"> · {{ entry.path }}</template>
                <template v-if="formatDuration(entry.durationSeconds)">
                  · active {{ formatDuration(entry.durationSeconds) }}</template>
                <template v-if="geoLabel(entry)"> · 📍 {{ geoLabel(entry) }}</template>
              </p>
            </div>
            <span class="logging-entry__relative">{{ formatRelativeToNow(entry.createdAt) }}</span>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.logging-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.logging-page__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logging-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.logging-page__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.logging-page__actions {
  margin-left: auto;
  display: flex;
  gap: 0.25rem;
}

.logging-page__group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.logging-page__day {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.logging-page__list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.logging-entry {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.8rem 0.95rem;
  border-radius: var(--p-border-radius-xl, 16px);
}

.logging-entry__time {
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--p-indigo-300);
  flex-shrink: 0;
}

.logging-entry__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.logging-entry__event {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.logging-entry__detail {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logging-entry__relative {
  font-size: 0.72rem;
  opacity: 0.55;
  flex-shrink: 0;
}
</style>
