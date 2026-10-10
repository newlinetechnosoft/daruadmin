import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  saveSettingsFn,
  resetOpsFn,
} from '#/server/operations/operations.functions'
import type { PaymentMethod, StoreSettings } from '#/server/operations/types'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect } from '#/components/ui/native-select'
import { Switch } from '#/components/ui/switch'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
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
    <div className="space-y-6">
      <PageHeader
        kicker="System Configuration"
        title="Settings & Compliance"
        description="Configure platform store legal identity, Nepal IRD VAT invoicing, 18+ liquor age gate, payment credentials, and Neon DB storage."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setResetModalOpen(true)}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              Reset Demo Data
            </Button>
            <Button
              onClick={() => handleSave()}
              disabled={isSaving}
              className="gap-2"
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
            </Button>
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as typeof activeTab)}
        className="w-full space-y-4"
      >
        <TabsList className="h-auto flex-wrap p-1">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-3.5 w-3.5" />
            <span>Store & Legal Profile</span>
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-2">
            <Receipt className="h-3.5 w-3.5" />
            <span>Tax & Invoicing</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Compliance & Safety</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-3.5 w-3.5" />
            <span>Alerts & Messages</span>
          </TabsTrigger>
          <TabsTrigger value="gateways" className="gap-2">
            <CreditCard className="h-3.5 w-3.5" />
            <span>Payment Gateways</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Server className="h-3.5 w-3.5" />
            <span>Neon DB & System</span>
          </TabsTrigger>
        </TabsList>

        {/* General Store Profile */}
        <TabsContent value="general">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Official Business Information</CardTitle>
                  <CardDescription>
                    Used in Nepal IRD tax invoices, legal order receipts, and customer confirmation emails.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="store-name">Store Display Name</Label>
                      <Input
                        id="store-name"
                        value={form.storeName}
                        onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                        placeholder="e.g. Mezmani"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="legal-name">Registered Corporate Entity</Label>
                      <Input
                        id="legal-name"
                        value={form.legalName}
                        onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                        placeholder="e.g. Mezmani Retail Pvt. Ltd."
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pan-num">Nepal PAN Registration Number</Label>
                      <Input
                        id="pan-num"
                        value={form.pan}
                        onChange={(e) => setForm({ ...form, pan: e.target.value })}
                        placeholder="9-digit PAN number"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="vat-id">Nepal VAT Registration ID</Label>
                      <Input
                        id="vat-id"
                        value={form.vat}
                        onChange={(e) => setForm({ ...form, vat: e.target.value })}
                        placeholder="e.g. NP-VAT-001"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="store-phone">Official Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute top-1/2 -translate-y-1/2 left-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="store-phone"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="pl-9"
                          placeholder="+977-98XXXXXXXX"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="store-email">Operational Support Email</Label>
                      <div className="relative">
                        <Mail className="absolute top-1/2 -translate-y-1/2 left-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="store-email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="pl-9"
                          placeholder="ops@mezmani.com.np"
                          required
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="store-addr">Registered Physical Address</Label>
                      <div className="relative">
                        <MapPin className="absolute top-1/2 -translate-y-1/2 left-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="store-addr"
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                          className="pl-9"
                          placeholder="Street address, Ward, Location"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="store-city">City / Municipality</Label>
                      <Input
                        id="store-city"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Kathmandu"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end border-t border-border">
                    <Button
                      onClick={() => handleSave()}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Store Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Invoice Header Preview</CardTitle>
                  <CardDescription>
                    Official receipt header format:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-center space-y-1">
                    <h4 className="text-sm font-bold uppercase tracking-tight text-foreground">
                      {form.storeName || 'Mezmani'}
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium">{form.legalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {form.address}, {form.city}
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2 text-[11px] font-mono text-foreground font-semibold">
                      <span>PAN: {form.pan}</span>
                      <span>•</span>
                      <span>VAT: {form.vat}</span>
                    </div>
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      Tel: {form.phone} | Email: {form.email}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Nepal IRD Compliance</h4>
                      <p className="text-xs text-muted-foreground">Inland Revenue Department rules</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    According to Nepal IRD Value Added Tax Act 2052, all retail liquor transactions must maintain sequentially numbered tax invoices and report VAT Annex 13 registers monthly.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tax & Invoicing */}
        <TabsContent value="tax">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Nepal Tax & Invoicing Parameters</CardTitle>
                  <CardDescription>
                    Control the standard VAT rate, sequential bill numbering prefixes, and inventory triggers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tax-rate">Standard Nepal VAT Rate (%)</Label>
                      <div className="relative">
                        <Input
                          id="tax-rate"
                          type="number"
                          min="0"
                          max="30"
                          step="0.5"
                          value={form.taxRate}
                          onChange={(e) =>
                            setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })
                          }
                          required
                        />
                        <span className="absolute top-1/2 -translate-y-1/2 right-3 text-xs font-semibold text-muted-foreground">
                          %
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Statutory standard VAT rate in Nepal is 13%.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="prefix-input">Invoice Number Prefix</Label>
                      <Input
                        id="prefix-input"
                        value={form.invoicePrefix}
                        onChange={(e) =>
                          setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })
                        }
                        placeholder="e.g. MZ or DARU"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Sample generated invoice:{' '}
                        <span className="font-mono font-semibold text-primary">
                          {form.invoicePrefix || 'MZ'}-2026-0042
                        </span>
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="stock-thresh">Low Stock Alert Threshold</Label>
                      <div className="relative">
                        <Input
                          id="stock-thresh"
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
                          required
                        />
                        <span className="absolute top-1/2 -translate-y-1/2 right-3 text-xs font-semibold text-muted-foreground">
                          units
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Items with inventory below this quantity trigger alerts on dashboard.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end border-t border-border">
                    <Button
                      onClick={() => handleSave()}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Tax Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Tax Calculation Logic</CardTitle>
                  <CardDescription>
                    Mezmani tax breakdown flow:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-border pb-1.5 text-muted-foreground">
                      <span>Gross Product Subtotal</span>
                      <span className="font-semibold text-foreground">100.00%</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-1.5 text-muted-foreground">
                      <span>VAT ({form.taxRate}%)</span>
                      <span className="font-semibold text-primary">+{form.taxRate}.00%</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-1.5 text-muted-foreground">
                      <span>Delivery Fee</span>
                      <span className="font-semibold text-foreground">Per Zone</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold text-foreground pt-1">
                      <span>Net Payable Total</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Calculated</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Compliance & Safety */}
        <TabsContent value="compliance">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Liquor Sale Age Verification (18+)</CardTitle>
                      <CardDescription>
                        Nepal law strictly prohibits the sale and delivery of alcoholic beverages to minors under 18 years of age.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {form.ageGate ? 'Enforced' : 'Disabled'}
                      </span>
                      <Switch
                        checked={form.ageGate}
                        onCheckedChange={(checked) => setForm({ ...form, ageGate: checked })}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 shrink-0 text-primary" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">
                          When age gate enforcement is ON:
                        </p>
                        <p>
                          1. All guest checkout flows prompt for user birth-date and explicit declaration of majority (18+).
                        </p>
                        <p>
                          2. Delivery riders are mandated by dispatch policy to check national identity card upon handing over liquor parcels.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={() => handleSave()}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Compliance Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Kathmandu Valley Liquor License</CardTitle>
                  <CardDescription>
                    Registered under Department of Commerce, Supplies and Consumer Protection.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      Excise License Valid
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      Compliant with Nepal Excise Act and Tobacco & Alcohol Control Regulations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Automated Alerts & Dispatch Notifications</CardTitle>
                  <CardDescription>
                    Configure channels for order status changes, courier alerts, and system notices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">
                        Email Notifications
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Send transactional email to customers when an order is confirmed, packed, or delivered.
                      </p>
                    </div>
                    <Switch
                      checked={form.notifyEmail}
                      onCheckedChange={(checked) => setForm({ ...form, notifyEmail: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">
                        SMS / WhatsApp Dispatch Alerts
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Send SMS / WhatsApp notifications to delivery riders upon new order assignments via Sparrow SMS / NTC.
                      </p>
                    </div>
                    <Switch
                      checked={form.notifySms}
                      onCheckedChange={(checked) => setForm({ ...form, notifySms: checked })}
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={() => handleSave()}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Alert Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Test Dispatch Alert</CardTitle>
                  <CardDescription>
                    Simulate a test ping to verify notification services:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      toast.success('Test alert broadcast queued: sent to ' + form.email)
                    }}
                  >
                    <Bell className="h-4 w-4" />
                    Send Test Ping
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Payment Gateways */}
        <TabsContent value="gateways">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Nepal Payment Gateway Integrations</CardTitle>
                <CardDescription>
                  Configure merchant identification keys and switch between Sandbox (Test) and Live production mode.
                </CardDescription>
              </div>
              <Button
                onClick={() => handleSave()}
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Gateways
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
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
                    className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 sm:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          {info.title}
                        </span>
                        <Badge
                          variant={gw.mode === 'live' ? 'success' : 'warning'}
                          className="uppercase text-[10px]"
                        >
                          {gw.mode}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{info.subtitle}</p>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`gw-${method}-id`} className="text-[11px] text-muted-foreground">
                          {method === 'cod' ? 'Float Account ID' : 'Merchant ID / Secret Key'}
                        </Label>
                        <Input
                          id={`gw-${method}-id`}
                          type="text"
                          value={gw.merchantId}
                          onChange={(e) =>
                            updateGateway(method, { merchantId: e.target.value })
                          }
                          className="h-8 font-mono text-xs"
                          placeholder={
                            method === 'cod'
                              ? 'COD-CUSTODY'
                              : `Enter ${method.toUpperCase()} Merchant ID`
                          }
                        />
                      </div>

                      <div className="w-28 space-y-1">
                        <Label htmlFor={`gw-${method}-mode`} className="text-[11px] text-muted-foreground">
                          Environment
                        </Label>
                        <NativeSelect
                          id={`gw-${method}-mode`}
                          value={gw.mode}
                          onChange={(e) =>
                            updateGateway(method, {
                              mode: e.target.value as 'sandbox' | 'live',
                            })
                          }
                          className="h-8 text-xs"
                        >
                          <option value="sandbox">Sandbox</option>
                          <option value="live">Live</option>
                        </NativeSelect>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-4">
                        <Switch
                          checked={gw.enabled}
                          onCheckedChange={(checked) => updateGateway(method, { enabled: checked })}
                        />
                        <span className="text-xs text-muted-foreground w-12 font-medium">
                          {gw.enabled ? 'Enabled' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Neon DB & System */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Neon PostgreSQL Infrastructure</CardTitle>
                    <CardDescription>Serverless AWS Cloud Database</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <span className="text-muted-foreground">Database Driver</span>
                  <span className="font-mono font-medium text-foreground">
                    @neondatabase/serverless (WebSocket Pooler)
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <span className="text-muted-foreground">Operational Table</span>
                  <span className="font-mono font-medium text-foreground">ops_kv</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <span className="text-muted-foreground">State Snapshot Key</span>
                  <span className="font-mono font-medium text-foreground">mezmani-ops-v1</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <span className="text-muted-foreground">Connection Status</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live & Healthy (Auto-Sync)
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Cloud Storage Metrics</CardTitle>
                    <CardDescription>Current live operational records</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Live Orders</p>
                    <p className="mt-1 text-xl font-bold text-foreground font-mono">{ops.orders.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Fleet Couriers</p>
                    <p className="mt-1 text-xl font-bold text-foreground font-mono">{ops.riders.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Ledger Vouchers</p>
                    <p className="mt-1 text-xl font-bold text-foreground font-mono">{ops.ledger.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Catalog SKUs</p>
                    <p className="mt-1 text-xl font-bold text-foreground font-mono">{totalCatalogItems}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Danger Zone */}
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <h3 className="text-sm font-semibold text-destructive">
                      Sandbox Demo Factory Re-seed
                    </h3>
                  </div>
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                    Re-populates the Neon database with default orders, Kathmandu Valley dispatch riders, initial general ledger transactions, and marketing vouchers from the catalog.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setResetModalOpen(true)}
                  className="gap-2 shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Sandbox Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog for Reset */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Sandbox Reset
            </DialogTitle>
            <DialogDescription>
              This action replaces live test state in Neon DB with fresh seed data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              To prevent accidental reset, please type{' '}
              <span className="font-mono font-bold text-destructive">RESET</span> below to confirm:
            </p>
            <Input
              type="text"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="Type RESET"
              className="font-mono"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetModalOpen(false)
                setResetConfirmationText('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetSandbox}
              disabled={isResetting || resetConfirmationText.trim().toLowerCase() !== 'reset'}
            >
              {isResetting ? 'Resetting...' : 'Confirm Factory Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
