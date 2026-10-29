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
  dealerItems,
  dealers,
  notifications,
  user,
  riderShifts,
} from '#/db/schema'
import { auth } from '#/lib/auth'
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
  assignOrderItemDealerQuery,
  suggestDealersForItemQuery,
  suggestRidersForOrderQuery,
  calculateOrderMargins,
} from '#/server/orders/order.queries'
import { calculateOrderTotals } from '#/lib/pricing'
import { toPaisa } from '#/lib/money'
import { getAllDealersQuery } from '#/server/inventory/inventory.queries'
import {
  getAllRidersQuery,
  getRiderByIdQuery,
  getRiderByUserIdQuery,
  deleteRiderQuery,
  getAllSettlementsQuery,
  getSettlementsByRiderIdQuery,
  getActiveRiderShiftQuery,
  getAllRiderShiftsQuery,
  getRiderAttendanceStatsQuery,
} from '#/server/riders/rider.queries'
import {
  getAllLedgerEntriesQuery,
  getAllPaymentsQuery,
  getJournalEntriesQuery,
  getGeneralLedgerQuery,
  getChartOfAccountsWithBalancesQuery,
  getFiscalYearsQuery,
  getDealerPayablesSummaryQuery,
  getRiderAccountsSummaryQuery,
  getAllDealerSettlementsQuery,
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
  getCouponRedemptionsQuery,
  upsertCouponQuery,
  deleteCouponQuery,
  getAllComplaintsQuery,
  getCustomerComplaintsQuery,
  createComplaintQuery,
  updateComplaintStatusQuery,
  getAllBannersQuery,
  upsertBannerQuery,
  deleteBannerQuery,
  getAllCampaignsQuery,
  getAllReviewsQuery,
  updateReviewStatusQuery,
  getAllShippingZonesQuery,
  upsertShippingZoneQuery,
  getAllOffersQuery,
  getOfferBySlugQuery,
  upsertOfferQuery,
  deleteOfferQuery,
  getCustomerAddressesQuery,
  upsertCustomerAddressQuery,
  deleteCustomerAddressQuery,
  setDefaultCustomerAddressQuery,
} from '#/server/platform/platform.queries'
import { getProductVelocityAndSourcingIntelligenceQuery } from './sourcing-intelligence.queries'
import type { DateRangeKey, OpsState, ModuleKey, OrderStatus } from './types'
import { ACTIONS, MODULES } from './types'
import {
  transitionOrderTx,
  transitionOrder,
} from '#/server/orders/order.transitions'
import {
  postCashHandoverTx,
  postRiderPayoutTx,
  postRiderSalaryAccrualTx,
} from '#/server/finance/double-entry'

export { ACTIONS, MODULES }

