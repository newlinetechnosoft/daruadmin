import type { ProductProps, Variant } from '#/components/store/product-card'
import type { CartItem } from '#/lib/cart-context'
import {
  getUserInteractions,
  type UserInteractions,
} from '#/lib/user-interaction-tracker'

export interface ScoredProduct extends ProductProps {
  totalSold?: number
  recommendationScore?: number
  pairingType?: 'cross' | 'complementary' | 'top-seller'
  activeInStockVariant?: Variant
}

/**
 * Checks if a product has at least one active in-stock variant.
 * Enforces the strict rule: NEVER recommend out-of-stock products.
 */
export function isProductInStock(product: ProductProps): boolean {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return false
  }
  return product.variants.some((v) => v.isActive && Number(v.stock) > 0)
}

/**
 * Finds the primary active in-stock variant for a product.
 */
export function getInStockVariant(product: ProductProps): Variant | undefined {
  if (!product || !Array.isArray(product.variants)) return undefined
  return product.variants.find((v) => v.isActive && Number(v.stock) > 0)
}

/**
 * High-efficiency recommendation scoring algorithm:
 * - High selling score (orders/sales velocity + featured/bestseller badges)
 * - High search click & intent score (user search keywords, click frequency, category affinity)
 * - Cross-category pairing (Drink item -> Food pairings; Food item -> Drink pairings)
 * - User need & cart context (fills missing meal/beverage gaps, avoids duplicate cart items)
 */
export function calculateRecommendationScore({
  candidate,
  currentProduct,
  cartItems = [],
  userInteractions,
}: {
  candidate: ProductProps & { totalSold?: number }
  currentProduct: ProductProps
  cartItems?: CartItem[]
  userInteractions: UserInteractions
}): number {
  let score = 0

  // 1. HIGH SELLING SCORE (0 - 45 points)
  const totalSold = Number(candidate.totalSold) || 0
  if (totalSold > 0) {
    score += Math.min(30, Math.log2(totalSold + 1) * 6.5)
  }

  if (candidate.isFeatured) {
    score += 12
  }

  const badge = (candidate.customBadge || '').toLowerCase()
  if (
    badge.includes('popular') ||
    badge.includes('top pick') ||
    badge.includes('bestseller') ||
    badge.includes('hot') ||
    badge.includes('must try')
  ) {
    score += 14
  }

  // 2. SEARCH CLICK & USER NEED SCORE (0 - 35 points)
  // Reward products the user has clicked on or inspected
  const clicks = userInteractions.productClicks[candidate.id] || 0
  if (clicks > 0) {
    score += Math.min(22, clicks * 7)
  }

  // Check if candidate matches recent search queries (e.g. "tuborg", "momo", "whiskey", "pizza")
  if (userInteractions.recentSearches.length > 0) {
    const candidateName = candidate.name.toLowerCase()
    const catName = (candidate.categoryName || '').toLowerCase()
    const brandName = (candidate.brandName || '').toLowerCase()

    for (const rawQuery of userInteractions.recentSearches) {
      const q = rawQuery.toLowerCase().trim()
      if (q.length >= 2) {
        if (candidateName.includes(q) || catName.includes(q) || brandName.includes(q)) {
          score += 18 // Strong search intent match
          break
        }
      }
    }
  }

  // Category browse affinity
  if (candidate.categorySlug) {
    const catAffinity = userInteractions.categoryClicks[candidate.categorySlug] || 0
    if (catAffinity > 0) {
      score += Math.min(10, catAffinity * 2.5)
    }
  }

  // 3. CROSS-CATEGORY PAIRING BONUS (0 - 35 points)
  // "in drink item food also in food item drinks also"
  const isViewingDrink = currentProduct.catalogType === 'liquor'
  const isViewingFood = currentProduct.catalogType === 'food'

  if (isViewingDrink) {
    if (candidate.catalogType === 'food') {
      // High bonus for food pairings with drinks!
      score += 26

      const foodName = candidate.name.toLowerCase()
      // Iconic bar snacks & pairings in Nepal
      if (
        foodName.includes('sekuwa') ||
        foodName.includes('chilly') ||
        foodName.includes('chilli') ||
        foodName.includes('peanut') ||
        foodName.includes('bhatmas') ||
        foodName.includes('momo') ||
        foodName.includes('sukuti') ||
        foodName.includes('chips') ||
        foodName.includes('fries') ||
        foodName.includes('roast') ||
        foodName.includes('snack') ||
        foodName.includes('wing') ||
        foodName.includes('pizz')
      ) {
        score += 10
      }
    } else if (candidate.catalogType === 'liquor') {
      // Complementary drinks/mixers: beers, soda, tonic, coke
      const drinkName = candidate.name.toLowerCase()
      if (
        drinkName.includes('beer') ||
        drinkName.includes('soda') ||
        drinkName.includes('coke') ||
        drinkName.includes('cola') ||
        drinkName.includes('water') ||
        drinkName.includes('tonic') ||
        drinkName.includes('red bull')
      ) {
        score += 12
      } else {
        score += 5
      }
    }
  } else if (isViewingFood) {
    if (candidate.catalogType === 'liquor') {
      // High bonus for drinks when viewing food!
      score += 26

      const drinkName = candidate.name.toLowerCase()
      // Chilled beers and refreshing beverages to wash down hot food
      if (
        drinkName.includes('beer') ||
        drinkName.includes('tuborg') ||
        drinkName.includes('carlsberg') ||
        drinkName.includes('gorkha') ||
        drinkName.includes('barasingha') ||
        drinkName.includes('wine') ||
        drinkName.includes('coke') ||
        drinkName.includes('vodka')
      ) {
        score += 10
      }
    } else if (candidate.catalogType === 'food') {
      score += 8
    }
  }

  // 4. USER CART CONTEXT & NEED (0 - 15 points)
  // If product is already in cart, reduce score to suggest new complementary pairing
  const alreadyInCart = cartItems.some((ci) => ci.productId === candidate.id)
  if (alreadyInCart) {
    score -= 25
  }

  // If cart has drinks but zero food, boost food pairings
  const cartHasDrink = cartItems.some((ci) => ci.catalogType === 'liquor')
  const cartHasFood = cartItems.some((ci) => ci.catalogType === 'food')

  if (cartHasDrink && !cartHasFood && candidate.catalogType === 'food') {
    score += 16
  } else if (cartHasFood && !cartHasDrink && candidate.catalogType === 'liquor') {
    score += 16
  }

  return score
}

