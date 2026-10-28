import { db } from '#/db'
import {
  notifications,
  auditLogs,
  siteSettings,
  userPermissions,
  coupons,
  complaints,
  banners,
  campaigns,
  reviews,
  shippingZones,
  couponRedemptions,
  offers,
  customerAddresses,
  orders,
} from '#/db/schema'
import { desc, eq, count, and } from 'drizzle-orm'
import type {
  AuditLog,
  Banner,
  Campaign,
  Complaint,
  Coupon,
  CouponRedemption,
  CustomerAddress,
  NotificationItem,
  Offer,
  PermissionMap,
  ModuleKey,
  ActionKey,
  Review,
  StoreSettings,
  Zone,
} from '#/server/operations/types'

export function defaultStoreSettings(): StoreSettings {
  return {
    storeName: 'Mezmani',
    legalName: 'Mezmani Retail Pvt. Ltd.',
    pan: '123456789',
    vat: 'NP-VAT-001',
    phone: '+977-9800000000',
    email: 'ops@mezmani.com.np',
    address: 'Traffic Chowk, Butwal',
    city: 'Butwal',
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
    riderCodLimit: 2000000, // Rs. 20,000 in paisa
    deliveryFee: 15000, // Rs. 150 in paisa
    freeDeliveryThreshold: 300000, // Rs. 3,000 in paisa
  }
}

// -------------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------------

export async function getAllNotificationsQuery(): Promise<NotificationItem[]> {
  const rows = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type as any,
    read: n.read,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
  }))
}

export async function markAllNotificationsReadQuery() {
  await db.update(notifications).set({ read: true })
}

export async function insertNotificationQuery(item: {
  id?: string
  title: string
  body: string
  type: 'order' | 'stock' | 'rider' | 'finance' | 'system'
  href?: string
  userId?: string
}) {
  const id = item.id || `notif_${crypto.randomUUID().slice(0, 8)}`
  await db.insert(notifications).values({
    id,
    title: item.title,
    body: item.body,
    type: item.type,
    read: false,
    href: item.href || '',
    userId: item.userId || null,
  })
}

// -------------------------------------------------------------
// AUDIT LOGS
// -------------------------------------------------------------

export async function getAllAuditLogsQuery(): Promise<AuditLog[]> {
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
  return rows.map((a) => ({
    id: a.id,
    at: a.createdAt.toISOString(),
    actor: a.actor,
    module: a.module,
    action: a.action,
    detail: a.detail,
  }))
}

export async function insertAuditLogQuery(entry: {
  actor: string
  module: string
  action: string
  detail: string
}) {
  const id = `aud_${crypto.randomUUID().slice(0, 8)}`
  await db.insert(auditLogs).values({
    id,
    actor: entry.actor,
    module: entry.module,
    action: entry.action,
    detail: entry.detail,
  })
}

// -------------------------------------------------------------
// SITE SETTINGS
// -------------------------------------------------------------

export async function getStoreSettingsQuery(): Promise<StoreSettings> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, 'general'))
    .limit(1)

  if (!rows[0] || typeof rows[0].value !== 'object') {
    return defaultStoreSettings()
  }

  return { ...defaultStoreSettings(), ...(rows[0].value as any) }
}

export async function saveStoreSettingsQuery(
  settings: Partial<StoreSettings>,
): Promise<StoreSettings> {
  const current = await getStoreSettingsQuery()
  const next = { ...current, ...settings }

  await db
    .insert(siteSettings)
    .values({ key: 'general', value: next })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: next, updatedAt: new Date() },
    })

  return next
}

// -------------------------------------------------------------
// USER PERMISSIONS
// -------------------------------------------------------------

export async function getAllUserPermissionsQuery(): Promise<PermissionMap> {
  const rows = await db.select().from(userPermissions)
  const map: PermissionMap = {}

  for (const r of rows) {
    const userGrants = (map[r.userId] ??= {})
    userGrants[r.module as ModuleKey] = r.actions as ActionKey[]
  }

  return map
}

export async function saveUserPermissionsQuery(
  userId: string,
  permissions: Partial<Record<string, string[]>>,
) {
  for (const [mod, acts] of Object.entries(permissions)) {
    const id = `perm_${userId}_${mod}`
    const safeActs = acts ?? []
    await db
      .insert(userPermissions)
      .values({
        id,
        userId,
        module: mod,
        actions: safeActs,
      })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.module],
        set: { actions: safeActs, updatedAt: new Date() },
      })
  }
}

