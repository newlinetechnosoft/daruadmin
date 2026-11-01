import type { SmsProvider, SendSmsOptions } from './types'

/**
 * Mock SMS Provider for local development and staging environments.
 * Logs the OTP code directly to the server console in development only.
 * In production, it securely rejects or silently avoids exposing OTPs.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock'

  async sendSms(phone: string, message: string, options?: SendSmsOptions) {
    const customerName = options?.customerName?.trim() || 'Customer'
    const otpCode =
      options?.otpCode?.trim() || message.match(/\b\d{6}\b/)?.[0] || ''
    const templateMessage = otpCode
      ? `Welcome to Mezmani, ${customerName}! Your verification OTP is ${otpCode}. Do not share it with anyone.`
      : message

    if (process.env.NODE_ENV !== 'production') {
      console.log('----------------------------------------------------')
      console.log(`[SMS MOCK PROVIDER] Recipient: ${phone}`)
      console.log(`[SMS MOCK PROVIDER] Message:   ${templateMessage}`)
      if (options?.templateId) {
        console.log(`[SMS MOCK PROVIDER] Template:  ${options.templateId}`)
      }
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

  async sendSms(phone: string, message: string, _options?: SendSmsOptions) {
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

  async sendSms(phone: string, message: string, _options?: SendSmsOptions) {
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
 * Normalizes NepalOTP API base URL to https://nepalotp.com/api/v1
 */
export function getNepalOtpBaseUrl(): string {
  const envUrl = process.env.NEPALOTP_BASE_URL?.trim()
  if (!envUrl || envUrl === 'undefined') return 'https://nepalotp.com/api/v1'
  const clean = envUrl.replace(/\/+$/, '')
  if (clean.endsWith('/v1')) return clean
  if (clean.endsWith('/api')) return `${clean}/v1`
  return `${clean}/api/v1`
}

/**
 * Formats a 10-digit Nepali mobile number into standard international format (+977...)
 */
export function formatNepalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local10 = digits.slice(-10)
  return `+977${local10}`
}

/**
 * NepalOTP Provider (https://nepalotp.com/code-examples#nextjs)
 * Ultra-fast direct carrier routing for Nepal (NTC, Ncell) with < 1.4s delivery.
 *
 * Required environment variables:
 * - NEPALOTP_API_KEY: API Key from nepalotp.com dashboard (e.g. npot_live_... or sandbox)
 * - NEPALOTP_BASE_URL: (Optional) Base API URL, default https://nepalotp.com/api/v1
 * - NEPALOTP_SENDER_ID: (Optional) Sender ID registered with NepalOTP (e.g., "Mezmani")
 * - NEPALOTP_OTP_TTL: (Optional) Time-to-live in seconds (default: 300)
 */
export class NepalOtpProvider implements SmsProvider {
  readonly name = 'nepalotp'

  readonly sendSms = async (
    phone: string,
    message: string,
    options?: SendSmsOptions,
  ) => {
    const apiKey = process.env.NEPALOTP_API_KEY?.trim()
    const baseUrl = getNepalOtpBaseUrl()
    const sender = process.env.NEPALOTP_SENDER_ID?.trim() || 'Mezmani'
    const ttl = Number(process.env.NEPALOTP_OTP_TTL) || 300
    const formattedPhone = formatNepalPhone(phone)
    const local10Phone = phone.replace(/\D/g, '').slice(-10)

    const customerName = options?.customerName?.trim() || 'Customer'
    const otpCode =
      options?.otpCode?.trim() || message.match(/\b\d{6}\b/)?.[0] || ''
    const templateId =
      options?.templateId?.trim() ||
      process.env.NEPALOTP_TEMPLATE_ID?.trim() ||
      'tpl_custom_k3cnb1NtBLO4'

    // Format approved custom template:
    // "Welcome to Mezmani, {{ customer_name }}! Your verification OTP is {{ otp_code }}. Do not share it with anyone."
    const formattedMessage = otpCode
      ? `Welcome to Mezmani, ${customerName}! Your verification OTP is ${otpCode}. Do not share it with anyone.`
      : message

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('----------------------------------------------------')
        console.log(
          '[NepalOTP] (Demo / Local Mode - No NEPALOTP_API_KEY configured)',
        )
        console.log(`[NepalOTP] Endpoint:  ${baseUrl}/otp/send`)
        console.log(`[NepalOTP] Recipient: ${formattedPhone}`)
        console.log(`[NepalOTP] Template:  ${templateId}`)
        console.log(`[NepalOTP] Customer:  ${customerName}`)
        console.log(`[NepalOTP] OTP Code:  ${otpCode}`)
        console.log(`[NepalOTP] Message:   ${formattedMessage}`)
        console.log(
          '[NepalOTP] Set NEPALOTP_API_KEY in .env to dispatch real SMS via NTC/Ncell',
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
      // Build comprehensive payload for NepalOTP
      // Supporting template variables {{ customer_name }} & {{ otp_code }}
      // As documented in https://nepalotp.com/docs#template-variables
      const otpPayload: Record<string, unknown> = {
        phone: formattedPhone,
        phoneNumber: formattedPhone,
        message: formattedMessage,
        sender,
        sender_id: sender,
        ttl,
        template_id: templateId,
        templateId: templateId,
        variables: {
          customer_name: customerName,
          otp_code: otpCode,
        },
        customer_name: customerName,
        otp_code: otpCode,
      }
      if (otpCode) {
        otpPayload.otp = otpCode
        otpPayload.code = otpCode
      }

      console.log(
        `[NepalOTP Send] Dispatching OTP via ${baseUrl}/otp/send with template ${templateId}`,
      )

      let res = await fetch(`${baseUrl}/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify(otpPayload),
      })

      let resText = await res.text()
      let data: any = {}
      try {
        data = JSON.parse(resText)
      } catch {}

      // If /otp/send rejected the custom template or returned an error, attempt /sms/send
      if (!res.ok) {
        console.warn(
          `[NepalOTP Send] /otp/send HTTP ${res.status}: ${resText}. Trying fallback via /sms/send...`,
        )

        const smsPayload: Record<string, unknown> = {
          phone: local10Phone,
          phoneNumber: formattedPhone,
          template_id: templateId,
          templateId: templateId,
          variables: {
            customer_name: customerName,
            otp_code: otpCode,
          },
          customer_name: customerName,
          otp_code: otpCode,
          message: formattedMessage,
          sender,
          sender_id: sender,
        }

        const smsRes = await fetch(`${baseUrl}/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'x-api-key': apiKey,
          },
          body: JSON.stringify(smsPayload),
        })

