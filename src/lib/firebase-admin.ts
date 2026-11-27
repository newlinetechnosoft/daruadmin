import { initializeApp, getApps, cert } from 'firebase-admin/app'
import type { App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import type { Messaging } from 'firebase-admin/messaging'
import { db } from '#/db'
import { riders, riderDeviceTokens } from '#/db/schema'
import { eq, inArray } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'

const SERVICE_ACCOUNT_FILE_NAMES = [
  'mezmani-firebase-adminsdk-fbsvc-c1cfe9fdce.json',
  'firebase-service-account.json',
]

function findLocalServiceAccountFile(): string | null {
  const candidateDirs = [process.cwd(), path.resolve(process.cwd(), '..', 'rider_daru')]

  for (const dir of candidateDirs) {
    for (const name of SERVICE_ACCOUNT_FILE_NAMES) {
      const fullPath = path.resolve(dir, name)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }
  }
  return null
}

function buildCredential():
  | { credential: ReturnType<typeof cert> }
  | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson)
      return { credential: cert(parsed) }
    } catch (err) {
      console.error('[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT is not valid JSON:', err)
    }
  }

  if (projectId && clientEmail && privateKey) {
    return {
      credential: cert({
        projectId,
        clientEmail,
        // Hosting providers usually store the key with escaped newlines.
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    }
  }

  const localFile = findLocalServiceAccountFile()
  if (localFile) {
    try {
      const content = fs.readFileSync(localFile, 'utf8')
      return { credential: cert(JSON.parse(content)) }
    } catch (err) {
      console.error('[FirebaseAdmin] Failed to read local service account file:', err)
    }
  }

  return null
}

/**
 * Returns true when Firebase Admin credentials are available. In production
 * (Vercel, etc.) set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and
 * FIREBASE_PRIVATE_KEY (or the full FIREBASE_SERVICE_ACCOUNT JSON).
 */
export function isFirebaseConfigured(): boolean {
  if (getApps().length > 0) return true
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return true
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return true
  }
  return findLocalServiceAccountFile() !== null
}

let cachedMessaging: Messaging | null | undefined

/**
 * Lazily initialize and cache the Firebase Admin messaging client.
 * Returns null when credentials are missing instead of throwing, so order
 * assignment always succeeds even if push delivery is misconfigured.
 */
export function getFirebaseAdminMessaging(): Messaging | null {
  if (cachedMessaging !== undefined) return cachedMessaging

  try {
    if (getApps().length > 0) {
      cachedMessaging = getMessaging()
      return cachedMessaging
    }

    const creds = buildCredential()
    if (!creds) {
      console.warn(
        '[FirebaseAdmin] FCM credentials not set. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT) to enable live FCM notifications.',
      )
      cachedMessaging = null
      return cachedMessaging
    }

    let app: App
    try {
      app = initializeApp(creds)
    } catch (err: any) {
      // Race between concurrent requests: reuse the app another call created.
      if (err?.code === 'app/duplicate-app' && getApps().length > 0) {
        cachedMessaging = getMessaging(getApps()[0])
        return cachedMessaging
      }
      throw err
    }

    cachedMessaging = getMessaging(app)
    console.info('[FirebaseAdmin] FCM messaging client initialized')
    return cachedMessaging
  } catch (err) {
    console.error('[FirebaseAdmin] Failed to initialize Firebase Admin SDK:', err)
    cachedMessaging = null
    return null
  }
}

export interface SendPushResult {
  success: boolean
  sentCount: number
  failedCount: number
  reason?: string
}

export interface RiderPushPayload {
  riderId: string
  title: string
  body: string
  /** All values must be strings (FCM data payload requirement). */
  data?: Record<string, string | number | boolean | null | undefined>
}

async function getRiderTokens(riderId: string): Promise<{
  tokens: string[]
  legacyRiderToken: string | null
}> {
  const tokenRows = await db
    .select({ token: riderDeviceTokens.token })
    .from(riderDeviceTokens)
    .where(eq(riderDeviceTokens.riderId, riderId))

  const riderRow = await db
    .select({ fcmToken: riders.fcmToken })
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1)

  const tokenSet = new Set<string>()
  for (const r of tokenRows) {
    if (r.token?.trim()) tokenSet.add(r.token.trim())
  }
  const legacyRiderToken = riderRow[0]?.fcmToken?.trim() || null
  if (legacyRiderToken) tokenSet.add(legacyRiderToken)

  return { tokens: Array.from(tokenSet), legacyRiderToken }
}

/**
 * Sends a high-priority push notification to every device registered for a
 * rider, pruning tokens that FCM reports as no longer valid.
 */