export async function resetUserPermissionsQuery(userId: string) {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId))
}

// -------------------------------------------------------------
// COUPONS
// -------------------------------------------------------------

export async function getAllCouponsQuery(): Promise<Coupon[]> {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt))
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type as 'percent' | 'fixed',
    value: c.value,
    minOrder: c.minOrder,
    usageLimit: c.usageLimit,
    used: c.used,
    active: c.active,
    expiresAt: c.expiresAt.toISOString(),
  }))
}

export async function getCouponByCodeQuery(
  code: string,
): Promise<Coupon | null> {
  const rows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase()))
    .limit(1)

  if (!rows[0]) return null
  const c = rows[0]
  return {
    id: c.id,
    code: c.code,
    type: c.type as 'percent' | 'fixed',
    value: c.value,
    minOrder: c.minOrder,
    usageLimit: c.usageLimit,
    used: c.used,
    active: c.active,
    expiresAt: c.expiresAt.toISOString(),
  }
}

export async function upsertCouponQuery(c: Coupon) {
  const id = c.id || `cp_${crypto.randomUUID().slice(0, 8)}`
  await db
    .insert(coupons)
    .values({
      id,
      code: c.code.toUpperCase(),
      type: c.type,
      value: c.value,
      minOrder: c.minOrder,
      usageLimit: c.usageLimit,
      used: c.used,
      active: c.active,
      expiresAt: new Date(c.expiresAt),
    })
    .onConflictDoUpdate({
      target: coupons.code,
      set: {
        type: c.type,
        value: c.value,
        minOrder: c.minOrder,
        usageLimit: c.usageLimit,
        used: c.used,
        active: c.active,
        expiresAt: new Date(c.expiresAt),
      },
    })
}

export async function deleteCouponQuery(id: string) {
  await db.delete(coupons).where(eq(coupons.id, id))
}

export async function getCouponRedemptionsQuery(
  limit = 100,
): Promise<CouponRedemption[]> {
  const rows = await db
    .select()
    .from(couponRedemptions)
    .orderBy(desc(couponRedemptions.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    couponId: r.couponId,
    couponCode: r.couponCode,
    orderId: r.orderId,
    customerId: r.customerId,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    orderTotal: r.orderTotal,
    discountAmount: r.discountAmount,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getCustomerCouponRedemptionCountQuery(
  couponId: string,
  customerId: string,
): Promise<number> {
  const res = await db
    .select({ count: count() })
    .from(couponRedemptions)
    .where(
      and(
        eq(couponRedemptions.couponId, couponId),
        eq(couponRedemptions.customerId, customerId),
      ),
    )
  return res[0]?.count ?? 0
}

// -------------------------------------------------------------
// COMPLAINTS
// -------------------------------------------------------------

export async function getAllComplaintsQuery(): Promise<Complaint[]> {
  const rows = await db
    .select({
      complaint: complaints,
      orderNumber: orders.number,
    })
    .from(complaints)
    .leftJoin(orders, eq(complaints.orderId, orders.id))
    .orderBy(desc(complaints.createdAt))

  return rows.map(({ complaint: c, orderNumber }) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customerName,
    orderId: c.orderId,
    orderNumber: orderNumber ?? null,
    subject: c.subject,
    body: c.body,
    status: c.status as 'open' | 'in_progress' | 'resolved',
    createdAt: c.createdAt.toISOString(),
  }))
}

export async function getCustomerComplaintsQuery(
  customerId: string,
): Promise<Complaint[]> {
  const rows = await db
    .select({
      complaint: complaints,
      orderNumber: orders.number,
    })
    .from(complaints)
    .leftJoin(orders, eq(complaints.orderId, orders.id))
    .where(eq(complaints.customerId, customerId))
    .orderBy(desc(complaints.createdAt))

  return rows.map(({ complaint: c, orderNumber }) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customerName,
    orderId: c.orderId,
    orderNumber: orderNumber ?? null,
    subject: c.subject,
    body: c.body,
    status: c.status as 'open' | 'in_progress' | 'resolved',
    createdAt: c.createdAt.toISOString(),
  }))
}

export async function createComplaintQuery(data: {
  customerId: string
  customerName: string
  orderId?: string | null
  subject: string
  body: string
}): Promise<string> {
  const id = `cmp_${crypto.randomUUID().slice(0, 12)}`
  await db.insert(complaints).values({
    id,
    customerId: data.customerId,
    customerName: data.customerName,
    orderId: data.orderId || null,
    subject: data.subject,
    body: data.body,
    status: 'open',
  })
  return id
}

