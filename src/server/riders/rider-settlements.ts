import type { RiderSettlementPaymentMethod } from '#/server/operations/types'

export const RIDER_SETTLEMENT_PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'cheque',
] as const satisfies readonly RiderSettlementPaymentMethod[]

export const RIDER_SETTLEMENT_METHOD_LABELS: Record<
  RiderSettlementPaymentMethod,
  string
> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
}

export function riderSettlementReferenceRequired(
  method: RiderSettlementPaymentMethod,
): boolean {
  return method === 'bank_transfer' || method === 'cheque'
}

export function getAvailableRiderCash(
  cashOnHand: number,
  pendingAmount: number,
): number {
  return Math.max(0, cashOnHand - Math.max(0, pendingAmount))
}

export interface RiderSettlementRequestValidationInput {
  amount: number
  cashOnHand: number
  pendingAmount: number
  paymentMethod: RiderSettlementPaymentMethod
  paymentReference?: string | null
}

/**
 * Validates a rider's partial settlement request before it enters the admin
 * approval queue. Pending requests still count against the rider's cash float,
 * so a rider cannot request more than they physically hold (including cash
 * already promised in other pending requests).
 */
export function validateRiderSettlementRequest(
  input: RiderSettlementRequestValidationInput,
): { paymentReference: string | null } {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Settlement amount must be greater than zero.')
  }

  const available = getAvailableRiderCash(input.cashOnHand, input.pendingAmount)
  if (input.amount > available) {
    throw new Error(
      `Settlement amount exceeds the available cash on hand (Rs. ${(available / 100).toFixed(2)} available for settlement).`,
    )
  }

  const paymentReference = input.paymentReference?.trim() || ''
  if (
    riderSettlementReferenceRequired(input.paymentMethod) &&
    !paymentReference
  ) {
    throw new Error(
      'Payment reference is required for bank transfer and cheque settlements.',
    )
  }

  return { paymentReference: paymentReference || null }
}