export async function sendRiderPushNotification(
  payload: RiderPushPayload,
): Promise<SendPushResult> {
  const { riderId, title, body } = payload

  try {
    const { tokens, legacyRiderToken } = await getRiderTokens(riderId)
    if (tokens.length === 0) {
      // console.warn(`[FCM] Rider ${riderId} has no registered device tokens; skipping push.`)
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'no_registered_tokens',
      }
    }

    const messaging = getFirebaseAdminMessaging()
    if (!messaging) {
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: 'firebase_not_configured',
      }
    }

    const stringData: Record<string, string> = {
      title,
      body,
    }
    for (const [key, value] of Object.entries(payload.data ?? {})) {
      if (value === undefined || value === null) continue
      stringData[key] = String(value)
    }

    let sentCount = 0
    let failedCount = 0
    const invalidTokens: string[] = []

    // sendEachForMulticast accepts at most 500 tokens per call.
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const chunk = tokens.slice(offset, offset + 500)
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: stringData,
        android: {
          priority: 'high',
          ttl: 60 * 60 * 1000,
          notification: {
            channelId: 'mezmani_order_dispatch',
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            priority: 'max',
            visibility: 'public',
            notificationCount: 1,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
              'interruption-level': 'time-sensitive',
            },
          },
        },
        webpush: {
          headers: { Urgency: 'high', TTL: '3600' },
          notification: { requireInteraction: true },
        },
      })

      sentCount += response.successCount
      failedCount += response.failureCount
      response.responses.forEach((resp, idx) => {
        if (resp.success || !resp.error) return
        const code = resp.error.code
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(chunk[idx])
        } else {
          console.warn(
            `[FCM] Delivery failed for rider ${riderId} (${code}): ${resp.error.message}`,
          )
        }
      })
    }

    if (invalidTokens.length > 0) {
      await db
        .delete(riderDeviceTokens)
        .where(inArray(riderDeviceTokens.token, invalidTokens))
        .catch((err) => console.error('[FCM] Error pruning invalid device tokens:', err))

      if (legacyRiderToken && invalidTokens.includes(legacyRiderToken)) {
        await db
          .update(riders)
          .set({ fcmToken: null })
          .where(eq(riders.id, riderId))
          .catch((err) => console.error('[FCM] Error clearing rider fcmToken:', err))
      }
    }

    // console.info(
    //   `[FCM] Dispatched push to rider ${riderId} ("${title}"): ${sentCount} succeeded, ${failedCount} failed`,
    // )

    return {
      success: sentCount > 0,
      sentCount,
      failedCount,
      ...(sentCount === 0 ? { reason: 'all_tokens_failed' } : {}),
    }
  } catch (err) {
    console.error('[FCM] Failed to deliver push notification to rider:', err)
    // Never throw: the order assignment must not be rolled back by FCM.
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      reason: err instanceof Error ? err.message : 'fcm_send_failure',
    }
  }
}

export interface OrderNotificationItem {
  name: string
  qty?: number
  dealerName?: string | null
  dealerAddress?: string | null
  dealerPhone?: string | null
}

export interface SendOrderNotificationParams {
  riderId: string
  order: {
    id: string
    number: string
    customerName: string
    address: string
    total: number
    paymentMethod?: string | null
    items?: OrderNotificationItem[]
  }
  /** 'assignment' for a new dispatch, 'pickup_update' when dealers change. */
  kind?: 'assignment' | 'pickup_update'
}

/**
 * Send a real-time FCM notification when an order is assigned to a rider
 * (and/or its dealer pickup details become available). Database assignment is
 * persisted first; this function is best-effort and never throws.
 */
export async function sendOrderAssignmentNotification(
  params: SendOrderNotificationParams,
): Promise<SendPushResult> {
  const { riderId, order, kind = 'assignment' } = params

  const items = order.items ?? []
  const dealerNames = Array.from(
    new Set(
      items
        .map((item) => item.dealerName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  )
  const dealerAddresses = Array.from(
    new Set(
      items
        .map((item) => item.dealerAddress?.trim())
        .filter((address): address is string => Boolean(address)),
    ),
  )

  const totalNpr = (order.total / 100).toFixed(0)
  const isCod = (order.paymentMethod ?? '').toLowerCase() === 'cod'
  const pickupLine =
    dealerNames.length > 0
      ? `Pickup from ${dealerNames.join(', ')}${dealerAddresses.length > 0 ? ` (${dealerAddresses[0]})` : ''}. `
      : ''

  const title =
    kind === 'pickup_update'
      ? `Pickup details ready #${order.number}`
      : `New Delivery Assigned #${order.number}`
  const body =
    kind === 'pickup_update'
      ? `${pickupLine}Deliver to ${order.customerName} at ${order.address}.`
      : `${pickupLine}Deliver to ${order.customerName} at ${order.address}. ${isCod ? 'Collect cash' : 'Prepaid'}: Rs. ${totalNpr}`

  return sendRiderPushNotification({
    riderId,
    title,
    body,
    data: {
      type: kind === 'pickup_update' ? 'order_pickup_update' : 'order_assigned',
      orderId: order.id,
      orderNumber: order.number,
      customerName: order.customerName,
      address: order.address,
      totalPaisa: order.total,
      paymentMethod: order.paymentMethod ?? '',
      dealerNames: dealerNames.join(' | '),
      dealerAddresses: dealerAddresses.join(' | '),
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  })
}
