import { z } from 'zod'

/**
 * Normalizes Nepali mobile phone numbers to 10 digits.
 * Accepts formats:
 * - 9801234567
 * - +9779801234567 / +977-9801234567
 * - 9779801234567
 * Valid prefixes: 98, 97
 */
export function normalizeNepaliPhone(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d+]/g, '')
  let normalized = cleaned
  if (normalized.startsWith('+977')) {
    normalized = normalized.slice(4)
  } else if (normalized.startsWith('977') && normalized.length === 13) {
    normalized = normalized.slice(3)
  }

  // Must be 10 digits starting with 97 or 98
  if (/^(98|97)\d{8}$/.test(normalized)) {
    return normalized
  }
  return null
}

export const checkoutItemSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
})

export const checkoutFormSchema = z.object({
  // a) Payment method (required, ONLY two options)
  paymentMethod: z.enum(['cod', 'esewa']),

  // b) Promo code (optional)
  promoCode: z.string().optional(),

  // c) Delivery location (Leaflet map pin + landmark address)
  lat: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  address: z
    .string()
    .min(
      3,
      'Detailed delivery address / landmark is required for rider dispatch',
    ),
  city: z.string().min(2),

  // d) Contact phone number
  phone: z
    .string()
    .min(10, 'Valid 10-digit mobile number is required')
    .refine((val) => normalizeNepaliPhone(val) !== null, {
      message:
        'Must be a valid 10-digit Nepali mobile number (starts with 98 or 97)',
    }),
  savePhoneAsDefault: z.boolean(),

  // e) Delivery time slot & optional delivery instructions
  deliverySlot: z.enum(['express', 'evening', 'late_night']),
  deliveryNotes: z.string().max(300).optional(),

  // Customer items from cart
  items: z.array(checkoutItemSchema).min(1, 'Cart cannot be empty'),

  // Idempotency key for preventing double orders
  idempotencyKey: z.string().min(8).optional(),
})

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>

export const validatePromoSchema = z.object({
  code: z.string().min(1, 'Coupon code cannot be empty'),
  subtotal: z.number().int().nonnegative('Subtotal must be positive paisa'),
})

export type ValidatePromoInput = z.infer<typeof validatePromoSchema>
