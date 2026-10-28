import { describe, it, expect } from 'bun:test'
import { vatFromInclusive, netFromInclusive } from './tax'
import {
  validateCoupon,
  calculateDeliveryCharge,
  calculateOrderTotals,
  STANDARD_DELIVERY_SETTINGS,
  GROWTH_STAGE_DELIVERY_SETTINGS,
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
  it('defaults to free delivery (0 paisa) during growth stage across all order values', () => {
    expect(calculateDeliveryCharge(50000)).toBe(0)
    expect(calculateDeliveryCharge(299900, GROWTH_STAGE_DELIVERY_SETTINGS)).toBe(0)
    expect(calculateDeliveryCharge(0)).toBe(0)
  })

  it('charges configured delivery fee when admin enables standard delivery rates below threshold', () => {
    const fee = calculateDeliveryCharge(299900, STANDARD_DELIVERY_SETTINGS)
    expect(fee).toBe(15000)
  })

  it('grants free delivery at exactly or above configured free delivery threshold', () => {
    expect(calculateDeliveryCharge(300000, STANDARD_DELIVERY_SETTINGS)).toBe(0)
    expect(calculateDeliveryCharge(450000, STANDARD_DELIVERY_SETTINGS)).toBe(0)
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
      deliverySettings: STANDARD_DELIVERY_SETTINGS,
    })

    expect(totals.subtotalPaisa).toBe(300000)
    expect(totals.discountPaisa).toBe(30000)
    expect(totals.discountedSubtotalPaisa).toBe(270000) // Rs. 2700
    // Merchandise value after discount is 270,000 < 300,000 -> Delivery fee applies!
    expect(totals.deliveryChargePaisa).toBe(15000)
    expect(totals.totalPaisa).toBe(285000) // Rs. 2700 + Rs. 150 = Rs. 2850
    expect(totals.vatPaisa).toBe(vatFromInclusive(270000, 13))
  })

  it('evaluates BOGO and percent offers correctly on matching items', () => {
    const items = [
      {
        catalogType: 'liquor' as const,
        productId: 'prod_beer',
        variantId: 'var_beer_can',
        categoryId: 'cat_beer',
        brandId: 'brand_tuborg',
        name: 'Tuborg Gold Beer Can',
        variantName: '500ml',
        sku: 'TUB-500',
        qty: 4,
        unitPrice: 35000, // Rs 350 each, total 140,000 (Rs. 1,400)
      },
      {
        catalogType: 'grocery' as const,
        productId: 'prod_chips',
        variantId: 'var_chips',
        categoryId: 'cat_snacks',
        brandId: 'brand_lays',
        name: 'Lays Magic Masala',
        variantName: '50g',
        sku: 'LAYS-50',
        qty: 2,
        unitPrice: 5000, // Rs 50 each, total 10,000 (Rs. 100)
      },
    ]

    // Offer 1: BOGO on Beer (buy 2 get 1 free -> for 4 cans, 2 are free = 70,000 paisa discount)
    const bogoOffer = {
      id: 'ofr_bogo_beer',
      title: 'Buy 1 Get 1 Beer',
      slug: 'bogo-beer',
      type: 'bogo' as const,
      scope: 'category' as const,
      scopeId: 'cat_beer',
      discountValue: 0,
      minOrderAmount: 0,
      priority: 10,
      stackable: true,
      active: true,
    }

    // Offer 2: 20% off Snacks
    const snacksOffer = {
      id: 'ofr_snacks_20',
      title: '20% off Snacks',
      slug: 'snacks-20',
      type: 'percent' as const,
      scope: 'category' as const,
      scopeId: 'cat_snacks',
      discountValue: 20, // 20% of 10,000 = 2,000 paisa
      minOrderAmount: 0,
      priority: 5,
      stackable: true,
      active: true,
    }

    const totals = calculateOrderTotals({
      items,
      offers: [bogoOffer, snacksOffer],
    })

    // Subtotal: 140,000 + 10,000 = 150,000 paisa
    expect(totals.subtotalPaisa).toBe(150000)
    // Offer discount: 70,000 (beer BOGO) + 2,000 (snacks 20%) = 72,000 paisa
    expect(totals.offerDiscountPaisa).toBe(72000)
    expect(totals.discountPaisa).toBe(72000)
    expect(totals.discountedSubtotalPaisa).toBe(78000)
    expect(totals.appliedOffers.length).toBe(2)
  })

  it('applies free delivery offer to order regardless of merchandise threshold', () => {
    const items = [
      {
        catalogType: 'liquor' as const,
        productId: 'prod_wine',
        variantId: 'var_wine',
        name: 'Divine Wine',
        variantName: '750ml',
        sku: 'WINE-750',
        qty: 1,
        unitPrice: 85000, // Rs. 850 (< Rs. 3,000)
      },
    ]

    const freeDeliveryOffer = {
      id: 'ofr_free_del',
      title: 'Free Delivery Special',
      slug: 'free-del-special',
      type: 'free_delivery' as const,
      scope: 'all' as const,
      discountValue: 0,
      minOrderAmount: 50000, // min Rs. 500
      priority: 1,
      stackable: true,
      active: true,
    }

    const totals = calculateOrderTotals({
      items,
      offers: [freeDeliveryOffer],
    })

    expect(totals.subtotalPaisa).toBe(85000)
    expect(totals.freeDeliveryGranted).toBe(true)
    expect(totals.deliveryChargePaisa).toBe(0)
    expect(totals.totalPaisa).toBe(85000)
  })
})
