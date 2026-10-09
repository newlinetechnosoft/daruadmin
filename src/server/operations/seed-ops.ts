import type {
  LedgerEntry,
  NotificationItem,
  OpsState,
  Order,
  OrderStatus,
  PaymentMethod,
  Rider,
  StoreSettings,
} from './types'

export function defaultSettings(): StoreSettings {
  return {
    storeName: 'Mezmani',
    legalName: 'Mezmani Retail Pvt. Ltd.',
    pan: '123456789',
    vat: 'NP-VAT-001',
    phone: '+977-9800000000',
    email: 'ops@mezmani.com.np',
    address: 'Durbar Marg, Kathmandu',
    city: 'Kathmandu',
    invoicePrefix: 'MZ',
    taxRate: 13,
    lowStockThreshold: 20,
    ageGate: true,
    notifyEmail: true,
    notifySms: false,
    gateways: {
      cod: { enabled: true, merchantId: '', mode: 'live' },
      esewa: { enabled: false, merchantId: '', mode: 'sandbox' },
      khalti: { enabled: false, merchantId: '', mode: 'sandbox' },
      fonepay: { enabled: false, merchantId: '', mode: 'sandbox' },
      connectips: { enabled: false, merchantId: '', mode: 'sandbox' },
    },
  }
}

type CatalogProduct = {
  id: string
  name: string
  isFeatured: boolean
  variants: {
    id: string
    name: string
    sku: string
    price: number
    stock: number
  }[]
}

type UserRow = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string | null
}

const STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'packing',
  'assigned',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
]

const PAYMENTS: PaymentMethod[] = ['cod', 'esewa', 'khalti', 'fonepay']

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length]
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export function defaultOpsState(): OpsState {
  return {
    orders: [],
    riders: [],
    complaints: [],
    ledger: [],
    settlements: [],
    payments: [],
    coupons: [],
    banners: [],
    campaigns: [],
    reviews: [],
    zones: [],
    notifications: [],
    audit: [],
    permissions: {},
    settings: defaultSettings(),
  }
}

