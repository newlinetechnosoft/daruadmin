import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { user, verification } from '#/db/schema'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import { getSmsProvider } from './sms-providers'
import type { SendOtpResult, VerifyOtpResult } from './types'

const OTP_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const MAX_ATTEMPTS = 5
const DEV_FIXED_OTP = '123456'

// Basic In-Memory Rate Limiting tracking per phone and per IP
// (For high-availability clusters, swap this map with Redis or Postgres)
interface RateLimitTracker {
  count: number
  resetAt: number
}
const phoneHourlyTracker = new Map<string, RateLimitTracker>()
const ipHourlyTracker = new Map<string, RateLimitTracker>()
const MAX_SENDS_PER_PHONE_HOUR = 5
const MAX_SENDS_PER_IP_HOUR = 20

function getOtpSalt(): string {
  return process.env.BETTER_AUTH_SECRET || 'mezmani-otp-default-salt'
}

function hashOtp(code: string): string {
  return createHash('sha256')
    .update(`${getOtpSalt()}:${code.trim()}`)
    .digest('hex')
}

function getVerificationIdentifier(phone: string): string {
  return `phone-otp:${phone}`
}

function checkRateLimits(
  phone: string,
  ip?: string,
): { allowed: boolean; message?: string } {
  const now = Date.now()

  // Clean expired counters
  if (
    phoneHourlyTracker.has(phone) &&
    phoneHourlyTracker.get(phone)!.resetAt <= now
  ) {
    phoneHourlyTracker.delete(phone)
  }
  if (
    ip &&
    ipHourlyTracker.has(ip) &&
    ipHourlyTracker.get(ip)!.resetAt <= now
  ) {
    ipHourlyTracker.delete(ip)
  }

  // Check phone hourly limit
  const phoneUsage = phoneHourlyTracker.get(phone) || {
    count: 0,
    resetAt: now + 3600 * 1000,
  }
  if (phoneUsage.count >= MAX_SENDS_PER_PHONE_HOUR) {
    const minsLeft = Math.ceil((phoneUsage.resetAt - now) / 60000)
    return {
      allowed: false,
      message: `Too many OTP requests for this phone number. Please wait ${minsLeft} minute(s).`,
    }
  }

  // Check IP hourly limit
  if (ip) {
    const ipUsage = ipHourlyTracker.get(ip) || {
      count: 0,
      resetAt: now + 3600 * 1000,
    }
    if (ipUsage.count >= MAX_SENDS_PER_IP_HOUR) {
      return {
        allowed: false,
        message: 'Too many requests from your network. Please try again later.',
      }
    }
  }

  return { allowed: true }
}

function recordRateLimitUsage(phone: string, ip?: string) {
  const now = Date.now()
  const phoneUsage = phoneHourlyTracker.get(phone) || {
    count: 0,
    resetAt: now + 3600 * 1000,
  }
  phoneUsage.count += 1
  phoneHourlyTracker.set(phone, phoneUsage)

  if (ip) {
    const ipUsage = ipHourlyTracker.get(ip) || {
      count: 0,
      resetAt: now + 3600 * 1000,
    }
    ipUsage.count += 1
    ipHourlyTracker.set(ip, ipUsage)
  }
}

/**
 * Sends a 6-digit verification OTP to the normalized Nepali mobile number.
 */
