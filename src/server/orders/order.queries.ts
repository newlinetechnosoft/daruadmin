import { db } from '#/db'
import {
  orders,
  orderItems,
  orderStatusHistory,
  dealers,
  dealerItems,
  riders,
} from '#/db/schema'
import { desc, eq, inArray, count, and, or } from 'drizzle-orm'
import type {
  Order,
  OrderItem,
  OrderItemDealerInfo,
  OrderEvent,
  OrderStatus,
} from '#/server/operations/types'
import {
  calculateHaversineDistanceKm,
  DEFAULT_MAP_CENTER,
  formatDistanceKm,
  getDealerWhatsAppConfirmationUrl,
} from '#/lib/geo'
import { getStoreSettingsQuery } from '#/server/platform/platform.queries'

interface DealerItemRecord {
  dealerId: string
  costPrice: number
  isAvailable: boolean
}

async function loadDealersContext() {
  const [allDealers, allDealerItems] = await Promise.all([
    db.select().from(dealers),
    db.select().from(dealerItems),
  ])

  const dealersMap = new Map<string, typeof dealers.$inferSelect>()
  for (const d of allDealers) {
    dealersMap.set(d.id, d)
  }

  const dealerItemsMap = new Map<string, DealerItemRecord[]>()
  for (const di of allDealerItems) {
    const key = `${di.catalogType}:${di.productId}`
    const list = dealerItemsMap.get(key) ?? []
    list.push({
      dealerId: di.dealerId,
      costPrice: di.costPrice,
      isAvailable: di.isAvailable !== false,
    })
    dealerItemsMap.set(key, list)
  }

  return { dealersMap, dealerItemsMap }
}

function mapOrderRecord(
  order: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[] = [],
  events: (typeof orderStatusHistory.$inferSelect)[] = [],
  dealersMap?: Map<string, typeof dealers.$inferSelect>,
  dealerItemsMap?: Map<string, DealerItemRecord[]>,
): Order {
  const orderLat = order.lat ? Number(order.lat) : null
  const orderLng = order.lng ? Number(order.lng) : null

  return {
    id: order.id,
    number: order.number,
    customerId: order.customerId ?? '',
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    address: order.address,
    city: order.city,
    landmark: order.landmark,
    lat: orderLat,
    lng: orderLng,
    status: order.status as OrderStatus,
    paymentMethod: order.paymentMethod as any,
    paymentStatus: order.paymentStatus as any,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
    riderId: order.riderId,
    trackingCode: order.trackingCode,
    notes: order.notes,
    couponCode: order.couponCode,
    idempotencyKey: order.idempotencyKey,
    isLegacy: order.isLegacy,
    deliveryOtp: order.deliveryOtp ?? null,
    deliveryProofPhotoUrl: order.deliveryProofPhotoUrl ?? null,
    cancellationReason: order.cancellationReason,
    deliveryFailureReason: order.deliveryFailureReason,
    items: items.map((i): OrderItem => {
      const assignedDealer =
        i.dealerId && dealersMap ? (dealersMap.get(i.dealerId) ?? null) : null
      const productKey = `${i.catalogType}:${i.productId}`
      const supplyingDealers = dealerItemsMap?.get(productKey) ?? []

      const availableDealers: OrderItemDealerInfo[] = []
      if (dealersMap) {
        for (const rec of supplyingDealers) {
          const d = dealersMap.get(rec.dealerId)
          if (!d || !d.isActive) continue
          const dLat = d.lat ? Number(d.lat) : null
          const dLng = d.lng ? Number(d.lng) : null
          const distanceKm =
            orderLat != null && orderLng != null && dLat != null && dLng != null
              ? calculateHaversineDistanceKm(orderLat, orderLng, dLat, dLng)
              : null

          availableDealers.push({
            id: d.id,
            name: d.name,
            pan: d.pan ?? null,
            vatNumber: d.vatNumber ?? null,
            providesVatBill: Boolean(d.providesVatBill),
            tdsRate: d.tdsRate,
            contact: d.contact,
            whatsappNumber: d.whatsappNumber ?? null,
            address: d.address,
            city: d.city,
            lat: dLat,
            lng: dLng,
            distanceKm,
            costPrice: rec.costPrice,
          })
        }
        availableDealers.sort(
          (a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999),
        )
      }

      return {
        id: i.id,
        catalogType: i.catalogType as 'liquor' | 'grocery',
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        variantName: i.variantName,
        sku: i.sku,
        qty: i.qty,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        dealerId: i.dealerId ?? null,
        dealerCostPrice: i.dealerCostPrice ?? null,
        actualDealerCostPrice: i.actualDealerCostPrice ?? null,
        dealerBillPhotoUrl: i.dealerBillPhotoUrl ?? null,
        sourcingStatus: (i.sourcingStatus as any) ?? 'pending',
        isSettled: i.isSettled,
        settlementId: i.settlementId ?? null,
        dealer: assignedDealer
          ? {
              id: assignedDealer.id,
              name: assignedDealer.name,
              pan: assignedDealer.pan,
              vatNumber: assignedDealer.vatNumber,
              providesVatBill: assignedDealer.providesVatBill,
              tdsRate: assignedDealer.tdsRate,
              contact: assignedDealer.contact,
              whatsappNumber: assignedDealer.whatsappNumber,
              address: assignedDealer.address,
              city: assignedDealer.city,
              lat: assignedDealer.lat ? Number(assignedDealer.lat) : null,
              lng: assignedDealer.lng ? Number(assignedDealer.lng) : null,
            }
          : null,
        availableDealers,
      }
    }),
    events: events.map((e): OrderEvent => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      status: e.status as OrderStatus,
      fromStatus: e.fromStatus as OrderStatus | null,
      toStatus: (e.toStatus ?? e.status) as OrderStatus,
      note: e.note,
      actor: e.actor,
      actorId: e.actorId,
      actorRole: e.actorRole,
      metadata: (e.metadata as Record<string, any> | null) ?? null,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}

export async function getAllOrdersQuery(): Promise<Order[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))

  if (orderRows.length === 0) return []

  const orderIds = orderRows.map((o) => o.id)

  const [{ dealersMap, dealerItemsMap }, itemRows, eventRows] =
    await Promise.all([
      loadDealersContext(),
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db
        .select()
        .from(orderStatusHistory)
        .where(inArray(orderStatusHistory.orderId, orderIds))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ])

  const itemsMap = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const list = itemsMap.get(item.orderId) ?? []
    list.push(item)
    itemsMap.set(item.orderId, list)
  }

  const eventsMap = new Map<string, typeof eventRows>()
  for (const ev of eventRows) {
    const list = eventsMap.get(ev.orderId) ?? []
    list.push(ev)
    eventsMap.set(ev.orderId, list)
  }

  return orderRows.map((o) =>
    mapOrderRecord(
      o,
      itemsMap.get(o.id) ?? [],
      eventsMap.get(o.id) ?? [],
      dealersMap,
      dealerItemsMap,
    ),
  )
}

