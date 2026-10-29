import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { user } from '#/db/schema'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import { sendOtp, verifyOtp, resendOtp } from './otp.service'

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
          'Please enter a valid email or 10-digit Nepali mobile number (98/97...)',
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
