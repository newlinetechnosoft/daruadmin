import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAdmin, getServerSession } from '../middleware/auth'
import {
  getAdminGroceryProductsQuery,
  getAdminLiquorProductsQuery,
  getAdminStatsQuery,
  getAdminUsersQuery,
} from '#/server/catalog/catalog.queries'
import { loadOps, mutateOps, nid } from './store'
import type {
  ActionKey,
  DateRangeKey,
  ModuleKey,
  OrderStatus,
  PaymentMethod,
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

const DEFAULT_MANAGER: Record<ModuleKey, ActionKey[]> = {
  dashboard: ['view'],
  products: ['view', 'create', 'edit'],
  orders: ['view', 'edit', 'approve'],
  customers: ['view', 'edit'],
  riders: ['view', 'edit'],
  staff: ['view'],
  accounts: ['view', 'export'],
  payments: ['view'],
  shipping: ['view', 'edit'],
  marketing: ['view', 'create', 'edit'],
  reports: ['view', 'export'],
  settings: ['view'],
}

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
    await requireAdmin()
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

export const getOpsBundleFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    const [ops, users, liquor, grocery] = await Promise.all([
      loadOps(),
      getAdminUsersQuery(),
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
    ])
    return { ops, users, liquor, grocery }
  },
)

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
    const session = await requireAdmin()
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
          actor: session.user.name,
        })
      }
      if (data.riderId !== undefined) {
        order.riderId = data.riderId
        if (data.riderId) order.status = order.status === 'packing' || order.status === 'confirmed' ? 'assigned' : order.status
      }
      if (data.paymentStatus) {
        order.paymentStatus = data.paymentStatus as typeof order.paymentStatus
      }
      if (data.notes !== undefined) order.notes = data.notes
      order.updatedAt = new Date().toISOString()
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: session.user.name,
        module: 'orders',
        action: 'edit',
        detail: `Updated ${order.number}`,
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
    const session = await requireAdmin()
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
          data.paymentMethod === 'cod' ? ('cod_pending' as const) : ('pending' as const),
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
            actor: session.user.name,
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
    await requireAdmin()
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
    await requireAdmin()
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
    await requireAdmin()
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
    await requireAdmin()
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
    await requireAdmin()
    return mutateOps((state) => {
      if (data.id) {
        const row = state.zones.find((z) => z.id === data.id)
        if (row) Object.assign(row, data)
      } else {
        state.zones.unshift({ id: nid('z'), ...data })
      }
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
    await requireAdmin()
    return mutateOps((state) => {
      state.settings = { ...state.settings, ...data } as typeof state.settings
      return state
    })
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
    await requireAdmin()
    return mutateOps((state) => {
      state.permissions[data.userId] = data.grants as (typeof state.permissions)[string]
      state.audit.unshift({
        id: nid('aud'),
        at: new Date().toISOString(),
        actor: 'admin',
        module: 'staff',
        action: 'edit',
        detail: `Updated permissions for ${data.userId}`,
      })
      return state
    })
  })

export const markNotificationsFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireAdmin()
    return mutateOps((state) => {
      state.notifications = state.notifications.map((n) => ({ ...n, read: true }))
      return state
    })
  },
)

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
    await requireAdmin()
    return mutateOps((state) => {
      const row = state.reviews.find((r) => r.id === data.id)
      if (row) row.status = data.status
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
    await requireAdmin()
    return mutateOps((state) => {
      const row = state.complaints.find((c) => c.id === data.id)
      if (row) row.status = data.status
      return state
    })
  })

export const approveSettlementFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ id: z.string(), status: z.enum(['approved', 'paid']) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    return mutateOps((state) => {
      const row = state.settlements.find((s) => s.id === data.id)
      if (row) row.status = data.status
      return state
    })
  })

export const reconcilePaymentFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    return mutateOps((state) => {
      const row = state.payments.find((p) => p.id === data.id)
      if (row) row.status = 'reconciled'
      return state
    })
  })

export const globalSearchFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ q: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin()
    const q = data.q.trim().toLowerCase()
    if (q.length < 2) return { products: [], orders: [], customers: [], riders: [] }
    const [liquor, grocery, users, ops] = await Promise.all([
      getAdminLiquorProductsQuery(),
      getAdminGroceryProductsQuery(),
      getAdminUsersQuery(),
      loadOps(),
    ])
    const products = [...liquor, ...grocery]
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        name: p.name,
        href: 'categoryName' in p ? '/admin/liquor' : '/admin/grocery',
      }))
    return {
      products,
      orders: ops.orders
        .filter(
          (o) =>
            o.number.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q),
        )
        .slice(0, 6)
        .map((o) => ({
          id: o.id,
          name: `${o.number} · ${o.customerName}`,
          href: `/admin/orders/${o.id}`,
        })),
      customers: users
        .filter(
          (u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
        .slice(0, 6)
        .map((u) => ({
          id: u.id,
          name: u.name,
          href: '/admin/customers',
        })),
      riders: ops.riders
        .filter((r) => r.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map((r) => ({ id: r.id, name: r.name, href: '/admin/riders' })),
    }
  })

export const getAdminChromeFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    const ops = await loadOps()
    return {
      unread: ops.notifications.filter((n) => !n.read).length,
      notifications: ops.notifications.slice(0, 8),
    }
  },
)

export const getStaffSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getServerSession()
    if (!session?.user) {
      return { authenticated: false, isStaff: false, user: null, grants: {} }
    }
    const user = session.user as typeof session.user & { role?: string }
    const role = user.role || 'customer'
    const isStaff = role === 'admin' || role === 'manager'
    const ops = isStaff ? await loadOps() : null
    const grants =
      role === 'admin'
        ? Object.fromEntries(MODULES.map((m) => [m, ACTIONS]))
        : (ops?.permissions[user.id] ?? DEFAULT_MANAGER)
    return {
      authenticated: true,
      isStaff,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
      grants,
    }
  },
)

export { MODULES, ACTIONS }
