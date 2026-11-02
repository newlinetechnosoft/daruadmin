import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { user, verification, auditLogs } from '#/db/schema'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'

export type NepalOtpWebhookEventType =
  | 'otp.sent'
  | 'otp.delivered'
  | 'otp.verified'
  | 'otp.failed'
  | 'send'
  | 'verify'
  | 'failure'
  | string

export interface NepalOtpWebhookPayload {
  event?: NepalOtpWebhookEventType
  type?: NepalOtpWebhookEventType
  event_type?: NepalOtpWebhookEventType
  id?: string
  eventId?: string
  timestamp?: number | string
  data?: {
    phone?: string
    phoneNumber?: string
    otpId?: string
    messageId?: string
    status?: string
    code?: string
    reason?: string
    error?: string
    [key: string]: unknown
  }
  // Support for flat payloads
  phone?: string
  phoneNumber?: string
  otpId?: string
  messageId?: string
  status?: string
  code?: string
  reason?: string
  error?: string
  [key: string]: unknown
}

export interface VerifySignatureOptions {
  rawBody: string
  signatureHeader?: string | null
  timestampHeader?: string | null
  secret?: string
  toleranceSeconds?: number
}

export interface VerifySignatureResult {
  isValid: boolean
  error?: string
  timestamp?: number
}

/**
 * Verifies the HMAC-SHA256 signature sent by NepalOTP webhooks.
 *
 * Documentation: https://nepalotp.com/docs#webhooks
 *
 * Supported signature formats:
 * 1. Timestamped signature format: `t=1730590000,v1=abcdef...`
 * 2. Header pair format: `X-NepalOTP-Signature: <hex>` with `X-NepalOTP-Timestamp: <timestamp>`
 * 3. Direct raw HMAC-SHA256: `X-NepalOTP-Signature: <hex>`
 */
