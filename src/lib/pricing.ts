import { vatFromInclusive, DEFAULT_NEPAL_VAT_RATE } from './tax'

export interface PricingItemInput {
  catalogType: 'liquor' | 'grocery'
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  qty: number
  unitPrice: number // in paisa
}

export interface CouponValidationInput {
  coupon: {
    id: string
    code: string
    type: string // 'percent' | 'fixed'
    value: number
    minOrder: number
    usageLimit: number
    used: number
    perCustomerLimit?: number
    firstOrderOnly?: boolean
    active: boolean
    expiresAt: Date | string
  }
  subtotalPaisa: number
  customerOrderCount?: number
  customerRedemptionCount?: number
}

export interface CouponValidationResult {
  valid: boolean
  code?: string
  discountPaisa: number
  errorReason?: string
}

export interface DeliveryPricingSettings {
  defaultDeliveryFeePaisa: number // default 15000 (Rs. 150)
  freeDeliveryThresholdPaisa: number // default 300000 (Rs. 3,000)
  zoneDeliveryChargePaisa?: number | null
}

export const DEFAULT_DELIVERY_SETTINGS: DeliveryPricingSettings = {
  defaultDeliveryFeePaisa: 15000, // Rs. 150
  freeDeliveryThresholdPaisa: 300000, // Rs. 3,000
}

/**
 * Validates a coupon against cart subtotal, global limits, per-customer limits, and first-order rules.
 */
export function validateCoupon(
  input: CouponValidationInput,
): CouponValidationResult {
  const { coupon, subtotalPaisa, customerOrderCount = 0, customerRedemptionCount = 0 } = input

  if (!coupon.active) {
    return { valid: false, discountPaisa: 0, errorReason: 'Coupon is inactive' }
  }

  const expiresAt = new Date(coupon.expiresAt)
  if (expiresAt < new Date()) {
    return { valid: false, discountPaisa: 0, errorReason: 'Coupon has expired' }
  }

  if (coupon.used >= coupon.usageLimit) {
    return {
      valid: false,
      discountPaisa: 0,
      errorReason: 'Coupon total usage limit reached',
    }
  }

  const perCustomerLimit = coupon.perCustomerLimit ?? 1
  if (customerRedemptionCount >= perCustomerLimit) {
    return {
      valid: false,
      discountPaisa: 0,
      errorReason: `You have reached the maximum redemptions (${perCustomerLimit}) for this promo`,
    }
  }

  if (coupon.firstOrderOnly && customerOrderCount > 0) {
    return {
      valid: false,
      discountPaisa: 0,
      errorReason: 'This promo is exclusively valid for your first order',
    }
  }

  if (subtotalPaisa < coupon.minOrder) {
    return {
      valid: false,
      discountPaisa: 0,
      errorReason: `Minimum order of Rs. ${coupon.minOrder / 100} required for this coupon`,
    }
  }

  // Calculate discount in paisa
  let discountPaisa = 0
  if (coupon.type === 'percent') {
    discountPaisa = Math.round(subtotalPaisa * (coupon.value / 100))
  } else {
    discountPaisa = Math.min(subtotalPaisa, coupon.value)
  }

  return {
    valid: true,
    code: coupon.code,
    discountPaisa,
  }
}

/**
 * Calculates delivery charge based on merchandise value after discount.
 * Free delivery threshold applies to net merchandise value (excluding delivery fee).
 */
export function calculateDeliveryCharge(
  merchandiseValuePaisa: number,
  settings: DeliveryPricingSettings = DEFAULT_DELIVERY_SETTINGS,
): number {
  if (merchandiseValuePaisa >= settings.freeDeliveryThresholdPaisa) {
    return 0
  }
  return settings.zoneDeliveryChargePaisa ?? settings.defaultDeliveryFeePaisa
}

/**
 * Comprehensive pricing engine:
 * Subtotal -> Discount -> Delivery Fee -> Tax Breakdown (VAT 13%) -> Final Total.
 */
export function calculateOrderTotals(params: {
  items: PricingItemInput[]
  discountPaisa?: number
  deliverySettings?: DeliveryPricingSettings
  vatRate?: number
}) {
  const {
    items,
    discountPaisa = 0,
    deliverySettings = DEFAULT_DELIVERY_SETTINGS,
    vatRate = DEFAULT_NEPAL_VAT_RATE,
  } = params

  const subtotalPaisa = items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0,
  )

  const effectiveDiscountPaisa = Math.min(subtotalPaisa, Math.max(0, discountPaisa))
  const discountedSubtotalPaisa = subtotalPaisa - effectiveDiscountPaisa

  const deliveryChargePaisa = calculateDeliveryCharge(
    discountedSubtotalPaisa,
    deliverySettings,
  )

  const totalPaisa = discountedSubtotalPaisa + deliveryChargePaisa

  // VAT is included in item prices in Nepal. The VAT component of the merchandise is:
  const vatPaisa = vatFromInclusive(discountedSubtotalPaisa, vatRate)
  const taxableNetPaisa = discountedSubtotalPaisa - vatPaisa

  return {
    subtotalPaisa,
    discountPaisa: effectiveDiscountPaisa,
    discountedSubtotalPaisa,
    deliveryChargePaisa,
    taxableNetPaisa,
    vatPaisa,
    vatRate,
    totalPaisa,
  }
}
