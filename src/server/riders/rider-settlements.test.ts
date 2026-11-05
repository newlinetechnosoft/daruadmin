import { describe, expect, it } from 'bun:test'
import {
  getAvailableRiderCash,
  riderSettlementReferenceRequired,
  validateRiderSettlementRequest,
} from './rider-settlements'

describe('Rider settlement request validation', () => {
  it('allows cash settlements without a reference', () => {
    const result = validateRiderSettlementRequest({
      amount: 50000,
      cashOnHand: 200000,
      pendingAmount: 0,
      paymentMethod: 'cash',
    })

    expect(result.paymentReference).toBeNull()
  })

  it('requires a reference for bank transfer and cheque settlements', () => {
    expect(riderSettlementReferenceRequired('bank_transfer')).toBe(true)
    expect(riderSettlementReferenceRequired('cheque')).toBe(true)
    expect(riderSettlementReferenceRequired('cash')).toBe(false)

    expect(() =>
      validateRiderSettlementRequest({
        amount: 50000,
        cashOnHand: 200000,
        pendingAmount: 0,
        paymentMethod: 'bank_transfer',
        paymentReference: '   ',
      }),
    ).toThrow('Payment reference is required')

    expect(() =>
      validateRiderSettlementRequest({
        amount: 50000,
        cashOnHand: 200000,
        pendingAmount: 0,
        paymentMethod: 'cheque',
      }),
    ).toThrow('Payment reference is required')
  })

  it('stores a trimmed reference for bank transfer and cheque', () => {
    const result = validateRiderSettlementRequest({
      amount: 50000,
      cashOnHand: 200000,
      pendingAmount: 0,
      paymentMethod: 'cheque',
      paymentReference: '  CHQ-90210  ',
    })

    expect(result.paymentReference).toBe('CHQ-90210')
  })

  it('allows partial payments up to the available cash on hand', () => {
    expect(() =>
      validateRiderSettlementRequest({
        amount: 150000,
        cashOnHand: 200000,
        pendingAmount: 0,
        paymentMethod: 'cash',
      }),
    ).not.toThrow()
  })

  it('counts pending requests against the available cash', () => {
    expect(getAvailableRiderCash(200000, 50000)).toBe(150000)

    expect(() =>
      validateRiderSettlementRequest({
        amount: 160000,
        cashOnHand: 200000,
        pendingAmount: 50000,
        paymentMethod: 'cash',
      }),
    ).toThrow('available cash on hand')
  })

  it('rejects zero, negative, fractional, and over-limit amounts', () => {
    for (const amount of [0, -100, 100.5]) {
      expect(() =>
        validateRiderSettlementRequest({
          amount,
          cashOnHand: 200000,
          pendingAmount: 0,
          paymentMethod: 'cash',
        }),
      ).toThrow('greater than zero')
    }

    expect(() =>
      validateRiderSettlementRequest({
        amount: 200001,
        cashOnHand: 200000,
        pendingAmount: 0,
        paymentMethod: 'cash',
      }),
    ).toThrow('available cash on hand')
  })
})
