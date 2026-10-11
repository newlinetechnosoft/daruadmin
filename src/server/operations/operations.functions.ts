import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
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
import { loadOps, mutateOps, nid, saveOps } from './store'
import { seedOpsFromCatalog } from './seed-ops'
import type {
  DateRangeKey,
  OrderStatus,
  PaymentMethod,
  Rider,
} from './types'
import { ACTIONS, MODULES } from './types'

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
    const user = await getSessionUser()
    const grants = await getUserGrants(user)
    const ops = await loadOps()

    const canOrders = can(grants, 'orders', 'view')
    const canRiders = can(grants, 'riders', 'view')
    const canAccounts = can(grants, 'accounts', 'view')
    const canCustomers = can(grants, 'customers', 'view')
    const canMarketing = can(grants, 'marketing', 'view')

    const badges = {
      pendingOrders: canOrders
        ? ops.orders.filter((o) => o.status === 'pending').length
        : 0,
      openComplaints: canCustomers
        ? ops.complaints.filter((c) => c.status === 'open').length
        : 0,
      activeRiders: canRiders
        ? ops.riders.filter((r) => r.status === 'available' || r.status === 'busy').length
        : 0,
      pendingSettlements: canAccounts
        ? ops.settlements.filter((s) => s.status === 'draft').length
        : 0,
      pendingReviews: canMarketing
        ? ops.reviews.filter((r) => r.status === 'pending').length
        : 0,
    }

    const filteredNotifications = ops.notifications.filter((n) => {
      if (n.type === 'order' && !canOrders) return false
      if (n.type === 'rider' && !canRiders) return false
      if (n.type === 'finance' && !canAccounts) return false
      return true
    })

    return {
      unread: filteredNotifications.filter((n) => !n.read).length,
      notifications: filteredNotifications.slice(0, 8),
      badges,
      user,
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
    return mutateOps((state) => {
      state.notifications.forEach((n) => {
        n.read = true
      })
      return state
    })
  },
)

export const globalSearchFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ q: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const user = await getSessionUser()
    const grants = await getUserGrants(user)

    const q = data.q.trim().toLowerCase()
    if (q.length < 2) return { products: [], orders: [], customers: [], riders: [] }

    const canProducts = can(grants, 'products', 'view')
    const canOrders = can(grants, 'orders', 'view')
    const canCustomers = can(grants, 'customers', 'view')
    const canRiders = can(grants, 'riders', 'view')

    const [liquor, grocery, users, ops] = await Promise.all([
      canProducts ? getAdminLiquorProductsQuery() : Promise.resolve([]),
      canProducts ? getAdminGroceryProductsQuery() : Promise.resolve([]),
      canCustomers ? getAdminUsersQuery() : Promise.resolve([]),
      (canOrders || canRiders) ? loadOps() : Promise.resolve({ orders: [], riders: [] } as any),
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

    const orders = canOrders
      ? ops.orders
          .filter(
            (o: any) =>
              o.number.toLowerCase().includes(q) ||
              o.customerName.toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((o: any) => ({
            id: o.id,
            name: `${o.number} · ${o.customerName}`,
            href: `/admin/orders/${o.id}`,
          }))
      : []

    const customers = canCustomers
      ? users
          .filter(
            (u) =>
              u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((u) => ({
            id: u.id,
            name: u.name,
            href: '/admin/customers',
          }))
      : []

    const riders = canRiders
      ? ops.riders
          .filter((r: any) => r.name.toLowerCase().includes(q))
          .slice(0, 4)
          .map((r: any) => ({ id: r.id, name: r.name, href: '/admin/riders' }))
      : []

    return {
      products,
      orders,
      customers,
      riders,
    }
  })

// -------------------------------------------------------------
// MODULE-SPECIFIC DATA LOADERS
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
    const [stats, liquor, grocery, users, ops] = await Promise.all([
      getAdminStatsQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
      loadOps(),
    ])

    const { start, end } = rangeBounds(data.range, data.from, data.to)
    const orders = ops.orders.filter((o) => inRange(o.createdAt, start, end))
    const delivered = orders.filter((o) => o.status === 'delivered')
    const revenue = delivered.reduce((s, o) => s + o.total, 0)
    const refunds = orders
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
    for (const o of orders) {
      const key = o.createdAt.slice(0, 10)
      const slot = byDay.get(key)
      if (!slot) continue
      slot.orders += 1
      if (o.status !== 'cancelled') slot.sales += o.total
    }

    const statusCounts: Record<string, number> = {}
    for (const o of orders) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
    }

    const productSales = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >()
    for (const o of orders) {
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

    const riders = ops.riders
    const customers = users.filter(
      (u) => !u.role || u.role === 'customer' || u.role === 'user',
    )

    return {
      catalog: stats,
      inventoryValue,
      kpis: {
        sales: delivered.length,
        revenue,
        orders: orders.length,
        profit,
        customers: customers.length,
        riders: riders.length,
        inventory: stats.totalStockUnits,
        lowStock: stats.lowStockCount,
      },
      salesTrend: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
      orderStatus: Object.entries(statusCounts).map(([label, value]) => ({
        label,
        value,
      })),
      topProducts,
      recentOrders: [...ops.orders]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
      activities: [...ops.audit]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 8),
      ridersOnline: riders.filter((r) => r.status !== 'offline').length,
      notifications: ops.notifications,
    }
  })

