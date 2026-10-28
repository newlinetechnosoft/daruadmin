import { db } from '#/db'
import {
  dealers,
  dealerItems,
  dealerPriceHistory,
  stockMovements,
  liquorProducts,
  groceryProducts,
  liquorCategories,
  groceryCategories,
  liquorBrands,
  groceryBrands,
  orderItems,
} from '#/db/schema'
import { desc, eq, and, isNotNull } from 'drizzle-orm'
import type {
  UpsertDealerInput,
  AssignDealerItemsInput,
  AssignItemDealersInput,
} from './inventory.schemas'

export interface AssignedItemDto {
  id: string
  catalogType: 'liquor' | 'grocery'
  productId: string
  productName: string
  categoryName?: string | null
  brandName?: string | null
  costPrice?: number
  isAvailable?: boolean
  effectiveFrom?: string
}

export interface DealerPerformance {
  totalAssignedItems: number
  fulfilledItems: number
  rejectedItems: number
  fulfilmentRatePercent: number
  avgPrepTimeMinutes: number
}

export interface DealerDto {
  id: string
  name: string
  contact: string
  whatsappNumber: string | null
  pan: string | null
  vatNumber?: string | null
  providesVatBill?: boolean
  tdsRate?: string
  creditLimit?: number
  paymentTermsDays?: number
  openingBalance?: number
  address: string
  city: string
  lat: number | null
  lng: number | null
  isActive: boolean
  assignedItems: AssignedItemDto[]
  assignedItemCount: number
  performance?: DealerPerformance
  createdAt: string
  updatedAt: string
}

export interface StockMovementDto {
  id: string
  catalogType: 'liquor' | 'grocery'
  variantId: string
  dealerId: string | null
  delta: number
  type: string
  refType: string | null
  refId: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export interface CatalogItemSummary {
  id: string
  catalogType: 'liquor' | 'grocery'
  name: string
  categoryName?: string | null
  brandName?: string | null
}

export async function getAllDealersQuery(): Promise<DealerDto[]> {
  const [dealerRows, itemRows, liquorList, groceryList, orderItemRows] =
    await Promise.all([
      db.select().from(dealers).orderBy(desc(dealers.createdAt)),
      db.select().from(dealerItems),
      db
        .select({
          id: liquorProducts.id,
          name: liquorProducts.name,
          categoryName: liquorCategories.name,
          brandName: liquorBrands.name,
        })
        .from(liquorProducts)
        .leftJoin(
          liquorCategories,
          eq(liquorProducts.categoryId, liquorCategories.id),
        )
        .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id)),
      db
        .select({
          id: groceryProducts.id,
          name: groceryProducts.name,
          categoryName: groceryCategories.name,
          brandName: groceryBrands.name,
        })
        .from(groceryProducts)
        .leftJoin(
          groceryCategories,
          eq(groceryProducts.categoryId, groceryCategories.id),
        )
        .leftJoin(groceryBrands, eq(groceryProducts.brandId, groceryBrands.id)),
      db
        .select({
          dealerId: orderItems.dealerId,
          sourcingStatus: orderItems.sourcingStatus,
        })
        .from(orderItems)
        .where(isNotNull(orderItems.dealerId)),
    ])

  // Map product metadata lookup
  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))
  const groceryMap = new Map(groceryList.map((p) => [p.id, p]))

  // Group items by dealerId
  const itemsByDealer = new Map<string, AssignedItemDto[]>()
  for (const item of itemRows) {
    const list = itemsByDealer.get(item.dealerId) || []
    let productName = 'Unknown Product'
    let categoryName: string | null = null
    let brandName: string | null = null

    if (item.catalogType === 'liquor') {
      const p = liquorMap.get(item.productId)
      if (p) {
        productName = p.name
        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null
      }
    } else {
      const p = groceryMap.get(item.productId)
      if (p) {
        productName = p.name
        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null
      }
    }

    list.push({
      id: item.id,
      catalogType: item.catalogType as 'liquor' | 'grocery',
      productId: item.productId,
      productName,
      categoryName,
      brandName,
      costPrice: item.costPrice,
      isAvailable: item.isAvailable !== false,
      effectiveFrom: item.effectiveFrom.toISOString(),
    })
    itemsByDealer.set(item.dealerId, list)
  }

  return dealerRows.map((d) => {
    const assigned = itemsByDealer.get(d.id) || []
    const dealerOrderItems = orderItemRows.filter((it) => it.dealerId === d.id)
    const totalAssigned = dealerOrderItems.length
    const rejectedCount = dealerOrderItems.filter(
      (it) => it.sourcingStatus === 'unavailable',
    ).length
    const fulfilledCount = dealerOrderItems.filter(
      (it) =>
        it.sourcingStatus === 'picked_up' || it.sourcingStatus === 'assigned',
    ).length
    const fulfilmentRatePercent =
      totalAssigned === 0
        ? 100
        : Math.round(
            (fulfilledCount / Math.max(1, fulfilledCount + rejectedCount)) * 100,
          )

    const performance: DealerPerformance = {
      totalAssignedItems: totalAssigned,
      fulfilledItems: fulfilledCount,
      rejectedItems: rejectedCount,
      fulfilmentRatePercent,
      avgPrepTimeMinutes: 15,
    }

    return {
      id: d.id,
      name: d.name,
      contact: d.contact,
      whatsappNumber: d.whatsappNumber ?? null,
      pan: d.pan,
      vatNumber: d.vatNumber ?? null,
      providesVatBill: d.providesVatBill,
      tdsRate: d.tdsRate,
      creditLimit: d.creditLimit,
      paymentTermsDays: d.paymentTermsDays,
      openingBalance: d.openingBalance,
      address: d.address,
      city: d.city,
      lat: d.lat ? Number(d.lat) : null,
      lng: d.lng ? Number(d.lng) : null,
      isActive: d.isActive,
      assignedItems: assigned,
      assignedItemCount: assigned.length,
      performance,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }
  })
}

