import { describe, it, expect } from 'bun:test'
import {
  EXPRESS_DELIVERY_MINUTES,
  formatDurationMinutes,
  formatOrderDeliveryTime,
  getDeliveryDeadline,
  getDeliveryDurationMinutes,
  resolveDeliverySchedule,
} from './delivery-time'

describe('delivery-time helpers', () => {
  describe('resolveDeliverySchedule', () => {
    it('returns null schedule for express or missing slot', () => {
      expect(resolveDeliverySchedule({ deliverySlot: null })).toEqual({
        deliverySlot: null,
        deliveryScheduledFor: null,
      })
      expect(resolveDeliverySchedule({ deliverySlot: 'express' })).toEqual({
        deliverySlot: 'express',
        deliveryScheduledFor: null,
      })
    })

    it('resolves evening slot to today when before 18:00 NPT and tomorrow when past', () => {
      // 2026-11-27 10:00 NPT = 04:15 UTC
      const morning = new Date('2026-11-27T04:15:00.000Z')
      const resToday = resolveDeliverySchedule({
        deliverySlot: 'evening',
        now: morning,
      })
      expect(resToday.deliverySlot).toBe('evening')
      // 18:00 NPT = 12:15 UTC
      expect(resToday.deliveryScheduledFor?.toISOString()).toBe(
        '2026-11-27T12:15:00.000Z',
      )

      // 2026-11-27 19:00 NPT = 13:15 UTC -> rolls to tomorrow
      const night = new Date('2026-11-27T13:15:00.000Z')
      const resTomorrow = resolveDeliverySchedule({
        deliverySlot: 'evening',
        now: night,
      })
      expect(resTomorrow.deliveryScheduledFor?.toISOString()).toBe(
        '2026-11-28T12:15:00.000Z',
      )
    })

    it('resolves custom date and time in store timezone', () => {
      const res = resolveDeliverySchedule({
        deliverySlot: 'custom',
        customDeliveryDate: '2026-11-28',
        customDeliveryTime: '14:30',
      })
      // 14:30 NPT = 08:45 UTC
      expect(res.deliveryScheduledFor?.toISOString()).toBe(
        '2026-11-28T08:45:00.000Z',
      )
    })
  })

  describe('getDeliveryDeadline', () => {
    it('prefers deliveryScheduledFor when present', () => {
      const deadline = getDeliveryDeadline({
        deliveryScheduledFor: '2026-11-27T12:15:00.000Z',
        confirmedAt: '2026-11-27T04:00:00.000Z',
        createdAt: '2026-11-27T03:55:00.000Z',
      })
      expect(deadline?.toISOString()).toBe('2026-11-27T12:15:00.000Z')
    })

    it('falls back to confirmedAt + EXPRESS_DELIVERY_MINUTES', () => {
      const deadline = getDeliveryDeadline({
        deliveryScheduledFor: null,
        confirmedAt: '2026-11-27T04:00:00.000Z',
        createdAt: '2026-11-27T03:50:00.000Z',
      })
      expect(deadline?.toISOString()).toBe(
        new Date(
          new Date('2026-11-27T04:00:00.000Z').getTime() +
            EXPRESS_DELIVERY_MINUTES * 60_000,
        ).toISOString(),
      )
    })

    it('returns null when all timestamps are empty', () => {
      const deadline = getDeliveryDeadline({
        deliveryScheduledFor: null,
        confirmedAt: null,
        createdAt: '',
      })
      expect(deadline).toBeNull()
    })
  })

  describe('getDeliveryDurationMinutes & formatDurationMinutes', () => {
    it('computes minutes between confirmedAt and deliveredAt', () => {
      expect(
        getDeliveryDurationMinutes({
          confirmedAt: '2026-11-27T04:00:00.000Z',
          deliveredAt: '2026-11-27T04:38:00.000Z',
        }),
      ).toBe(38)
      expect(
        getDeliveryDurationMinutes({
          confirmedAt: null,
          deliveredAt: '2026-11-27T04:38:00.000Z',
        }),
      ).toBeNull()
    })

    it('formats minutes and hours concisely', () => {
      expect(formatDurationMinutes(42)).toBe('42m')
      expect(formatDurationMinutes(60)).toBe('1h')
      expect(formatDurationMinutes(95)).toBe('1h 35m')
    })
  })

  describe('formatOrderDeliveryTime', () => {
    it('formats legacy [Slot: ...] notes and express fallback', () => {
      expect(
        formatOrderDeliveryTime({
          deliverySlot: null,
          deliveryScheduledFor: null,
          notes: 'Call at gate [Slot: Evening (6-8 PM)]',
        }),
      ).toBe('Evening (6-8 PM)')

      expect(
        formatOrderDeliveryTime({
          deliverySlot: null,
          deliveryScheduledFor: null,
          notes: '',
        }),
      ).toBe('Express (ASAP)')
    })
  })
})
