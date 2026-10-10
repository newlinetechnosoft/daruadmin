import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  upsertZoneFn,
} from '#/server/operations/operations.functions'
import type { Zone } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  Truck,
  Plus,
  Download,
  Calculator,
  Clock,
  Edit2,
  Navigation,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { Slider } from '#/components/ui/slider'
import {
  NativeSelect,
  NativeSelectOption,
} from '#/components/ui/native-select'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card'

export const Route = createFileRoute('/admin/shipping')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminShippingPage,
})

function AdminShippingPage() {
  const { ops } = Route.useLoaderData()
  const router = useRouter()

  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Interactive Sandbox Calculator
  const [calcWeight, setCalcWeight] = useState<number>(2.0)
  const [calcZoneId, setCalcZoneId] = useState<string>(ops.zones[0]?.id || '')

  // Zone form state
  const [zoneForm, setZoneForm] = useState({
    name: '',
    areas: '',
    deliveryCharge: 120,
    etaMinutes: 45,
    active: true,
    courier: 'in-house' as 'in-house' | 'ncm' | 'pathao' | 'none',
  })

  const selectedCalcZone = ops.zones.find((z) => z.id === calcZoneId) || ops.zones[0]
  const baseShippingFee = selectedCalcZone ? selectedCalcZone.deliveryCharge : 100
  const extraWeight = Math.max(0, calcWeight - 1)
  const calculatedWeightFee = Math.round(extraWeight * 40)
  const totalCalculatedDelivery = baseShippingFee + calculatedWeightFee

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zoneForm.name || !zoneForm.areas) {
      toast.error('Zone name and covered areas are required')
      return
    }

    try {
      setIsSubmitting(true)
      await upsertZoneFn({
        data: {
          id: editingZone ? editingZone.id : undefined,
          name: zoneForm.name,
          areas: zoneForm.areas,
          deliveryCharge: Number(zoneForm.deliveryCharge),
          etaMinutes: Number(zoneForm.etaMinutes),
          active: zoneForm.active,
          courier: zoneForm.courier,
        },
      })
      toast.success(
        editingZone
          ? 'Delivery zone updated successfully'
          : 'Delivery zone created'
      )
      setIsAddZoneOpen(false)
      setEditingZone(null)
      setZoneForm({
        name: '',
        areas: '',
        deliveryCharge: 120,
        etaMinutes: 45,
        active: true,
        courier: 'in-house',
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to save delivery zone')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (zone: Zone) => {
    setEditingZone(zone)
    setZoneForm({
      name: zone.name,
      areas: zone.areas,
      deliveryCharge: zone.deliveryCharge,
      etaMinutes: zone.etaMinutes,
      active: zone.active,
      courier: zone.courier,
    })
    setIsAddZoneOpen(true)
  }

  const handleExportCSV = () => {
    const headers = 'ID,ZoneName,AreasCovered,BaseFeeNPR,ETAMinutes,CourierPartner,Active\n'
    const rows = ops.zones
      .map(
        (z) =>
          `"${z.id}","${z.name}","${z.areas.replace(/"/g, '""')}",${z.deliveryCharge},${z.etaMinutes},"${z.courier}",${z.active}`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `delivery-zones-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Delivery zones exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Delivery zones and shipping rates"
        description="Configure Kathmandu Valley express dispatch corridors, courier SLA windows, and parcel rate calculations."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export zones
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingZone(null)
                setIsAddZoneOpen(true)
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add delivery zone
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active zones"
          value={ops.zones.filter((z) => z.active).length}
          note="Configured delivery sectors"
          icon={Truck}
        />
        <KpiCard
          label="Average city ETA"
          value={`${Math.round(ops.zones.reduce((s, z) => s + z.etaMinutes, 0) / (ops.zones.length || 1))} mins`}
          note="Target SLA fulfillment"
          icon={Clock}
          tone="success"
        />
        <KpiCard
          label="Base flat charge"
          value={formatNPR(ops.zones[0]?.deliveryCharge || 120)}
          note="Standard valley charge"
          icon={Navigation}
        />
      </div>

      {/* Rate Calculator & Zones List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sandbox Calculator Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Shipping rate sandbox</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Simulate customer checkout shipping charges by weight and destination corridor.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Destination zone</Label>
              <NativeSelect
                value={calcZoneId}
                onChange={(e) => setCalcZoneId(e.target.value)}
                size="sm"
                className="w-full text-xs"
              >
                {ops.zones.map((z) => (
                  <NativeSelectOption key={z.id} value={z.id}>
                    {z.name} · {z.courier}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label className="text-xs">Parcel weight (kg)</Label>
                <span className="font-mono font-medium text-foreground">{calcWeight} kg</span>
              </div>
              <Slider
                min={0.5}
                max={15}
                step={0.5}
                value={[calcWeight]}
                onValueChange={(vals) => vals[0] !== undefined && setCalcWeight(vals[0])}
                className="w-full"
              />
            </div>

            <div className="space-y-2 border-t border-border/50 pt-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Base delivery (1st kg):</span>
                <span className="font-mono text-foreground">{formatNPR(baseShippingFee)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Weight surcharge ({extraWeight.toFixed(1)} kg):</span>
                <span className="font-mono text-foreground">+{formatNPR(calculatedWeightFee)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated window:</span>
                <span className="font-medium text-foreground">
                  ~{selectedCalcZone?.etaMinutes} mins
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border/50 pt-2 font-medium">
                <span className="text-xs text-foreground">Total delivery fee:</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {formatNPR(totalCalculatedDelivery)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zones Table */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Zone and areas</TableHead>
                  <TableHead className="text-xs">Base charge</TableHead>
                  <TableHead className="text-xs">ETA window</TableHead>
                  <TableHead className="text-xs">Courier</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{zone.name}</div>
                      <div className="text-[11px] text-muted-foreground max-w-xs truncate">{zone.areas}</div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs tabular-nums text-foreground">
                        {formatNPR(zone.deliveryCharge)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {zone.etaMinutes} mins
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                        {zone.courier}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={zone.active ? 'default' : 'outline'}
                        className="text-[10px] font-normal"
                      >
                        {zone.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(zone)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add / Edit Zone Dialog */}
      <Dialog open={isAddZoneOpen} onOpenChange={setIsAddZoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingZone ? 'Edit delivery zone' : 'Add delivery zone'}
            </DialogTitle>
            <DialogDescription className="text-xs">Persists rate configuration to database</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveZone} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Zone name *</Label>
              <Input
                required
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                placeholder="e.g. Lalitpur Inner Ring"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Covered localities / areas *</Label>
              <Input
                required
                value={zoneForm.areas}
                onChange={(e) => setZoneForm({ ...zoneForm, areas: e.target.value })}
                placeholder="e.g. Jhamsikhel, Kupondole, Pulchowk"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Base fee (NPR) *</Label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={zoneForm.deliveryCharge}
                  onChange={(e) => setZoneForm({ ...zoneForm, deliveryCharge: Number(e.target.value) })}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SLA window (minutes) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={zoneForm.etaMinutes}
                  onChange={(e) => setZoneForm({ ...zoneForm, etaMinutes: Number(e.target.value) })}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Designated courier mode</Label>
              <NativeSelect
                value={zoneForm.courier}
                onChange={(e) => setZoneForm({ ...zoneForm, courier: e.target.value as any })}
                size="sm"
                className="w-full text-xs"
              >
                <NativeSelectOption value="in-house">In-house rider fleet</NativeSelectOption>
                <NativeSelectOption value="pathao">Pathao express delivery</NativeSelectOption>
                <NativeSelectOption value="ncm">Nepal Can Move (NCM)</NativeSelectOption>
                <NativeSelectOption value="none">Self pickup only</NativeSelectOption>
              </NativeSelect>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddZoneOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
                {isSubmitting ? 'Saving...' : 'Save zone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
