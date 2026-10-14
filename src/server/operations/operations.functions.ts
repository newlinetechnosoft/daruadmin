import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db, dbTx } from '#/db'
import {
  orders,
  orderItems,
  orderStatusHistory,
  riders,
  settlements,
  riderCashHandovers,
  ledgerEntries,
  payments,
  complaints,
  reviews,
  liquorVariants,
  groceryVariants,
  stockMovements,
  notifications,
  user,
} from '#/db/schema'
import { auth } from '#/lib/auth'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { and, count, eq, isNull, or } from 'drizzle-orm'
import {
  requirePermission,
  requireRole,
  logAudit,
  getSessionUser,
  getUserGrants,
  can,
} from '#/server/auth/permissions'
import {
  getAdminGroceryProductsQuery,
  getAdminLiquorProductsQuery,
  getAdminStatsQuery,
  getAdminUsersQuery,
} from '#/server/catalog/catalog.queries'
import {
  getAllOrdersQuery,
  getOrderByIdQuery,
} from '#/server/orders/order.queries'
import {
  getAllRidersQuery,
  getRiderByIdQuery,
  getRiderByUserIdQuery,
  getAllSettlementsQuery,
} from '#/server/riders/rider.queries'
import {
  getAllLedgerEntriesQuery,
  getAllPaymentsQuery,
} from '#/server/finance/finance.queries'
import {
  getAllNotificationsQuery,
  markAllNotificationsReadQuery,
  getAllAuditLogsQuery,
  getStoreSettingsQuery,
  saveStoreSettingsQuery,
  getAllUserPermissionsQuery,
  saveUserPermissionsQuery,
  resetUserPermissionsQuery,
  getAllCouponsQuery,
  upsertCouponQuery,
  deleteCouponQuery,
  getAllComplaintsQuery,
  updateComplaintStatusQuery,
  getAllBannersQuery,
  upsertBannerQuery,
  deleteBannerQuery,
  getAllCampaignsQuery,
  getAllReviewsQuery,
  updateReviewStatusQuery,
  getAllShippingZonesQuery,
  upsertShippingZoneQuery,
} from '#/server/platform/platform.queries'
import type { DateRangeKey, OpsState, ModuleKey } from './types'
import { ACTIONS, MODULES } from './types'

export { ACTIONS, MODULES }

function nid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function rangeBounds(range: DateRangeKey, from?: string, to?: string) {
  const end = to ? new Date(to) : new Date()
  end.setHours(23, 59, 59, 999)
  const start = from ? new Date(from) : new Date(end)
  if (!from) {
    if (range === '7d') start.setDate(end.getDate() - 6)
    else if (range === '30d') start.setDate(end.getDate() - 29)
    else if (range === '90d') start.setDate(end.getDate() - 89)
    else if (range === 'ytd') {
      start.setMonth(0, 1)
    }
    start.setHours(0, 0, 0, 0)
  }
  return { start, end }
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

// -------------------------------------------------------------
// ACCESS & CHROME FUNCTIONS
// -------------------------------------------------------------

export const getMyAccessFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      const user = await getSessionUser()
      const grants = await getUserGrants(user)
      return { authenticated: true, user, grants }
    } catch {
      return { authenticated: false, user: null, grants: null }
    }
  },
)

export const getAdminChromeFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionUser = await getSessionUser()
    const grants = await getUserGrants(sessionUser)

    const canOrders = can(grants, 'orders', 'view')
    const canRiders = can(grants, 'riders', 'view')
    const canAccounts = can(grants, 'accounts', 'view')
    const canCustomers = can(grants, 'customers', 'view')
    const canMarketing = can(grants, 'marketing', 'view')

    const [
      pendingOrdersRes,
      openComplaintsRes,
      activeRidersRes,
      pendingSettlementsRes,
      pendingReviewsRes,
      allNotifs,
    ] = await Promise.all([
      canOrders
        ? db
            .select({ count: count() })
            .from(orders)
            .where(eq(orders.status, 'pending'))
        : Promise.resolve([{ count: 0 }]),
      canCustomers
        ? db
            .select({ count: count() })
            .from(complaints)
            .where(eq(complaints.status, 'open'))
        : Promise.resolve([{ count: 0 }]),
      canRiders
        ? db
            .select({ count: count() })
            .from(riders)
            .leftJoin(user, eq(riders.userId, user.id))
            .where(
              and(
                or(isNull(riders.userId), eq(user.role, 'rider')),
                or(eq(riders.status, 'available'), eq(riders.status, 'busy')),
              ),
            )
        : Promise.resolve([{ count: 0 }]),
      canAccounts
        ? db
            .select({ count: count() })
            .from(settlements)
            .where(eq(settlements.status, 'draft'))
        : Promise.resolve([{ count: 0 }]),
      canMarketing
        ? db
            .select({ count: count() })
            .from(reviews)
            .where(eq(reviews.status, 'pending'))
        : Promise.resolve([{ count: 0 }]),
      getAllNotificationsQuery(),
    ])

    const badges = {
      pendingOrders: pendingOrdersRes[0]?.count ?? 0,
      openComplaints: openComplaintsRes[0]?.count ?? 0,
      activeRiders: activeRidersRes[0]?.count ?? 0,
      pendingSettlements: pendingSettlementsRes[0]?.count ?? 0,
      pendingReviews: pendingReviewsRes[0]?.count ?? 0,
    }

    const filteredNotifications = allNotifs.filter((n) => {
      if (n.type === 'order' && !canOrders) return false
      if (n.type === 'rider' && !canRiders) return false
      if (n.type === 'finance' && !canAccounts) return false
      return true
    })

    return {
      unread: filteredNotifications.filter((n) => !n.read).length,
      notifications: filteredNotifications.slice(0, 8),
      badges,
      user: sessionUser,
      grants,
    }
  },
)

