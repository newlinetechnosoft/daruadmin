import type { ProductProps, Variant } from '#/components/store/product-card'
import type { CartItem } from '#/lib/cart-context'
import type { UserInteractions } from '#/lib/user-interaction-tracker'

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