/**
 * Rank candidates and return the top 4 diversified, 100% in-stock pairings.
 */
export function getRecommendedPairings({
  candidates,
  currentProduct,
  cartItems = [],
  userInteractions,
  limit = 4,
}: {
  candidates: (ProductProps & { totalSold?: number })[]
  currentProduct: ProductProps
  cartItems?: CartItem[]
  userInteractions: UserInteractions
  limit?: number
}): ScoredProduct[] {
  // Step 1: Strict In-Stock Filter & Current Product Exclusion
  const validCandidates: ScoredProduct[] = []

  for (const item of candidates) {
    if (!item || item.id === currentProduct.id) continue
    const inStockVar = getInStockVariant(item)
    if (!inStockVar) continue // 100% EXCLUDE OUT OF STOCK

    const score = calculateRecommendationScore({
      candidate: item,
      currentProduct,
      cartItems,
      userInteractions,
    })

    const isCross =
      (currentProduct.catalogType === 'liquor' && item.catalogType === 'food') ||
      (currentProduct.catalogType === 'food' && item.catalogType === 'liquor')

    validCandidates.push({
      ...item,
      totalSold: item.totalSold || 0,
      recommendationScore: score,
      activeInStockVariant: inStockVar,
      pairingType: isCross
        ? 'cross'
        : (item.totalSold || 0) > 0 || item.isFeatured
          ? 'top-seller'
          : 'complementary',
    })
  }

  if (validCandidates.length === 0) return []

  // Step 2: Separate cross-category vs complementary candidates
  const crossItems = validCandidates
    .filter((c) => c.pairingType === 'cross')
    .sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0))

  const otherItems = validCandidates
    .filter((c) => c.pairingType !== 'cross')
    .sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0))

  // Step 3: Balanced selection
  // When viewing Drinks: recommend top Food items + top complementary items
  // When viewing Food: recommend top Drinks + top complementary items
  const results: ScoredProduct[] = []
  const seenIds = new Set<string>()

  // Take top cross-category items (e.g. food for drinks, drinks for food)
  const crossTarget = currentProduct.catalogType === 'liquor' || currentProduct.catalogType === 'food' ? 2 : 1
  for (const item of crossItems) {
    if (results.length >= crossTarget) break
    if (!seenIds.has(item.id)) {
      results.push(item)
      seenIds.add(item.id)
    }
  }

  // Fill remaining slots from other highest-scored items
  for (const item of otherItems) {
    if (results.length >= limit) break
    if (!seenIds.has(item.id)) {
      results.push(item)
      seenIds.add(item.id)
    }
  }

  // If still slots left, fill with remaining cross items
  for (const item of crossItems) {
    if (results.length >= limit) break
    if (!seenIds.has(item.id)) {
      results.push(item)
      seenIds.add(item.id)
    }
  }

  return results.slice(0, limit)
}

