import type { DealerDto } from '#/server/inventory/inventory.queries'

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
  'dealers',
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
  'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve'

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
    description: 'Products, categories, brands, variants, and liquor metadata',
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
        description: 'Create and configure liquor and grocery item categories',
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
      {
        key: 'dealers',
        label: 'Dealers',
        description:
          'Supplier profiles, PAN/VAT records, contact numbers, and catalog item assignments',
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

export type DateRangeKey = 'today' | '7d' | '30d' | '90d' | 'ytd' | 'custom'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'dealer_assigned'
  | 'rider_assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'returned'
  | 'cancelled'

export type PaymentMethod =
  'cod' | 'esewa' | 'khalti' | 'fonepay' | 'connectips'

export interface OrderItemDealerInfo {
  id: string
  name: string
  pan?: string | null
  vatNumber?: string | null
  providesVatBill?: boolean
  tdsRate?: string | number
  contact: string
  whatsappNumber?: string | null
  address: string
  city: string
  lat?: number | null
  lng?: number | null
  distanceKm?: number | null
  costPrice?: number
}

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
  dealerId?: string | null
  dealerCostPrice?: number | null
  actualDealerCostPrice?: number | null
  dealerBillPhotoUrl?: string | null
  sourcingStatus?: 'pending' | 'assigned' | 'unavailable' | 'picked_up'
  isSettled?: boolean
  settlementId?: string | null
  dealer?: OrderItemDealerInfo | null
  availableDealers?: OrderItemDealerInfo[]
}

export interface OrderEvent {
  id: string
  at: string
  status: OrderStatus
  fromStatus?: OrderStatus | null
  toStatus?: OrderStatus | null
  note: string
  actor: string
  actorId?: string | null
  actorRole?: string | null
  metadata?: Record<string, any> | null
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
  isLegacy?: boolean
  deliveryOtp?: string | null
  deliveryProofPhotoUrl?: string | null
  cancellationReason?: string | null
  deliveryFailureReason?: string | null
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
  baseSalary?: number
  perDropRate?: number
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
  orderNumber?: string | null
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
    | 'salary'
    | 'dealer_payment'
  account: string
  memo: string
  amount: number
  refType: 'order' | 'settlement' | 'manual' | 'refund' | 'dealer' | 'salary'
  refId: string | null
  createdAt: string
}

export interface Settlement {
  id: string
  riderId: string
  riderName: string
  voucherNo?: string | null
  slug?: string | null
  periodStart: string
  periodEnd: string
  deliveries: number
  cashCollected: number
  baseSalaryAmount?: number
  perDropAmount?: number
  commissionAmount?: number
  commission: number
  grossEarnings?: number
  advancesDeducted?: number
  cashShortageDeducted?: number
  cashHeldDeducted?: number
  netPayout?: number
  payout: number
  status: 'draft' | 'approved' | 'paid'
  paymentMethod?: string | null
  paymentReference?: string | null
  paidAt?: string | null
  notes?: string | null
  proofUrls?: string[]
  journalEntryId?: string | null
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
  perCustomerLimit?: number
  firstOrderOnly?: boolean
  active: boolean
  expiresAt: string
}

export interface CouponRedemption {
  id: string
  couponId: string
  couponCode: string
  orderId: string | null
  customerId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  orderTotal: number // paisa
  discountAmount: number // paisa
  createdAt: string
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
  riderCodLimit?: number // in paisa, default 2000000 (Rs. 20,000)
  deliveryFee?: number // in paisa, default 15000 (Rs. 150)
  freeDeliveryThreshold?: number // in paisa, default 300000 (Rs. 3,000)
}

export type PermissionMap = Record<
  string,
  Partial<Record<ModuleKey, ActionKey[]>>
>

export interface OpsState {
  orders: Order[]
  riders: Rider[]
  dealers?: DealerDto[]
  complaints: Complaint[]
  ledger: LedgerEntry[]
  settlements: Settlement[]
  payments: PaymentTxn[]
  coupons: Coupon[]
  couponRedemptions?: CouponRedemption[]
  banners: Banner[]
  campaigns: Campaign[]
  reviews: Review[]
  zones: Zone[]
  notifications: NotificationItem[]
  audit: AuditLog[]
  permissions: PermissionMap
  settings: StoreSettings
  journalEntries?: any[]
  generalLedger?: any[]
  chartOfAccounts?: any[]
  fiscalYears?: any[]
  dealerPayables?: any[]
  dealerSettlements?: any[]
  riderAccounts?: any[]
  offers?: Offer[]
  riderShifts?: RiderShift[]
  sourcingIntelligence?: import('./sourcing-intelligence.queries').ProductSourcingIntelligenceReport
}

export interface RiderShift {
  id: string
  riderId: string
  riderName?: string
  status: 'active' | 'completed'
  startedAt: string
  endedAt?: string | null
  durationMinutes: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Offer {
  id: string
  title: string
  slug: string
  type: 'bogo' | 'percent' | 'fixed' | 'free_delivery' | 'bundle'
  scope: 'all' | 'category' | 'brand' | 'product' | 'variant'
  scopeId?: string | null
  discountValue: number // percentage or paisa
  minOrderAmount: number // paisa
  bannerUrl?: string | null
  heading?: string | null
  description?: string | null
  priority: number
  stackable: boolean
  active: boolean
  startsAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerAddress {
  id: string
  customerId: string
  label: string
  address: string
  city: string
  landmark?: string | null
  lat?: number | null
  lng?: number | null
  isDefault: boolean
  contactPhone?: string | null
  createdAt: string
  updatedAt: string
}

export type {
  TopProductMetric,
  SlowMoverMetric,
  MostUnavailableMetric,
  DealerSubstitutionMetric,
  ProductSourcingIntelligenceReport,
} from './sourcing-intelligence.queries'
