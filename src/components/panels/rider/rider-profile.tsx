import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toggleRiderAvailabilityFn } from '#/server/operations/operations.functions'
import type { Rider } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { ChangePasswordCard } from '#/components/auth/change-password-dialog'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import {
  Bike,
  ShieldCheck,
  Star,
  MapPin,
  Phone,
  Mail,
  Power,
  LogOut,
  Wallet,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'

interface RiderLedgerEntry {
  lineId: string
  voucherNo: string | null
  voucherType: string
  postingDate: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  narration: string | null
}

interface RiderProfileProps {
  rider: Rider
  ledger?: {
    balance: {
      commissionPayable: number
      undepositedCodCash: number
      outstandingAdvances: number
    }
    entries: RiderLedgerEntry[]
  }
}

export function RiderProfile({ rider, ledger }: RiderProfileProps) {
  const router = useRouter()
  const [isTogglingAvail, setIsTogglingAvail] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const handleToggleOnline = async () => {
    try {
      setIsTogglingAvail(true)
      const nextStatus = !rider.available
      await toggleRiderAvailabilityFn({ data: { available: nextStatus } })
      toast.success(
        nextStatus ? 'Status updated: ONLINE' : 'Status updated: OFFLINE',
      )
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status')
    } finally {
      setIsTogglingAvail(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true)
      await authClient.signOut()
      await clearAllLocalData()
      window.location.href = '/login'
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sign out')
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="space-y-4 pb-10 max-w-2xl mx-auto">
      <h2 className="text-base font-semibold text-foreground">Rider Profile</h2>

      {/* Main Profile Info Card */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold shrink-0">
              {rider.name.charAt(0)}
            </div>

            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  {rider.name}
                </h3>
                <Badge
                  variant={rider.available ? 'success' : 'secondary'}
                  className="text-[11px]"
                >
                  {rider.status.toUpperCase()}
                </Badge>
                {rider.verified && (
                  <Badge variant="success" className="text-[11px] gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {rider.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {rider.phone}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle & Fleet Info */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bike className="h-4 w-4 text-muted-foreground" />
            Fleet & Operating Info
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 divide-y divide-border text-xs">
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-muted-foreground">Vehicle Type</span>
            <span className="font-medium text-foreground capitalize">
              {rider.vehicle}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-muted-foreground">License Plate No.</span>
            <span className="font-mono font-medium text-foreground">
              {rider.licenseNo}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-muted-foreground">Assigned Zone</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {rider.zone}
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-muted-foreground">Customer Rating</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-warning fill-warning" />
              {rider.rating.toFixed(1)} / 5.0
            </span>
          </div>
          <div className="py-2.5 flex justify-between items-center">
            <span className="text-muted-foreground">Lifetime Deliveries</span>
            <span className="font-medium text-foreground">
              {rider.deliveries} trips completed
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Read-only ledger */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            My Ledger (read-only)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <span className="block text-muted-foreground">
                Commission payable
              </span>
              <span className="font-mono font-semibold text-success">
                {formatNPR(ledger?.balance.commissionPayable ?? 0)}
              </span>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <span className="block text-muted-foreground">COD cash held</span>
              <span className="font-mono font-semibold text-warning">
                {formatNPR(ledger?.balance.undepositedCodCash ?? 0)}
              </span>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <span className="block text-muted-foreground">Advances</span>
              <span className="font-mono font-semibold text-foreground">
                {formatNPR(ledger?.balance.outstandingAdvances ?? 0)}
              </span>
            </div>
          </div>

          {!ledger || ledger.entries.length === 0 ? (
            <p className="text-muted-foreground">
              No ledger entries yet. Entries appear after deliveries and
              settlements are posted.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {ledger.entries.slice(0, 8).map((entry) => (
                <div
                  key={entry.lineId}
                  className="flex items-start justify-between gap-2 p-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono font-semibold text-foreground">
                        {entry.voucherNo ?? entry.voucherType}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(entry.postingDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">
                      {entry.narration ||
                        `${entry.accountCode} · ${entry.accountName}`}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      entry.debit > 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {entry.debit > 0 ? '+' : '-'}
                    {formatNPR(entry.debit > 0 ? entry.debit : entry.credit)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-muted-foreground">
            Ledger entries are posted by accounts and cannot be edited here.
          </p>
        </CardContent>
      </Card>

      {/* Password & Security */}
      <ChangePasswordCard userName={rider.name} userEmail={rider.email} />

      {/* Shift & Actions */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">
          <Button
            variant={rider.available ? 'outline' : 'default'}
            onClick={handleToggleOnline}
            disabled={isTogglingAvail}
            className="w-full h-10 text-xs gap-2"
          >
            <Power className="h-4 w-4" />
            {rider.available
              ? 'Turn Offline (End Shift)'
              : 'Turn Online (Start Shift)'}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowSignOutConfirm(true)}
            disabled={isLoggingOut}
            className="w-full h-10 text-xs text-destructive hover:bg-destructive/10 gap-2 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign out of Rider Portal?"
        description="Are you sure you want to sign out? You will stop receiving delivery dispatch notifications on this device."
        confirmLabel="Sign out"
        tone="destructive"
        isLoading={isLoggingOut}
        icon={<LogOut className="h-5 w-5 text-destructive" />}
        onConfirm={handleSignOut}
      />
    </div>
  )
}
