/**
 * useOfflineSync — IndexedDB-backed offline queue for progress updates.
 *
 * When the device is offline, progress mutations are written here first.
 * flushQueue() drains them in order once connectivity is restored.
 * The service worker's Background Sync handler calls flushQueue() even
 * after the tab has been closed.
 */

import type { OfflineProgressMutation } from '@/types'

const DB_NAME = 'chronicler-offline'
const STORE_NAME = 'progress_queue'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function useOfflineSync() {
  async function enqueue(mutation: Omit<OfflineProgressMutation, 'id' | 'retries'>): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record: OfflineProgressMutation = { ...mutation, retries: 0 }
      const req = store.add(record)
      req.onsuccess = () => {
        db.close()
        resolve()
      }
      req.onerror = () => {
        db.close()
        reject(req.error)
      }
    })
  }

  async function dequeue(id: number): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(id)
      req.onsuccess = () => { db.close(); resolve() }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  }

  async function getAll(): Promise<OfflineProgressMutation[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => { db.close(); resolve(req.result) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  }

  /**
   * Flush pending mutations to Supabase in FIFO order.
   * `syncFn` is provided by the progress store so this composable
   * stays free of Supabase / store imports (avoids circular deps).
   */
  async function flushQueue(
    syncFn: (bookId: string, currentPage: number) => Promise<void>,
  ): Promise<number> {
    const pending = await getAll()
    let flushed = 0
    for (const mutation of pending) {
      try {
        await syncFn(mutation.payload.bookId, mutation.payload.currentPage)
        await dequeue(mutation.id!)
        flushed++
      } catch {
        // Leave in queue; Background Sync will retry
      }
    }
    return flushed
  }

  /** Register a Background Sync tag so the service worker can flush on reconnect */
  async function registerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return
    try {
      const registration = await navigator.serviceWorker.ready
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
        .sync.register('progress-sync')
    } catch {
      // Background Sync not supported — silent fallback to online event
    }
  }

  return { enqueue, flushQueue, registerBackgroundSync }
}
