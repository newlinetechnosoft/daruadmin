import { describe, expect, it } from 'bun:test'
import { createHmac } from 'node:crypto'
import {
  verifyNepalOtpSignature,
  processNepalOtpWebhook,
} from './nepalotp-webhook'

describe('NepalOTP Webhook Signature Verification (https://nepalotp.com/docs#webhooks)', () => {
  const secret = 'whsec_test_secret_key_1234567890abcdef'
  const rawBody = JSON.stringify({
    event: 'otp.verified',
    data: {
      phone: '9841234567',
      status: 'verified',
    },
  })

  it('successfully verifies timestamped format (t=...,v1=...) with valid HMAC', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const payloadToSign = `${timestamp}.${rawBody}`
    const signature = createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex')

    const header = `t=${timestamp},v1=${signature}`

    const result = verifyNepalOtpSignature({
      rawBody,
      signatureHeader: header,
      secret,
    })

    expect(result.isValid).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.timestamp).toBe(timestamp)
  })

  it('rejects tampered rawBody with timestamped signature', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const payloadToSign = `${timestamp}.${rawBody}`
    const signature = createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex')

    const header = `t=${timestamp},v1=${signature}`

    const result = verifyNepalOtpSignature({
      rawBody: '{"tampered":true}',
      signatureHeader: header,
      secret,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Signature mismatch.')
  })

  it('rejects expired timestamp beyond tolerance window', () => {
    // 10 minutes ago
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600
    const payloadToSign = `${oldTimestamp}.${rawBody}`
    const signature = createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex')

    const header = `t=${oldTimestamp},v1=${signature}`

    const result = verifyNepalOtpSignature({
      rawBody,
      signatureHeader: header,
      secret,
      toleranceSeconds: 300,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toContain('outside tolerance window')
  })

  it('successfully verifies separate X-NepalOTP-Signature and X-NepalOTP-Timestamp', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const payloadToSign = `${timestamp}.${rawBody}`
    const signature = createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex')

    const result = verifyNepalOtpSignature({
      rawBody,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
      secret,
    })

    expect(result.isValid).toBe(true)
  })

  it('successfully verifies direct raw body HMAC signature', () => {
    const signature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    const result = verifyNepalOtpSignature({
      rawBody,
      signatureHeader: signature,
      secret,
    })

    expect(result.isValid).toBe(true)
  })

  it('rejects when signature header is missing and secret is configured', () => {
    const result = verifyNepalOtpSignature({
      rawBody,
      signatureHeader: undefined,
      secret,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Missing NepalOTP signature header.')
  })

  it('rejects in production environment when NEPALOTP_WEBHOOK_SECRET is unset', () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      const result = verifyNepalOtpSignature({
        rawBody,
        signatureHeader: 'any-sig',
        secret: '',
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('NEPALOTP_WEBHOOK_SECRET is not configured')
    } finally {
      process.env.NODE_ENV = origEnv
    }
  })
})

describe('NepalOTP Webhook Event Processing', () => {
  const secret = 'whsec_event_processing_secret_key'

  // Mock database
  function createMockDb() {
    const users: any[] = [
      {
        id: 'usr_1',
        phone: '9841234567',
        phoneVerified: false,
        emailVerified: false,
      },
    ]
    const verifications: any[] = [
      {
        id: 'ver_1',
        identifier: 'phone-otp:9841234567',
        value: 'hashed:0:msg_123',
      },
    ]
    const audit: any[] = []

    const mockDb = {
      users,
      verifications,
      audit,
      update: (_table: any) => ({
        set: (values: any) => ({
          where: (_clause: any) => {
            // Apply update to users
            for (const u of users) {
              if (u.phone === '9841234567') {
                Object.assign(u, values)
              }
            }
            return Promise.resolve()
          },
        }),
      }),
      delete: (_table: any) => ({
        where: (_clause: any) => {
          // Remove from verifications
          const idx = verifications.findIndex(
            (v) => v.identifier === 'phone-otp:9841234567',
          )
          if (idx !== -1) verifications.splice(idx, 1)
          return Promise.resolve()
        },
      }),
      insert: (_table: any) => ({
        values: (entry: any) => {
          audit.push(entry)
          return Promise.resolve()
        },
      }),
    }

    return mockDb
  }

  function signRequest(payloadStr: string, timestamp?: number) {
    const t = timestamp || Math.floor(Date.now() / 1000)
    const sig = createHmac('sha256', secret)
      .update(`${t}.${payloadStr}`)
      .digest('hex')
    return {
      'x-nepalotp-signature': `t=${t},v1=${sig}`,
    }
  }

  it('rejects unauthorized requests with invalid signature', async () => {
    const mockDb = createMockDb()
    const rawBody = JSON.stringify({ event: 'otp.verified' })
    const headers = new Headers({
      'x-nepalotp-signature': 't=123,v1=invalid',
    })

    process.env.NEPALOTP_WEBHOOK_SECRET = secret
    const res = await processNepalOtpWebhook(rawBody, headers, mockDb)

    expect(res.success).toBe(false)
    expect(res.status).toBe(401)
  })

  it('rejects invalid JSON payloads with valid signature', async () => {
    const mockDb = createMockDb()
    const rawBody = '{ broken json...'
    const headers = new Headers(signRequest(rawBody))

    process.env.NEPALOTP_WEBHOOK_SECRET = secret
    const res = await processNepalOtpWebhook(rawBody, headers, mockDb)

    expect(res.success).toBe(false)
    expect(res.status).toBe(400)
    expect(res.message).toBe('Invalid JSON payload received.')
  })

  it('handles otp.verified event, marks user verified, and clears verification table', async () => {
    const mockDb = createMockDb()
    const payload = {
      event: 'otp.verified',
      data: {
        phone: '9841234567',
        status: 'verified',
        otpId: 'npot_otp_999',
      },
    }
    const rawBody = JSON.stringify(payload)
    const headers = new Headers(signRequest(rawBody))

    process.env.NEPALOTP_WEBHOOK_SECRET = secret
    const res = await processNepalOtpWebhook(rawBody, headers, mockDb)

    expect(res.success).toBe(true)
    expect(res.status).toBe(200)
    expect(res.event).toBe('otp.verified')

    // Verified in mockDb
    expect(mockDb.users[0].phoneVerified).toBe(true)
    expect(mockDb.users[0].emailVerified).toBe(true)
    expect(mockDb.verifications.length).toBe(0)
    expect(mockDb.audit.some((a) => a.action === 'otp_verified_remotely')).toBe(true)
  })

  it('handles otp.sent delivery callback and records audit log', async () => {
    const mockDb = createMockDb()
    const payload = {
      event: 'otp.sent',
      data: {
        phone: '9841234567',
        status: 'delivered',
        messageId: 'msg_abc',
      },
    }
    const rawBody = JSON.stringify(payload)
    const headers = new Headers(signRequest(rawBody))

    process.env.NEPALOTP_WEBHOOK_SECRET = secret
    const res = await processNepalOtpWebhook(rawBody, headers, mockDb)

    expect(res.success).toBe(true)
    expect(res.status).toBe(200)
    expect(mockDb.audit.some((a) => a.action === 'otp_delivered')).toBe(true)
  })

  it('handles otp.failed carrier failure callback and records audit log', async () => {
    const mockDb = createMockDb()
    const payload = {
      event: 'otp.failed',
      data: {
        phone: '9841234567',
        status: 'undelivered',
        reason: 'Carrier temporary routing outage (NTC)',
      },
    }
    const rawBody = JSON.stringify(payload)
    const headers = new Headers(signRequest(rawBody))

    process.env.NEPALOTP_WEBHOOK_SECRET = secret
    const res = await processNepalOtpWebhook(rawBody, headers, mockDb)

    expect(res.success).toBe(true)
    expect(res.status).toBe(200)
    expect(mockDb.audit.some((a) => a.action === 'otp_delivery_failed')).toBe(true)
  })
})
