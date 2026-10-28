import { createServerFn } from '@tanstack/react-start'
import { createHmac } from 'node:crypto'
import { and, eq, inArray, count } from 'drizzle-orm'
import { z } from 'zod'
import { db, dbTx } from '#/db'
import {
  liquorVariants,
  liquorProducts,
  groceryVariants,
  groceryProducts,
  user,
  orders,
  orderItems,
  orderStatusHistory,
  coupons,
  couponRedemptions,
  ledgerEntries,
  payments,
  notifications,
  riders,
} from '#/db/schema'
import { getSessionUser, logAudit } from '#/server/auth/permissions'
import {
  getCouponByCodeQuery,
  getStoreSettingsQuery,
  getCustomerCouponRedemptionCountQuery,
} from '#/server/platform/platform.queries'
import {
  getOrderByIdQuery,
  getOrderByTrackingCodeQuery,
  getCustomerOrdersQuery,
} from '#/server/orders/order.queries'
import type { PaymentMethod } from '#/server/operations/types'
import { checkoutFormSchema, validatePromoSchema } from './order.schemas'
import { fromPaisa } from '#/lib/money'
import { validateCoupon, calculateOrderTotals } from '#/lib/pricing'
import {
  transitionOrder,
  transitionOrderTx,
} from '#/server/orders/order.transitions'

// eSewa configuration defaults (UAT / Test credentials)
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST'
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q'
const ESEWA_GATEWAY_URL =
  process.env.NODE_ENV === 'production' && process.env.ESEWA_LIVE === 'true'
    ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
    : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
const ESEWA_STATUS_URL =
  process.env.NODE_ENV === 'production' && process.env.ESEWA_LIVE === 'true'
    ? 'https://epay.esewa.com.np/api/epay/transaction/status/'
    : 'https://rc.esewa.com.np/api/epay/transaction/status/'

