import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { db } from '#/db'
import { user, account, session, verification } from '#/db/schema'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  prepareSignupQuery,
} from './otp.service'

function getClientIp(): string | undefined {
  try {
    const rawHeaders = getRequestHeaders() as unknown as Record<
      string,
      string | string[] | undefined
    >
    const forwarded = rawHeaders['x-forwarded-for']
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        .split(',')[0]
        .trim()
    }
    const realIp = rawHeaders['x-real-ip'] || rawHeaders['cf-connecting-ip']
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp
    }
  } catch {
    // If running in client context or headers unavailable
  }
  return undefined
}

export const prepareSignupFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
        email: z.string().min(1, 'Email is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return prepareSignupQuery(data.phone, data.email)
  })

export const sendPhoneOtpFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp()
    return sendOtp(data.phone, ip)
  })

export const verifyPhoneOtpFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
        code: z.string().length(6, 'Verification code must be 6 digits'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return verifyOtp(data.phone, data.code)
  })

export const resendPhoneOtpFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp()
    return resendOtp(data.phone, ip)
  })

export const checkPhoneRegisteredFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const normalized = normalizeNepaliPhone(data.phone)
    if (!normalized) {
      return { valid: false, exists: false }
    }

    const rows = await db
      .select({
        id: user.id,
        phoneVerified: user.phoneVerified,
      })
      .from(user)
      .where(eq(user.phone, normalized))
      .limit(1)

    if (rows.length > 0) {
      return {
        valid: true,
        exists: true,
        phoneVerified: rows[0].phoneVerified,
      }
    }

    return { valid: true, exists: false, phoneVerified: false }
  })

export const resolveLoginIdentifierFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        identifier: z.string().min(1, 'Identifier is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = data.identifier.trim()

    // 1. If it's an email format, resolve directly
    if (raw.includes('@')) {
      const email = raw.toLowerCase()
      const rows = await db
        .select({
          id: user.id,
          email: user.email,
          phone: user.phone,
          phoneVerified: user.phoneVerified,
        })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)

      if (rows.length > 0) {
        return {
          found: true,
          email: rows[0].email,
          phone: rows[0].phone,
          phoneVerified: rows[0].phoneVerified,
        }
      }

      return { found: false, email }
    }

    // 2. Otherwise treat as Nepali phone number
    const normalized = normalizeNepaliPhone(raw)
    if (!normalized) {
      return {
        found: false,
        error:
          'Please enter a valid phone number.',
      }
    }

    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
      })
      .from(user)
      .where(eq(user.phone, normalized))
      .limit(1)

    if (rows.length > 0) {
      return {
        found: true,
        email: rows[0].email,
        phone: rows[0].phone,
        phoneVerified: rows[0].phoneVerified,
      }
    }

    return {
      found: false,
      error:
        'No account found with this mobile number. Please check the number or sign up.',
    }
  })

export const requestPasswordResetOtpFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = data.phone.trim()
    const normalized = normalizeNepaliPhone(raw)
    if (!normalized) {
      return {
        success: false,
        message:
          'Please enter a valid 10-digit Nepali mobile number starting with 98 or 97.',
      }
    }

    const rows = await db
      .select({
        id: user.id,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
      })
      .from(user)
      .where(eq(user.phone, normalized))
      .limit(1)

    if (rows.length === 0) {
      return {
        success: false,
        notFound: true,
        message:
          'No account found with this mobile number. Please check the number or sign up.',
      }
    }

    const ip = getClientIp()
    const otpRes = await sendOtp(normalized, ip)
    if (!otpRes.success) {
      return {
        success: false,
        message: otpRes.message || 'Unable to send verification code.',
        cooldownSeconds: otpRes.cooldownSeconds,
      }
    }

    return {
      success: true,
      cooldownSeconds: otpRes.cooldownSeconds || 60,
      normalizedPhone: normalized,
      message: 'Verification code sent to your mobile number.',
    }
  })

export const verifyPasswordResetOtpFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
        code: z.string().length(6, 'Verification code must be 6 digits'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = data.phone.trim()
    const normalized = normalizeNepaliPhone(raw)
    if (!normalized) {
      return {
        success: false,
        reason: 'invalid_code',
        message: 'Invalid mobile number.',
      }
    }

    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.phone, normalized))
      .limit(1)

    if (rows.length === 0) {
      return {
        success: false,
        reason: 'not_found',
        message: 'No account found with this mobile number.',
      }
    }

    const otpRes = await verifyOtp(normalized, data.code)
    if (!otpRes.success) {
      return {
        success: false,
        reason: otpRes.reason,
        message: otpRes.message || 'Verification failed.',
        attemptsRemaining: otpRes.attemptsRemaining,
      }
    }

    // Generate single-use reset token valid for 15 minutes
    const resetToken = randomBytes(24).toString('hex')
    const id = `pwd_reset_${randomBytes(12).toString('hex')}`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await db.insert(verification).values({
      id,
      identifier: `password-reset:${resetToken}`,
      value: rows[0].id,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return {
      success: true,
      resetToken,
      message: 'Mobile number verified successfully.',
    }
  })

export const resetPasswordWithTokenFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        resetToken: z.string().min(1, 'Reset token is required'),
        newPassword: z
          .string()
          .min(8, 'Password must be at least 8 characters'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const token = data.resetToken.trim()
    const identifier = `password-reset:${token}`

    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, identifier))
      .limit(1)

    if (rows.length === 0) {
      return {
        success: false,
        message:
          'Password reset session has expired or is invalid. Please request a new code.',
      }
    }

    const tokenRow = rows[0]
    if (tokenRow.expiresAt < new Date()) {
      await db.delete(verification).where(eq(verification.id, tokenRow.id))
      return {
        success: false,
        message:
          'Password reset session has expired. Please request a new code.',
      }
    }

    const userId = tokenRow.value

    // Consume the token immediately to ensure single-use security
    await db.delete(verification).where(eq(verification.id, tokenRow.id))

    // Hash the new password using Better Auth's password hashing
    const hashedPassword = await hashPassword(data.newPassword)

    // Update or insert credential account
    const existingAccounts = await db
      .select()
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, 'credential')),
      )
      .limit(1)

    if (existingAccounts.length > 0) {
      await db
        .update(account)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(account.id, existingAccounts[0].id))
    } else {
      await db.insert(account).values({
        id: `acc_${randomBytes(12).toString('hex')}`,
        userId,
        providerId: 'credential',
        accountId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // Revoke any existing active sessions for this user
    try {
      await db.delete(session).where(eq(session.userId, userId))
    } catch {
      // ignore
    }

    return {
      success: true,
      message:
        'Password has been reset successfully! You can now sign in with your new password.',
    }
  })

export const resendPasswordResetOtpFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        phone: z.string().min(1, 'Phone number is required'),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = data.phone.trim()
    const normalized = normalizeNepaliPhone(raw)
    if (!normalized) {
      return {
        success: false,
        message: 'Please enter a valid Nepali mobile number.',
      }
    }

    const ip = getClientIp()
    return resendOtp(normalized, ip)
  })
