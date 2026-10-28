import { useState, useMemo } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import {
  upsertRiderFn,
  updateRiderLiveFn,
  addLedgerFn,
} from '#/server/operations/operations.functions'
import type { Rider } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  Bike,
  Search,
  Plus,
  Download,
  CheckCircle,
  Coins,
  ShieldCheck,
  Star,
  Radio,
  Navigation,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Card, CardTitle } from '#/components/ui/card'
import { EmptyState } from '#/components/shared/empty-state'

const routeApi = getRouteApi('/admin/riders')

export function RidersPanel() {
  const { ops } = routeApi.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showRiderPassword, setShowRiderPassword] = useState(false)

  // Add rider form state
  const [riderForm, setRiderForm] = useState({
    name: '',
    email: '',
    phone: '+977 ',
    password: '',
    vehicle: 'bike' as 'bike' | 'scooter' | 'car',
    licenseNo: '',
    zone: 'Butwal Core',
    commissionRate: 150,
  })

  const filteredRiders = useMemo(() => {
    return ops.riders.filter((r) => {
      if (zoneFilter !== 'all' && r.zone !== zoneFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.zone.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [ops.riders, zoneFilter, searchQuery])

  // KPIs
  const totalRidersCount = ops.riders.length
  const activeAvailableCount = ops.riders.filter(
    (r) => r.available || r.status === 'available',
  ).length
  const totalCodFloat = ops.riders.reduce((sum, r) => sum + r.cashOnHand, 0)
  const totalCompletedDeliveries = ops.riders.reduce(
    (sum, r) => sum + r.deliveries,
    0,
  )

  const handleToggleKyc = async (rider: Rider) => {
    try {
      setIsSubmitting(true)
      await upsertRiderFn({
        data: {
          id: rider.id,
          name: rider.name,
          email: rider.email,
          phone: rider.phone,
          vehicle: rider.vehicle,
          licenseNo: rider.licenseNo,
          zone: rider.zone,
          commissionRate: rider.commissionRate,
          verified: !rider.verified,
          available: rider.available,
        },
      })
      toast.success(
        `Rider ${rider.name} marked as ${!rider.verified ? 'KYC Verified' : 'Pending Verification'}`,
      )
      await router.invalidate()
    } catch {
      toast.error('Failed to update KYC status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSettleRiderCash = async (rider: Rider) => {
    if (rider.cashOnHand <= 0) return

    try {
      setIsSubmitting(true)
      const amount = rider.cashOnHand

      await updateRiderLiveFn({
        data: {
          id: rider.id,
          cashOnHand: 0,
        },
      })

      await addLedgerFn({
        data: {
          type: 'credit',
          category: 'cod',
          account: 'bank',
          memo: `Rider COD Remittance Reconciled: ${rider.name} (${rider.phone})`,
          amount: amount,
        },
      })

      toast.success(
        `Settled ${formatNPR(amount)} from ${rider.name}! Credited to bank in ledger.`,
      )
      await router.invalidate()
    } catch {
      toast.error('Failed to settle courier cash')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!riderForm.name.trim() || !riderForm.phone.trim()) {
      toast.error('Please enter rider name and phone')
      return
    }
    if (!riderForm.email.trim()) {
      toast.error('Please enter an email address for courier login')
      return
    }
    if (riderForm.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    try {
      setIsSubmitting(true)
      await upsertRiderFn({
        data: {
          name: riderForm.name.trim(),
          email: riderForm.email.trim(),
          phone: riderForm.phone.trim(),
          password: riderForm.password,
          vehicle: riderForm.vehicle,
          licenseNo: riderForm.licenseNo || 'BA-2-PA-1234',
          zone: riderForm.zone,
          commissionRate: Number(riderForm.commissionRate),
          verified: true,
          available: true,
        },
      })
      toast.success('Rider onboarded with login account successfully')
      setIsAddRiderOpen(false)
      setRiderForm({
        name: '',
        email: '',
        phone: '+977 ',
        password: '',
        vehicle: 'bike',
        licenseNo: '',
        zone: 'Butwal Core',
        commissionRate: 150,
      })
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to onboard rider')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    const headers =
      'ID,Name,Phone,Zone,Vehicle,Verified,Available,Deliveries,Rating,CashOnHandNPR,EarningsNPR\n'
    const rows = filteredRiders
      .map(
        (r) =>
          `"${r.id}","${r.name}","${r.phone}","${r.zone}","${r.vehicle}",${r.verified},${r.available},${r.deliveries},${r.rating},${r.cashOnHand},${r.earnings}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `riders-fleet-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Rider fleet exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Rider and fleet logistics"
        description="Live Butwal & Tilottama delivery radar, courier telemetry, and COD cash remittance settlement."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export roster
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddRiderOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Onboard rider
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total fleet couriers"
          value={totalRidersCount}
          note="Registered delivery personnel"
          icon={Bike}
        />
        <KpiCard
          label="Available on duty"
          value={activeAvailableCount}
          note="Ready for dispatch"
          icon={Radio}
          tone="success"
        />
        <KpiCard
          label="COD in courier custody"
          value={formatNPR(totalCodFloat)}
          note="Unremitted cash float"
          icon={Coins}
          tone={totalCodFloat > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Lifetime deliveries"
          value={totalCompletedDeliveries}
          note="Parcels completed to date"
          icon={CheckCircle}
        />
      </div>

      {/* Live Fleet Radar Map Visualization */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-foreground animate-pulse" />
            <CardTitle className="text-xs font-semibold">
              Live fleet telemetry radar (Butwal & Tilottama Hub)
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Tracking {ops.riders.length} beacon units
          </span>
        </div>

        {/* Radar Map Sandbox Canvas */}
        <div className="relative h-60 bg-muted/40 rounded-lg overflow-hidden border border-border p-4">
          <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

          {/* Sectors */}
          <div className="absolute top-3 left-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Sector A: Traffic Chowk / Golpark
          </div>
          <div className="absolute top-3 right-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Sector B: Kalikanagar / Devinagar
          </div>
          <div className="absolute bottom-3 left-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Sector C: Tilottama / Drivertole
          </div>
          <div className="absolute bottom-3 right-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Sector D: Manigram / Mangalapur
          </div>

          {/* Concentric Radar Circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full border border-foreground/10 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-foreground/5 pointer-events-none"></div>

          {/* Couriers on Map */}
          {ops.riders.map((r, idx) => {
            const topPos = 20 + ((idx * 27) % 60)
            const leftPos = 15 + ((idx * 33) % 70)

            return (
              <div
                key={r.id}
                style={{ top: `${topPos}%`, left: `${leftPos}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                onClick={() =>
                  toast.info(
                    `Courier: ${r.name} (${r.zone}) · Status: ${r.status}`,
                  )
                }
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-5 h-5 rounded-full bg-primary/20 animate-ping"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow-md flex items-center justify-center text-primary-foreground">
                    <Bike className="w-2 h-2" />
                  </div>
                </div>

                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border border-border text-[10px] font-mono px-1.5 py-0.5 rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {r.name} · {r.zone} · {r.status}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search riders by name, phone, zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-xs"
          />
        </div>

        <NativeSelect
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          size="sm"
          className="h-8 text-xs"
        >
          <NativeSelectOption value="all">
            All delivery zones
          </NativeSelectOption>
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

      {/* Riders Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Rider name</TableHead>
              <TableHead className="text-xs">Zone and vehicle</TableHead>
              <TableHead className="text-xs">KYC status</TableHead>
              <TableHead className="text-xs">Duty status</TableHead>
              <TableHead className="text-xs">Rating and deliveries</TableHead>
              <TableHead className="text-xs">Cash in hand (COD)</TableHead>
              <TableHead className="text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRiders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="No riders match your search"
                    description="Try adjusting your filter or search terms."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredRiders.map((rider) => (
                <TableRow key={rider.id}>
                  <TableCell>
                    <div className="font-medium text-xs text-foreground">
                      {rider.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {rider.phone}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {rider.zone}
                    </div>
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {rider.vehicle} · Plate: {rider.licenseNo || 'BA-2-PA'}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleKyc(rider)}
                      disabled={isSubmitting}
                      className="h-6 p-0 hover:bg-transparent"
                    >
                      {rider.verified ? (
                        <Badge
                          variant="success"
                          className="gap-1 text-[10px] font-normal"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge
                          variant="warning"
                          className="text-[10px] font-normal"
                        >
                          Pending
                        </Badge>
                      )}
                    </Button>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        rider.status === 'available' ? 'success' : 'secondary'
                      }
                      className="text-[10px] font-normal capitalize"
                    >
                      {rider.status}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 font-mono text-xs text-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      <span>{rider.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {rider.deliveries} deliveries
                    </span>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`font-mono text-xs font-semibold block tabular-nums ${
                        rider.cashOnHand >= 2000000
                          ? 'text-destructive font-bold'
                          : rider.cashOnHand > 0
                            ? 'text-warning'
                            : 'text-foreground'
                      }`}
                    >
                      {formatNPR(rider.cashOnHand)}
                    </span>
                    {rider.cashOnHand >= 2000000 ? (
                      <span className="text-[10px] text-destructive font-medium block">
                        ⚠️ Limit exceeded (&gt;20k)
                      </span>
                    ) : rider.cashOnHand > 0 ? (
                      <span className="text-[10px] text-muted-foreground">
                        Pending handover
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant={
                        rider.cashOnHand >= 2000000
                          ? 'destructive'
                          : rider.cashOnHand > 0
                            ? 'default'
                            : 'outline'
                      }
                      size="sm"
                      disabled={rider.cashOnHand === 0 || isSubmitting}
                      onClick={() => handleSettleRiderCash(rider)}
                      className="h-7 gap-1 px-2 text-xs"
                      title={
                        rider.cashOnHand >= 2000000
                          ? 'Settle COD Cash Handover (Over Limit)'
                          : 'Settle COD Cash'
                      }
                    >
                      <Coins className="h-3 w-3" />
                      {rider.cashOnHand > 0 ? 'Settle COD' : 'Settled'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Onboard Rider Dialog */}
      <Dialog open={isAddRiderOpen} onOpenChange={setIsAddRiderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Onboard fleet courier
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register new delivery personnel
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRider} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full name *</Label>
              <Input
                required
                value={riderForm.name}
                onChange={(e) =>
                  setRiderForm({ ...riderForm, name: e.target.value })
                }
                placeholder="e.g. Ramesh Shrestha"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact phone *</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    required
                    value={riderForm.phone}
                    onChange={(e) =>
                      setRiderForm({ ...riderForm, phone: e.target.value })
                    }
                    placeholder="+977 98..."
                    className="pl-8 h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Email address *</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    value={riderForm.email}
                    onChange={(e) =>
                      setRiderForm({ ...riderForm, email: e.target.value })
                    }
                    placeholder="rider@mezmani.com.np"
                    className="pl-8 h-8 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Login password *</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type={showRiderPassword ? 'text' : 'password'}
                  required
                  value={riderForm.password}
                  onChange={(e) =>
                    setRiderForm({ ...riderForm, password: e.target.value })
                  }
                  placeholder="Min. 8 characters"
                  className="pl-8 pr-8 h-8 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowRiderPassword(!showRiderPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showRiderPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle type</Label>
                <NativeSelect
                  value={riderForm.vehicle}
                  onChange={(e) =>
                    setRiderForm({
                      ...riderForm,
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
                <Label className="text-xs">Vehicle plate no.</Label>
                <Input
                  value={riderForm.licenseNo}
                  onChange={(e) =>
                    setRiderForm({ ...riderForm, licenseNo: e.target.value })
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
                  value={riderForm.zone}
                  onChange={(e) =>
                    setRiderForm({ ...riderForm, zone: e.target.value })
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
                <Label className="text-xs">Per-delivery commission (NPR)</Label>
                <Input
                  type="number"
                  min="0"
                  value={riderForm.commissionRate}
                  onChange={(e) =>
                    setRiderForm({
                      ...riderForm,
                      commissionRate: Number(e.target.value),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddRiderOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                {isSubmitting ? 'Onboarding...' : 'Register courier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