export const getStaffSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      const user = await getSessionUser()
      const grants = await getUserGrants(user)
      const isStaff = user.role === 'admin' || user.role === 'manager'
      return {
        authenticated: true,
        isStaff,
        user,
        grants,
      }
    } catch {
      return {
        authenticated: false,
        isStaff: false,
        user: null,
        grants: {},
      }
    }
  },
)

export const markNotificationsFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireRole('admin', 'manager', 'rider')
    await markAllNotificationsReadQuery()
    return true
  },
)

export const globalSearchFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ q: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    const grants = await getUserGrants(user)

    const q = data.q.trim().toLowerCase()
    if (q.length < 2)
      return { products: [], orders: [], customers: [], riders: [] }

    const canProducts = can(grants, 'products', 'view')
    const canOrders = can(grants, 'orders', 'view')
    const canCustomers = can(grants, 'customers', 'view')
    const canRiders = can(grants, 'riders', 'view')

    const [liquor, grocery, users, orderList, riderList] = await Promise.all([
      canProducts ? getAdminLiquorProductsQuery() : Promise.resolve([]),
      canProducts ? getAdminGroceryProductsQuery() : Promise.resolve([]),
      canCustomers ? getAdminUsersQuery() : Promise.resolve([]),
      canOrders ? getAllOrdersQuery() : Promise.resolve([]),
      canRiders ? getAllRidersQuery() : Promise.resolve([]),
    ])

    const products = canProducts
      ? [...liquor, ...grocery]
          .filter((p) => p.name.toLowerCase().includes(q))
          .slice(0, 6)
          .map((p) => ({
            id: p.id,
            name: p.name,
            href: 'categoryName' in p ? '/admin/liquor' : '/admin/grocery',
          }))
      : []

    const matchingOrders = canOrders
      ? orderList
          .filter(
            (o) =>
              o.number.toLowerCase().includes(q) ||
              o.customerName.toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((o) => ({
            id: o.id,
            name: `${o.number} · ${o.customerName}`,
            href: `/admin/orders`,
          }))
      : []

    const matchingCustomers = canCustomers
      ? users
          .filter(
            (u) =>
              u.name.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((u) => ({
            id: u.id,
            name: u.name,
            href: '/admin/customers',
          }))
      : []

    const matchingRiders = canRiders
      ? riderList
          .filter(
            (r) => r.name.toLowerCase().includes(q) || r.phone.includes(q),
          )
          .slice(0, 4)
          .map((r) => ({ id: r.id, name: r.name, href: '/admin/riders' }))
      : []

    return {
      products,
      orders: matchingOrders,
      customers: matchingCustomers,
      riders: matchingRiders,
    }
  })

// -------------------------------------------------------------
// MODULE DATA LOADERS
// -------------------------------------------------------------

export const getDashboardFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        range: z.enum(['7d', '30d', '90d', 'ytd', 'custom']).default('30d'),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission('dashboard', 'view')
    const [
      stats,
      liquor,
      grocery,
      users,
      allOrders,
      riderList,
      auditList,
      notifs,
    ] = await Promise.all([
      getAdminStatsQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
      getAllOrdersQuery(),
      getAllRidersQuery(),
      getAllAuditLogsQuery(),
      getAllNotificationsQuery(),
    ])

    const { start, end } = rangeBounds(data.range, data.from, data.to)
    const inRangeOrders = allOrders.filter((o) =>
      inRange(o.createdAt, start, end),
    )
    const delivered = inRangeOrders.filter((o) => o.status === 'delivered')
    const revenue = delivered.reduce((s, o) => s + o.total, 0)
    const refunds = inRangeOrders
      .filter((o) => o.status === 'refunded' || o.status === 'returned')
      .reduce((s, o) => s + o.total, 0)
    const cogs = Math.round(revenue * 0.62)
    const profit = revenue - cogs - refunds

    const byDay = new Map<string, { sales: number; orders: number }>()
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10)
      byDay.set(key, { sales: 0, orders: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    for (const o of inRangeOrders) {
      const key = o.createdAt.slice(0, 10)
      const slot = byDay.get(key)
      if (!slot) continue
      slot.orders += 1
      if (o.status !== 'cancelled') slot.sales += o.total
    }

    const statusCounts: Record<string, number> = {}
    for (const o of inRangeOrders) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
    }

    const productSales = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >()
    for (const o of inRangeOrders) {
      if (o.status === 'cancelled') continue
      for (const item of o.items) {
        const cur = productSales.get(item.productId) ?? {
          name: item.name,
          qty: 0,
          revenue: 0,
        }
        cur.qty += item.qty
        cur.revenue += item.lineTotal
        productSales.set(item.productId, cur)
      }
    }

    const topProducts = [...productSales.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    const inventoryValue =
      liquor.reduce(
        (s, p) => s + p.variants.reduce((a, v) => a + v.price * v.stock, 0),
        0,
      ) +
      grocery.reduce(
        (s, p) => s + p.variants.reduce((a, v) => a + v.price * v.stock, 0),
        0,
      )

    const customers = users.filter(
      (u) => !u.role || u.role === 'customer' || u.role === 'user',
    )

    return {
      catalog: stats,
      inventoryValue,
      kpis: {
        sales: delivered.length,
        revenue,
        orders: inRangeOrders.length,
        profit,
        customers: customers.length,
        riders: riderList.length,
        inventory: stats.totalStockUnits,
        lowStock: stats.lowStockCount,
      },
      salesTrend: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
      orderStatus: Object.entries(statusCounts).map(([label, value]) => ({
        label,
        value,
      })),
      topProducts,
      recentOrders: [...allOrders].slice(0, 8),
      activities: [...auditList].slice(0, 8),
      ridersOnline: riderList.filter((r) => r.status !== 'offline').length,
      notifications: notifs,
    }
  })

