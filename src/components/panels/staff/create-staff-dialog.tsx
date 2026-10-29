import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { createStaffUserFn } from '#/server/operations/operations.functions'
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
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ShieldAlert,
  Bike,
} from 'lucide-react'
import { toast } from 'sonner'

interface CreateStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultRole?: 'admin' | 'manager' | 'rider'
  onSuccess?: () => void
}

export function CreateStaffDialog({
  open,
  onOpenChange,
  defaultRole = 'manager',
  onSuccess,
}: CreateStaffDialogProps) {
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const initialFormState = {
    name: '',
    email: '',
    phone: '+977 ',
    password: '',
    role: defaultRole,
    // Rider specific
    vehicle: 'bike' as 'bike' | 'scooter' | 'car',
    licenseNo: '',
    zone: 'Butwal Core',
    commissionRate: 10,
  }

  const [form, setForm] = useState(initialFormState)

  const handleRoleChange = (role: 'admin' | 'manager' | 'rider') => {
    setForm((prev) => ({ ...prev, role }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()

    if (name.length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Invalid email address')
      return
    }
    if (phone.length < 6 || phone === '+977') {
      toast.error('Mobile number must be at least 6 digits')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (form.role === 'rider') {
      const comm = Number(form.commissionRate)
      if (isNaN(comm) || comm < 0 || comm > 100) {
        toast.error('Commission rate must be between 0% and 100%')
        return
      }
    }

    try {
      setIsSubmitting(true)
      await createStaffUserFn({
        data: {
          name,
          email,
          phone,
          password: form.password,
          role: form.role,
          vehicle: form.vehicle,
          licenseNo: form.licenseNo.trim() || 'LU-2-PA-1001',
          zone: form.zone,
          commissionRate: Number(form.commissionRate),
        },
      })

      toast.success(`${form.role.toUpperCase()} account created for ${name}!`)
      onOpenChange(false)
      setForm({
        ...initialFormState,
        role: defaultRole,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueries.staff().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: adminQueries.users().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: adminQueries.chrome().queryKey,
        }),
      ])
      onSuccess?.()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create staff account'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
            <DialogTitle className="text-sm font-semibold">
              Create staff account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create an administrator, manager, or delivery rider login account.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
            {/* Role Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Account role *</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleChange('manager')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    form.role === 'manager'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4 mb-1 text-primary" />
                  <div className="text-xs font-semibold">Manager</div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    Store ops
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('rider')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    form.role === 'rider'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <Bike className="h-4 w-4 mb-1 text-primary" />
                  <div className="text-xs font-semibold">Rider</div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    Courier app
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    form.role === 'admin'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <Shield className="h-4 w-4 mb-1 text-primary" />
                  <div className="text-xs font-semibold">Admin</div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    Full control
                  </div>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Full name *</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ramesh Shrestha"
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email address *</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="name@mezmani.com.np"
                    className="pl-8 h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Mobile number *</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+977 98..."
                    className="pl-8 h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs">Initial login password *</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Min. 8 characters"
                  className="pl-8 pr-8 h-8 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Rider Specific Fields */}
            {form.role === 'rider' && (
              <div className="pt-2 border-t border-border space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Courier fleet settings
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vehicle type</Label>
                    <NativeSelect
                      value={form.vehicle}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          vehicle: e.target.value as any,
                        })
                      }
                      size="sm"
                      className="w-full text-xs"
                    >
                      <NativeSelectOption value="bike">
                        Motorcycle
                      </NativeSelectOption>
                      <NativeSelectOption value="scooter">
                        Scooter
                      </NativeSelectOption>
                      <NativeSelectOption value="car">
                        Delivery van / car
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Plate number</Label>
                    <Input
                      value={form.licenseNo}
                      onChange={(e) =>
                        setForm({ ...form, licenseNo: e.target.value })
                      }
                      placeholder="LU-2-PA-8899"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Delivery zone</Label>
                    <NativeSelect
                      value={form.zone}
                      onChange={(e) =>
                        setForm({ ...form, zone: e.target.value })
                      }
                      size="sm"
                      className="w-full text-xs"
                    >
                      <NativeSelectOption value="Butwal Core">
                        Butwal Core
                      </NativeSelectOption>
                      <NativeSelectOption value="Tilottama / Manigram">
                        Tilottama / Manigram
                      </NativeSelectOption>
                      <NativeSelectOption value="Siddharthanagar / Bhairahawa">
                        Siddharthanagar / Bhairahawa
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Commission rate (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={form.commissionRate}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          commissionRate: Number(e.target.value),
                        })
                      }
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : `Create ${form.role}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