export interface ProductStockInfo {
  maxStock: number
  totalStock: number
  isOutOfStock: boolean
  hasHealthyStock: boolean // stock > 5
}

/**
 * Calculates stock availability metrics across all active variants of a product.
 */
export function getProductStockInfo(product: ProductProps): ProductStockInfo {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return { maxStock: 0, totalStock: 0, isOutOfStock: true, hasHealthyStock: false }
  }

  const activeVariants = product.variants.filter((v) => v.isActive)
  if (activeVariants.length === 0) {
    return { maxStock: 0, totalStock: 0, isOutOfStock: true, hasHealthyStock: false }
  }

  let maxStock = 0
  let totalStock = 0

  for (const v of activeVariants) {
    const s = Math.max(0, Number(v.stock) || 0)
    totalStock += s
    if (s > maxStock) maxStock = s
  }

  const isOutOfStock = maxStock <= 0
  const hasHealthyStock = maxStock > 5 || totalStock > 5

  return {
    maxStock,
    totalStock,
    isOutOfStock,
    hasHealthyStock,
  }
}

/**
 * Computes recommendation score for a catalog product:
 * - High selling score (orders/sales velocity + featured/bestseller badges)
 * - User search keyword intent and past click engagement
 * - Product discounts and promotional value
 */
export function computeCatalogProductScore(
  product: ProductProps & { totalSold?: number },
  userInteractions?: UserInteractions
): number {
  let score = 0

  // 1. High-selling performance (0 - 45 pts)
  const totalSold = Number(product.totalSold) || 0
  if (totalSold > 0) {
    score += Math.min(32, Math.log2(totalSold + 1) * 7.5)
  }

  if (product.isFeatured) {
    score += 15
  }

  const badge = (product.customBadge || '').toLowerCase()
  if (
    badge.includes('popular') ||
    badge.includes('top pick') ||
    badge.includes('bestseller') ||
    badge.includes('hot') ||
    badge.includes('must try')
  ) {
    score += 15
  }

  // 2. User Search Click & Intent Tracking (0 - 35 pts)
  if (userInteractions) {
    const clicks = userInteractions.productClicks[product.id] || 0
    if (clicks > 0) {
      score += Math.min(20, clicks * 5)
    }

    if (userInteractions.recentSearches.length > 0) {
      const name = product.name.toLowerCase()
      const cat = (product.categoryName || '').toLowerCase()
      const brand = (product.brandName || '').toLowerCase()

      for (const rawQ of userInteractions.recentSearches) {
        const q = rawQ.toLowerCase().trim()
        if (q && q.length >= 2) {
          if (name.includes(q) || cat.includes(q) || brand.includes(q)) {
            score += 18
            break
          }
        }
      }
    }

    if (product.categorySlug) {
      const catClicks = userInteractions.categoryClicks[product.categorySlug] || 0
      if (catClicks > 0) {
        score += Math.min(10, catClicks * 2)
      }
    }
  }

  // 3. Discount appeal (0 - 8 pts)
  const firstVariant = product.variants?.[0]
  if (firstVariant?.compareAtPrice && firstVariant.compareAtPrice > firstVariant.price) {
    score += 6
  }

  return score
}

