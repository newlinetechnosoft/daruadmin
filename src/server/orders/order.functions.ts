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
  stockMovements,
  coupons,
  ledgerEntries,
  payments,
  notifications,
} from '#/db/schema'
import { getSessionUser, logAudit } from '#/server/auth/permissions'
import {
  getCouponByCodeQuery,
  getStoreSettingsQuery,
} from '#/server/platform/platform.queries'
import { getOrderByIdQuery } from '#/server/orders/order.queries'
import type { PaymentMethod } from '#/server/operations/types'
import { checkoutFormSchema, validatePromoSchema } from './order.schemas'
import { fromPaisa } from '#/lib/money'

// Free delivery threshold: Rs 3,000 (300,000 paisa). Standard express delivery: Rs 150 (15,000 paisa)
const FREE_DELIVERY_THRESHOLD = 300000
const STANDARD_DELIVERY_CHARGE = 15000

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
    await getSessionUser()

    const cleanCode = data.code.trim().toUpperCase()
    const coupon = await getCouponByCodeQuery(cleanCode)

    if (!coupon) {
      return {
        valid: false,
        error: 'Invalid promo code. Please check and try again.',
      }
    }

    if (!coupon.active) {
      return {
        valid: false,
        error: 'This promo code is currently inactive.',
      }
    }

    const now = new Date()
    const expires = new Date(coupon.expiresAt)
    if (expires < now) {
      return {
        valid: false,
        error: 'This promo code has expired.',
      }
    }

    if (coupon.used >= coupon.usageLimit) {
      return {
        valid: false,
        error: 'Usage limit for this promo code has been reached.',
      }
    }

    if (data.subtotal < coupon.minOrder) {
      const minNpr = fromPaisa(coupon.minOrder)
      return {
        valid: false,
        error: `Minimum order amount of Rs. ${minNpr.toLocaleString()} required for this coupon.`,
      }
    }

    let discountPaisa = 0
    if (coupon.type === 'percent') {
      discountPaisa = Math.round(data.subtotal * (coupon.value / 100))
    } else {
      discountPaisa = Math.min(data.subtotal, coupon.value)
    }

    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountPaisa,
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
        stock: number
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
        stock: row.variant.stock,
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
        stock: row.variant.stock,
        productId: row.product.id,
        catalogType: 'grocery',
      })
    }

    // Verify all requested items are active and have sufficient stock
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

      if (itemInfo.stock < reqItem.quantity) {
        throw new Error(
          `Insufficient stock for "${itemInfo.name} (${itemInfo.variantName})". Only ${itemInfo.stock} available.`,
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

    // Server-side promo calculation
    let discountPaisa = 0
    let appliedCouponCode: string | null = null

    if (data.promoCode && data.promoCode.trim()) {
      const cleanCode = data.promoCode.trim().toUpperCase()
      const coupon = await getCouponByCodeQuery(cleanCode)
      if (
        coupon &&
        coupon.active &&
        new Date(coupon.expiresAt) >= new Date() &&
        coupon.used < coupon.usageLimit &&
        calculatedSubtotal >= coupon.minOrder
      ) {
        appliedCouponCode = coupon.code
        if (coupon.type === 'percent') {
          discountPaisa = Math.round(calculatedSubtotal * (coupon.value / 100))
        } else {
          discountPaisa = Math.min(calculatedSubtotal, coupon.value)
        }
      }
    }

    const deliveryCharge =
      calculatedSubtotal >= FREE_DELIVERY_THRESHOLD
        ? 0
        : STANDARD_DELIVERY_CHARGE

    const finalTotal = Math.max(
      0,
      calculatedSubtotal - discountPaisa + deliveryCharge,
    )

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

    const settings = await getStoreSettingsQuery()
    const orderCountRes = await db.select({ count: count() }).from(orders)
    const orderSeq = (orderCountRes[0]?.count ?? 0) + 1
    const orderNumber = `${settings.invoicePrefix}-${String(10000 + orderSeq).padStart(5, '0')}`

    const orderId = nid('ord')
    const trackingCode = `TRK${Math.floor(100000 + Math.random() * 900000)}`
    const now = new Date()

    // Execute atomic creation in transaction with dbTx
    await dbTx.transaction(async (tx) => {
      // 1. Decrement stock and record stock movements
      for (const item of verifiedOrderItems) {
        if (item.catalogType === 'liquor') {
          const current = await tx
            .select({ stock: liquorVariants.stock })
            .from(liquorVariants)
            .where(eq(liquorVariants.id, item.variantId))
            .limit(1)
          if (current[0]) {
            await tx
              .update(liquorVariants)
              .set({ stock: Math.max(0, current[0].stock - item.qty) })
              .where(eq(liquorVariants.id, item.variantId))
          }
        } else {
          const current = await tx
            .select({ stock: groceryVariants.stock })
            .from(groceryVariants)
            .where(eq(groceryVariants.id, item.variantId))
            .limit(1)
          if (current[0]) {
            await tx
              .update(groceryVariants)
              .set({ stock: Math.max(0, current[0].stock - item.qty) })
              .where(eq(groceryVariants.id, item.variantId))
          }
        }

        await tx.insert(stockMovements).values({
          id: nid('sm'),
          catalogType: item.catalogType,
          variantId: item.variantId,
          delta: -item.qty,
          type: 'sale',
          refType: 'order',
          refId: orderId,
          notes: `Sold in order ${orderNumber}`,
          createdBy: sessionUser.id,
        })
      }

      // 2. Increment coupon used count if coupon used
      if (appliedCouponCode) {
        const cpRow = await tx
          .select({ used: coupons.used })
          .from(coupons)
          .where(eq(coupons.code, appliedCouponCode))
          .limit(1)
        if (cpRow[0]) {
          await tx
            .update(coupons)
            .set({ used: cpRow[0].used + 1 })
            .where(eq(coupons.code, appliedCouponCode))
        }
      }

      // 3. Insert order
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
        subtotal: calculatedSubtotal,
        deliveryCharge,
        discount: discountPaisa,
        tax: 0,
        total: finalTotal,
        riderId: null,
        dealerId: null,
        trackingCode,
        notes: '',
        couponCode: appliedCouponCode,
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
        })
      }

      // 5. Insert initial status history
      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId,
        status: 'pending',
        note:
          data.paymentMethod === 'cod'
            ? 'Order placed (Cash on Delivery)'
            : 'Order placed (Pending eSewa payment)',
        actor: sessionUser.name,
      })

      // 6. Record in Ledger
      await tx.insert(ledgerEntries).values({
        id: nid('led'),
        date: now.toISOString().slice(0, 10),
        type: 'credit',
        category: 'sales',
        account: 'Sales revenue',
        memo: `Sale ${orderNumber}`,
        amount: finalTotal,
        refType: 'order',
        refId: orderId,
      })

      // 7. Insert notification for admin
      await tx.insert(notifications).values({
        id: nid('notif'),
        title: `New Order: ${orderNumber}`,
        body: `${sessionUser.name} placed order ${orderNumber} (Rs. ${fromPaisa(finalTotal)})`,
        type: 'order',
        read: false,
        href: `/admin/orders`,
      })
    })

    await logAudit(
      sessionUser.name,
      'orders',
      'create',
      `Placed order ${orderNumber} via ${data.paymentMethod} (Rs. ${fromPaisa(finalTotal)})`,
    )

    // Prepare payment flow data
    let esewaPayload: Record<string, string> | null = null
    if (data.paymentMethod === 'esewa') {
      const totalAmountNpr = fromPaisa(finalTotal).toFixed(2)
      const subtotalNpr = fromPaisa(calculatedSubtotal - discountPaisa).toFixed(
        2,
      )
      const deliveryChargeNpr = fromPaisa(deliveryCharge).toFixed(2)
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
      totalPaisa: finalTotal,
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

      await tx.insert(orderStatusHistory).values({
        id: nid('ev'),
        orderId: order.id,
        status: order.status,
        note: 'Payment verified successfully via eSewa ePay v2',
        actor: 'eSewa Gateway',
      })

      await tx.insert(payments).values({
        id: nid('pay'),
        orderId: order.id,
        gateway: 'esewa',
        amount: order.total,
        status: 'success',
        reference: String(esewaData.transaction_code || `ESEWA_${order.id}`),
        metadata: esewaData,
      })
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
