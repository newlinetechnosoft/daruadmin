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
  categoryId?: string | null
  brandId?: string | null
}

export interface ActiveOffer {
  id: string
  title: string
  slug: string
  type: 'bogo' | 'percent' | 'fixed' | 'free_delivery' | 'bundle'
  scope: 'all' | 'category' | 'brand' | 'product' | 'variant'
  scopeId?: string | null
  discountValue: number // percentage or paisa
  minOrderAmount: number // paisa
  priority: number
  stackable: boolean
  active: boolean
  startsAt?: Date | string | null
  expiresAt?: Date | string | null
}

export interface OfferEvaluationResult {
  offerDiscountPaisa: number
  freeDeliveryGranted: boolean
  appliedOffers: {
    id: string
    title: string
    type: string
    discountPaisa: number
  }[]
}

export function evaluateOffers(params: {
  items: PricingItemInput[]
  offers: ActiveOffer[]
  subtotalPaisa: number
}): OfferEvaluationResult {
  const { items, offers, subtotalPaisa } = params
  const now = new Date()

  // Filter valid offers
  const validOffers = offers
    .filter((o) => {
      if (!o.active) return false
      if (o.startsAt && new Date(o.startsAt) > now) return false
      if (o.expiresAt && new Date(o.expiresAt) < now) return false
      if (subtotalPaisa < o.minOrderAmount) return false
      return true
    })
    .sort((a, b) => b.priority - a.priority)

  let totalOfferDiscountPaisa = 0
  let freeDeliveryGranted = false
  const appliedOffers: {
    id: string
    title: string
    type: string
    discountPaisa: number
  }[] = []

  for (const offer of validOffers) {
    // Check which items match scope
    const matchingItems = items.filter((item) => {
      if (offer.scope === 'all') return true
      if (offer.scope === 'category') return item.categoryId === offer.scopeId
      if (offer.scope === 'brand') return item.brandId === offer.scopeId
      if (offer.scope === 'product') return item.productId === offer.scopeId
      if (offer.scope === 'variant') return item.variantId === offer.scopeId
      return false
    })

    if (matchingItems.length === 0 && offer.scope !== 'all') {
      continue
    }

    const matchingSubtotal = matchingItems.reduce(
      (sum, it) => sum + it.unitPrice * it.qty,
      0,
    )

    let discountPaisa = 0

    if (offer.type === 'bogo') {
      // Buy 1 Get 1 free: for every 2 items of matching line, 1 is free
      for (const item of matchingItems) {
        if (item.qty >= 2) {
          const freeCount = Math.floor(item.qty / 2)
          discountPaisa += freeCount * item.unitPrice
        }
      }
    } else if (offer.type === 'percent') {
      discountPaisa = Math.round(matchingSubtotal * (offer.discountValue / 100))
    } else if (offer.type === 'fixed') {
      discountPaisa = Math.min(matchingSubtotal, offer.discountValue)
    } else if (offer.type === 'free_delivery') {
      freeDeliveryGranted = true
    } else if (offer.type === 'bundle') {
      discountPaisa = Math.min(matchingSubtotal, offer.discountValue)
    }

    if (discountPaisa > 0 || offer.type === 'free_delivery') {
      totalOfferDiscountPaisa += discountPaisa
      appliedOffers.push({
        id: offer.id,
        title: offer.title,
        type: offer.type,
        discountPaisa,
      })

      if (!offer.stackable) {
        break
      }
    }
  }

  return {
    offerDiscountPaisa: totalOfferDiscountPaisa,
    freeDeliveryGranted,
    appliedOffers,
  }
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
  const {
    coupon,
    subtotalPaisa,
    customerOrderCount = 0,
    customerRedemptionCount = 0,
  } = input

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
  offers?: ActiveOffer[]
  deliverySettings?: DeliveryPricingSettings
  vatRate?: number
}) {
  const {
    items,
    discountPaisa = 0,
    offers = [],
    deliverySettings = DEFAULT_DELIVERY_SETTINGS,
    vatRate = DEFAULT_NEPAL_VAT_RATE,
  } = params

  const subtotalPaisa = items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0,
  )

  const offerEvaluation = evaluateOffers({ items, offers, subtotalPaisa })
  const totalDiscountPaisa = discountPaisa + offerEvaluation.offerDiscountPaisa

  const effectiveDiscountPaisa = Math.min(
    subtotalPaisa,
    Math.max(0, totalDiscountPaisa),
  )
  const discountedSubtotalPaisa = subtotalPaisa - effectiveDiscountPaisa

  let deliveryChargePaisa = calculateDeliveryCharge(
    discountedSubtotalPaisa,
    deliverySettings,
  )

  if (offerEvaluation.freeDeliveryGranted) {
    deliveryChargePaisa = 0
  }

  const totalPaisa = discountedSubtotalPaisa + deliveryChargePaisa

  // VAT is included in item prices in Nepal. The VAT component of the merchandise is:
  const vatPaisa = vatFromInclusive(discountedSubtotalPaisa, vatRate)
  const taxableNetPaisa = discountedSubtotalPaisa - vatPaisa

  return {
    subtotalPaisa,
    discountPaisa: effectiveDiscountPaisa,
    couponDiscountPaisa: discountPaisa,
    offerDiscountPaisa: offerEvaluation.offerDiscountPaisa,
    appliedOffers: offerEvaluation.appliedOffers,
    freeDeliveryGranted: offerEvaluation.freeDeliveryGranted,
    discountedSubtotalPaisa,
    deliveryChargePaisa,
    taxableNetPaisa,
    vatPaisa,
    vatRate,
    totalPaisa,
  }
}
