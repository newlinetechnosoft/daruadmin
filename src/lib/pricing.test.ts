import { describe, it, expect } from 'bun:test'
import { vatFromInclusive, netFromInclusive } from './tax'
import {
  validateCoupon,
  calculateDeliveryCharge,
  calculateOrderTotals,
} from './pricing'

describe('Nepal VAT & Tax Utilities', () => {
  it('correctly calculates 13% VAT from inclusive retail price', () => {
    // Rs. 113 (11,300 paisa) at 13% VAT -> VAT = 1,300 paisa, Net = 10,000 paisa
    const vat = vatFromInclusive(11300, 13)
    const net = netFromInclusive(11300, 13)
    expect(vat).toBe(1300)
    expect(net).toBe(10000)
    expect(net + vat).toBe(11300)
  })

  it('handles zero or negative amounts gracefully', () => {
    expect(vatFromInclusive(0)).toBe(0)
    expect(vatFromInclusive(-500)).toBe(0)
    expect(netFromInclusive(0)).toBe(0)
  })
})

describe('Delivery Charge Engine', () => {
  it('charges flat Rs. 150 (15,000 paisa) when subtotal is below Rs. 3,000 (300,000 paisa)', () => {
    const fee = calculateDeliveryCharge(299900)
    expect(fee).toBe(15000)
  })

  it('grants free delivery at exactly or above Rs. 3,000 (300,000 paisa)', () => {
    expect(calculateDeliveryCharge(300000)).toBe(0)
    expect(calculateDeliveryCharge(450000)).toBe(0)
  })

  it('allows zone override delivery charge below threshold', () => {
    const fee = calculateDeliveryCharge(200000, {
      defaultDeliveryFeePaisa: 15000,
      freeDeliveryThresholdPaisa: 300000,
      zoneDeliveryChargePaisa: 20000, // Rs. 200 zone
    })
    expect(fee).toBe(20000)
  })
})

describe('Coupon Validation & Limits', () => {
  const activeCoupon = {
    id: 'cp_test_1',
    code: 'FESTIVE10',
    type: 'percent',
    value: 10, // 10%
    minOrder: 100000, // Rs. 1000
    usageLimit: 50,
    used: 10,
    perCustomerLimit: 1,
    firstOrderOnly: false,
    active: true,
    expiresAt: new Date(Date.now() + 86400000), // tomorrow
  }

  it('validates active percent coupon and calculates discount', () => {
    const res = validateCoupon({
      coupon: activeCoupon,
      subtotalPaisa: 200000, // Rs. 2000
      customerOrderCount: 2,
      customerRedemptionCount: 0,
    })
    expect(res.valid).toBe(true)
    expect(res.discountPaisa).toBe(20000) // 10% of 200000 = 20000 (Rs. 200)
  })

  it('rejects coupon when subtotal is below minimum order requirement', () => {
    const res = validateCoupon({
      coupon: activeCoupon,
      subtotalPaisa: 50000, // Rs. 500 < Rs. 1000
    })
    expect(res.valid).toBe(false)
    expect(res.errorReason).toContain('Minimum order')
  })

  it('enforces per-customer redemption limit', () => {
    const res = validateCoupon({
      coupon: activeCoupon,
      subtotalPaisa: 200000,
      customerRedemptionCount: 1, // already redeemed once
    })
    expect(res.valid).toBe(false)
    expect(res.errorReason).toContain('maximum redemptions')
  })

  it('enforces first-order-only restriction', () => {
    const firstOrderCoupon = {
      ...activeCoupon,
      firstOrderOnly: true,
    }
    const res = validateCoupon({
      coupon: firstOrderCoupon,
      subtotalPaisa: 200000,
      customerOrderCount: 1, // existing customer
      customerRedemptionCount: 0,
    })
    expect(res.valid).toBe(false)
    expect(res.errorReason).toContain('first order')
  })
})

describe('Order Totals Calculation', () => {
  it('correctly calculates order total, discount, delivery fee, and VAT components', () => {
    const items = [
      {
        catalogType: 'liquor' as const,
        productId: 'prod_1',
        variantId: 'var_1',
        name: 'Khukri XXX Rum',
        variantName: '750ml',
        sku: 'RUM-750',
        qty: 2,
        unitPrice: 150000, // Rs 1500
      },
    ]

    // Subtotal: 300,000 (Rs. 3000) -> Qualifies for free delivery!
    const totals = calculateOrderTotals({
      items,
      discountPaisa: 30000, // Rs. 300 discount
    })

    expect(totals.subtotalPaisa).toBe(300000)
    expect(totals.discountPaisa).toBe(30000)
    expect(totals.discountedSubtotalPaisa).toBe(270000) // Rs. 2700
    // Merchandise value after discount is 270,000 < 300,000 -> Delivery fee applies!
    expect(totals.deliveryChargePaisa).toBe(15000)
    expect(totals.totalPaisa).toBe(285000) // Rs. 2700 + Rs. 150 = Rs. 2850
    expect(totals.vatPaisa).toBe(vatFromInclusive(270000, 13))
  })
})