export const getOrdersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('orders', 'view')
    const [ops, users, liquor, grocery] = await Promise.all([
      loadOps(),
      getAdminUsersQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
    ])
    return {
      ops,
      orders: ops.orders,
      riders: ops.riders,
      users,
      liquor,
      grocery,
      settings: ops.settings,
    }
  },
)

export const getLedgerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    const [ops, users] = await Promise.all([loadOps(), getAdminUsersQuery()])
    return {
      ops: {
        ledger: ops.ledger,
        settlements: ops.settlements,
        riders: ops.riders,
        settings: ops.settings,
      },
      ledger: ops.ledger,
      settlements: ops.settlements,
      riders: ops.riders,
      settings: ops.settings,
      users,
    }
  },
)

export const getRidersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('riders', 'view')
    const [ops, users] = await Promise.all([loadOps(), getAdminUsersQuery()])
    return {
      ops: {
        riders: ops.riders,
        complaints: ops.complaints,
        zones: ops.zones,
      },
      riders: ops.riders,
      complaints: ops.complaints,
      zones: ops.zones,
      users,
    }
  },
)

export const getPaymentsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('payments', 'view')
    const ops = await loadOps()
    return {
      ops: {
        payments: ops.payments,
        settings: ops.settings,
      },
      payments: ops.payments,
      settings: ops.settings,
    }
  },
)

export const getShippingFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('shipping', 'view')
    const ops = await loadOps()
    return {
      ops: {
        zones: ops.zones,
        orders: ops.orders,
      },
      zones: ops.zones,
      orders: ops.orders,
    }
  },
)

export const getMarketingFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('marketing', 'view')
    const ops = await loadOps()
    return {
      ops: {
        coupons: ops.coupons,
        banners: ops.banners,
        campaigns: ops.campaigns,
        reviews: ops.reviews,
      },
      coupons: ops.coupons,
      banners: ops.banners,
      campaigns: ops.campaigns,
      reviews: ops.reviews,
    }
  },
)

export const getAuditFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('staff', 'view')
    const [ops, users] = await Promise.all([loadOps(), getAdminUsersQuery()])
    return {
      ops: {
        audit: ops.audit,
      },
      audit: ops.audit,
      users,
    }
  },
)

export const getSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('settings', 'view')
    const ops = await loadOps()
    return {
      ops: {
        settings: ops.settings,
        orders: ops.orders,
        riders: ops.riders,
        ledger: ops.ledger,
      },
      settings: ops.settings,
      liquor: [] as any[],
      grocery: [] as any[],
    }
  },
)