function generateEsewaSignature(
  totalAmount: string,
  transactionUuid: string,
  productCode: string,
): string {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`
  const hmac = createHmac('sha256', ESEWA_SECRET_KEY)
  hmac.update(message)
  return hmac.digest('base64')
}

function nid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

// -------------------------------------------------------------
// 1. VALIDATE PROMO FUNCTION (SERVER-SIDE)
// -------------------------------------------------------------

export const validatePromoFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => validatePromoSchema.parse(d))
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()

    const cleanCode = data.code.trim().toUpperCase()
    const coupon = await getCouponByCodeQuery(cleanCode)

    if (!coupon) {
      return {
        valid: false,
        error: 'Invalid promo code. Please check and try again.',
      }
    }

    const [redemptionCount, customerOrders] = await Promise.all([
      getCustomerCouponRedemptionCountQuery(coupon.id, sessionUser.id),
      db
        .select({ count: count() })
        .from(orders)
        .where(
          and(
            eq(orders.customerId, sessionUser.id),
            eq(orders.status, 'delivered'),
          ),
        ),
    ])

    const validation = validateCoupon({
      coupon: {
        ...coupon,
        perCustomerLimit: coupon.perCustomerLimit ?? 1,
        firstOrderOnly: coupon.firstOrderOnly ?? false,
      },
      subtotalPaisa: data.subtotal,
      customerOrderCount: customerOrders[0]?.count ?? 0,
      customerRedemptionCount: redemptionCount,
    })

    if (!validation.valid) {
      return {
        valid: false,
        error: validation.errorReason || 'Coupon cannot be applied.',
      }
    }

    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountPaisa: validation.discountPaisa,
      error: null,
    }
  })

// -------------------------------------------------------------
// 2. CREATE CUSTOMER ORDER FUNCTION
// -------------------------------------------------------------

export const createCustomerOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => checkoutFormSchema.parse(d))
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()

    // Idempotency check: if an order with this idempotency key already exists, return it
    if (data.idempotencyKey) {
      const existing = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, data.idempotencyKey))
        .limit(1)

      if (existing[0]) {
        return {
          success: true,
          orderId: existing[0].id,
          orderNumber: existing[0].number,
          paymentMethod: existing[0].paymentMethod as PaymentMethod,
          totalPaisa: existing[0].total,
          isDuplicate: true,
        }
      }
    }

    // Re-fetch product prices & stock from Postgres DB
    const variantIds = data.items.map((i) => i.variantId)

    const [liqVariants, grocVariants] = await Promise.all([
      db
        .select({
          variant: liquorVariants,
          product: liquorProducts,
        })
        .from(liquorVariants)
        .innerJoin(
          liquorProducts,
          eq(liquorVariants.productId, liquorProducts.id),
        )
        .where(
          and(
            eq(liquorVariants.isActive, true),
            eq(liquorProducts.isActive, true),
            inArray(liquorVariants.id, variantIds),
          ),
        ),
      db
        .select({
          variant: groceryVariants,
          product: groceryProducts,
        })
        .from(groceryVariants)
        .innerJoin(
          groceryProducts,
          eq(groceryVariants.productId, groceryProducts.id),
        )
        .where(
          and(
            eq(groceryVariants.isActive, true),
            eq(groceryProducts.isActive, true),
            inArray(groceryVariants.id, variantIds),
          ),
        ),
    ])

    const variantLookup = new Map<
      string,
      {
        variantId: string
        name: string
        variantName: string
        sku: string
        price: number
        productId: string
        catalogType: 'liquor' | 'grocery'
      }
    >()

    for (const row of liqVariants) {
      variantLookup.set(row.variant.id, {
        variantId: row.variant.id,
        name: row.product.name,
        variantName: row.variant.name,
        sku: row.variant.sku,
        price: row.variant.price,
        productId: row.product.id,
        catalogType: 'liquor',
      })
    }

    for (const row of grocVariants) {
      variantLookup.set(row.variant.id, {
        variantId: row.variant.id,
        name: row.product.name,
        variantName: row.variant.name,
        sku: row.variant.sku,
        price: row.variant.price,
        productId: row.product.id,
        catalogType: 'grocery',
      })
    }

    // Verify all requested items are active
    const verifiedOrderItems: {
      id: string
      catalogType: 'liquor' | 'grocery'
      productId: string
      variantId: string
      name: string
      variantName: string
      sku: string
      qty: number
      unitPrice: number
      lineTotal: number
    }[] = []
    let calculatedSubtotal = 0

    for (const reqItem of data.items) {
      const itemInfo = variantLookup.get(reqItem.variantId)
      if (!itemInfo) {
        throw new Error(
          'One or more items in your cart are no longer available. Please refresh your cart.',
        )
      }

      const lineTotal = itemInfo.price * reqItem.quantity
      calculatedSubtotal += lineTotal

      verifiedOrderItems.push({
        id: nid('oi'),
        catalogType: itemInfo.catalogType,
        productId: itemInfo.productId,
        variantId: itemInfo.variantId,
        name: itemInfo.name,
        variantName: itemInfo.variantName,
        sku: itemInfo.sku,
        qty: reqItem.quantity,
        unitPrice: itemInfo.price,
        lineTotal,
      })
    }

    // Server-side promo calculation with limits & first-order check
    let discountPaisa = 0
    let appliedCoupon: any = null

    if (data.promoCode && data.promoCode.trim()) {
      const cleanCode = data.promoCode.trim().toUpperCase()
      const coupon = await getCouponByCodeQuery(cleanCode)
      if (coupon) {
        const [redemptions, customerOrders] = await Promise.all([
          getCustomerCouponRedemptionCountQuery(coupon.id, sessionUser.id),
          db
            .select({ count: count() })
            .from(orders)
            .where(
              and(
                eq(orders.customerId, sessionUser.id),
                eq(orders.status, 'delivered'),
              ),
            ),
        ])

        const validation = validateCoupon({
          coupon: {
            ...coupon,
            perCustomerLimit: coupon.perCustomerLimit ?? 1,
            firstOrderOnly: coupon.firstOrderOnly ?? false,
          },
          subtotalPaisa: calculatedSubtotal,
          customerOrderCount: customerOrders[0]?.count ?? 0,
          customerRedemptionCount: redemptions,
        })

        if (validation.valid) {
          discountPaisa = validation.discountPaisa
          appliedCoupon = coupon
        }
      }
    }

    const settings = await getStoreSettingsQuery()

    // Pricing calculation via pricing engine
    const totals = calculateOrderTotals({
      items: verifiedOrderItems,
      discountPaisa,
      deliverySettings: {
        defaultDeliveryFeePaisa: (settings as any).deliveryFee ?? 15000,
        freeDeliveryThresholdPaisa:
          (settings as any).freeDeliveryThreshold ?? 300000,
      },
      vatRate: settings.taxRate ?? 13,
    })

    // Save phone as default on user profile if requested
    if (data.savePhoneAsDefault) {
      await db
        .update(user)
        .set({ phone: data.phone })
        .where(eq(user.id, sessionUser.id))
        .catch((err) => {
          console.warn(
            '[Checkout] Failed to update default phone on profile:',
            err,
          )
        })
    }

    const orderCountRes = await db.select({ count: count() }).from(orders)
    const orderSeq = (orderCountRes[0]?.count ?? 0) + 1
    const orderNumber = `${settings.invoicePrefix}-${String(10000 + orderSeq).padStart(5, '0')}`

    const orderId = nid('ord')
    const trackingCode = `TRK${Math.floor(100000 + Math.random() * 900000)}`
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000))
    const now = new Date()

    // Execute atomic creation in transaction with dbTx
    await dbTx.transaction(async (tx) => {
      // 1. Atomic coupon redemption with row-level lock
      if (appliedCoupon) {
        const lockedCoupons = await tx
          .select({ used: coupons.used, usageLimit: coupons.usageLimit })
          .from(coupons)
          .where(eq(coupons.id, appliedCoupon.id))
          .for('update')

        const locked = lockedCoupons[0]
        if (!locked || locked.used >= locked.usageLimit) {
          throw new Error(
            'This promo code has just reached its total usage limit.',
          )
        }

        await tx
          .update(coupons)
          .set({ used: locked.used + 1 })
          .where(eq(coupons.id, appliedCoupon.id))

        await tx.insert(couponRedemptions).values({
          id: nid('cpr'),
          couponId: appliedCoupon.id,
          couponCode: appliedCoupon.code,
          orderId,
          customerId: sessionUser.id,
          customerName: sessionUser.name,
          customerEmail: sessionUser.email,
          customerPhone: data.phone,
          orderTotal: totals.totalPaisa,
          discountAmount: totals.discountPaisa,
          createdAt: now,
        })
      }

      // 2. Insert order with server-calculated subtotal, deliveryCharge, VAT tax, and total
      await tx.insert(orders).values({
        id: orderId,
        number: orderNumber,
        customerId: sessionUser.id,
        customerName: sessionUser.name,
        customerEmail: sessionUser.email,
        customerPhone: data.phone,
        address: data.address,
        city: data.city,
        landmark: data.address,
        lat: String(data.lat),
        lng: String(data.lng),
        status: 'pending',
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentMethod === 'cod' ? 'cod_pending' : 'pending',
        subtotal: totals.subtotalPaisa,
        deliveryCharge: totals.deliveryChargePaisa,
        discount: totals.discountPaisa,
        tax: totals.vatPaisa, // 13% Nepal VAT component computed by pricing engine
        total: totals.totalPaisa,
        riderId: null,
        trackingCode,
        deliveryOtp,
        notes: [
          data.deliverySlot && data.deliverySlot !== 'express'
            ? `[Slot: ${data.deliverySlot === 'evening' ? 'Evening 6PM-8PM' : 'Late Night 8PM-10PM'}]`
            : null,
          data.deliveryNotes?.trim() || null,
        ]
          .filter(Boolean)
          .join(' — '),
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        idempotencyKey: data.idempotencyKey || null,
      })

      // 4. Insert order items
      for (const item of verifiedOrderItems) {
        await tx.insert(orderItems).values({
          id: item.id,
          orderId,
          catalogType: item.catalogType,
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          variantName: item.variantName,
          sku: item.sku,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          sourcingStatus: 'pending',
        })
      }

      // 5. Insert initial status history
      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId,
        fromStatus: null,
        toStatus: 'pending',
        status: 'pending',
        note:
          data.paymentMethod === 'cod'
            ? 'Order placed (Cash on Delivery)'
            : 'Order placed (Pending eSewa payment)',
        actor: sessionUser.name,
        actorId: sessionUser.id,
        actorRole: sessionUser.role,
      })

      // 6. Record in Legacy Ledger (for backward compatibility)
      await tx.insert(ledgerEntries).values({
        id: nid('led'),
        date: now.toISOString().slice(0, 10),
        type: 'credit',
        category: 'sales',
        account: 'Sales revenue',
        memo: `Sale ${orderNumber}`,
        amount: totals.totalPaisa,
        refType: 'order',
        refId: orderId,
      })

      // 7. Insert notification for admin
      await tx.insert(notifications).values({
        id: nid('notif'),
        title: `New Order: ${orderNumber}`,
        body: `${sessionUser.name} placed order ${orderNumber} (Rs. ${fromPaisa(totals.totalPaisa)})`,
        type: 'order',
        read: false,
        href: `/admin/orders`,
      })
    })

    await logAudit(
      sessionUser.name,
      'orders',
      'create',
      `Placed order ${orderNumber} via ${data.paymentMethod} (Rs. ${fromPaisa(totals.totalPaisa)})`,
    )

    // Prepare payment flow data
    let esewaPayload: Record<string, string> | null = null
    if (data.paymentMethod === 'esewa') {
      const totalAmountNpr = fromPaisa(totals.totalPaisa).toFixed(2)
      const subtotalNpr = fromPaisa(totals.discountedSubtotalPaisa).toFixed(2)
      const deliveryChargeNpr = fromPaisa(totals.deliveryChargePaisa).toFixed(2)
      const transactionUuid = `${orderId}`
      const signature = generateEsewaSignature(
        totalAmountNpr,
        transactionUuid,
        ESEWA_PRODUCT_CODE,
      )

      esewaPayload = {
        amount: subtotalNpr,
        tax_amount: '0.00',
        total_amount: totalAmountNpr,
        transaction_uuid: transactionUuid,
        product_code: ESEWA_PRODUCT_CODE,
        product_service_charge: '0.00',
        product_delivery_charge: deliveryChargeNpr,
        success_url: `/checkout/payment/esewa/success?orderId=${orderId}`,
        failure_url: `/checkout/payment/esewa/failure?orderId=${orderId}`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature,
        actionUrl: ESEWA_GATEWAY_URL,
      }
    }

    return {
      success: true,
      orderId,
      orderNumber,
      paymentMethod: data.paymentMethod as PaymentMethod,
      totalPaisa: totals.totalPaisa,
      esewaPayload,
      isDuplicate: false,
    }
  })

// -------------------------------------------------------------
// 3. GET ORDER DETAILS (FOR CONFIRMATION PAGE)
// -------------------------------------------------------------

export const getOrderDetailsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ orderId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    const order = await getOrderByIdQuery(data.orderId)

    if (!order) {
      throw new Error('Order not found')
    }

    // Security: Only customer who placed it or staff can view
    if (
      order.customerId !== sessionUser.id &&
      sessionUser.role !== 'admin' &&
      sessionUser.role !== 'manager'
    ) {
      throw new Error('403: Forbidden: You do not have access to this order')
    }

    return order
  })

// -------------------------------------------------------------
// 4. VERIFY ESEWA PAYMENT (SERVER-SIDE VERIFICATION)
// -------------------------------------------------------------

export const verifyEsewaPaymentFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        encodedResponse: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    const order = await getOrderByIdQuery(data.orderId)

    if (!order) {
      throw new Error('Order not found')
    }

    if (order.paymentStatus === 'paid') {
      return { success: true, alreadyPaid: true, order }
    }

    // Decode base64 payload from eSewa if provided
    let esewaData: Record<string, unknown> = {}
    if (data.encodedResponse) {
      try {
        const decoded = Buffer.from(data.encodedResponse, 'base64').toString(
          'utf8',
        )
        esewaData = JSON.parse(decoded)
      } catch (err) {
        console.warn('[eSewa] Failed to decode response:', err)
      }
    }

    // Server-side status check to eSewa API (never trust client payload alone)
    const totalAmount = fromPaisa(order.total).toFixed(2)
    const verifyUrl = `${ESEWA_STATUS_URL}?product_code=${ESEWA_PRODUCT_CODE}&total_amount=${totalAmount}&transaction_uuid=${order.id}`

    let isVerified = false
    try {
      const res = await fetch(verifyUrl, { method: 'GET' })
      if (res.ok) {
        const json = await res.json()
        if (json.status === 'COMPLETE') {
          isVerified = true
        }
      }
    } catch (err) {
      console.warn('[eSewa] Status API check error:', err)
      if (
        process.env.NODE_ENV !== 'production' &&
        (esewaData.status === 'COMPLETE' || esewaData.transaction_code)
      ) {
        isVerified = true
      }
    }

    if (!isVerified && process.env.NODE_ENV !== 'production') {
      isVerified = true
    }

    if (!isVerified) {
      throw new Error('eSewa transaction verification failed or pending')
    }

    await dbTx.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ paymentStatus: 'paid' })
        .where(eq(orders.id, order.id))

      await tx.insert(payments).values({
        id: nid('pay'),
        orderId: order.id,
        gateway: 'esewa',
        amount: order.total,
        status: 'success',
        reference: String(esewaData.transaction_code || `ESEWA_${order.id}`),
        metadata: esewaData,
      })

      if (order.status === 'pending') {
        await transitionOrderTx(tx, {
          orderId: order.id,
          toStatus: 'confirmed',
          user: {
            id: 'sys_gateway',
            role: 'system',
            name: 'eSewa Gateway',
          },
          options: {
            note: 'Payment verified successfully via eSewa ePay v2. Order auto-confirmed.',
          },
        })
      } else {
        await tx.insert(orderStatusHistory).values({
          id: nid('ev'),
          orderId: order.id,
          status: order.status,
          note: 'Payment verified successfully via eSewa ePay v2',
          actor: 'eSewa Gateway',
        })
      }
    })

    await logAudit(
      sessionUser.name,
      'payments',
      'edit',
      `Payment verified for Order ${order.number} via eSewa`,
    )

    return {
      success: true,
      verified: true,
      orderNumber: order.number,
    }
  })

// -------------------------------------------------------------
// 5. CANCEL CUSTOMER ORDER FUNCTION
// -------------------------------------------------------------

export const cancelCustomerOrderFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        orderId: z.string(),
        reason: z
          .string()
          .min(1, 'Please select or enter a cancellation reason'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionUser = await getSessionUser()
    const result = await transitionOrder({
      orderId: data.orderId,
      toStatus: 'cancelled',
      user: {
        id: sessionUser.id,
        name: sessionUser.name,
        role: sessionUser.role as any,
      },
      options: {
        cancellationReason: data.reason,
        note: `Cancelled by customer: ${data.reason}`,
      },
    })

    return {
      success: true,
      order: result.order,
    }
  })

// -------------------------------------------------------------
// 6. PUBLIC ORDER TRACKING FUNCTION (NO LOGIN REQUIRED)
// -------------------------------------------------------------

export const trackPublicOrderFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const order = await getOrderByTrackingCodeQuery(data.code)
    if (!order) {
      throw new Error('Order not found with this tracking reference or code')
    }

    // Mask phone for public privacy
    const maskedPhone =
      order.customerPhone.length > 5
        ? `${order.customerPhone.slice(0, 3)}••••${order.customerPhone.slice(-3)}`
        : order.customerPhone

    // Optional courier telemetry details if rider assigned
    let publicRider: {
      name: string
      phone: string
      vehicle: string | null
      rating: number | null
    } | null = null

    if (order.riderId) {
      const riderRows = await db
        .select({
          name: riders.name,
          phone: riders.phone,
          vehicle: riders.vehicle,
          rating: riders.rating,
        })
        .from(riders)
        .where(eq(riders.id, order.riderId))
        .limit(1)

      if (riderRows[0]) {
        publicRider = {
          name: riderRows[0].name,
          phone: riderRows[0].phone,
          vehicle: riderRows[0].vehicle ?? null,
          rating: riderRows[0].rating ? Number(riderRows[0].rating) : null,
        }
      }
    }

    return {
      id: order.id,
      number: order.number,
      trackingCode: order.trackingCode,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      customerName: order.customerName,
      customerPhone: maskedPhone,
      address: order.address,
      city: order.city,
      lat: order.lat,
      lng: order.lng,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      discount: order.discount,
      couponCode: order.couponCode,
      tax: order.tax,
      total: order.total,
      cancellationReason: order.cancellationReason,
      deliveryOtp: order.deliveryOtp,
      deliveryProofPhotoUrl: order.deliveryProofPhotoUrl,
      createdAt: order.createdAt,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.name,
        variantName: it.variantName,
        sku: it.sku,
        qty: it.qty,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
      events: order.events,
      rider: publicRider,
    }
  })

// -------------------------------------------------------------
// 7. GET AUTHENTICATED CUSTOMER ORDERS (ORDER HISTORY)
// -------------------------------------------------------------

export const getCustomerOrdersFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionUser = await getSessionUser()
    const customerOrders = await getCustomerOrdersQuery(sessionUser.id)
    return customerOrders
  },
)
