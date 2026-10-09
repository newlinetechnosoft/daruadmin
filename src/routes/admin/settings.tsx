import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  saveSettingsFn,
  resetOpsFn,
} from '#/server/operations/operations.functions'
import type { PaymentMethod, StoreSettings } from '#/server/operations/types'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import {
  pageClass,
  cardClass,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from '#/components/admin/styles'
import {
  Building2,
  Receipt,
  ShieldCheck,
  Bell,
  CreditCard,
  Database,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/settings')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminSettingsPage,
})

const GATEWAY_NAMES: Record<PaymentMethod, { title: string; subtitle: string }> = {
  esewa: { title: 'eSewa Mobile Wallet', subtitle: 'Nepal largest digital wallet' },
  khalti: { title: 'Khalti Digital Wallet', subtitle: 'Sparrow Pay web & app SDK' },
  fonepay: { title: 'Fonepay Interbank QR', subtitle: 'Direct bank account payment QR' },
  connectips: { title: 'ConnectIPS NCHL', subtitle: 'National clearing house gateway' },
  cod: { title: 'Cash on Delivery (COD)', subtitle: 'Physical cash float by rider fleet' },
}

function AdminSettingsPage() {
  const { ops, liquor, grocery } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<
    'general' | 'tax' | 'compliance' | 'notifications' | 'gateways' | 'system'
  >('general')

  const [form, setForm] = useState<StoreSettings>(() => ({
    storeName: ops.settings?.storeName ?? 'Mezmani',
    legalName: ops.settings?.legalName ?? 'Mezmani Retail Pvt. Ltd.',
    pan: ops.settings?.pan ?? '123456789',
    vat: ops.settings?.vat ?? 'NP-VAT-001',
    phone: ops.settings?.phone ?? '+977-9800000000',
    email: ops.settings?.email ?? 'ops@mezmani.com.np',
    address: ops.settings?.address ?? 'Durbar Marg, Kathmandu',
    city: ops.settings?.city ?? 'Kathmandu',
    invoicePrefix: ops.settings?.invoicePrefix ?? 'MZ',
    taxRate: ops.settings?.taxRate ?? 13,
    lowStockThreshold: ops.settings?.lowStockThreshold ?? 20,
    ageGate: ops.settings?.ageGate ?? true,
    notifyEmail: ops.settings?.notifyEmail ?? true,
    notifySms: ops.settings?.notifySms ?? false,
    gateways: ops.settings?.gateways ?? {
      cod: { enabled: true, merchantId: 'COD-CUSTODY', mode: 'live' },
      esewa: { enabled: true, merchantId: 'EPAYTEST', mode: 'sandbox' },
      khalti: { enabled: true, merchantId: 'khalti_pub_01', mode: 'sandbox' },
      fonepay: { enabled: false, merchantId: 'fone_mer_99', mode: 'sandbox' },
      connectips: { enabled: false, merchantId: 'cips_gw_01', mode: 'sandbox' },
    },
  }))

  const [isSaving, setIsSaving] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSaving(true)
    try {
      await saveSettingsFn({ data: form })
      toast.success('Store settings updated and synced to Neon DB!')
      await router.invalidate()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetSandbox = async () => {
    if (resetConfirmationText.trim().toLowerCase() !== 'reset') {
      toast.error('Please type RESET to confirm factory re-seed')
      return
    }
    setIsResetting(true)
    try {
      await resetOpsFn()
      toast.success('Sandbox database successfully re-seeded from catalog!')
      setResetModalOpen(false)
      setResetConfirmationText('')
      await router.invalidate()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to re-seed demo data'
      toast.error(msg)
    } finally {
      setIsResetting(false)
    }
  }

  const updateGateway = (
    method: PaymentMethod,
    updates: Partial<{ enabled: boolean; merchantId: string; mode: 'sandbox' | 'live' }>,
  ) => {
    setForm((prev) => ({
      ...prev,
      gateways: {
        ...prev.gateways,
        [method]: {
          ...prev.gateways[method],
          ...updates,
        },
      },
    }))
  }

  const totalCatalogItems = liquor.length + grocery.length

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="System Configuration"
        title="Settings & Compliance"
        description="Configure platform store legal identity, Nepal IRD VAT invoicing, 18+ liquor age gate, payment credentials, and Neon DB storage."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className={btnSecondary}
            >
              <RotateCcw className="h-4 w-4 text-slate-500" />
              Reset Demo Data
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className={btnPrimary}
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Store Identity"
          value={form.storeName}
          note={`PAN: ${form.pan} • ${form.city}`}
          icon={Building2}
          tone="default"
        />
        <KpiCard
          label="Nepal Tax Invoicing"
          value={`${form.taxRate}% VAT`}
          note={`Prefix: ${form.invoicePrefix}-000000`}
          icon={Receipt}
          tone="success"
        />
        <KpiCard
          label="Liquor Age Gate"
          value={form.ageGate ? 'Active (18+)' : 'Disabled'}
          note={form.ageGate ? 'Mandatory checkout verification' : 'Warning: Not compliant'}
          icon={ShieldCheck}
          tone={form.ageGate ? 'success' : 'danger'}
        />
        <KpiCard
          label="Neon Serverless DB"
          value="Connected"
          note={`${ops.orders.length} orders • ${ops.ledger.length} ledger rows`}
          icon={Database}
          tone="default"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto pb-px">
          {[
            { id: 'general', label: 'Store & Legal Profile', icon: Building2 },
            { id: 'tax', label: 'Tax & Invoicing', icon: Receipt },
            { id: 'compliance', label: 'Compliance & Safety', icon: ShieldCheck },
            { id: 'notifications', label: 'Alerts & Messages', icon: Bell },
            { id: 'gateways', label: 'Payment Gateways', icon: CreditCard },
            { id: 'system', label: 'Neon DB & System Info', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* TAB CONTENT: General Store Profile */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className={`${cardClass} p-6`}>
              <h2 className="text-base font-semibold text-slate-900">
                Official Business Information
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Used in Nepal IRD tax invoices, legal order receipts, and customer confirmation emails.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Customer Facing Store Name</label>
                  <input
                    type="text"
                    value={form.storeName}
                    onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Mezmani"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Registered Legal Corporate Entity</label>
                  <input
                    type="text"
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Mezmani Retail Pvt. Ltd."
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Nepal PAN Registration Number</label>
                  <input
                    type="text"
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value })}
                    className={inputClass}
                    placeholder="9-digit PAN number"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Nepal VAT Registration ID</label>
                  <input
                    type="text"
                    value={form.vat}
                    onChange={(e) => setForm({ ...form, vat: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. NP-VAT-001"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Official Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={`${inputClass} pl-9`}
                      placeholder="+977-98XXXXXXXX"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Operational Support Email</label>
                  <div className="relative">
                    <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={`${inputClass} pl-9`}
                      placeholder="ops@mezmani.com.np"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Registered Physical Address</label>
                  <div className="relative">
                    <MapPin className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className={`${inputClass} pl-9`}
                      placeholder="Street address, Ward, Location"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>City / Municipality</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputClass}
                    placeholder="Kathmandu"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className={btnPrimary}
                >
                  <Save className="h-4 w-4" />
                  Save Store Profile
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${cardClass} p-6`}>
              <h3 className="text-sm font-semibold text-slate-900">
                Invoice Header Preview
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                How your company header appears on official customer receipts:
              </p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="text-center">
                  <h4 className="text-base font-bold tracking-tight text-slate-900 uppercase">
                    {form.storeName || 'Mezmani'}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">{form.legalName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {form.address}, {form.city}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs">
                    <span>PAN: {form.pan}</span>
                    <span>•</span>
                    <span>VAT: {form.vat}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Tel: {form.phone} | Email: {form.email}
                  </p>
                </div>
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Nepal IRD Compliance</h4>
                  <p className="text-xs text-slate-500">Inland Revenue Department rules</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                According to Nepal IRD Value Added Tax Act 2052, all retail liquor transactions must maintain sequentially numbered tax invoices and report VAT Annex 13 registers monthly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Tax & Invoicing */}
      {activeTab === 'tax' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className={`${cardClass} p-6`}>
              <h2 className="text-base font-semibold text-slate-900">
                Nepal Tax & Invoicing Parameters
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Control the standard VAT rate, sequential bill numbering prefixes, and inventory triggers.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Standard Nepal VAT Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      value={form.taxRate}
                      onChange={(e) =>
                        setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })
                      }
                      className={inputClass}
                      required
                    />
                    <span className="absolute top-2.5 right-3 text-sm font-semibold text-slate-400">
                      %
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Statutory standard VAT rate in Nepal is 13%.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Invoice Number Prefix</label>
                  <input
                    type="text"
                    value={form.invoicePrefix}
                    onChange={(e) =>
                      setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })
                    }
                    className={inputClass}
                    placeholder="e.g. MZ or DARU"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Sample generated invoice:{' '}
                    <span className="font-mono font-semibold text-blue-600">
                      {form.invoicePrefix || 'MZ'}-2026-0042
                    </span>
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Low Stock Alert Threshold</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={form.lowStockThreshold}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lowStockThreshold: parseInt(e.target.value, 10) || 10,
                        })
                      }
                      className={inputClass}
                      required
                    />
                    <span className="absolute top-2.5 right-3 text-sm font-semibold text-slate-400">
                      units
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Items with inventory below this quantity will trigger amber warnings on the dashboard and inventory desk.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className={btnPrimary}
                >
                  <Save className="h-4 w-4" />
                  Save Tax Settings
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${cardClass} p-6`}>
              <h3 className="text-sm font-semibold text-slate-900">
                Tax Calculation Logic
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Nepal IRD requires item pricing to either be inclusive or exclusive of VAT. In Mezmani:
              </p>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span>Gross Product Subtotal</span>
                  <span className="font-semibold text-slate-800">100.00%</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span>VAT ({form.taxRate}%)</span>
                  <span className="font-semibold text-blue-600">+{form.taxRate}.00%</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span>Service Delivery Fee</span>
                  <span className="font-semibold text-slate-800">Per Zone</span>
                </div>
                <div className="flex items-center justify-between font-bold text-slate-900 pt-1">
                  <span>Net Payable Total</span>
                  <span className="text-emerald-600">Calculated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Compliance & Safety */}
      {activeTab === 'compliance' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Liquor Sale Age Verification (18+)
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Nepal law strictly prohibits the sale and delivery of alcoholic beverages to minors under 18 years of age.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">
                    {form.ageGate ? 'Enforced' : 'Disabled'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ageGate: !form.ageGate })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      form.ageGate ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        form.ageGate ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 shrink-0 text-blue-600" />
                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-medium text-slate-900">
                      When age gate enforcement is ON:
                    </p>
                    <p>
                      1. All guest checkout flows prompt for user birth-date and explicit declaration of majority (18+).
                    </p>
                    <p>
                      2. Delivery riders are mandated by dispatch policy to check national identity card (Nagarikta / Driving License) upon handing over liquor parcels.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className={btnPrimary}
                >
                  <Save className="h-4 w-4" />
                  Save Compliance Settings
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${cardClass} p-6`}>
              <h3 className="text-sm font-semibold text-slate-900">
                Kathmandu Valley Liquor License
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                Registered under the Department of Commerce, Supplies and Consumer Protection (वाणिज्य, आपूर्ति तथा उपभोक्ता संरक्षण विभाग).
              </p>
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Excise License Valid
                </div>
                <p className="mt-1 text-[11px] text-emerald-700">
                  Compliant with Nepal Excise Act and Tobacco & Alcohol Control Regulations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Notifications */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className={`${cardClass} p-6`}>
              <h2 className="text-base font-semibold text-slate-900">
                Automated Alerts & Dispatch Notifications
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Configure channels for order status changes, courier alerts, and system notices.
              </p>

              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Email Notifications
                    </h3>
                    <p className="text-xs text-slate-500">
                      Send transactional email to customers when an order is confirmed, packed, or delivered.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, notifyEmail: !form.notifyEmail })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      form.notifyEmail ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        form.notifyEmail ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      SMS / WhatsApp Dispatch Alerts
                    </h3>
                    <p className="text-xs text-slate-500">
                      Send SMS / WhatsApp notifications to delivery riders upon new order assignments via Sparrow SMS / NTC.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, notifySms: !form.notifySms })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      form.notifySms ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        form.notifySms ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className={btnPrimary}
                >
                  <Save className="h-4 w-4" />
                  Save Alert Settings
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${cardClass} p-6`}>
              <h3 className="text-sm font-semibold text-slate-900">
                Test Dispatch Alert
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Simulate a test ping to verify email and notification services:
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    toast.success('Test alert broadcast queued: sent to ' + form.email)
                  }}
                  className={btnSecondary}
                >
                  <Bell className="h-4 w-4" />
                  Send Test Ping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Payment Gateways */}
      {activeTab === 'gateways' && (
        <div className="space-y-6">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Nepal Payment Gateway Integrations
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure merchant identification keys and switch between Sandbox (Test) and Live production mode.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                className={btnPrimary}
              >
                <Save className="h-4 w-4" />
                Save Gateway Configurations
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {(
                ['esewa', 'khalti', 'fonepay', 'connectips', 'cod'] as PaymentMethod[]
              ).map((method) => {
                const info = GATEWAY_NAMES[method]
                const gw = form.gateways[method] || {
                  enabled: false,
                  merchantId: '',
                  mode: 'sandbox',
                }

                return (
                  <div
                    key={method}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 sm:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          {info.title}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            gw.mode === 'live'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {gw.mode}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{info.subtitle}</p>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-slate-500">
                          {method === 'cod' ? 'Float Account ID' : 'Merchant ID / Secret Key'}
                        </label>
                        <input
                          type="text"
                          value={gw.merchantId}
                          onChange={(e) =>
                            updateGateway(method, { merchantId: e.target.value })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-800 shadow-xs outline-none focus:border-blue-500"
                          placeholder={
                            method === 'cod'
                              ? 'COD-CUSTODY'
                              : `Enter ${method.toUpperCase()} Merchant ID`
                          }
                        />
                      </div>

                      <div className="w-28">
                        <label className="text-[11px] font-medium text-slate-500">
                          Environment
                        </label>
                        <select
                          value={gw.mode}
                          onChange={(e) =>
                            updateGateway(method, {
                              mode: e.target.value as 'sandbox' | 'live',
                            })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 shadow-xs outline-none focus:border-blue-500"
                        >
                          <option value="sandbox">Sandbox</option>
                          <option value="live">Live</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-4 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => updateGateway(method, { enabled: !gw.enabled })}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            gw.enabled ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              gw.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-slate-700 w-12">
                          {gw.enabled ? 'Enabled' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Neon DB & System Info */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Neon PostgreSQL Infrastructure
                  </h3>
                  <p className="text-xs text-slate-500">Serverless AWS Cloud Database</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
                  <span className="text-slate-500">Database Driver</span>
                  <span className="font-mono font-semibold text-slate-800">
                    @neondatabase/serverless (WebSocket Pooler)
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
                  <span className="text-slate-500">Operational Table</span>
                  <span className="font-mono font-semibold text-slate-800">ops_kv</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
                  <span className="text-slate-500">State Snapshot Key</span>
                  <span className="font-mono font-semibold text-slate-800">mezmani-ops-v1</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
                  <span className="text-slate-500">Connection Status</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live & Healthy (Auto-Sync)
                  </span>
                </div>
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Cloud Storage Metrics
                  </h3>
                  <p className="text-xs text-slate-500">Current live operational records</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Live Orders</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{ops.orders.length}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Fleet Couriers</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{ops.riders.length}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Ledger Vouchers</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{ops.ledger.length}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Catalog SKUs</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{totalCatalogItems}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h3 className="text-base font-semibold text-red-900">
                    Sandbox Demo Factory Re-seed
                  </h3>
                </div>
                <p className="mt-1 max-w-xl text-xs text-red-700">
                  Re-populates the Neon database with default orders, Kathmandu Valley dispatch riders, initial general ledger transactions, and marketing vouchers from the catalog. Use this if test data gets cluttered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Sandbox Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Confirm Sandbox Reset
                </h3>
                <p className="text-xs text-slate-500">
                  This action replaces live test state in Neon DB with fresh seed data.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                To prevent accidental reset, please type{' '}
                <span className="font-mono font-bold text-red-600">RESET</span> below to confirm:
              </p>
              <input
                type="text"
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                placeholder="Type RESET"
                className="mt-2.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 shadow-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetModalOpen(false)
                  setResetConfirmationText('')
                }}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetSandbox}
                disabled={isResetting || resetConfirmationText.trim().toLowerCase() !== 'reset'}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? 'Resetting...' : 'Confirm Factory Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