export function verifyNepalOtpSignature({
  rawBody,
  signatureHeader,
  timestampHeader,
  secret = process.env.NEPALOTP_WEBHOOK_SECRET,
  toleranceSeconds = Number(process.env.NEPALOTP_WEBHOOK_TOLERANCE_SECONDS) || 300,
}: VerifySignatureOptions): VerifySignatureResult {
  const isProduction = process.env.NODE_ENV === 'production'

  // If secret is not configured:
  if (!secret || secret.trim() === '') {
    if (isProduction) {
      return {
        isValid: false,
        error:
          'NEPALOTP_WEBHOOK_SECRET is not configured on the production server.',
      }
    }
    // In local development / preview mode, allow testing without a webhook secret
    console.warn(
      '[NepalOTP Webhook] Development warning: NEPALOTP_WEBHOOK_SECRET not set, accepting payload without verification.',
    )
    return { isValid: true }
  }

  if (!signatureHeader || signatureHeader.trim() === '') {
    return {
      isValid: false,
      error: 'Missing NepalOTP signature header.',
    }
  }

  const cleanSecret = secret.trim()
  const nowSec = Math.floor(Date.now() / 1000)

  // 1. Check if signature header is structured like `t=123456789,v1=hex` or `t=123456789,s=hex`
  if (signatureHeader.includes('t=') && (signatureHeader.includes('v1=') || signatureHeader.includes('s='))) {
    const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.trim().split('=')
      if (k && v) acc[k] = v
      return acc
    }, {})

    const timestampStr = parts.t
    const signatureHash = parts.v1 || parts.s

    if (!timestampStr || !signatureHash) {
      return { isValid: false, error: 'Malformed timestamped signature header.' }
    }

    const timestampNum = Number.parseInt(timestampStr, 10)
    if (Number.isNaN(timestampNum)) {
      return { isValid: false, error: 'Invalid timestamp format in signature header.' }
    }

    // Replay attack tolerance check
    if (Math.abs(nowSec - timestampNum) > toleranceSeconds) {
      return {
        isValid: false,
        error: `Webhook timestamp outside tolerance window (${toleranceSeconds}s).`,
        timestamp: timestampNum,
      }
    }

    const payloadToSign = `${timestampStr}.${rawBody}`
    const expectedHash = createHmac('sha256', cleanSecret)
      .update(payloadToSign)
      .digest('hex')

    const bufExpected = Buffer.from(expectedHash, 'utf8')
    const bufReceived = Buffer.from(signatureHash, 'utf8')

    if (bufExpected.length === bufReceived.length && timingSafeEqual(bufExpected, bufReceived)) {
      return { isValid: true, timestamp: timestampNum }
    }

    return { isValid: false, error: 'Signature mismatch.' }
  }

  // 2. Separate timestamp header or standalone signature
  let timestampNum: number | undefined
  if (timestampHeader && timestampHeader.trim() !== '') {
    const parsed = Number.parseInt(timestampHeader.trim(), 10)
    if (!Number.isNaN(parsed)) {
      timestampNum = parsed
      if (Math.abs(nowSec - timestampNum) > toleranceSeconds) {
        return {
          isValid: false,
          error: `Webhook timestamp outside tolerance window (${toleranceSeconds}s).`,
          timestamp: timestampNum,
        }
      }
    }
  }

  // Candidate A: timestamped `${timestamp}.${rawBody}`
  if (timestampNum !== undefined) {
    const candidateA = createHmac('sha256', cleanSecret)
      .update(`${timestampNum}.${rawBody}`)
      .digest('hex')
    const bufA = Buffer.from(candidateA, 'utf8')
    const bufSig = Buffer.from(signatureHeader.trim(), 'utf8')
    if (bufA.length === bufSig.length && timingSafeEqual(bufA, bufSig)) {
      return { isValid: true, timestamp: timestampNum }
    }
  }

  // Candidate B: raw body HMAC-SHA256
  const candidateB = createHmac('sha256', cleanSecret)
    .update(rawBody)
    .digest('hex')
  const bufB = Buffer.from(candidateB, 'utf8')
  const bufSig = Buffer.from(signatureHeader.trim(), 'utf8')
  if (bufB.length === bufSig.length && timingSafeEqual(bufB, bufSig)) {
    return { isValid: true, timestamp: timestampNum }
  }

  // Candidate C: base64 digest fallback
  const candidateC = createHmac('sha256', cleanSecret)
    .update(rawBody)
    .digest('base64')
  const bufC = Buffer.from(candidateC, 'utf8')
  if (bufC.length === bufSig.length && timingSafeEqual(bufC, bufSig)) {
    return { isValid: true, timestamp: timestampNum }
  }

  return { isValid: false, error: 'Signature mismatch.' }
}

/**
 * Processes an incoming NepalOTP webhook request.
 */