export const getCustomersOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('customers', 'view')
    const [ops, users] = await Promise.all([loadOps(), getAdminUsersQuery()])
    return {
      ops: {
        complaints: ops.complaints,
        orders: ops.orders,
      },
      users,
      complaints: ops.complaints,
      orders: ops.orders,
    }
  },
)

export const getInventoryOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('products', 'view')
    const [ops, liquor, grocery] = await Promise.all([
      loadOps(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
    ])
    return {
      ops: {
        orders: ops.orders,
        settings: ops.settings,
      },
      liquor,
      grocery,
    }
  },
)

export const getStaffOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('staff', 'view')
    const [ops, users] = await Promise.all([loadOps(), getAdminUsersQuery()])
    return {
      ops: {
        permissions: ops.permissions,
        audit: ops.audit,
      },
      users,
    }
  },
)

export const getReportsOpsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('reports', 'view')
    const [ops, stats] = await Promise.all([loadOps(), getAdminStatsQuery()])
    return {
      ops: {
        orders: ops.orders,
        ledger: ops.ledger,
        payments: ops.payments,
        riders: ops.riders,
        settings: ops.settings,
      },
      orders: ops.orders,
      ledger: ops.ledger,
      payments: ops.payments,
      liquor: [] as any[],
      grocery: [] as any[],
      stats,
    }
  },
)

// Legacy bundle kept temporarily for backward compatibility
export const getOpsBundleFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireRole('admin', 'manager')
    const [ops, users, liquor, grocery] = await Promise.all([
      loadOps(),
      getAdminUsersQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
    ])
    return { ops, users, liquor, grocery }
  },
)

// -------------------------------------------------------------
// OPERATIONS MUTATIONS WITH STRICT PERMISSION ENFORCEMENT
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
    return mutateOps((state) => {
      const order = state.orders.find((o) => o.id === data.id)
      if (!order) throw new Error('Order not found')
      if (data.status) {
        order.status = data.status as OrderStatus
        order.events.push({
          id: nid('ev'),
          at: new Date().toISOString(),
          status: order.status,
          note: `Status updated to ${data.status.replaceAll('_', ' ')}`,
          actor: user.name,
        })
      }
      if (data.riderId !== undefined) {
        order.riderId = data.riderId
        if (data.riderId)
          order.status =
            order.status === 'packing' || order.status === 'confirmed'
              ? 'assigned'
              : order.status
      }
      if (data.paymentStatus) {
        order.paymentStatus = data.paymentStatus as typeof order.paymentStatus
      }
      if (data.notes !== undefined) order.notes = data.notes
      order.updatedAt = new Date().toISOString()
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'orders',
        action: 'edit',
        detail: `Updated order ${order.number}`,
      })
      return state
    })
  })

