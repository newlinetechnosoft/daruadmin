import { db } from '#/db'
import {
  orders,
  orderItems,
  orderStatusHistory,
  dealers,
  dealerItems,
} from '#/db/schema'
import { desc, eq, inArray, count } from 'drizzle-orm'
import type {
  Order,
  OrderItem,
  OrderItemDealerInfo,
  OrderEvent,
  OrderStatus,
} from '#/server/operations/types'

async function loadDealersContext() {
  const [allDealers, allDealerItems] = await Promise.all([
    db.select().from(dealers),
    db.select().from(dealerItems),
  ])

  const dealersMap = new Map<string, typeof dealers.$inferSelect>()
  for (const d of allDealers) {
    dealersMap.set(d.id, d)
  }

  const dealerItemsMap = new Map<string, string[]>()
  for (const di of allDealerItems) {
    const key = `${di.catalogType}:${di.productId}`
    const list = dealerItemsMap.get(key) ?? []
    list.push(di.dealerId)
    dealerItemsMap.set(key, list)
  }

  return { dealersMap, dealerItemsMap }
}

function mapOrderRecord(
  order: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[] = [],
  events: (typeof orderStatusHistory.$inferSelect)[] = [],
  dealersMap?: Map<string, typeof dealers.$inferSelect>,
  dealerItemsMap?: Map<string, string[]>,
): Order {
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
    lat: order.lat ? Number(order.lat) : null,
    lng: order.lng ? Number(order.lng) : null,
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
    items: items.map((i): OrderItem => {
      const assignedDealer =
        i.dealerId && dealersMap ? (dealersMap.get(i.dealerId) ?? null) : null
      const productKey = `${i.catalogType}:${i.productId}`
      const supplyingDealerIds = dealerItemsMap?.get(productKey) ?? []
      const availableDealers: OrderItemDealerInfo[] = dealersMap
        ? supplyingDealerIds
            .map((id) => dealersMap.get(id))
            .filter((d): d is typeof dealers.$inferSelect =>
              Boolean(d && d.isActive),
            )
            .map((d) => ({
              id: d.id,
              name: d.name,
              pan: d.pan,
              contact: d.contact,
              whatsappNumber: d.whatsappNumber,
              address: d.address,
              city: d.city,
              lat: d.lat ? Number(d.lat) : null,
              lng: d.lng ? Number(d.lng) : null,
            }))
        : []

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
        dealer: assignedDealer
          ? {
              id: assignedDealer.id,
              name: assignedDealer.name,
              pan: assignedDealer.pan,
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
      note: e.note,
      actor: e.actor,
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
  await db
    .update(orderItems)
    .set({ dealerId: dealerId || null })
    .where(eq(orderItems.id, orderItemId))
  return { success: true }
}

export async function assignOrderItemsDealersQuery(
  assignments: { orderItemId: string; dealerId: string | null }[],
): Promise<{ success: boolean }> {
  for (const a of assignments) {
    await db
      .update(orderItems)
      .set({ dealerId: a.dealerId || null })
      .where(eq(orderItems.id, a.orderItemId))
  }
  return { success: true }
}

export async function getOrdersCountQuery() {
  const res = await db.select({ total: count() }).from(orders)
  return res[0]?.total ?? 0
}