export async function updateComplaintStatusQuery(
  id: string,
  status: 'open' | 'in_progress' | 'resolved',
) {
  await db.update(complaints).set({ status }).where(eq(complaints.id, id))
}

// -------------------------------------------------------------
// BANNERS
// -------------------------------------------------------------

export async function getAllBannersQuery(): Promise<Banner[]> {
  const rows = await db.select().from(banners).orderBy(desc(banners.createdAt))
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    imageUrl: b.imageUrl,
    href: b.href,
    placement: b.placement as 'home' | 'drinks' | 'grocery',
    active: b.active,
  }))
}

export async function upsertBannerQuery(banner: Banner) {
  const id = banner.id || `ban_${crypto.randomUUID().slice(0, 8)}`
  await db
    .insert(banners)
    .values({
      id,
      title: banner.title,
      imageUrl: banner.imageUrl,
      href: banner.href,
      placement: banner.placement,
      active: banner.active,
    })
    .onConflictDoUpdate({
      target: banners.id,
      set: {
        title: banner.title,
        imageUrl: banner.imageUrl,
        href: banner.href,
        placement: banner.placement,
        active: banner.active,
      },
    })
}

export async function deleteBannerQuery(id: string) {
  await db.delete(banners).where(eq(banners.id, id))
}

// -------------------------------------------------------------
// CAMPAIGNS
// -------------------------------------------------------------

export async function getAllCampaignsQuery(): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt))
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    channel: c.channel as any,
    status: c.status as any,
    audience: c.audience,
    scheduledAt: c.scheduledAt.toISOString(),
    body: c.body,
  }))
}

// -------------------------------------------------------------
// REVIEWS
// -------------------------------------------------------------