export async function processNepalOtpWebhook(
  rawBody: string,
  headers: Headers,
  d: any = db,
): Promise<{
  success: boolean
  status: number
  message: string
  event?: string
  data?: Record<string, unknown>
}> {
  // Extract signature and timestamp from possible incoming headers
  const signatureHeader =
    headers.get('x-nepalotp-signature') ||
    headers.get('nepalotp-signature') ||
    headers.get('x-signature') ||
    headers.get('x-webhook-signature')

  const timestampHeader =
    headers.get('x-nepalotp-timestamp') ||
    headers.get('nepalotp-timestamp') ||
    headers.get('x-timestamp')

  // 1. Verify cryptographic HMAC signature
  const verificationResult = verifyNepalOtpSignature({
    rawBody,
    signatureHeader,
    timestampHeader,
  })

  if (!verificationResult.isValid) {
    console.error(
      '[NepalOTP Webhook] Verification failed:',
      verificationResult.error,
    )
    return {
      success: false,
      status: 401,
      message: verificationResult.error || 'Unauthorized webhook request.',
    }
  }

  // 2. Parse JSON payload
  let payload: NepalOtpWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch (err) {
    return {
      success: false,
      status: 400,
      message: 'Invalid JSON payload received.',
    }
  }

  // Extract event type, phone, messageId, status
  const event = (
    payload.event ||
    payload.type ||
    payload.event_type ||
    payload.status ||
    'unknown'
  ).toLowerCase()

  const phoneRaw =
    payload.data?.phone ||
    payload.data?.phoneNumber ||
    payload.phone ||
    payload.phoneNumber ||
    ''

  const normalizedPhone = phoneRaw ? normalizeNepaliPhone(String(phoneRaw)) : undefined
  const messageId =
    payload.data?.otpId ||
    payload.data?.messageId ||
    payload.otpId ||
    payload.messageId ||
    payload.id ||
    payload.eventId

  const status =
    payload.data?.status || payload.status || 'unknown'
  const reason =
    payload.data?.reason ||
    payload.data?.error ||
    payload.reason ||
    payload.error

  console.log(`[NepalOTP Webhook] Event: "${event}" for phone: ${normalizedPhone || phoneRaw || 'N/A'}`)

  // 3. Handle specific lifecycle events
  try {
    // Event: OTP Verified Remotely (via NepalOTP carrier / verification system)
    if (
      event === 'otp.verified' ||
      event === 'verify' ||
      event === 'verified' ||
      event === 'otp_verified' ||
      status === 'verified' ||
      status === 'approved'
    ) {
      if (normalizedPhone) {
        // Mark user as phoneVerified & emailVerified
        await d
          .update(user)
          .set({
            phoneVerified: true,
            emailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(user.phone, normalizedPhone))

        // Clean up verification record for this phone
        await d
          .delete(verification)
          .where(eq(verification.identifier, `phone-otp:${normalizedPhone}`))
      }

      await recordOtpAuditLog(d, {
        actor: 'nepalotp_webhook',
        module: 'otp',
        action: 'otp_verified_remotely',
        detail: JSON.stringify({
          phone: normalizedPhone || phoneRaw,
          messageId,
          event,
          status,
        }),
      })
    }
    // Event: OTP Sent / Delivered to carrier
    else if (
      event === 'otp.sent' ||
      event === 'send' ||
      event === 'sent' ||
      event === 'otp.delivered' ||
      event === 'delivered'
    ) {
      await recordOtpAuditLog(d, {
        actor: 'nepalotp_webhook',
        module: 'otp',
        action: 'otp_delivered',
        detail: JSON.stringify({
          phone: normalizedPhone || phoneRaw,
          messageId,
          event,
          status,
        }),
      })
    }
    // Event: OTP Failed / Carrier Error
    else if (
      event === 'otp.failed' ||
      event === 'failure' ||
      event === 'failed' ||
      event === 'undelivered'
    ) {
      console.warn(
        `[NepalOTP Webhook] Delivery failure for ${normalizedPhone || phoneRaw}:`,
        reason,
      )
      await recordOtpAuditLog(d, {
        actor: 'nepalotp_webhook',
        module: 'otp',
        action: 'otp_delivery_failed',
        detail: JSON.stringify({
          phone: normalizedPhone || phoneRaw,
          messageId,
          event,
          status,
          reason,
        }),
      })
    }
    // Other generic NepalOTP webhook events
    else {
      await recordOtpAuditLog(d, {
        actor: 'nepalotp_webhook',
        module: 'otp',
        action: `webhook_${event}`,
        detail: JSON.stringify({
          phone: normalizedPhone || phoneRaw,
          messageId,
          payload,
        }),
      })
    }
  } catch (dbErr) {
    console.error('[NepalOTP Webhook] Error updating database state:', dbErr)
    // We log the error but still return 200 so NepalOTP doesn't endlessly retry if non-critical
  }

  return {
    success: true,
    status: 200,
    message: 'Webhook received and processed successfully.',
    event,
    data: {
      phone: normalizedPhone || phoneRaw,
      messageId,
      status,
    },
  }
}

async function recordOtpAuditLog(
  d: any,
  entry: {
    actor: string
    module: string
    action: string
    detail: string
  },
) {
  try {
    const id = `aud_${Math.random().toString(36).substring(2, 10)}`
    await d.insert(auditLogs).values({
      id,
      actor: entry.actor,
      module: entry.module,
      action: entry.action,
      detail: entry.detail,
    })
  } catch (err) {
    // Non-blocking fallback if audit log write fails
    console.warn('[NepalOTP Webhook] Could not write audit log:', err)
  }
}
