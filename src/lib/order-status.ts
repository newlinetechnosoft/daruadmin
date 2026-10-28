import type { OrderStatus, Order, OrderItem } from '#/server/operations/types'

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'dealer_assigned',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
] as const

export interface UserContext {
  id: string
  role: 'admin' | 'manager' | 'rider' | 'customer' | 'system'
  name: string
}

export interface TransitionOptions {
  note?: string
  cancellationReason?: string
  deliveryFailureReason?: string
  ageVerifiedAtDelivery?: boolean
  adminPaymentOverrideReason?: string
  riderId?: string | null
  overrideRiderCashLimit?: boolean
  riderCashOverrideReason?: string
  riderCashOnHand?: number
  riderCodLimit?: number
  proofPhotoUrl?: string | null
  deliveryOtp?: string | null
  metadata?: Record<string, unknown>
}

export class OrderTransitionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_TRANSITION'
      | 'TERMINAL_STATE'
      | 'UNAUTHORIZED_ROLE'
      | 'OWNERSHIP_MISMATCH'
      | 'MISSING_DEALER'
      | 'MISSING_RIDER'
      | 'UNPAID_ONLINE_ORDER'
      | 'MISSING_AGE_VERIFICATION'
      | 'MISSING_REASON'
      | 'RIDER_CASH_LIMIT_EXCEEDED'
      | 'INVALID_DELIVERY_OTP'
      | 'MISSING_DELIVERY_PROOF',
  ) {
    super(message)
    this.name = 'OrderTransitionError'
  }
}

/**
 * Validates whether an order can transition from its current status to `toStatus`.
 * Throws OrderTransitionError if invalid, or returns `{ ok: true, noop: boolean }`.
 */