export function seedOpsFromCatalog(input: {
  liquor: CatalogProduct[]
  grocery: CatalogProduct[]
  users: UserRow[]
  base?: OpsState
}): OpsState {
  const state = input.base ? { ...defaultOpsState(), ...input.base } : defaultOpsState()
  const catalog: Array<CatalogProduct & { catalogType: 'liquor' | 'grocery' }> = [
    ...input.liquor.map((p) => ({ ...p, catalogType: 'liquor' as const })),
    ...input.grocery.map((p) => ({ ...p, catalogType: 'grocery' as const })),
  ].filter((p) => p.variants.length > 0)

  const customers = input.users.filter(
    (u) => !u.role || u.role === 'customer' || u.role === 'user',
  )
  const customerPool =
    customers.length > 0
      ? customers
      : input.users.length > 0
        ? input.users
        : [
            {
              id: 'walk-in',
              name: 'Walk-in Guest',
              email: 'guest@mezmani.com.np',
              phone: '+977-9801112233',
              role: 'customer',
            },
          ]

  const riderUsers = input.users.filter((u) => u.role === 'rider')
  const riderSeeds: Rider[] = (
    riderUsers.length > 0
      ? riderUsers
      : [
          {
            id: 'r1',
            name: 'Bikash Tamang',
            email: 'bikash.rider@mezmani.com.np',
            phone: '9801110001',
            role: 'rider',
          },
          {
            id: 'r2',
            name: 'Sujan Magar',
            email: 'sujan.rider@mezmani.com.np',
            phone: '9801110002',
            role: 'rider',
          },
          {
            id: 'r3',
            name: 'Anisha Shrestha',
            email: 'anisha.rider@mezmani.com.np',
            phone: '9801110003',
            role: 'rider',
          },
          {
            id: 'r4',
            name: 'Prakash Gurung',
            email: 'prakash.rider@mezmani.com.np',
            phone: '9801110004',
            role: 'rider',
          },
        ]
  ).map((u, i) => ({
    id: u.id,
    userId: riderUsers.length > 0 ? u.id : null,
    name: u.name,
    email: u.email,
    phone: u.phone || `980111000${i + 1}`,
    vehicle: pick(['bike', 'scooter', 'bike', 'car'] as const, i),
    licenseNo: `BAG-${1200 + i}`,
    verified: i !== 3,
    available: i !== 2,
    status: pick(['available', 'busy', 'available', 'offline'] as const, i),
    lat: 27.7172 + (i - 1.5) * 0.012,
    lng: 85.324 + (i - 1.2) * 0.01,
    zone: pick(
      ['Kathmandu Central', 'Lalitpur', 'Bhaktapur', 'Budhanilkantha'],
      i,
    ),
    commissionRate: 8 + (i % 3),
    cashOnHand: (12000 + i * 3500) * 100,
    earnings: (48000 + i * 12000) * 100,
    deliveries: 40 + i * 17,
    rating: 4.4 + (i % 5) * 0.1,
    createdAt: daysAgo(40 - i * 5),
  }))

  const orders: Order[] = []
  const orderCount = Math.min(42, Math.max(12, catalog.length * 2))

  for (let i = 0; i < orderCount; i++) {
    const customer = pick(customerPool, i)
    const product = pick(catalog, i)
    const extra = pick(catalog, i + 3)
    const variant = product.variants[0]
    const extraVar = extra.variants[0]
    const qty = 1 + (i % 3)
    const extraQty = i % 2
    const items = [
      {
        id: `oi_${i}_a`,
        catalogType: product.catalogType,
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        variantName: variant.name,
        sku: variant.sku,
        qty,
        unitPrice: variant.price,
        lineTotal: variant.price * qty,
      },
    ]
    if (extraQty && extra.id !== product.id) {
      items.push({
        id: `oi_${i}_b`,
        catalogType: extra.catalogType,
        productId: extra.id,
        variantId: extraVar.id,
        name: extra.name,
        variantName: extraVar.name,
        sku: extraVar.sku,
        qty: extraQty,
        unitPrice: extraVar.price,
        lineTotal: extraVar.price * extraQty,
      })
    }
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0)
    const deliveryCharge = 15000 + (i % 3) * 5000
    const discount = i % 5 === 0 ? Math.round(subtotal * 0.08) : 0
    const tax = Math.round((subtotal - discount) * 0.13)
    const total = subtotal + deliveryCharge + tax - discount
    const status = pick(STATUSES, i)
    const paymentMethod = pick(PAYMENTS, i)
    const rider =
      ['assigned', 'out_for_delivery', 'delivered'].includes(status)
        ? pick(riderSeeds, i)
        : null
    const createdAt = daysAgo(orderCount - i)
    const number = `MZ-${String(10420 + i).padStart(5, '0')}`

    orders.push({
      id: `ord_${i + 1}`,
      number,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || '9800000000',
      address: pick(
        [
          'Thamel Marg, Ward 26',
          'Jawalakhel, Lalitpur',
          'Suryabinayak, Bhaktapur',
          'Baluwatar Heights',
          'New Baneshwor',
        ],
        i,
      ),
      city: pick(['Kathmandu', 'Lalitpur', 'Bhaktapur'], i),
      status,
      paymentMethod,
      paymentStatus:
        status === 'refunded'
          ? 'refunded'
          : paymentMethod === 'cod'
            ? status === 'delivered'
              ? 'paid'
              : 'cod_pending'
            : status === 'cancelled'
              ? 'failed'
              : 'paid',
      subtotal,
      deliveryCharge,
      discount,
      tax,
      total,
      riderId: rider?.id ?? null,
      trackingCode: `TRK${900000 + i}`,
      notes: i % 7 === 0 ? 'Call before delivery. Age verification required.' : '',
      couponCode: i % 5 === 0 ? 'WELCOME10' : null,
      items,
      events: [
        {
          id: `ev_${i}_1`,
          at: createdAt,
          status: 'pending',
          note: 'Order placed',
          actor: 'system',
        },
        {
          id: `ev_${i}_2`,
          at: createdAt,
          status,
          note: `Status set to ${status.replaceAll('_', ' ')}`,
          actor: 'ops',
        },
      ],
      createdAt,
      updatedAt: createdAt,
    })
  }

  const ledger: LedgerEntry[] = []
  for (const order of orders) {
    if (order.status === 'cancelled') continue
    ledger.push({
      id: `led_${order.id}_sale`,
      date: order.createdAt.slice(0, 10),
      type: 'credit',
      category: 'sales',
      account: 'Sales revenue',
      memo: `Sale ${order.number}`,
      amount: order.subtotal,
      refType: 'order',
      refId: order.id,
      createdAt: order.createdAt,
    })
    ledger.push({
      id: `led_${order.id}_del`,
      date: order.createdAt.slice(0, 10),
      type: 'credit',
      category: 'delivery',
      account: 'Delivery income',
      memo: `Delivery ${order.number}`,
      amount: order.deliveryCharge,
      refType: 'order',
      refId: order.id,
      createdAt: order.createdAt,
    })
    if (order.status === 'refunded' || order.status === 'returned') {
      ledger.push({
        id: `led_${order.id}_ref`,
        date: order.createdAt.slice(0, 10),
        type: 'debit',
        category: 'refund',
        account: 'Refunds',
        memo: `Refund ${order.number}`,
        amount: order.total,
        refType: 'refund',
        refId: order.id,
        createdAt: order.createdAt,
      })
    }
  }

  ledger.push(
    {
      id: 'led_rent',
      date: daysAgo(12).slice(0, 10),
      type: 'debit',
      category: 'expense',
      account: 'Hub rent',
      memo: 'Kathmandu central hub rent',
      amount: 8500000,
      refType: 'manual',
      refId: null,
      createdAt: daysAgo(12),
    },
    {
      id: 'led_purchase',
      date: daysAgo(8).slice(0, 10),
      type: 'debit',
      category: 'purchase',
      account: 'Inventory purchases',
      memo: 'Weekly liquor restock — Surkhet & KTM suppliers',
      amount: 24500000,
      refType: 'manual',
      refId: null,
      createdAt: daysAgo(8),
    },
    {
      id: 'led_salary',
      date: daysAgo(3).slice(0, 10),
      type: 'debit',
      category: 'expense',
      account: 'Payroll',
      memo: 'Rider & staff weekly payroll',
      amount: 12600000,
      refType: 'manual',
      refId: null,
      createdAt: daysAgo(3),
    },
  )

  const notifications: NotificationItem[] = [
    {
      id: 'n1',
      title: 'Low stock alert',
      body: 'Multiple SKUs are at or below the 20-unit threshold.',
      type: 'stock',
      read: false,
      href: '/admin/liquor',
      createdAt: daysAgo(0),
    },
    {
      id: 'n2',
      title: 'COD pending collection',
      body: 'Riders hold unreconciled cash that needs settlement.',
      type: 'finance',
      read: false,
      href: '/admin/accounts',
      createdAt: daysAgo(1),
    },
    {
      id: 'n3',
      title: 'New order in packing',
      body: 'Kitchen and dispatch have orders waiting for rider assignment.',
      type: 'order',
      read: true,
      href: '/admin/orders',
      createdAt: daysAgo(1),
    },
  ]

  return {
    ...state,
    orders,
    riders: riderSeeds,
    ledger,
    complaints: [
      {
        id: 'cmp_1',
        customerId: customerPool[0].id,
        customerName: customerPool[0].name,
        orderId: orders[0]?.id ?? null,
        subject: 'Late evening delivery',
        body: 'Order arrived after the promised 45-minute window.',
        status: 'open',
        createdAt: daysAgo(2),
      },
      {
        id: 'cmp_2',
        customerId: pick(customerPool, 2).id,
        customerName: pick(customerPool, 2).name,
        orderId: orders[4]?.id ?? null,
        subject: 'Wrong variant delivered',
        body: 'Received 375 ml instead of 750 ml. Requesting replacement.',
        status: 'in_progress',
        createdAt: daysAgo(5),
      },
    ],
    settlements: riderSeeds.map((r, i) => ({
      id: `set_${i}`,
      riderId: r.id,
      riderName: r.name,
      periodStart: daysAgo(7).slice(0, 10),
      periodEnd: daysAgo(0).slice(0, 10),
      deliveries: 8 + i * 2,
      cashCollected: r.cashOnHand,
      commission: Math.round(r.cashOnHand * (r.commissionRate / 100)),
      payout: Math.round(r.earnings / 8),
      status: pick(['draft', 'approved', 'paid'] as const, i),
      createdAt: daysAgo(1),
    })),
    payments: orders
      .filter((o) => o.paymentMethod !== 'cod')
      .slice(0, 18)
      .map((o) => ({
        id: `pay_${o.id}`,
        orderId: o.id,
        gateway: o.paymentMethod,
        amount: o.total,
        status: o.paymentStatus === 'paid' ? 'success' : 'initiated',
        reference: `${o.paymentMethod.toUpperCase()}-${o.number}`,
        createdAt: o.createdAt,
      })),
    coupons: [
      {
        id: 'cp_1',
        code: 'WELCOME10',
        type: 'percent',
        value: 10,
        minOrder: 200000,
        usageLimit: 500,
        used: orders.filter((o) => o.couponCode === 'WELCOME10').length,
        active: true,
        expiresAt: daysAgo(-40).slice(0, 10),
      },
      {
        id: 'cp_2',
        code: 'DASHAIN250',
        type: 'fixed',
        value: 25000,
        minOrder: 500000,
        usageLimit: 200,
        used: 12,
        active: true,
        expiresAt: daysAgo(-20).slice(0, 10),
      },
    ],
    banners: [
      {
        id: 'bn_1',
        title: 'Friday night delivery',
        imageUrl:
          'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80',
        href: '/drinks',
        placement: 'home',
        active: true,
      },
    ],
    campaigns: [
      {
        id: 'camp_1',
        name: 'Dashain restock SMS',
        channel: 'sms',
        status: 'scheduled',
        audience: 'Customers in Kathmandu',
        scheduledAt: daysAgo(-2),
        body: 'Mezmani: pre-order whiskey & mixers for Dashain. 60-min delivery.',
      },
    ],
    reviews: catalog.slice(0, 6).map((p, i) => ({
      id: `rv_${i}`,
      productName: p.name,
      customerName: pick(customerPool, i).name,
      rating: 4 + (i % 2),
      body: 'Fast delivery and well packed. Will order again.',
      status: i === 0 ? 'pending' : 'published',
      createdAt: daysAgo(i + 1),
    })),
    zones: [
      {
        id: 'z1',
        name: 'Kathmandu Central',
        areas: 'Thamel, Durbar Marg, New Road, Lazimpat',
        deliveryCharge: 15000,
        etaMinutes: 45,
        active: true,
        courier: 'in-house',
      },
      {
        id: 'z2',
        name: 'Lalitpur',
        areas: 'Jawalakhel, Patan, Kupondole',
        deliveryCharge: 20000,
        etaMinutes: 55,
        active: true,
        courier: 'in-house',
      },
      {
        id: 'z3',
        name: 'Bhaktapur',
        areas: 'Suryabinayak, Kamalbinayak',
        deliveryCharge: 25000,
        etaMinutes: 75,
        active: true,
        courier: 'ncm',
      },
    ],
    notifications,
    audit: [
      {
        id: 'aud_1',
        at: daysAgo(0),
        actor: 'admin',
        module: 'orders',
        action: 'seed',
        detail: 'Operational dataset generated from live catalog inventory',
      },
    ],
    permissions: {},
    settings: defaultSettings(),
  }
}