export async function getOrderByIdQuery(id: string): Promise<Order | null> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)

  if (!orderRows[0]) return null

  const [{ dealersMap, dealerItemsMap }, itemRows, eventRows] =
    await Promise.all([
      loadDealersContext(),
      db.select().from(orderItems).where(eq(orderItems.orderId, id)),
      db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, id))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ])

  return mapOrderRecord(
    orderRows[0],
    itemRows,
    eventRows,
    dealersMap,
    dealerItemsMap,
  )
}

export async function getOrderByNumberQuery(
  number: string,
): Promise<Order | null> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.number, number))
    .limit(1)

  if (!orderRows[0]) return null

  const [{ dealersMap, dealerItemsMap }, itemRows, eventRows] =
    await Promise.all([
      loadDealersContext(),
      db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderRows[0].id)),
      db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderRows[0].id))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ])

  return mapOrderRecord(
    orderRows[0],
    itemRows,
    eventRows,
    dealersMap,
    dealerItemsMap,
  )
}

export async function getOrdersByRiderIdQuery(
  riderId: string,
): Promise<Order[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.riderId, riderId))
    .orderBy(desc(orders.createdAt))

  if (orderRows.length === 0) return []

  const orderIds = orderRows.map((o) => o.id)
  const [{ dealersMap, dealerItemsMap }, itemRows, eventRows] =
    await Promise.all([
      loadDealersContext(),
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db
        .select()
        .from(orderStatusHistory)
        .where(inArray(orderStatusHistory.orderId, orderIds))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ])

  const itemsMap = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const list = itemsMap.get(item.orderId) ?? []
    list.push(item)
    itemsMap.set(item.orderId, list)
  }

  const eventsMap = new Map<string, typeof eventRows>()
  for (const ev of eventRows) {
    const list = eventsMap.get(ev.orderId) ?? []
    list.push(ev)
    eventsMap.set(ev.orderId, list)
  }

  return orderRows.map((o) =>
    mapOrderRecord(
      o,
      itemsMap.get(o.id) ?? [],
      eventsMap.get(o.id) ?? [],
      dealersMap,
      dealerItemsMap,
    ),
  )
}

