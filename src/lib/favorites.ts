import { useSyncExternalStore } from 'react'
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

function getStore() {
  if (typeof window === 'undefined') return null
  if (!idbStore) {
    try {
      idbStore = createStore('mezmani', 'favorites')
    } catch (err) {
      console.warn('[Favorites] Failed to create IndexedDB store, falling back to memory-only:', err)
      idbStore = null
    }
  }
  return idbStore
}

function notify() {
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
        isHydrated = true
        notify()
      })
      .catch((err) => {
        console.warn('[Favorites] Error hydrating from IndexedDB:', err)
        isHydrated = true
        notify()
      })
  } else {
    isHydrated = true
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

  notify()
  return nextState
}

/**
 * Clean up a list of invalid or deleted product IDs from favorites storage.
 */
export function cleanupFavorites(invalidIds: string[]) {
  if (!invalidIds || invalidIds.length === 0) return
  const store = getStore()
  for (const id of invalidIds) {
    memoryFavorites.delete(id)
    if (store) {
      del(id, store).catch(() => {})
    }
  }
  notify()
}

/**
 * Clear all favorites from memory and IndexedDB.
 */
export function clearAllFavorites() {
  memoryFavorites.clear()
  const store = getStore()
  if (store) {
    keys(store)
      .then((kList) => {
        return Promise.all(kList.map((k) => del(k, store)))
      })
      .catch(() => {})
  }
  notify()
}

// React useSyncExternalStore subscribe function
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Snapshot returning the list of active favorite IDs
function getSnapshot(): string[] {
  // During SSR or before client hydration, always return empty array to prevent hydration mismatch
  if (!isHydrated) return []
  return Array.from(memoryFavorites)
}

function getServerSnapshot(): string[] {
  return []
}

/**
 * Hook to access and manipulate local favorites.
 */
export function useFavorites() {
  const favoriteIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const isFavorite = (productId: string) => {
    if (!isHydrated) return false
    return memoryFavorites.has(productId)
  }

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    cleanupFavorites,
    clearAllFavorites,
    isHydrated,
  }
}
