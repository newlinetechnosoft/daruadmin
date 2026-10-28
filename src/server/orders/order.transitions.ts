import { dbTx } from '#/db'
import { orders, orderStatusHistory, riders, notifications } from '#/db/schema'
import { eq } from 'drizzle-orm'
import { validateOrderTransition } from '#/lib/order-status'
import type { UserContext, TransitionOptions } from '#/lib/order-status'
import type { OrderStatus, Order } from '#/server/operations/types'
import { getOrderByIdQuery } from '#/server/orders/order.queries'
import { getRiderByIdQuery } from '#/server/riders/rider.queries'
import { logAudit } from '#/server/auth/permissions'
import { getGoogleMapsUrl } from '#/lib/map-config'
import { postOrderDeliveredTx } from '#/server/finance/double-entry'
import { getStoreSettingsQuery } from '#/server/platform/platform.queries'

export function nid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

export interface TransitionOrderInput {
  orderId: string
  toStatus: OrderStatus
  user: UserContext
  options?: TransitionOptions
}

/**
 * Executes an order transition in a database transaction with role/ownership enforcement,
 * status history audit, and side-effect processing.
 */
export async function transitionOrder(
  input: TransitionOrderInput,
): Promise<{ order: Order; noop: boolean }> {
  return dbTx.transaction(async (tx) => {
    return transitionOrderTx(tx, input)
  })
}