export async function assignOrderItemDealerQuery(
  orderItemId: string,
  dealerId: string | null,
): Promise<{ success: boolean }> {
  const itemRows = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1)

  if (!itemRows[0]) throw new Error('Order item not found')

  let snapshottedCost: number | null = null
  if (dealerId) {
    const dItem = await db
      .select({ costPrice: dealerItems.costPrice })
      .from(dealerItems)
      .where(
        and(
          eq(dealerItems.dealerId, dealerId),
          eq(dealerItems.productId, itemRows[0].productId),
        ),
      )
      .limit(1)

    snapshottedCost =
      dItem[0]?.costPrice && dItem[0].costPrice > 0
        ? dItem[0].costPrice
        : Math.round(itemRows[0].unitPrice * 0.85) // default wholesale benchmark
  }

  await db
    .update(orderItems)
    .set({
      dealerId: dealerId || null,
      dealerCostPrice: snapshottedCost,
      sourcingStatus: dealerId ? 'assigned' : 'pending',
    })
    .where(eq(orderItems.id, orderItemId))

  return { success: true }
}

export async function assignOrderItemsDealersQuery(
  assignments: { orderItemId: string; dealerId: string | null }[],
): Promise<{ success: boolean }> {
  for (const a of assignments) {
    await assignOrderItemDealerQuery(a.orderItemId, a.dealerId)
  }
  return { success: true }
}

export async function getOrdersCountQuery() {
  const res = await db.select({ total: count() }).from(orders)
  return res[0]?.total ?? 0
}

export async function getOrderByTrackingCodeQuery(
  code: string,
): Promise<Order | null> {
  const clean = code.trim()
  if (!clean) return null

  const orderRows = await db
    .select()
    .from(orders)
    .where(
      or(
        eq(orders.trackingCode, clean),
        eq(orders.number, clean),
        eq(orders.id, clean),
      ),
    )
    .limit(1)

  if (!orderRows[0]) return null

  const [{ dealersMap, dealerItemsMap }, itemRows, eventRows] =
    await Promise.all([
      loadDealersContext(),
      db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderRows[0].id)),
      db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderRows[0].id))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ])

  return mapOrderRecord(
    orderRows[0],
    itemRows,
    eventRows,
    dealersMap,
    dealerItemsMap,
  )
}

export async function getCustomerOrdersQuery(
  customerId: string,
): Promise<Order[]> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))

  if (orderRows.length === 0) return []

  const orderIds = orderRows.map((o) => o.id)
  const [{ dealersMap, dealerItemsMap }, itemRows, eventRows] =
    await Promise.all([
      loadDealersContext(),
      db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
      db
        .select()
        .from(orderStatusHistory)
        .where(inArray(orderStatusHistory.orderId, orderIds))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ])

  const itemsMap = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const list = itemsMap.get(item.orderId) ?? []
    list.push(item)
    itemsMap.set(item.orderId, list)
  }

  const eventsMap = new Map<string, typeof eventRows>()
  for (const ev of eventRows) {
    const list = eventsMap.get(ev.orderId) ?? []
    list.push(ev)
    eventsMap.set(ev.orderId, list)
  }

  return orderRows.map((o) =>
    mapOrderRecord(
      o,
      itemsMap.get(o.id) ?? [],
      eventsMap.get(o.id) ?? [],
      dealersMap,
      dealerItemsMap,
    ),
  )
}

export interface DealerSuggestion {
  dealerId: string
  dealerName: string
  contact: string
  whatsappNumber: string | null
  address: string
  city: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
  distanceFormatted: string
  costPrice: number
  providesVatBill: boolean
  isCurrentlyAssigned: boolean
  isAvailable: boolean
  whatsAppConfirmationUrl: string
}

