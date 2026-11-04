import { useState, useEffect, useRef, useCallback } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Lock,
  Phone,
  KeyRound,
  ShieldCheck,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  PhoneCall,
  Check,
} from 'lucide-react'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '#/components/ui/input-otp'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import {
  requestPasswordResetOtpFn,
  verifyPasswordResetOtpFn,
  resetPasswordWithTokenFn,
  resendPasswordResetOtpFn,
} from '#/server/otp/otp.functions'

interface ForgotPasswordCardProps {
  initialPhone?: string
  redirect?: string
}

type ResetStep = 'phone' | 'otp' | 'new-password' | 'success'

function maskPhone(p: string): string {
  const normalized = normalizeNepaliPhone(p) || p
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}••••${normalized.slice(7)}`
  }
  return normalized
}

export function ForgotPasswordCard({
  initialPhone = '',
  redirect,
}: ForgotPasswordCardProps) {
  const navigate = useNavigate()

  const [step, setStep] = useState<ResetStep>('phone')
  const [isAnimating, setIsAnimating] = useState(false)

  // Step 1: Phone State
  const [phone, setPhone] = useState(initialPhone)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [isNotFound, setIsNotFound] = useState(false)

  // Step 2: OTP State
  const [otp, setOtp] = useState('')
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isResendingOtp, setIsResendingOtp] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const otpContainerRef = useRef<HTMLDivElement>(null)

  // Step 3: Password State
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Auto redirect countdown on success
  const [redirectCountdown, setRedirectCountdown] = useState(3)

  // Real-time Nepali phone number validation
  const normalizedPhone = normalizeNepaliPhone(phone)
  const isPhoneValid = normalizedPhone !== null

  // Password confirmation matching check
  const passwordsMatch =
    confirmPassword.length > 0 ? newPassword === confirmPassword : null
  const isPasswordValid = newPassword.length >= 8

  // Cooldown countdown effect
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Auto-redirect effect when step is 'success'
  useEffect(() => {
    if (step !== 'success') return
    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate({ to: '/login', search: { redirect } })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [step, navigate, redirect])

  // Smooth step transition helper
  const transitionToStep = (newStep: ResetStep) => {
    setIsAnimating(true)
    setTimeout(() => {
      setStep(newStep)
      setIsAnimating(false)
    }, 200)
  }

  // 1. Submit Phone: Request OTP
  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault()
    setPhoneError(null)
    setIsNotFound(false)

    if (!normalizedPhone) {
      setPhoneError(
        'Please enter a valid 10-digit Nepali mobile number starting with 98 or 97.',
      )
      return
    }

    setIsRequestingOtp(true)
    try {
      const res = await requestPasswordResetOtpFn({
        data: { phone: normalizedPhone },
      })

      if (!res.success) {
        if (res.notFound) {
          setIsNotFound(true)
        }
        setPhoneError(
          res.message ||
            'No registered account found with this mobile number. Please check your number or sign up.',
        )
        return
      }

      toast.success(
        res.message ||
          'Verification code sent! Please check your SMS messages.',
      )
      setCountdown(res.cooldownSeconds || 60)
      setOtp('')
      setOtpError(null)
      transitionToStep('otp')
    } catch (err: unknown) {
      setPhoneError(
        err instanceof Error
          ? err.message
          : 'Unable to request verification code. Please try again.',
      )
    } finally {
      setIsRequestingOtp(false)
    }
  }

  // 2. Submit OTP: Verify Phone
  const handleVerifyOtp = useCallback(
    async (codeToVerify: string) => {
      if (codeToVerify.length !== 6 || isVerifyingOtp || !normalizedPhone)
        return

      setIsVerifyingOtp(true)
      setOtpError(null)

      try {
        const res = await verifyPasswordResetOtpFn({
          data: {
            phone: normalizedPhone,
            code: codeToVerify,
          },
        })

        if (!res.success || !res.resetToken) {
          if (res.reason === 'expired') {
            setOtpError(
              res.message ||
                'Verification code has expired. Please request a new code below.',
            )
          } else if (res.reason === 'max_attempts') {
            setOtpError(
              res.message ||
                'Maximum attempts exceeded for this code. Please request a fresh code to continue.',
            )
          } else {
            setOtpError(
              res.message ||
                'Invalid 6-digit verification code. Please try again.',
            )
          }
          setOtp('')
          const firstInput = otpContainerRef.current?.querySelector('input')
          firstInput?.focus()
          return
        }

        setResetToken(res.resetToken)
        toast.success('Mobile number verified! You may now set a new password.')
        setPasswordError(null)
        transitionToStep('new-password')
      } catch (err: unknown) {
        setOtpError(
          err instanceof Error
            ? err.message
            : 'Verification failed. Please try again.',
        )
        setOtp('')
      } finally {
        setIsVerifyingOtp(false)
      }
    },
    [normalizedPhone, isVerifyingOtp],
  )

  const handleOtpChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6)
    setOtp(clean)
    setOtpError(null)
    if (clean.length === 6) {
      handleVerifyOtp(clean)
    }
  }

  const handleOtpSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (otp.length === 6) {
      handleVerifyOtp(otp)
    }
  }

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (countdown > 0 || isResendingOtp || !normalizedPhone) return

    setIsResendingOtp(true)
    setOtpError(null)

    try {
      const res = await resendPasswordResetOtpFn({
        data: { phone: normalizedPhone },
      })

      if (res.success) {
        toast.success('A new 6-digit verification code has been sent!')
        setCountdown(res.cooldownSeconds || 60)
        setOtp('')
        const firstInput = otpContainerRef.current?.querySelector('input')
        firstInput?.focus()
      } else {
        toast.error(res.message || 'Unable to resend code right now.')
        if (res.cooldownSeconds) {
          setCountdown(res.cooldownSeconds)
        }
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to resend verification code.',
      )
    } finally {
      setIsResendingOtp(false)
    }
  }

  // 3. Submit New Password: Reset Password
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (!resetToken) {
      setPasswordError(
        'Session expired. Please request a new verification code.',
      )
      transitionToStep('phone')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.')
      return
    }

    setIsResettingPassword(true)
    try {
      const res = await resetPasswordWithTokenFn({
        data: {
          resetToken,
          newPassword,
        },
      })

      if (!res.success) {
        setPasswordError(res.message || 'Failed to reset password.')
        return
      }

      toast.success('Password updated successfully! Redirecting to login...')
      transitionToStep('success')
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : 'Unable to reset password. Please try again.',
      )
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="w-full max-w-[960px] mx-auto relative z-10">
      {/* Decorative ambient background glows aligned to system theme */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl" />
      </div>

      {/* Main Card Container */}
      <div className="relative w-full rounded-3xl bg-card text-card-foreground shadow-xl border border-border overflow-hidden flex flex-col md:flex-row transition-all duration-300">
        {/* ==================== LEFT PANEL (Mezmani Midnight Brand Panel) ==================== */}
        <div className="relative w-full md:w-[56%] bg-sidebar text-sidebar-foreground p-6 sm:p-9 md:p-11 flex flex-col justify-center overflow-hidden z-10 transition-colors duration-300">
          {/* Decorative Organic Shapes matching UI theme */}
          <div className="w-52 h-52 rounded-full bg-sidebar-accent/50 absolute -top-16 -right-12 pointer-events-none" />
          <div className="w-64 h-64 rounded-full bg-sidebar-accent/30 absolute -bottom-24 -right-16 pointer-events-none" />
          <div className="w-56 h-56 rounded-full bg-primary/10 blur-2xl absolute -bottom-16 -left-16 pointer-events-none" />

          {/* Organic Wave Divider on Desktop Edge */}
          <svg
            className="absolute -right-16 lg:-right-20 top-0 h-full w-16 lg:w-20 pointer-events-none hidden md:block text-sidebar fill-current z-10 transition-colors duration-300"
            viewBox="0 0 100 600"
            preserveAspectRatio="none"
          >
            <path d="M0,0 L0,600 Q95,450 35,300 Q105,150 0,0 Z" />
          </svg>

          {/* Form Content with Smooth Fade/Scale Shift Animation */}
          <div
            className={`relative z-20 w-full max-w-[370px] mx-auto transition-all duration-300 ease-out ${
              isAnimating
                ? 'opacity-0 scale-[0.97] translate-y-1.5'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {/* Step Progress Indicators */}
            {step !== 'success' && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                    step === 'phone'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-sidebar-accent text-sidebar-foreground/75'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>Mobile</span>
                </div>

                <div className="w-4 h-[1.5px] bg-sidebar-foreground/20" />

                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                    step === 'otp'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-sidebar-accent text-sidebar-foreground/75'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>OTP</span>
                </div>

                <div className="w-4 h-[1.5px] bg-sidebar-foreground/20" />

                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                    step === 'new-password'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-sidebar-accent text-sidebar-foreground/75'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>Reset</span>
                </div>
              </div>
            )}

            {/* ==================== STEP 1: PHONE NUMBER ==================== */}
            {step === 'phone' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Forgot Password?
                  </h1>
                  <p className="text-xs sm:text-sm text-sidebar-foreground/75 mt-1.5 font-normal leading-relaxed">
                    Enter your registered Nepali mobile number to receive a
                    6-digit verification code.
                  </p>
                </div>

                {/* Inline Error Alert */}
                {phoneError && (
                  <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-3 text-destructive-foreground text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="leading-snug">{phoneError}</p>
                      {isNotFound && (
                        <Link
                          to="/signup"
                          search={{ redirect }}
                          className="font-bold text-primary hover:underline underline-offset-2 block mt-1"
                        >
                          Create a new account instead &rarr;
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile Phone Input with Prefix */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-3 sm:py-3.5 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0 mr-2.5" />
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded mr-2 select-none">
                    +977
                  </span>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^\d+-\s]/g, '')
                      setPhone(clean)
                      setPhoneError(null)
                      setIsNotFound(false)
                    }}
                    placeholder="98XXXXXXXX"
                    maxLength={14}
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium"
                  />
                  {/* Validation Icon */}
                  {phone.trim().length >= 10 && (
                    <div
                      className="ml-2 shrink-0"
                      title={
                        isPhoneValid
                          ? 'Valid Nepali mobile number'
                          : 'Invalid mobile number format'
                      }
                    >
                      {isPhoneValid ? (
                        <CheckCircle2 className="h-5 w-5 text-success animate-in fade-in zoom-in-75 duration-200" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive animate-in fade-in zoom-in-75 duration-200" />
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isRequestingOtp || !phone.trim()}
                  className="w-full mt-2 py-3.5 sm:py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-bold text-[16px] shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isRequestingOtp ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Sending OTP code...
                    </span>
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Back to Login Link */}
                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    search={{ redirect }}
                    className="text-xs sm:text-sm text-sidebar-foreground/75 hover:text-sidebar-foreground hover:underline inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Remember your password? Sign In
                  </Link>
                </div>
              </form>
            )}

            {/* ==================== STEP 2: OTP VERIFICATION ==================== */}
            {step === 'otp' && (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Verify Your Mobile
                  </h1>
                  <p className="text-xs sm:text-sm text-sidebar-foreground/75 mt-1.5 font-normal leading-relaxed">
                    Enter the 6-digit verification code sent to{' '}
                    <span className="font-mono font-bold text-primary inline-block">
                      +977 {maskPhone(phone)}
                    </span>
                  </p>
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => transitionToStep('phone')}
                      className="text-[12px] text-primary hover:underline underline-offset-2 transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Wrong number? Change it
                    </button>
                  </div>
                </div>

                {/* Inline Error Alert */}
                {otpError && (
                  <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-3 text-destructive-foreground text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="leading-snug">{otpError}</span>
                  </div>
                )}

                {/* 6-Slot OTP Input with Theme Card Slots */}
                <div
                  ref={otpContainerRef}
                  className="flex flex-col items-center justify-center space-y-2 py-1"
                >
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={handleOtpChange}
                    pattern="^[0-9]*$"
                    autoComplete="one-time-code"
                    disabled={isVerifyingOtp}
                    className="gap-2 sm:gap-2.5"
                  >
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot
                        index={0}
                        className="h-12 w-10 sm:h-14 sm:w-12 bg-card text-card-foreground font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-xs border border-border focus:ring-2 focus:ring-primary"
                      />
                      <InputOTPSlot
                        index={1}
                        className="h-12 w-10 sm:h-14 sm:w-12 bg-card text-card-foreground font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-xs border border-border focus:ring-2 focus:ring-primary"
                      />
                      <InputOTPSlot
                        index={2}
                        className="h-12 w-10 sm:h-14 sm:w-12 bg-card text-card-foreground font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-xs border border-border focus:ring-2 focus:ring-primary"
                      />
                    </InputOTPGroup>
                    <InputOTPSeparator className="text-sidebar-foreground/50 font-bold" />
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot
                        index={3}
                        className="h-12 w-10 sm:h-14 sm:w-12 bg-card text-card-foreground font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-xs border border-border focus:ring-2 focus:ring-primary"
                      />
                      <InputOTPSlot
                        index={4}
                        className="h-12 w-10 sm:h-14 sm:w-12 bg-card text-card-foreground font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-xs border border-border focus:ring-2 focus:ring-primary"
                      />
                      <InputOTPSlot
                        index={5}
                        className="h-12 w-10 sm:h-14 sm:w-12 bg-card text-card-foreground font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-xs border border-border focus:ring-2 focus:ring-primary"
                      />
                    </InputOTPGroup>
                  </InputOTP>

                  <p className="text-[12px] text-sidebar-foreground/75 pt-1 flex items-center gap-1.5 font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Code expires in 5 minutes
                  </p>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={otp.length !== 6 || isVerifyingOtp}
                  className="w-full mt-2 py-3.5 sm:py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-bold text-[16px] shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isVerifyingOtp ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Verifying code...
                    </span>
                  ) : (
                    <>
                      Verify OTP Code
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Resend Code Options */}
                <div className="flex flex-col items-center justify-center space-y-2 pt-1 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-sidebar-foreground/75">
                    <span>Didn&apos;t receive the code?</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || isResendingOtp}
                      className="font-bold text-primary hover:underline disabled:text-sidebar-foreground/40 disabled:no-underline cursor-pointer transition-colors"
                    >
                      {isResendingOtp ? (
                        <span className="flex items-center gap-1">
                          <RotateCw className="h-3 w-3 animate-spin" />
                          Sending...
                        </span>
                      ) : countdown > 0 ? (
                        `Resend code in ${countdown}s`
                      ) : (
                        'Resend code'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ==================== STEP 3: SET NEW PASSWORD ==================== */}
            {step === 'new-password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="text-center mb-4">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Set New Password
                  </h1>
                  <p className="text-xs sm:text-sm text-sidebar-foreground/75 mt-1.5 font-normal leading-relaxed">
                    Create a strong new password for your account associated
                    with{' '}
                    <span className="font-mono font-bold text-primary">
                      +977 {maskPhone(phone)}
                    </span>
                  </p>
                </div>

                {/* Inline Error Alert */}
                {passwordError && (
                  <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-3 text-destructive-foreground text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="leading-snug">{passwordError}</span>
                  </div>
                )}

                {/* New Password Field */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-3 sm:py-3.5 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setPasswordError(null)
                    }}
                    placeholder="New Password (min 8 chars)"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium pr-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="p-1.5 text-muted-foreground hover:text-card-foreground transition-colors shrink-0 cursor-pointer rounded-md hover:bg-muted"
                    aria-label={
                      showNewPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Confirm Password Field */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-3 sm:py-3.5 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setPasswordError(null)
                    }}
                    placeholder="Confirm New Password"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium pr-2"
                  />
                  {/* Match Indicator */}
                  {passwordsMatch !== null && (
                    <div
                      className="mr-1 shrink-0"
                      title={
                        passwordsMatch
                          ? 'Passwords match'
                          : 'Passwords do not match'
                      }
                    >
                      {passwordsMatch ? (
                        <CheckCircle2 className="h-5 w-5 text-success animate-in fade-in zoom-in-75 duration-200" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive animate-in fade-in zoom-in-75 duration-200" />
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="p-1.5 text-muted-foreground hover:text-card-foreground transition-colors shrink-0 cursor-pointer rounded-md hover:bg-muted"
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Password Strength Requirement Hint */}
                <p className="text-[12px] text-sidebar-foreground/75 px-1 font-medium">
                  Password must be at least 8 characters long and match
                  confirmation.
                </p>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={
                    isResettingPassword ||
                    !isPasswordValid ||
                    passwordsMatch !== true
                  }
                  className="w-full mt-2 py-3.5 sm:py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-bold text-[16px] shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isResettingPassword ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Updating password...
                    </span>
                  ) : (
                    <>
                      Save & Reset Password
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ==================== STEP 4: SUCCESS ==================== */}
            {step === 'success' && (
              <div className="text-center py-4 space-y-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mx-auto shadow-md">
                  <Check className="h-8 w-8 stroke-[3]" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Password Reset!
                </h1>
                <p className="text-xs sm:text-sm text-sidebar-foreground/85 font-normal leading-relaxed">
                  Your password has been securely reset. You can now log into
                  Mezmani using your new credentials.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: '/login', search: { redirect } })
                    }
                    className="w-full py-3.5 sm:py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-bold text-[16px] shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Sign In Now
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[12px] text-sidebar-foreground/60">
                  Redirecting to login in {redirectCountdown}s...
                </p>
              </div>
            )}
          </div>

          {/* Smooth Mobile Bottom Wave Divider */}
          <svg
            className="w-full h-6 text-card fill-current block md:hidden absolute bottom-0 left-0 -mb-[1px] pointer-events-none transition-colors duration-300"
            viewBox="0 0 400 30"
            preserveAspectRatio="none"
          >
            <path d="M0,0 C150,30 250,30 400,0 L400,30 L0,30 Z" />
          </svg>
        </div>

        {/* ==================== RIGHT PANEL (Clean Card Surface with Amber Gold Accent) ==================== */}
        <div className="relative w-full md:w-[44%] bg-card text-card-foreground flex flex-col items-center justify-center px-6 sm:px-10 py-10 sm:py-14 text-center overflow-hidden transition-colors duration-300">
          {/* Decorative Warm Ambient Circle */}
          <div className="w-44 sm:w-52 h-44 sm:h-52 rounded-full bg-primary/10 absolute -bottom-16 -right-16 pointer-events-none blur-xl transition-colors duration-300" />

          {/* Content Container */}
          <div className="relative z-10 max-w-[300px] sm:max-w-xs flex flex-col items-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Remember It?
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-3 mb-6 leading-relaxed font-normal">
              If you recall your password or accessed your credentials, you can
              return straight back to sign in.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: '/login', search: { redirect } })}
              className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold text-[15px] sm:text-[16px] px-10 sm:px-12 py-3 sm:py-3.5 rounded-xl shadow-xs transition-all min-w-[170px] cursor-pointer active:scale-[0.99] mb-4"
            >
              Sign In
            </button>

            <div className="w-full border-t border-border/70 my-3" />

            <div className="text-xs text-muted-foreground mt-2 space-y-2">
              <p>New to Mezmani?</p>
              <Link
                to="/signup"
                search={{ redirect }}
                className="text-primary font-bold hover:underline inline-block"
              >
                Create an Account
              </Link>
            </div>

            {/* Need Help Support Pill */}
            <div className="mt-6 w-full">
              <a
                href="tel:+9779802088800"
                className="inline-flex items-center justify-center gap-2 border border-border/70 hover:border-primary/50 text-muted-foreground hover:text-foreground text-xs py-2.5 px-4 rounded-xl transition-colors w-full"
              >
                <PhoneCall className="h-3.5 w-3.5 text-primary" />
                <span>Need help? Call 9802088800</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance & Trust Badges aligned to theme */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span>18+ Verified Platform</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-warning" />
          <span>30-Minute Valley Delivery</span>
        </div>
      </div>
    </div>
  )
}
