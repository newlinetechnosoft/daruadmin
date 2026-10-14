export const MODULES = [
  'dashboard',
  'liquor',
  'grocery',
  'categories',
  'brands',
  'products', // legacy/umbrella
  'orders',
  'customers',
  'inventory',
  'riders',
  'staff',
  'users',
  'shipping',
  'accounts',
  'payments',
  'marketing',
  'reports',
  'settings',
] as const

export type ModuleKey = (typeof MODULES)[number]
export type ActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'approve'

export const ACTIONS: ActionKey[] = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'approve',
]

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  section: string
}

export interface PermissionSection {
  name: string
  description: string
  modules: ModuleDefinition[]
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    name: 'Overview',
    description: 'Executive dashboard, KPI cards and operational summaries',
    modules: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        description:
          'View administrative metrics, revenue stats, and system highlights',
        section: 'Overview',
      },
    ],
  },
  {
    name: 'Catalog',
    description:
      'Products, categories, brands, variants, and liquor metadata',
    modules: [
      {
        key: 'liquor',
        label: 'Liquor',
        description:
          'Manage liquor bottles, spirit variants, ABV, pricing, and media',
        section: 'Catalog',
      },
      {
        key: 'grocery',
        label: 'Grocery',
        description:
          'Manage grocery items, pack sizes, inventory variants, and pricing',
        section: 'Catalog',
      },
      {
        key: 'categories',
        label: 'Categories',
        description:
          'Create and configure liquor and grocery item categories',
        section: 'Catalog',
      },
      {
        key: 'brands',
        label: 'Brands',
        description:
          'Manage liquor distilleries, grocery brands, logos and manufacturer profiles',
        section: 'Catalog',
      },
    ],
  },
  {
    name: 'Commerce',
    description:
      'Customer transactions, order processing, and warehouse inventory',
    modules: [
      {
        key: 'orders',
        label: 'Orders',
        description:
          'Fulfill, assign, modify order statuses, refunds, and line items',
        section: 'Commerce',
      },
      {
        key: 'customers',
        label: 'Customers',
        description:
          'Customer profiles, order histories, phone records, and notes',
        section: 'Commerce',
      },
      {
        key: 'inventory',
        label: 'Inventory',
        description:
          'Real-time stock on hand, restock purchasing, and low-stock alerts',
        section: 'Commerce',
      },
    ],
  },
  {
    name: 'Operations',
    description: 'Logistics fleet, team access controls, and delivery zones',
    modules: [
      {
        key: 'riders',
        label: 'Riders',
        description:
          'Manage delivery fleet, payout rates, shifts, and online status',
        section: 'Operations',
      },
      {
        key: 'staff',
        label: 'Staff & RBAC',
        description:
          'Configure staff accounts, role assignments, and granular permissions',
        section: 'Operations',
      },
      {
        key: 'users',
        label: 'System Users',
        description:
          'Browse all registered customer and staff accounts in the system',
        section: 'Operations',
      },
      {
        key: 'shipping',
        label: 'Shipping',
        description:
          'Configure delivery zones, base delivery charges, and distance fees',
        section: 'Operations',
      },
    ],
  },
  {
    name: 'Finance',
    description: 'Double-entry ledger, settlements, and payment gateways',
    modules: [
      {
        key: 'accounts',
        label: 'Accounts',
        description:
          'General ledger, COGS tracking, expense logging, and balance sheets',
        section: 'Finance',
      },
      {
        key: 'payments',
        label: 'Payments',
        description:
          'Gateway reconciliation (eSewa, Khalti, COD), refunds, and dispute logs',
        section: 'Finance',
      },
    ],
  },
  {
    name: 'Growth',
    description: 'Discounts, promotional campaigns, and financial analytics',
    modules: [
      {
        key: 'marketing',
        label: 'Marketing',
        description:
          'Create and manage coupon codes, promotional banners, and discount rules',
        section: 'Growth',
      },
      {
        key: 'reports',
        label: 'Reports',
        description:
          'Download and export sales, inventory, and tax compliance reports',
        section: 'Growth',
      },
    ],
  },
  {
    name: 'System',
    description: 'Global configuration, operating hours, and store rules',
    modules: [
      {
        key: 'settings',
        label: 'Settings',
        description:
          'Store contact details, delivery boundaries, age policy, and preferences',
        section: 'System',
      },
    ],
  },
]

export type DateRangeKey = '7d' | '30d' | '90d' | 'ytd' | 'custom'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packing'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded'

