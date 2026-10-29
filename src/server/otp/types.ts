export interface SmsProvider {
  readonly name: string
  readonly sendSms: (
    phone: string,
    message: string,
  ) => Promise<{ success: boolean; messageId?: string; error?: string }>
}

export interface SendOtpResult {
  success: boolean
  cooldownSeconds?: number
  message?: string
  expiresAt?: Date
}

export interface VerifyOtpResult {
  success: boolean
  reason?: 'not_found' | 'expired' | 'max_attempts' | 'invalid_code'
  message?: string
  attemptsRemaining?: number
}
