import { db } from '#/db'
import {
  orders,
  orderItems,
  dealers,
  dealerItems,
  liquorProducts,
  liquorVariants,
  liquorCategories,
  groceryProducts,
  groceryVariants,
  groceryCategories,
} from '#/db/schema'
import { and, eq, gte, ne } from 'drizzle-orm'

export interface TopProductMetric {
  productId: string
  name: string
  catalogType: 'liquor' | 'grocery'
  unitsSold: number
  ordersCount: number
  grossRevenue: number // paisa
  totalDealerCost: number // paisa
  grossProfit: number // paisa
  marginPercent: number
  avgSellingPrice: number // paisa
}

export interface SlowMoverMetric {
  productId: string
  name: string
  catalogType: 'liquor' | 'grocery'
  categoryName: string
  unitsSold: number
  grossRevenue: number // paisa
  lastOrderDate: string | null
  daysSinceLastOrder: number | null
  dealerCarryingCount: number
  basePrice: number // paisa
  status: 'zero_sales' | 'slow_mover'
}

export interface MostUnavailableMetric {
  productId: string
  name: string
  catalogType: 'liquor' | 'grocery'
  totalRequested: number
  unavailableCount: number
  fulfilledCount: number
  unavailabilityRatePercent: number
  affectedDealerNames: string[]
}

export interface DealerSubstitutionMetric {
  dealerId: string
  dealerName: string
  contact: string
  city: string
  totalAssigned: number
  fulfilled: number
  substituted: number // marked unavailable
  substitutionRatePercent: number
  fulfilmentRatePercent: number
  severity: 'low' | 'moderate' | 'high'
}

export interface ProductSourcingIntelligenceReport {
  periodDays: number | null // null = all time
  cutoffDate: string | null
  summary: {
    totalRevenue: number
    totalUnitsSold: number
    topProductByRevenue: string | null
    slowMoversCount: number
    zeroSalesCount: number
    mostUnavailableProduct: string | null
    networkSubstitutionRatePercent: number
    totalAssignedDealerItems: number
    totalSubstitutedDealerItems: number
  }
  topProducts: TopProductMetric[]
  slowMovers: SlowMoverMetric[]
  mostUnavailable: MostUnavailableMetric[]
  dealerSubstitutionRates: DealerSubstitutionMetric[]
}

