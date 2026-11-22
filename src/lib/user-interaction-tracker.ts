export interface UserInteractions {
  recentSearches: string[]
  productClicks: Record<string, number>
  categoryClicks: Record<string, number>
  catalogTypeClicks: Record<string, number>
  lastUpdated: number
}

const STORAGE_KEY = 'mezmani_user_interactions_v1'
const MAX_SEARCHES = 10
const MAX_TRACKED_PRODUCTS = 60

function getStoredInteractions(): UserInteractions {
  if (typeof window === 'undefined') {
    return {
      recentSearches: [],
      productClicks: {},
      categoryClicks: {},
      catalogTypeClicks: {},
      lastUpdated: 0,
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        recentSearches: [],
        productClicks: {},
        categoryClicks: {},
        catalogTypeClicks: {},
        lastUpdated: Date.now(),
      }
    }
    const parsed = JSON.parse(raw) as UserInteractions
    // Reset if corrupted or older than 14 days
    if (Date.now() - (parsed.lastUpdated || 0) > 14 * 24 * 60 * 60 * 1000) {
      return {
        recentSearches: [],
        productClicks: {},
        categoryClicks: {},
        catalogTypeClicks: {},
        lastUpdated: Date.now(),
      }
    }
    return {
      recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
      productClicks: typeof parsed.productClicks === 'object' && parsed.productClicks !== null ? parsed.productClicks : {},
      categoryClicks: typeof parsed.categoryClicks === 'object' && parsed.categoryClicks !== null ? parsed.categoryClicks : {},
      catalogTypeClicks: typeof parsed.catalogTypeClicks === 'object' && parsed.catalogTypeClicks !== null ? parsed.catalogTypeClicks : {},
      lastUpdated: parsed.lastUpdated || Date.now(),
    }
  } catch {
    return {
      recentSearches: [],
      productClicks: {},
      categoryClicks: {},
      catalogTypeClicks: {},
      lastUpdated: Date.now(),
    }
  }
}

function saveInteractions(data: UserInteractions) {
  if (typeof window === 'undefined') return
  try {
    data.lastUpdated = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent('mezmani:interactions_updated', { detail: data }))
  } catch {
    // Ignore quota or private-browsing errors
  }
}

/**
 * Track user search keywords to recommend items matching their intent.
 */
export function trackSearchQuery(query: string) {
  const q = query.trim().toLowerCase()
  if (!q || q.length < 2) return

  const data = getStoredInteractions()
  const filtered = data.recentSearches.filter((item) => item.toLowerCase() !== q)
  data.recentSearches = [q, ...filtered].slice(0, MAX_SEARCHES)
  saveInteractions(data)
}

/**
 * Track user clicks and modal opens on products to identify high-interest categories and items.
 */
export function trackProductClick(product: {
  id: string
  name?: string
  categorySlug?: string
  catalogType?: string
}) {
  if (!product?.id) return

  const data = getStoredInteractions()
  data.productClicks[product.id] = (data.productClicks[product.id] || 0) + 1

  // Keep map within bound
  const keys = Object.keys(data.productClicks)
  if (keys.length > MAX_TRACKED_PRODUCTS) {
    const sorted = keys.sort((a, b) => data.productClicks[b] - data.productClicks[a])
    const newProductClicks: Record<string, number> = {}
    for (let i = 0; i < MAX_TRACKED_PRODUCTS; i++) {
      newProductClicks[sorted[i]] = data.productClicks[sorted[i]]
    }
    data.productClicks = newProductClicks
  }

  if (product.categorySlug) {
    data.categoryClicks[product.categorySlug] = (data.categoryClicks[product.categorySlug] || 0) + 1
  }

  if (product.catalogType) {
    data.catalogTypeClicks[product.catalogType] = (data.catalogTypeClicks[product.catalogType] || 0) + 1
  }

  saveInteractions(data)
}

/**
 * Read current user interactions snapshot.
 */
export function getUserInteractions(): UserInteractions {
  return getStoredInteractions()
}
