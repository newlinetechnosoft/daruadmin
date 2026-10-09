import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  upsertZoneFn,
} from '#/server/operations/operations.functions'
import type { Zone } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import {
  pageClass,
  tableWrap,
  thClass,
  tdClass,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
  labelClass,
} from '#/components/admin/styles'
import {
  Truck,
  Plus,
  Download,
  Calculator,
  Clock,
  X,
  Edit2,
  Navigation,
} from 'lucide-react'
import { toast } from 'sonner'

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
          ? 'Delivery zone updated successfully!'
          : 'Delivery zone created in Neon DB!'
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
    <div className={pageClass}>
      <PageHeader
        kicker="Operations"
        title="Delivery Zones & Shipping Rates"
        description="Configure Kathmandu Valley express dispatch corridors, courier SLA windows, and parcel rate calculations."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCSV} className={btnSecondary}>
              <Download className="h-4 w-4" />
              Export Zones
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingZone(null)
                setIsAddZoneOpen(true)
              }}
              className={btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Add Delivery Zone
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active Zones"
          value={ops.zones.filter((z) => z.active).length}
          note="Configured delivery sectors"
          icon={Truck}
        />
        <KpiCard
          label="Average City ETA"
          value={`${Math.round(ops.zones.reduce((s, z) => s + z.etaMinutes, 0) / (ops.zones.length || 1))} Mins`}
          note="Target SLA fulfillment"
          icon={Clock}
          tone="success"
        />
        <KpiCard
          label="Base Flat Charge"
          value={formatNPR(ops.zones[0]?.deliveryCharge || 120)}
          note="Standard Valley charge"
          icon={Navigation}
        />
      </div>

      {/* Shipping Sandbox Rate Calculator & Zone List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sandbox Calculator Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-5 w-5 text-blue-400" />
              <h3 className="text-base font-bold">Shipping Rate Sandbox</h3>
            </div>
            <p className="text-xs text-slate-300 mb-5">
              Simulate customer checkout shipping charges by weight and destination corridor.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Destination Zone</label>
                <select
                  value={calcZoneId}
                  onChange={(e) => setCalcZoneId(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                >
                  {ops.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} &bull; {z.courier}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-1">
                  <label>Parcel Weight (kg)</label>
                  <span className="text-blue-400 font-mono font-bold">{calcWeight} kg</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="15"
                  step="0.5"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Base Delivery (1st kg):</span>
              <span className="font-mono">{formatNPR(baseShippingFee)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Weight Surcharge ({extraWeight.toFixed(1)} kg):</span>
              <span className="font-mono">+{formatNPR(calculatedWeightFee)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Estimated Delivery Window:</span>
              <span className="text-emerald-400 font-semibold">
                ~{selectedCalcZone?.etaMinutes} Minutes
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-700 font-bold">
              <span className="text-xs uppercase text-slate-200">Total Delivery Fee:</span>
              <span className="text-lg text-blue-400 font-mono font-extrabold">
                {formatNPR(totalCalculatedDelivery)}
              </span>
            </div>
          </div>
        </div>

        {/* Zones Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className={tableWrap}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Zone & Areas</th>
                    <th className={thClass}>Base Charge</th>
                    <th className={thClass}>ETA Window</th>
                    <th className={thClass}>Courier Partner</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ops.zones.map((zone) => (
                    <tr key={zone.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <div className="font-semibold text-slate-900">{zone.name}</div>
                        <div className="text-xs text-slate-400 max-w-xs truncate">{zone.areas}</div>
                      </td>

                      <td className={tdClass}>
                        <span className="font-mono font-bold text-slate-900">
                          {formatNPR(zone.deliveryCharge)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="text-slate-700 text-xs flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {zone.etaMinutes} mins
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700">
                          {zone.courier}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            zone.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {zone.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(zone)}
                          className={btnSecondary}
                          style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Zone Modal */}
      {isAddZoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingZone ? 'Edit Delivery Zone' : 'Add Regional Delivery Zone'}
                </h3>
                <p className="text-xs text-slate-500">Persists rate configuration to Neon DB</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddZoneOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-3.5 text-xs">
              <div>
                <label className={labelClass}>Zone Name *</label>
                <input
                  type="text"
                  required
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  placeholder="e.g. Lalitpur Inner Ring"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Covered Localities / Areas *</label>
                <input
                  type="text"
                  required
                  value={zoneForm.areas}
                  onChange={(e) => setZoneForm({ ...zoneForm, areas: e.target.value })}
                  placeholder="e.g. Jhamsikhel, Kupondole, Pulchowk, Jawalakhel"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Base Delivery Fee (NPR) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={zoneForm.deliveryCharge}
                    onChange={(e) => setZoneForm({ ...zoneForm, deliveryCharge: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>SLA Window (Minutes) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={zoneForm.etaMinutes}
                    onChange={(e) => setZoneForm({ ...zoneForm, etaMinutes: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Designated Courier Mode</label>
                <select
                  value={zoneForm.courier}
                  onChange={(e) => setZoneForm({ ...zoneForm, courier: e.target.value as any })}
                  className={selectClass}
                >
                  <option value="in-house">In-House Rider Fleet</option>
                  <option value="pathao">Pathao Express Delivery</option>
                  <option value="ncm">Nepal Can Move (NCM)</option>
                  <option value="none">Self Pickup Only</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddZoneOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? 'Saving...' : 'Save Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
