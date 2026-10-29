import type { SmsProvider } from './types'

/**
 * Mock SMS Provider for local development and staging environments.
 * Logs the OTP code directly to the server console in development only.
 * In production, it securely rejects or silently avoids exposing OTPs.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock'

  async sendSms(phone: string, message: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('----------------------------------------------------')
      console.log(`[SMS MOCK PROVIDER] Recipient: ${phone}`)
      console.log(`[SMS MOCK PROVIDER] Message:   ${message}`)
      console.log('----------------------------------------------------')
    }
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    }
  }
}

/**
 * Sparrow SMS Provider (Nepal)
 * Documentation: https://docs.sparrowsms.com/
 *
 * Required environment variables:
 * - SPARROW_SMS_TOKEN: API token provided by Sparrow SMS
 * - SPARROW_SMS_FROM: Registered sender identity / identity code (e.g., "Mezmani")
 */
export class SparrowSmsProvider implements SmsProvider {
  readonly name = 'sparrow'

  async sendSms(phone: string, message: string) {
    const token = process.env.SPARROW_SMS_TOKEN
    const from = process.env.SPARROW_SMS_FROM || 'Mezmani'

    if (!token) {
      console.error('[SparrowSMS] Missing SPARROW_SMS_TOKEN')
      return { success: false, error: 'Sparrow SMS token not configured' }
    }

    try {
      const params = new URLSearchParams({
        token,
        from,
        to: phone,
        text: message,
      })

      const res = await fetch(
        `http://api.sparrowsms.com/v2/sms/?${params.toString()}`,
        {
          method: 'GET',
        },
      )

      if (!res.ok) {
        const errText = await res.text()
        return {
          success: false,
          error: `Sparrow SMS returned status ${res.status}: ${errText}`,
        }
      }

      const data = (await res.json()) as {
        response_code_int?: number
        response?: string
      }
      if (
        data.response_code_int === 200 ||
        data.response?.toLowerCase().includes('success')
      ) {
        return { success: true, messageId: data.response }
      }

      return {
        success: false,
        error: data.response || 'Failed to dispatch via Sparrow SMS',
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { success: false, error }
    }
  }
}

/**
 * Aakash SMS Provider (Nepal)
 * Documentation: https://aakashsms.com/api/
 *
 * Required environment variables:
 * - AAKASH_SMS_AUTH_TOKEN: Authentication token from Aakash SMS portal
 */
export class AakashSmsProvider implements SmsProvider {
  readonly name = 'aakash'

  async sendSms(phone: string, message: string) {
    const authToken = process.env.AAKASH_SMS_AUTH_TOKEN

    if (!authToken) {
      console.error('[AakashSMS] Missing AAKASH_SMS_AUTH_TOKEN')
      return { success: false, error: 'Aakash SMS token not configured' }
    }

    try {
      const res = await fetch('https://sms.aakashsms.com/sms/v3/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          to: phone,
          text: message,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        return {
          success: false,
          error: `Aakash SMS error ${res.status}: ${errText}`,
        }
      }

      const data = (await res.json()) as { error?: boolean; message?: string }
      if (data.error === false) {
        return { success: true }
      }

      return {
        success: false,
        error: data.message || 'Failed to dispatch via Aakash SMS',
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { success: false, error }
    }
  }
}

/**
 * NepalOTP Provider (https://nepalotp.com/docs)
 * Direct carrier routing for Nepal (NTC, Ncell) with < 1.4s delivery speed.
 *
 * Required environment variables:
 * - NEPALOTP_API_KEY: API Key from nepalotp.com dashboard
 * - NEPALOTP_BASE_URL: (Optional) Base API URL, default https://api.nepalotp.com
 * - NEPALOTP_SENDER_ID: (Optional) Sender ID registered with NepalOTP (e.g., "Mezmani")
 */
export class NepalOtpProvider implements SmsProvider {
  readonly name = 'nepalotp'

  readonly sendSms = async (phone: string, message: string) => {
    const apiKey = process.env.NEPALOTP_API_KEY
    const baseUrl = process.env.NEPALOTP_BASE_URL || 'https://api.nepalotp.com'
    const sender = process.env.NEPALOTP_SENDER_ID || 'Mezmani'

    // Format phone with +977 country code prefix
    const rawDigits = phone.replace(/\D/g, '')
    const local10 = rawDigits.slice(-10)
    const formattedPhone = `+977${local10}`

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('----------------------------------------------------')
        console.log(
          '[NepalOTP] (Demo / Local Mode - No NEPALOTP_API_KEY configured)',
        )
        console.log(`[NepalOTP] Recipient: ${formattedPhone}`)
        console.log(`[NepalOTP] Message:   ${message}`)
        console.log(
          '[NepalOTP] Set NEPALOTP_API_KEY in .env to dispatch real SMS',
        )
        console.log('----------------------------------------------------')
        return {
          success: true,
          messageId: `demo_nepalotp_${Date.now()}`,
        }
      }
      console.error('[NepalOTP] Missing NEPALOTP_API_KEY')
      return { success: false, error: 'NepalOTP API key not configured' }
    }

    try {
      // Extract 6-digit OTP code if message contains one
      const otpMatch = message.match(/\b\d{6}\b/)
      const otpCode = otpMatch ? otpMatch[0] : undefined

      const payload = {
        phone: formattedPhone,
        otp: otpCode,
        message,
        sender,
        ttl: 300,
      }

      const res = await fetch(`${baseUrl}/v1/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errText = await res.text()
        return {
          success: false,
          error: `NepalOTP error ${res.status}: ${errText}`,
        }
      }

      const data = (await res.json()) as {
        success?: boolean
        message?: string
        id?: string
        data?: { id?: string }
      }

      if (data.success !== false) {
        return {
          success: true,
          messageId: data.id || data.data?.id,
        }
      }

      return {
        success: false,
        error: data.message || 'Failed to dispatch via NepalOTP',
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return { success: false, error }
    }
  }
}

/**
 * Factory that returns the configured SMS provider.
 * Configure SMS_PROVIDER in .env:
 * - 'nepalotp' (Recommended for Nepal, https://nepalotp.com/docs)
 * - 'sparrow'  (Sparrow SMS)
 * - 'aakash'   (Aakash SMS)
 * - 'mock'     (Default for local development & testing)
 */
export function getSmsProvider(): SmsProvider {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase()
  switch (provider) {
    case 'nepalotp':
      return new NepalOtpProvider()
    case 'sparrow':
      return new SparrowSmsProvider()
    case 'aakash':
      return new AakashSmsProvider()
    case 'mock':
      return new MockSmsProvider()
    default:
      // If NEPALOTP_API_KEY is configured, default to NepalOTP automatically
      if (process.env.NEPALOTP_API_KEY) {
        return new NepalOtpProvider()
      }
      return new MockSmsProvider()
  }
}