function nid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function rangeBounds(range: DateRangeKey, from?: string, to?: string) {
  const end = to ? new Date(to) : new Date()
  end.setHours(23, 59, 59, 999)
  const start = from ? new Date(from) : new Date(end)
  if (!from) {
    if (range === 'today') {
      start.setDate(end.getDate())
    } else if (range === '7d') start.setDate(end.getDate() - 6)
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
        range: z
          .enum(['today', '7d', '30d', '90d', 'ytd', 'custom'])
          .default('30d'),
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
      dealerList,
    ] = await Promise.all([
      getAdminStatsQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
      getAllOrdersQuery(),
      getAllRidersQuery(),
      getAllAuditLogsQuery(),
      getAllNotificationsQuery(),
      getAllDealersQuery(),
    ])

    const { start, end } = rangeBounds(data.range, data.from, data.to)
    const inRangeOrders = allOrders.filter((o) =>
      inRange(o.createdAt, start, end),
    )
    const delivered = inRangeOrders.filter((o) => o.status === 'delivered')
    const revenue = delivered.reduce((s, o) => s + o.total, 0)
    const refunds = inRangeOrders
      .filter((o) => o.status === 'returned')
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
        dealers: dealerList.length,
        activeDealers: dealerList.filter((d) => d.isActive).length,
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
    const [orderList, riderList, users, liquor, grocery, settings, dealerList] =
      await Promise.all([
        getAllOrdersQuery(),
        getAllRidersQuery(),
        getAdminUsersQuery(),
        getAdminLiquorProductsQuery(),
        getAdminGroceryProductsQuery(),
        getStoreSettingsQuery(),
        getAllDealersQuery(),
      ])
    return {
      ops: {
        orders: orderList,
        riders: riderList,
        dealers: dealerList,
        settings,
      },
      orders: orderList,
      riders: riderList,
      dealers: dealerList,
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
    const [
      ledger,
      settlementsList,
      riderList,
      settings,
      users,
      paymentsList,
      dealersList,
      ordersList,
      journalEntriesList,
      generalLedgerList,
      chartOfAccountsList,
      fiscalYearsList,
      dealerPayablesList,
      riderAccountsList,
      dealerSettlementsList,
      offersList,
      riderShiftsList,
    ] = await Promise.all([
      getAllLedgerEntriesQuery(),
      getAllSettlementsQuery(),
      getAllRidersQuery(),
      getStoreSettingsQuery(),
      getAdminUsersQuery(),
      getAllPaymentsQuery(),
      getAllDealersQuery(),
      getAllOrdersQuery(),
      getJournalEntriesQuery({ limit: 100 }),
      getGeneralLedgerQuery({ limit: 250 }),
      getChartOfAccountsWithBalancesQuery(),
      getFiscalYearsQuery(),
      getDealerPayablesSummaryQuery(),
      getRiderAccountsSummaryQuery(),
      getAllDealerSettlementsQuery(),
      getAllOffersQuery(),
      getAllRiderShiftsQuery(undefined, 50),
    ])
    return {
      ops: {
        ledger,
        settlements: settlementsList,
        riders: riderList,
        settings,
        payments: paymentsList,
        dealers: dealersList,
        orders: ordersList,
        journalEntries: journalEntriesList,
        generalLedger: generalLedgerList,
        chartOfAccounts: chartOfAccountsList,
        fiscalYears: fiscalYearsList,
        dealerPayables: dealerPayablesList,
        dealerSettlements: dealerSettlementsList,
        riderAccounts: riderAccountsList,
        offers: offersList,
        riderShifts: riderShiftsList,
      },
      ledger,
      settlements: settlementsList,
      riders: riderList,
      settings,
      users,
      payments: paymentsList,
      dealers: dealersList,
      orders: ordersList,
      journalEntries: journalEntriesList,
      generalLedger: generalLedgerList,
      chartOfAccounts: chartOfAccountsList,
      fiscalYears: fiscalYearsList,
      dealerPayables: dealerPayablesList,
      dealerSettlements: dealerSettlementsList,
      riderAccounts: riderAccountsList,
      offers: offersList,
      riderShifts: riderShiftsList,
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
    const [
      couponsList,
      bannersList,
      campaignsList,
      reviewsList,
      redemptionsList,
    ] = await Promise.all([
      getAllCouponsQuery(),
      getAllBannersQuery(),
      getAllCampaignsQuery(),
      getAllReviewsQuery(),
      getCouponRedemptionsQuery(200),
    ])
    return {
      ops: {
        coupons: couponsList,
        couponRedemptions: redemptionsList,
        banners: bannersList,
        campaigns: campaignsList,
        reviews: reviewsList,
      },
      coupons: couponsList,
      couponRedemptions: redemptionsList,
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
    const [
      orderList,
      ledgerList,
      paymentsList,
      riderList,
      settings,
      stats,
      sourcingIntelligence,
    ] = await Promise.all([
      getAllOrdersQuery(),
      getAllLedgerEntriesQuery(),
      getAllPaymentsQuery(),
      getAllRidersQuery(),
      getStoreSettingsQuery(),
      getAdminStatsQuery(),
      getProductVelocityAndSourcingIntelligenceQuery(),
    ])
    return {
      ops: {
        orders: orderList,
        ledger: ledgerList,
        payments: paymentsList,
        riders: riderList,
        settings,
        sourcingIntelligence,
      },
      orders: orderList,
      ledger: ledgerList,
      payments: paymentsList,
      liquor: [] as any[],
      grocery: [] as any[],
      stats,
      sourcingIntelligence,
    }
  },
)

export const getProductVelocityAndSourcingIntelligenceFn = createServerFn({
  method: 'GET',
})
  .validator((d: unknown) =>
    z
      .object({
        days: z.number().int().positive().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('reports', 'view')
    return getProductVelocityAndSourcingIntelligenceQuery(data.days ?? null)
  })

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
        cancellationReason: z.string().optional(),
        deliveryFailureReason: z.string().optional(),
        ageVerifiedAtDelivery: z.boolean().optional(),
        itemDealers: z
          .array(
            z.object({
              itemId: z.string(),
              dealerId: z.string().nullable(),
            }),
          )
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.id)
    if (!order) throw new Error('Order not found')

    await dbTx.transaction(async (tx) => {
      // 1. If item dealers were updated, save them first
      if (data.itemDealers && data.itemDealers.length > 0) {
        for (const itemD of data.itemDealers) {
          let snapshottedCost: number | null = null
          if (itemD.dealerId) {
            const currentItem = await tx
              .select({
                productId: orderItems.productId,
                unitPrice: orderItems.unitPrice,
              })
              .from(orderItems)
              .where(eq(orderItems.id, itemD.itemId))
              .limit(1)

            if (currentItem[0]) {
              const dItem = await tx
                .select({ costPrice: dealerItems.costPrice })
                .from(dealerItems)
                .where(
                  and(
                    eq(dealerItems.dealerId, itemD.dealerId),
                    eq(dealerItems.productId, currentItem[0].productId),
                  ),
                )
                .limit(1)

              snapshottedCost =
                dItem[0]?.costPrice && dItem[0].costPrice > 0
                  ? dItem[0].costPrice
                  : Math.round(currentItem[0].unitPrice * 0.85)
            }
          }

          await tx
            .update(orderItems)
            .set({
              dealerId: itemD.dealerId || null,
              dealerCostPrice: snapshottedCost,
              sourcingStatus: itemD.dealerId ? 'assigned' : 'pending',
            })
            .where(
              and(
                eq(orderItems.id, itemD.itemId),
                eq(orderItems.orderId, data.id),
              ),
            )
        }
      }

      // 2. Determine target status transition
      let targetStatus: OrderStatus | undefined = data.status as
        OrderStatus | undefined
      if (!targetStatus && data.riderId !== undefined) {
        if (data.riderId && data.riderId !== order.riderId) {
          if (
            ['pending', 'confirmed', 'dealer_assigned'].includes(order.status)
          ) {
            targetStatus = 'rider_assigned'
          }
        } else if (data.riderId === null && order.riderId) {
          if (order.status === 'rider_assigned') {
            targetStatus = 'confirmed'
          }
        }
      }

      // 3. If there is a status transition, execute through the validated state machine
      if (targetStatus && targetStatus !== order.status) {
        await transitionOrderTx(tx, {
          orderId: data.id,
          toStatus: targetStatus,
          user: {
            id: user.id,
            name: user.name,
            role: user.role as any,
          },
          options: {
            riderId:
              data.riderId !== undefined
                ? data.riderId || undefined
                : undefined,
            cancellationReason: data.cancellationReason,
            deliveryFailureReason: data.deliveryFailureReason,
            ageVerifiedAtDelivery: data.ageVerifiedAtDelivery,
            note: data.notes,
          },
        })
      }

      // 4. Update non-status order fields if provided
      const directUpdates: Record<string, any> = {}
      if (data.paymentStatus) directUpdates.paymentStatus = data.paymentStatus
      if (data.notes !== undefined) directUpdates.notes = data.notes
      if (
        data.riderId !== undefined &&
        (!targetStatus || targetStatus === order.status)
      ) {
        directUpdates.riderId = data.riderId
      }

      if (Object.keys(directUpdates).length > 0) {
        directUpdates.updatedAt = new Date()
        await tx.update(orders).set(directUpdates).where(eq(orders.id, data.id))
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

export const assignOrderItemDealerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        orderItemId: z.string(),
        dealerId: z.string().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    await assignOrderItemDealerQuery(data.orderItemId, data.dealerId)

    await logAudit(
      user.name,
      'orders',
      'edit',
      `Assigned dealer ${data.dealerId || 'none'} to item ${data.orderItemId} on order ${order.number}`,
    )

    return { success: true }
  })

export const markOrderItemUnavailableFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        orderItemId: z.string(),
        reason: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const session = await getSessionUser()
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    const isAssignedRider =
      session.role === 'rider' && order.riderId === session.id
    const isStaff = session.role === 'admin' || session.role === 'manager'
    if (!isAssignedRider && !isStaff) {
      throw new Error(
        'Forbidden: only assigned rider or manager can mark an item unavailable',
      )
    }

    const item = order.items.find((it) => it.id === data.orderItemId)
    if (!item) throw new Error('Order item not found')

    await dbTx.transaction(async (tx) => {
      await tx
        .update(orderItems)
        .set({
          sourcingStatus: 'unavailable',
        })
        .where(eq(orderItems.id, data.orderItemId))

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        status: order.status,
        note: `Item "${item.name}" marked unavailable from dealer. Reason: ${data.reason || 'Out of stock at dealer'}`,
        actor: session.name,
        actorId: session.id,
        actorRole: session.role,
      })
    })

    await logAudit(
      session.name,
      'orders',
      'edit',
      `Marked item ${item.name} (${data.orderItemId}) unavailable on order ${order.number}`,
    )

    return { success: true }
  })

export const recordRiderDealerPickupBillFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        orderItemId: z.string(),
        actualDealerCostPrice: z.number().int().nonnegative().optional(),
        dealerBillPhotoUrl: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const session = await getSessionUser()
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    const isAssignedRider =
      session.role === 'rider' && order.riderId === session.id
    const isStaff = session.role === 'admin' || session.role === 'manager'
    if (!isAssignedRider && !isStaff) {
      throw new Error(
        'Forbidden: only assigned rider or manager can record dealer pickup bill',
      )
    }

    const item = order.items.find((it) => it.id === data.orderItemId)
    if (!item) throw new Error('Order item not found')

    await dbTx.transaction(async (tx) => {
      await tx
        .update(orderItems)
        .set({
          sourcingStatus: 'picked_up',
          actualDealerCostPrice:
            data.actualDealerCostPrice ?? item.dealerCostPrice ?? null,
          dealerBillPhotoUrl: data.dealerBillPhotoUrl || null,
        })
        .where(eq(orderItems.id, data.orderItemId))

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        status: order.status,
        note: `Item "${item.name}" picked up from dealer. Bill recorded.`,
        actor: session.name,
        actorId: session.id,
        actorRole: session.role,
      })
    })

    await logAudit(
      session.name,
      'orders',
      'edit',
      `Recorded dealer pickup bill for item ${item.name} on order ${order.number}`,
    )

    return { success: true }
  })

export const suggestDealersForItemFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ orderItemId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission('orders', 'view')
    return suggestDealersForItemQuery(data.orderItemId)
  })

export const suggestRidersForOrderFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ orderId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission('orders', 'view')
    return suggestRidersForOrderQuery(data.orderId)
  })

export const autoAssignNearestDealersForOrderFn = createServerFn({
  method: 'POST',
})
  .validator((d: unknown) => z.object({ orderId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    let updatedCount = 0

    await dbTx.transaction(async (tx) => {
      for (const item of order.items) {
        if (item.dealerId && item.sourcingStatus !== 'unavailable') continue

        const suggestions = await suggestDealersForItemQuery(item.id)
        const bestDealer = suggestions.suggestions[0]
        if (!bestDealer) continue

        await tx
          .update(orderItems)
          .set({
            dealerId: bestDealer.dealerId,
            dealerCostPrice: bestDealer.costPrice,
            sourcingStatus: 'assigned',
          })
          .where(eq(orderItems.id, item.id))

        updatedCount++
      }

      if (updatedCount > 0) {
        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),
          orderId: data.orderId,
          fromStatus: order.status,
          toStatus: order.status,
          status: order.status,
          note: `Auto-assigned nearest available dealers to ${updatedCount} items by ${actor.name}`,
          actor: actor.name,
          actorId: actor.id,
          actorRole: actor.role,
        })
      }
    })

    const freshOrder = await getOrderByIdQuery(data.orderId)
    const allAssigned = freshOrder?.items.every(
      (it) => it.dealerId && it.sourcingStatus === 'assigned',
    )
    if (freshOrder && freshOrder.status === 'confirmed' && allAssigned) {
      await transitionOrder({
        orderId: freshOrder.id,
        toStatus: 'dealer_assigned',
        user: { id: actor.id, name: actor.name, role: actor.role as any },
        options: { note: `All items assigned to dealers by ${actor.name}` },
      })
    }

    await logAudit(
      actor.name,
      'orders',
      'edit',
      `Auto-assigned nearest dealers to ${updatedCount} items on order ${order.number}`,
    )

    return { success: true, updatedCount }
  })