export async function suggestDealersForItemQuery(orderItemId: string): Promise<{
  orderItem: { id: string; name: string; variantName: string; qty: number }
  orderNumber: string
  deliveryLocation: { address: string; city: string; lat: number; lng: number }
  suggestions: DealerSuggestion[]
}> {
  const itemRow = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1)

  if (!itemRow[0]) throw new Error('Order item not found')
  const item = itemRow[0]

  const orderRow = await db
    .select()
    .from(orders)
    .where(eq(orders.id, item.orderId))
    .limit(1)

  if (!orderRow[0]) throw new Error('Order not found')
  const order = orderRow[0]

  const orderLat = order.lat ? Number(order.lat) : DEFAULT_MAP_CENTER[0]
  const orderLng = order.lng ? Number(order.lng) : DEFAULT_MAP_CENTER[1]

  const [activeDealers, itemDealers] = await Promise.all([
    db.select().from(dealers).where(eq(dealers.isActive, true)),
    db
      .select()
      .from(dealerItems)
      .where(
        and(
          eq(dealerItems.catalogType, item.catalogType),
          eq(dealerItems.productId, item.productId),
          eq(dealerItems.isAvailable, true),
        ),
      ),
  ])

  const itemDealerMap = new Map<string, (typeof itemDealers)[0]>()
  for (const di of itemDealers) {
    itemDealerMap.set(di.dealerId, di)
  }

  const suggestions: DealerSuggestion[] = []

  for (const d of activeDealers) {
    const dItem = itemDealerMap.get(d.id)
    if (!dItem) continue

    const dLat = d.lat ? Number(d.lat) : null
    const dLng = d.lng ? Number(d.lng) : null
    const distanceKm =
      dLat != null && dLng != null
        ? calculateHaversineDistanceKm(orderLat, orderLng, dLat, dLng)
        : null

    const whatsAppConfirmationUrl = getDealerWhatsAppConfirmationUrl({
      dealerName: d.name,
      dealerPhone: d.whatsappNumber || d.contact,
      orderNumber: order.number,
      items: [
        {
          name: item.name,
          qty: item.qty,
          variantName: item.variantName,
        },
      ],
      pickupAddress: d.address,
    })

    suggestions.push({
      dealerId: d.id,
      dealerName: d.name,
      contact: d.contact,
      whatsappNumber: d.whatsappNumber ?? null,
      address: d.address,
      city: d.city,
      lat: dLat,
      lng: dLng,
      distanceKm,
      distanceFormatted: formatDistanceKm(distanceKm),
      costPrice: dItem.costPrice,
      providesVatBill: Boolean(d.providesVatBill),
      isCurrentlyAssigned: item.dealerId === d.id,
      isAvailable: dItem.isAvailable,
      whatsAppConfirmationUrl,
    })
  }

  suggestions.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0
    if (a.distanceKm == null) return 1
    if (b.distanceKm == null) return -1
    return a.distanceKm - b.distanceKm
  })

  return {
    orderItem: {
      id: item.id,
      name: item.name,
      variantName: item.variantName,
      qty: item.qty,
    },
    orderNumber: order.number,
    deliveryLocation: {
      address: order.address,
      city: order.city,
      lat: orderLat,
      lng: orderLng,
    },
    suggestions,
  }
}

export interface RiderSuggestion {
  id: string
  name: string
  phone: string
  vehicle: 'bike' | 'scooter' | 'car'
  status: 'offline' | 'available' | 'busy'
  available: boolean
  cashOnHand: number
  codLimit: number
  isCodBlocked: boolean
  activeDeliveriesCount: number
  distanceKm: number | null
  distanceFormatted: string
  score: number
  isRecommended: boolean
  recommendationReason: string
}

