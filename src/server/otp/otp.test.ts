import { beforeAll, describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/pglite'
import { eq } from 'drizzle-orm'
import * as schema from '#/db/schema'
import {
  prepareSignupQuery,
  sendOtp,
  verifyOtp,
} from './otp.service'
import {
  NepalOtpProvider,
  getNepalOtpBaseUrl,
  formatNepalPhone,
} from './sms-providers'

describe('User Signup & OTP Account Verification Lifecycle', () => {
  let pglite: PGlite
  let testDb: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    pglite = new PGlite()
    testDb = drizzle(pglite, { schema })

    const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))

    // Apply all migrations
    for (const entry of journal.entries) {
      const filePath = path.join(migrationsFolder, `${entry.tag}.sql`)
      const sqlContent = fs.readFileSync(filePath, 'utf-8')
      const statements = sqlContent.split('--> statement-breakpoint')
      for (const stmt of statements) {
        const trimmed = stmt.trim()
        if (trimmed) {
          await pglite.exec(trimmed)
        }
      }
    }
  })

  describe('1. prepareSignupQuery', () => {
    it('rejects invalid Nepali mobile phone number', async () => {
      const res = await prepareSignupQuery('1234567890', 'test@example.com', testDb)
      expect(res.allowed).toBe(false)
      expect(res.code).toBe('INVALID_PHONE')
    })

    it('allows signup when phone and email do not exist', async () => {
      const res = await prepareSignupQuery('9841234567', 'newuser@example.com', testDb)
      expect(res.allowed).toBe(true)
      expect(res.code).toBe('OK')
      expect(res.normalizedPhone).toBe('9841234567')
      expect(res.email).toBe('newuser@example.com')
    })

    it('blocks signup if phone is already registered and verified', async () => {
      const phone = '9800000001'
      const email = 'verified_phone_user@example.com'

      await testDb.insert(schema.user).values({
        id: 'usr_verified_1',
        name: 'Verified User',
        email,
        phone,
        phoneVerified: true,
        emailVerified: true,
      })

      const res = await prepareSignupQuery(phone, 'another_email@example.com', testDb)
      expect(res.allowed).toBe(false)
      expect(res.code).toBe('ALREADY_REGISTERED')
      expect(res.message).toContain('already registered and verified')
    })

    it('blocks signup if email is already registered and verified', async () => {
      const phone = '9800000002'
      const email = 'verified_email_user@example.com'

      await testDb.insert(schema.user).values({
        id: 'usr_verified_2',
        name: 'Verified User 2',
        email,
        phone,
        phoneVerified: false,
        emailVerified: true,
      })

      const res = await prepareSignupQuery('9800000003', email, testDb)
      expect(res.allowed).toBe(false)
      expect(res.code).toBe('ALREADY_REGISTERED')
      expect(res.message).toContain('email is already registered')
    })

    it('cleans up stale unverified registration and allows fresh signup', async () => {
      const stalePhone = '9800000004'
      const staleEmail = 'stale_unverified@example.com'

      await testDb.insert(schema.user).values({
        id: 'usr_stale_unverified',
        name: 'Stale User',
        email: staleEmail,
        phone: stalePhone,
        phoneVerified: false,
        emailVerified: false,
      })

      // Verify the stale user is present
      const before = await testDb
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, 'usr_stale_unverified'))
      expect(before.length).toBe(1)

      // prepareSignupQuery cleans up the unverified record
      const res = await prepareSignupQuery(stalePhone, staleEmail, testDb)
      expect(res.allowed).toBe(true)
      expect(res.code).toBe('OK')

      // Verify stale user was removed
      const after = await testDb
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, 'usr_stale_unverified'))
      expect(after.length).toBe(0)
    })
  })

  describe('2. OTP Dispatch and Verification', () => {
    it('dispatches OTP and stores hash with 5-minute expiry in verification table', async () => {
      const phone = '9811111111'
      const sendResult = await sendOtp(phone, undefined, testDb)

      expect(sendResult.success).toBe(true)
      expect(sendResult.cooldownSeconds).toBe(60)

      const rows = await testDb
        .select()
        .from(schema.verification)
        .where(eq(schema.verification.identifier, `phone-otp:${phone}`))

      expect(rows.length).toBe(1)
      expect(rows[0].value).toContain(':0') // hash:0 attempts
      expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('enforces 60-second resend cooldown', async () => {
      const phone = '9811111111'
      const resendResult = await sendOtp(phone, undefined, testDb)

      expect(resendResult.success).toBe(false)
      expect(resendResult.message).toContain('Please wait')
      expect(resendResult.cooldownSeconds).toBeGreaterThan(0)
    })

    it('rejects invalid 6-digit code format', async () => {
      const res = await verifyOtp('9811111111', 'abc', testDb)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('invalid_code')
    })

    it('rejects incorrect OTP code and decrements remaining attempts', async () => {
      const res = await verifyOtp('9811111111', '999999', testDb)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('invalid_code')
      expect(res.attemptsRemaining).toBe(4)

      const row = await testDb
        .select()
        .from(schema.verification)
        .where(eq(schema.verification.identifier, 'phone-otp:9811111111'))
      expect(row[0].value.split(':')[1]).toBe('1')
    })
  })

  describe('3. End-to-End Account Creation & Verification', () => {
    it('creates user with id, phoneVerified=false and emailVerified=false, then sets both to true on OTP verification', async () => {
      const phone = '9822222222'
      const email = 'e2e_signup@example.com'
      const userId = 'usr_e2e_customer_1'

      // Step 1: User signs up -> Account is created in user table immediately
      await testDb.insert(schema.user).values({
        id: userId,
        name: 'E2E Customer',
        email,
        phone,
        phoneVerified: false,
        emailVerified: false,
        role: 'customer',
      })

      // Check DB: user row exists with id, both verifications false
      const [createdUser] = await testDb
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, userId))
      expect(createdUser).toBeDefined()
      expect(createdUser.id).toBe(userId)
      expect(createdUser.phoneVerified).toBe(false)
      expect(createdUser.emailVerified).toBe(false)

      // Step 2: OTP is sent
      const sendRes = await sendOtp(phone, undefined, testDb)
      expect(sendRes.success).toBe(true)

      // Step 3: User verifies with dev OTP '123456'
      const verifyRes = await verifyOtp(phone, '123456', testDb)
      expect(verifyRes.success).toBe(true)
      expect(verifyRes.userId).toBe(userId)

      // Step 4: Verify that user record in DB is now phoneVerified=true AND emailVerified=true
      const [updatedUser] = await testDb
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, userId))
      expect(updatedUser.phoneVerified).toBe(true)
      expect(updatedUser.emailVerified).toBe(true)

      // Step 5: Verification record was cleaned up
      const verRows = await testDb
        .select()
        .from(schema.verification)
        .where(eq(schema.verification.identifier, `phone-otp:${phone}`))
      expect(verRows.length).toBe(0)
    })
  })

  describe('4. NepalOTP Provider Integration (https://nepalotp.com/code-examples#nextjs)', () => {
    it('formats Nepali phone numbers into standard E.164 (+977...) format', () => {
      expect(formatNepalPhone('9841234567')).toBe('+9779841234567')
      expect(formatNepalPhone('+9779801234567')).toBe('+9779801234567')
      expect(formatNepalPhone('977-98-12345678')).toBe('+9779812345678')
    })

    it('normalizes NepalOTP base URL to /api/v1 endpoint', () => {
      const orig = process.env.NEPALOTP_BASE_URL
      try {
        delete process.env.NEPALOTP_BASE_URL
        expect(getNepalOtpBaseUrl()).toBe('https://nepalotp.com/api/v1')

        process.env.NEPALOTP_BASE_URL = 'https://nepalotp.com'
        expect(getNepalOtpBaseUrl()).toBe('https://nepalotp.com/api/v1')

        process.env.NEPALOTP_BASE_URL = 'https://nepalotp.com/api'
        expect(getNepalOtpBaseUrl()).toBe('https://nepalotp.com/api/v1')

        process.env.NEPALOTP_BASE_URL = 'https://nepalotp.com/api/v1/'
        expect(getNepalOtpBaseUrl()).toBe('https://nepalotp.com/api/v1')

        process.env.NEPALOTP_BASE_URL = 'https://api.nepalotp.com'
        expect(getNepalOtpBaseUrl()).toBe('https://api.nepalotp.com/api/v1')
      } finally {
        if (orig !== undefined) {
          process.env.NEPALOTP_BASE_URL = orig
        } else {
          delete process.env.NEPALOTP_BASE_URL
        }
      }
    })

    it('handles demo mode gracefully when NEPALOTP_API_KEY is not configured', async () => {
      const origKey = process.env.NEPALOTP_API_KEY
      try {
        delete process.env.NEPALOTP_API_KEY
        const provider = new NepalOtpProvider()
        const res = await provider.sendSms('9801234567', 'Your code is 654321')
        expect(res.success).toBe(true)
        expect(res.messageId).toContain('demo_nepalotp_')

        const verifyRes = await provider.verifyOtpRemote('9801234567', '654321')
        expect(verifyRes.success).toBe(true)
      } finally {
        if (origKey !== undefined) {
          process.env.NEPALOTP_API_KEY = origKey
        } else {
          delete process.env.NEPALOTP_API_KEY
        }
      }
    })

    it('dispatches HTTP request with Bearer authorization and payload when API key is set', async () => {
      const origKey = process.env.NEPALOTP_API_KEY
      const origFetch = globalThis.fetch

      try {
        process.env.NEPALOTP_API_KEY = 'npot_test_sandbox_secret_key'
        let capturedUrl = ''
        let capturedHeaders: Record<string, string> = {}
        let capturedBody: any = null

        globalThis.fetch = (async (url: string, init?: RequestInit) => {
          capturedUrl = url
          capturedHeaders = (init?.headers as Record<string, string>) || {}
          capturedBody = init?.body ? JSON.parse(init.body as string) : null

          return new Response(
            JSON.stringify({
              success: true,
              sessionId: 'npot_sess_123456789',
              message: 'OTP sent via NTC carrier',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }) as typeof fetch

        const provider = new NepalOtpProvider()
        const res = await provider.sendSms(
          '9841234567',
          'Your Mezmani verification code is 482910. Valid for 5 minutes.',
        )

        expect(res.success).toBe(true)
        expect(res.messageId).toBe('npot_sess_123456789')
        expect(capturedUrl).toBe('https://nepalotp.com/api/v1/otp/send')
        expect(capturedHeaders['Authorization']).toBe('Bearer npot_test_sandbox_secret_key')
        expect(capturedBody.phone).toBe('+9779841234567')
        expect(capturedBody.otp).toBe('482910')
        expect(capturedBody.ttl).toBe(300)
      } finally {
        if (origKey !== undefined) {
          process.env.NEPALOTP_API_KEY = origKey
        } else {
          delete process.env.NEPALOTP_API_KEY
        }
        globalThis.fetch = origFetch
      }
    })

    it('calls remote verify endpoint with phone and code and handles successful response', async () => {
      const origKey = process.env.NEPALOTP_API_KEY
      const origFetch = globalThis.fetch

      try {
        process.env.NEPALOTP_API_KEY = 'npot_test_sandbox_secret_key'
        let capturedUrl = ''
        let capturedBody: any = null

        globalThis.fetch = (async (url: string, init?: RequestInit) => {
          capturedUrl = url
          capturedBody = init?.body ? JSON.parse(init.body as string) : null

          return new Response(
            JSON.stringify({
              success: true,
              status: 'approved',
              message: 'OTP verified successfully',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }) as typeof fetch

        const provider = new NepalOtpProvider()
        const verifyRes = await provider.verifyOtpRemote('9841234567', '482910', 'req_test_123')

        expect(verifyRes.success).toBe(true)
        expect(capturedUrl).toBe('https://nepalotp.com/api/v1/otp/verify')
        expect(capturedBody.phone).toBe('+9779841234567')
        expect(capturedBody.code).toBe('482910')
        expect(capturedBody.id).toBe('req_test_123')
      } finally {
        if (origKey !== undefined) {
          process.env.NEPALOTP_API_KEY = origKey
        } else {
          delete process.env.NEPALOTP_API_KEY
        }
        globalThis.fetch = origFetch
      }
    })
  })
})
