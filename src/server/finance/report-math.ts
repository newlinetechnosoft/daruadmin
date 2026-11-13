/**
 * Pure report math shared by the Accounts UI queries.
 *
 * Keeping these helpers free of database/IO concerns makes the accounting
 * rules easy to test: FIFO payable aging and normal-balance movement.
 */

export interface PayableMovement {
  date: Date
  debit: number
  credit: number
}

export interface PayableAging {
  totalProcured: number
  totalPaid: number
  outstandingPayable: number
  current: number
  days31To60: number
  days61To90: number
  days90Plus: number
  oldestOpenDate: Date | null
  lastActivityDate: Date | null
}

interface OpenPayableItem {
  date: Date
  remaining: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Debit-normal accounts grow with debits; credit-normal accounts grow with
 * credits. Used for running balances in the General Ledger and party
 * statements.
 */
export function signedMovement(
  rootType: string,
  debit: number,
  credit: number,
): number {
  const debitNormal = rootType === 'asset' || rootType === 'expense'
  return debitNormal ? debit - credit : credit - debit
}

/**
 * Accounts-payable FIFO aging.
 *
 * Payments are applied to the oldest outstanding procurement first, exactly
 * how an AP aging report is expected to behave. A payment made before any
 * procurement is treated as an advance and offsets the next procurement.
 * Remaining open procurement lines are then bucketed by age in days
 * (0-30 / 31-60 / 61-90 / 90+).
 *
 * Movements must be supplied in chronological order.
 */
export function computePayableAging(
  movements: PayableMovement[],
  today: Date = new Date(),
): PayableAging {
  let totalProcured = 0
  let totalPaid = 0
  let lastActivityDate: Date | null = null
  let unappliedPayment = 0
  const openItems: OpenPayableItem[] = []

  for (const movement of movements) {
    totalProcured += movement.credit
    totalPaid += movement.debit
    lastActivityDate = movement.date

    if (movement.credit > 0) {
      let procurement = movement.credit
      if (unappliedPayment > 0) {
        const applied = Math.min(unappliedPayment, procurement)
        unappliedPayment -= applied
        procurement -= applied
      }
      if (procurement > 0) {
        openItems.push({ date: movement.date, remaining: procurement })
      }
    }

    let payment = movement.debit
    while (payment > 0 && openItems.length > 0) {
      const oldest = openItems[0]
      const applied = Math.min(oldest.remaining, payment)
      oldest.remaining -= applied
      payment -= applied
      if (oldest.remaining <= 0) openItems.shift()
    }
    if (payment > 0) unappliedPayment += payment
  }

  let current = 0
  let days31To60 = 0
  let days61To90 = 0
  let days90Plus = 0

  for (const item of openItems) {
    const ageDays = Math.max(
      0,
      Math.floor((today.getTime() - item.date.getTime()) / MS_PER_DAY),
    )
    if (ageDays <= 30) current += item.remaining
    else if (ageDays <= 60) days31To60 += item.remaining
    else if (ageDays <= 90) days61To90 += item.remaining
    else days90Plus += item.remaining
  }

  return {
    totalProcured,
    totalPaid,
    outstandingPayable: totalProcured - totalPaid,
    current,
    days31To60,
    days61To90,
    days90Plus,
    oldestOpenDate: openItems[0]?.date ?? null,
    lastActivityDate,
  }
}