export const createOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        customerName: z.string().min(1),
        customerEmail: z.string().email(),
        customerPhone: z.string().min(5),
        address: z.string().min(3),
        city: z.string().min(2),
        paymentMethod: z.enum(['cod', 'esewa', 'khalti', 'fonepay', 'connectips']),
        productId: z.string(),
        catalogType: z.enum(['liquor', 'grocery']),
        qty: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('orders', 'create')
    const [liquor, grocery] = await Promise.all([
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
    ])
    const product = (data.catalogType === 'liquor' ? liquor : grocery).find(
      (p) => p.id === data.productId,
    )
    if (!product) throw new Error('Product not found')
    const variant = product.variants[0]
    const lineTotal = variant.price * data.qty
    const deliveryCharge = 15000
    const tax = Math.round(lineTotal * 0.13)
    const now = new Date().toISOString()

    return mutateOps((state) => {
      const number = `${state.settings.invoicePrefix}-${String(10000 + state.orders.length + 1).padStart(5, '0')}`
      const order = {
        id: nid('ord'),
        number,
        customerId: nid('cust'),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        address: data.address,
        city: data.city,
        status: 'pending' as const,
        paymentMethod: data.paymentMethod as PaymentMethod,
        paymentStatus:
          data.paymentMethod === 'cod'
            ? ('cod_pending' as const)
            : ('pending' as const),
        subtotal: lineTotal,
        deliveryCharge,
        discount: 0,
        tax,
        total: lineTotal + deliveryCharge + tax,
        riderId: null,
        trackingCode: `TRK${Math.floor(100000 + Math.random() * 900000)}`,
        notes: '',
        couponCode: null,
        items: [
          {
            id: nid('oi'),
            catalogType: data.catalogType,
            productId: product.id,
            variantId: variant.id,
            name: product.name,
            variantName: variant.name,
            sku: variant.sku,
            qty: data.qty,
            unitPrice: variant.price,
            lineTotal,
          },
        ],
        events: [
          {
            id: nid('ev'),
            at: now,
            status: 'pending' as const,
            note: 'Order created in admin',
            actor: user.name,
          },
        ],
        createdAt: now,
        updatedAt: now,
      }
      state.orders.unshift(order)
      state.ledger.unshift({
        id: nid('led'),
        date: now.slice(0, 10),
        type: 'credit',
        category: 'sales',
        account: 'Sales revenue',
        memo: `Sale ${number}`,
        amount: lineTotal,
        refType: 'order',
        refId: order.id,
        createdAt: now,
      })
      state.notifications.unshift({
        id: nid('n'),
        title: `New order ${number}`,
        body: `${data.customerName} · ${product.name}`,
        type: 'order',
        read: false,
        href: `/admin/orders/${order.id}`,
        createdAt: now,
      })
      state.audit.unshift({
        id: nid('aud'),
        at: now,
        actor: user.name,
        module: 'orders',
        action: 'create',
        detail: `Created order ${number} for ${data.customerName}`,
      })
      return state
    })
  })

export const upsertRiderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(5),
        vehicle: z.enum(['bike', 'scooter', 'car']),
        licenseNo: z.string().min(2),
        zone: z.string().min(2),
        commissionRate: z.number().min(0).max(50),
        verified: z.boolean(),
        available: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('riders', action)
    return mutateOps((state) => {
      if (data.id) {
        const rider = state.riders.find((r) => r.id === data.id)
        if (!rider) throw new Error('Rider not found')
        Object.assign(rider, data)
      } else {
        state.riders.unshift({
          id: nid('rider'),
          userId: null,
          name: data.name,
          email: data.email,
          phone: data.phone,
          vehicle: data.vehicle,
          licenseNo: data.licenseNo,
          verified: data.verified,
          available: data.available,
          status: data.available ? 'available' : 'offline',
          lat: 27.7172,
          lng: 85.324,
          zone: data.zone,
          commissionRate: data.commissionRate,
          cashOnHand: 0,
          earnings: 0,
          deliveries: 0,
          rating: 5,
          createdAt: new Date().toISOString(),
        })
      }
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'riders',
        action,
        detail: `${action === 'create' ? 'Added' : 'Updated'} rider: ${data.name}`,
      })
      return state
    })
  })

export const updateRiderLiveFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        status: z.enum(['offline', 'available', 'busy']).optional(),
        available: z.boolean().optional(),
        verified: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('riders', 'edit')
    return mutateOps((state) => {
      const rider = state.riders.find((r) => r.id === data.id)
      if (!rider) throw new Error('Rider not found')
      if (data.lat !== undefined) rider.lat = data.lat
      if (data.lng !== undefined) rider.lng = data.lng
      if (data.status) rider.status = data.status
      if (data.available !== undefined) rider.available = data.available
      if (data.verified !== undefined) rider.verified = data.verified
      return state
    })
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
        account: z.string().min(1),
        memo: z.string().min(1),
        amount: z.number().int().positive(),
        date: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')
    return mutateOps((state) => {
      state.ledger.unshift({
        id: nid('led'),
        date: data.date,
        type: data.type,
        category: data.category,
        account: data.account,
        memo: data.memo,
        amount: data.amount,
        refType: 'manual',
        refId: null,
        createdAt: new Date().toISOString(),
      })
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'accounts',
        action: 'create',
        detail: `Added ledger ${data.type} entry of Rs. ${data.amount} for ${data.memo}`,
      })
      return state
    })
  })

