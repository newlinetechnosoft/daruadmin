import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  addLedgerFn,
  approveSettlementFn,
} from '#/server/operations/operations.functions'
import type { LedgerEntry } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  Wallet,
  Receipt,
  Plus,
  Download,
  Search,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
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
  CardHeader,
  CardTitle,
  CardDescription,
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

export const Route = createFileRoute('/admin/accounts')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminAccountsPage,
})

function AdminAccountsPage() {
  const { ops } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'ledger' | 'statements' | 'settlements'>('ledger')
  const [searchQuery, setSearchQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isAddVoucherOpen, setIsAddVoucherOpen] = useState(false)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Voucher form state
  const [voucherForm, setVoucherForm] = useState({
    memo: '',
    category: 'expense' as LedgerEntry['category'],
    account: 'bank',
    type: 'debit' as 'debit' | 'credit',
    amount: 5000,
  })

  const filteredLedger = useMemo(() => {
    return ops.ledger.filter((item) => {
      if (accountFilter !== 'all' && item.account !== accountFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          item.memo.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.refId || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [ops.ledger, accountFilter, categoryFilter, searchQuery])

  // Ledger Calculations
  const totalDebits = ops.ledger
    .filter((l) => l.type === 'debit')
    .reduce((sum, l) => sum + l.amount, 0)
  const totalCredits = ops.ledger
    .filter((l) => l.type === 'credit')
    .reduce((sum, l) => sum + l.amount, 0)
  const netLiquidityBalance = totalCredits - totalDebits + 2500000

  // P&L Statement Metrics
  const grossSales = ops.ledger
    .filter((l) => l.category === 'sales')
    .reduce((sum, l) => sum + l.amount, 0)
  const cogsPurchases = ops.ledger
    .filter((l) => l.category === 'purchase')
    .reduce((sum, l) => sum + l.amount, 0)
  const operatingExpenses = ops.ledger
    .filter((l) => l.category === 'expense')
    .reduce((sum, l) => sum + l.amount, 0)
  const codCollected = ops.ledger
    .filter((l) => l.category === 'cod')
    .reduce((sum, l) => sum + l.amount, 0)
  const refundsIssued = ops.ledger
    .filter((l) => l.category === 'refund')
    .reduce((sum, l) => sum + l.amount, 0)

  const grossProfit = grossSales - cogsPurchases
  const netEstimatedProfit = grossProfit - operatingExpenses - refundsIssued

  const handlePostVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voucherForm.memo || voucherForm.amount <= 0) {
      toast.error('Please enter a description and valid amount')
      return
    }

    try {
      setIsSubmitting(true)
      await addLedgerFn({
        data: {
          type: voucherForm.type,
          category: voucherForm.category,
          account: voucherForm.account,
          memo: voucherForm.memo,
          amount: Number(voucherForm.amount),
        },
      })
      toast.success('Journal voucher posted to general ledger')
      setIsAddVoucherOpen(false)
      setVoucherForm({
        memo: '',
        category: 'expense',
        account: 'bank',
        type: 'debit',
        amount: 5000,
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to post voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApproveSettlement = async (id: string, status: 'approved' | 'paid') => {
    try {
      setIsSubmitting(true)
      await approveSettlementFn({ data: { id, status } })
      toast.success(`Settlement marked as ${status}`)
      await router.invalidate()
    } catch {
      toast.error('Failed to update settlement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = 'ID,Date,Type,Category,Account,AmountNPR,Memo,RefType,RefID\n'
    const rows = filteredLedger
      .map(
        (l) =>
          `"${l.id}","${l.date}","${l.type}","${l.category}","${l.account}",${l.amount},"${l.memo.replace(/"/g, '""')}","${l.refType}","${l.refId || ''}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Ledger exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Finance"
        title="Accounts and financial ledger"
        description="Centralized double-entry accounting, P&L reporting, and courier remittance settlement."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => setIsAddVoucherOpen(true)} className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Record voucher
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Consolidated liquidity"
          value={formatNPR(netLiquidityBalance)}
          note="Across bank, wallets & COD cash"
          icon={Wallet}
        />
        <KpiCard
          label="Total inflow (credits)"
          value={formatNPR(totalCredits)}
          note="Sales income & COD remittances"
          icon={ArrowDownLeft}
          tone="success"
        />
        <KpiCard
          label="Total outflow (debits)"
          value={formatNPR(totalDebits)}
          note="Inventory restock & expenses"
          icon={ArrowUpRight}
          tone="danger"
        />
        <KpiCard
          label="Estimated net margin"
          value={formatNPR(netEstimatedProfit)}
          note="Gross profit less overhead"
          icon={TrendingUp}
          tone={netEstimatedProfit >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="h-9">
          <TabsTrigger value="ledger" className="gap-2 text-xs">
            <Receipt className="h-3.5 w-3.5" />
            <span>General ledger ({ops.ledger.length})</span>
          </TabsTrigger>
          <TabsTrigger value="statements" className="gap-2 text-xs">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>P&L and balance sheet</span>
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2 text-xs">
            <Coins className="h-3.5 w-3.5" />
            <span>Settlements ({ops.settlements.length})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'ledger' ? (
        /* Ledger Table */
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search memo, reference ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">All accounts</NativeSelectOption>
                <NativeSelectOption value="bank">Bank account</NativeSelectOption>
                <NativeSelectOption value="cash">Cash in hand</NativeSelectOption>
                <NativeSelectOption value="esewa">eSewa wallet</NativeSelectOption>
                <NativeSelectOption value="khalti">Khalti wallet</NativeSelectOption>
              </NativeSelect>

              <NativeSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">All categories</NativeSelectOption>
                <NativeSelectOption value="sales">Sales income</NativeSelectOption>
                <NativeSelectOption value="purchase">Inventory purchases</NativeSelectOption>
                <NativeSelectOption value="expense">Operating expense</NativeSelectOption>
                <NativeSelectOption value="cod">COD remittance</NativeSelectOption>
                <NativeSelectOption value="refund">Refund payout</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date and ID</TableHead>
                  <TableHead className="text-xs">Description and memo</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-right text-xs">Debit out (-)</TableHead>
                  <TableHead className="text-right text-xs">Credit in (+)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLedger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        title="No ledger transactions found"
                        description="Try adjusting your filters or search terms."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLedger.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono text-xs text-foreground block">{item.id}</span>
                        <span className="text-[11px] text-muted-foreground">{item.date}</span>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-xs text-foreground">{item.memo}</div>
                        {item.refId && (
                          <span className="text-[11px] text-muted-foreground font-mono">Ref: {item.refId}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                          {item.category}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs uppercase text-muted-foreground">
                          {item.account}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        {item.type === 'debit' ? (
                          <span className="font-mono text-xs font-semibold tabular-nums text-destructive">
                            -{formatNPR(item.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {item.type === 'credit' ? (
                          <span className="font-mono text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            +{formatNPR(item.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : activeTab === 'statements' ? (
        /* P&L and Balance Sheet */
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setIsStatementModalOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print official statement
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Profit & Loss */}
            <Card className="p-4 space-y-3">
              <CardHeader className="p-0 pb-3 border-b border-border">
                <CardTitle className="text-xs font-semibold">Statement of profit and loss</CardTitle>
                <CardDescription className="text-[11px]">Operating performance summary</CardDescription>
              </CardHeader>

              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Revenue</div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Gross merchandise sales:</span>
                  <span className="font-mono text-foreground font-medium">+{formatNPR(grossSales)}</span>
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>COD remittances realized:</span>
                  <span className="font-mono text-foreground font-medium">+{formatNPR(codCollected)}</span>
                </div>

                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-2">
                  Cost of goods sold (COGS)
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Inventory restock purchases:</span>
                  <span className="font-mono text-destructive">-{formatNPR(cogsPurchases)}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground border-t border-border/50 pt-1.5 pl-2">
                  <span>Gross operating margin:</span>
                  <span className="font-mono font-semibold">{formatNPR(grossProfit)}</span>
                </div>

                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-2">
                  Operating overhead
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Utilities and fulfillment overhead:</span>
                  <span className="font-mono text-destructive">-{formatNPR(operatingExpenses)}</span>
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Customer refund disbursals:</span>
                  <span className="font-mono text-destructive">-{formatNPR(refundsIssued)}</span>
                </div>

                <div className="flex justify-between items-center border-t border-border pt-3 bg-muted/30 p-2.5 rounded-md mt-2">
                  <span className="text-xs font-medium text-foreground">Estimated net operating profit:</span>
                  <span className={`font-mono text-sm font-bold ${netEstimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {formatNPR(netEstimatedProfit)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Balance Sheet Overview */}
            <Card className="p-4 space-y-3">
              <CardHeader className="p-0 pb-3 border-b border-border">
                <CardTitle className="text-xs font-semibold">Solvency and balance sheet</CardTitle>
                <CardDescription className="text-[11px]">Liquid reserves and current liabilities</CardDescription>
              </CardHeader>

              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current liquid assets</div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Corporate bank operating account:</span>
                  <span className="font-mono text-foreground font-medium">{formatNPR(1850000)}</span>
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>eSewa merchant settlement reserve:</span>
                  <span className="font-mono text-foreground font-medium">{formatNPR(420000)}</span>
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Khalti merchant settlement reserve:</span>
                  <span className="font-mono text-foreground font-medium">{formatNPR(310000)}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground border-t border-border/50 pt-1.5 pl-2">
                  <span>Total liquid reserves:</span>
                  <span className="font-mono font-semibold">{formatNPR(2580000)}</span>
                </div>

                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider pt-2">
                  Current liabilities
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Vendor inventory payables:</span>
                  <span className="font-mono text-destructive font-medium">{formatNPR(180000)}</span>
                </div>
                <div className="flex justify-between pl-2 text-muted-foreground">
                  <span>Government 13% VAT payable:</span>
                  <span className="font-mono text-destructive font-medium">
                    {formatNPR(Math.round(grossSales * 0.13))}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-border pt-3 bg-muted/30 p-2.5 rounded-md mt-2">
                  <span className="text-xs font-medium text-foreground">Net working capital:</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {formatNPR(2580000 - 180000 - Math.round(grossSales * 0.13))}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Settlements Table */
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Settlement no</TableHead>
                <TableHead className="text-xs">Courier name</TableHead>
                <TableHead className="text-xs">Cycle period</TableHead>
                <TableHead className="text-xs">Deliveries</TableHead>
                <TableHead className="text-xs">Cash remitted</TableHead>
                <TableHead className="text-xs">Commission</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ops.settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      title="No courier settlements pending"
                      description="All rider accounts are balanced."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                ops.settlements.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-foreground">{set.id}</span>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{set.riderName}</div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {set.periodStart} → {set.periodEnd}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs text-foreground">{set.deliveries}</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {formatNPR(set.cashCollected)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        +{formatNPR(set.commission)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={set.status === 'paid' ? 'default' : 'secondary'}
                        className="text-[10px] font-normal uppercase"
                      >
                        {set.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      {set.status !== 'paid' && (
                        <Button
                          size="sm"
                          onClick={() => handleApproveSettlement(set.id, 'paid')}
                          disabled={isSubmitting}
                          className="h-7 px-2 text-xs"
                        >
                          Mark paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Record Voucher Dialog */}
      <Dialog open={isAddVoucherOpen} onOpenChange={setIsAddVoucherOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Post journal voucher</DialogTitle>
            <DialogDescription className="text-xs">Direct general ledger entry</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostVoucher} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Description / memo *</Label>
              <Input
                required
                value={voucherForm.memo}
                onChange={(e) => setVoucherForm({ ...voucherForm, memo: e.target.value })}
                placeholder="e.g. Warehouse electricity utility payment"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <NativeSelect
                  value={voucherForm.category}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, category: e.target.value as any })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="expense">Operating expense</NativeSelectOption>
                  <NativeSelectOption value="purchase">Inventory purchase (COGS)</NativeSelectOption>
                  <NativeSelectOption value="sales">Direct sales income</NativeSelectOption>
                  <NativeSelectOption value="cod">COD remittance</NativeSelectOption>
                  <NativeSelectOption value="refund">Refund payout</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target account</Label>
                <NativeSelect
                  value={voucherForm.account}
                  onChange={(e) => setVoucherForm({ ...voucherForm, account: e.target.value })}
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="bank">Bank corporate</NativeSelectOption>
                  <NativeSelectOption value="cash">Cash on hand</NativeSelectOption>
                  <NativeSelectOption value="esewa">eSewa merchant</NativeSelectOption>
                  <NativeSelectOption value="khalti">Khalti merchant</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Voucher type</Label>
                <NativeSelect
                  value={voucherForm.type}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, type: e.target.value as any })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="debit">Debit outflow (-)</NativeSelectOption>
                  <NativeSelectOption value="credit">Credit inflow (+)</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (NPR) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={voucherForm.amount}
                  onChange={(e) => setVoucherForm({ ...voucherForm, amount: Number(e.target.value) })}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddVoucherOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
                {isSubmitting ? 'Posting...' : 'Post entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Official Financial Statement Preview Dialog */}
      <Dialog open={isStatementModalOpen} onOpenChange={setIsStatementModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-semibold">
              Official statement of financial position
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="h-7 gap-1 text-xs"
            >
              <Printer className="h-3 w-3" />
              Print / Save PDF
            </Button>
          </DialogHeader>

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <h2 className="text-xs font-bold text-foreground uppercase">
                  {ops.settings.legalName || 'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                </h2>
                <p className="text-muted-foreground">{ops.settings.address || 'Kathmandu, Nepal'}</p>
                <p className="text-muted-foreground font-mono">PAN/VAT: {ops.settings.pan || '609823415'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-foreground uppercase block">
                  Audited financial report
                </span>
                <div className="text-muted-foreground text-[10px]">
                  Date: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground border-b border-border/40 pb-1 text-xs">Operating income</h4>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Gross sales income:</span>
                <span className="font-mono text-foreground font-medium">{formatNPR(grossSales)}</span>
              </div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Cost of inventory purchases (COGS):</span>
                <span className="font-mono text-destructive">-{formatNPR(cogsPurchases)}</span>
              </div>
              <div className="flex justify-between py-1 font-semibold text-foreground bg-muted/40 px-2 rounded">
                <span>Gross operating margin:</span>
                <span className="font-mono">{formatNPR(grossProfit)}</span>
              </div>

              <h4 className="font-semibold text-foreground border-b border-border/40 pb-1 text-xs pt-2">
                Operating overhead and payouts
              </h4>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Warehouse utilities and supplies:</span>
                <span className="font-mono text-destructive">-{formatNPR(operatingExpenses)}</span>
              </div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Customer refund payouts:</span>
                <span className="font-mono text-destructive">-{formatNPR(refundsIssued)}</span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-md bg-muted/30 border border-border mt-3">
                <span className="text-xs font-medium text-foreground">Net realized profit:</span>
                <span className="text-sm font-bold text-foreground font-mono">
                  {formatNPR(netEstimatedProfit)}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
