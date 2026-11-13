import { describe, expect, it } from 'bun:test'
import { computePayableAging, signedMovement } from './report-math'

const DAY = 24 * 60 * 60 * 1000

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function movement(value: string, debit: number, credit: number) {
  return { date: date(value), debit, credit }
}

describe('signedMovement', () => {
  it('uses debit-normal movement for assets and expenses', () => {
    expect(signedMovement('asset', 100, 20)).toBe(80)
    expect(signedMovement('expense', 100, 20)).toBe(80)
  })

  it('uses credit-normal movement for liabilities, equity and revenue', () => {
    expect(signedMovement('liability', 20, 100)).toBe(80)
    expect(signedMovement('equity', 20, 100)).toBe(80)
    expect(signedMovement('revenue', 20, 100)).toBe(80)
  })

  it('handles negative movements without losing the normal side', () => {
    expect(signedMovement('asset', 0, 50)).toBe(-50)
    expect(signedMovement('liability', 0, 50)).toBe(50)
  })
})

describe('computePayableAging', () => {
  const today = date('2026-06-30')

  it('applies payments to the oldest procurement first (FIFO)', () => {
    const result = computePayableAging(
      [
        movement('2026-01-01', 0, 400),
        movement('2026-04-20', 0, 300),
        movement('2026-05-20', 0, 200),
        movement('2026-06-25', 0, 100),
        movement('2026-06-28', 150, 0),
      ],
      today,
    )

    expect(result.totalProcured).toBe(1000)
    expect(result.totalPaid).toBe(150)
    expect(result.outstandingPayable).toBe(850)
    expect(result.days90Plus).toBe(250)
    expect(result.days61To90).toBe(300)
    expect(result.days31To60).toBe(200)
    expect(result.current).toBe(100)
    expect(result.oldestOpenDate?.toISOString()).toBe(
      date('2026-01-01').toISOString(),
    )
    expect(result.lastActivityDate?.toISOString()).toBe(
      date('2026-06-28').toISOString(),
    )
  })

  it('keeps partially paid procurement in its original bucket', () => {
    const result = computePayableAging(
      [movement('2026-03-01', 0, 500), movement('2026-03-10', 200, 0)],
      today,
    )

    expect(result.outstandingPayable).toBe(300)
    expect(result.days90Plus).toBe(300)
    expect(result.current).toBe(0)
  })

  it('applies one payment across multiple open procurements', () => {
    const result = computePayableAging(
      [
        movement('2026-05-01', 0, 100),
        movement('2026-05-10', 0, 200),
        movement('2026-06-01', 150, 0),
      ],
      today,
    )

    expect(result.outstandingPayable).toBe(150)
    expect(result.days31To60).toBe(150)
    expect(result.oldestOpenDate?.toISOString()).toBe(
      date('2026-05-10').toISOString(),
    )
  })

  it('uses an advance paid before procurement against the next purchase', () => {
    const result = computePayableAging(
      [movement('2026-06-01', 100, 0), movement('2026-06-10', 0, 300)],
      today,
    )

    expect(result.totalProcured).toBe(300)
    expect(result.totalPaid).toBe(100)
    expect(result.outstandingPayable).toBe(200)
    expect(result.current).toBe(200)
    expect(result.oldestOpenDate?.toISOString()).toBe(
      date('2026-06-10').toISOString(),
    )
  })

  it('reports an unapplied advance as a negative payable with empty buckets', () => {
    const result = computePayableAging([movement('2026-06-01', 100, 0)], today)

    expect(result.outstandingPayable).toBe(-100)
    expect(result.current).toBe(0)
    expect(result.days31To60).toBe(0)
    expect(result.days61To90).toBe(0)
    expect(result.days90Plus).toBe(0)
    expect(result.oldestOpenDate).toBeNull()
    expect(result.lastActivityDate?.toISOString()).toBe(
      date('2026-06-01').toISOString(),
    )
  })

  it('places open items in the correct aging bucket boundaries', () => {
    const result = computePayableAging(
      [
        movement('2026-05-31', 0, 100), // 30 days
        movement('2026-05-30', 0, 200), // 31 days
        movement('2026-04-30', 0, 300), // 61 days
        movement('2026-03-31', 0, 400), // 91 days
      ],
      today,
    )

    expect(result.current).toBe(100)
    expect(result.days31To60).toBe(200)
    expect(result.days61To90).toBe(300)
    expect(result.days90Plus).toBe(400)
    expect(
      result.current +
        result.days31To60 +
        result.days61To90 +
        result.days90Plus,
    ).toBe(result.outstandingPayable)
  })

  it('does not age future-dated procurement below zero days', () => {
    const result = computePayableAging([movement('2026-07-05', 0, 100)], today)

    expect(result.current).toBe(100)
    expect(result.days31To60).toBe(0)
    expect(result.days61To90).toBe(0)
    expect(result.days90Plus).toBe(0)
  })

  it('returns a zeroed report when there are no movements', () => {
    const result = computePayableAging([], today)

    expect(result).toEqual({
      totalProcured: 0,
      totalPaid: 0,
      outstandingPayable: 0,
      current: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
      oldestOpenDate: null,
      lastActivityDate: null,
    })
  })

  it('uses the current date by default', () => {
    const now = Date.now()
    const result = computePayableAging([
      { date: new Date(now - DAY), debit: 0, credit: 100 },
    ])

    expect(result.current).toBe(100)
  })
})