export async function sendOtp(
  phoneRaw: string,
  ip?: string,
): Promise<SendOtpResult> {
  const normalizedPhone = normalizeNepaliPhone(phoneRaw)
  if (!normalizedPhone) {
    return { success: false, message: 'Invalid Nepali mobile number.' }
  }

  const identifier = getVerificationIdentifier(normalizedPhone)

  // 1. Check existing verification row for resend cooldown
  const existingRows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1)

  const now = Date.now()
  if (existingRows.length > 0) {
    const existing = existingRows[0]
    const elapsedMs = now - existing.createdAt.getTime()
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      const remainingCooldown = Math.ceil(
        (RESEND_COOLDOWN_MS - elapsedMs) / 1000,
      )
      return {
        success: false,
        cooldownSeconds: remainingCooldown,
        message: `Please wait ${remainingCooldown}s before requesting a new code.`,
      }
    }
  }

  // 2. Check basic rate limits
  const rateLimit = checkRateLimits(normalizedPhone, ip)
  if (!rateLimit.allowed) {
    return { success: false, message: rateLimit.message }
  }

  // 3. Generate random 6-digit numeric OTP
  // In development, deterministic fixed OTP 123456 can also be accepted
  const codeInt = 100000 + Math.floor(Math.random() * 900000)
  const code = codeInt.toString()
  const hashedCode = hashOtp(code)
  const expiresAt = new Date(now + OTP_EXPIRY_MS)

  // 4. Upsert verification row (hashed code + attempts counter initialized to 0)
  // Format: "hashedCode:0"
  const valuePayload = `${hashedCode}:0`

  if (existingRows.length > 0) {
    await db
      .update(verification)
      .set({
        value: valuePayload,
        expiresAt,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      })
      .where(eq(verification.id, existingRows[0].id))
  } else {
    const id = `ver_${randomBytes(12).toString('hex')}`
    await db.insert(verification).values({
      id,
      identifier,
      value: valuePayload,
      expiresAt,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
  }

  recordRateLimitUsage(normalizedPhone, ip)

  // 5. Dispatch via configured SMS Provider (Mock / Sparrow / Aakash)
  const smsProvider = getSmsProvider()
  const smsMessage = `Your Mezmani verification code is ${code}. Valid for 5 minutes. Do not share this code.`

  const dispatchResult = await smsProvider.sendSms(normalizedPhone, smsMessage)
  if (!dispatchResult.success) {
    console.error(
      `[OTP Service] Failed to send SMS via ${smsProvider.name}:`,
      dispatchResult.error,
    )
    return {
      success: false,
      message: 'Failed to send SMS code. Please try again shortly.',
    }
  }

  return {
    success: true,
    cooldownSeconds: 60,
    expiresAt,
    message: 'Verification code sent successfully.',
  }
}

/**
 * Verifies a 6-digit code against the stored hash for a given phone number.
 */
export async function verifyOtp(
  phoneRaw: string,
  codeRaw: string,
): Promise<VerifyOtpResult> {
  const normalizedPhone = normalizeNepaliPhone(phoneRaw)
  if (!normalizedPhone) {
    return {
      success: false,
      reason: 'invalid_code',
      message: 'Invalid mobile number.',
    }
  }

  const code = (codeRaw || '').trim()
  if (!/^\d{6}$/.test(code)) {
    return {
      success: false,
      reason: 'invalid_code',
      message: 'Please enter a valid 6-digit code.',
    }
  }

  const identifier = getVerificationIdentifier(normalizedPhone)
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1)

  if (rows.length === 0) {
    return {
      success: false,
      reason: 'not_found',
      message: 'No verification code found. Please request a new one.',
    }
  }

  const row = rows[0]
  const now = new Date()

  // Check expiration
  if (row.expiresAt < now) {
    await db.delete(verification).where(eq(verification.id, row.id))
    return {
      success: false,
      reason: 'expired',
      message: 'Verification code has expired. Please request a new code.',
    }
  }

  const [storedHash, attemptsStr] = row.value.split(':')
  const attempts = Number.parseInt(attemptsStr || '0', 10)

  // Check max attempts
  if (attempts >= MAX_ATTEMPTS) {
    await db.delete(verification).where(eq(verification.id, row.id))
    return {
      success: false,
      reason: 'max_attempts',
      message: 'Too many incorrect attempts. Please request a new code.',
    }
  }

  // Check code match:
  // In development and mock mode, also accept fixed code "123456" for easy testing.
  // Never log or accept the fixed code in production.
  const isDevMock =
    process.env.NODE_ENV !== 'production' &&
    (process.env.SMS_PROVIDER || 'mock').toLowerCase() === 'mock'
  const isDevFixedCodeMatch = isDevMock && code === DEV_FIXED_OTP
  const isHashMatch = hashOtp(code) === storedHash

  if (!isHashMatch && !isDevFixedCodeMatch) {
    const nextAttempts = attempts + 1
    if (nextAttempts >= MAX_ATTEMPTS) {
      await db.delete(verification).where(eq(verification.id, row.id))
      return {
        success: false,
        reason: 'max_attempts',
        message: 'Too many incorrect attempts. Please request a new code.',
      }
    }

    // Update attempts counter
    await db
      .update(verification)
      .set({
        value: `${storedHash}:${nextAttempts}`,
        updatedAt: new Date(),
      })
      .where(eq(verification.id, row.id))

    const remaining = MAX_ATTEMPTS - nextAttempts
    return {
      success: false,
      reason: 'invalid_code',
      attemptsRemaining: remaining,
      message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
    }
  }

  // Success! Clean up verification row and mark phone as verified on user record
  await db.delete(verification).where(eq(verification.id, row.id))

  // Update user in DB
  await db
    .update(user)
    .set({
      phoneVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.phone, normalizedPhone))

  return {
    success: true,
    message: 'Mobile number verified successfully.',
  }
}

/**
 * Resends a verification OTP to the normalized phone.
 */
export async function resendOtp(
  phoneRaw: string,
  ip?: string,
): Promise<SendOtpResult> {
  return sendOtp(phoneRaw, ip)
}
