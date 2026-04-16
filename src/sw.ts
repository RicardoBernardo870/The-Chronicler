/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Precache all assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

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
