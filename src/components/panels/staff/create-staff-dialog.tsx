import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
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
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '+977 ',
    password: '',
    role: defaultRole,
    // Rider specific
    vehicle: 'bike' as 'bike' | 'scooter' | 'car',
    licenseNo: '',
    zone: 'Kathmandu Central',
    commissionRate: 150,
  })

  const handleRoleChange = (role: 'admin' | 'manager' | 'rider') => {
    setForm((prev) => ({ ...prev, role }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Please enter the full name')
      return
    }
    if (!form.email.trim()) {
      toast.error('Please enter a valid email address')
      return
    }
    if (!form.phone.trim() || form.phone.trim() === '+977') {
      toast.error('Please enter a contact phone number')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    try {
      setIsSubmitting(true)
      await createStaffUserFn({
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role: form.role,
          vehicle: form.vehicle,
          licenseNo: form.licenseNo.trim() || 'BA-2-PA-1001',
          zone: form.zone,
          commissionRate: Number(form.commissionRate),
        },
      })

      toast.success(
        `${form.role.toUpperCase()} account created for ${form.name}!`,
      )
      onOpenChange(false)
      setForm({
        name: '',
        email: '',
        phone: '+977 ',
        password: '',
        role: defaultRole,
        vehicle: 'bike',
        licenseNo: '',
        zone: 'Kathmandu Central',
        commissionRate: 150,
      })
      await router.invalidate()
      onSuccess?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create staff account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Create staff account
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create an administrator, manager, or delivery rider login account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
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
                <div className="text-[10px] text-muted-foreground leading-tight">
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
                <div className="text-[10px] text-muted-foreground leading-tight">
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
                <div className="text-[10px] text-muted-foreground leading-tight">
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
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
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
                    placeholder="BA-2-PA-8899"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery zone</Label>
                  <NativeSelect
                    value={form.zone}
                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                    size="sm"
                    className="w-full text-xs"
                  >
                    <NativeSelectOption value="Kathmandu Central">
                      Kathmandu Central
                    </NativeSelectOption>
                    <NativeSelectOption value="Patan / Lalitpur">
                      Patan / Lalitpur
                    </NativeSelectOption>
                    <NativeSelectOption value="Bhaktapur Core">
                      Bhaktapur Core
                    </NativeSelectOption>
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Commission (NPR)</Label>
                  <Input
                    type="number"
                    min="0"
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

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? 'Creating account...' : `Create ${form.role}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
