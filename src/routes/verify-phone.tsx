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
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '#/components/ui/input-otp'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  ShieldCheck,
  ArrowRight,
  RotateCw,
  AlertCircle,
  PhoneCall,
  Sparkles,
} from 'lucide-react'
import { adminQueries } from '#/queries/admin'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import { verifyPhoneOtpFn, resendPhoneOtpFn } from '#/server/otp/otp.functions'

const verifyPhoneSearchSchema = z.object({
  phone: z.string().optional().default(''),
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
    return `${normalized.slice(0, 2)}•••••${normalized.slice(7)}`
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
  const [alertError, setAlertError] = useState<{
    title: string
    description: string
  } | null>(null)

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
      setAlertError(null)

      try {
        const result = await verifyPhoneOtpFn({
          data: {
            phone: normalizedPhone,
            code: codeToVerify,
          },
        })

        if (result.success) {
          toast.success(
            'Mobile number verified successfully! Welcome to Mezmani.',
          )

          // Refresh cache and invalidate active routes so user session shows phoneVerified: true
          queryClient.clear()
          await router.invalidate()

          navigate({
            to: search.redirect || '/drinks',
          })
          return
        }

        // Handle specific verification failure modes
        if (result.reason === 'expired') {
          setAlertError({
            title: 'Verification Code Expired',
            description:
              result.message ||
              'The code has expired after 5 minutes. Please request a new code below.',
          })
          setOtp('')
        } else if (result.reason === 'max_attempts') {
          setAlertError({
            title: 'Too Many Attempts',
            description:
              result.message ||
              'Maximum attempts exceeded for this code. Please request a fresh code to continue.',
          })
          setOtp('')
        } else {
          toast.error(result.message || 'Invalid verification code')
          setOtp('')
          // Refocus OTP input
          const firstInput = otpContainerRef.current?.querySelector('input')
          firstInput?.focus()
        }
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
    // Only allow numeric digits
    const clean = value.replace(/\D/g, '').slice(0, 6)
    setOtp(clean)
    setAlertError(null)

    // Auto-submit when all 6 digits are entered
    if (clean.length === 6) {
      handleVerify(clean)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || isResending) return

    setIsResending(true)
    setAlertError(null)

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
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 sm:py-16 px-4">
        <div className="w-full max-w-sm space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="text-center space-y-1.5 pb-6">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Phone verification
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Verify your mobile number
              </CardTitle>
              <CardDescription className="text-xs">
                Enter the 6-digit code sent to{' '}
                <span className="font-mono font-medium text-foreground">
                  {maskPhone(normalizedPhone)}
                </span>
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Inline Alert for expired or exceeded attempts */}
              {alertError && (
                <Alert variant="destructive" className="mb-5 text-xs py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-semibold">
                    {alertError.title}
                  </AlertTitle>
                  <AlertDescription className="text-[11px] mt-0.5 leading-relaxed">
                    {alertError.description}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 6-Slot InputOTP Component */}
                <div
                  ref={otpContainerRef}
                  className="flex flex-col items-center justify-center space-y-2"
                >
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={handleOtpChange}
                    pattern="^[0-9]*$"
                    autoComplete="one-time-code"
                    disabled={isVerifying}
                    className="gap-2"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={0}
                        className="h-11 w-10 text-base font-semibold"
                      />
                      <InputOTPSlot
                        index={1}
                        className="h-11 w-10 text-base font-semibold"
                      />
                      <InputOTPSlot
                        index={2}
                        className="h-11 w-10 text-base font-semibold"
                      />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={3}
                        className="h-11 w-10 text-base font-semibold"
                      />
                      <InputOTPSlot
                        index={4}
                        className="h-11 w-10 text-base font-semibold"
                      />
                      <InputOTPSlot
                        index={5}
                        className="h-11 w-10 text-base font-semibold"
                      />
                    </InputOTPGroup>
                  </InputOTP>

                  <p className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    Code expires in 5 minutes
                  </p>
                </div>

                {/* Verify Button */}
                <Button
                  type="submit"
                  disabled={otp.length !== 6 || isVerifying}
                  className="w-full h-10 text-xs font-medium gap-2"
                >
                  {isVerifying ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Verifying code...
                    </span>
                  ) : (
                    <>
                      Verify number
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Resend & Actions */}
                <div className="flex flex-col items-center justify-center space-y-2 pt-1 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">
                      Didn&apos;t receive the code?
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={handleResend}
                      disabled={countdown > 0 || isResending}
                      className="p-0 h-auto text-xs font-medium text-foreground hover:underline disabled:text-muted-foreground"
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
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-border w-full flex items-center justify-between text-xs">
                    <Link
                      to="/signup"
                      search={{ redirect: search.redirect }}
                      className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                    >
                      Change mobile number
                    </Link>

                    <a
                      href="tel:+9779802088800"
                      className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1"
                    >
                      <PhoneCall className="h-3 w-3" />
                      Need help?
                    </a>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Compliance Footnote */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Government of Nepal Verified Liquor Delivery Partner</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
