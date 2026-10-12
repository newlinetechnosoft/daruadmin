import { useSyncExternalStore, useCallback } from 'react'
import { createStore, set, del, keys } from 'idb-keyval'

/**
 * FAVORITES STORAGE
 *
 * Local-only storage in IndexedDB (Database: "mezmani", Store: "favorites").
 * Key = productId (string), Value = { id: string, addedAt: number }.
 *
 * NOTE: This is client-side only and intentionally DOES NOT sync with the server.
 * Full product data and prices are never stored here so that data never goes stale.
 * Private browsing mode / blocked storage will safely fall back to in-memory state.
 */

interface FavoriteEntry {
  id: string
  addedAt: number
}

// Module-level in-memory state
const memoryFavorites = new Set<string>()
const listeners = new Set<() => void>()
let isHydrated = false
let idbStore: ReturnType<typeof createStore> | null = null

// IMMUTABLE STABLE SNAPSHOTS:
// useSyncExternalStore requires getSnapshot to return a referentially stable value
// unless the store has actually mutated. Returning new arrays inside getSnapshot
// causes React to detect infinite loops ("Maximum update depth exceeded").
const EMPTY_SNAPSHOT: readonly string[] = Object.freeze([])
let cachedSnapshot: readonly string[] = EMPTY_SNAPSHOT

function getStore() {
  if (typeof window === 'undefined') return null
  if (!idbStore) {
    try {
      idbStore = createStore('mezmani', 'favorites')
    } catch (err) {
      console.warn(
        '[Favorites] Failed to create IndexedDB store, falling back to memory-only:',
        err,
      )
      idbStore = null
    }
  }
  return idbStore
}

function updateSnapshotAndNotify() {
  cachedSnapshot = Object.freeze(Array.from(memoryFavorites))
  listeners.forEach((listener) => listener())
}

// Client-only initialization
if (typeof window !== 'undefined') {
  const store = getStore()
  if (store) {
    keys(store)
      .then((favKeys) => {
        favKeys.forEach((k) => {
          if (typeof k === 'string') {
            memoryFavorites.add(k)
          }
        })

        // One-time migration of existing localStorage values
        try {
          const legacy =
            localStorage.getItem('mezmani_favorites') ||
            localStorage.getItem('favorites') ||
            localStorage.getItem('mezmani_favs')
          if (legacy) {
            const parsed = JSON.parse(legacy)
            if (Array.isArray(parsed)) {
              for (const id of parsed) {
                if (typeof id === 'string' && !memoryFavorites.has(id)) {
                  memoryFavorites.add(id)
                  set(id, { id, addedAt: Date.now() }, store).catch(() => {})
                }
              }
            }
            localStorage.removeItem('mezmani_favorites')
            localStorage.removeItem('favorites')
            localStorage.removeItem('mezmani_favs')
          }
        } catch {}

        isHydrated = true
        updateSnapshotAndNotify()
      })
      .catch((err) => {
        console.warn('[Favorites] Error hydrating from IndexedDB:', err)
        isHydrated = true
        updateSnapshotAndNotify()
      })
  } else {
    isHydrated = true
    updateSnapshotAndNotify()
  }
}

/**
 * Toggle a product's favorited status optimistically.
 * Background writes to IndexedDB are fire-and-forget inside try/catch.
 */
export function toggleFavorite(productId: string): boolean {
  if (!productId) return false

  const nextState = !memoryFavorites.has(productId)

  if (nextState) {
    memoryFavorites.add(productId)
    const store = getStore()
    if (store) {
      const entry: FavoriteEntry = { id: productId, addedAt: Date.now() }
      set(productId, entry, store).catch((err) => {
        console.warn('[Favorites] Failed to persist favorite:', err)
      })
    }
  } else {
    memoryFavorites.delete(productId)
    const store = getStore()
    if (store) {
      del(productId, store).catch((err) => {
        console.warn('[Favorites] Failed to remove favorite:', err)
      })
    }
  }

  updateSnapshotAndNotify()
  return nextState
}

/**
 * Clean up a list of invalid or deleted product IDs from favorites storage.
 */
export function cleanupFavorites(invalidIds: string[]) {
  if (invalidIds.length === 0) return
  let changed = false
  const store = getStore()
  for (const id of invalidIds) {
    if (memoryFavorites.has(id)) {
      memoryFavorites.delete(id)
      changed = true
      if (store) {
        del(id, store).catch(() => {})
      }
    }
  }
  if (changed) {
    updateSnapshotAndNotify()
  }
}

/**
 * Clear all favorites from memory and IndexedDB.
 */
export function clearAllFavorites() {
  if (memoryFavorites.size === 0) return
  memoryFavorites.clear()
  const store = getStore()
  if (store) {
    keys(store)
      .then((kList) => {
        return Promise.all(kList.map((k) => del(k, store)))
      })
      .catch(() => {})
  }
  updateSnapshotAndNotify()
}

// React useSyncExternalStore subscribe function
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): readonly string[] {
  if (!isHydrated) return EMPTY_SNAPSHOT
  return cachedSnapshot
}

function getServerSnapshot(): readonly string[] {
  return EMPTY_SNAPSHOT
}

/**
 * Highly optimized selector hook to check if a specific product is favorited.
 * Returns a boolean primitive, so other product cards in the grid NEVER re-render
 * when an unrelated product is favorited!
 */
export function useIsFavorite(productId: string): boolean {
  const check = useCallback(() => {
    if (!isHydrated) return false
    return memoryFavorites.has(productId)
  }, [productId])

  const checkServer = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, check, checkServer)
}

/**
 * Hook to access all favorites and actions.
 */
export function useFavorites() {
  const favoriteIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const isFavorite = useCallback((productId: string) => {
    if (!isHydrated) return false
    return memoryFavorites.has(productId)
  }, [])

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    cleanupFavorites,
    clearAllFavorites,
    isHydrated,
  }
}
