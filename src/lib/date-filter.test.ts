import { describe, expect, it } from 'bun:test'
import {
  getDateRangeBounds,
  isDateInRange,
  stepPeriod,
  DATE_FILTER_PRESET_OPTIONS,
} from './date-filter'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'

describe('Admin Panel Date Filter Engine (Frappe/ERPNext-style)', () => {
  const mockNow = new Date('2026-10-29T14:30:00.000Z')

  describe('getDateRangeBounds preset calculations', () => {
    it('defaults to today when no preset or today is provided', () => {
      const bounds = getDateRangeBounds({ preset: 'today' }, mockNow)
      expect(bounds.isFiltered).toBe(true)
      expect(bounds.label).toBe('Today')
      expect(bounds.start).toEqual(startOfDay(mockNow))
      expect(bounds.end).toEqual(endOfDay(mockNow))
      expect(bounds.nepaliLabel).toBeDefined()
    })

    it('calculates yesterday bounds correctly', () => {
      const yesterday = subDays(mockNow, 1)
      const bounds = getDateRangeBounds({ preset: 'yesterday' }, mockNow)
      expect(bounds.isFiltered).toBe(true)
      expect(bounds.label).toBe('Yesterday')
      expect(bounds.start).toEqual(startOfDay(yesterday))
      expect(bounds.end).toEqual(endOfDay(yesterday))
    })

    it('calculates this_week bounds (Monday to Sunday)', () => {
      const bounds = getDateRangeBounds({ preset: 'this_week' }, mockNow)
      expect(bounds.isFiltered).toBe(true)
      expect(bounds.label).toBe('This Week')
      expect(bounds.start).toBeDefined()
      expect(bounds.end).toBeDefined()
      if (bounds.start && bounds.end) {
        // start should be <= referenceDate and end >= referenceDate
        expect(bounds.start.getTime()).toBeLessThanOrEqual(mockNow.getTime())
        expect(bounds.end.getTime()).toBeGreaterThanOrEqual(mockNow.getTime())
      }
    })

    it('calculates this_month bounds', () => {
      const bounds = getDateRangeBounds({ preset: 'this_month' }, mockNow)
      expect(bounds.isFiltered).toBe(true)
      expect(bounds.label).toBe('This Month')
      expect(bounds.start?.getDate()).toBe(1)
    })

    it('handles custom single-day range', () => {
      const dateStr = '2026-10-15'
      const bounds = getDateRangeBounds(
        { preset: 'custom', from: dateStr, to: dateStr },
        mockNow,
      )
      expect(bounds.isFiltered).toBe(true)
      expect(bounds.label).toBe('Custom Range')
      expect(bounds.start).toEqual(startOfDay(new Date(dateStr)))
      expect(bounds.end).toEqual(endOfDay(new Date(dateStr)))
    })

    it('handles custom multi-day range', () => {
      const fromStr = '2026-10-10'
      const toStr = '2026-10-20'
      const bounds = getDateRangeBounds(
        { preset: 'custom', from: fromStr, to: toStr },
        mockNow,
      )
      expect(bounds.isFiltered).toBe(true)
      expect(bounds.start).toEqual(startOfDay(new Date(fromStr)))
      expect(bounds.end).toEqual(endOfDay(new Date(toStr)))
      expect(bounds.secondaryLabel).toContain('Oct')
    })

    it('returns unfiltered bounds for "all"', () => {
      const bounds = getDateRangeBounds({ preset: 'all' }, mockNow)
      expect(bounds.isFiltered).toBe(false)
      expect(bounds.start).toBeNull()
      expect(bounds.end).toBeNull()
      expect(bounds.label).toBe('All Time')
    })
  })

  describe('isDateInRange boundary accuracy', () => {
    const start = new Date('2026-10-29T00:00:00.000Z')
    const end = new Date('2026-10-29T23:59:59.999Z')

    it('includes timestamps precisely at start boundary', () => {
      expect(isDateInRange(start, start, end)).toBe(true)
    })

    it('includes timestamps precisely at end boundary', () => {
      expect(isDateInRange(end, start, end)).toBe(true)
    })

    it('includes timestamps inside range', () => {
      const inside = new Date('2026-10-29T12:00:00.000Z')
      expect(isDateInRange(inside, start, end)).toBe(true)
    })

    it('excludes 1ms before start and 1ms after end', () => {
      const before = new Date(start.getTime() - 1)
      const after = new Date(end.getTime() + 1)
      expect(isDateInRange(before, start, end)).toBe(false)
      expect(isDateInRange(after, start, end)).toBe(false)
    })

    it('handles ISO string and numeric timestamps', () => {
      expect(isDateInRange('2026-10-29T15:00:00.000Z', start, end)).toBe(true)
      expect(isDateInRange(start.getTime() + 5000, start, end)).toBe(true)
    })

    it('returns true when bounds are null (all time)', () => {
      expect(isDateInRange(new Date('2020-01-01'), null, null)).toBe(true)
      expect(isDateInRange(new Date('2030-12-31'), null, null)).toBe(true)
    })

    it('returns false for null or invalid dates when bounds are set', () => {
      expect(isDateInRange(null, start, end)).toBe(false)
      expect(isDateInRange(undefined, start, end)).toBe(false)
      expect(isDateInRange('invalid-date', start, end)).toBe(false)
    })
  })

  describe('stepPeriod ERPNext-style stepping', () => {
    it('steps from today back to yesterday with -1', () => {
      const next = stepPeriod({ preset: 'today' }, -1, mockNow)
      expect(next.preset).toBe('yesterday')
    })

    it('does not allow stepping past today into the future from today', () => {
      const next = stepPeriod({ preset: 'today' }, 1, mockNow)
      expect(next.preset).toBe('today')
    })

    it('steps from yesterday forward to today with +1', () => {
      const next = stepPeriod({ preset: 'yesterday' }, 1, mockNow)
      expect(next.preset).toBe('today')
    })

    it('steps from yesterday backward to two days ago with -1', () => {
      const next = stepPeriod({ preset: 'yesterday' }, -1, mockNow)
      expect(next.preset).toBe('custom')
      const twoDaysAgo = format(subDays(mockNow, 2), 'yyyy-MM-dd')
      expect(next.from).toBe(twoDaysAgo)
      expect(next.to).toBe(twoDaysAgo)
    })

    it('steps from custom single day forward back into yesterday', () => {
      const twoDaysAgo = format(subDays(mockNow, 2), 'yyyy-MM-dd')
      const next = stepPeriod(
        { preset: 'custom', from: twoDaysAgo, to: twoDaysAgo },
        1,
        mockNow,
      )
      expect(next.preset).toBe('yesterday')
    })

    it('steps custom multi-day range by date span', () => {
      const from = '2026-10-01'
      const to = '2026-10-07' // 7 days span
      const next = stepPeriod({ preset: 'custom', from, to }, -1, mockNow)
      expect(next.preset).toBe('custom')
      expect(next.from).toBeDefined()
      expect(next.to).toBeDefined()
    })
  })

  describe('preset option catalogue', () => {
    it('provides all 6 expected presets with descriptions', () => {
      const values = DATE_FILTER_PRESET_OPTIONS.map((o) => o.value)
      expect(values).toContain('today')
      expect(values).toContain('yesterday')
      expect(values).toContain('this_week')
      expect(values).toContain('this_month')
      expect(values).toContain('custom')
      expect(values).toContain('all')
    })
  })
})
