import { db, dbTx } from '#/db'
import type { DbTx } from '#/db'
import { campaigns, campaignDeliveries, user, orders } from '#/db/schema'
import { desc, eq, and, lte, inArray, sql } from 'drizzle-orm'
import type {
  Campaign,
  CampaignStatus,
  CampaignChannel,
  CampaignDeliveryItem,
  CampaignDeliveryProgress,
  CampaignAnalytics,
} from '#/server/operations/types'
import { moveToRecycleBin } from '#/server/recycle-bin/recycle-bin.queries'

export function mapCampaignRecord(c: typeof campaigns.$inferSelect): Campaign {
  const channels =
    Array.isArray(c.channels) && c.channels.length > 0
      ? (c.channels as CampaignChannel[])
      : [c.channel as CampaignChannel]

  return {
    id: c.id,
    name: c.name,
    title: c.title || c.name,
    channel: (c.channel as CampaignChannel) || 'push',
    channels,
    status: c.status as CampaignStatus,
    audience: c.audience,
    targetAudienceDetails:
      (c.targetAudienceDetails as Record<string, string | number | boolean | null>) ||
      null,
    estimatedRecipients: c.estimatedRecipients ?? 0,
    scheduledAt: c.scheduledAt.toISOString(),
    scheduledDate: c.scheduledDate || null,
    scheduledTime: c.scheduledTime || null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    expiryDate: c.expiryDate || null,
    expiryTime: c.expiryTime || null,
    timezone: c.timezone || 'Asia/Kathmandu',
    body: c.body,
    imageUrl: c.imageUrl || null,
    ctaUrl: c.ctaUrl || null,
    ctaText: c.ctaText || null,
    bannerPlacement: (c.bannerPlacement as any) || 'none',
    bannerId: c.bannerId || null,
    offerSlug: c.offerSlug || null,
    publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
    expiredAt: c.expiredAt ? c.expiredAt.toISOString() : null,
    deliveryProgress: (c.deliveryProgress as CampaignDeliveryProgress) || null,
    analytics: (c.analytics as CampaignAnalytics) || null,
    jobId: c.jobId || null,
    expireJobId: c.expireJobId || null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

export async function getAllCampaignsQuery(
  statusFilter?: CampaignStatus,
  limit = 200,
): Promise<Campaign[]> {
  const query = db.select().from(campaigns)

  if (statusFilter) {
    const rows = await query
      .where(eq(campaigns.status, statusFilter))
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
    return rows.map(mapCampaignRecord)
  }

  const rows = await query
    .orderBy(desc(campaigns.createdAt))
    .limit(limit)
  return rows.map(mapCampaignRecord)
}

export async function getCampaignByIdQuery(id: string): Promise<Campaign | null> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1)

  return row ? mapCampaignRecord(row) : null
}

export async function getCampaignDeliveriesQuery(
  campaignId: string,
  limit = 100,
): Promise<CampaignDeliveryItem[]> {
  const rows = await db
    .select({
      delivery: campaignDeliveries,
      userName: user.name,
    })
    .from(campaignDeliveries)
    .leftJoin(user, eq(campaignDeliveries.userId, user.id))
    .where(eq(campaignDeliveries.campaignId, campaignId))
    .orderBy(desc(campaignDeliveries.createdAt))
    .limit(limit)

  return rows.map(({ delivery: d, userName }) => ({
    id: d.id,
    campaignId: d.campaignId,
    userId: d.userId,
    userName: userName || null,
    channel: d.channel as CampaignChannel,
    recipient: d.recipient,
    status: d.status as 'pending' | 'sent' | 'failed',
    sentAt: d.sentAt ? d.sentAt.toISOString() : null,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
  }))
}

export async function upsertCampaignQuery(data: {
  id?: string
  name: string
  title?: string | null
  channel?: CampaignChannel
  channels?: CampaignChannel[]
  status?: CampaignStatus
  audience: string
  targetAudienceDetails?: Record<string, string | number | boolean | null> | null
  estimatedRecipients?: number
  scheduledAt: Date
  scheduledDate?: string | null
  scheduledTime?: string | null
  expiresAt?: Date | null
  expiryDate?: string | null
  expiryTime?: string | null
  timezone?: string
  body: string
  imageUrl?: string | null
  ctaUrl?: string | null
  ctaText?: string | null
  bannerPlacement?: 'none' | 'home' | 'drinks' | 'food' | 'all' | null
  bannerId?: string | null
  offerSlug?: string | null
  jobId?: string | null
  expireJobId?: string | null
  deliveryProgress?: CampaignDeliveryProgress | null
  analytics?: CampaignAnalytics | null
}): Promise<Campaign> {
  const id = data.id || `cmp_${crypto.randomUUID().slice(0, 10)}`
  const primaryChannel = data.channel || data.channels?.[0] || 'push'
  const channelsList = data.channels && data.channels.length > 0 ? data.channels : [primaryChannel]

  const values = {
    id,
    name: data.name,
    title: data.title || data.name,
    channel: primaryChannel,
    channels: channelsList,
    status: data.status || 'draft',
    audience: data.audience || 'all',
    targetAudienceDetails: data.targetAudienceDetails || null,
    estimatedRecipients: data.estimatedRecipients ?? 0,
    scheduledAt: data.scheduledAt,
    scheduledDate: data.scheduledDate || null,
    scheduledTime: data.scheduledTime || null,
    expiresAt: data.expiresAt || null,
    expiryDate: data.expiryDate || null,
    expiryTime: data.expiryTime || null,
    timezone: data.timezone || 'Asia/Kathmandu',
    body: data.body,
    imageUrl: data.imageUrl || null,
    ctaUrl: data.ctaUrl || null,
    ctaText: data.ctaText || null,
    bannerPlacement: data.bannerPlacement || 'none',
    bannerId: data.bannerId || null,
    offerSlug: data.offerSlug || null,
    jobId: data.jobId || null,
    expireJobId: data.expireJobId || null,
    deliveryProgress: data.deliveryProgress || null,
    analytics: data.analytics || null,
    updatedAt: new Date(),
  }

  const [row] = await db
    .insert(campaigns)
    .values(values)
    .onConflictDoUpdate({
      target: campaigns.id,
      set: values,
    })
    .returning()

  return mapCampaignRecord(row)
}