export async function getProductVelocityAndSourcingIntelligenceQuery(
  days: number | null = null,
): Promise<ProductSourcingIntelligenceReport> {
  const now = new Date()
  const cutoffDate =
    days && days > 0
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : null

  // 1. Fetch relevant orders and order items
  const orderConditions = [ne(orders.status, 'cancelled')]
  if (cutoffDate) {
    orderConditions.push(gte(orders.createdAt, cutoffDate))
  }

  // Join orderItems with matching orders
  const itemRows = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      name: orderItems.name,
      variantName: orderItems.variantName,
      catalogType: orderItems.catalogType,
      qty: orderItems.qty,
      unitPrice: orderItems.unitPrice,
      lineTotal: orderItems.lineTotal,
      dealerId: orderItems.dealerId,
      dealerCostPrice: orderItems.dealerCostPrice,
      sourcingStatus: orderItems.sourcingStatus,
      orderCreatedAt: orders.createdAt,
      orderStatus: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...orderConditions))

  // 2. Load all dealers for substitution analysis & name resolution
  const allDealers = await db.select().from(dealers)
  const dealersMap = new Map<string, (typeof allDealers)[0]>()
  for (const d of allDealers) {
    dealersMap.set(d.id, d)
  }

  // 3. Load catalog products, categories, variants, and dealer item coverage
  const [
    liquorProds,
    liquorCats,
    liquorVars,
    groceryProds,
    groceryCats,
    groceryVars,
    allDealerItems,
  ] = await Promise.all([
    db.select().from(liquorProducts),
    db.select().from(liquorCategories),
    db.select().from(liquorVariants),
    db.select().from(groceryProducts),
    db.select().from(groceryCategories),
    db.select().from(groceryVariants),
    db.select().from(dealerItems),
  ])

  const liquorCatMap = new Map(liquorCats.map((c) => [c.id, c.name]))
  const groceryCatMap = new Map(groceryCats.map((c) => [c.id, c.name]))

  // Map lowest/first variant price per product
  const productPriceMap = new Map<string, number>()
  for (const v of liquorVars) {
    const existing = productPriceMap.get(v.productId)
    if (!existing || v.price < existing) {
      productPriceMap.set(v.productId, v.price)
    }
  }
  for (const v of groceryVars) {
    const existing = productPriceMap.get(v.productId)
    if (!existing || v.price < existing) {
      productPriceMap.set(v.productId, v.price)
    }
  }

  // Count active dealers carrying each product
  const dealerCoverageMap = new Map<string, number>()
  for (const di of allDealerItems) {
    if (di.isAvailable !== false) {
      const count = dealerCoverageMap.get(di.productId) || 0
      dealerCoverageMap.set(di.productId, count + 1)
    }
  }

  // ==========================================
  // SECTION A: Top Products Aggregation
  // ==========================================
  const productSalesMap = new Map<
    string,
    {
      productId: string
      name: string
      catalogType: 'liquor' | 'grocery'
      unitsSold: number
      ordersSet: Set<string>
      grossRevenue: number
      totalDealerCost: number
    }
  >()

  for (const item of itemRows) {
    const key = item.productId
    const existing = productSalesMap.get(key) || {
      productId: item.productId,
      name: item.name,
      catalogType: item.catalogType as 'liquor' | 'grocery',
      unitsSold: 0,
      ordersSet: new Set<string>(),
      grossRevenue: 0,
      totalDealerCost: 0,
    }

    existing.unitsSold += item.qty
    existing.ordersSet.add(item.orderId)
    existing.grossRevenue += item.lineTotal
    const unitCost = item.dealerCostPrice ?? Math.round(item.unitPrice * 0.85)
    existing.totalDealerCost += unitCost * item.qty
    productSalesMap.set(key, existing)
  }

  const topProducts: TopProductMetric[] = Array.from(productSalesMap.values())
    .map((p) => {
      const grossProfit = p.grossRevenue - p.totalDealerCost
      const marginPercent =
        p.grossRevenue > 0
          ? Number(((grossProfit / p.grossRevenue) * 100).toFixed(1))
          : 0
      const avgSellingPrice =
        p.unitsSold > 0 ? Math.round(p.grossRevenue / p.unitsSold) : 0

      return {
        productId: p.productId,
        name: p.name,
        catalogType: p.catalogType,
        unitsSold: p.unitsSold,
        ordersCount: p.ordersSet.size,
        grossRevenue: p.grossRevenue,
        totalDealerCost: p.totalDealerCost,
        grossProfit,
        marginPercent,
        avgSellingPrice,
      }
    })
    .sort((a, b) => b.grossRevenue - a.grossRevenue)

  // ==========================================
  // SECTION B: Slow Movers & Dead Stock Risk
  // ==========================================
  // Track last order date for all products across all orders
  const lastOrderMap = new Map<string, Date>()
  for (const item of itemRows) {
    const existingDate = lastOrderMap.get(item.productId)
    if (!existingDate || item.orderCreatedAt > existingDate) {
      lastOrderMap.set(item.productId, item.orderCreatedAt)
    }
  }

  const slowMoversList: SlowMoverMetric[] = []

  // Check liquor products
  for (const p of liquorProds) {
    const sales = productSalesMap.get(p.id)
    const unitsSold = sales?.unitsSold ?? 0
    const grossRevenue = sales?.grossRevenue ?? 0
    const lastDate = lastOrderMap.get(p.id)

    // Consider zero sales or low sales (<= 2 units)
    if (unitsSold <= 2) {
      const daysSince = lastDate
        ? Math.max(
            0,
            Math.floor((now.getTime() - lastDate.getTime()) / (86400 * 1000)),
          )
        : null

      slowMoversList.push({
        productId: p.id,
        name: p.name,
        catalogType: 'liquor',
        categoryName: liquorCatMap.get(p.categoryId) || 'Liquor',
        unitsSold,
        grossRevenue,
        lastOrderDate: lastDate ? lastDate.toISOString() : null,
        daysSinceLastOrder: daysSince,
        dealerCarryingCount: dealerCoverageMap.get(p.id) || 0,
        basePrice: productPriceMap.get(p.id) || 0,
        status: unitsSold === 0 ? 'zero_sales' : 'slow_mover',
      })
    }
  }

  // Check grocery products
  for (const p of groceryProds) {
    const sales = productSalesMap.get(p.id)
    const unitsSold = sales?.unitsSold ?? 0
    const grossRevenue = sales?.grossRevenue ?? 0
    const lastDate = lastOrderMap.get(p.id)

    if (unitsSold <= 2) {
      const daysSince = lastDate
        ? Math.max(
            0,
            Math.floor((now.getTime() - lastDate.getTime()) / (86400 * 1000)),
          )
        : null

      slowMoversList.push({
        productId: p.id,
        name: p.name,
        catalogType: 'grocery',
        categoryName: groceryCatMap.get(p.categoryId) || 'Grocery',
        unitsSold,
        grossRevenue,
        lastOrderDate: lastDate ? lastDate.toISOString() : null,
        daysSinceLastOrder: daysSince,
        dealerCarryingCount: dealerCoverageMap.get(p.id) || 0,
        basePrice: productPriceMap.get(p.id) || 0,
        status: unitsSold === 0 ? 'zero_sales' : 'slow_mover',
      })
    }
  }

  // Sort slow movers: zero sales first, then by days since last order descending
  slowMoversList.sort((a, b) => {
    if (a.unitsSold !== b.unitsSold) {
      return a.unitsSold - b.unitsSold
    }
    const daysA = a.daysSinceLastOrder ?? 999999
    const daysB = b.daysSinceLastOrder ?? 999999
    return daysB - daysA
  })

  // ==========================================
  // SECTION C: Most-Unavailable Items
  // ==========================================
  const itemUnavailMap = new Map<
    string,
    {
      productId: string
      name: string
      catalogType: 'liquor' | 'grocery'
      totalRequested: number
      unavailableCount: number
      fulfilledCount: number
      dealerIds: Set<string>
    }
  >()

  for (const item of itemRows) {
    const key = item.productId
    const existing = itemUnavailMap.get(key) || {
      productId: item.productId,
      name: item.name,
      catalogType: item.catalogType as 'liquor' | 'grocery',
      totalRequested: 0,
      unavailableCount: 0,
      fulfilledCount: 0,
      dealerIds: new Set<string>(),
    }

    existing.totalRequested += 1
    if (item.sourcingStatus === 'unavailable') {
      existing.unavailableCount += 1
      if (item.dealerId) existing.dealerIds.add(item.dealerId)
    } else if (
      item.sourcingStatus === 'picked_up' ||
      item.sourcingStatus === 'assigned'
    ) {
      existing.fulfilledCount += 1
    }
    itemUnavailMap.set(key, existing)
  }

  const mostUnavailable: MostUnavailableMetric[] = Array.from(
    itemUnavailMap.values(),
  )
    .filter((it) => it.unavailableCount > 0)
    .map((it) => {
      const affectedDealerNames = Array.from(it.dealerIds)
        .map((did) => dealersMap.get(did)?.name || 'Unknown Dealer')
        .slice(0, 3)

      const unavailabilityRatePercent = Math.round(
        (it.unavailableCount / Math.max(1, it.totalRequested)) * 100,
      )

      return {
        productId: it.productId,
        name: it.name,
        catalogType: it.catalogType,
        totalRequested: it.totalRequested,
        unavailableCount: it.unavailableCount,
        fulfilledCount: it.fulfilledCount,
        unavailabilityRatePercent,
        affectedDealerNames,
      }
    })
    .sort((a, b) => {
      if (b.unavailableCount !== a.unavailableCount) {
        return b.unavailableCount - a.unavailableCount
      }
      return b.unavailabilityRatePercent - a.unavailabilityRatePercent
    })

  // ==========================================
  // SECTION D: Dealer Substitution Rate
  // ==========================================
  const dealerStatsMap = new Map<
    string,
    {
      dealerId: string
      totalAssigned: number
      fulfilled: number
      substituted: number
    }
  >()

  for (const item of itemRows) {
    if (!item.dealerId) continue
    const existing = dealerStatsMap.get(item.dealerId) || {
      dealerId: item.dealerId,
      totalAssigned: 0,
      fulfilled: 0,
      substituted: 0,
    }

    existing.totalAssigned += 1
    if (item.sourcingStatus === 'unavailable') {
      existing.substituted += 1
    } else if (
      item.sourcingStatus === 'picked_up' ||
      item.sourcingStatus === 'assigned'
    ) {
      existing.fulfilled += 1
    }
    dealerStatsMap.set(item.dealerId, existing)
  }

  let totalAssignedDealerItems = 0
  let totalSubstitutedDealerItems = 0

  const dealerSubstitutionRates: DealerSubstitutionMetric[] = Array.from(
    dealersMap.values(),
  )
    .map((d) => {
      const stats = dealerStatsMap.get(d.id) || {
        dealerId: d.id,
        totalAssigned: 0,
        fulfilled: 0,
        substituted: 0,
      }

      totalAssignedDealerItems += stats.totalAssigned
      totalSubstitutedDealerItems += stats.substituted

      const substitutionRatePercent =
        stats.totalAssigned > 0
          ? Math.round((stats.substituted / stats.totalAssigned) * 100)
          : 0

      const fulfilmentRatePercent = 100 - substitutionRatePercent

      let severity: 'low' | 'moderate' | 'high' = 'low'
      if (substitutionRatePercent > 15) {
        severity = 'high'
      } else if (substitutionRatePercent > 5) {
        severity = 'moderate'
      }

      return {
        dealerId: d.id,
        dealerName: d.name,
        contact: d.contact,
        city: d.city,
        totalAssigned: stats.totalAssigned,
        fulfilled: stats.fulfilled,
        substituted: stats.substituted,
        substitutionRatePercent,
        fulfilmentRatePercent,
        severity,
      }
    })
    .sort((a, b) => b.totalAssigned - a.totalAssigned)

  const networkSubstitutionRatePercent =
    totalAssignedDealerItems > 0
      ? Math.round(
          (totalSubstitutedDealerItems / totalAssignedDealerItems) * 100,
        )
      : 0

  const totalRevenue = topProducts.reduce((sum, p) => sum + p.grossRevenue, 0)
  const totalUnitsSold = topProducts.reduce((sum, p) => sum + p.unitsSold, 0)
  const topProductByRevenue = topProducts[0]?.name || null
  const slowMoversCount = slowMoversList.filter(
    (s) => s.status === 'slow_mover',
  ).length
  const zeroSalesCount = slowMoversList.filter(
    (s) => s.status === 'zero_sales',
  ).length
  const mostUnavailableProduct = mostUnavailable[0]?.name || null

  return {
    periodDays: days,
    cutoffDate: cutoffDate ? cutoffDate.toISOString() : null,
    summary: {
      totalRevenue,
      totalUnitsSold,
      topProductByRevenue,
      slowMoversCount,
      zeroSalesCount,
      mostUnavailableProduct,
      networkSubstitutionRatePercent,
      totalAssignedDealerItems,
      totalSubstitutedDealerItems,
    },
    topProducts,
    slowMovers: slowMoversList,
    mostUnavailable,
    dealerSubstitutionRates,
  }
}
