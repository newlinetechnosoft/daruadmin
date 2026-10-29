import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import type { Order } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { createDeliveryProofUploadFn } from '#/server/operations/operations.functions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { Badge } from '#/components/ui/badge'
import {
  ShieldCheck,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Coins,
  CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'

export interface DeliveryProofDialogProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onConfirmDelivery: (args: {
    orderId: string
    ageVerifiedAtDelivery: boolean
    deliveryOtp?: string
    proofPhotoUrl?: string
    notes?: string
  }) => Promise<void>
  isSubmitting?: boolean
}

export function DeliveryProofDialog({
  order,
  isOpen,
  onClose,
  onConfirmDelivery,
  isSubmitting = false,
}: DeliveryProofDialogProps) {
  const [ageVerified, setAgeVerified] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [riderNote, setRiderNote] = useState('')
  const [activeProofMode, setActiveProofMode] = useState<'otp' | 'photo'>('otp')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!order) return null

  const hasLiquor = order.items.some((it) => it.catalogType === 'liquor')
  const isCOD = order.paymentMethod === 'cod'

  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingPhoto(true)
      const upload = await createDeliveryProofUploadFn({
        data: {
          filename: file.name,
          contentType: file.type || 'image/jpeg',
        },
      })

      const res = await fetch(upload.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
      })

      if (!res.ok) {
        throw new Error('Failed to upload photo to storage.')
      }

      setPhotoUrl(upload.publicUrl)
      toast.success('Delivery proof photo attached!')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Photo upload failed. Try again.',
      )
    } finally {
      setIsUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleComplete = async () => {
    if (hasLiquor && !ageVerified) {
      toast.error(
        'Age verification (18+) is legally mandatory for liquor orders.',
      )
      return
    }

    if (!otpCode.trim() && !photoUrl) {
      toast.error(
        'Please enter the customer 4-digit OTP or attach a delivery proof photo.',
      )
      return
    }

    await onConfirmDelivery({
      orderId: order.id,
      ageVerifiedAtDelivery: ageVerified,
      deliveryOtp: otpCode.trim() || undefined,
      proofPhotoUrl: photoUrl || undefined,
      notes: riderNote.trim() || undefined,
    })

    // Reset local state on success
    setAgeVerified(false)
    setOtpCode('')
    setPhotoUrl('')
    setRiderNote('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="font-mono text-xs">
              Order #{order.number}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {order.customerPhone}
            </span>
          </div>
          <DialogTitle className="text-base font-bold text-foreground pt-1 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Complete Delivery &amp; Collect Proof
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {order.customerName} — {order.address}, {order.city}
          </DialogDescription>
        </DialogHeader>

        {/* Payment Collection Callout */}
        {isCOD ? (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block">
                  Cash on Delivery
                </span>
                <span className="text-xs opacity-80">
                  Collect cash from customer
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-extrabold text-amber-600 dark:text-amber-400">
                {formatNPR(order.total)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold">Paid Online (eSewa)</span>
            </div>
            <Badge
              variant="outline"
              className="text-xs bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            >
              No Cash Collection
            </Badge>
          </div>
        )}

        {/* 18+ Age Verification Requirement */}
        {hasLiquor && (
          <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Age Verification Required (18+)
              </span>
              <Badge
                variant="destructive"
                className="text-xs uppercase font-bold py-0"
              >
                Mandatory
              </Badge>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="age-verification-check"
                checked={ageVerified}
                onCheckedChange={(checked) => setAgeVerified(Boolean(checked))}
                className="mt-0.5"
              />
              <Label
                htmlFor="age-verification-check"
                className="text-xs text-foreground cursor-pointer font-medium leading-tight"
              >
                I confirm that I have verified the recipient is 18 years or
                older.
              </Label>
            </div>
          </div>
        )}

        {/* Proof of Delivery Mode Toggle */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Proof of Delivery Method
            </Label>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setActiveProofMode('otp')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                  activeProofMode === 'otp'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Customer OTP
              </button>
              <button
                type="button"
                onClick={() => setActiveProofMode('photo')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                  activeProofMode === 'photo'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Doorstep Photo
              </button>
            </div>
          </div>

          {/* OTP Mode */}
          {activeProofMode === 'otp' && (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-card">
              <Label htmlFor="otp-input" className="text-xs font-medium">
                Enter 4-Digit Customer Code
              </Label>
              <Input
                id="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4821"
                className="h-10 text-center font-mono text-lg font-bold tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Ask the customer for the PIN displayed on their live tracking
                page.
              </p>
            </div>
          )}

          {/* Photo Mode */}
          {activeProofMode === 'photo' && (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-card">
              <Label className="text-xs font-medium">
                Capture Doorstep / Handover Photo
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {photoUrl ? (
                <div className="relative inline-block border border-border rounded-lg overflow-hidden">
                  <img
                    src={photoUrl}
                    alt="Proof Preview"
                    className="h-28 w-auto object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="w-full h-14 border-dashed border-2 flex flex-col items-center justify-center gap-1 text-xs"
                >
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Uploading photo...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span>Take Photo or Upload from Camera</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Optional Rider Notes */}
          <div className="space-y-1 pt-1">
            <Label
              htmlFor="rider-notes"
              className="text-xs font-medium text-muted-foreground"
            >
              Delivery Notes (Optional)
            </Label>
            <Input
              id="rider-notes"
              type="text"
              value={riderNote}
              onChange={(e) => setRiderNote(e.target.value)}
              placeholder="e.g. Handed to customer at gate"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting || isUploadingPhoto}
            className="text-xs h-9 flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleComplete}
            disabled={isSubmitting || isUploadingPhoto}
            className="text-xs h-9 flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                {isCOD ? 'Confirm & Collect Cash' : 'Confirm Delivery'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
