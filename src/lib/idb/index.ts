import { get, set, del, clear, createStore } from 'idb-keyval'
import type {
  Persister,
  PersistedClient,
} from '@tanstack/react-query-persist-client'
import { clearAllFavorites } from '#/lib/favorites'

const isBrowser =
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'

// Dedicated custom stores
const appStore = isBrowser
  ? createStore('mezmani_app_v1', 'mezmani_keyval')
  : undefined

const outboxStore = isBrowser
  ? createStore('mezmani_fleet_v1', 'mezmani_outbox')
  : undefined

const queryStore = isBrowser
  ? createStore('mezmani_query_v1', 'mezmani_cache')
  : undefined

export { outboxStore, appStore, queryStore }

/**
 * Robust IndexedDB get with fallback to localStorage / in-memory.
 */
export async function idbGet<T>(key: string, fallback: T): Promise<T> {
  if (!isBrowser || !appStore) return fallback

  try {
    const val = await get<T>(key, appStore)
    if (val !== undefined && val !== null) {
      return val
    }

    // Fallback to localStorage if migrating or available
    const localVal = localStorage.getItem(key)
    if (localVal !== null) {
      try {
        const parsed = JSON.parse(localVal) as T
        // Migrate into IDB asynchronously
        set(key, parsed, appStore).catch(() => {})
        return parsed
      } catch {
        return (localVal as unknown as T) || fallback
      }
    }
  } catch (err) {
    console.warn(`[IDB] get error for key "${key}", falling back:`, err)
    try {
      const localVal = localStorage.getItem(key)
      if (localVal) return JSON.parse(localVal)
    } catch {
      // fallback
    }
  }

  return fallback
}

/**
 * Robust IndexedDB set with synchronized localStorage backup.
 */
export async function idbSet<T>(key: string, value: T): Promise<void> {
  if (!isBrowser) return

  try {
    if (appStore) {
      await set(key, value, appStore)
    }
  } catch (err) {
    console.warn(`[IDB] set error for key "${key}":`, err)
  }

  // Also sync to localStorage for instant synchronous hydration on mount
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota issues
  }
}

/**
 * Delete key from IndexedDB and localStorage.
 */
export async function idbDel(key: string): Promise<void> {
  if (!isBrowser) return

  try {
    if (appStore) {
      await del(key, appStore)
    }
  } catch (err) {
    console.warn(`[IDB] del error for key "${key}":`, err)
  }

  try {
    localStorage.removeItem(key)
  } catch {}
}

/**
 * Creates an IndexedDB Persister for TanStack Query.
 */
export function createIdbPersister(
  idbKey = 'mezmani_react_query_cache',
): Persister {
  return {
    persistClient: async (persistedClient: PersistedClient) => {
      if (!isBrowser || !queryStore) return
      try {
        await set(idbKey, persistedClient, queryStore)
      } catch (err) {
        console.warn('[IDB Persister] Failed to save query cache:', err)
      }
    },
    restoreClient: async () => {
      if (!isBrowser || !queryStore) return undefined
      try {
        return await get<PersistedClient>(idbKey, queryStore)
      } catch (err) {
        console.warn('[IDB Persister] Failed to restore query cache:', err)
        return undefined
      }
    },
    removeClient: async () => {
      if (!isBrowser || !queryStore) return
      try {
        await del(idbKey, queryStore)
      } catch (err) {
        console.warn('[IDB Persister] Failed to remove query cache:', err)
      }
    },
  }
}

/**
 * Form draft persistence (for admin product editor, notes, etc.)
 */
export async function saveFormDraft<T>(formId: string, data: T): Promise<void> {
  return idbSet(`draft_${formId}`, { data, savedAt: Date.now() })
}

export async function getFormDraft<T>(formId: string): Promise<T | null> {
  const result = await idbGet<{ data: T; savedAt: number } | null>(
    `draft_${formId}`,
    null,
  )
  return result?.data ?? null
}

export async function clearFormDraft(formId: string): Promise<void> {
  return idbDel(`draft_${formId}`)
}

/**
 * Recently viewed products
 */
export async function getRecentlyViewed(): Promise<string[]> {
  return idbGet<string[]>('mezmani_recently_viewed', [])
}

export async function addRecentlyViewed(productId: string): Promise<void> {
  if (!productId) return
  const current = await getRecentlyViewed()
  const updated = [
    productId,
    ...current.filter((id) => id !== productId),
  ].slice(0, 20)
  return idbSet('mezmani_recently_viewed', updated)
}

/**
 * Recent search terms
 */
export async function getRecentSearches(): Promise<string[]> {
  return idbGet<string[]>('mezmani_recent_searches', [])
}

export async function addRecentSearch(term: string): Promise<void> {
  const clean = term.trim()
  if (!clean) return
  const current = await getRecentSearches()
  const updated = [
    clean,
    ...current.filter((t) => t.toLowerCase() !== clean.toLowerCase()),
  ].slice(0, 10)
  return idbSet('mezmani_recent_searches', updated)
}

/**
 * Wipe all local client caches on logout (data isolation).
 */
export async function clearAllLocalData(): Promise<void> {
  if (!isBrowser) return

  try {
    if (appStore) await clear(appStore)
    if (outboxStore) await clear(outboxStore)
    if (queryStore) await clear(queryStore)
  } catch (err) {
    console.warn('[IDB] clear error:', err)
  }

  try {
    clearAllFavorites()
  } catch {}

  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {}
}