export const getOrdersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('orders', 'view')
    const [orderList, riderList, users, liquor, grocery, settings] =
      await Promise.all([
        getAllOrdersQuery(),
        getAllRidersQuery(),
        getAdminUsersQuery(),
        getAdminLiquorProductsQuery(),
        getAdminGroceryProductsQuery(),
        getStoreSettingsQuery(),
      ])
    return {
      ops: {
        orders: orderList,
        riders: riderList,
        settings,
      },
      orders: orderList,
      riders: riderList,
      users,
      liquor,
      grocery,
      settings,
    }
  },
)

export const getLedgerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    const [ledger, settlementsList, riderList, settings, users] =
      await Promise.all([
        getAllLedgerEntriesQuery(),
        getAllSettlementsQuery(),
        getAllRidersQuery(),
        getStoreSettingsQuery(),
        getAdminUsersQuery(),
      ])
    return {
      ops: {
        ledger,
        settlements: settlementsList,
        riders: riderList,
        settings,
      },
      ledger,
      settlements: settlementsList,
      riders: riderList,
      settings,
      users,
    }
  },
)

export const getRidersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('riders', 'view')
    const [riderList, complaintsList, zonesList, users] = await Promise.all([
      getAllRidersQuery(),
      getAllComplaintsQuery(),
      getAllShippingZonesQuery(),
      getAdminUsersQuery(),
    ])
    return {
      ops: {
        riders: riderList,
        complaints: complaintsList,
        zones: zonesList,
      },
      riders: riderList,
      complaints: complaintsList,
      zones: zonesList,
      users,
    }
  },
)

export const getPaymentsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('payments', 'view')
    const [paymentsList, settings] = await Promise.all([
      getAllPaymentsQuery(),
      getStoreSettingsQuery(),
    ])
    return {
      ops: {
        payments: paymentsList,
        settings,
      },
      payments: paymentsList,
      settings,
    }
  },
)

export const getShippingFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('shipping', 'view')
    const [zonesList, orderList] = await Promise.all([
      getAllShippingZonesQuery(),
      getAllOrdersQuery(),
    ])
    return {
      ops: {
        zones: zonesList,
        orders: orderList,
      },
      zones: zonesList,
      orders: orderList,
    }
  },
)

export const getMarketingFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('marketing', 'view')
    const [couponsList, bannersList, campaignsList, reviewsList] =
      await Promise.all([
        getAllCouponsQuery(),
        getAllBannersQuery(),
        getAllCampaignsQuery(),
        getAllReviewsQuery(),
      ])
    return {
      ops: {
        coupons: couponsList,
        banners: bannersList,
        campaigns: campaignsList,
        reviews: reviewsList,
      },
      coupons: couponsList,
      banners: bannersList,
      campaigns: campaignsList,
      reviews: reviewsList,
    }
  },
)

export const getAuditFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('staff', 'view')
    const [auditList, users] = await Promise.all([
      getAllAuditLogsQuery(),
      getAdminUsersQuery(),
    ])
    return {
      ops: {
        audit: auditList,
      },
      audit: auditList,
      users,
    }
  },
)

export const getSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('settings', 'view')
    const [settings, orderList, riderList, ledgerList] = await Promise.all([
      getStoreSettingsQuery(),
      getAllOrdersQuery(),
      getAllRidersQuery(),
      getAllLedgerEntriesQuery(),
    ])
    return {
      ops: {
        settings,
        orders: orderList,
        riders: riderList,
        ledger: ledgerList,
      },
      settings,
      liquor: [] as any[],
      grocery: [] as any[],
    }
  },
)

export const getCustomersOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('customers', 'view')
    const [users, complaintsList, orderList] = await Promise.all([
      getAdminUsersQuery(),
      getAllComplaintsQuery(),
      getAllOrdersQuery(),
    ])
    return {
      ops: {
        complaints: complaintsList,
        orders: orderList,
      },
      users,
      complaints: complaintsList,
      orders: orderList,
    }
  },
)

export const getInventoryOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('inventory', 'view')
    const [liquor, grocery, orderList, settings] = await Promise.all([
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAllOrdersQuery(),
      getStoreSettingsQuery(),
    ])
    return {
      ops: {
        orders: orderList,
        settings,
      },
      liquor,
      grocery,
    }
  },
)

export const getStaffOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { user: actor } = await requirePermission('staff', 'view')
    const [users, permissionsMap, auditList] = await Promise.all([
      getAdminUsersQuery(),
      getAllUserPermissionsQuery(),
      getAllAuditLogsQuery(),
    ])
    return {
      ops: {
        permissions: permissionsMap,
        audit: auditList,
      },
      users,
      currentUserId: actor.id,
    }
  },
)