/**
 * Atomically locks and transitions a campaign to 'publishing' state.
 * Returns the campaign if transition succeeded, or null if another worker won or status is not publishable.
 */
export async function atomicClaimCampaignForPublishingQuery(
  id: string,
): Promise<Campaign | null> {
  const [row] = await db
    .update(campaigns)
    .set({
      status: 'publishing',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(campaigns.id, id),
        inArray(campaigns.status, ['scheduled', 'draft', 'failed']),
      ),
    )
    .returning()

  return row ? mapCampaignRecord(row) : null
}

/**
 * Atomically locks and transitions a campaign to 'expired' state.
 * Returns the campaign if transition succeeded, or null if already expired or not published.
 */
export async function atomicClaimCampaignForExpiryQuery(
  id: string,
): Promise<Campaign | null> {
  const [row] = await db
    .update(campaigns)
    .set({
      status: 'expired',
      expiredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'published')))
    .returning()

  return row ? mapCampaignRecord(row) : null
}

export async function updateCampaignStatusQuery(
  id: string,
  status: CampaignStatus,
  extra: {
    publishedAt?: Date | null
    expiredAt?: Date | null
    jobId?: string | null
    expireJobId?: string | null
    deliveryProgress?: CampaignDeliveryProgress | null
    analytics?: CampaignAnalytics | null
  } = {},
): Promise<Campaign | null> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }

  if (extra.publishedAt !== undefined) updateData.publishedAt = extra.publishedAt
  if (extra.expiredAt !== undefined) updateData.expiredAt = extra.expiredAt
  if (extra.jobId !== undefined) updateData.jobId = extra.jobId
  if (extra.expireJobId !== undefined) updateData.expireJobId = extra.expireJobId
  if (extra.deliveryProgress !== undefined) updateData.deliveryProgress = extra.deliveryProgress
  if (extra.analytics !== undefined) updateData.analytics = extra.analytics

  const [row] = await db
    .update(campaigns)
    .set(updateData)
    .where(eq(campaigns.id, id))
    .returning()

  return row ? mapCampaignRecord(row) : null
}

export async function getOverdueScheduledCampaignsQuery(
  now: Date = new Date(),
): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'scheduled'),
        lte(campaigns.scheduledAt, now),
      ),
    )
    .orderBy(campaigns.scheduledAt)

  return rows.map(mapCampaignRecord)
}

export async function getOverdueExpiringCampaignsQuery(
  now: Date = new Date(),
): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, 'published'),
        lte(campaigns.expiresAt, now),
      ),
    )
    .orderBy(campaigns.expiresAt)

  return rows.map(mapCampaignRecord)
}

export interface TargetAudienceUser {
  id: string
  name: string
  email: string
  phone: string | null
}

export async function getAudienceRecipientsQuery(
  audience: string,
): Promise<TargetAudienceUser[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  switch (audience) {
    case 'riders': {
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(user)
        .where(eq(user.role, 'rider'))
      return rows
    }
    case 'staff': {
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(user)
        .where(inArray(user.role, ['admin', 'staff', 'superadmin']))
      return rows
    }
    case 'customers': {
      // Users who have at least one order
      const customerOrders = await db
        .selectDistinct({ customerId: orders.customerId })
        .from(orders)
      const customerIds = customerOrders
        .map((r) => r.customerId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      if (customerIds.length === 0) return []

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(user)
        .where(inArray(user.id, customerIds))
      return rows
    }
    case 'active_30d': {
      // Users with an order in the last 30 days
      const recentOrders = await db
        .selectDistinct({ customerId: orders.customerId })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${thirtyDaysAgo}`)
      const customerIds = recentOrders
        .map((r) => r.customerId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      if (customerIds.length === 0) return []

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(user)
        .where(inArray(user.id, customerIds))
      return rows
    }
    case 'inactive_60d': {
      // Users who haven't placed an order in the last 60 days
      const recentOrders = await db
        .selectDistinct({ customerId: orders.customerId })
        .from(orders)
        .where(sql`${orders.createdAt} >= ${sixtyDaysAgo}`)
      const recentIds = recentOrders
        .map((r) => r.customerId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      const query = db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(user)

      const rows = recentIds.length > 0
        ? await query.where(sql`${user.id} NOT IN ${recentIds}`)
        : await query

      return rows
    }
    case 'all':
    default: {
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        })
        .from(user)
        .where(eq(user.banned, false))
      return rows
    }
  }
}

export async function getAudienceRecipientCountQuery(
  audience: string,
): Promise<number> {
  const recipients = await getAudienceRecipientsQuery(audience)
  return recipients.length
}

export async function deleteCampaignQuery(
  id: string,
  externalTx?: DbTx,
): Promise<boolean> {
  const run = async (tx: DbTx) => {
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1)

    if (campaign) {
      await moveToRecycleBin(
        {
          entityType: 'campaign',
          entityId: campaign.id,
          name: campaign.name,
          description: `Campaign (${campaign.status}) for ${campaign.audience}`,
          data: { campaign },
        },
        tx,
      )
    }

    await tx.delete(campaigns).where(eq(campaigns.id, id))
    return true
  }

  if (externalTx) {
    return run(externalTx)
  }
  return dbTx.transaction((tx) => run(tx))
}