export function validateOrderTransition(
  order: Pick<
    Order,
    | 'id'
    | 'status'
    | 'customerId'
    | 'riderId'
    | 'paymentMethod'
    | 'paymentStatus'
    | 'isLegacy'
    | 'deliveryOtp'
  > & {
    items?: Array<Pick<OrderItem, 'id' | 'dealerId' | 'catalogType'>>
  },
  toStatus: OrderStatus,
  user: UserContext,
  options: TransitionOptions = {},
): { ok: true; noop: boolean } {
  const fromStatus = order.status

  // 1. Idempotency check: transition to the same status is a safe no-op
  if (fromStatus === toStatus) {
    return { ok: true, noop: true }
  }

  // 2. Terminal state check: delivered orders cannot transition to any other status
  if (fromStatus === 'delivered') {
    throw new OrderTransitionError(
      `Order ${order.id} is already in terminal state 'delivered' and cannot change status. Post-delivery returns must be handled via credit notes / return documents.`,
      'TERMINAL_STATE',
    )
  }

  // 3. Block unpaid online orders past 'pending' unless admin override with reason
  if (
    fromStatus === 'pending' &&
    toStatus !== 'cancelled' &&
    order.paymentMethod === 'esewa' &&
    order.paymentStatus !== 'paid'
  ) {
    const isOverride =
      user.role === 'admin' &&
      Boolean(options.adminPaymentOverrideReason?.trim())
    if (!isOverride) {
      throw new OrderTransitionError(
        'Online eSewa order has not been paid. Payment must be verified before confirming, or an admin must provide an override reason.',
        'UNPAID_ONLINE_ORDER',
      )
    }
  }

  // 4. Validate allowed transitions and role/ownership constraints
  switch (toStatus) {
    case 'confirmed': {
      if (fromStatus !== 'pending') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'confirmed'. Allowed from: pending.`,
          'INVALID_TRANSITION',
        )
      }
      if (
        user.role !== 'admin' &&
        user.role !== 'manager' &&
        user.role !== 'system'
      ) {
        throw new OrderTransitionError(
          'Only managers or admins can confirm an order.',
          'UNAUTHORIZED_ROLE',
        )
      }
      break
    }

    case 'dealer_assigned': {
      if (fromStatus !== 'confirmed') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'dealer_assigned'. Allowed from: confirmed.`,
          'INVALID_TRANSITION',
        )
      }
      if (
        user.role !== 'admin' &&
        user.role !== 'manager' &&
        user.role !== 'system'
      ) {
        throw new OrderTransitionError(
          'Only managers or admins can assign dealers to an order.',
          'UNAUTHORIZED_ROLE',
        )
      }

      // Every order line item must have a dealer assigned, unless flagged as legacy
      if (!order.isLegacy && order.items && order.items.length > 0) {
        const unassignedItems = order.items.filter((i) => !i.dealerId)
        if (unassignedItems.length > 0) {
          throw new OrderTransitionError(
            `All order items must have a sourcing dealer assigned before moving to 'dealer_assigned'. Found ${unassignedItems.length} unassigned items.`,
            'MISSING_DEALER',
          )
        }
      }
      break
    }

    case 'rider_assigned': {
      // Legacy orders with a rider can transition directly from confirmed
      const allowedFrom =
        order.isLegacy && fromStatus === 'confirmed'
          ? ['confirmed', 'dealer_assigned']
          : ['dealer_assigned']

      if (!allowedFrom.includes(fromStatus)) {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'rider_assigned'. Allowed from: dealer_assigned.`,
          'INVALID_TRANSITION',
        )
      }
      if (
        user.role !== 'admin' &&
        user.role !== 'manager' &&
        user.role !== 'system'
      ) {
        throw new OrderTransitionError(
          'Only managers or admins can assign a rider to an order.',
          'UNAUTHORIZED_ROLE',
        )
      }
      const effectiveRiderId = options.riderId || order.riderId
      if (!effectiveRiderId) {
        throw new OrderTransitionError(
          'A rider must be designated to transition an order to rider_assigned.',
          'MISSING_RIDER',
        )
      }

      // Check COD Cash Limit (default Rs. 20,000 / 2,000,000 paisa)
      if (
        order.paymentMethod === 'cod' &&
        options.riderCashOnHand !== undefined
      ) {
        const cashLimit = options.riderCodLimit ?? 2000000
        if (options.riderCashOnHand >= cashLimit) {
          const isOverride =
            (user.role === 'admin' || user.role === 'manager') &&
            Boolean(
              options.overrideRiderCashLimit &&
              options.riderCashOverrideReason?.trim(),
            )

          if (!isOverride) {
            throw new OrderTransitionError(
              `Rider has exceeded the COD cash limit of Rs. ${(cashLimit / 100).toLocaleString()} (current cash on hand: Rs. ${(options.riderCashOnHand / 100).toLocaleString()}). Handover required before assigning new COD orders.`,
              'RIDER_CASH_LIMIT_EXCEEDED',
            )
          }
        }
      }
      break
    }

    case 'picked_up': {
      if (fromStatus !== 'rider_assigned') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'picked_up'. Allowed from: rider_assigned.`,
          'INVALID_TRANSITION',
        )
      }
      if (user.role === 'rider') {
        if (!order.riderId || order.riderId !== user.id) {
          throw new OrderTransitionError(
            'You are not the assigned rider for this delivery.',
            'OWNERSHIP_MISMATCH',
          )
        }
      } else if (user.role !== 'admin' && user.role !== 'system') {
        throw new OrderTransitionError(
          'Only the assigned rider or an admin can mark an order as picked up.',
          'UNAUTHORIZED_ROLE',
        )
      }
      break
    }

    case 'out_for_delivery': {
      if (fromStatus !== 'picked_up' && fromStatus !== 'delivery_failed') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'out_for_delivery'. Allowed from: picked_up, delivery_failed (reschedule).`,
          'INVALID_TRANSITION',
        )
      }
      if (user.role === 'rider') {
        if (!order.riderId || order.riderId !== user.id) {
          throw new OrderTransitionError(
            'You are not the assigned rider for this delivery.',
            'OWNERSHIP_MISMATCH',
          )
        }
      } else if (
        user.role !== 'admin' &&
        user.role !== 'manager' &&
        user.role !== 'system'
      ) {
        throw new OrderTransitionError(
          'Only the assigned rider, a manager or an admin can dispatch an order out for delivery.',
          'UNAUTHORIZED_ROLE',
        )
      }
      break
    }

    case 'delivered': {
      if (fromStatus !== 'out_for_delivery') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'delivered'. Allowed from: out_for_delivery.`,
          'INVALID_TRANSITION',
        )
      }
      if (user.role === 'rider') {
        if (!order.riderId || order.riderId !== user.id) {
          throw new OrderTransitionError(
            'You are not the assigned rider for this delivery.',
            'OWNERSHIP_MISMATCH',
          )
        }
      } else if (user.role !== 'admin' && user.role !== 'system') {
        throw new OrderTransitionError(
          'Only the assigned rider or an admin can mark an order as delivered.',
          'UNAUTHORIZED_ROLE',
        )
      }

      // Check age verification for orders containing liquor
      const hasLiquor =
        order.items?.some((i) => i.catalogType === 'liquor') ?? false
      if (hasLiquor && !options.ageVerifiedAtDelivery) {
        throw new OrderTransitionError(
          'Liquor orders strictly require age verification (18+) confirmation upon delivery.',
          'MISSING_AGE_VERIFICATION',
        )
      }

      // Verify delivery OTP if supplied and order has an OTP
      if (options.deliveryOtp && order.deliveryOtp) {
        if (options.deliveryOtp.trim() !== order.deliveryOtp.trim()) {
          throw new OrderTransitionError(
            'Invalid delivery verification OTP. Please verify the 4-digit code with the customer or upload photo proof.',
            'INVALID_DELIVERY_OTP',
          )
        }
      }
      break
    }

    case 'delivery_failed': {
      if (fromStatus !== 'out_for_delivery' && fromStatus !== 'picked_up') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'delivery_failed'. Allowed from: out_for_delivery or picked_up.`,
          'INVALID_TRANSITION',
        )
      }
      if (user.role === 'rider') {
        if (!order.riderId || order.riderId !== user.id) {
          throw new OrderTransitionError(
            'You are not the assigned rider for this delivery.',
            'OWNERSHIP_MISMATCH',
          )
        }
      } else if (user.role !== 'admin' && user.role !== 'system') {
        throw new OrderTransitionError(
          'Only the assigned rider or an admin can mark an order as delivery failed.',
          'UNAUTHORIZED_ROLE',
        )
      }
      if (!options.deliveryFailureReason?.trim()) {
        throw new OrderTransitionError(
          'A reason must be specified when recording a failed delivery attempt.',
          'MISSING_REASON',
        )
      }
      break
    }

    case 'returned': {
      if (fromStatus !== 'delivery_failed') {
        throw new OrderTransitionError(
          `Cannot transition order from '${fromStatus}' to 'returned'. Allowed from: delivery_failed.`,
          'INVALID_TRANSITION',
        )
      }
      if (
        user.role !== 'admin' &&
        user.role !== 'manager' &&
        user.role !== 'rider' &&
        user.role !== 'system'
      ) {
        throw new OrderTransitionError(
          'Unauthorized to mark goods as returned to dealer.',
          'UNAUTHORIZED_ROLE',
        )
      }
      break
    }

    case 'cancelled': {
      // Customer cancellation: only allowed on own orders while pending or confirmed
      if (user.role === 'customer') {
        if (order.customerId !== user.id) {
          throw new OrderTransitionError(
            'You cannot cancel an order that belongs to another customer.',
            'OWNERSHIP_MISMATCH',
          )
        }
        if (fromStatus !== 'pending' && fromStatus !== 'confirmed') {
          throw new OrderTransitionError(
            `Customers can only cancel orders in 'pending' or 'confirmed' state. Current state: '${fromStatus}'. Please contact store support.`,
            'INVALID_TRANSITION',
          )
        }
        break
      }

      // Manager/Admin cancellation: allowed from pending, confirmed, dealer_assigned, rider_assigned
      const managerAllowed = [
        'pending',
        'confirmed',
        'dealer_assigned',
        'rider_assigned',
      ]
      if (managerAllowed.includes(fromStatus)) {
        if (
          user.role !== 'admin' &&
          user.role !== 'manager' &&
          user.role !== 'system'
        ) {
          throw new OrderTransitionError(
            'Unauthorized to cancel this order.',
            'UNAUTHORIZED_ROLE',
          )
        }
        break
      }

      // picked_up -> cancelled: ADMIN ONLY with required reason
      if (fromStatus === 'picked_up') {
        if (user.role !== 'admin' && user.role !== 'system') {
          throw new OrderTransitionError(
            'An order that has been picked up from the dealer can only be cancelled by an administrator with an explicit reason.',
            'UNAUTHORIZED_ROLE',
          )
        }
        if (!options.cancellationReason?.trim()) {
          throw new OrderTransitionError(
            'Administrator reason is strictly required to cancel an order after pickup.',
            'MISSING_REASON',
          )
        }
        break
      }

      throw new OrderTransitionError(
        `Cannot cancel an order in state '${fromStatus}'.`,
        'INVALID_TRANSITION',
      )
    }

    case 'pending': {
      throw new OrderTransitionError(
        "Cannot transition an existing order back to 'pending'.",
        'INVALID_TRANSITION',
      )
    }

    default: {
      const _exhaustive: never = toStatus
      throw new OrderTransitionError(
        `Unknown destination order status: ${String(_exhaustive)}`,
        'INVALID_TRANSITION',
      )
    }
  }

  return { ok: true, noop: false }
}

/**
 * Returns list of allowed next statuses for an order and user context.
 */
export function getAvailableOrderTransitions(
  order: Pick<
    Order,
    | 'id'
    | 'status'
    | 'customerId'
    | 'riderId'
    | 'paymentMethod'
    | 'paymentStatus'
    | 'isLegacy'
  > & {
    items?: Array<Pick<OrderItem, 'id' | 'dealerId' | 'catalogType'>>
  },
  user: UserContext,
): OrderStatus[] {
  return ORDER_STATUSES.filter((candidate) => {
    if (candidate === order.status) return false
    try {
      validateOrderTransition(order, candidate, user, {
        cancellationReason: 'preview',
        deliveryFailureReason: 'preview',
        ageVerifiedAtDelivery: true,
        adminPaymentOverrideReason: 'preview',
      })
      return true
    } catch {
      return false
    }
  })
}
