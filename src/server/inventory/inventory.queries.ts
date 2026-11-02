import { moveToRecycleBin } from '#/server/recycle-bin/recycle-bin.queries'
import { db, dbTx, type DbTx } from '#/db'
import {
  dealers,
  dealerItems,
  dealerPriceHistory,
  stockMovements,
  liquorProducts,
  foodProducts,
  liquorCategories,
  foodCategories,
  liquorBrands,
  foodBrands,
  orderItems,
} from '#/db/schema'
import { desc, eq, and, isNotNull } from 'drizzle-orm'
import type {
  UpsertDealerInput,
  AssignDealerItemsInput,
  AssignItemDealersInput,
  UpdateDealerLocationInput,
} from './inventory.schemas'

export interface AssignedItemDto {
  id: string
  catalogType: 'liquor' | 'food'
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
  catalogType: 'liquor' | 'food'
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
  catalogType: 'liquor' | 'food'
  name: string
  categoryName?: string | null
  brandName?: string | null
}

export async function getAllDealersQuery(): Promise<DealerDto[]> {
  const [dealerRows, itemRows, liquorList, foodList, orderItemRows] =
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
          id: foodProducts.id,
          name: foodProducts.name,
          categoryName: foodCategories.name,
          brandName: foodBrands.name,
        })
        .from(foodProducts)
        .leftJoin(
          foodCategories,
          eq(foodProducts.categoryId, foodCategories.id),
        )
        .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id)),
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
  const foodMap = new Map(foodList.map((p) => [p.id, p]))

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
      const p = foodMap.get(item.productId)
      if (p) {
        productName = p.name
        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null
      }
    }

    list.push({
      id: item.id,
      catalogType: item.catalogType as 'liquor' | 'food',
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
            (fulfilledCount / Math.max(1, fulfilledCount + rejectedCount)) *
              100,
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
  tx?: DbTx,
): Promise<DealerDto | null> {
  const client = tx ?? db
  const [dealerRows, itemRows, liquorList, foodList] = await Promise.all([
    client.select().from(dealers).where(eq(dealers.id, id)).limit(1),
    client.select().from(dealerItems).where(eq(dealerItems.dealerId, id)),
    client
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
    client
      .select({
        id: foodProducts.id,
        name: foodProducts.name,
        categoryName: foodCategories.name,
        brandName: foodBrands.name,
      })
      .from(foodProducts)
      .leftJoin(
        foodCategories,
        eq(foodProducts.categoryId, foodCategories.id),
      )
      .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id)),
  ])

  if (!dealerRows[0]) return null
  const d = dealerRows[0]

  const liquorMap = new Map(liquorList.map((p) => [p.id, p]))
  const foodMap = new Map(foodList.map((p) => [p.id, p]))

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
      const p = foodMap.get(item.productId)
      if (p) {
        productName = p.name
        categoryName = p.categoryName ?? null
        brandName = p.brandName ?? null
      }
    }

    return {
      id: item.id,
      catalogType: item.catalogType as 'liquor' | 'food',
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
  externalTx?: DbTx,
): Promise<DealerDto> {
  const run = async (tx: DbTx) => {
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
      city: input.city.trim() || 'Butwal',
      lat:
        input.lat !== undefined && input.lat !== null
          ? String(input.lat)
          : null,
      lng:
        input.lng !== undefined && input.lng !== null
          ? String(input.lng)
          : null,
      isActive: input.isActive,
      updatedAt: new Date(),
    }

    await tx
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
      await tx.delete(dealerItems).where(eq(dealerItems.dealerId, dealerId))

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
          await tx.insert(dealerItems).values(
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
            .filter(
              (item) => item.costPrice !== undefined && item.costPrice > 0,
            )
            .map((item) => ({
              id: crypto.randomUUID(),
              dealerId,
              catalogType: item.catalogType,
              productId: item.productId,
              costPrice: item.costPrice!,
              effectiveFrom: new Date(),
            }))

          if (priceHistoryRows.length > 0) {
            await tx.insert(dealerPriceHistory).values(priceHistoryRows)
          }
        }
      }
    }

    const result = await getDealerByIdQuery(dealerId, tx)
    if (!result) {
      throw new Error('Failed to retrieve upserted dealer')
    }
    return result
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function deleteDealerQuery(
  id: string,
  externalTx?: DbTx,
): Promise<{ success: boolean; id: string }> {
  const run = async (tx: DbTx) => {
    const [dealer] = await tx
      .select()
      .from(dealers)
      .where(eq(dealers.id, id))
      .limit(1)

    if (dealer) {
      const dItems = await tx
        .select()
        .from(dealerItems)
        .where(eq(dealerItems.dealerId, id))

      await moveToRecycleBin(
        {
          entityType: 'dealer',
          entityId: dealer.id,
          name: dealer.name,
          description: dealer.contact,
          data: { dealer, dealerItems: dItems },
        },
        tx,
      )
    }

    await tx.delete(dealerItems).where(eq(dealerItems.dealerId, id))
    await tx.delete(dealers).where(eq(dealers.id, id))
    return { success: true, id }
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function assignDealerItemsQuery(
  input: AssignDealerItemsInput,
  externalTx?: DbTx,
): Promise<{ success: boolean; count: number }> {
  const run = async (tx: DbTx) => {
    await tx.delete(dealerItems).where(eq(dealerItems.dealerId, input.dealerId))

    if (input.items.length > 0) {
      const seen = new Set<string>()
      const unique = input.items.filter((item) => {
        const key = `${item.catalogType}:${item.productId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      if (unique.length > 0) {
        await tx.insert(dealerItems).values(
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

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function assignItemDealersQuery(
  input: AssignItemDealersInput,
  externalTx?: DbTx,
): Promise<{ success: boolean; count: number }> {
  const run = async (tx: DbTx) => {
    await tx
      .delete(dealerItems)
      .where(
        and(
          eq(dealerItems.catalogType, input.catalogType),
          eq(dealerItems.productId, input.productId),
        ),
      )

    if (input.dealerIds.length > 0) {
      const uniqueDealers = Array.from(new Set(input.dealerIds))
      await tx.insert(dealerItems).values(
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

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}

export async function getDealersByItemQuery(
  catalogType: 'liquor' | 'food',
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
  const [dealersList, liquorList, foodList] = await Promise.all([
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
        id: foodProducts.id,
        name: foodProducts.name,
        categoryName: foodCategories.name,
        brandName: foodBrands.name,
      })
      .from(foodProducts)
      .leftJoin(
        foodCategories,
        eq(foodProducts.categoryId, foodCategories.id),
      )
      .leftJoin(foodBrands, eq(foodProducts.brandId, foodBrands.id))
      .where(eq(foodProducts.isActive, true))
      .orderBy(foodProducts.name),
  ])

  const catalogItems: CatalogItemSummary[] = [
    ...liquorList.map((l) => ({
      id: l.id,
      catalogType: 'liquor' as const,
      name: l.name,
      categoryName: l.categoryName ?? null,
      brandName: l.brandName ?? null,
    })),
    ...foodList.map((g) => ({
      id: g.id,
      catalogType: 'food' as const,
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
    catalogType: m.catalogType as 'liquor' | 'food',
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

export async function updateDealerLocationQuery(
  input: UpdateDealerLocationInput,
): Promise<DealerDto> {
  const existing = await db
    .select({ id: dealers.id })
    .from(dealers)
    .where(eq(dealers.id, input.dealerId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('Dealer not found')
  }

  await db
    .update(dealers)
    .set({
      lat: String(input.lat),
      lng: String(input.lng),
      updatedAt: new Date(),
    })
    .where(eq(dealers.id, input.dealerId))

  const updated = await getDealerByIdQuery(input.dealerId)
  if (!updated) {
    throw new Error('Failed to retrieve updated dealer')
  }
  return updated
}
