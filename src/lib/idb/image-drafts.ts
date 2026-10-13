import { get, set, del, createStore, keys } from 'idb-keyval'

export interface DraftImageItem {
  id: string
  draftKey: string
  blob: Blob
  dataUrl: string
  name: string
  originalSize: number
  compressedSize: number
  savingsPercent: number
  isPrimary: boolean
  sortOrder: number
  contentType: string
  createdAt: number
}

const isBrowser =
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'

export const imageDraftStore = isBrowser
  ? createStore('mezmani_draft_images_v1', 'draft_images')
  : undefined

/**
 * Save or update a draft image in IndexedDB.
 */
export async function saveDraftImage(item: DraftImageItem): Promise<void> {
  if (!isBrowser || !imageDraftStore) return
  await set(`${item.draftKey}:${item.id}`, item, imageDraftStore)
}

/**
 * Retrieve all draft images for a particular form/draft key.
 */
export async function getDraftImages(
  draftKey: string,
): Promise<DraftImageItem[]> {
  if (!isBrowser || !imageDraftStore) return []
  try {
    const allKeys = await keys(imageDraftStore)
    const prefix = `${draftKey}:`
    const matchingKeys = allKeys.filter(
      (k): k is string => typeof k === 'string' && k.startsWith(prefix),
    )

    const items: DraftImageItem[] = []
    for (const key of matchingKeys) {
      const item = await get<DraftImageItem>(key, imageDraftStore)
      if (item) items.push(item)
    }

    return items.sort((a, b) => a.sortOrder - b.sortOrder)
  } catch (err) {
    console.warn('[IDB] Error reading draft images:', err)
    return []
  }
}

/**
 * Remove a single draft image from IndexedDB.
 */
export async function removeDraftImage(
  draftKey: string,
  imageId: string,
): Promise<void> {
  if (!isBrowser || !imageDraftStore) return
  try {
    await del(`${draftKey}:${imageId}`, imageDraftStore)
  } catch (err) {
    console.warn('[IDB] Error deleting draft image:', err)
  }
}

/**
 * Clear all draft images for a given draft key (e.g. after upload or cancel).
 */
export async function clearDraftImages(draftKey: string): Promise<void> {
  if (!isBrowser || !imageDraftStore) return
  try {
    const allKeys = await keys(imageDraftStore)
    const prefix = `${draftKey}:`
    const matchingKeys = allKeys.filter(
      (k): k is string => typeof k === 'string' && k.startsWith(prefix),
    )

    await Promise.all(matchingKeys.map((k) => del(k, imageDraftStore)))
  } catch (err) {
    console.warn('[IDB] Error clearing draft images:', err)
  }
}