export const upsertCouponFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        code: z.string().min(3),
        type: z.enum(['percent', 'fixed']),
        value: z.number().positive(),
        minOrder: z.number().min(0),
        usageLimit: z.number().int().positive(),
        expiresAt: z.string(),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('marketing', action)
    return mutateOps((state) => {
      if (data.id) {
        const row = state.coupons.find((c) => c.id === data.id)
        if (row) Object.assign(row, data)
      } else {
        state.coupons.unshift({
          id: nid('cp'),
          code: data.code.toUpperCase(),
          type: data.type,
          value: data.value,
          minOrder: data.minOrder,
          usageLimit: data.usageLimit,
          used: 0,
          active: data.active,
          expiresAt: data.expiresAt,
        })
      }
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'marketing',
        action,
        detail: `${action === 'create' ? 'Created' : 'Updated'} coupon: ${data.code}`,
      })
      return state
    })
  })

export const deleteCouponFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('marketing', 'delete')
    return mutateOps((state) => {
      state.coupons = state.coupons.filter((c) => c.id !== data.id)
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'marketing',
        action: 'delete',
        detail: `Deleted coupon ${data.id}`,
      })
      return state
    })
  })

export const upsertZoneFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2),
        areas: z.string().min(2),
        deliveryCharge: z.number().int().min(0),
        etaMinutes: z.number().int().positive(),
        active: z.boolean(),
        courier: z.enum(['in-house', 'ncm', 'pathao', 'none']),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('shipping', action)
    return mutateOps((state) => {
      if (data.id) {
        const row = state.zones.find((z) => z.id === data.id)
        if (row) Object.assign(row, data)
      } else {
        state.zones.unshift({ id: nid('z'), ...data })
      }
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'shipping',
        action,
        detail: `${action === 'create' ? 'Created' : 'Updated'} delivery zone: ${data.name}`,
      })
      return state
    })
  })

export const saveSettingsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        storeName: z.string(),
        legalName: z.string(),
        pan: z.string(),
        vat: z.string(),
        phone: z.string(),
        email: z.string(),
        address: z.string(),
        city: z.string(),
        invoicePrefix: z.string(),
        taxRate: z.number(),
        lowStockThreshold: z.number(),
        ageGate: z.boolean(),
        notifyEmail: z.boolean(),
        notifySms: z.boolean(),
        gateways: z.record(
          z.string(),
          z.object({
            enabled: z.boolean(),
            merchantId: z.string(),
            mode: z.enum(['sandbox', 'live']),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requireRole('admin')
    const next = await mutateOps((state) => {
      state.settings = { ...state.settings, ...data } as typeof state.settings
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'settings',
        action: 'edit',
        detail: 'Updated store configuration',
      })
      return state
    })
    return next.settings
  })

export const savePermissionsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        userId: z.string(),
        grants: z.record(z.string(), z.array(z.string())),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requireRole('admin')
    return mutateOps((state) => {
      state.permissions[data.userId] = data.grants as (typeof state.permissions)[string]
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'staff',
        action: 'edit',
        detail: `Updated RBAC grants for ${data.userId}`,
      })
      return state
    })
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
    return mutateOps((state) => {
      const row = state.reviews.find((r) => r.id === data.id)
      if (row) row.status = data.status
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'marketing',
        action: 'edit',
        detail: `Updated review ${data.id} status to ${data.status}`,
      })
      return state
    })
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
    return mutateOps((state) => {
      const row = state.complaints.find((c) => c.id === data.id)
      if (row) row.status = data.status
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'customers',
        action: 'edit',
        detail: `Updated complaint ${data.id} status to ${data.status}`,
      })
      return state
    })
  })

