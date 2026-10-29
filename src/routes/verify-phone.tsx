import { useEffect, useRef, useState, useCallback } from 'react'
import type { FormEvent } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
  redirect,
  isRedirect,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { toast } from 'sonner'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '#/components/ui/input-otp'
import {
  ShieldCheck,
  Zap,
  RotateCw,
  PhoneCall,
  Sparkles,
  ArrowRight,
  XCircle,
  LogIn,
} from 'lucide-react'
import { adminQueries } from '#/queries/admin'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import { verifyPhoneOtpFn, resendPhoneOtpFn } from '#/server/otp/otp.functions'
import { authClient } from '#/lib/auth-client'
import { getPendingSignup, clearPendingSignup } from '#/lib/pending-auth'

const verifyPhoneSearchSchema = z.object({
  phone: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).trim())
    .optional()
    .default(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/verify-phone')({
  validateSearch: (search) => verifyPhoneSearchSchema.parse(search),
  beforeLoad: async ({ search, context }) => {
    const rawPhone = search.phone.trim()
    const normalized = rawPhone ? normalizeNepaliPhone(rawPhone) : null

    if (!normalized) {
      throw redirect({
        to: '/signup',
        search: { redirect: search.redirect },
      })
    }

    try {
      const access = await context.queryClient.ensureQueryData(
        adminQueries.access(),
      )
      if (access.authenticated && access.user.phoneVerified) {
        throw redirect({
          to: search.redirect || '/drinks',
        })
      }
    } catch (err) {
      if (isRedirect(err)) throw err
    }
  },
  component: VerifyPhonePage,
})

