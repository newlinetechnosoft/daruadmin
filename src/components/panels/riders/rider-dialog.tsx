import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
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
import { Checkbox } from '#/components/ui/checkbox'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Bike,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Coins,
  Loader2,
  User,
  Navigation,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatNPR, fromPaisa } from '#/lib/money'
import { upsertRiderFn } from '#/server/operations/operations.functions'
import { adminQueries } from '#/queries/admin'
import type { Rider } from '#/server/operations/types'

export interface RiderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rider?: Rider | null
  onSuccess?: (savedRider: Rider) => void
}

export function RiderDialog({
  open,
  onOpenChange,
  rider,
  onSuccess,
}: RiderDialogProps) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const isEditing = Boolean(rider)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+977 ')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [vehicle, setVehicle] = useState<'bike' | 'scooter' | 'car'>('bike')
  const [licenseNo, setLicenseNo] = useState('')
  const [zone, setZone] = useState('Butwal Core')
  const [status, setStatus] = useState<'available' | 'busy' | 'offline'>('available')
  const [commissionRate, setCommissionRate] = useState('10')
  const [baseSalaryNpr, setBaseSalaryNpr] = useState('0')
  const [perDropRateNpr, setPerDropRateNpr] = useState('50')
  const [verified, setVerified] = useState(true)
  const [available, setAvailable] = useState(true)

  const [activeTab, setActiveTab] = useState<'profile' | 'dispatch' | 'payout'>('profile')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize or reset form values whenever rider or open state changes
  useEffect(() => {
    if (open) {
      if (rider) {
        setName(rider.name || '')
        setEmail(rider.email || '')
        setPhone(rider.phone || '+977 ')
        setPassword('')
        setShowPassword(false)
        setVehicle(rider.vehicle)
        setLicenseNo(rider.licenseNo || '')
        setZone(rider.zone || 'Butwal Core')
        setStatus(rider.status)
        setCommissionRate(String(rider.commissionRate))
        setBaseSalaryNpr(rider.baseSalary ? String(fromPaisa(rider.baseSalary)) : '0')
        setPerDropRateNpr(rider.perDropRate ? String(fromPaisa(rider.perDropRate)) : '50')
        setVerified(Boolean(rider.verified))
        setAvailable(Boolean(rider.available))
      } else {
        setName('')
        setEmail('')
        setPhone('+977 ')
        setPassword('')
        setShowPassword(false)
        setVehicle('bike')
        setLicenseNo('')
        setZone('Butwal Core')
        setStatus('available')
        setCommissionRate('10')
        setBaseSalaryNpr('0')
        setPerDropRateNpr('50')
        setVerified(true)
        setAvailable(true)
      }
      setActiveTab('profile')
    }
  }, [open, rider])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName || trimmedName.length < 2) {
      toast.error('Courier name must be at least 2 characters')
      setActiveTab('profile')
      return
    }

    if (!trimmedPhone || trimmedPhone.replace(/\D/g, '').length < 6) {
      toast.error('Please enter a valid contact phone number')
      setActiveTab('profile')
      return
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error('Please enter a valid email address for courier portal access')
      setActiveTab('profile')
      return
    }

    if (!isEditing && (!password || password.length < 8)) {
      toast.error('Password must be at least 8 characters long for new couriers')
      setActiveTab('profile')
      return
    }

    if (isEditing && password && password.length < 8) {
      toast.error('New password must be at least 8 characters long')
      setActiveTab('profile')
      return
    }

    const commRateNum = Number(commissionRate)
    if (isNaN(commRateNum) || commRateNum < 0 || commRateNum > 100) {
      toast.error('Commission rate must be between 0% and 100%')
      setActiveTab('payout')
      return
    }

    const baseSalaryNum = Number(baseSalaryNpr)
    if (isNaN(baseSalaryNum) || baseSalaryNum < 0) {
      toast.error('Base salary must be a positive number')
      setActiveTab('payout')
      return
    }

    const perDropNum = Number(perDropRateNpr)
    if (isNaN(perDropNum) || perDropNum < 0) {
      toast.error('Per-drop rate must be a positive number')
      setActiveTab('payout')
      return
    }

    try {
      setIsSubmitting(true)

      await upsertRiderFn({
        data: {
          id: rider?.id,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          password: password ? password.trim() : undefined,
          vehicle,
          licenseNo: licenseNo.trim(),
          zone,
          commissionRate: commRateNum,
          baseSalary: baseSalaryNum,
          perDropRate: perDropNum,
          verified,
          available,
          status,
        },
      })

      toast.success(
        isEditing
          ? `Courier ${trimmedName} updated successfully`
          : `Courier ${trimmedName} registered with login access`,
      )

      await queryClient.invalidateQueries({
        queryKey: adminQueries.riders().queryKey,
      })
      await router.invalidate()

      onOpenChange(false)
      if (onSuccess && rider) {
        onSuccess({
          ...rider,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          vehicle,
          licenseNo: licenseNo.trim(),
          zone,
          commissionRate: commRateNum,
          baseSalary: Math.round(baseSalaryNum * 100),
          perDropRate: Math.round(perDropNum * 100),
          verified,
          available,
          status,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save courier'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border shrink-0 bg-muted/20">
            <div className="flex items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Bike className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-semibold tracking-tight">
                    {isEditing ? `Edit courier: ${rider?.name}` : 'Onboard fleet courier'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {isEditing
                      ? 'Update delivery courier credentials, vehicle specs, and dispatch terms.'
                      : 'Register new delivery personnel with credentials for mobile dispatch portal.'}
                  </DialogDescription>
                </div>
              </div>
              {isEditing && rider && (
                <Badge
                  variant={rider.verified ? 'success' : 'warning'}
                  className="text-[10px] font-normal shrink-0"
                >
                  {rider.verified ? 'KYC Verified' : 'KYC Pending'}
                </Badge>
              )}
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as typeof activeTab)}
              className="mt-3 w-full"
            >
              <TabsList className="grid grid-cols-3 h-8 p-0.5 bg-muted/60">
                <TabsTrigger value="profile" className="text-xs gap-1.5 h-7">
                  <User className="size-3" />
                  <span>Profile & Account</span>
                </TabsTrigger>
                <TabsTrigger value="dispatch" className="text-xs gap-1.5 h-7">
                  <Navigation className="size-3" />
                  <span>Vehicle & Zone</span>
                </TabsTrigger>
                <TabsTrigger value="payout" className="text-xs gap-1.5 h-7">
                  <DollarSign className="size-3" />
                  <span>Payout & Terms</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rider-name" className="text-xs font-medium">
                    Full courier name *
                  </Label>
                  <Input
                    id="rider-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Shrestha"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rider-phone" className="text-xs font-medium">
                      Contact mobile phone *
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="rider-phone"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+977 98..."
                        className="pl-8 h-8 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rider-email" className="text-xs font-medium">
                      Email address (Login) *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="rider-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rider@mezmani.com.np"
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rider-password" className="text-xs font-medium">
                      {isEditing ? 'Change login password' : 'Login password *'}
                    </Label>
                    {isEditing && (
                      <span className="text-[10px] text-muted-foreground">
                        Leave blank to preserve existing password
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="rider-password"
                      type={showPassword ? 'text' : 'password'}
                      required={!isEditing}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isEditing ? 'Enter new password (optional)' : 'Minimum 8 characters'}
                      className="pl-8 pr-8 h-8 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isEditing && rider && rider.cashOnHand > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                      <Coins className="size-4 shrink-0" />
                      <div>
                        <span className="font-semibold">Unremitted COD Custody: </span>
                        <span className="font-mono">{formatNPR(rider.cashOnHand)}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {rider.deliveries} completed drops
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dispatch' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rider-vehicle" className="text-xs font-medium">
                      Vehicle transport mode
                    </Label>
                    <NativeSelect
                      id="rider-vehicle"
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value as 'bike' | 'scooter' | 'car')}
                      size="sm"
                      className="w-full text-xs"
                    >
                      <NativeSelectOption value="bike">Motorcycle</NativeSelectOption>
                      <NativeSelectOption value="scooter">Scooter</NativeSelectOption>
                      <NativeSelectOption value="car">Delivery Van / Car</NativeSelectOption>
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rider-plate" className="text-xs font-medium">
                      Vehicle plate / license no.
                    </Label>
                    <Input
                      id="rider-plate"
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      placeholder="e.g. LU-2-PA-8899"
                      className="h-8 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rider-zone" className="text-xs font-medium">
                      Primary territory / zone
                    </Label>
                    <NativeSelect
                      id="rider-zone"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      size="sm"
                      className="w-full text-xs"
                    >
                      <NativeSelectOption value="Butwal Core">Butwal Core</NativeSelectOption>
                      <NativeSelectOption value="Tilottama / Manigram">
                        Tilottama / Manigram
                      </NativeSelectOption>
                      <NativeSelectOption value="Siddharthanagar / Bhairahawa">
                        Siddharthanagar / Bhairahawa
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rider-status" className="text-xs font-medium">
                      Live duty status
                    </Label>
                    <NativeSelect
                      id="rider-status"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as 'available' | 'busy' | 'offline')
                      }
                      size="sm"
                      className="w-full text-xs"
                    >
                      <NativeSelectOption value="available">
                        Available (Ready for orders)
                      </NativeSelectOption>
                      <NativeSelectOption value="busy">
                        Busy (Out on delivery)
                      </NativeSelectOption>
                      <NativeSelectOption value="offline">
                        Offline (Off duty)
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-border p-3 bg-muted/10">
                  <Checkbox
                    id="rider-available"
                    checked={available}
                    onCheckedChange={(c) => setAvailable(Boolean(c))}
                    className="mt-0.5"
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor="rider-available"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Dispatchable on duty roster
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      When enabled, this courier appears in the automated sourcing radar and dispatcher queue.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payout' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rider-commission" className="text-xs font-medium">
                      Commission rate (%)
                    </Label>
                    <Input
                      id="rider-commission"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="h-8 font-mono text-xs"
                      placeholder="10"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      % of order delivery fee
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rider-base-salary" className="text-xs font-medium">
                      Base monthly salary (NPR)
                    </Label>
                    <Input
                      id="rider-base-salary"
                      type="number"
                      min="0"
                      step="500"
                      value={baseSalaryNpr}
                      onChange={(e) => setBaseSalaryNpr(e.target.value)}
                      className="h-8 font-mono text-xs"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Monthly guaranteed retainer
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rider-per-drop" className="text-xs font-medium">
                      Per-drop rate (NPR)
                    </Label>
                    <Input
                      id="rider-per-drop"
                      type="number"
                      min="0"
                      step="5"
                      value={perDropRateNpr}
                      onChange={(e) => setPerDropRateNpr(e.target.value)}
                      className="h-8 font-mono text-xs"
                      placeholder="50"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Fixed payout per delivery
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-border p-3 bg-muted/10">
                  <Checkbox
                    id="rider-verified"
                    checked={verified}
                    onCheckedChange={(c) => setVerified(Boolean(c))}
                    className="mt-0.5"
                  />
                  <div className="grid gap-0.5 leading-none">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="rider-verified"
                        className="text-xs font-medium cursor-pointer"
                      >
                        KYC & Identity Verified
                      </Label>
                      <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Rider citizenship, driver license, and emergency contacts are validated. Authorizes cash-on-delivery handling up to Rs. 20,000.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              {isEditing ? `ID: ${rider?.id}` : 'New courier entry'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs gap-1.5"
              >
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                {isSubmitting
                  ? 'Saving...'
                  : isEditing
                    ? 'Save courier changes'
                    : 'Register courier'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
