import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '#/components/ui/input-otp'
import {
  Phone,
  ShieldCheck,
  RotateCw,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  requestChangePhoneOtpFn,
  verifyChangePhoneOtpFn,
  resendPhoneOtpFn,
} from '#/server/otp/otp.functions'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'

interface EditPhoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPhone?: string | null
  onSuccess?: (newPhone: string) => void
}

export function EditPhoneDialog({
  open,
  onOpenChange,
  currentPhone,
  onSuccess,
}: EditPhoneDialogProps) {
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [newPhone, setNewPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successDone, setSuccessDone] = useState(false)

  // Reset dialog state when opened/closed
  useEffect(() => {
    if (open) {
      setStep('input')
      setNewPhone('')
      setOtp('')
      setIsLoading(false)
      setIsResending(false)
      setErrorMessage(null)
      setSuccessDone(false)
      setCountdown(60)
    }
  }, [open])

  // Countdown timer for resend
  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [step, countdown])

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMessage(null)

    const normalized = normalizeNepaliPhone(newPhone.trim())
    if (!normalized) {
      setErrorMessage(
        'Please enter a valid 10-digit Nepali mobile number (e.g. 9847820683).',
      )
      return
    }

    const currentNormalized = currentPhone ? normalizeNepaliPhone(currentPhone) : null
    if (currentNormalized && normalized === currentNormalized) {
      setErrorMessage(
        'The new number is the same as your current phone number.',
      )
      return
    }

    setIsLoading(true)
    try {
      const res = await requestChangePhoneOtpFn({
        data: { newPhone: normalized },
      })

      if (res.success) {
        setStep('otp')
        setCountdown(res.cooldownSeconds || 60)
        toast.success(`Verification code sent to +977 ${normalized}`)
      } else {
        setErrorMessage(
          res.message ||
            'Unable to send verification code. Please check your phone number.',
        )
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to request verification code. Please try again.'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? otp).trim()
    if (code.length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.')
      return
    }

    const normalized = normalizeNepaliPhone(newPhone.trim())
    if (!normalized) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await verifyChangePhoneOtpFn({
        data: {
          newPhone: normalized,
          code,
        },
      })

      if (res.success) {
        setSuccessDone(true)
        toast.success(
          'Mobile number updated and verified successfully!',
        )
        onSuccess?.(normalized)
        setTimeout(() => {
          onOpenChange(false)
        }, 1200)
      } else {
        setErrorMessage(
          res.message || 'Invalid or expired code. Please try again.',
        )
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to verify code. Please try again.'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || isResending) return
    const normalized = normalizeNepaliPhone(newPhone.trim())
    if (!normalized) return

    setIsResending(true)
    setErrorMessage(null)

    try {
      const res = await resendPhoneOtpFn({
        data: { phone: normalized },
      })

      if (res.success) {
        setCountdown(res.cooldownSeconds || 60)
        setOtp('')
        toast.success(`New code sent to +977 ${normalized}`)
      } else {
        setErrorMessage(res.message || 'Unable to resend verification code.')
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to resend code. Please try again.'
      setErrorMessage(msg)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl border-border/80 shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Update Mobile Number
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {step === 'input'
                  ? 'Enter your new phone number to receive an SMS verification code'
                  : `Verify the 6-digit OTP code sent to +977 ${normalizeNepaliPhone(newPhone) || newPhone}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in-50 duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successDone ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 animate-in zoom-in-95 duration-200">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-foreground">Phone Number Verified!</h4>
            <p className="text-xs text-muted-foreground">
              Your profile has been updated with the new mobile number.
            </p>
          </div>
        ) : step === 'input' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 py-2">
            {currentPhone && (
              <div className="rounded-xl bg-muted/50 border border-border/60 p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current registered phone:</span>
                <span className="font-mono font-medium text-foreground">
                  +977 {currentPhone}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-phone" className="text-xs font-semibold">
                New Mobile Number
              </Label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-semibold text-muted-foreground pointer-events-none select-none flex items-center gap-1.5">
                  <span className="text-sm">🇳🇵</span> +977
                </span>
                <Input
                  id="new-phone"
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={newPhone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^\d]/g, '').slice(0, 10)
                    setNewPhone(clean)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  className="pl-20 font-mono tracking-wider text-sm rounded-xl"
                  autoFocus
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Must be an active 10-digit mobile number starting with 98 or 97.
              </p>
            </div>

            <DialogFooter className="pt-2 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || newPhone.trim().length < 10}
                className="rounded-xl font-semibold gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground">
                Enter 6-digit OTP Code
              </Label>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val)
                  if (errorMessage) setErrorMessage(null)
                  if (val.length === 6) {
                    handleVerifyOtp(val)
                  }
                }}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="h-11 w-10 text-base font-bold rounded-l-xl" />
                  <InputOTPSlot index={1} className="h-11 w-10 text-base font-bold" />
                  <InputOTPSlot index={2} className="h-11 w-10 text-base font-bold" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="h-11 w-10 text-base font-bold" />
                  <InputOTPSlot index={4} className="h-11 w-10 text-base font-bold" />
                  <InputOTPSlot index={5} className="h-11 w-10 text-base font-bold rounded-r-xl" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={() => {
                  setStep('input')
                  setErrorMessage(null)
                }}
                className="text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Change number
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
                className="text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
              >
                {isResending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Resending...
                  </>
                ) : countdown > 0 ? (
                  <>
                    <RotateCw className="h-3 w-3 opacity-60" />
                    Resend code in {countdown}s
                  </>
                ) : (
                  <>
                    <RotateCw className="h-3 w-3" />
                    Resend code
                  </>
                )}
              </button>
            </div>

            <DialogFooter className="pt-2 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleVerifyOtp()}
                disabled={isLoading || otp.length !== 6}
                className="rounded-xl font-semibold gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Verify & Save</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
