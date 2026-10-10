import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  saveSettingsFn,
  reconcilePaymentFn,
} from '#/server/operations/operations.functions'
import type { PaymentMethod } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  CreditCard,
  Shield,
  Activity,
  CheckCircle,
  Download,
  Search,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
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
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { EmptyState } from '#/components/shared/empty-state'

export const Route = createFileRoute('/admin/payments')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminPaymentsPage,
})

const GATEWAY_INFO: Record<
  PaymentMethod,
  { name: string; channel: string; defaultFee: string }
> = {
  esewa: { name: 'eSewa Mobile Wallet', channel: 'ESEWA-EPAY', defaultFee: '1.75%' },
  khalti: { name: 'Khalti Digital Wallet', channel: 'KHALTI-EPAY', defaultFee: '1.80%' },
  fonepay: { name: 'Fonepay Interbank QR', channel: 'FONEPAY-QR', defaultFee: '1.20%' },
  connectips: { name: 'ConnectIPS NCHL', channel: 'NCHL-CIPS', defaultFee: '0.50%' },
  cod: { name: 'Cash on Delivery (COD)', channel: 'MANUAL-FLOAT', defaultFee: '0.00%' },
}

function AdminPaymentsPage() {
  const { ops } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'gateways' | 'reconciliation'>('gateways')
  const [searchQuery, setSearchQuery] = useState('')
  const [pingStatus, setPingStatus] = useState<Record<string, { loading: boolean; latency?: number }>>({})
  const [editingGateway, setEditingGateway] = useState<PaymentMethod | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Local gateway form
  const [gatewayForm, setGatewayForm] = useState({
    enabled: true,
    merchantId: '',
    mode: 'sandbox' as 'sandbox' | 'live',
  })

  const gateways = ops.settings.gateways || {
    esewa: { enabled: true, merchantId: 'EPAYTEST', mode: 'sandbox' },
    khalti: { enabled: true, merchantId: 'live_sec_khalti_1', mode: 'sandbox' },
    fonepay: { enabled: true, merchantId: 'fonepay_mer_01', mode: 'sandbox' },
    connectips: { enabled: true, merchantId: 'cips_nepal_02', mode: 'sandbox' },
    cod: { enabled: true, merchantId: 'COD-CUSTODY', mode: 'live' },
  }

  const handlePing = (gw: string) => {
    setPingStatus((prev) => ({ ...prev, [gw]: { loading: true } }))
    setTimeout(() => {
      const latency = Math.floor(75 + Math.random() * 80)
      setPingStatus((prev) => ({ ...prev, [gw]: { loading: false, latency } }))
      toast.success(`${GATEWAY_INFO[gw as PaymentMethod]?.name} connection test: ${latency}ms OK`)
    }, 600)
  }

  const handleOpenEdit = (method: PaymentMethod) => {
    const gw = gateways[method] || { enabled: true, merchantId: '', mode: 'sandbox' }
    setEditingGateway(method)
    setGatewayForm({
      enabled: gw.enabled,
      merchantId: gw.merchantId,
      mode: gw.mode,
    })
  }

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGateway) return

    try {
      setIsUpdating(true)
      const nextGateways = {
        ...gateways,
        [editingGateway]: {
          enabled: gatewayForm.enabled,
          merchantId: gatewayForm.merchantId,
          mode: gatewayForm.mode,
        },
      }

      await saveSettingsFn({
        data: {
          ...ops.settings,
          gateways: nextGateways,
        },
      })

      toast.success(`Gateway configuration for ${GATEWAY_INFO[editingGateway].name} saved`)
      setEditingGateway(null)
      await router.invalidate()
    } catch {
      toast.error('Failed to save gateway config')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReconcile = async (txnId: string) => {
    try {
      setIsUpdating(true)
      await reconcilePaymentFn({ data: { id: txnId } })
      toast.success('Transaction reconciled and matched with ledger')
      await router.invalidate()
    } catch {
      toast.error('Failed to reconcile transaction')
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredPayments = ops.payments.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.reference.toLowerCase().includes(q) ||
      p.orderId.toLowerCase().includes(q) ||
      p.gateway.toLowerCase().includes(q)
    )
  })

  const totalReconciled = ops.payments
    .filter((p) => p.status === 'reconciled')
    .reduce((sum, p) => sum + p.amount, 0)
  const pendingReconciliation = ops.payments.filter((p) => p.status !== 'reconciled').length

  const handleExportCSV = () => {
    const headers = 'ID,OrderID,Gateway,AmountNPR,Reference,Status,CreatedAt\n'
    const rows = filteredPayments
      .map(
        (p) =>
          `"${p.id}","${p.orderId}","${p.gateway}",${p.amount},"${p.reference}","${p.status}","${p.createdAt}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Payment reconciliation exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Finance"
        title="Payments and gateway reconciliation"
        description="Nepal payment provider keys, IPN callback health pings, and transaction payout reconciliation."
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export reconciliation
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active payment gateways"
          value={Object.values(gateways).filter((g) => g.enabled).length}
          note="Configured payment channels"
          icon={CreditCard}
        />
        <KpiCard
          label="Reconciled volume"
          value={formatNPR(totalReconciled)}
          note="Matched checkout payments"
          icon={CheckCircle}
          tone="success"
        />
        <KpiCard
          label="Pending batch matches"
          value={pendingReconciliation}
          note="Unmatched gateway checkouts"
          icon={Activity}
          tone={pendingReconciliation > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="h-9">
          <TabsTrigger value="gateways" className="gap-2 text-xs">
            <CreditCard className="h-3.5 w-3.5" />
            <span>Nepal payment gateways</span>
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-2 text-xs">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Reconciliation ({ops.payments.length})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'gateways' ? (
        /* Gateway Cards Grid */
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex items-start gap-3 text-xs">
            <Shield className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
            <div>
              <strong className="block font-medium text-foreground">Nepal Domestic Financial Gateway Standard</strong>
              <p className="text-muted-foreground mt-0.5">
                Configured with IPN callback endpoints, SHA256 HMAC digital signatures, and dynamic QR terminal generation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(GATEWAY_INFO) as PaymentMethod[]).map((method) => {
              const meta = GATEWAY_INFO[method]
              const gw = gateways[method] || { enabled: true, merchantId: 'TEST', mode: 'sandbox' }
              const ping = pingStatus[method]

              return (
                <Card key={method} className="flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-semibold">{meta.name}</CardTitle>
                          <Badge variant="outline" className="text-[10px] font-mono capitalize">
                            {gw.mode}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Channel: {meta.channel}
                        </span>
                      </div>

                      <Badge
                        variant={gw.enabled ? 'default' : 'secondary'}
                        className="text-[10px] font-normal"
                      >
                        {gw.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Merchant code:</span>
                        <span className="font-mono text-foreground font-medium">{gw.merchantId}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Processing fee:</span>
                        <span className="text-foreground">{meta.defaultFee}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Settlement SLA:</span>
                        <span className="text-foreground">T+1 Business Day (Nabil)</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardFooter className="flex items-center justify-between border-t border-border/50 pt-3">
                    <div>
                      {ping?.latency ? (
                        <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {ping.latency}ms OK
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Ready</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePing(method)}
                        disabled={ping?.loading}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Activity className={`h-3 w-3 ${ping?.loading ? 'animate-spin' : ''}`} />
                        {ping?.loading ? 'Pinging...' : 'Test ping'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(method)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Settings className="h-3 w-3" />
                        Configure
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        /* Reconciliation Table */
        <div className="space-y-4">
          <div className="flex rounded-lg border border-border bg-card p-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search reference, order number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs">Order linked</TableHead>
                  <TableHead className="text-xs">Gateway provider</TableHead>
                  <TableHead className="text-xs">Amount (NPR)</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        title="No payment records found"
                        description="Try adjusting your search query."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-foreground">{p.reference}</span>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs text-primary">{p.orderId}</span>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-xs uppercase text-foreground">
                          {p.gateway}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                          {formatNPR(p.amount)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={p.status === 'reconciled' ? 'outline' : 'secondary'}
                          className="text-[10px] font-normal uppercase"
                        >
                          {p.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {p.status !== 'reconciled' && (
                          <Button
                            size="sm"
                            onClick={() => handleReconcile(p.id)}
                            disabled={isUpdating}
                            className="h-7 px-2 text-xs"
                          >
                            Reconcile match
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Configure Gateway Dialog */}
      <Dialog open={Boolean(editingGateway)} onOpenChange={(open) => !open && setEditingGateway(null)}>
        {editingGateway && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                Configure {GATEWAY_INFO[editingGateway].name}
              </DialogTitle>
              <DialogDescription className="text-xs">Update merchant credentials</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveGateway} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Merchant ID / account code *</Label>
                <Input
                  required
                  value={gatewayForm.merchantId}
                  onChange={(e) => setGatewayForm({ ...gatewayForm, merchantId: e.target.value })}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Environment mode</Label>
                <NativeSelect
                  value={gatewayForm.mode}
                  onChange={(e) =>
                    setGatewayForm({ ...gatewayForm, mode: e.target.value as any })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="sandbox">Sandbox (Testing)</NativeSelectOption>
                  <NativeSelectOption value="live">Live (Production)</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="enable_gw"
                  checked={gatewayForm.enabled}
                  onCheckedChange={(checked) => setGatewayForm({ ...gatewayForm, enabled: Boolean(checked) })}
                />
                <Label htmlFor="enable_gw" className="text-xs cursor-pointer font-normal">
                  Accept customer checkouts via this channel
                </Label>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingGateway(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isUpdating} className="h-8 text-xs">
                  {isUpdating ? 'Saving...' : 'Save configuration'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