export const getReportsOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('reports', 'view')
    const [orderList, ledgerList, paymentsList, riderList, settings, stats] =
      await Promise.all([
        getAllOrdersQuery(),
        getAllLedgerEntriesQuery(),
        getAllPaymentsQuery(),
        getAllRidersQuery(),
        getStoreSettingsQuery(),
        getAdminStatsQuery(),
      ])
    return {
      ops: {
        orders: orderList,
        ledger: ledgerList,
        payments: paymentsList,
        riders: riderList,
        settings,
      },
      orders: orderList,
      ledger: ledgerList,
      payments: paymentsList,
      liquor: [] as any[],
      grocery: [] as any[],
      stats,
    }
  },
)

export const getOpsBundleFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireRole('admin', 'manager')
    const [
      ordersList,
      ridersList,
      complaintsList,
      ledgerList,
      settlementsList,
      paymentsList,
      couponsList,
      bannersList,
      campaignsList,
      reviewsList,
      zonesList,
      notifs,
      auditList,
      permissionsMap,
      settings,
      users,
      liquor,
      grocery,
    ] = await Promise.all([
      getAllOrdersQuery(),
      getAllRidersQuery(),
      getAllComplaintsQuery(),
      getAllLedgerEntriesQuery(),
      getAllSettlementsQuery(),
      getAllPaymentsQuery(),
      getAllCouponsQuery(),
      getAllBannersQuery(),
      getAllCampaignsQuery(),
      getAllReviewsQuery(),
      getAllShippingZonesQuery(),
      getAllNotificationsQuery(),
      getAllAuditLogsQuery(),
      getAllUserPermissionsQuery(),
      getStoreSettingsQuery(),
      getAdminUsersQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
    ])

    const ops: OpsState = {
      orders: ordersList,
      riders: ridersList,
      complaints: complaintsList,
      ledger: ledgerList,
      settlements: settlementsList,
      payments: paymentsList,
      coupons: couponsList,
      banners: bannersList,
      campaigns: campaignsList,
      reviews: reviewsList,
      zones: zonesList,
      notifications: notifs,
      audit: auditList,
      permissions: permissionsMap,
      settings,
    }

    return { ops, users, liquor, grocery }
  },
)

// -------------------------------------------------------------
// OPERATIONS MUTATIONS WITH REAL POSTGRESQL TABLES
// -------------------------------------------------------------

export const updateOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.string().optional(),
        riderId: z.string().nullable().optional(),
        paymentStatus: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.id)
    if (!order) throw new Error('Order not found')

    await dbTx.transaction(async (tx) => {
      const updates: Record<string, any> = { updatedAt: new Date() }
      if (data.status) updates.status = data.status
      if (data.riderId !== undefined) updates.riderId = data.riderId
      if (data.paymentStatus) updates.paymentStatus = data.paymentStatus
      if (data.notes !== undefined) updates.notes = data.notes

      await tx.update(orders).set(updates).where(eq(orders.id, data.id))

      if (data.status && data.status !== order.status) {
        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),
          orderId: data.id,
          status: data.status,
          note: `Status updated to ${data.status.replaceAll('_', ' ')}`,
          actor: user.name,
        })
      }

      if (data.riderId && data.riderId !== order.riderId) {
        const assignedRider = await getRiderByIdQuery(data.riderId)
        if (assignedRider?.userId) {
          const mapUrl = getGoogleMapsUrl(order)
          await tx.insert(notifications).values({
            id: nid('notif'),
            title: `New Delivery Assigned: ${order.number}`,
            body: `Deliver to ${order.customerName} at ${order.address}. Map: ${mapUrl}`,
            type: 'rider',
            read: false,
            href: `/rider/deliveries`,
            userId: assignedRider.userId,
          })
        }
      }
    })

    await logAudit(
      user.name,
      'orders',
      'edit',
      `Updated order ${order.number}: ${JSON.stringify(data)}`,
    )

    return true
  })