export const substituteOrderItemDealerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        orderItemId: z.string(),
        newDealerId: z.string(),
        reason: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    const item = order.items.find((it) => it.id === data.orderItemId)
    if (!item) throw new Error('Order item not found')

    const newDealerRow = await db
      .select()
      .from(dealers)
      .where(eq(dealers.id, data.newDealerId))
      .limit(1)
    if (!newDealerRow[0]) throw new Error('New dealer not found')
    const newDealer = newDealerRow[0]

    const dItem = await db
      .select({ costPrice: dealerItems.costPrice })
      .from(dealerItems)
      .where(
        and(
          eq(dealerItems.dealerId, data.newDealerId),
          eq(dealerItems.productId, item.productId),
          eq(dealerItems.catalogType, item.catalogType),
        ),
      )
      .limit(1)

    const snapshottedCost =
      dItem[0]?.costPrice && dItem[0].costPrice > 0
        ? dItem[0].costPrice
        : Math.round(item.unitPrice * 0.85)

    const now = new Date()

    await dbTx.transaction(async (tx) => {
      await tx
        .update(orderItems)
        .set({
          dealerId: data.newDealerId,
          dealerCostPrice: snapshottedCost,
          sourcingStatus: 'assigned',
        })
        .where(eq(orderItems.id, data.orderItemId))

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        status: order.status,
        note: `Item "${item.name}" reassigned to dealer ${newDealer.name}. ${data.reason ? `Reason: ${data.reason}` : ''}`,
        actor: actor.name,
        actorId: actor.id,
        actorRole: actor.role,
        createdAt: now,
      })

      if (order.riderId) {
        const riderRows = await tx
          .select({ userId: riders.userId })
          .from(riders)
          .where(eq(riders.id, order.riderId))
          .limit(1)
        if (riderRows[0]?.userId) {
          await tx.insert(notifications).values({
            id: nid('notif'),
            userId: riderRows[0].userId,
            type: 'rider',
            title: `Pickup Dealer Updated for Order #${order.number}`,
            body: `Item "${item.name}" reassigned to ${newDealer.name} (${newDealer.address}).`,
            href: '/rider/deliveries',
            read: false,
            createdAt: now,
          })
        }
      }
    })

    await logAudit(
      actor.name,
      'orders',
      'edit',
      `Substituted dealer for item ${item.name} to ${newDealer.name} on order ${order.number}`,
    )

    return { success: true }
  })

export const removeOrderItemFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        orderItemId: z.string(),
        reason: z.string().min(1, 'Reason for removing item is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    if (
      [
        'picked_up',
        'out_for_delivery',
        'delivered',
        'returned',
        'cancelled',
      ].includes(order.status)
    ) {
      throw new Error(
        `Cannot remove item from order in status '${order.status}'. Only allowed before dispatch.`,
      )
    }

    if (order.items.length <= 1) {
      throw new Error(
        'Cannot remove the only item in an order. Please cancel the order instead.',
      )
    }

    const itemToRemove = order.items.find((it) => it.id === data.orderItemId)
    if (!itemToRemove) throw new Error('Order item not found')

    const remainingItems = order.items.filter(
      (it) => it.id !== data.orderItemId,
    )

    const settings = await getStoreSettingsQuery()
    const totals = calculateOrderTotals({
      items: remainingItems.map((it) => ({
        catalogType: it.catalogType,
        productId: it.productId,
        variantId: it.variantId,
        name: it.name,
        variantName: it.variantName,
        sku: it.sku,
        qty: it.qty,
        unitPrice: it.unitPrice,
      })),
      discountPaisa: order.discount,
      deliverySettings: {
        defaultDeliveryFeePaisa: (settings as any).deliveryFee ?? 15000,
        freeDeliveryThresholdPaisa:
          (settings as any).freeDeliveryThreshold ?? 300000,
      },
      vatRate: settings.taxRate ?? 13,
    })

    const now = new Date()

    await dbTx.transaction(async (tx) => {
      await tx.delete(orderItems).where(eq(orderItems.id, data.orderItemId))

      await tx
        .update(orders)
        .set({
          subtotal: totals.subtotalPaisa,
          discount: totals.discountPaisa,
          deliveryCharge: totals.deliveryChargePaisa,
          tax: totals.vatPaisa,
          total: totals.totalPaisa,
          updatedAt: now,
        })
        .where(eq(orders.id, data.orderId))

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        status: order.status,
        note: `Removed item "${itemToRemove.name}" (${itemToRemove.variantName}). Reason: ${data.reason}. Order total adjusted to Rs. ${(totals.totalPaisa / 100).toFixed(2)}.`,
        actor: actor.name,
        actorId: actor.id,
        actorRole: actor.role,
        createdAt: now,
      })

      if (order.customerId) {
        await tx.insert(notifications).values({
          id: nid('notif'),
          userId: order.customerId,
          type: 'order',
          title: `Item removed from Order #${order.number}`,
          body: `"${itemToRemove.name}" was removed due to dealer unavailability (${data.reason}). Your new order total is Rs. ${(totals.totalPaisa / 100).toFixed(2)}.`,
          href: `/orders`,
          read: false,
          createdAt: now,
        })
      }
    })

    await logAudit(
      actor.name,
      'orders',
      'edit',
      `Removed item ${itemToRemove.name} from order ${order.number}. Reason: ${data.reason}`,
    )

    return {
      success: true,
      newTotal: totals.totalPaisa,
    }
  })

export const editOrderItemsBeforeDispatchFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
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
              dealerId: z.string().nullable().optional(),
            }),
          )
          .min(1, 'Order must contain at least 1 item'),
        note: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('orders', 'edit')
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')

    if (
      [
        'picked_up',
        'out_for_delivery',
        'delivered',
        'returned',
        'cancelled',
      ].includes(order.status)
    ) {
      throw new Error(
        `Cannot modify items on order in status '${order.status}'. Dispatch has already started.`,
      )
    }

    const settings = await getStoreSettingsQuery()
    const totals = calculateOrderTotals({
      items: data.items,
      discountPaisa: order.discount,
      deliverySettings: {
        defaultDeliveryFeePaisa: (settings as any).deliveryFee ?? 15000,
        freeDeliveryThresholdPaisa:
          (settings as any).freeDeliveryThreshold ?? 300000,
      },
      vatRate: settings.taxRate ?? 13,
    })

    const now = new Date()

    await dbTx.transaction(async (tx) => {
      await tx.delete(orderItems).where(eq(orderItems.orderId, data.orderId))

      for (const it of data.items) {
        let snapshottedCost: number | null = null
        if (it.dealerId) {
          const dItem = await tx
            .select({ costPrice: dealerItems.costPrice })
            .from(dealerItems)
            .where(
              and(
                eq(dealerItems.dealerId, it.dealerId),
                eq(dealerItems.catalogType, it.catalogType),
                eq(dealerItems.productId, it.productId),
              ),
            )
            .limit(1)

          snapshottedCost =
            dItem[0]?.costPrice && dItem[0].costPrice > 0
              ? dItem[0].costPrice
              : Math.round(it.unitPrice * 0.85)
        }

        await tx.insert(orderItems).values({
          id: nid('oi'),
          orderId: data.orderId,
          catalogType: it.catalogType,
          productId: it.productId,
          variantId: it.variantId,
          name: it.name,
          variantName: it.variantName,
          sku: it.sku,
          qty: it.qty,
          unitPrice: it.unitPrice,
          lineTotal: it.unitPrice * it.qty,
          dealerId: it.dealerId || null,
          dealerCostPrice: snapshottedCost,
          sourcingStatus: it.dealerId ? 'assigned' : 'pending',
        })
      }

      await tx
        .update(orders)
        .set({
          subtotal: totals.subtotalPaisa,
          discount: totals.discountPaisa,
          deliveryCharge: totals.deliveryChargePaisa,
          tax: totals.vatPaisa,
          total: totals.totalPaisa,
          updatedAt: now,
        })
        .where(eq(orders.id, data.orderId))

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId: data.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        status: order.status,
        note: `Order items modified before dispatch by ${actor.name}. Total: Rs. ${(totals.totalPaisa / 100).toFixed(2)}. ${data.note || ''}`,
        actor: actor.name,
        actorId: actor.id,
        actorRole: actor.role,
        createdAt: now,
      })
    })

    await logAudit(
      actor.name,
      'orders',
      'edit',
      `Modified items on order ${order.number} before dispatch (new total: Rs. ${(totals.totalPaisa / 100).toFixed(2)})`,
    )

    return {
      success: true,
      newTotal: totals.totalPaisa,
    }
  })

