import { useState, useMemo } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  upsertRiderFn,
  deleteRiderFn,
  updateRiderLiveFn,
  addLedgerFn,
} from '#/server/operations/operations.functions'
import type { Rider } from '#/server/operations/types'
import { formatNPR, fromPaisa } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { RiderDialog } from './rider-dialog'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
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
  Edit2,
  Trash2,
  MoreHorizontal,
  MessageCircle,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Card, CardTitle } from '#/components/ui/card'
import { EmptyState } from '#/components/shared/empty-state'

const routeApi = getRouteApi('/admin/riders')

export function RidersPanel() {
  const { ops } = routeApi.useLoaderData()
  const router = useRouter()

  const { data: access } = useQuery(adminQueries.access())
  const grants = access?.authenticated ? access.grants : null
  const canCreate = access ? can(grants, 'riders', 'create') : true
  const canEdit = access ? can(grants, 'riders', 'edit') : true
  const canDelete = access ? can(grants, 'riders', 'delete') : true

  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [statusTab, setStatusTab] = useState<'all' | 'available' | 'busy' | 'offline'>('all')

  // Rider Dialog state (for both Create & Edit)
  const [isRiderDialogOpen, setIsRiderDialogOpen] = useState(false)
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null)

  // Delete Confirm Dialog state
  const [deleteTarget, setDeleteTarget] = useState<Rider | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredRiders = useMemo(() => {
    return ops.riders.filter((r) => {
      // Status filter tab
      if (statusTab !== 'all') {
        if (statusTab === 'available' && r.status !== 'available') return false
        if (statusTab === 'busy' && r.status !== 'busy') return false
        if (statusTab === 'offline' && r.status !== 'offline') return false
      }

      // Zone filter
      if (zoneFilter !== 'all' && r.zone !== zoneFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.zone.toLowerCase().includes(q) ||
          (r.licenseNo && r.licenseNo.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [ops.riders, statusTab, zoneFilter, searchQuery])

  // KPIs
  const totalRidersCount = ops.riders.length
  const activeAvailableCount = ops.riders.filter(
    (r) => r.status === 'available' || r.available,
  ).length
  const busyCount = ops.riders.filter((r) => r.status === 'busy').length
  const offlineCount = ops.riders.filter(
    (r) => r.status === 'offline' && !r.available,
  ).length
  const totalCodFloat = ops.riders.reduce((sum, r) => sum + r.cashOnHand, 0)
  const totalCompletedDeliveries = ops.riders.reduce(
    (sum, r) => sum + r.deliveries,
    0,
  )

  const handleOpenCreate = () => {
    setSelectedRider(null)
    setIsRiderDialogOpen(true)
  }

  const handleOpenEdit = (rider: Rider) => {
    setSelectedRider(rider)
    setIsRiderDialogOpen(true)
  }

  const handleDeleteRider = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await deleteRiderFn({
        data: { id: deleteTarget.id },
      })
      toast.success(`Courier "${deleteTarget.name}" deleted from fleet`)
      await router.invalidate()
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete courier'
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

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
          licenseNo: rider.licenseNo || '',
          zone: rider.zone,
          commissionRate: rider.commissionRate,
          baseSalary: rider.baseSalary ? fromPaisa(rider.baseSalary) : 0,
          perDropRate: rider.perDropRate ? fromPaisa(rider.perDropRate) : 50,
          verified: !rider.verified,
          available: rider.available,
          status: rider.status,
        },
      })
      toast.success(
        `Courier ${rider.name} marked as ${!rider.verified ? 'KYC Verified' : 'Pending Verification'}`,
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

  const handleExportCSV = () => {
    const headers =
      'ID,Name,Phone,Email,Zone,Vehicle,Plate,Status,Verified,Available,Deliveries,Rating,CashOnHandNPR,BaseSalaryNPR,PerDropRateNPR,CommissionRatePct\n'
    const rows = filteredRiders
      .map(
        (r) =>
          `"${r.id}","${r.name}","${r.phone}","${r.email}","${r.zone}","${r.vehicle}","${r.licenseNo || ''}",${r.status},${r.verified},${r.available},${r.deliveries},${r.rating},${(r.cashOnHand / 100).toFixed(2)},${r.baseSalary ? (r.baseSalary / 100).toFixed(2) : '0'},${r.perDropRate ? (r.perDropRate / 100).toFixed(2) : '50'},${r.commissionRate}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `riders-fleet-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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
              <span>Export roster</span>
            </Button>
            {canCreate && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Onboard rider</span>
              </Button>
            )}
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
          <span className="text-xs text-muted-foreground font-mono">
            Tracking {ops.riders.length} beacon units
          </span>
        </div>

        {/* Radar Map Sandbox Canvas */}
        <div className="relative h-60 bg-muted/40 rounded-lg overflow-hidden border border-border p-4">
          <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

          {/* Sectors */}
          <div className="absolute top-3 left-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Sector A: Traffic Chowk / Golpark
          </div>
          <div className="absolute top-3 right-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Sector B: Kalikanagar / Devinagar
          </div>
          <div className="absolute bottom-3 left-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Sector C: Tilottama / Drivertole
          </div>
          <div className="absolute bottom-3 right-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">
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

                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border border-border text-xs font-mono px-1.5 py-0.5 rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {r.name} · {r.zone} · {r.status}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <Tabs
          value={statusTab}
          onValueChange={(val) => setStatusTab(val as typeof statusTab)}
          className="w-full"
        >
          <TabsList className="h-8 p-0.5 bg-muted/60">
            <TabsTrigger
              value="all"
              className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
            >
              <span>All Couriers</span>
              <span className="font-mono text-xs text-muted-foreground ml-1">
                ({totalRidersCount})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="available"
              className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
            >
              <span>Available</span>
              <span className="font-mono text-xs text-muted-foreground ml-1">
                ({activeAvailableCount})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="busy"
              className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
            >
              <span>On Delivery</span>
              <span className="font-mono text-xs text-muted-foreground ml-1">
                ({busyCount})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="offline"
              className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
            >
              <span>Offline</span>
              <span className="font-mono text-xs text-muted-foreground ml-1">
                ({offlineCount})
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search couriers by name, phone, plate, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-9 text-xs"
            />
          </div>

          <NativeSelect
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            size="sm"
            className="h-8 text-xs sm:w-56"
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
                    title="No couriers match your search"
                    description="Try adjusting your filter or search terms."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredRiders.map((rider) => (
                <TableRow key={rider.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => canEdit && handleOpenEdit(rider)}
                          className={`text-left font-medium text-xs text-foreground ${canEdit ? 'hover:underline cursor-pointer' : ''}`}
                        >
                          {rider.name}
                        </button>
                        <div className="text-xs text-muted-foreground font-mono">
                          {rider.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {rider.zone}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {rider.vehicle} · Plate: {rider.licenseNo || 'LU-2-PA'}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleKyc(rider)}
                      disabled={isSubmitting}
                      className="h-6 p-0 hover:bg-transparent"
                      title={rider.verified ? 'Revoke KYC Verification' : 'Approve KYC Verification'}
                    >
                      {rider.verified ? (
                        <Badge
                          variant="success"
                          className="gap-1 text-xs font-normal"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge
                          variant="warning"
                          className="text-xs font-normal"
                        >
                          Pending
                        </Badge>
                      )}
                    </Button>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        rider.status === 'available'
                          ? 'success'
                          : rider.status === 'busy'
                            ? 'warning'
                            : 'secondary'
                      }
                      className="text-xs font-normal capitalize"
                    >
                      {rider.status}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 font-mono text-xs text-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      <span>{rider.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
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
                      <span className="text-xs text-destructive font-medium block">
                        ⚠️ Limit exceeded (&gt;20k)
                      </span>
                    ) : rider.cashOnHand > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Pending handover
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {rider.cashOnHand > 0 && (
                        <Button
                          variant={rider.cashOnHand >= 2000000 ? 'destructive' : 'default'}
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => handleSettleRiderCash(rider)}
                          className="h-7 gap-1 px-2 text-xs"
                          title="Settle COD Cash Handover"
                        >
                          <Coins className="h-3 w-3" />
                          <span className="hidden sm:inline">Settle</span>
                        </Button>
                      )}

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(rider)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title={`Edit ${rider.name}`}
                          aria-label={`Edit ${rider.name}`}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            aria-label={`More actions for ${rider.name}`}
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {canEdit && (
                            <DropdownMenuItem
                              onSelect={() => handleOpenEdit(rider)}
                              className="text-xs gap-2 cursor-pointer"
                            >
                              <Edit2 className="size-3.5" />
                              <span>Edit courier</span>
                            </DropdownMenuItem>
                          )}

                          {rider.phone && (
                            <>
                              <DropdownMenuItem
                                onSelect={() =>
                                  window.open(
                                    `https://wa.me/977${rider.phone.replace(/\D/g, '').slice(-10)}`,
                                    '_blank',
                                  )
                                }
                                className="text-xs gap-2 cursor-pointer"
                              >
                                <MessageCircle className="size-3.5 text-emerald-600" />
                                <span>WhatsApp courier</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  window.open(`tel:${rider.phone}`, '_self')
                                }
                                className="text-xs gap-2 cursor-pointer"
                              >
                                <Phone className="size-3.5" />
                                <span>Call courier</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuItem
                            onSelect={() => handleToggleKyc(rider)}
                            className="text-xs gap-2 cursor-pointer"
                          >
                            <ShieldCheck className="size-3.5" />
                            <span>
                              {rider.verified ? 'Revoke KYC' : 'Verify KYC'}
                            </span>
                          </DropdownMenuItem>

                          {rider.cashOnHand > 0 && (
                            <DropdownMenuItem
                              onSelect={() => handleSettleRiderCash(rider)}
                              className="text-xs gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                            >
                              <Coins className="size-3.5" />
                              <span>Settle COD float</span>
                            </DropdownMenuItem>
                          )}

                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => setDeleteTarget(rider)}
                                className="text-xs gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete courier</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Shared Rider Modal Dialog (Create & Edit) */}
      <RiderDialog
        open={isRiderDialogOpen}
        onOpenChange={setIsRiderDialogOpen}
        rider={selectedRider}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete courier "${deleteTarget?.name}"?`}
        description={
          deleteTarget?.cashOnHand && deleteTarget.cashOnHand > 0
            ? `This courier currently has ${formatNPR(deleteTarget.cashOnHand)} in unremitted COD custody. Please settle cash float before removing from the fleet.`
            : 'Are you sure you want to remove this courier from the fleet roster? This will revoke their courier access and unassign future deliveries.'
        }
        confirmLabel="Delete Courier"
        cancelLabel="Keep Courier"
        danger
        isLoading={isDeleting}
        disabled={Boolean(deleteTarget?.cashOnHand && deleteTarget.cashOnHand > 0)}
        onConfirm={handleDeleteRider}
      />
    </div>
  )
}