export const createOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        customerName: z.string().min(2),
        customerPhone: z.string().min(6),
        customerEmail: z.string().email().optional(),
        address: z.string().min(3),
        city: z.string().default('Kathmandu'),
        paymentMethod: z
          .enum(['cod', 'esewa', 'khalti', 'fonepay', 'connectips'])
          .default('cod'),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              catalogType: z.enum(['liquor', 'grocery']),
              productId: z.string(),
              variantId: z.string(),
              name: z.string(),
              variantName: z.string(),
              sku: z.string(),
              qty: z.number().int().positive(),
              unitPrice: z.number().int().nonnegative(),
            }),
          )
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('orders', 'create')
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0,
    )
    const deliveryCharge = subtotal > 300000 ? 0 : 15000
    const total = subtotal + deliveryCharge

    const settings = await getStoreSettingsQuery()
    const orderCountRes = await db.select({ count: count() }).from(orders)
    const orderSeq = (orderCountRes[0]?.count ?? 0) + 1
    const orderNumber = `${settings.invoicePrefix}-${String(10000 + orderSeq).padStart(5, '0')}`

    const orderId = nid('ord')
    const trackingCode = `TRK${Math.floor(100000 + Math.random() * 900000)}`
    const now = new Date()

    await dbTx.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        number: orderNumber,
        customerName: data.customerName,
        customerEmail: data.customerEmail || 'walkin@mezmani.com.np',
        customerPhone: data.customerPhone,
        address: data.address,
        city: data.city,
        status: 'confirmed',
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentMethod === 'cod' ? 'cod_pending' : 'paid',
        subtotal,
        deliveryCharge,
        discount: 0,
        tax: 0,
        total,
        trackingCode,
        notes: data.notes || '',
      })

      for (const item of data.items) {
        await tx.insert(orderItems).values({
          id: nid('oi'),
          orderId,
          catalogType: item.catalogType,
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          variantName: item.variantName,
          sku: item.sku,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.qty,
        })

        if (item.catalogType === 'liquor') {
          const v = await tx
            .select({ stock: liquorVariants.stock })
            .from(liquorVariants)
            .where(eq(liquorVariants.id, item.variantId))
            .limit(1)
          if (v[0]) {
            await tx
              .update(liquorVariants)
              .set({ stock: Math.max(0, v[0].stock - item.qty) })
              .where(eq(liquorVariants.id, item.variantId))
          }
        } else {
          const v = await tx
            .select({ stock: groceryVariants.stock })
            .from(groceryVariants)
            .where(eq(groceryVariants.id, item.variantId))
            .limit(1)
          if (v[0]) {
            await tx
              .update(groceryVariants)
              .set({ stock: Math.max(0, v[0].stock - item.qty) })
              .where(eq(groceryVariants.id, item.variantId))
          }
        }

        await tx.insert(stockMovements).values({
          id: nid('sm'),
          catalogType: item.catalogType,
          variantId: item.variantId,
          delta: -item.qty,
          type: 'sale',
          refType: 'order',
          refId: orderId,
          createdBy: actor.id,
        })
      }

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId,
        status: 'confirmed',
        note: `Order manually created by ${actor.name}`,
        actor: actor.name,
      })

      await tx.insert(ledgerEntries).values({
        id: nid('led'),
        date: now.toISOString().slice(0, 10),
        type: 'credit',
        category: 'sales',
        account: 'Sales revenue',
        memo: `Sale ${orderNumber} (${data.customerName})`,
        amount: total,
        refType: 'order',
        refId: orderId,
      })
    })

    await logAudit(
      actor.name,
      'orders',
      'create',
      `Manual order created: ${orderNumber} (Rs. ${(total / 100).toFixed(2)})`,
    )

    return { orderId, orderNumber }
  })

export const upsertRiderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().min(6),
        vehicle: z.enum(['bike', 'scooter', 'car']).default('bike'),
        licenseNo: z.string().min(3),
        zone: z.string().default('Kathmandu Core'),
        commissionRate: z.number().min(0).max(100).default(10),
        available: z.boolean().default(true),
        status: z.enum(['offline', 'available', 'busy']).default('available'),
        verified: z.boolean().default(true),
        password: z.string().min(8).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission(
      'riders',
      data.id ? 'edit' : 'create',
    )
    const riderId = data.id || nid('rid')
    const normalizedEmail = data.email.trim().toLowerCase()
    let assignedUserId: string | null = null

    if (!data.id) {
      const existingUsers = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.email, normalizedEmail))
        .limit(1)

      if (existingUsers[0]) {
        if (
          existingUsers[0].role === 'admin' ||
          existingUsers[0].role === 'manager'
        ) {
          throw new Error(
            `A staff account with role ${existingUsers[0].role} cannot be converted to a rider.`,
          )
        }
        assignedUserId = existingUsers[0].id
        await db
          .update(user)
          .set({ role: 'rider' })
          .where(eq(user.id, assignedUserId))
      } else if (data.password) {
        const created = await auth.api.createUser({
          body: {
            name: data.name.trim(),
            email: normalizedEmail,
            password: data.password,
            role: 'rider' as any,
            data: {
              phone: data.phone.trim(),
              isActive: true,
            },
          },
        })
        assignedUserId = created?.user?.id ?? null
      }
    }

    await db
      .insert(riders)
      .values({
        id: riderId,
        userId: assignedUserId,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        vehicle: data.vehicle,
        licenseNo: data.licenseNo,
        zone: data.zone,
        commissionRate: data.commissionRate,
        available: data.available,
        status: data.status,
        verified: data.verified,
      })
      .onConflictDoUpdate({
        target: riders.id,
        set: {
          name: data.name,
          email: normalizedEmail,
          phone: data.phone,
          vehicle: data.vehicle,
          licenseNo: data.licenseNo,
          zone: data.zone,
          commissionRate: data.commissionRate,
          available: data.available,
          status: data.status,
          verified: data.verified,
          ...(assignedUserId ? { userId: assignedUserId } : {}),
          updatedAt: new Date(),
        },
      })

    await logAudit(
      actor.name,
      'riders',
      data.id ? 'edit' : 'create',
      `${data.id ? 'Updated' : 'Added'} rider: ${data.name}`,
    )

    return true
  })

