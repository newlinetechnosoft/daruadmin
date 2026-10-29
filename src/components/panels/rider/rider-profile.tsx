import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toggleRiderAvailabilityFn } from '#/server/operations/operations.functions'
import type { Rider } from '#/server/operations/types'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
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
} from 'lucide-react'
import { toast } from 'sonner'

interface RiderProfileProps {
  rider: Rider
}

export function RiderProfile({ rider }: RiderProfileProps) {
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
    <div className="space-y-6 pb-12 max-w-2xl mx-auto">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Rider Profile
        </h2>
        <p className="text-xs text-muted-foreground">
          View your driver credentials, vehicle details, and active status
        </p>
      </div>

      {/* Main Profile Info Card */}
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
              {rider.name.charAt(0)}
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {rider.name}
                </h3>
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <Badge
                    variant={rider.available ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {rider.status.toUpperCase()}
                  </Badge>
                  {rider.verified && (
                    <Badge variant="success" className="text-xs gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                <Mail className="h-3.5 w-3.5" />
                {rider.email}
              </p>
              <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                <Phone className="h-3.5 w-3.5" />
                {rider.phone}
              </p>
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
