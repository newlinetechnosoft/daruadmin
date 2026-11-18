import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_TIMEZONE,
  parseDateTimeToUtc,
  formatInTimezone,
  formatUtcToParts,
  validateCampaignSchedule,
  getTimezoneMeta,
} from './campaign-timezone'

describe('Campaign Timezone Engine', () => {
  it('defaults to Asia/Kathmandu (Nepal Standard Time, UTC+05:45)', () => {
    assert.equal(DEFAULT_TIMEZONE, 'Asia/Kathmandu')
    assert.equal(getTimezoneMeta('Asia/Kathmandu').shortLabel, 'NPT')
  })

  it('correctly converts Kathmandu local time to UTC', () => {
    // 2026-11-18 10:00:00 NPT is UTC 04:15:00
    const utcDate = parseDateTimeToUtc('2026-11-18', '10:00', 'Asia/Kathmandu')
    assert.equal(utcDate.toISOString(), '2026-11-18T04:15:00.000Z')
  })

  it('correctly formats UTC to Kathmandu local time string', () => {
    const utcDate = new Date('2026-11-18T04:15:00.000Z')
    const formatted = formatInTimezone(utcDate, 'Asia/Kathmandu')
    assert.ok(formatted.includes('2026'))
    assert.ok(formatted.includes('10:00'))
    assert.ok(formatted.includes('NPT'))
  })

  it('splits UTC date back into local date and time components', () => {
    const utcDate = new Date('2026-11-18T04:15:00.000Z')
    const split = formatUtcToParts(utcDate, 'Asia/Kathmandu')
    assert.equal(split.dateStr, '2026-11-18')
    assert.equal(split.timeStr, '10:00')
  })

  describe('Validation Rules', () => {
    it('rejects publication times scheduled in the past', () => {
      const result = validateCampaignSchedule({
        scheduledDate: '2020-01-01',
        scheduledTime: '12:00',
        timezone: 'Asia/Kathmandu',
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes('cannot be in the past')))
    })

    it('rejects expiry times earlier than or equal to scheduled publication', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const dateStr = futureDate.toISOString().slice(0, 10)

      const result = validateCampaignSchedule({
        scheduledDate: dateStr,
        scheduledTime: '18:00',
        expiryDate: dateStr,
        expiryTime: '17:00', // earlier than scheduled
        timezone: 'Asia/Kathmandu',
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes('must be later than')))
    })

    it('accepts valid future schedule with subsequent expiry', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const afterDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const dateStr1 = futureDate.toISOString().slice(0, 10)
      const dateStr2 = afterDate.toISOString().slice(0, 10)

      const result = validateCampaignSchedule({
        scheduledDate: dateStr1,
        scheduledTime: '10:00',
        expiryDate: dateStr2,
        expiryTime: '22:00',
        timezone: 'Asia/Kathmandu',
      })
      assert.equal(result.valid, true)
      assert.equal(result.errors.length, 0)
      assert.ok(result.scheduledUtc instanceof Date)
      assert.ok(result.expiresUtc instanceof Date)
    })
  })
})
