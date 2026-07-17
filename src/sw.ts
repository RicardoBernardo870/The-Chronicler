/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Activate a freshly-installed SW immediately instead of leaving it in the
// "waiting" state until every client closes — otherwise a deploy only shows
// up after fully closing and reopening the app (sometimes several times).
// main.ts listens for the resulting controllerchange and reloads once.
void self.skipWaiting()
self.addEventListener('activate', () => {
  void self.clients.claim()
})

// Precache all assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigation fallback: serve the precached shell for every in-app
// navigation (deep links, manifest shortcuts like /books/add, restored tabs).
// Without this, only URLs literally present in the precache resolve offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Runtime cache: book cover images
registerRoute(
  ({ url }) => url.hostname === 'covers.openlibrary.org',
  new CacheFirst({
    cacheName: 'book-covers',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// Runtime cache: ISBN API responses
registerRoute(
  ({ url }) => url.hostname === 'openlibrary.org' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'isbn-api',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
)

// Background Sync API — Chromium-only, so TypeScript's webworker lib ships
// neither SyncEvent nor the 'sync' entry in the SW event map; declare both.
declare global {
  interface SyncEvent extends ExtendableEvent {
    readonly tag: string
  }
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent
  }
}

// Background Sync: when connectivity restores the browser fires this event.
// We can't call Supabase directly here (no auth token in SW context), so we
// post a message to all open clients to flush the IndexedDB queue themselves.
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'progress-sync') {
    event.waitUntil(notifyClientsToFlush())
  }
})

const notifyClientsToFlush = async (): Promise<void> => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'FLUSH_PROGRESS_QUEUE' })
  }
}