export const createStaffUserFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        phone: z.string().min(6, 'Mobile number must be at least 6 digits'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        role: z.enum(['admin', 'manager', 'rider']),
        // Rider specific fields:
        vehicle: z.enum(['bike', 'scooter', 'car']).optional().default('bike'),
        licenseNo: z.string().optional().default(''),
        zone: z.string().optional().default('Kathmandu Core'),
        commissionRate: z.number().min(0).max(100).optional().default(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requireRole('admin')

    const normalizedEmail = data.email.trim().toLowerCase()

    // 1. Check if user already exists
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1)

    if (existing.length > 0) {
      throw new Error(`An account with email ${normalizedEmail} already exists`)
    }

    // 2. Create the user in Better Auth
    const created = await auth.api.createUser({
      body: {
        name: data.name.trim(),
        email: normalizedEmail,
        password: data.password,
        role: data.role as any,
        data: {
          phone: data.phone.trim(),
          isActive: true,
        },
      },
    })

    const newUserId = created?.user?.id
    if (!newUserId) {
      throw new Error('Failed to create staff account')
    }

    // 3. If role is 'rider', also create rider profile
    if (data.role === 'rider') {
      const riderId = nid('rid')
      await db.insert(riders).values({
        id: riderId,
        userId: newUserId,
        name: data.name.trim(),
        email: normalizedEmail,
        phone: data.phone.trim(),
        vehicle: data.vehicle || 'bike',
        licenseNo: data.licenseNo || 'BA-2-PA-1001',
        zone: data.zone || 'Kathmandu Core',
        commissionRate: data.commissionRate ?? 10,
        available: true,
        status: 'available',
        verified: true,
        lat: '27.7172',
        lng: '85.3240',
        cashOnHand: 0,
        earnings: 0,
        deliveries: 0,
        rating: '5.00',
      })
    }

    // 4. Audit log
    await logAudit(
      actor.name,
      'staff',
      'create',
      `Created ${data.role} account for ${normalizedEmail} (${data.name.trim()})`,
    )

    return { success: true, userId: newUserId }
  })


export const updateRiderLiveFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        riderId: z.string(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        status: z.enum(['offline', 'available', 'busy']).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requireRole('admin', 'manager', 'rider')
    if (actor.role === 'rider') {
      const rider = await getRiderByUserIdQuery(actor.id)
      if (!rider || rider.id !== data.riderId) {
        throw new Error(
          'Forbidden: You can only update your own location and status',
        )
      }
    }
    const updates: Record<string, any> = { updatedAt: new Date() }
    if (data.lat !== undefined) updates.lat = String(data.lat)
    if (data.lng !== undefined) updates.lng = String(data.lng)
    if (data.status !== undefined) updates.status = data.status

    await db.update(riders).set(updates).where(eq(riders.id, data.riderId))
    return true
  })