export const getOrderMarginsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ orderId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission('orders', 'view')
    const order = await getOrderByIdQuery(data.orderId)
    if (!order) throw new Error('Order not found')
    return calculateOrderMargins(order)
  })

export const createOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        customerName: z.string().min(2),
        customerPhone: z.string().min(6),
        customerEmail: z.string().email().optional(),
        address: z.string().min(3),
        city: z.string().default('Butwal'),
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
              dealerId: z.string().nullable().optional(),
            }),
          )
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('orders', 'create')
    const settings = await getStoreSettingsQuery()
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0,
    )
    const baseFee = settings.deliveryFee ?? 0
    const freeThresh = settings.freeDeliveryThreshold ?? 0
    const deliveryCharge =
      baseFee === 0 || (freeThresh > 0 && subtotal >= freeThresh) ? 0 : baseFee
    const total = subtotal + deliveryCharge
    const orderCountRes = await db.select({ count: count() }).from(orders)
    const orderSeq = (orderCountRes[0]?.count ?? 0) + 1
    const orderNumber = `${settings.invoicePrefix}-${String(10000 + orderSeq).padStart(5, '0')}`

    const orderId = nid('ord')
    const trackingCode = `TRK${Math.floor(100000 + Math.random() * 900000)}`
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000))
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
        deliveryOtp,
        notes: data.notes || '',
      })

      for (const item of data.items) {
        let snapshottedCost: number | null = null
        if (item.dealerId) {
          const dItem = await tx
            .select({ costPrice: dealerItems.costPrice })
            .from(dealerItems)
            .where(
              and(
                eq(dealerItems.dealerId, item.dealerId),
                eq(dealerItems.catalogType, item.catalogType),
                eq(dealerItems.productId, item.productId),
              ),
            )
            .limit(1)

          snapshottedCost =
            dItem[0]?.costPrice && dItem[0].costPrice > 0
              ? dItem[0].costPrice
              : Math.round(item.unitPrice * 0.85)
        }

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
          dealerId: item.dealerId || null,
          dealerCostPrice: snapshottedCost,
          sourcingStatus: item.dealerId ? 'assigned' : 'pending',
        })
      }

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId,
        fromStatus: null,
        toStatus: 'confirmed',
        status: 'confirmed',
        note: `Order manually created by ${actor.name}`,
        actor: actor.name,
        actorId: actor.id,
        actorRole: actor.role,
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
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        phone: z.string().min(6, 'Phone number must be at least 6 digits'),
        vehicle: z.enum(['bike', 'scooter', 'car']).default('bike'),
        licenseNo: z.string().optional().default(''),
        zone: z.string().default('Butwal Core'),
        commissionRate: z.number().min(0).max(100).default(10),
        baseSalary: z.number().min(0).optional().default(0),
        perDropRate: z.number().min(0).optional().default(50),
        available: z.boolean().default(true),
        status: z.enum(['offline', 'available', 'busy']).default('available'),
        verified: z.boolean().default(true),
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .optional()
          .or(z.literal('')),
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
      } else if (data.password && data.password.trim().length >= 8) {
        const created = await auth.api.createUser({
          body: {
            name: data.name.trim(),
            email: normalizedEmail,
            password: data.password.trim(),
            role: 'rider' as any,
            data: {
              phone: data.phone.trim(),
              isActive: true,
            },
          },
        })
        assignedUserId = created.user.id
      }
    } else {
      const existingRiders = await db
        .select()
        .from(riders)
        .where(eq(riders.id, data.id))
        .limit(1)

      if (!existingRiders[0]) {
        throw new Error('Rider not found')
      }

      assignedUserId = existingRiders[0].userId

      if (assignedUserId) {
        await db
          .update(user)
          .set({
            name: data.name.trim(),
            email: normalizedEmail,
            phone: data.phone.trim(),
          })
          .where(eq(user.id, assignedUserId))

        if (data.password && data.password.trim().length >= 8) {
          await auth.api.setUserPassword({
            body: {
              userId: assignedUserId,
              newPassword: data.password.trim(),
            },
          })
        }
      } else if (data.password && data.password.trim().length >= 8) {
        const created = await auth.api.createUser({
          body: {
            name: data.name.trim(),
            email: normalizedEmail,
            password: data.password.trim(),
            role: 'rider' as any,
            data: {
              phone: data.phone.trim(),
              isActive: true,
            },
          },
        })
        assignedUserId = created.user.id
      }
    }

    const baseSalaryPaisa = toPaisa(data.baseSalary)
    const perDropRatePaisa = toPaisa(data.perDropRate)

    await db
      .insert(riders)
      .values({
        id: riderId,
        userId: assignedUserId,
        name: data.name.trim(),
        email: normalizedEmail,
        phone: data.phone.trim(),
        vehicle: data.vehicle,
        licenseNo: data.licenseNo.trim(),
        zone: data.zone,
        commissionRate: data.commissionRate,
        baseSalary: baseSalaryPaisa,
        perDropRate: perDropRatePaisa,
        available: data.available,
        status: data.status,
        verified: data.verified,
      })
      .onConflictDoUpdate({
        target: riders.id,
        set: {
          name: data.name.trim(),
          email: normalizedEmail,
          phone: data.phone.trim(),
          vehicle: data.vehicle,
          licenseNo: data.licenseNo.trim(),
          zone: data.zone,
          commissionRate: data.commissionRate,
          baseSalary: baseSalaryPaisa,
          perDropRate: perDropRatePaisa,
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

export const deleteRiderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().min(1, 'Rider ID is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user: actor } = await requirePermission('riders', 'delete')
    const existing = await getRiderByIdQuery(data.id)
    if (!existing) {
      throw new Error('Rider not found')
    }

    await deleteRiderQuery(data.id)

    await logAudit(
      actor.name,
      'riders',
      'delete',
      `Deleted courier: ${existing.name} (${existing.phone})`,
    )

    return { success: true, id: data.id }
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
        zone: z.string().optional().default('Butwal Core'),
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

    const newUserId = created.user.id
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
        vehicle: data.vehicle,
        licenseNo: data.licenseNo || 'LU-2-PA-1001',
        zone: data.zone || 'Butwal Core',
        commissionRate: data.commissionRate,
        available: true,
        status: 'available',
        verified: true,
        lat: '27.7006',
        lng: '83.4484',
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
          'salary',
          'dealer_payment',
        ]),
        account: z.string().min(2),
        memo: z.string().min(2),
        amount: z.number().int().positive(),
        refType: z
          .enum(['order', 'settlement', 'manual', 'refund', 'dealer', 'salary'])
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
        riderCodLimit: z.number().int().min(0).optional(),
        deliveryFee: z.number().int().min(0).optional(),
        freeDeliveryThreshold: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('settings', 'edit')
    await saveStoreSettingsQuery(data)
    await logAudit(user.name, 'settings', 'edit', 'Updated store configuration')
    return true
  })

