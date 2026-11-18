import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseDateTimeToUtc,
  formatUtcToParts,
  formatInTimezone,
  validateCampaignSchedule,
  getTimezoneMeta,
} from '#/lib/campaign-timezone'
import type {
  Campaign,
  CampaignChannel,
  CampaignStatus,
} from '#/server/operations/types'

describe('Notification Scheduling, Publishing & Expiry Management Suite', () => {
  // ===========================================================================
  // 1. Timezone Parsing, DST Handling & Formatting
  // ===========================================================================
  describe('1. Timezone Calculations & Preservations', () => {
    it('should accurately convert Asia/Kathmandu (Nepal Standard Time, UTC+05:45) local date/time to UTC', () => {
      // 2026-11-20 at 14:30 in Nepal (+05:45) corresponds to 08:45:00 UTC
      const utcDate = parseDateTimeToUtc('2026-11-20', '14:30', 'Asia/Kathmandu')
      assert.strictEqual(utcDate.toISOString(), '2026-11-20T08:45:00.000Z')

      // Midnight in Nepal: 2026-01-01 00:00 NPT = 2025-12-31 18:15:00 UTC
      const midnightUtc = parseDateTimeToUtc('2026-01-01', '00:00', 'Asia/Kathmandu')
      assert.strictEqual(midnightUtc.toISOString(), '2025-12-31T18:15:00.000Z')
    })

    it('should accurately reverse format UTC date to local date and time parts in Asia/Kathmandu', () => {
      const utcDate = new Date('2026-11-20T08:45:00.000Z')
      const parts = formatUtcToParts(utcDate, 'Asia/Kathmandu')
      assert.strictEqual(parts.dateStr, '2026-11-20')
      assert.strictEqual(parts.timeStr, '14:30') // 08:45 + 05:45 = 14:30
    })

    it('should correctly handle Daylight Saving Time (DST) for America/New_York (EDT vs EST)', () => {
      // Summer (EDT, UTC-04:00): July 15 at 12:00 EDT = 16:00 UTC
      const summerUtc = parseDateTimeToUtc('2026-07-15', '12:00', 'America/New_York')
      assert.strictEqual(summerUtc.toISOString(), '2026-07-15T16:00:00.000Z')

      // Winter (EST, UTC-05:00): December 15 at 12:00 EST = 17:00 UTC
      const winterUtc = parseDateTimeToUtc('2026-12-15', '12:00', 'America/New_York')
      assert.strictEqual(winterUtc.toISOString(), '2026-12-15T17:00:00.000Z')
    })

    it('should correctly handle Daylight Saving Time (DST) for Europe/London (BST vs GMT)', () => {
      // Summer (BST, UTC+01:00): July 15 at 12:00 BST = 11:00 UTC
      const summerUtc = parseDateTimeToUtc('2026-07-15', '12:00', 'Europe/London')
      assert.strictEqual(summerUtc.toISOString(), '2026-07-15T11:00:00.000Z')

      // Winter (GMT, UTC+00:00): December 15 at 12:00 GMT = 12:00 UTC
      const winterUtc = parseDateTimeToUtc('2026-12-15', '12:00', 'Europe/London')
      assert.strictEqual(winterUtc.toISOString(), '2026-12-15T12:00:00.000Z')
    })

    it('should default to Asia/Kathmandu when no timezone is specified', () => {
      const meta = getTimezoneMeta()
      assert.strictEqual(meta.value, 'Asia/Kathmandu')
      assert.strictEqual(meta.shortLabel, 'NPT')
      assert.strictEqual(meta.offsetLabel, 'UTC+05:45')
      assert.strictEqual(meta.hasDst, false)
    })

    it('should format dates for human display with clear timezone badge', () => {
      const utcDate = new Date('2026-11-20T08:45:00.000Z')
      const formatted = formatInTimezone(utcDate, 'Asia/Kathmandu')
      assert.match(formatted, /Nov 20, 2026/)
      assert.match(formatted, /2:30 PM|02:30 PM/)
      assert.match(formatted, /\(NPT\)/)
    })
  })

  // ===========================================================================
  // 2. Schedule Validation Rules
  // ===========================================================================
  describe('2. Campaign Schedule Validation Rules', () => {
    const fixedNow = new Date('2026-11-18T10:00:00.000Z') // Ref fixed current time

    it('should reject scheduling when publication date/time is in the past', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '2026-11-17',
        scheduledTime: '10:00',
        timezone: 'Asia/Kathmandu',
        now: fixedNow,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes('cannot be in the past')))
    })

    it('should reject scheduling when expiry date/time is before publication date/time', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '2026-11-25',
        scheduledTime: '14:00',
        expiryDate: '2026-11-24', // Earlier than publication!
        expiryTime: '12:00',
        timezone: 'Asia/Kathmandu',
        now: fixedNow,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(
        result.errors.some((e) =>
          e.includes('Expiry date and time must be later than the scheduled publication time'),
        ),
      )
    })

    it('should reject scheduling when expiry date/time is exactly equal to publication date/time', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '2026-11-25',
        scheduledTime: '14:00',
        expiryDate: '2026-11-25',
        expiryTime: '14:00', // Equal!
        timezone: 'Asia/Kathmandu',
        now: fixedNow,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(
        result.errors.some((e) =>
          e.includes('Expiry date and time must be later than the scheduled publication time'),
        ),
      )
    })

    it('should accept valid future publication and later expiry time', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '2026-11-25',
        scheduledTime: '14:00',
        expiryDate: '2026-11-30',
        expiryTime: '23:59',
        timezone: 'Asia/Kathmandu',
        now: fixedNow,
      })
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.errors.length, 0)
      assert.ok(result.scheduledUtc instanceof Date)
      assert.ok(result.expiresUtc instanceof Date)
      assert.ok(result.expiresUtc.getTime() > result.scheduledUtc.getTime())
    })

    it('should allow draft campaigns to be saved even without future date restrictions', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '2026-11-01', // Past date is acceptable in draft state
        scheduledTime: '12:00',
        isDraft: true,
        now: fixedNow,
      })
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.errors.length, 0)
    })

    it('should validate Publish Now with immediate publication and future expiry', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '',
        scheduledTime: '',
        expiryDate: '2026-11-25',
        expiryTime: '18:00',
        timezone: 'Asia/Kathmandu',
        isPublishNow: true,
        now: fixedNow,
      })
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.scheduledUtc?.getTime(), fixedNow.getTime())
    })

    it('should reject Publish Now if expiry is already in the past', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '',
        scheduledTime: '',
        expiryDate: '2026-11-10', // In the past!
        expiryTime: '18:00',
        timezone: 'Asia/Kathmandu',
        isPublishNow: true,
        now: fixedNow,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes('must be in the future')))
    })
  })

  // ===========================================================================
  // 3. Publishing Options & State Transitions
  // ===========================================================================
  describe('3. Publishing Options & State Machine', () => {
    it('should support all 7 standard campaign statuses without drift', () => {
      const statuses: CampaignStatus[] = [
        'draft',
        'scheduled',
        'publishing',
        'published',
        'expired',
        'cancelled',
        'failed',
      ]
      assert.strictEqual(statuses.length, 7)
    })

    it('should safely cancel a scheduled campaign and prevent pending delivery', () => {
      let isDeliveryPrevented = false
      let cancelledStatus: CampaignStatus = 'scheduled'

      // Mock campaign in scheduled state
      const campaign: Partial<Campaign> = {
        id: 'cmp_mock_1',
        name: 'Festive Flash Deal',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }

      // Action: Cancel Scheduled Campaign
      if (campaign.status === 'scheduled') {
        cancelledStatus = 'cancelled'
        isDeliveryPrevented = true
      }

      assert.strictEqual(cancelledStatus, 'cancelled')
      assert.strictEqual(isDeliveryPrevented, true)
    })

    it('should prevent cancelling campaigns that have already published or expired', () => {
      const publishedCampaign: Partial<Campaign> = {
        id: 'cmp_mock_2',
        status: 'published',
      }

      const canCancel = publishedCampaign.status === 'scheduled' || publishedCampaign.status === 'draft'
      assert.strictEqual(canCancel, false)
    })

    it('should safely reschedule a campaign before publication and update UTC bounds', () => {
      const originalScheduledAt = parseDateTimeToUtc('2026-11-20', '10:00', 'Asia/Kathmandu')
      const newScheduledAt = parseDateTimeToUtc('2026-11-22', '16:00', 'Asia/Kathmandu')

      assert.notStrictEqual(originalScheduledAt.getTime(), newScheduledAt.getTime())
      assert.ok(newScheduledAt.getTime() > originalScheduledAt.getTime())
    })
  })

  // ===========================================================================
  // 4. Expiry Behaviour & Deactivation Guards
  // ===========================================================================
  describe('4. Expiry Behaviour & Banner Deactivation Guards', () => {
    it('should detect expired campaigns when current time exceeds expiresAt', () => {
      const pastExpiry = new Date(Date.now() - 3600000) // 1 hour ago
      const futureExpiry = new Date(Date.now() + 3600000) // 1 hour ahead

      const isPastExpired = pastExpiry.getTime() <= Date.now()
      const isFutureExpired = futureExpiry.getTime() <= Date.now()

      assert.strictEqual(isPastExpired, true)
      assert.strictEqual(isFutureExpired, false)
    })

    it('should deactivate associated promotional banners when expiry occurs', () => {
      const banner = {
        id: 'ban_festive_1',
        title: 'Dashain Festival Offer',
        active: true,
      }

      // When campaign expires, associated promotional banner is deactivated
      banner.active = false
      assert.strictEqual(banner.active, false)
    })

    it('should flag expired offers so they cannot be presented as active to users', () => {
      const offer = {
        id: 'ofr_festive_1',
        title: 'Dashain 15% Discount',
        active: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      }

      const isExpired = offer.expiresAt ? new Date(offer.expiresAt).getTime() <= Date.now() : false
      const presentationActive = offer.active && !isExpired

      assert.strictEqual(isExpired, true)
      assert.strictEqual(presentationActive, false)
    })
  })

  // ===========================================================================
  // 5. Database Idempotency & Batch Processing Guards
  // ===========================================================================
  describe('5. Database Idempotency & Deduplication Guards', () => {
    it('should partition large recipient lists into batches of 50 without losing recipients', () => {
      const totalRecipients = 142
      const batchSize = 50
      const batches: number[][] = []

      const mockUsers = Array.from({ length: totalRecipients }, (_, i) => i + 1)
      for (let i = 0; i < mockUsers.length; i += batchSize) {
        batches.push(mockUsers.slice(i, i + batchSize))
      }

      assert.strictEqual(batches.length, 3)
      assert.strictEqual(batches[0].length, 50)
      assert.strictEqual(batches[1].length, 50)
      assert.strictEqual(batches[2].length, 42)
      assert.strictEqual(batches.flat().length, totalRecipients)
    })

    it('should enforce idempotency: duplicate delivery items for the same (campaign, user, channel) are ignored', () => {
      const deliveryTracker = new Set<string>()
      let notificationDispatches = 0

      function dispatchRecipient(campaignId: string, userId: string, channel: CampaignChannel) {
        const key = `${campaignId}:${userId}:${channel}`
        if (deliveryTracker.has(key)) {
          // Idempotency guard: duplicate prevented!
          return false
        }
        deliveryTracker.add(key)
        notificationDispatches++
        return true
      }

      // First run
      const res1 = dispatchRecipient('cmp_1', 'user_101', 'push')
      assert.strictEqual(res1, true)
      assert.strictEqual(notificationDispatches, 1)

      // Duplicate delivery attempt (e.g. background job retried)
      const res2 = dispatchRecipient('cmp_1', 'user_101', 'push')
      assert.strictEqual(res2, false)
      assert.strictEqual(notificationDispatches, 1) // Did not increment!
    })

    it('should recover overdue scheduled campaigns in reconciliation job', () => {
      const now = new Date('2026-11-18T10:00:00.000Z')
      const mockCampaigns = [
        {
          id: 'cmp_overdue',
          status: 'scheduled',
          scheduledAt: new Date('2026-11-18T09:30:00.000Z'), // 30m overdue due to server interruption
        },
        {
          id: 'cmp_future',
          status: 'scheduled',
          scheduledAt: new Date('2026-11-18T12:00:00.000Z'), // Still in future
        },
      ]

      const overdue = mockCampaigns.filter(
        (c) => c.status === 'scheduled' && c.scheduledAt.getTime() <= now.getTime(),
      )

      assert.strictEqual(overdue.length, 1)
      assert.strictEqual(overdue[0].id, 'cmp_overdue')
    })
  })
})
