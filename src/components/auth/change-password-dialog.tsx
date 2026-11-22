import { useState } from 'react'
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
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '#/components/ui/card'
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { changeUserPasswordFn } from '#/server/auth/auth.functions'

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string | null
  userName?: string | null
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userEmail,
  userName,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleReset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
    setErrorMsg('')
  }

  const handleClose = () => {
    handleReset()
    onOpenChange(false)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMsg('')

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.')
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.')
      return
    }

    if (newPassword === currentPassword) {
      setErrorMsg('New password cannot be identical to your current password.')
      return
    }

    setIsLoading(true)
    try {
      const res = await changeUserPasswordFn({
        data: {
          currentPassword,
          newPassword,
          confirmPassword,
        },
      })

      toast.success(res.message || 'Password changed successfully!')
      handleClose()
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update password. Please check your current password.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClose()
        else onOpenChange(true)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
              <KeyRound className="h-4 w-4" />
            </div>
            <span>Change Passwoord</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update your account password.
            {userName || userEmail ? (
              <span className="block mt-0.5 text-foreground font-medium">
                Signed in as: {userName ? `${userName} (${userEmail})` : userEmail}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {errorMsg && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Current password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Enter your current password"
                className="text-xs h-9 pr-10 pl-8 font-mono"
                autoComplete="current-password"
                required
              />
              <Lock className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowCurrent((v) => !v)}
                className="h-7 w-7 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">New password</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Enter new password (min. 6 characters)"
                className="text-xs h-9 pr-10 pl-8 font-mono"
                autoComplete="new-password"
                required
              />
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowNew((v) => !v)}
                className="h-7 w-7 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Confirm password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Re-enter new password"
                className="text-xs h-9 pr-10 pl-8 font-mono"
                autoComplete="new-password"
                required
              />
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowConfirm((v) => !v)}
                className="h-7 w-7 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
            Password changes will update your credentials securely and terminate active sessions on other devices.
          </p>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>Change Password</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Inline Card for profile pages (e.g. Rider Profile, Settings)
 */
export function ChangePasswordCard({
  userName,
  userEmail,
}: {
  userName?: string | null
  userEmail?: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Password & Security
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Update your login credentials securely with current password verification.
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsOpen(true)}
              className="h-8 text-xs gap-1.5 border-border shrink-0"
            >
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              <span>Change Password</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          <p className="text-[11px] leading-relaxed">
            Click <strong>Change Password</strong> to verify your current password and assign a new secure credential. Available to all accounts across customer, rider, staff, and super admin roles.
          </p>
        </CardContent>
      </Card>

      <ChangePasswordDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        userName={userName}
        userEmail={userEmail}
      />
    </>
  )
}