export async function transitionOrderTx(
  tx: Parameters<Parameters<typeof dbTx.transaction>[0]>[0],
  input: TransitionOrderInput,
): Promise<{ order: Order; noop: boolean }> {
  const { orderId, toStatus, user, options = {} } = input

  const existingOrder = await getOrderByIdQuery(orderId)
  if (!existingOrder) {
    throw new Error(`Order not found: ${orderId}`)
  }

  const effectiveRiderId = options.riderId || existingOrder.riderId
  let assignedRiderRecord: any = null
  const mergedOptions: TransitionOptions = { ...options }

  if (effectiveRiderId) {
    assignedRiderRecord = await getRiderByIdQuery(effectiveRiderId)
    if (assignedRiderRecord && toStatus === 'rider_assigned') {
      const settings = await getStoreSettingsQuery()
      mergedOptions.riderCashOnHand = assignedRiderRecord.cashOnHand
      mergedOptions.riderCodLimit = settings.riderCodLimit ?? 2000000
    }
  }

  // 1. Pure validation against the state machine
  const validation = validateOrderTransition(
    existingOrder,
    toStatus,
    user,
    mergedOptions,
  )

  // 2. Idempotency no-op
  if (validation.noop) {
    return { order: existingOrder, noop: true }
  }

  const now = new Date()
  const fromStatus = existingOrder.status
  const updates: Record<string, any> = {
    status: toStatus,
    updatedAt: now,
  }

  if (options.ageVerifiedAtDelivery !== undefined) {
    updates.ageVerifiedAtDelivery = options.ageVerifiedAtDelivery
  }
  if (options.cancellationReason) {
    updates.cancellationReason = options.cancellationReason
  }
  if (options.deliveryFailureReason) {
    updates.deliveryFailureReason = options.deliveryFailureReason
  }
  if (options.riderId !== undefined) {
    updates.riderId = options.riderId
  }

  // Handle COD auto-mark paid when delivered
  if (
    toStatus === 'delivered' &&
    existingOrder.paymentMethod === 'cod' &&
    existingOrder.paymentStatus !== 'paid'
  ) {
    updates.paymentStatus = 'paid'
  }

  if (toStatus === 'delivered') {
    if (options.ageVerifiedAtDelivery) {
      updates.ageVerifiedAtDelivery = true
    }
    if (options.proofPhotoUrl) {
      updates.deliveryProofPhotoUrl = options.proofPhotoUrl
    }
  }

  await tx.update(orders).set(updates).where(eq(orders.id, orderId))

  // 3. Write enhanced audit status history
  const defaultNotes: Record<OrderStatus, string> = {
    pending: 'Order created',
    confirmed: `Order confirmed by ${user.name}`,
    dealer_assigned: `Sourcing dealers assigned by ${user.name}`,
    rider_assigned: `Rider assigned by ${user.name}`,
    picked_up: `Package picked up from dealer by ${user.name}`,
    out_for_delivery: `Order out for delivery with ${user.name}`,
    delivered: `Order delivered by ${user.name}`,
    delivery_failed:
      options.deliveryFailureReason || `Delivery attempt failed: ${user.name}`,
    returned: `Order returned to dealer by ${user.name}`,
    cancelled: options.cancellationReason || `Order cancelled by ${user.name}`,
  }

  const auditMetadata = {
    ...(options.metadata || {}),
    ...(options.proofPhotoUrl ? { proofPhotoUrl: options.proofPhotoUrl } : {}),
    ...(options.deliveryOtp ? { deliveryOtpVerified: true } : {}),
    ...(options.ageVerifiedAtDelivery ? { ageVerified: true } : {}),
  }

  await tx.insert(orderStatusHistory).values({
    id: nid('evt'),
    orderId,
    status: toStatus, // legacy column
    fromStatus,
    toStatus,
    note: options.note || defaultNotes[toStatus],
    actor: user.name, // legacy column
    actorId: user.id,
    actorRole: user.role,
    metadata: Object.keys(auditMetadata).length > 0 ? auditMetadata : null,
    createdAt: now,
  })

  // 4. State Side Effects (in the same transaction)

  // A. Notify assigned rider if an assigned/picked_up order is cancelled
  if (toStatus === 'cancelled' && existingOrder.riderId) {
    const rider = await getRiderByIdQuery(existingOrder.riderId)
    if (rider?.userId) {
      await tx.insert(notifications).values({
        id: nid('notif'),
        userId: rider.userId,
        type: 'order',
        title: `Order ${existingOrder.number} Cancelled`,
        body: `Order ${existingOrder.number} has been cancelled by ${user.name}.`,
        href: '/rider/deliveries',
        read: false,
        createdAt: now,
      })
    }
  }

  // B. Notify assigned rider when newly assigned
  if (
    toStatus === 'rider_assigned' &&
    options.riderId &&
    options.riderId !== existingOrder.riderId
  ) {
    const rider = await getRiderByIdQuery(options.riderId)
    if (rider?.userId) {
      const mapUrl = getGoogleMapsUrl(existingOrder)
      await tx.insert(notifications).values({
        id: nid('notif'),
        title: `New Delivery Assigned: ${existingOrder.number}`,
        body: `Deliver to ${existingOrder.customerName} at ${existingOrder.address}. Map: ${mapUrl}`,
        type: 'rider',
        read: false,
        href: '/rider/deliveries',
        userId: rider.userId,
        createdAt: now,
      })
    }
  }

  // C. Handle Rider status and earnings
  const assignedRiderId = options.riderId || existingOrder.riderId
  if (assignedRiderId) {
    const rider = await getRiderByIdQuery(assignedRiderId)
    if (rider) {
      if (toStatus === 'picked_up' || toStatus === 'out_for_delivery') {
        await tx
          .update(riders)
          .set({ status: 'busy', updatedAt: now })
          .where(eq(riders.id, rider.id))
      } else if (toStatus === 'delivery_failed') {
        await tx
          .update(riders)
          .set({
            status: rider.available ? 'available' : 'offline',
            updatedAt: now,
          })
          .where(eq(riders.id, rider.id))
      } else if (toStatus === 'delivered') {
        const perDrop = rider.perDropRate ?? 5000 // default Rs. 50 (5000 paisa)
        const commissionPct = rider.commissionRate ?? 10
        const commission = Math.round(
          existingOrder.deliveryCharge * (commissionPct / 100),
        )
        const tripEarnings = perDrop + commission
        const newEarnings = rider.earnings + tripEarnings
        let newCashOnHand = rider.cashOnHand

        if (
          existingOrder.paymentMethod === 'cod' &&
          existingOrder.paymentStatus !== 'paid'
        ) {
          newCashOnHand += existingOrder.total
        }

        await tx
          .update(riders)
          .set({
            deliveries: rider.deliveries + 1,
            earnings: newEarnings,
            cashOnHand: newCashOnHand,
            status: rider.available ? 'available' : 'offline',
            updatedAt: now,
          })
          .where(eq(riders.id, rider.id))
      }
    }
  }

  // D. Post Double-Entry Journal on Delivery
  if (toStatus === 'delivered') {
    const deliveringRider =
      assignedRiderRecord ||
      (assignedRiderId ? await getRiderByIdQuery(assignedRiderId) : null)
    await postOrderDeliveredTx(tx, {
      order: existingOrder,
      items: existingOrder.items,
      actor: user,
      rider: deliveringRider
        ? {
            id: deliveringRider.id,
            name: deliveringRider.name,
            perDropRate: deliveringRider.perDropRate,
            commissionRate: deliveringRider.commissionRate,
          }
        : null,
    })
  }

  await logAudit(
    user.name,
    'orders',
    'edit',
    `Transitioned order ${existingOrder.number} from '${fromStatus}' to '${toStatus}'`,
  )

  const updated = await getOrderByIdQuery(orderId)
  return { order: updated!, noop: false }
}