export const approveSettlementFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ id: z.string(), status: z.enum(['approved', 'paid']) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    return mutateOps((state) => {
      const row = state.settlements.find((s) => s.id === data.id)
      if (row) row.status = data.status
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'accounts',
        action: 'approve',
        detail: `Settlement ${data.id} updated to ${data.status}`,
      })
      return state
    })
  })

export const reconcilePaymentFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('payments', 'approve')
    return mutateOps((state) => {
      const row = state.payments.find((p) => p.id === data.id)
      if (row) row.status = 'reconciled'
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'payments',
        action: 'approve',
        detail: `Reconciled payment transaction ${data.id}`,
      })
      return state
    })
  })

export const upsertBannerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        title: z.string().min(2),
        imageUrl: z.string().url(),
        href: z.string(),
        placement: z.enum(['home', 'drinks', 'grocery']),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const action = data.id ? 'edit' : 'create'
    const { user } = await requirePermission('marketing', action)
    return mutateOps((state) => {
      if (data.id) {
        const row = state.banners.find((b) => b.id === data.id)
        if (row) Object.assign(row, data)
      } else {
        state.banners.unshift({ id: nid('bn'), ...data })
      }
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'marketing',
        action,
        detail: `${action === 'create' ? 'Created' : 'Updated'} banner: ${data.title}`,
      })
      return state
    })
  })

export const deleteBannerFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { user } = await requirePermission('marketing', 'delete')
    return mutateOps((state) => {
      state.banners = state.banners.filter((b) => b.id !== data.id)
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: user.name,
        module: 'marketing',
        action: 'delete',
        detail: `Deleted banner ${data.id}`,
      })
      return state
    })
  })

export const resetOpsFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { user } = await requireRole('admin')
    const [liquor, grocery, users] = await Promise.all([
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
    ])
    const fresh = seedOpsFromCatalog({ liquor, grocery, users })
    await logAudit(
      user.name,
      'settings',
      'delete',
      'Reset operations mock state to initial catalog seed',
    )
    return saveOps(fresh)
  },
)

export { MODULES, ACTIONS }


// --- RIDER FUNCTIONS (ROW-LEVEL SCOPED) ---

// -------------------------------------------------------------
// RIDER PORTAL SERVER FUNCTIONS (ROW-LEVEL SCOPED)
// -------------------------------------------------------------