/**
 * Universal catalog product sorter with smart "Recommended" ranking:
 * 1. Sold out / out-of-stock items ALWAYS go to the very end across all sort modes.
 * 2. On "Recommended" sort:
 *    - Tier 1: Healthy stock (> 5 units) with high sales volume & search interest at the TOP.
 *    - Tier 2: Low in-stock items (1 to 5 units) in the middle.
 *    - Tier 3: Sold out / 0 stock items at the very last.
 */
export function sortCatalogProducts<T extends ProductProps & { totalSold?: number }>({
  products,
  sortBy = 'recommended',
  userInteractions,
}: {
  products: T[]
  sortBy?: string
  userInteractions?: UserInteractions
}): T[] {
  const list = [...products]

  if (sortBy === 'price-low') {
    return list.sort((a, b) => {
      const aStock = getProductStockInfo(a)
      const bStock = getProductStockInfo(b)

      // Sold out always at last
      if (aStock.isOutOfStock !== bStock.isOutOfStock) {
        return aStock.isOutOfStock ? 1 : -1
      }

      const aPrice = a.variants[0]?.price ?? 0
      const bPrice = b.variants[0]?.price ?? 0
      return aPrice - bPrice
    })
  }

  if (sortBy === 'price-high') {
    return list.sort((a, b) => {
      const aStock = getProductStockInfo(a)
      const bStock = getProductStockInfo(b)

      // Sold out always at last
      if (aStock.isOutOfStock !== bStock.isOutOfStock) {
        return aStock.isOutOfStock ? 1 : -1
      }

      const aPrice = a.variants[0]?.price ?? 0
      const bPrice = b.variants[0]?.price ?? 0
      return bPrice - aPrice
    })
  }

  if (sortBy === 'newest') {
    return list.sort((a, b) => {
      const aStock = getProductStockInfo(a)
      const bStock = getProductStockInfo(b)

      // Sold out always at last
      if (aStock.isOutOfStock !== bStock.isOutOfStock) {
        return aStock.isOutOfStock ? 1 : -1
      }

      return b.name.localeCompare(a.name)
    })
  }

  // 'recommended'
  const interactions = userInteractions || getUserInteractions()

  // Pre-calculate meta to optimize sorting performance to O(N)
  const metaMap = new Map<
    string,
    {
      stockInfo: ProductStockInfo
      tier: number // 1: stock > 5, 2: stock 1-5, 3: out of stock
      score: number
    }
  >()

  for (const p of list) {
    const stockInfo = getProductStockInfo(p)
    let tier = 2
    if (stockInfo.isOutOfStock) {
      tier = 3 // Sold out at the very last
    } else if (stockInfo.hasHealthyStock) {
      tier = 1 // Stock > 5 on top
    }

    const score = computeCatalogProductScore(p, interactions)
    metaMap.set(p.id, { stockInfo, tier, score })
  }

  return list.sort((a, b) => {
    const metaA = metaMap.get(a.id)!
    const metaB = metaMap.get(b.id)!

    // Tier 1 (stock > 5) -> Tier 2 (stock 1-5) -> Tier 3 (sold out)
    if (metaA.tier !== metaB.tier) {
      return metaA.tier - metaB.tier
    }

    // Within same tier, sort by recommendation score descending
    if (metaB.score !== metaA.score) {
      return metaB.score - metaA.score
    }

    // Secondary tiebreaker: total sales volume
    const aSold = a.totalSold || 0
    const bSold = b.totalSold || 0
    if (bSold !== aSold) {
      return bSold - aSold
    }

    return a.name.localeCompare(b.name)
  })
}