export const addLedgerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        type: z.enum(['debit', 'credit']),
        category: z.enum([
          'sales',
          'purchase',
          'expense',
          'refund',
          'cod',
          'settlement',
          'tax',
          'delivery',
          'other',
        ]),
        account: z.string().min(2),
        memo: z.string().min(2),
        amount: z.number().int().positive(),
        refType: z
          .enum(['order', 'settlement', 'manual', 'refund'])
          .default('manual'),
        refId: z.string().nullable().optional(),
        date: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')
    const date = data.date || new Date().toISOString().slice(0, 10)

    await db.insert(ledgerEntries).values({
      id: nid('led'),
      date,
      type: data.type,
      category: data.category,
      account: data.account,
      memo: data.memo,
      amount: data.amount,
      refType: data.refType,
      refId: data.refId || null,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Manual ledger: ${data.type.toUpperCase()} Rs. ${(data.amount / 100).toFixed(2)} - ${data.memo}`,
    )

    return true
  })

export const upsertCouponFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        code: z.string().min(2),
        type: z.enum(['percent', 'fixed']),
        value: z.number().positive(),
        minOrder: z.number().nonnegative().default(0),
        usageLimit: z.number().int().positive().default(100),
        active: z.boolean().default(true),
        expiresAt: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission(
      'marketing',
      data.id ? 'edit' : 'create',
    )
    await upsertCouponQuery({
      id: data.id || nid('cp'),
      code: data.code,
      type: data.type,
      value: data.value,
      minOrder: data.minOrder,
      usageLimit: data.usageLimit,
      used: 0,
      active: data.active,
      expiresAt: data.expiresAt,
    })

    await logAudit(
      user.name,
      'marketing',
      data.id ? 'edit' : 'create',
      `${data.id ? 'Updated' : 'Created'} coupon ${data.code}`,
    )

    return true
  })

export const deleteCouponFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('marketing', 'delete')
    await deleteCouponQuery(data.id)
    await logAudit(
      user.name,
      'marketing',
      'delete',
      `Deleted coupon ${data.id}`,
    )
    return true
  })

export const upsertZoneFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2),
        areas: z.string().min(2),
        deliveryCharge: z.number().nonnegative(),
        etaMinutes: z.number().int().positive().default(45),
        active: z.boolean().default(true),
        courier: z
          .enum(['in-house', 'ncm', 'pathao', 'none'])
          .default('in-house'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission(
      'shipping',
      data.id ? 'edit' : 'create',
    )
    await upsertShippingZoneQuery({
      id: data.id || nid('zone'),
      name: data.name,
      areas: data.areas,
      deliveryCharge: data.deliveryCharge,
      etaMinutes: data.etaMinutes,
      active: data.active,
      courier: data.courier,
    })

    await logAudit(
      user.name,
      'shipping',
      data.id ? 'edit' : 'create',
      `${data.id ? 'Updated' : 'Created'} zone ${data.name}`,
    )

    return true
  })

export const saveSettingsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        storeName: z.string().min(2).optional(),
        legalName: z.string().min(2).optional(),
        pan: z.string().optional(),
        vat: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        invoicePrefix: z.string().optional(),
        taxRate: z.number().min(0).max(100).optional(),
        lowStockThreshold: z.number().int().min(0).optional(),
        ageGate: z.boolean().optional(),
        notifyEmail: z.boolean().optional(),
        notifySms: z.boolean().optional(),
        gateways: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('settings', 'edit')
    await saveStoreSettingsQuery(data)
    await logAudit(user.name, 'settings', 'edit', 'Updated store configuration')
    return true
  })

export const savePermissionsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        userId: z.string(),
        permissions: z.record(
          z.enum(MODULES),
          z.array(
            z.enum(['view', 'create', 'edit', 'delete', 'export', 'approve']),
          ),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('staff', 'edit')

    // Guard 1: Non-admins cannot edit their own permissions
    if (actor.role !== 'admin' && actor.id === data.userId) {
      throw new Error('Forbidden: You cannot modify your own permissions')
    }

    const allUsers = await getAdminUsersQuery()
    const targetUser = allUsers.find((u) => u.id === data.userId)
    if (!targetUser) {
      throw new Error('User not found')
    }

    // Guard 2: Non-admins cannot edit admin accounts
    if (targetUser.role === 'admin' && actor.role !== 'admin') {
      throw new Error('Forbidden: You cannot modify administrator permissions')
    }

    // Guard 3: Non-admins cannot grant actions they do not hold themselves
    if (actor.role !== 'admin') {
      const actorGrants = await getUserGrants(actor)
      for (const [mod, acts] of Object.entries(data.permissions)) {
        for (const act of acts) {
          if (!can(actorGrants, mod as ModuleKey, act)) {
            throw new Error(
              `Forbidden: You cannot grant privilege ${mod}.${act} which you do not possess`,
            )
          }
        }
      }
    }

    const permissionsToSave = { ...data.permissions }
    if (!permissionsToSave.products) {
      permissionsToSave.products = Array.from(
        new Set([
          ...(permissionsToSave.liquor || []),
          ...(permissionsToSave.grocery || []),
          ...(permissionsToSave.categories || []),
          ...(permissionsToSave.inventory || []),
        ]),
      )
    }

    await saveUserPermissionsQuery(data.userId, permissionsToSave)
    await logAudit(
      actor.name,
      'staff',
      'edit',
      `Updated custom permissions for user ${targetUser.name || data.userId}`,
    )
    return true
  })

export const resetPermissionsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        userId: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('staff', 'edit')

    if (actor.role !== 'admin' && actor.id === data.userId) {
      throw new Error('Forbidden: You cannot reset your own permissions')
    }

    const allUsers = await getAdminUsersQuery()
    const targetUser = allUsers.find((u) => u.id === data.userId)
    if (!targetUser) throw new Error('User not found')

    if (targetUser.role === 'admin' && actor.role !== 'admin') {
      throw new Error('Forbidden: You cannot modify administrator permissions')
    }

    await resetUserPermissionsQuery(data.userId)
    await logAudit(
      actor.name,
      'staff',
      'edit',
      `Reset custom permissions to role defaults for user ${targetUser.name || data.userId}`,
    )
    return true
  })

export const updateReviewFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.enum(['pending', 'published', 'hidden']),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('marketing', 'edit')
    await updateReviewStatusQuery(data.id, data.status)
    await logAudit(
      user.name,
      'marketing',
      'edit',
      `Review ${data.id} -> ${data.status}`,
    )
    return true
  })

export const updateComplaintFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.enum(['open', 'in_progress', 'resolved']),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('customers', 'edit')
    await updateComplaintStatusQuery(data.id, data.status)
    await logAudit(
      user.name,
      'customers',
      'edit',
      `Complaint ${data.id} -> ${data.status}`,
    )
    return true
  })

export const approveSettlementFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    const row = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, data.id))
      .limit(1)

    if (!row[0]) throw new Error('Settlement not found')

    await dbTx.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({ status: 'approved' })
        .where(eq(settlements.id, data.id))

      await tx.insert(ledgerEntries).values({
        id: nid('led'),
        date: new Date().toISOString().slice(0, 10),
        type: 'debit',
        category: 'settlement',
        account: 'Fleet settlement payable',
        memo: `Settlement approved for ${row[0].riderName}`,
        amount: row[0].payout,
        refType: 'settlement',
        refId: row[0].id,
      })
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Approved settlement ${row[0].id} for ${row[0].riderName}`,
    )

    return true
  })

export const reconcilePaymentFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('payments', 'edit')
    await db
      .update(payments)
      .set({ status: 'reconciled' })
      .where(eq(payments.id, data.id))

    await logAudit(
      user.name,
      'payments',
      'edit',
      `Reconciled payment ${data.id}`,
    )
    return true
  })

export const upsertBannerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        title: z.string().min(2),
        imageUrl: z.string().min(5),
        href: z.string().default('/drinks'),
        placement: z.enum(['home', 'drinks', 'grocery']).default('home'),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission(
      'marketing',
      data.id ? 'edit' : 'create',
    )
    await upsertBannerQuery({
      id: data.id || nid('ban'),
      title: data.title,
      imageUrl: data.imageUrl,
      href: data.href,
      placement: data.placement,
      active: data.active,
    })

    await logAudit(
      user.name,
      'marketing',
      data.id ? 'edit' : 'create',
      `${data.id ? 'Updated' : 'Created'} banner ${data.title}`,
    )

    return true
  })

export const deleteBannerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('marketing', 'delete')
    await deleteBannerQuery(data.id)
    await logAudit(
      user.name,
      'marketing',
      'delete',
      `Deleted banner ${data.id}`,
    )
    return true
  })

export const resetOpsFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireRole('admin')
    // No-op in production relational database
    return true
  },
)