export async function getDealerByIdQuery(
  id: string,
): Promise<DealerDto | null> {
  const [dealerRows, itemRows, liquorList, groceryList] = await Promise.all([
    db.select().from(dealers).where(eq(dealers.id, id)).limit(1),
    db.select().from(dealerItems).where(eq(dealerItems.dealerId, id)),
    db
      .select({
        id: liquorProducts.id,
        name: liquorProducts.name,
        categoryName: liquorCategories.name,
        brandName: liquorBrands.name,
      })
      .from(liquorProducts)
      .leftJoin(
        liquorCategories,
        eq(liquorProducts.categoryId, liquorCategories.id),
      )
      .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id)),
    db
      .select({
        id: groceryProducts.id,
        name: groceryProducts.name,
        categoryName: groceryCategories.name,
        brandName: groceryBrands.name,
      })
      .from(groceryProducts)
      .leftJoin(
        groceryCategories,
        eq(groceryProducts.categoryId, groceryCategories.id),
      )
      .leftJoin(groceryBrands, eq(groceryProducts.brandId, groceryBrands.id)),
  ])

  if (!dealerRows[0]) return null
  const d = dealerRows[0]

  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))
  const groceryMap = new Map(groceryList.map((p) => [p.id, p]))

  const assigned: AssignedItemDto[] = itemRows.map((item) => {
    let productName = 'Unknown Product'
    let categoryName: string | null = null
    let brandName: string | null = null

    if (item.catalogType === 'liquor') {
      const p = liquorMap.get(item.productId)
      if (p) {
        productName = p.name
        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null
      }
    } else {
      const p = groceryMap.get(item.productId)
      if (p) {
        productName = p.name
        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null
      }
    }

    return {
      id: item.id,
      catalogType: item.catalogType as 'liquor' | 'grocery',
      productId: item.productId,
      productName,
      categoryName,
      brandName,
      costPrice: item.costPrice,
      isAvailable: item.isAvailable !== false,
      effectiveFrom: item.effectiveFrom.toISOString(),
    }
  })

  return {
    id: d.id,
    name: d.name,
    contact: d.contact,
    whatsappNumber: d.whatsappNumber ?? null,
    pan: d.pan,
    vatNumber: d.vatNumber ?? null,
    providesVatBill: d.providesVatBill,
    tdsRate: d.tdsRate,
    creditLimit: d.creditLimit,
    paymentTermsDays: d.paymentTermsDays,
    openingBalance: d.openingBalance,
    address: d.address,
    city: d.city,
    lat: d.lat ? Number(d.lat) : null,
    lng: d.lng ? Number(d.lng) : null,
    isActive: d.isActive,
    assignedItems: assigned,
    assignedItemCount: assigned.length,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

export async function upsertDealerQuery(
  input: UpsertDealerInput,
): Promise<DealerDto> {
  const dealerId = input.id || crypto.randomUUID()

  const payload = {
    id: dealerId,
    name: input.name.trim(),
    contact: input.contact.trim(),
    whatsappNumber: input.whatsappNumber?.trim() || null,
    pan: input.pan?.trim() || null,
    vatNumber: input.vatNumber?.trim() || null,
    providesVatBill: input.providesVatBill,
    tdsRate: String(input.tdsRate),
    creditLimit: input.creditLimit,
    paymentTermsDays: input.paymentTermsDays,
    openingBalance: input.openingBalance,
    address: input.address.trim(),
    city: input.city.trim() || 'Kathmandu',
    lat:
      input.lat !== undefined && input.lat !== null ? String(input.lat) : null,
    lng:
      input.lng !== undefined && input.lng !== null ? String(input.lng) : null,
    isActive: input.isActive,
    updatedAt: new Date(),
  }

  await db
    .insert(dealers)
    .values(payload)
    .onConflictDoUpdate({
      target: dealers.id,
      set: {
        name: payload.name,
        contact: payload.contact,
        whatsappNumber: payload.whatsappNumber,
        pan: payload.pan,
        vatNumber: payload.vatNumber,
        providesVatBill: payload.providesVatBill,
        tdsRate: payload.tdsRate,
        creditLimit: payload.creditLimit,
        paymentTermsDays: payload.paymentTermsDays,
        openingBalance: payload.openingBalance,
        address: payload.address,
        city: payload.city,
        lat: payload.lat,
        lng: payload.lng,
        isActive: payload.isActive,
        updatedAt: payload.updatedAt,
      },
    })

  // Synchronize assigned items if explicitly provided
  if (input.assignedItems !== undefined) {
    await db.delete(dealerItems).where(eq(dealerItems.dealerId, dealerId))

    if (input.assignedItems.length > 0) {
      // Deduplicate items
      const seen = new Set<string>()
      const uniqueItems = input.assignedItems.filter((item) => {
        const key = `${item.catalogType}:${item.productId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      if (uniqueItems.length > 0) {
        await db.insert(dealerItems).values(
          uniqueItems.map((item) => ({
            id: crypto.randomUUID(),
            dealerId,
            catalogType: item.catalogType,
            productId: item.productId,
            costPrice: item.costPrice ?? 0,
            isAvailable: item.isAvailable ?? true,
          })),
        )

        // Record price history for priced items
        const priceHistoryRows = uniqueItems
          .filter((item) => item.costPrice !== undefined && item.costPrice > 0)
          .map((item) => ({
            id: crypto.randomUUID(),
            dealerId,
            catalogType: item.catalogType,
            productId: item.productId,
            costPrice: item.costPrice!,
            effectiveFrom: new Date(),
          }))

        if (priceHistoryRows.length > 0) {
          await db.insert(dealerPriceHistory).values(priceHistoryRows)
        }
      }
    }
  }

  const result = await getDealerByIdQuery(dealerId)
  if (!result) {
    throw new Error('Failed to retrieve upserted dealer')
  }
  return result
}

export async function deleteDealerQuery(
  id: string,
): Promise<{ success: boolean; id: string }> {
  await db.delete(dealerItems).where(eq(dealerItems.dealerId, id))
  await db.delete(dealers).where(eq(dealers.id, id))
  return { success: true, id }
}

export async function assignDealerItemsQuery(
  input: AssignDealerItemsInput,
): Promise<{ success: boolean; count: number }> {
  await db.delete(dealerItems).where(eq(dealerItems.dealerId, input.dealerId))

  if (input.items.length > 0) {
    const seen = new Set<string>()
    const unique = input.items.filter((item) => {
      const key = `${item.catalogType}:${item.productId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (unique.length > 0) {
      await db.insert(dealerItems).values(
        unique.map((item) => ({
          id: crypto.randomUUID(),
          dealerId: input.dealerId,
          catalogType: item.catalogType,
          productId: item.productId,
        })),
      )
    }
  }

  return { success: true, count: input.items.length }
}

export async function assignItemDealersQuery(
  input: AssignItemDealersInput,
): Promise<{ success: boolean; count: number }> {
  await db
    .delete(dealerItems)
    .where(
      and(
        eq(dealerItems.catalogType, input.catalogType),
        eq(dealerItems.productId, input.productId),
      ),
    )

  if (input.dealerIds.length > 0) {
    const uniqueDealers = Array.from(new Set(input.dealerIds))
    await db.insert(dealerItems).values(
      uniqueDealers.map((dealerId) => ({
        id: crypto.randomUUID(),
        dealerId,
        catalogType: input.catalogType,
        productId: input.productId,
      })),
    )
  }

  return { success: true, count: input.dealerIds.length }
}

export async function getDealersByItemQuery(
  catalogType: 'liquor' | 'grocery',
  productId: string,
): Promise<DealerDto[]> {
  const matches = await db
    .select({ dealerId: dealerItems.dealerId })
    .from(dealerItems)
    .where(
      and(
        eq(dealerItems.catalogType, catalogType),
        eq(dealerItems.productId, productId),
      ),
    )

  if (matches.length === 0) return []

  const dealerIds = matches.map((m) => m.dealerId)
  const all = await getAllDealersQuery()
  return all.filter((d) => dealerIds.includes(d.id))
}

export async function getAdminDealersWithCatalogQuery() {
  const [dealersList, liquorList, groceryList] = await Promise.all([
    getAllDealersQuery(),
    db
      .select({
        id: liquorProducts.id,
        name: liquorProducts.name,
        categoryName: liquorCategories.name,
        brandName: liquorBrands.name,
      })
      .from(liquorProducts)
      .leftJoin(
        liquorCategories,
        eq(liquorProducts.categoryId, liquorCategories.id),
      )
      .leftJoin(liquorBrands, eq(liquorProducts.brandId, liquorBrands.id))
      .where(eq(liquorProducts.isActive, true))
      .orderBy(liquorProducts.name),
    db
      .select({
        id: groceryProducts.id,
        name: groceryProducts.name,
        categoryName: groceryCategories.name,
        brandName: groceryBrands.name,
      })
      .from(groceryProducts)
      .leftJoin(
        groceryCategories,
        eq(groceryProducts.categoryId, groceryCategories.id),
      )
      .leftJoin(groceryBrands, eq(groceryProducts.brandId, groceryBrands.id))
      .where(eq(groceryProducts.isActive, true))
      .orderBy(groceryProducts.name),
  ])

  const catalogItems: CatalogItemSummary[] = [
    ...liquorList.map((l) => ({
      id: l.id,
      catalogType: 'liquor' as const,
      name: l.name,
      categoryName: l.categoryName ?? null,
      brandName: l.brandName ?? null,
    })),
    ...groceryList.map((g) => ({
      id: g.id,
      catalogType: 'grocery' as const,
      name: g.name,
      categoryName: g.categoryName ?? null,
      brandName: g.brandName ?? null,
    })),
  ]

  return {
    dealers: dealersList,
    catalogItems,
  }
}

export async function getRecentStockMovementsQuery(
  limit = 100,
): Promise<StockMovementDto[]> {
  const rows = await db
    .select()
    .from(stockMovements)
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit)

  return rows.map((m) => ({
    id: m.id,
    catalogType: m.catalogType as 'liquor' | 'grocery',
    variantId: m.variantId,
    dealerId: m.dealerId,
    delta: m.delta,
    type: m.type,
    refType: m.refType,
    refId: m.refId,
    notes: m.notes,
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
  }))
}
