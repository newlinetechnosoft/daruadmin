import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit, getSessionUser } from '#/server/auth/permissions'
import {
  getAllCampaignsQuery,
  getCampaignByIdQuery,
  getCampaignDeliveriesQuery,
  upsertCampaignQuery,
  deleteCampaignQuery,
  getAudienceRecipientCountQuery,
} from '#/server/platform/campaign.queries'
import {
  executeCampaignPublication,
  scheduleCampaignForLater,
  rescheduleCampaign,
  cancelScheduledCampaign,
  reconcileOverdueCampaigns,
} from '#/server/scheduler/campaign-scheduler'
import {
  validateCampaignSchedule,
  DEFAULT_TIMEZONE,
} from '#/lib/campaign-timezone'

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const campaignChannelEnum = z.enum(['push', 'in-app', 'sms', 'email'])
const campaignStatusEnum = z.enum([
  'draft',
  'scheduled',
  'publishing',
  'published',
  'expired',
  'cancelled',
  'failed',
])

const campaignInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Campaign name is required'),
  title: z.string().optional(),
  channels: z.array(campaignChannelEnum).min(1, 'Select at least one notification channel'),
  channel: campaignChannelEnum.optional(),
  audience: z.string().default('all'),
  body: z.string().min(1, 'Announcement message body is required'),
  imageUrl: z.string().optional().nullable(),
  ctaUrl: z.string().optional().nullable(),
  ctaText: z.string().optional().nullable(),
  bannerPlacement: z.enum(['none', 'home', 'drinks', 'food', 'all']).default('none'),
  offerSlug: z.string().optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
  scheduledTime: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  expiryTime: z.string().optional().nullable(),
  timezone: z.string().default(DEFAULT_TIMEZONE),
})

// -----------------------------------------------------------------------------
// Queries & Getters
// -----------------------------------------------------------------------------

export const getAdminCampaignsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        status: campaignStatusEnum.optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'view')
    return getAllCampaignsQuery(data.status)
  })

export const getCampaignByIdFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'view')
    const campaign = await getCampaignByIdQuery(data.id)
    if (!campaign) throw new Error('Campaign not found')
    return campaign
  })

export const getCampaignDeliveriesFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        campaignId: z.string(),
        limit: z.number().optional().default(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'view')
    return getCampaignDeliveriesQuery(data.campaignId, data.limit)
  })

export const getAudienceEstimateFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        audience: z.string().default('all'),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'view')
    const count = await getAudienceRecipientCountQuery(data.audience)
    return { count }
  })

// -----------------------------------------------------------------------------
// Publishing Options (1. Publish Now, 2. Schedule for Later, 3. Draft, 4. Cancel, 5. Reschedule)
// -----------------------------------------------------------------------------

/**
 * 1. Save as Draft: save without sending
 */
export const saveCampaignDraftFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => campaignInputSchema.parse(d))
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'edit')

    const validation = validateCampaignSchedule({
      scheduledDate: data.scheduledDate || '',
      scheduledTime: data.scheduledTime || '',
      expiryDate: data.expiryDate,
      expiryTime: data.expiryTime,
      timezone: data.timezone,
      isDraft: true,
    })

    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const scheduledAt = validation.scheduledUtc || new Date()
    const expiresAt = validation.expiresUtc || null
    const estimatedRecipients = await getAudienceRecipientCountQuery(data.audience)

    const campaign = await upsertCampaignQuery({
      id: data.id,
      name: data.name,
      title: data.title || data.name,
      channel: data.channels[0],
      channels: data.channels,
      status: 'draft',
      audience: data.audience,
      estimatedRecipients,
      scheduledAt,
      scheduledDate: data.scheduledDate || null,
      scheduledTime: data.scheduledTime || null,
      expiresAt,
      expiryDate: data.expiryDate || null,
      expiryTime: data.expiryTime || null,
      timezone: data.timezone,
      body: data.body,
      imageUrl: data.imageUrl || null,
      ctaUrl: data.ctaUrl || null,
      ctaText: data.ctaText || null,
      bannerPlacement: data.bannerPlacement,
      offerSlug: data.offerSlug || null,
    })

    const user = await getSessionUser()
    await logAudit(
      user?.name || 'Admin',
      'marketing',
      'campaign_draft_saved',
      `Saved campaign draft "${campaign.name}" (${campaign.id})`,
    )

    return campaign
  })

/**
 * 2. Schedule for Later: automatically publish and send at the selected date and time
 */
