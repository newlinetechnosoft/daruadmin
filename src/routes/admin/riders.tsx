import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  upsertRiderFn,
  updateRiderLiveFn,
  addLedgerFn,
} from '#/server/operations/operations.functions'
import type { Rider } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import {
  pageClass,
  cardClass,
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
  Bike,
  Search,
  Filter,
  Plus,
  Download,
  CheckCircle,
  Coins,
  ShieldCheck,
  Star,
  X,
  Radio,
  Navigation,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/riders')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminRidersPage,
})

function AdminRidersPage() {
  const { ops } = Route.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add rider form state
  const [riderForm, setRiderForm] = useState({
    name: '',
    email: '',
    phone: '+977 ',
    vehicle: 'bike' as 'bike' | 'scooter' | 'car',
    licenseNo: '',
    zone: 'Kathmandu Central',
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
  const activeAvailableCount = ops.riders.filter((r) => r.available || r.status === 'available').length
  const totalCodFloat = ops.riders.reduce((sum, r) => sum + r.cashOnHand, 0)
  const totalCompletedDeliveries = ops.riders.reduce((sum, r) => sum + r.deliveries, 0)

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
        `Rider ${rider.name} marked as ${!rider.verified ? 'KYC Verified' : 'Pending Verification'}`
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

      // 1. Clear cash on hand
      await updateRiderLiveFn({
        data: {
          id: rider.id,
          cashOnHand: 0,
        },
      })

      // 2. Post remittance to General Ledger in Neon DB
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
        `Settled ${formatNPR(amount)} from ${rider.name}! Credited to Bank Account in General Ledger.`
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

    try {
      setIsSubmitting(true)
      await upsertRiderFn({
        data: {
          name: riderForm.name,
          email: riderForm.email || `${riderForm.name.toLowerCase().replace(/\s+/g, '')}@courier.np`,
          phone: riderForm.phone,
          vehicle: riderForm.vehicle,
          licenseNo: riderForm.licenseNo || 'BA-2-PA-1234',
          zone: riderForm.zone,
          commissionRate: Number(riderForm.commissionRate),
          verified: true,
          available: true,
        },
      })
      toast.success('Rider onboarded successfully to Neon DB!')
      setIsAddRiderOpen(false)
      setRiderForm({
        name: '',
        email: '',
        phone: '+977 ',
        vehicle: 'bike',
        licenseNo: '',
        zone: 'Kathmandu Central',
        commissionRate: 150,
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to onboard rider')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = 'ID,Name,Phone,Zone,Vehicle,Verified,Available,Deliveries,Rating,CashOnHandNPR,EarningsNPR\n'
    const rows = filteredRiders
      .map(
        (r) =>
          `"${r.id}","${r.name}","${r.phone}","${r.zone}","${r.vehicle}",${r.verified},${r.available},${r.deliveries},${r.rating},${r.cashOnHand},${r.earnings}`
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
    <div className={pageClass}>
      <PageHeader
        kicker="Operations"
        title="Rider & Fleet Logistics"
        description="Live Kathmandu Valley delivery radar, courier telemetry, and COD cash remittance settlement."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCSV} className={btnSecondary}>
              <Download className="h-4 w-4" />
              Export Roster
            </button>
            <button type="button" onClick={() => setIsAddRiderOpen(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Onboard Rider
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total Fleet Couriers"
          value={totalRidersCount}
          note="Registered delivery personnel"
          icon={Bike}
        />
        <KpiCard
          label="Available On Duty"
          value={activeAvailableCount}
          note="Ready for dispatch"
          icon={Radio}
          tone="success"
        />
        <KpiCard
          label="COD In Courier Custody"
          value={formatNPR(totalCodFloat)}
          note="Unremitted cash float"
          icon={Coins}
          tone={totalCodFloat > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Lifetime Deliveries"
          value={totalCompletedDeliveries}
          note="Parcels completed to date"
          icon={CheckCircle}
        />
      </div>

      {/* Live Fleet Radar Map Visualization */}
      <div className={`${cardClass} p-5 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-600 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900">
              Live Fleet Telemetry Radar (Kathmandu Valley Hub)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Tracking {ops.riders.length} GPS Beacon Units
          </span>
        </div>

        {/* Radar Map Sandbox Canvas */}
        <div className="relative h-64 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 p-4">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

          {/* Zones */}
          <div className="absolute top-4 left-6 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Sector A: Thamel / Balaju
          </div>
          <div className="absolute top-4 right-8 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Sector B: New Road / Durbar Marg
          </div>
          <div className="absolute bottom-4 left-6 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Sector C: Jhamsikhel / Patan
          </div>
          <div className="absolute bottom-4 right-8 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Sector D: Baneshwor / Koteshwor
          </div>

          {/* Concentric Radar Circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-500/20 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-blue-500/10 pointer-events-none"></div>

          {/* Couriers on Map */}
          {ops.riders.map((r, idx) => {
            // Position couriers pseudo-randomly based on index
            const topPos = 20 + ((idx * 27) % 60)
            const leftPos = 15 + ((idx * 33) % 70)

            return (
              <div
                key={r.id}
                style={{ top: `${topPos}%`, left: `${leftPos}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                onClick={() => toast.info(`Courier: ${r.name} (${r.zone}) • Status: ${r.status}`)}
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-6 h-6 rounded-full bg-blue-500/30 animate-ping"></div>
                  <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white">
                    <Bike className="w-2.5 h-2.5" />
                  </div>
                </div>

                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {r.name} &bull; {r.zone} &bull; {r.status}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`${cardClass} p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3`}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search riders by name, phone, zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All Delivery Zones</option>
            <option value="Kathmandu Central">Kathmandu Central</option>
            <option value="Patan / Lalitpur">Patan / Lalitpur</option>
            <option value="Bhaktapur Core">Bhaktapur Core</option>
          </select>
        </div>
      </div>

      {/* Riders Table */}
      <div className={tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className={thClass}>Rider Name</th>
                <th className={thClass}>Zone & Vehicle</th>
                <th className={thClass}>KYC Status</th>
                <th className={thClass}>Duty Status</th>
                <th className={thClass}>Rating & Deliveries</th>
                <th className={thClass}>Cash in Hand (COD)</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No riders match the current search.
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider) => (
                  <tr key={rider.id} className="hover:bg-slate-50/70 transition">
                    <td className={tdClass}>
                      <div className="font-semibold text-slate-900">{rider.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{rider.phone}</div>
                    </td>

                    <td className={tdClass}>
                      <div className="text-slate-800 font-medium">{rider.zone}</div>
                      <span className="text-xs text-slate-400 capitalize">
                        {rider.vehicle} &bull; Plate: {rider.licenseNo || 'BA-2-PA'}
                      </span>
                    </td>

                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => handleToggleKyc(rider)}
                        disabled={isSubmitting}
                        className="cursor-pointer"
                        title="Click to toggle KYC verification"
                      >
                        {rider.verified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Pending
                          </span>
                        )}
                      </button>
                    </td>

                    <td className={tdClass}>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                          rider.status === 'available'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rider.status === 'busy'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rider.status}
                      </span>
                    </td>

                    <td className={tdClass}>
                      <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span>{rider.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {rider.deliveries} deliveries
                      </span>
                    </td>

                    <td className={tdClass}>
                      <span
                        className={`font-mono font-bold block ${
                          rider.cashOnHand > 0 ? 'text-amber-700' : 'text-slate-800'
                        }`}
                      >
                        {formatNPR(rider.cashOnHand)}
                      </span>
                      {rider.cashOnHand > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold">
                          Pending Handover
                        </span>
                      )}
                    </td>

                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={rider.cashOnHand === 0 || isSubmitting}
                          onClick={() => handleSettleRiderCash(rider)}
                          className={rider.cashOnHand > 0 ? btnPrimary : btnSecondary}
                          style={{ height: '32px', padding: '0 10px', fontSize: '11px' }}
                        >
                          <Coins className="h-3 w-3" />
                          {rider.cashOnHand > 0 ? 'Settle COD' : 'Settled'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Rider Modal */}
      {isAddRiderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Onboard Fleet Courier</h3>
                <p className="text-xs text-slate-500">Register new delivery personnel to Neon DB</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRiderOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRider} className="space-y-3.5 text-xs">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={riderForm.name}
                  onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Shrestha"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={riderForm.phone}
                    onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                    placeholder="+977 98..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Vehicle Type</label>
                  <select
                    value={riderForm.vehicle}
                    onChange={(e) =>
                      setRiderForm({ ...riderForm, vehicle: e.target.value as any })
                    }
                    className={selectClass}
                  >
                    <option value="bike">Motorcycle</option>
                    <option value="scooter">Scooter</option>
                    <option value="car">Delivery Van / Car</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Vehicle Plate No.</label>
                  <input
                    type="text"
                    value={riderForm.licenseNo}
                    onChange={(e) => setRiderForm({ ...riderForm, licenseNo: e.target.value })}
                    placeholder="BA-2-PA-8899"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Delivery Zone</label>
                  <select
                    value={riderForm.zone}
                    onChange={(e) => setRiderForm({ ...riderForm, zone: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Kathmandu Central">Kathmandu Central</option>
                    <option value="Patan / Lalitpur">Patan / Lalitpur</option>
                    <option value="Bhaktapur Core">Bhaktapur Core</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Per-Delivery Commission Rate (NPR)</label>
                <input
                  type="number"
                  min="0"
                  value={riderForm.commissionRate}
                  onChange={(e) => setRiderForm({ ...riderForm, commissionRate: Number(e.target.value) })}
                  className={inputClass}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRiderOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? 'Onboarding...' : 'Register Courier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