        const smsResText = await smsRes.text()
        let smsData: any = {}
        try {
          smsData = JSON.parse(smsResText)
        } catch {}

        if (smsRes.ok) {
          console.log(
            `[NepalOTP Send] Fallback /sms/send success HTTP ${smsRes.status}:`,
            smsResText,
          )
          const fallbackMessageId =
            smsData.otp_id ||
            smsData.data?.otp_id ||
            smsData.message_id ||
            smsData.data?.message_id ||
            smsData.id ||
            smsData.data?.id
          return {
            success: true,
            messageId: fallbackMessageId ? String(fallbackMessageId) : undefined,
          }
        }

        console.error(
          `[NepalOTP Send] Fallback /sms/send also failed HTTP ${smsRes.status}:`,
          smsResText,
        )
        return {
          success: false,
          error:
            data.message ||
            smsData.message ||
            data.error ||
            smsData.error ||
            `NepalOTP error ${res.status}`,
        }
      }

      console.log(`[NepalOTP Send] Success HTTP ${res.status}:`, resText)

      const messageId =
        data.otp_id ||
        data.data?.otp_id ||
        data.otpId ||
        data.id ||
        data.sessionId ||
        data.data?.id ||
        data.data?.otpId ||
        data.data?.sessionId

      return {
        success: true,
        messageId: messageId ? String(messageId) : undefined,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[NepalOTP Send] Exception:', err)
      return { success: false, error }
    }
  }

  readonly verifyOtpRemote = async (
    phone: string,
    code: string,
    otpId?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const apiKey = process.env.NEPALOTP_API_KEY?.trim()
    if (!apiKey) {
      // In dev or mock mode without API key, remote verification is skipped
      return { success: true }
    }

    if (!otpId) {
      console.log(
        '[NepalOTP Verify] No remote otp_id available; relied on local secure hash verification.',
      )
      return { success: true }
    }

    const baseUrl = getNepalOtpBaseUrl()
    const formattedPhone = formatNepalPhone(phone)

    try {
      const cleanCode = code.trim()
      const payload: Record<string, unknown> = {
        phone: formattedPhone,
        phoneNumber: formattedPhone,
        code: cleanCode,
        otp: cleanCode,
        otp_id: otpId,
        id: otpId,
        otpId: otpId,
      }

      console.log(`[NepalOTP Verify] Calling ${baseUrl}/otp/verify with:`, {
        ...payload,
        code: '***' + cleanCode.slice(-2),
        otp: '***' + cleanCode.slice(-2),
      })

      const res = await fetch(`${baseUrl}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      })

      const resText = await res.text()
      console.log(`[NepalOTP Verify] Response HTTP ${res.status}:`, resText)

      let data: any = {}
      try {
        data = JSON.parse(resText)
      } catch {}

      if (!res.ok) {
        return {
          success: false,
          error:
            data.message ||
            data.error ||
            `NepalOTP verification error ${res.status}`,
        }
      }

      if (
        data.success === true ||
        data.status === 'approved' ||
        data.status === 'success' ||
        data.status === 'valid' ||
        data.verified === true ||
        data.data?.status === 'approved' ||
        data.data?.success === true
      ) {
        return { success: true }
      }

      return {
        success: false,
        error: data.message || 'Verification code failed NepalOTP validation',
      }
    } catch (err) {
      console.error('[NepalOTP Verify] Exception:', err)
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