export const scheduleCampaignFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => campaignInputSchema.parse(d))
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'edit')

    if (!data.scheduledDate || !data.scheduledTime) {
      throw new Error('Schedule Notification Date and Time are required for future scheduling')
    }

    const validation = validateCampaignSchedule({
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      expiryDate: data.expiryDate,
      expiryTime: data.expiryTime,
      timezone: data.timezone,
      isDraft: false,
      isPublishNow: false,
    })

    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const scheduledAt = validation.scheduledUtc!
    const expiresAt = validation.expiresUtc || null
    const estimatedRecipients = await getAudienceRecipientCountQuery(data.audience)

    // Save as scheduled in database
    const campaign = await upsertCampaignQuery({
      id: data.id,
      name: data.name,
      title: data.title || data.name,
      channel: data.channels[0],
      channels: data.channels,
      status: 'scheduled',
      audience: data.audience,
      estimatedRecipients,
      scheduledAt,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      expiresAt,
      expiryDate: data.expiryDate || null,
      expiryTime: data.expiryTime || null,
      timezone: data.timezone,
      body: data.body,
      imageUrl: data.imageUrl || null,
      ctaUrl: data.ctaUrl || null,
      ctaText: data.ctaText || null,
      bannerPlacement: data.bannerPlacement,
      offerSlug: data.offerSlug || null,
    })

    // Register background job via QStash / durable scheduler
    const scheduleRes = await scheduleCampaignForLater(campaign.id)

    const user = await getSessionUser()
    await logAudit(
      user?.name || 'Admin',
      'marketing',
      'campaign_scheduled',
      `Scheduled campaign "${campaign.name}" for ${data.scheduledDate} ${data.scheduledTime} (${data.timezone})`,
    )

    return {
      campaign: scheduleRes.campaign || campaign,
      message: scheduleRes.message,
    }
  })

/**
 * 3. Publish Now: publish and send immediately
 */
export const publishCampaignNowFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        campaignData: campaignInputSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'edit')

    let campaignId = data.id

    if (data.campaignData) {
      const c = data.campaignData
      const validation = validateCampaignSchedule({
        scheduledDate: '',
        scheduledTime: '',
        expiryDate: c.expiryDate,
        expiryTime: c.expiryTime,
        timezone: c.timezone,
        isPublishNow: true,
      })

      if (!validation.valid) {
        throw new Error(validation.errors.join(', '))
      }

      const estimatedRecipients = await getAudienceRecipientCountQuery(c.audience)
      const saved = await upsertCampaignQuery({
        id: c.id,
        name: c.name,
        title: c.title || c.name,
        channel: c.channels[0],
        channels: c.channels,
        status: 'draft',
        audience: c.audience,
        estimatedRecipients,
        scheduledAt: new Date(),
        scheduledDate: c.scheduledDate || null,
        scheduledTime: c.scheduledTime || null,
        expiresAt: validation.expiresUtc || null,
        expiryDate: c.expiryDate || null,
        expiryTime: c.expiryTime || null,
        timezone: c.timezone,
        body: c.body,
        imageUrl: c.imageUrl || null,
        ctaUrl: c.ctaUrl || null,
        ctaText: c.ctaText || null,
        bannerPlacement: c.bannerPlacement,
        offerSlug: c.offerSlug || null,
      })
      campaignId = saved.id
    }

    if (!campaignId) {
      throw new Error('Campaign ID or campaign data is required to publish')
    }

    const result = await executeCampaignPublication(campaignId)
    if (!result.success) {
      throw new Error(result.message)
    }

    const user = await getSessionUser()
    await logAudit(
      user?.name || 'Admin',
      'marketing',
      'campaign_published_now',
      `Published campaign "${result.campaign?.name || campaignId}" immediately`,
    )

    return result
  })

/**
 * 4. Cancel Scheduled Campaign: cancel before publication
 */
export const cancelScheduledCampaignFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'edit')
    const result = await cancelScheduledCampaign(data.id)
    if (!result.success) {
      throw new Error(result.message)
    }

    const user = await getSessionUser()
    await logAudit(
      user?.name || 'Admin',
      'marketing',
      'campaign_cancelled',
      `Cancelled scheduled campaign "${result.campaign?.name || data.id}"`,
    )

    return result
  })

/**
 * 5. Reschedule: change publication date and time before publishing
 */
export const rescheduleCampaignFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
        scheduledDate: z.string(),
        scheduledTime: z.string(),
        expiryDate: z.string().optional().nullable(),
        expiryTime: z.string().optional().nullable(),
        timezone: z.string().default(DEFAULT_TIMEZONE),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'edit')

    const validation = validateCampaignSchedule({
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      expiryDate: data.expiryDate,
      expiryTime: data.expiryTime,
      timezone: data.timezone,
      isDraft: false,
      isPublishNow: false,
    })

    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const result = await rescheduleCampaign(
      data.id,
      validation.scheduledUtc!,
      validation.expiresUtc || null,
      data.scheduledDate,
      data.scheduledTime,
      data.expiryDate || null,
      data.expiryTime || null,
    )

    if (!result.success) {
      throw new Error(result.message)
    }

    const user = await getSessionUser()
    await logAudit(
      user?.name || 'Admin',
      'marketing',
      'campaign_rescheduled',
      `Rescheduled campaign "${result.campaign?.name || data.id}" to ${data.scheduledDate} ${data.scheduledTime} (${data.timezone})`,
    )

    return result
  })

/**
 * Delete campaign (moves to recycle bin)
 */
export const deleteCampaignFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('marketing', 'delete')
    const campaign = await getCampaignByIdQuery(data.id)
    if (campaign?.status === 'scheduled') {
      await cancelScheduledCampaign(data.id)
    }

    const ok = await deleteCampaignQuery(data.id)
    const user = await getSessionUser()
    await logAudit(
      user?.name || 'Admin',
      'marketing',
      'campaign_deleted',
      `Deleted campaign "${campaign?.name || data.id}"`,
    )
    return { success: ok }
  })

/**
 * Manual / Cron trigger to run reconciliation job and recover missed campaigns
 */
export const reconcileCampaignsFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    await requirePermission('marketing', 'edit')
    const report = await reconcileOverdueCampaigns()
    return report
  })
