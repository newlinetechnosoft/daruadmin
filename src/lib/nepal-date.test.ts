import { describe, expect, it } from 'bun:test'
import {
  adToBs,
  formatBS,
  formatDualDate,
  getNepalFiscalYear,
} from './nepal-date'

describe('Nepal Date & Fiscal Year Utilities', () => {
  it('converts current 2026-10-16 to 30 Ashwin 2083 BS', () => {
    const bs = adToBs(new Date('2026-10-16T00:00:00Z'))
    expect(bs.year).toBe(2083)
    expect(bs.month).toBe(6) // Ashwin
    expect(bs.day).toBe(30)
  })

  it('formats BS date in numeric and long English', () => {
    const dt = new Date('2026-10-16T00:00:00Z')
    expect(formatBS(dt)).toBe('2083-06-30')
    expect(formatBS(dt, { format: 'long' })).toBe('30 Ashwin 2083 BS')
    expect(formatDualDate(dt)).toContain('2083 BS')
  })

  it('determines Nepal Fiscal Year 2083/84 correctly for 2026-10-16', () => {
    const fy = getNepalFiscalYear(new Date('2026-10-16T00:00:00Z'))
    expect(fy.id).toBe('fy-2083-84')
    expect(fy.name).toBe('2083/84')
    expect(fy.startDate.getTime()).toBeLessThan(new Date('2026-10-16').getTime())
    expect(fy.endDate.getTime()).toBeGreaterThan(new Date('2026-10-16').getTime())
  })

  it('determines Nepal Fiscal Year 2081/82 correctly for 2024-08-01', () => {
    const fy = getNepalFiscalYear(new Date('2024-08-01T00:00:00Z'))
    expect(fy.id).toBe('fy-2081-82')
    expect(fy.name).toBe('2081/82')
  })

  it('determines Nepal Fiscal Year 2081/82 correctly for 2025-03-01 (before Shrawan)', () => {
    const fy = getNepalFiscalYear(new Date('2025-03-01T00:00:00Z'))
    expect(fy.id).toBe('fy-2081-82')
    expect(fy.name).toBe('2081/82')
  })
})