// -------------------------------------------------------------
// RIDER PORTAL SERVER FUNCTIONS (ROW-LEVEL SCOPED)
// -------------------------------------------------------------

export const getRiderPortalFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    if (user.role !== 'rider') {
      throw new Error('Forbidden: Rider access required')
    }

    let rider = await getRiderByUserIdQuery(user.id)

    if (!rider && user.email) {
      const allRiders = await getAllRidersQuery()
      rider =
        allRiders.find(
          (r) => r.email.toLowerCase() === user.email.toLowerCase(),
        ) ?? null
    }

    if (!rider) {
      throw new Error('Rider profile not found. Please contact administration.')
    }

    const currentRider = rider
    const orderList = await getAllOrdersQuery()
    const assignedOrders = orderList.filter(
      (o) => o.riderId === currentRider.id,
    )

    const activeOrders = assignedOrders.filter((o) =>
      ['assigned', 'out_for_delivery'].includes(o.status),
    )
    const completedOrders = assignedOrders.filter(
      (o) => o.status === 'delivered',
    )

    return {
      rider: currentRider,
      orders: assignedOrders,
      activeOrders,
      completedOrders,
      stats: {
        totalAssigned: assignedOrders.length,
        activeCount: activeOrders.length,
        completedCount: completedOrders.length,
        cashOnHand: currentRider.cashOnHand,
        earnings: currentRider.earnings,
        deliveries: currentRider.deliveries,
        rating: currentRider.rating,
      },
    }
  },
)

export const updateRiderDeliveryStatusFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        status: z.enum(['out_for_delivery', 'delivered']),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    if (user.role !== 'rider') {
      throw new Error('Forbidden: Rider access required')
    }

    const rider = await getRiderByUserIdQuery(user.id)
    if (!rider) throw new Error('Rider profile not found')

    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    if (order.riderId !== rider.id) {
      throw new Error('Forbidden: You are not assigned to this delivery')
    }

    const now = new Date()

    await dbTx.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status: data.status, updatedAt: now })
        .where(eq(orders.id, data.orderId))

      if (data.status === 'out_for_delivery') {
        await tx
          .update(riders)
          .set({ status: 'busy', updatedAt: now })
          .where(eq(riders.id, rider.id))

        await tx.insert(orderStatusHistory).values({
          id: nid('evt'),
          orderId: order.id,
          status: 'out_for_delivery',
          note: data.notes || `Rider ${rider.name} started delivery`,
          actor: rider.name,
        })
      } else {
        const commission = Math.round(
          order.deliveryCharge * (rider.commissionRate / 100),
        )
        const newEarnings = rider.earnings + commission
        let newCashOnHand = rider.cashOnHand

        if (order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') {
          await tx
            .update(orders)
            .set({ paymentStatus: 'paid' })
            .where(eq(orders.id, order.id))
          newCashOnHand += order.total
        }

        await tx
          .update(riders)
          .set({
            deliveries: rider.deliveries + 1,
            earnings: newEarnings,
            cashOnHand: newCashOnHand,
            status: rider.available ? 'available' : 'offline',
            updatedAt: now,
          })
          .where(eq(riders.id, rider.id))

        await tx.insert(orderStatusHistory).values({
          id: nid('evt'),
          orderId: order.id,
          status: 'delivered',
          note: data.notes || `Delivered by rider ${rider.name}`,
          actor: rider.name,
        })
      }
    })

    await logAudit(
      rider.name,
      'riders',
      'edit',
      `Rider ${rider.name} marked order ${order.number} as ${data.status}`,
    )

    return true
  })

export const toggleRiderAvailabilityFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        available: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    if (user.role !== 'rider') {
      throw new Error('Forbidden: Rider access required')
    }

    const rider = await getRiderByUserIdQuery(user.id)
    if (!rider) throw new Error('Rider profile not found')

    await db
      .update(riders)
      .set({
        available: data.available,
        status: data.available ? 'available' : 'offline',
        updatedAt: new Date(),
      })
      .where(eq(riders.id, rider.id))

    return true
  })

export const depositRiderCashFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        amount: z.number().positive(),
        note: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    if (user.role !== 'rider') {
      throw new Error('Forbidden: Rider access required')
    }

    const rider = await getRiderByUserIdQuery(user.id)
    if (!rider) throw new Error('Rider profile not found')
    if (rider.cashOnHand < data.amount) {
      throw new Error('Deposit amount exceeds cash on hand')
    }

    const now = new Date()

    await dbTx.transaction(async (tx) => {
      await tx
        .update(riders)
        .set({
          cashOnHand: rider.cashOnHand - data.amount,
          updatedAt: now,
        })
        .where(eq(riders.id, rider.id))

      await tx.insert(riderCashHandovers).values({
        id: nid('rch'),
        riderId: rider.id,
        amount: data.amount,
        status: 'pending',
        notes: data.note || 'Cash deposit to operations counter',
      })

      await tx.insert(ledgerEntries).values({
        id: nid('led'),
        date: now.toISOString().slice(0, 10),
        type: 'credit',
        category: 'settlement',
        account: 'Cash In Hand (Fleet)',
        memo: `Rider cash deposit: ${rider.name} (Rs. ${(data.amount / 100).toFixed(2)})`,
        amount: data.amount,
        refType: 'settlement',
        refId: rider.id,
      })
    })

    await logAudit(
      rider.name,
      'finance',
      'create',
      `Rider ${rider.name} submitted cash handover Rs. ${(data.amount / 100).toFixed(2)}`,
    )

    return true
  })