export const getPublicDeliverySettingsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const settings = await getStoreSettingsQuery()
  const deliveryFee = settings.deliveryFee ?? 0
  const freeDeliveryThreshold = settings.freeDeliveryThreshold ?? 0
  return {
    deliveryFee, // in paisa (0 = free delivery for growth stage)
    freeDeliveryThreshold, // in paisa
    isGrowthFreeDelivery: deliveryFee === 0,
  }
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

    const permissionsToSave: Record<string, string[]> = { ...data.permissions }
    permissionsToSave.products = Array.from(
      new Set([
        ...(data.permissions.liquor || []),
        ...(data.permissions.grocery || []),
        ...(data.permissions.categories || []),
        ...(data.permissions.inventory || []),
        ...(data.permissions.dealers || []),
      ]),
    )

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

export const getCustomerComplaintsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const user = await getSessionUser()
  if (!user.isActive || user.banned) {
    throw new Error('Forbidden: Account suspended')
  }
  return getCustomerComplaintsQuery(user.id)
})

export const createCustomerComplaintFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string().optional().nullable(),
        subject: z.string().min(3).max(150),
        body: z.string().min(5).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }

    const id = await createComplaintQuery({
      customerId: user.id,
      customerName: user.name || 'Customer',
      orderId: data.orderId || null,
      subject: data.subject,
      body: data.body,
    })

    try {
      await db.insert(notifications).values({
        id: `notif_${crypto.randomUUID().slice(0, 10)}`,
        title: 'New Support Ticket Filed',
        body: `${user.name || 'Customer'} filed ticket: "${data.subject}"`,
        type: 'system',
        read: false,
        href: '/admin/customers',
      })
    } catch (notifErr) {
      console.error('Failed to create complaint notification:', notifErr)
    }

    return { id, success: true }
  })

export const approveSettlementFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        paymentMethod: z
          .enum(['cash', 'bank_transfer', 'esewa', 'khalti', 'cheque'])
          .default('cash'),
        paymentAccount: z.enum(['cash', 'bank']).default('cash'),
        paymentReference: z.string().optional(),
        proofUrls: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    const row = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, data.id))
      .limit(1)

    if (!row[0]) throw new Error('Settlement not found')

    const slug =
      row[0].slug || `vch_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const now = new Date()

    const grossAmount =
      row[0].grossEarnings || row[0].payout || row[0].netPayout
    const netPayout = row[0].netPayout || row[0].payout
    const cashShortageDeducted = row[0].cashShortageDeducted || 0
    const advancesDeducted = row[0].advancesDeducted || 0

    const result = await dbTx.transaction(async (tx) => {
      // If base salary was included, accrue it first to Rider Payable
      if (row[0].baseSalaryAmount && row[0].baseSalaryAmount > 0) {
        await postRiderSalaryAccrualTx(tx, {
          settlementId: row[0].id,
          riderId: row[0].riderId,
          riderName: row[0].riderName,
          baseSalaryAmount: row[0].baseSalaryAmount,
          actor: user,
        })
      }

      const posting = await postRiderPayoutTx(tx, {
        settlementId: row[0].id,
        riderId: row[0].riderId,
        riderName: row[0].riderName,
        grossAmount,
        netPaid: netPayout,
        cashShortageDeducted,
        advancesDeducted,
        paymentAccount: data.paymentAccount,
        actor: user,
      })

      const proofList =
        data.proofUrls && data.proofUrls.length > 0
          ? data.proofUrls
          : Array.isArray(row[0].proofUrls)
            ? row[0].proofUrls
            : []

      await tx
        .update(settlements)
        .set({
          status: 'paid',
          voucherNo: posting.voucherNo,
          slug,
          journalEntryId: posting.journalEntryId,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference || row[0].paymentReference,
          proofUrls: proofList,
          notes: data.notes || row[0].notes,
          paidAt: now,
          paidBy: user.id,
          updatedAt: now,
        })
        .where(eq(settlements.id, data.id))

      await tx.insert(ledgerEntries).values({
        id: nid('led'),
        date: now.toISOString().slice(0, 10),
        type: 'debit',
        category: 'settlement',
        account: 'Fleet settlement payable',
        memo: `Settlement approved for ${row[0].riderName} (${posting.voucherNo})`,
        amount: netPayout,
        refType: 'settlement',
        refId: row[0].id,
      })

      return {
        ...posting,
        slug,
      }
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Approved settlement ${result.voucherNo} for ${row[0].riderName} (slug: ${slug})`,
    )

    return result
  })