export const getRiderPortalFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getSessionUser()
    if (!user.isActive || user.banned) {
      throw new Error('Forbidden: Account suspended')
    }
    if (user.role !== 'rider' && user.role !== 'admin') {
      throw new Error('Forbidden: Rider access required')
    }

    const ops = await loadOps()

    let rider = ops.riders.find(
      (r) =>
        (r.userId && r.userId === user.id) ||
        (user.email && r.email.toLowerCase() === user.email.toLowerCase()),
    )

    if (!rider) {
      // Auto-provision a rider profile for the logged in user with rider role
      const newRider: Rider = {
        id: nid('rid'),
        userId: user.id,
        name: user.name || 'Rider Partner',
        email: user.email || '',
        phone: '+977 9800000000',
        vehicle: 'bike',
        licenseNo: 'BA-2-PA-9999',
        verified: true,
        available: true,
        status: 'available',
        lat: 27.7172,
        lng: 85.324,
        zone: 'Kathmandu Core',
        commissionRate: 85,
        cashOnHand: 0,
        earnings: 0,
        deliveries: 0,
        rating: 5.0,
        createdAt: new Date().toISOString(),
      }

      await mutateOps((state) => {
        state.riders.push(newRider)
        return state
      })
      rider = newRider
    }

    const currentRider = rider as Rider

    // STRICT ROW-LEVEL SCOPE: ONLY orders assigned to THIS rider
    const assignedOrders = ops.orders.filter((o) => o.riderId === currentRider.id)

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
    if (user.role !== 'rider' && user.role !== 'admin') {
      throw new Error('Forbidden: Rider access required')
    }

    const ops = await loadOps()
    const rider = ops.riders.find(
      (r) =>
        (r.userId && r.userId === user.id) ||
        (user.email && r.email.toLowerCase() === user.email.toLowerCase()),
    )
    if (!rider) throw new Error('Rider profile not found')

    return mutateOps((state) => {
      const order = state.orders.find((o) => o.id === data.orderId)
      if (!order) throw new Error('Order not found')

      // ENFORCE: Rider can ONLY update their own assigned orders
      if (order.riderId !== rider.id && user.role !== 'admin') {
        throw new Error('Forbidden: You are not assigned to this delivery')
      }

      const now = new Date().toISOString()
      order.status = data.status
      order.updatedAt = now

      const currentRider = state.riders.find((r) => r.id === rider.id)

      if (data.status === 'out_for_delivery') {
        if (currentRider) currentRider.status = 'busy'
        order.events.push({
          id: nid('evt'),
          at: now,
          status: 'out_for_delivery',
          note: data.notes || `Rider ${rider.name} started delivery`,
          actor: rider.name,
        })
      } else if (data.status === 'delivered') {
        if (currentRider) {
          currentRider.deliveries += 1
          const commission = Math.round(
            order.deliveryCharge * (currentRider.commissionRate / 100),
          )
          currentRider.earnings += commission

          if (order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') {
            order.paymentStatus = 'paid'
            currentRider.cashOnHand += order.total
          }

          const hasMore = state.orders.some(
            (o) =>
              o.riderId === rider.id &&
              ['assigned', 'out_for_delivery'].includes(o.status) &&
              o.id !== order.id,
          )
          currentRider.status = hasMore
            ? 'busy'
            : currentRider.available
              ? 'available'
              : 'offline'
        }

        order.events.push({
          id: nid('evt'),
          at: now,
          status: 'delivered',
          note: data.notes || `Delivered by rider ${rider.name}`,
          actor: rider.name,
        })
      }

      state.audit.unshift({
        id: nid('aud'),
        at: now,
        actor: rider.name,
        module: 'riders',
        action: 'edit',
        detail: `Rider ${rider.name} marked order ${order.number} as ${data.status}`,
      })

      return state
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
    if (user.role !== 'rider' && user.role !== 'admin') {
      throw new Error('Forbidden: Rider access required')
    }

    return mutateOps((state) => {
      const rider = state.riders.find(
        (r) =>
          (r.userId && r.userId === user.id) ||
          (user.email && r.email.toLowerCase() === user.email.toLowerCase()),
      )
      if (!rider) throw new Error('Rider profile not found')

      rider.available = data.available
      const hasActive = state.orders.some(
        (o) =>
          o.riderId === rider.id &&
          ['assigned', 'out_for_delivery'].includes(o.status),
      )
      rider.status = data.available
        ? hasActive
          ? 'busy'
          : 'available'
        : 'offline'

      return state
    })
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
    if (user.role !== 'rider' && user.role !== 'admin') {
      throw new Error('Forbidden: Rider access required')
    }

    return mutateOps((state) => {
      const rider = state.riders.find(
        (r) =>
          (r.userId && r.userId === user.id) ||
          (user.email && r.email.toLowerCase() === user.email.toLowerCase()),
      )
      if (!rider) throw new Error('Rider profile not found')
      if (rider.cashOnHand < data.amount) {
        throw new Error('Deposit amount exceeds cash on hand')
      }

      rider.cashOnHand -= data.amount
      const now = new Date().toISOString()

      state.ledger.unshift({
        id: nid('led'),
        date: now,
        type: 'credit',
        category: 'settlement',
        account: 'Cash In Hand (Fleet)',
        memo: data.note || `Cash float deposit from rider ${rider.name}`,
        amount: data.amount,
        refType: 'settlement',
        refId: rider.id,
        createdAt: now,
      })

      state.audit.unshift({
        id: nid('aud'),
        at: now,
        actor: rider.name,
        module: 'accounts',
        action: 'create',
        detail: `Rider ${rider.name} submitted cash deposit NPR ${(data.amount / 100).toFixed(2)}`,
      })

      return state
    })
  })