function maskPhone(p: string): string {
  const normalized = normalizeNepaliPhone(p) || p
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}••••${normalized.slice(7)}`
  }
  return normalized
}

function VerifyPhonePage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  const normalizedPhone = normalizeNepaliPhone(search.phone) || search.phone

  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const otpContainerRef = useRef<HTMLDivElement>(null)

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleVerify = useCallback(
    async (codeToVerify: string) => {
      if (codeToVerify.length !== 6 || isVerifying) return

      setIsVerifying(true)
      setErrorMessage(null)

      try {
        const result = await verifyPhoneOtpFn({
          data: {
            phone: normalizedPhone,
            code: codeToVerify,
          },
        })

        if (result.success) {
          // If there is pending registration in sessionStorage, NOW create the account
          const pending = getPendingSignup()
          if (pending && pending.phone === normalizedPhone) {
            const signupRes = await authClient.signUp.email({
              name: pending.name,
              email: pending.email,
              password: pending.password,
              phone: pending.phone,
              image: pending.image,
            })

            if (signupRes.error) {
              // If user was already in DB unverified, sign in with their credentials
              const signInRes = await authClient.signIn.email({
                email: pending.email,
                password: pending.password,
                rememberMe: true,
              })
              if (signInRes.error) {
                toast.error(
                  signupRes.error.message ||
                    'Account verification succeeded, but sign-in failed. Please log in.',
                )
                clearPendingSignup()
                navigate({
                  to: '/login',
                  search: { redirect: search.redirect },
                })
                return
              }
            }

            clearPendingSignup()
            toast.success(
              'Account created and mobile number verified successfully! Welcome to Mezmani.',
            )
          } else {
            toast.success(
              'Mobile number verified successfully! Welcome to Mezmani.',
            )
          }

          queryClient.clear()
          await router.invalidate()

          navigate({
            to: search.redirect || '/drinks',
          })
          return
        }

        // Handle specific verification failure modes
        if (result.reason === 'expired') {
          setErrorMessage(
            result.message ||
              'Verification code has expired. Please request a new code below.',
          )
        } else if (result.reason === 'max_attempts') {
          setErrorMessage(
            result.message ||
              'Maximum attempts exceeded for this code. Please request a fresh code to continue.',
          )
        } else {
          setErrorMessage(result.message || 'Invalid 6-digit verification code.')
        }

        setOtp('')
        const firstInput = otpContainerRef.current?.querySelector('input')
        firstInput?.focus()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Verification failed')
        setOtp('')
      } finally {
        setIsVerifying(false)
      }
    },
    [
      normalizedPhone,
      isVerifying,
      queryClient,
      router,
      navigate,
      search.redirect,
    ],
  )

  const handleOtpChange = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6)
    setOtp(clean)
    setErrorMessage(null)

    if (clean.length === 6) {
      handleVerify(clean)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || isResending) return

    setIsResending(true)
    setErrorMessage(null)

    try {
      const result = await resendPhoneOtpFn({
        data: {
          phone: normalizedPhone,
        },
      })

      if (result.success) {
        toast.success('A new 6-digit verification code has been sent!')
        setCountdown(result.cooldownSeconds || 60)
        setOtp('')
        const firstInput = otpContainerRef.current?.querySelector('input')
        firstInput?.focus()
      } else {
        toast.error(result.message || 'Unable to resend code right now')
        if (result.cooldownSeconds) {
          setCountdown(result.cooldownSeconds)
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend code')
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (otp.length === 6) {
      handleVerify(otp)
    }
  }

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      <Header />

      <main className="flex-1 flex items-center justify-center py-8 sm:py-12 md:py-16 px-4">
        <div className="w-full max-w-[960px] mx-auto relative z-10">
          
          {/* Decorative ambient background glows aligned to system theme */}
          <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-blue-500/15 dark:bg-blue-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-amber-500/15 dark:bg-amber-600/10 blur-3xl pointer-events-none" />

          {/* Main Card Container with Split Design Format */}
          <div className="relative w-full rounded-[28px] sm:rounded-[36px] bg-card dark:bg-[#1c2023] shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)] border border-border dark:border-[#2a2f34] overflow-hidden flex flex-col md:flex-row transition-all duration-300">
            
            {/* ==================== LEFT PANEL (Vibrant Blue Curve) ==================== */}
            <div className="relative w-full md:w-[56%] bg-gradient-to-br from-[#0062E0] via-[#0052D4] to-[#00389E] dark:from-[#004bb5] dark:via-[#003c9c] dark:to-[#002773] text-white p-7 sm:p-10 md:p-12 flex flex-col justify-center overflow-hidden z-10 transition-colors duration-300">
              
              {/* Decorative Organic Shapes matching UI Mockup */}
              {/* Top-Right Dark Blue Circle */}
              <div className="w-52 h-52 rounded-full bg-[#00348D]/70 absolute -top-16 -right-12 pointer-events-none" />
              
              {/* Bottom-Right Dark Blue Shape */}
              <div className="w-64 h-64 rounded-full bg-[#002777]/80 absolute -bottom-24 -right-16 pointer-events-none" />
              
              {/* Bottom-Left Luminous Blue Glow */}
              <div className="w-56 h-56 rounded-full bg-[#388BFF]/35 blur-2xl absolute -bottom-16 -left-16 pointer-events-none" />

              {/* Organic Wave Divider on Desktop Edge */}
              <svg
                className="absolute -right-16 lg:-right-20 top-0 h-full w-16 lg:w-20 pointer-events-none hidden md:block text-[#0052D4] dark:text-[#003c9c] fill-current z-10 transition-colors duration-300"
                viewBox="0 0 100 600"
                preserveAspectRatio="none"
              >
                <path d="M0,0 L0,600 Q95,450 35,300 Q105,150 0,0 Z" />
              </svg>

              {/* Form Content */}
              <div className="relative z-20 w-full max-w-[370px] mx-auto">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="text-center mb-5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                      Verify Your Mobile
                    </h1>
                    <p className="text-xs sm:text-sm text-blue-100/90 mt-1.5 font-normal leading-relaxed">
                      Enter the 6-digit verification code sent to{' '}
                      <span className="font-mono font-bold text-amber-300 inline-block">
                        +977 {maskPhone(normalizedPhone)}
                      </span>
                    </p>
                    <div className="mt-1">
                      <Link
                        to="/signup"
                        search={{ redirect: search.redirect }}
                        className="text-[12px] text-blue-200 hover:text-white underline underline-offset-2 transition-colors inline-block"
                      >
                        Wrong number? Change it here
                      </Link>
                    </div>
                  </div>

                  {/* Inline Error Alert */}
                  {errorMessage && (
                    <div className="rounded-xl bg-rose-500/20 border border-rose-300/40 p-3 text-white text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                      <XCircle className="h-4 w-4 text-rose-300 shrink-0 mt-0.5" />
                      <span className="leading-snug">{errorMessage}</span>
                    </div>
                  )}

                  {/* 6-Slot OTP Input with High-Contrast White Pill Slots */}
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
                      disabled={isVerifying}
                      className="gap-2 sm:gap-2.5"
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot
                          index={0}
                          className="h-12 w-10 sm:h-14 sm:w-12 bg-white text-gray-900 font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-md shadow-blue-950/15 border-0 ring-1 ring-black/5 focus:ring-2 focus:ring-amber-400"
                        />
                        <InputOTPSlot
                          index={1}
                          className="h-12 w-10 sm:h-14 sm:w-12 bg-white text-gray-900 font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-md shadow-blue-950/15 border-0 ring-1 ring-black/5 focus:ring-2 focus:ring-amber-400"
                        />
                        <InputOTPSlot
                          index={2}
                          className="h-12 w-10 sm:h-14 sm:w-12 bg-white text-gray-900 font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-md shadow-blue-950/15 border-0 ring-1 ring-black/5 focus:ring-2 focus:ring-amber-400"
                        />
                      </InputOTPGroup>
                      <InputOTPSeparator className="text-white/60 font-bold" />
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot
                          index={3}
                          className="h-12 w-10 sm:h-14 sm:w-12 bg-white text-gray-900 font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-md shadow-blue-950/15 border-0 ring-1 ring-black/5 focus:ring-2 focus:ring-amber-400"
                        />
                        <InputOTPSlot
                          index={4}
                          className="h-12 w-10 sm:h-14 sm:w-12 bg-white text-gray-900 font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-md shadow-blue-950/15 border-0 ring-1 ring-black/5 focus:ring-2 focus:ring-amber-400"
                        />
                        <InputOTPSlot
                          index={5}
                          className="h-12 w-10 sm:h-14 sm:w-12 bg-white text-gray-900 font-mono font-bold text-xl sm:text-2xl rounded-xl shadow-md shadow-blue-950/15 border-0 ring-1 ring-black/5 focus:ring-2 focus:ring-amber-400"
                        />
                      </InputOTPGroup>
                    </InputOTP>

                    <p className="text-[12px] text-blue-100/90 pt-1 flex items-center gap-1.5 font-medium">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      Code expires in 5 minutes
                    </p>
                  </div>

                  {/* Amber CTA Button matching Mezmani Primary Theme */}
                  <button
                    type="submit"
                    disabled={otp.length !== 6 || isVerifying}
                    className="w-full mt-2 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-[#F59E0B] hover:bg-[#D97706] active:scale-[0.99] text-slate-950 font-bold text-[16px] shadow-[0_10px_25px_-5px_rgba(245,158,11,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                        Verifying code...
                      </span>
                    ) : (
                      <>
                        Verify & Complete
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Resend Code Options */}
                  <div className="flex flex-col items-center justify-center space-y-2 pt-1 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-blue-100">
                      <span>Didn&apos;t receive the code?</span>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={countdown > 0 || isResending}
                        className="font-bold text-amber-300 hover:text-amber-200 underline disabled:text-blue-200/60 disabled:no-underline cursor-pointer transition-colors"
                      >
                        {isResending ? (
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
              </div>

              {/* Smooth Mobile Bottom Wave Divider */}
              <svg
                className="w-full h-6 text-card dark:text-[#1c2023] fill-current block md:hidden absolute bottom-0 left-0 -mb-[1px] pointer-events-none transition-colors duration-300"
                viewBox="0 0 400 30"
                preserveAspectRatio="none"
              >
                <path d="M0,0 C150,30 250,30 400,0 L400,30 L0,30 Z" />
              </svg>
            </div>

            {/* ==================== RIGHT PANEL (System Card Surface with Blue Accent) ==================== */}
            <div className="relative w-full md:w-[44%] bg-card dark:bg-[#1c2023] flex flex-col items-center justify-center px-6 sm:px-10 py-10 sm:py-14 text-center overflow-hidden transition-colors duration-300">
              
              {/* Decorative Bottom-Right Blue Accent Shape */}
              <div className="w-44 sm:w-52 h-44 sm:h-52 rounded-full bg-[#0062E0] dark:bg-[#004bb5] absolute -bottom-16 -right-16 pointer-events-none opacity-95 shadow-lg transition-colors duration-300" />

              {/* Content Container */}
              <div className="relative z-10 max-w-[300px] sm:max-w-xs flex flex-col items-center">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Security First
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-3 mb-6 leading-relaxed font-normal">
                  Mobile SMS verification prevents unauthorized access, guarantees seamless 30-minute valley delivery coordination, and complies with Nepal regulations.
                </p>

                {/* Need Help Support Pill */}
                <div className="space-y-3 w-full">
                  <a
                    href="tel:+9779802088800"
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#0066FF] to-[#0052D4] hover:brightness-105 active:scale-[0.99] text-white font-bold text-[14px] sm:text-[15px] px-6 py-3 rounded-xl sm:rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,85,212,0.35)] transition-all w-full cursor-pointer"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Help Hotline: 9802088800
                  </a>

                  <Link
                    to="/login"
                    search={{ redirect: search.redirect }}
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </div>
            </div>

          </div>

          {/* Compliance & Trust Badges aligned to theme */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>18+ Verified Platform</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>30-Minute Valley Delivery</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