export const generateMonthlyRiderPayrollRunFn = createServerFn({
  method: 'POST',
})
  .validator((d: unknown) =>
    z
      .object({
        periodStart: z.string(), // ISO date or YYYY-MM-DD
        periodEnd: z.string(), // ISO date or YYYY-MM-DD
        riderId: z.string().optional(),
        includeBaseSalary: z.boolean().default(true),
        deductCashShortages: z.boolean().default(true),
        deductAdvances: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')
    const start = new Date(data.periodStart)
    const end = new Date(data.periodEnd)

    let targetRiders = await getAllRidersQuery()
    if (data.riderId) {
      targetRiders = targetRiders.filter((r) => r.id === data.riderId)
    }

    if (targetRiders.length === 0) {
      throw new Error('No couriers found for payroll run')
    }

    const allOrders = await getAllOrdersQuery()
    const createdDraftSettlements = []

    for (const rider of targetRiders) {
      const deliveredOrders = allOrders.filter(
        (o) =>
          o.riderId === rider.id &&
          o.status === 'delivered' &&
          new Date(o.createdAt) >= start &&
          new Date(o.createdAt) <= end,
      )

      const deliveriesCount = deliveredOrders.length
      const cashCollected = deliveredOrders
        .filter((o) => o.paymentMethod === 'cod')
        .reduce((sum, o) => sum + o.total, 0)

      const baseSalaryAmount = data.includeBaseSalary
        ? rider.baseSalary || 0
        : 0
      const perDropRate = rider.perDropRate || 5000 // paisa
      const perDropAmount = deliveriesCount * perDropRate

      const commissionRate = rider.commissionRate ?? 10
      const commissionAmount = Math.round(
        deliveredOrders.reduce(
          (sum, o) => sum + (o.deliveryCharge * commissionRate) / 100,
          0,
        ),
      )

      const grossEarnings = baseSalaryAmount + perDropAmount + commissionAmount

      const cashShortageDeducted = 0
      const advancesDeducted = 0

      const netPayout = Math.max(
        0,
        grossEarnings - cashShortageDeducted - advancesDeducted,
      )

      const slug = `vch_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      const voucherNo = `VCH-SET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      const settlementId = nid('set')

      await db.insert(settlements).values({
        id: settlementId,
        riderId: rider.id,
        riderName: rider.name,
        voucherNo,
        slug,
        periodStart: start,
        periodEnd: end,
        deliveries: deliveriesCount,
        cashCollected,
        baseSalaryAmount,
        perDropAmount,
        commissionAmount,
        commission: perDropAmount + commissionAmount,
        grossEarnings,
        advancesDeducted,
        cashShortageDeducted,
        cashHeldDeducted: 0,
        netPayout,
        payout: netPayout,
        status: 'draft',
        notes: `Payroll run for period ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)} (${deliveriesCount} drops)`,
        proofUrls: [],
      })

      createdDraftSettlements.push({
        id: settlementId,
        riderId: rider.id,
        riderName: rider.name,
        voucherNo,
        slug,
        deliveries: deliveriesCount,
        grossEarnings,
        netPayout,
      })
    }

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Generated monthly payroll run for ${createdDraftSettlements.length} couriers`,
    )

    return createdDraftSettlements
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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Forbidden: Reset operations are disabled in production')
    }
    // No-op in relational database
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
      ['assigned', 'rider_assigned', 'picked_up', 'out_for_delivery'].includes(
        o.status,
      ),
    )
    const completedOrders = assignedOrders.filter(
      (o) => o.status === 'delivered',
    )

    const [activeShift, attendanceStats, riderSettlements] = await Promise.all([
      getActiveRiderShiftQuery(currentRider.id),
      getRiderAttendanceStatsQuery(currentRider.id),
      getSettlementsByRiderIdQuery(currentRider.id),
    ])

    return {
      rider: currentRider,
      orders: assignedOrders,
      activeOrders,
      completedOrders,
      activeShift,
      attendanceStats,
      settlements: riderSettlements,
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
        status: z.enum([
          'picked_up',
          'out_for_delivery',
          'delivered',
          'delivery_failed',
        ]),
        deliveryFailureReason: z.string().optional(),
        ageVerifiedAtDelivery: z.boolean().optional(),
        deliveryOtp: z.string().optional(),
        proofPhotoUrl: z.string().optional(),
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

    await dbTx.transaction(async (tx) => {
      await transitionOrderTx(tx, {
        orderId: data.orderId,
        toStatus: data.status,
        user: {
          id: user.id,
          name: rider.name,
          role: 'rider',
        },
        options: {
          note: data.notes,
          deliveryFailureReason: data.deliveryFailureReason,
          ageVerifiedAtDelivery: data.ageVerifiedAtDelivery,
          deliveryOtp: data.deliveryOtp,
          proofPhotoUrl: data.proofPhotoUrl,
        },
      })
    })

    return true
  })

export const createDeliveryProofUploadFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        filename: z.string(),
        contentType: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    const { presignPut, getPublicUrl } = await import('#/lib/storage')
    const ext = data.filename.split('.').pop() || 'jpg'
    const key = `delivery-proof/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const uploadUrl = await presignPut(key, data.contentType)
    const publicUrl = getPublicUrl(key)
    return { uploadUrl, publicUrl, key }
  })

export const transitionOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        toStatus: z.enum([
          'pending',
          'confirmed',
          'dealer_assigned',
          'rider_assigned',
          'picked_up',
          'out_for_delivery',
          'delivered',
          'delivery_failed',
          'returned',
          'cancelled',
        ]),
        riderId: z.string().optional(),
        cancellationReason: z.string().optional(),
        deliveryFailureReason: z.string().optional(),
        ageVerifiedAtDelivery: z.boolean().optional(),
        note: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    return transitionOrder({
      orderId: data.orderId,
      toStatus: data.toStatus,
      user: {
        id: user.id,
        name: user.name,
        role: user.role as any,
      },
      options: {
        riderId: data.riderId,
        cancellationReason: data.cancellationReason,
        deliveryFailureReason: data.deliveryFailureReason,
        ageVerifiedAtDelivery: data.ageVerifiedAtDelivery,
        note: data.note,
      },
    })
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

    const now = new Date()

    await db
      .update(riders)
      .set({
        available: data.available,
        status: data.available ? 'available' : 'offline',
        updatedAt: now,
      })
      .where(eq(riders.id, rider.id))

    // Handle shift attendance tracking
    if (data.available) {
      // Starting shift: check if already active
      const activeShift = await getActiveRiderShiftQuery(rider.id)
      if (!activeShift) {
        await db.insert(riderShifts).values({
          id: nid('shf'),
          riderId: rider.id,
          status: 'active',
          startedAt: now,
          durationMinutes: 0,
        })
      }
    } else {
      // Ending shift: mark completed and compute duration
      const activeShift = await getActiveRiderShiftQuery(rider.id)
      if (activeShift) {
        const start = new Date(activeShift.startedAt)
        const durationMinutes = Math.max(
          0,
          Math.round((now.getTime() - start.getTime()) / (1000 * 60)),
        )
        await db
          .update(riderShifts)
          .set({
            status: 'completed',
            endedAt: now,
            durationMinutes,
            updatedAt: now,
          })
          .where(eq(riderShifts.id, activeShift.id))
      }
    }

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

    const handoverId = nid('rch')
    await dbTx.transaction(async (tx) => {
      await tx
        .update(riders)
        .set({
          cashOnHand: rider.cashOnHand - data.amount,
          updatedAt: now,
        })
        .where(eq(riders.id, rider.id))

      await tx.insert(riderCashHandovers).values({
        id: handoverId,
        riderId: rider.id,
        amount: data.amount,
        status: 'verified',
        notes: data.note || 'Cash deposit to operations counter',
      })

      await postCashHandoverTx(tx, {
        handoverId,
        riderId: rider.id,
        riderName: rider.name,
        amount: data.amount,
        actor: user,
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

// -------------------------------------------------------------
// RIDER SHIFTS & ATTENDANCE (B6)
// -------------------------------------------------------------

export const getRiderShiftsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        riderId: z.string().optional(),
        limit: z.number().default(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    let riderId = data.riderId

    if (user.role === 'rider') {
      const rider = await getRiderByUserIdQuery(user.id)
      if (!rider) throw new Error('Rider profile not found')
      riderId = rider.id
    } else {
      await requirePermission('riders', 'view')
    }

    return getAllRiderShiftsQuery(riderId, data.limit)
  })

export const getRiderAttendanceStatsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        riderId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    let riderId = data.riderId

    if (user.role === 'rider') {
      const rider = await getRiderByUserIdQuery(user.id)
      if (!rider) throw new Error('Rider profile not found')
      riderId = rider.id
    } else {
      await requirePermission('riders', 'view')
      if (!riderId) throw new Error('riderId is required for manager view')
    }

    return getRiderAttendanceStatsQuery(riderId)
  })

// -------------------------------------------------------------
// OFFERS & PROMOTIONS (A3 & B10)
// -------------------------------------------------------------

export const getOffersListFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        onlyActive: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return getAllOffersQuery(data.onlyActive)
  })

