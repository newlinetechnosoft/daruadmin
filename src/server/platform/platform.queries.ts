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
} from '#/db/schema'
import { desc, eq } from 'drizzle-orm'
import type {
  AuditLog,
  Banner,
  Campaign,
  Complaint,
  Coupon,
  NotificationItem,
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
    if (!acts || acts.length === 0) {
      await db.delete(userPermissions).where(eq(userPermissions.userId, userId))
    } else {
      const id = `perm_${userId}_${mod}`
      await db
        .insert(userPermissions)
        .values({
          id,
          userId,
          module: mod,
          actions: acts,
        })
        .onConflictDoUpdate({
          target: [userPermissions.userId, userPermissions.module],
          set: { actions: acts, updatedAt: new Date() },
        })
    }
  }
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

// -------------------------------------------------------------
// COMPLAINTS
// -------------------------------------------------------------

export async function getAllComplaintsQuery(): Promise<Complaint[]> {
  const rows = await db
    .select()
    .from(complaints)
    .orderBy(desc(complaints.createdAt))
  return rows.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customerName,
    orderId: c.orderId,
    subject: c.subject,
    body: c.body,
    status: c.status as 'open' | 'in_progress' | 'resolved',
    createdAt: c.createdAt.toISOString(),
  }))
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