export type PaymentMethod =
  'cod' | 'esewa' | 'khalti' | 'fonepay' | 'connectips'

export interface OrderItem {
  id: string
  catalogType: 'liquor' | 'grocery'
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface OrderEvent {
  id: string
  at: string
  status: OrderStatus
  note: string
  actor: string
}

export interface Order {
  id: string
  number: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  address: string
  city: string
  landmark?: string | null
  lat?: number | null
  lng?: number | null
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'cod_pending'
  subtotal: number
  deliveryCharge: number
  discount: number
  tax: number
  total: number
  riderId: string | null
  trackingCode: string
  notes: string
  couponCode: string | null
  idempotencyKey?: string | null
  items: OrderItem[]
  events: OrderEvent[]
  createdAt: string
  updatedAt: string
}

export interface Rider {
  id: string
  userId: string | null
  name: string
  email: string
  phone: string
  vehicle: 'bike' | 'scooter' | 'car'
  licenseNo: string
  verified: boolean
  available: boolean
  status: 'offline' | 'available' | 'busy'
  lat: number
  lng: number
  zone: string
  commissionRate: number
  cashOnHand: number
  earnings: number
  deliveries: number
  rating: number
  createdAt: string
}

export interface Complaint {
  id: string
  customerId: string
  customerName: string
  orderId: string | null
  subject: string
  body: string
  status: 'open' | 'in_progress' | 'resolved'
  createdAt: string
}

export interface LedgerEntry {
  id: string
  date: string
  type: 'debit' | 'credit'
  category:
    | 'sales'
    | 'purchase'
    | 'expense'
    | 'refund'
    | 'cod'
    | 'settlement'
    | 'tax'
    | 'delivery'
    | 'other'
  account: string
  memo: string
  amount: number
  refType: 'order' | 'settlement' | 'manual' | 'refund'
  refId: string | null
  createdAt: string
}

export interface Settlement {
  id: string
  riderId: string
  riderName: string
  periodStart: string
  periodEnd: string
  deliveries: number
  cashCollected: number
  commission: number
  payout: number
  status: 'draft' | 'approved' | 'paid'
  createdAt: string
}

export interface PaymentTxn {
  id: string
  orderId: string
  gateway: PaymentMethod
  amount: number
  status: 'initiated' | 'success' | 'failed' | 'reconciled'
  reference: string
  createdAt: string
}

export interface Coupon {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  minOrder: number
  usageLimit: number
  used: number
  active: boolean
  expiresAt: string
}

export interface Banner {
  id: string
  title: string
  imageUrl: string
  href: string
  placement: 'home' | 'drinks' | 'grocery'
  active: boolean
}

export interface Campaign {
  id: string
  name: string
  channel: 'sms' | 'email' | 'push' | 'in-app'
  status: 'draft' | 'scheduled' | 'sent'
  audience: string
  scheduledAt: string
  body: string
}

export interface Review {
  id: string
  productName: string
  customerName: string
  rating: number
  body: string
  status: 'pending' | 'published' | 'hidden'
  createdAt: string
}

export interface Zone {
  id: string
  name: string
  areas: string
  deliveryCharge: number
  etaMinutes: number
  active: boolean
  courier: 'in-house' | 'ncm' | 'pathao' | 'none'
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  type: 'order' | 'stock' | 'rider' | 'finance' | 'system'
  read: boolean
  href: string
  createdAt: string
}

export interface AuditLog {
  id: string
  at: string
  actor: string
  module: string
  action: string
  detail: string
}

export interface StoreSettings {
  storeName: string
  legalName: string
  pan: string
  vat: string
  phone: string
  email: string
  address: string
  city: string
  invoicePrefix: string
  taxRate: number
  lowStockThreshold: number
  ageGate: boolean
  notifyEmail: boolean
  notifySms: boolean
  gateways: Record<
    PaymentMethod,
    { enabled: boolean; merchantId: string; mode: 'sandbox' | 'live' }
  >
}

export type PermissionMap = Record<
  string,
  Partial<Record<ModuleKey, ActionKey[]>>
>

export interface OpsState {
  orders: Order[]
  riders: Rider[]
  complaints: Complaint[]
  ledger: LedgerEntry[]
  settlements: Settlement[]
  payments: PaymentTxn[]
  coupons: Coupon[]
  banners: Banner[]
  campaigns: Campaign[]
  reviews: Review[]
  zones: Zone[]
  notifications: NotificationItem[]
  audit: AuditLog[]
  permissions: PermissionMap
  settings: StoreSettings
}