export async function getAllReviewsQuery(): Promise<Review[]> {
  const rows = await db.select().from(reviews).orderBy(desc(reviews.createdAt))
  return rows.map((r) => ({
    id: r.id,
    productName: r.productName,
    customerName: r.customerName,
    rating: r.rating,
    body: r.body,
    status: r.status as 'pending' | 'published' | 'hidden',
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function updateReviewStatusQuery(
  id: string,
  status: 'pending' | 'published' | 'hidden',
) {
  await db.update(reviews).set({ status }).where(eq(reviews.id, id))
}

// -------------------------------------------------------------
// SHIPPING ZONES
// -------------------------------------------------------------

export async function getAllShippingZonesQuery(): Promise<Zone[]> {
  const rows = await db
    .select()
    .from(shippingZones)
    .orderBy(desc(shippingZones.createdAt))
  return rows.map((z) => ({
    id: z.id,
    name: z.name,
    areas: z.areas,
    deliveryCharge: z.deliveryCharge,
    etaMinutes: z.etaMinutes,
    active: z.active,
    courier: z.courier as any,
  }))
}

export async function upsertShippingZoneQuery(z: Zone) {
  const id = z.id || `zone_${crypto.randomUUID().slice(0, 8)}`
  await db
    .insert(shippingZones)
    .values({
      id,
      name: z.name,
      areas: z.areas,
      deliveryCharge: z.deliveryCharge,
      etaMinutes: z.etaMinutes,
      active: z.active,
      courier: z.courier,
    })
    .onConflictDoUpdate({
      target: shippingZones.id,
      set: {
        name: z.name,
        areas: z.areas,
        deliveryCharge: z.deliveryCharge,
        etaMinutes: z.etaMinutes,
        active: z.active,
        courier: z.courier,
      },
    })
}

// -------------------------------------------------------------
// OFFERS & PROMOTIONS (A3 & B10)
// -------------------------------------------------------------

function mapOfferRecord(o: typeof offers.$inferSelect): Offer {
  return {
    id: o.id,
    title: o.title,
    slug: o.slug,
    type: o.type as any,
    scope: o.scope as any,
    scopeId: o.scopeId,
    discountValue: o.discountValue,
    minOrderAmount: o.minOrderAmount,
    bannerUrl: o.bannerUrl,
    heading: o.heading,
    description: o.description,
    priority: o.priority,
    stackable: o.stackable,
    active: o.active,
    startsAt: o.startsAt ? o.startsAt.toISOString() : null,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }
}

export async function getAllOffersQuery(onlyActive = false): Promise<Offer[]> {
  const rows = onlyActive
    ? await db
        .select()
        .from(offers)
        .where(eq(offers.active, true))
        .orderBy(desc(offers.priority), desc(offers.createdAt))
    : await db
        .select()
        .from(offers)
        .orderBy(desc(offers.priority), desc(offers.createdAt))

  return rows.map(mapOfferRecord)
}

export async function getOfferBySlugQuery(slug: string): Promise<Offer | null> {
  const rows = await db
    .select()
    .from(offers)
    .where(eq(offers.slug, slug))
    .limit(1)

  return rows[0] ? mapOfferRecord(rows[0]) : null
}

export async function upsertOfferQuery(data: {
  id?: string
  title: string
  slug: string
  type?: 'bogo' | 'percent' | 'fixed' | 'free_delivery' | 'bundle'
  scope?: 'all' | 'category' | 'brand' | 'product' | 'variant'
  scopeId?: string | null
  discountValue?: number
  minOrderAmount?: number
  bannerUrl?: string | null
  heading?: string | null
  description?: string | null
  priority?: number
  stackable?: boolean
  active?: boolean
  startsAt?: Date | null
  expiresAt?: Date | null
}) {
  const id = data.id || `ofr_${crypto.randomUUID().slice(0, 8)}`
  const values = {
    id,
    title: data.title,
    slug: data.slug,
    type: data.type || 'percent',
    scope: data.scope || 'all',
    scopeId: data.scopeId || null,
    discountValue: data.discountValue ?? 0,
    minOrderAmount: data.minOrderAmount ?? 0,
    bannerUrl: data.bannerUrl || null,
    heading: data.heading || null,
    description: data.description || null,
    priority: data.priority ?? 0,
    stackable: data.stackable ?? false,
    active: data.active ?? true,
    startsAt: data.startsAt || null,
    expiresAt: data.expiresAt || null,
    updatedAt: new Date(),
  }

  await db.insert(offers).values(values).onConflictDoUpdate({
    target: offers.id,
    set: values,
  })

  return id
}

export async function deleteOfferQuery(id: string) {
  await db.delete(offers).where(eq(offers.id, id))
}

// -------------------------------------------------------------
// CUSTOMER ADDRESSES (B11)
// -------------------------------------------------------------

function mapCustomerAddressRecord(
  a: typeof customerAddresses.$inferSelect,
): CustomerAddress {
  return {
    id: a.id,
    customerId: a.customerId,
    label: a.label,
    address: a.address,
    city: a.city,
    landmark: a.landmark,
    lat: a.lat ? Number(a.lat) : null,
    lng: a.lng ? Number(a.lng) : null,
    isDefault: a.isDefault,
    contactPhone: a.contactPhone,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

export async function getCustomerAddressesQuery(
  customerId: string,
): Promise<CustomerAddress[]> {
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(
      desc(customerAddresses.isDefault),
      desc(customerAddresses.createdAt),
    )

  return rows.map(mapCustomerAddressRecord)
}

export async function upsertCustomerAddressQuery(data: {
  id?: string
  customerId: string
  label?: string
  address: string
  city?: string
  landmark?: string | null
  lat?: number | null
  lng?: number | null
  isDefault?: boolean
  contactPhone?: string | null
}) {
  const id = data.id || `addr_${crypto.randomUUID().slice(0, 8)}`

  if (data.isDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, data.customerId))
  }

  const values = {
    id,
    customerId: data.customerId,
    label: data.label || 'Home',
    address: data.address,
    city: data.city || 'Butwal',
    landmark: data.landmark || null,
    lat: data.lat !== undefined && data.lat !== null ? String(data.lat) : null,
    lng: data.lng !== undefined && data.lng !== null ? String(data.lng) : null,
    isDefault: data.isDefault ?? false,
    contactPhone: data.contactPhone || null,
    updatedAt: new Date(),
  }

  await db.insert(customerAddresses).values(values).onConflictDoUpdate({
    target: customerAddresses.id,
    set: values,
  })

  return id
}

export async function deleteCustomerAddressQuery(
  id: string,
  customerId: string,
) {
  await db
    .delete(customerAddresses)
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.customerId, customerId),
      ),
    )
}

export async function setDefaultCustomerAddressQuery(
  id: string,
  customerId: string,
) {
  await db
    .update(customerAddresses)
    .set({ isDefault: false })
    .where(eq(customerAddresses.customerId, customerId))

  await db
    .update(customerAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(
      and(
        eq(customerAddresses.id, id),
        eq(customerAddresses.customerId, customerId),
      ),
    )
}