export async function suggestRidersForOrderQuery(orderId: string): Promise<{
  orderId: string
  orderNumber: string
  isCod: boolean
  orderTotal: number
  suggestions: RiderSuggestion[]
}> {
  const orderRow = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!orderRow[0]) throw new Error('Order not found')
  const order = orderRow[0]

  const settings = await getStoreSettingsQuery()
  const riderCodLimit = settings.riderCodLimit ?? 2000000 // default Rs. 20,000

  const [activeRiders, activeOrdersPerRider] = await Promise.all([
    db.select().from(riders),
    db
      .select({
        riderId: orders.riderId,
        count: count(),
      })
      .from(orders)
      .where(
        inArray(orders.status, [
          'rider_assigned',
          'picked_up',
          'out_for_delivery',
        ]),
      )
      .groupBy(orders.riderId),
  ])

  const activeOrdersMap = new Map<string, number>()
  for (const ao of activeOrdersPerRider) {
    if (ao.riderId) {
      activeOrdersMap.set(ao.riderId, Number(ao.count))
    }
  }

  const orderLat = order.lat ? Number(order.lat) : DEFAULT_MAP_CENTER[0]
  const orderLng = order.lng ? Number(order.lng) : DEFAULT_MAP_CENTER[1]

  const isCod = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid'

  const suggestions: RiderSuggestion[] = []

  for (const r of activeRiders) {
    const rLat = r.lat ? Number(r.lat) : null
    const rLng = r.lng ? Number(r.lng) : null
    const distanceKm =
      rLat != null && rLng != null
        ? calculateHaversineDistanceKm(orderLat, orderLng, rLat, rLng)
        : null

    const activeDeliveriesCount = activeOrdersMap.get(r.id) ?? 0
    const isCodBlocked = isCod && r.cashOnHand >= riderCodLimit

    let score = 100
    if (r.status === 'available') {
      score += 100
    } else if (r.status === 'busy') {
      score -= 50
    } else {
      score -= 100
    }

    if (distanceKm != null) {
      score -= Math.round(distanceKm * 5)
    }

    score -= activeDeliveriesCount * 25

    if (isCodBlocked) {
      score -= 1000
    }

    let reason = ''
    if (isCodBlocked) {
      reason = 'COD limit exceeded (Rs. 20,000 float unremitted)'
    } else if (r.status !== 'available') {
      reason = `Currently ${r.status} (${activeDeliveriesCount} active deliveries)`
    } else if (distanceKm != null) {
      reason = `${formatDistanceKm(distanceKm)} away with ${activeDeliveriesCount} active orders`
    } else {
      reason = `Available with ${activeDeliveriesCount} active orders`
    }

    suggestions.push({
      id: r.id,
      name: r.name,
      phone: r.phone,
      vehicle: r.vehicle as 'bike' | 'scooter' | 'car',
      status: r.status as 'offline' | 'available' | 'busy',
      available: r.available,
      cashOnHand: r.cashOnHand,
      codLimit: riderCodLimit,
      isCodBlocked,
      activeDeliveriesCount,
      distanceKm,
      distanceFormatted: formatDistanceKm(distanceKm),
      score,
      isRecommended: false,
      recommendationReason: reason,
    })
  }

  suggestions.sort((a, b) => b.score - a.score)

  const topCandidate = suggestions.find(
    (s) => !s.isCodBlocked && s.status === 'available',
  )
  if (topCandidate) {
    topCandidate.isRecommended = true
    topCandidate.recommendationReason = `⭐ Recommended: Optimal proximity (${topCandidate.distanceFormatted}) and lowest active workload (${topCandidate.activeDeliveriesCount} deliveries)`
  } else if (suggestions[0] && !suggestions[0].isCodBlocked) {
    suggestions[0].isRecommended = true
  }

  return {
    orderId: order.id,
    orderNumber: order.number,
    isCod,
    orderTotal: order.total,
    suggestions,
  }
}

export interface OrderItemMargin {
  orderItemId: string
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
  dealerCostPrice: number | null
  totalDealerCost: number
  grossProfit: number
  marginPercent: number
}

export interface OrderMarginSummary {
  orderId: string
  orderNumber: string
  subtotal: number
  discount: number
  netMerchandiseRevenue: number
  totalDealerCost: number
  grossProfit: number
  marginPercent: number
  items: OrderItemMargin[]
}

export function calculateOrderMargins(order: Order): OrderMarginSummary {
  let totalDealerCost = 0

  const items: OrderItemMargin[] = order.items.map((it) => {
    const unitCost = it.dealerCostPrice ?? null
    const itemCost = unitCost != null ? unitCost * it.qty : 0
    totalDealerCost += itemCost
    const profit = it.lineTotal - itemCost
    const marginPct =
      it.lineTotal > 0 ? Number(((profit / it.lineTotal) * 100).toFixed(1)) : 0

    return {
      orderItemId: it.id,
      name: it.name,
      qty: it.qty,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
      dealerCostPrice: unitCost,
      totalDealerCost: itemCost,
      grossProfit: profit,
      marginPercent: marginPct,
    }
  })

  const netMerchandiseRevenue = Math.max(0, order.subtotal - order.discount)
  const orderGrossProfit = netMerchandiseRevenue - totalDealerCost
  const orderMarginPct =
    netMerchandiseRevenue > 0
      ? Number(((orderGrossProfit / netMerchandiseRevenue) * 100).toFixed(1))
      : 0

  return {
    orderId: order.id,
    orderNumber: order.number,
    subtotal: order.subtotal,
    discount: order.discount,
    netMerchandiseRevenue,
    totalDealerCost,
    grossProfit: orderGrossProfit,
    marginPercent: orderMarginPct,
    items,
  }
}
