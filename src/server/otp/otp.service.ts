import { createHash, randomBytes } from 'node:crypto'
import { eq, or } from 'drizzle-orm'
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
 * Prepares user signup by checking for existing verified accounts and cleaning up
 * any stale, unverified registrations so Better-Auth can create the fresh user row cleanly.
 */
export async function prepareSignupQuery(
  phoneRaw: string,
  emailRaw: string,
  d: any = db,
): Promise<{
  allowed: boolean
  code?: 'INVALID_PHONE' | 'ALREADY_REGISTERED' | 'OK'
  message?: string
  normalizedPhone?: string
  email?: string
}> {
  const normalized = normalizeNepaliPhone(phoneRaw)
  if (!normalized) {
    return {
      allowed: false,
      code: 'INVALID_PHONE',
      message:
        'Enter a valid 10-digit Nepali mobile number starting with 98 or 97.',
    }
  }

  const email = emailRaw.trim().toLowerCase()

  // Find any existing users with matching phone or email
  const existingUsers = await d
    .select({
      id: user.id,
      phone: user.phone,
      email: user.email,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(or(eq(user.phone, normalized), eq(user.email, email)))

  // Check if any verified account already exists with this phone
  const verifiedPhoneUser = existingUsers.find(
    (u: any) => u.phone === normalized && u.phoneVerified,
  )
  if (verifiedPhoneUser) {
    return {
      allowed: false,
      code: 'ALREADY_REGISTERED',
      message:
        'This mobile number is already registered and verified. Please sign in.',
    }
  }

  // Check if any verified account already exists with this email (excluding fallback domain)
  const verifiedEmailUser = existingUsers.find(
    (u: any) =>
      u.email === email &&
      (u.emailVerified || u.phoneVerified) &&
      !email.endsWith('@phone.mezmani.local'),
  )
  if (verifiedEmailUser) {
    return {
      allowed: false,
      code: 'ALREADY_REGISTERED',
      message:
        'An account with this email is already registered. Please sign in.',
    }
  }

  // Clean up any stale/abandoned unverified user records with matching phone or email
  const unverifiedUsers = existingUsers.filter(
    (u: any) => !u.phoneVerified && !u.emailVerified,
  )
  for (const u of unverifiedUsers) {
    await d.delete(user).where(eq(user.id, u.id))
  }

  return {
    allowed: true,
    code: 'OK',
    normalizedPhone: normalized,
    email,
  }
}

/**
 * Sends a 6-digit verification OTP to the normalized Nepali mobile number.
 * Formats message according to approved NepalOTP template:
 * "Welcome to Mezmani, {{ customer_name }}! Your verification OTP is {{ otp_code }}. Do not share it with anyone."
 */
export async function sendOtp(
  phoneRaw: string,
  ip?: string,
  d: any = db,
  customerName?: string,
): Promise<SendOtpResult> {
  const normalizedPhone = normalizeNepaliPhone(phoneRaw)
  if (!normalizedPhone) {
    return { success: false, message: 'Invalid Nepali mobile number.' }
  }

  // Look up customer name from user table if not explicitly passed
  let resolvedCustomerName = customerName?.trim()
  if (!resolvedCustomerName) {
    try {
      const existingUsers = await d
        .select({ name: user.name })
        .from(user)
        .where(eq(user.phone, normalizedPhone))
        .limit(1)
      if (existingUsers.length > 0 && existingUsers[0].name?.trim()) {
        resolvedCustomerName = existingUsers[0].name.trim()
      }
    } catch {
      // Fall back if query cannot be executed
    }
  }
  if (!resolvedCustomerName) {
    resolvedCustomerName = 'Customer'
  }

  const identifier = getVerificationIdentifier(normalizedPhone)

  // 1. Check existing verification row for resend cooldown
  const existingRows = await d
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

  // 4. Dispatch via configured SMS Provider (NepalOTP / Mock / Sparrow / Aakash)
  // Matching approved NepalOTP template:
  // "Welcome to Mezmani, {{ customer_name }}! Your verification OTP is {{ otp_code }}. Do not share it with anyone."
  const templateId =
    process.env.NEPALOTP_TEMPLATE_ID?.trim() || 'tpl_custom_k3cnb1NtBLO4'
  const smsProvider = getSmsProvider()
  const smsMessage = `Welcome to Mezmani, ${resolvedCustomerName}! Your verification OTP is ${code}. Do not share it with anyone.`

  const dispatchResult = await smsProvider.sendSms(normalizedPhone, smsMessage, {
    customerName: resolvedCustomerName,
    otpCode: code,
    templateId,
  })
  if (!dispatchResult.success) {
    console.error(
      `[OTP Service] Failed to send SMS via ${smsProvider.name}:`,
      dispatchResult.error,
    )
    return {
      success: false,
      message:
        dispatchResult.error ||
        'Failed to send SMS code. Please try again shortly.',
    }
  }

  // 5. Store verification row with remote session/tracking ID
  // Format: "hashedCode:0:remoteOtpId"
  const remoteId = dispatchResult.messageId || ''
  const valuePayload = `${hashedCode}:0:${remoteId}`

  if (existingRows.length > 0) {
    await d
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
    await d.insert(verification).values({
      id,
      identifier,
      value: valuePayload,
      expiresAt,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
  }

  recordRateLimitUsage(normalizedPhone, ip)

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
  d: any = db,
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
  const rows = await d
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
    await d.delete(verification).where(eq(verification.id, row.id))
    return {
      success: false,
      reason: 'expired',
      message: 'Verification code has expired. Please request a new code.',
    }
  }

  const [storedHash, attemptsStr, remoteOtpId] = row.value.split(':')
  const attempts = Number.parseInt(attemptsStr || '0', 10)

  // Check max attempts
  if (attempts >= MAX_ATTEMPTS) {
    await d.delete(verification).where(eq(verification.id, row.id))
    return {
      success: false,
      reason: 'max_attempts',
      message: 'Too many incorrect attempts. Please request a new code.',
    }
  }

  // Check code match:
  // 1. Check salted SHA-256 hash match against database
  // 2. In development and mock mode, accept fixed dev OTP "123456"
  const isDevMock =
    process.env.NODE_ENV !== 'production' &&
    (process.env.SMS_PROVIDER || 'mock').toLowerCase() === 'mock'
  const isDevFixedCodeMatch = isDevMock && code === DEV_FIXED_OTP
  const isHashMatch = hashOtp(code) === storedHash

  let isVerified = isHashMatch || isDevFixedCodeMatch

  // 3. If not matched locally and NepalOTP is the active provider with an API key,
  // query NepalOTP's remote verify endpoint (https://nepalotp.com/code-examples#nextjs)
  const smsProvider = getSmsProvider()
  if (
    !isVerified &&
    smsProvider.name === 'nepalotp' &&
    process.env.NEPALOTP_API_KEY &&
    smsProvider.verifyOtpRemote
  ) {
    try {
      const remoteResult = await smsProvider.verifyOtpRemote(
        normalizedPhone,
        code,
        remoteOtpId,
      )
      if (remoteResult.success) {
        isVerified = true
      } else {
        console.warn(
          `[OTP Service] NepalOTP verification declined for ${normalizedPhone}:`,
          remoteResult.error,
        )
      }
    } catch (err) {
      console.error('[OTP Service] Remote verify exception:', err)
    }
  }

  if (!isVerified) {
    const nextAttempts = attempts + 1
    if (nextAttempts >= MAX_ATTEMPTS) {
      await d.delete(verification).where(eq(verification.id, row.id))
      return {
        success: false,
        reason: 'max_attempts',
        message: 'Too many incorrect attempts. Please request a new code.',
      }
    }

    // Update attempts counter (preserves remoteOtpId)
    await d
      .update(verification)
      .set({
        value: `${storedHash}:${nextAttempts}:${remoteOtpId || ''}`,
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

  // Success! Clean up verification row and mark phone & email as verified on user record
  await d.delete(verification).where(eq(verification.id, row.id))

  // Update user in DB: both phoneVerified and emailVerified become true
  const updatedUsers = await d
    .update(user)
    .set({
      phoneVerified: true,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.phone, normalizedPhone))
    .returning({ id: user.id })

  return {
    success: true,
    message: 'Mobile number verified successfully.',
    userId: updatedUsers[0]?.id,
  }
}

/**
 * Resends a verification OTP to the normalized phone.
 */
export async function resendOtp(
  phoneRaw: string,
  ip?: string,
  d: any = db,
  customerName?: string,
): Promise<SendOtpResult> {
  return sendOtp(phoneRaw, ip, d, customerName)
}