export const getOfferBySlugFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        slug: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const offer = await getOfferBySlugQuery(data.slug)
    if (!offer) throw new Error('Offer not found')
    return offer
  })

export const upsertOfferFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        title: z.string().min(2),
        slug: z.string().min(2),
        type: z
          .enum(['bogo', 'percent', 'fixed', 'free_delivery', 'bundle'])
          .default('percent'),
        scope: z
          .enum(['all', 'category', 'brand', 'product', 'variant'])
          .default('all'),
        scopeId: z.string().optional().nullable(),
        discountValue: z.number().default(0),
        minOrderAmount: z.number().default(0),
        bannerUrl: z.string().optional().nullable(),
        heading: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        priority: z.number().default(0),
        stackable: z.boolean().default(false),
        active: z.boolean().default(true),
        startsAt: z.string().optional().nullable(),
        expiresAt: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission(
      'marketing',
      data.id ? 'edit' : 'create',
    )
    const id = await upsertOfferQuery({
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    })

    await logAudit(
      user.name,
      'marketing',
      data.id ? 'edit' : 'create',
      `${data.id ? 'Updated' : 'Created'} offer ${data.title} (${data.slug})`,
    )

    return { id }
  })

export const deleteOfferFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('marketing', 'delete')
    await deleteOfferQuery(data.id)
    await logAudit(user.name, 'marketing', 'delete', `Deleted offer ${data.id}`)
    return true
  })

// -------------------------------------------------------------
// CUSTOMER SAVED ADDRESSES (B11)
// -------------------------------------------------------------

export const getCustomerAddressesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    return getCustomerAddressesQuery(user.id)
  },
)

export const upsertCustomerAddressFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        label: z.string().default('Home'),
        address: z.string().min(3),
        city: z.string().default('Butwal'),
        landmark: z.string().optional().nullable(),
        lat: z.number().optional().nullable(),
        lng: z.number().optional().nullable(),
        isDefault: z.boolean().default(false),
        contactPhone: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }

    const id = await upsertCustomerAddressQuery({
      ...data,
      customerId: user.id,
    })

    return { id }
  })

export const deleteCustomerAddressFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    await deleteCustomerAddressQuery(data.id, user.id)
    return true
  })

export const setDefaultCustomerAddressFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    await setDefaultCustomerAddressQuery(data.id, user.id)
    return true
  })
