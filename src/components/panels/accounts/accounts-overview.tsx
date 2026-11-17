import { useMemo, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { useVoucherDialog } from './use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from './export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { formatDualDate } from '#/lib/nepal-date'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  PieChart,
  Receipt,
  RefreshCw,
  Store,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import type { AccountsTab } from './accounts-route'
import type { RecentTransactionItem } from '#/server/finance/dashboard.queries'
import { toast } from 'sonner'

export interface AccountsOverviewProps {
  onPostVoucher?: () => void
  onCashHandover?: () => void
  onDealerSettlement?: () => void
  onRiderPayroll?: () => void
  onNavigateTab?: (tab: AccountsTab) => void
}

const VOUCHER_TYPE_CLASS: Record<string, string> = {
  JV: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PV: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  RV: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  CV: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  SV: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export function AccountsOverview({
  onPostVoucher,
  onCashHandover,
  onDealerSettlement,
  onRiderPayroll,
  onNavigateTab,
}: AccountsOverviewProps) {
  const { openVoucher, voucherDialog } = useVoucherDialog()

  // Branch list
  const { data: branches = [] } = useSuspenseQuery(adminQueries.branches())

  // Date Filter States
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const firstOfMonthStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])

  const [datePreset, setDatePreset] = useState<'month' | 'last30' | 'quarter' | 'year' | 'all'>('month')
  const [fromDate, setFromDate] = useState(firstOfMonthStr)
  const [toDate, setToDate] = useState(todayStr)
  const [selectedBranchId, setSelectedBranchId] = useState('all')

  const handleDatePresetChange = (preset: 'month' | 'last30' | 'quarter' | 'year' | 'all') => {
    setDatePreset(preset)
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    setToDate(today)

    if (preset === 'month') {
      setFromDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    } else if (preset === 'last30') {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      setFromDate(d.toISOString().slice(0, 10))
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const qStartMonth = currentQuarter * 3 + 1
      setFromDate(`${now.getFullYear()}-${String(qStartMonth).padStart(2, '0')}-01`)
    } else if (preset === 'year') {
      setFromDate(`${now.getFullYear()}-01-01`)
    } else if (preset === 'all') {
      setFromDate('2020-01-01')
    }
  }

  // Dashboard Query
  const {
    data: dashboardData,
    refetch,
    isFetching,
  } = useQuery(
    adminQueries.accountingDashboard({
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
    }),
  )

  const kpis = dashboardData?.kpis
  const monthlyTrends = dashboardData?.monthlyTrends || []
  const expenseBreakdown = dashboardData?.expenseBreakdown || []
  const branchProfitability = dashboardData?.branchProfitability || []
  const dealerDistribution = dashboardData?.dealerDistribution || []
  const riderDistribution = dashboardData?.riderDistribution || []
  const agingSummary = dashboardData?.agingSummary || []
  const pendingApprovals = dashboardData?.pendingApprovals
  const recentTransactions = dashboardData?.recentTransactions || []
  const alerts = dashboardData?.alerts

  // Recent transactions table search
  const [recentSearch, setRecentSearch] = useState('')
  const debouncedRecentSearch = useDebouncedValue(recentSearch, 200)

  const filteredRecent = useMemo(() => {
    const q = debouncedRecentSearch.trim().toLowerCase()
    if (!q) return recentTransactions
    return recentTransactions.filter(
      (entry) =>
        (entry.voucherNo ?? '').toLowerCase().includes(q) ||
        entry.narration.toLowerCase().includes(q) ||
        (entry.refType ?? '').toLowerCase().includes(q) ||
        (entry.refId ?? '').toLowerCase().includes(q),
    )
  }, [recentTransactions, debouncedRecentSearch])

  const recentDebit = useMemo(
    () => filteredRecent.reduce((sum, e) => sum + e.totalDebit, 0),
    [filteredRecent],
  )
  const recentCredit = useMemo(
    () => filteredRecent.reduce((sum, e) => sum + e.totalCredit, 0),
    [filteredRecent],
  )

  const columns = useMemo<ColumnDef<RecentTransactionItem>[]>(
    () => [
      {
        accessorKey: 'voucherNo',
        header: 'Voucher',
        cell: ({ row }) => (
          <div className="leading-tight">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                openVoucher(row.original.id)
              }}
              className="font-mono text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {row.original.voucherNo}
            </button>
            <span className="mt-0.5 block">
              <Badge
                variant="outline"
                className={`font-mono text-[9px] ${
                  VOUCHER_TYPE_CLASS[row.original.voucherType] ?? ''
                }`}
              >
                {row.original.voucherType}
              </Badge>
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'postingDate',
        header: 'Date',
        cell: ({ row }) => (
          <div className="leading-tight whitespace-nowrap">
            <span className="block text-xs font-mono font-medium">{row.original.bsDate}</span>
            <span className="block text-[10px] font-mono text-muted-foreground">
              {csvDate(row.original.postingDate)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'narration',
        header: 'Narration / Reference',
        cell: ({ row }) => (
          <div className="max-w-[320px] leading-tight">
            <span className="block truncate text-xs" title={row.original.narration}>
              {row.original.narration}
            </span>
            <span className="block text-[10px] font-mono text-muted-foreground">
              {row.original.refType
                ? `${row.original.refType}${
                    row.original.refId ? ` · ${row.original.refId.slice(0, 16)}` : ''
                  }`
                : 'Manual Journal'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'totalDebit',
        header: 'Debit (NPR)',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.totalDebit}
            className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400"
          />
        ),
      },
      {
        accessorKey: 'totalCredit',
        header: 'Credit (NPR)',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.totalCredit}
            className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400"
          />
        ),
      },
      {
        accessorKey: 'postingStatus',
        header: 'Status',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`text-[10px] capitalize ${
              row.original.postingStatus === 'submitted' || row.original.postingStatus === 'approved'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {row.original.postingStatus}
          </Badge>
        ),
      },
    ],
    [openVoucher],
  )

  const handleExportRecent = () => {
    exportCsv(
      `recent-journal-entries-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Voucher No', value: (entry) => entry.voucherNo },
        { header: 'Type', value: (entry) => entry.voucherType },
        { header: 'Date (BS)', value: (entry) => entry.bsDate },
        { header: 'Date (AD)', value: (entry) => csvDate(entry.postingDate) },
        { header: 'Narration', value: (entry) => entry.narration },
        { header: 'Reference Type', value: (entry) => entry.refType ?? '' },
        { header: 'Reference ID', value: (entry) => entry.refId ?? '' },
        { header: 'Debit (NPR)', value: (entry) => csvRupees(entry.totalDebit) },
        { header: 'Credit (NPR)', value: (entry) => csvRupees(entry.totalCredit) },
        { header: 'Status', value: (entry) => entry.postingStatus },
        { header: 'Posted By', value: (entry) => entry.createdBy },
      ],
      filteredRecent,
    )
  }

  const isBalanced = alerts?.isBalanced ?? true
  const maxTrendAmount = useMemo(() => {
    let max = 1
    for (const m of monthlyTrends) {
      if (m.income > max) max = m.income
      if (m.expenses > max) max = m.expenses
      if (m.inflows > max) max = m.inflows
      if (m.outflows > max) max = m.outflows
    }
    return max
  }, [monthlyTrends])

  return (
    <div className="space-y-5">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & GLOBAL FILTER BAR                                    */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Executive Financial & Accounting Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            Real-time double-entry KPIs, cash positions, profit margins, and operational distributions derived from posted general ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
            <Button
              variant={datePreset === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleDatePresetChange('month')}
              className="h-7 px-2 text-[11px]"
            >
              This Month
            </Button>
            <Button
              variant={datePreset === 'last30' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleDatePresetChange('last30')}
              className="h-7 px-2 text-[11px]"
            >
              Last 30D
            </Button>
            <Button
              variant={datePreset === 'quarter' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleDatePresetChange('quarter')}
              className="h-7 px-2 text-[11px]"
            >
              Quarter
            </Button>
            <Button
              variant={datePreset === 'year' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleDatePresetChange('year')}
              className="h-7 px-2 text-[11px]"
            >
              FY / Year
            </Button>
            <Button
              variant={datePreset === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleDatePresetChange('all')}
              className="h-7 px-2 text-[11px]"
            >
              All Time
            </Button>
          </div>

          {/* Branch Filter */}
          <NativeSelect
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="h-7 text-xs font-mono w-44"
          >
            <NativeSelectOption value="all">All Branches (Consolidated)</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.code} - {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {/* Date range inputs */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setDatePreset('month')
              }}
              className="h-7 w-28 text-[11px]"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setDatePreset('month')
              }}
              className="h-7 w-28 text-[11px]"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch()
              toast.info('Recalculating accounting metrics…')
            }}
            disabled={isFetching}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. ACTIONABLE ALERTS & MAKER-CHECKER WORKFLOW BANNER                */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Double-Entry Integrity Status */}
        <div
          className={`flex items-center justify-between p-3 rounded-lg border ${
            isBalanced
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-rose-500/30 bg-rose-500/5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-md ${
                isBalanced
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-destructive'
              }`}
            >
              {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Double-Entry Balance
              </span>
              <span className="text-xs font-bold text-foreground">
                {isBalanced ? 'Balanced (Zero Variance)' : `Variance: ${csvRupees(alerts?.variance || 0)}`}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab?.('reconciliation')}
            className="h-7 px-2 text-[10px]"
          >
            Audit
            <ArrowRight className="h-2.5 w-2.5 ml-1" />
          </Button>
        </div>

        {/* Pending Vouchers Approval */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Pending Vouchers
              </span>
              <span className="text-xs font-bold font-mono text-foreground">
                {pendingApprovals?.pendingVouchersCount || 0} Draft Vouchers
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab?.('vouchers')}
            className="h-7 px-2 text-[10px]"
          >
            Review
            <ArrowRight className="h-2.5 w-2.5 ml-1" />
          </Button>
        </div>

        {/* Pending Expense Claims */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Expense Claims
              </span>
              <span className="text-xs font-bold font-mono text-foreground">
                {pendingApprovals?.pendingExpensesCount || 0} Submitted
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab?.('expenses')}
            className="h-7 px-2 text-[10px]"
          >
            Approve
            <ArrowRight className="h-2.5 w-2.5 ml-1" />
          </Button>
        </div>

        {/* Bank Reconciliation Alerts */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Bank Reconciliation
              </span>
              <span className="text-xs font-bold font-mono text-foreground">
                {alerts?.unmatchedBankTransactions || 0} Unmatched Lines
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab?.('bank-cash')}
            className="h-7 px-2 text-[10px]"
          >
            Match
            <ArrowRight className="h-2.5 w-2.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. 16 FINANCIAL KPIS (STRUCTURED ERP GRID)                           */}
      {/* ==================================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Financial Balance & Liquidity KPIs
          </h3>
          <span className="text-[11px] font-mono text-muted-foreground">
            As of: {formatDualDate(toDate)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Total Assets
            </span>
            <div className="mt-1 text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
              <MoneyText paisa={kpis?.totalAssets || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Total Liabilities
            </span>
            <div className="mt-1 text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
              <MoneyText paisa={kpis?.totalLiabilities || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Owner Equity
            </span>
            <div className="mt-1 text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
              <MoneyText paisa={kpis?.ownerEquity || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Cash in Hand
            </span>
            <div className="mt-1 text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              <MoneyText paisa={kpis?.cashInHand || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Total Bank Balance
            </span>
            <div className="mt-1 text-lg font-bold font-mono text-primary">
              <MoneyText paisa={kpis?.totalBankBalance || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Accounts Receivable
            </span>
            <div className="mt-1 text-lg font-bold font-mono text-foreground">
              <MoneyText paisa={kpis?.accountsReceivable || 0} />
            </div>
          </Card>
        </div>

        {/* Working Capital & Sub-Ledger Dues */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Accounts Payable
            </span>
            <div className="mt-1 text-base font-bold font-mono text-rose-600">
              <MoneyText paisa={kpis?.accountsPayable || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Dealer Payable (2011)
            </span>
            <div className="mt-1 text-base font-bold font-mono text-amber-600">
              <MoneyText paisa={kpis?.dealerPayable || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Rider COD Cash (1012)
            </span>
            <div className="mt-1 text-base font-bold font-mono text-amber-600">
              <MoneyText paisa={kpis?.riderCodOutstanding || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Rider Salary Payable
            </span>
            <div className="mt-1 text-base font-bold font-mono text-indigo-600">
              <MoneyText paisa={kpis?.riderSalaryPayable || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Customer Dues (1041)
            </span>
            <div className="mt-1 text-base font-bold font-mono text-foreground">
              <MoneyText paisa={kpis?.customerOutstanding || 0} />
            </div>
          </Card>
        </div>

        {/* Operational P&L Performance */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Monthly Sales
            </span>
            <div className="mt-1 text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              <MoneyText paisa={kpis?.monthlySales || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              COGS / Purchases
            </span>
            <div className="mt-1 text-base font-bold font-mono text-amber-600">
              <MoneyText paisa={kpis?.monthlyPurchases || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
              Operating Expenses
            </span>
            <div className="mt-1 text-base font-bold font-mono text-rose-600">
              <MoneyText paisa={kpis?.monthlyExpenses || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                Gross Profit
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {kpis?.grossProfitMargin}
              </span>
            </div>
            <div className="mt-1 text-base font-bold font-mono text-blue-600">
              <MoneyText paisa={kpis?.grossProfit || 0} />
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                Net Profit
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {kpis?.netProfitMargin}
              </span>
            </div>
            <div className="mt-1 text-base font-bold font-mono text-primary">
              <MoneyText paisa={kpis?.netProfit || 0} />
            </div>
          </Card>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. DASHBOARD VISUALIZATIONS & TRENDS                                 */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Visual 1: Monthly Income vs Expenses Trend (6 Months) */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              6-Month Income vs Expenses Trend
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground">Past 6 Months</span>
          </div>

          <div className="space-y-3 pt-1">
            {monthlyTrends.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No historical transaction activity.</p>
            ) : (
              monthlyTrends.map((m) => {
                const incomePct = maxTrendAmount > 0 ? (m.income / maxTrendAmount) * 100 : 0
                const expPct = maxTrendAmount > 0 ? (m.expenses / maxTrendAmount) * 100 : 0
                return (
                  <div key={m.month} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-semibold text-foreground">{m.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-600">Inc: {csvRupees(m.income)}</span>
                        <span className="text-rose-600">Exp: {csvRupees(m.expenses)}</span>
                        <span className={`font-bold ${m.netProfit >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                          Net: {csvRupees(m.netProfit)}
                        </span>
                      </div>
                    </div>
                    {/* Visual Dual Bars */}
                    <div className="h-3 w-full rounded bg-muted/40 overflow-hidden flex gap-1">
                      <div
                        style={{ width: `${Math.min(100, Math.max(2, incomePct))}%` }}
                        className="h-full bg-emerald-500 rounded-sm"
                        title={`Income: ${csvRupees(m.income)}`}
                      />
                      <div
                        style={{ width: `${Math.min(100, Math.max(2, expPct))}%` }}
                        className="h-full bg-rose-500 rounded-sm"
                        title={`Expenses: ${csvRupees(m.expenses)}`}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Visual 2: Expense Breakdown by Category */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-rose-600" />
              Expense Distribution Breakdown
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground">Top Operational Drivers</span>
          </div>

          <div className="space-y-3 pt-1">
            {expenseBreakdown.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No posted expenses for this period.</p>
            ) : (
              expenseBreakdown.map((item) => (
                <div key={item.accountId} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      <span className="font-mono text-muted-foreground mr-1.5">{item.code}</span>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                      <span className="font-bold text-foreground">{csvRupees(item.amount)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded bg-muted/40 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                      className="h-full bg-rose-500 rounded"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Visual 3 & 4: Receivables & Payables Aging Buckets + Branch Profitability */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Aging Summary Card */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              Receivables & Payables Aging Summary
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab?.('financial-reports')}
              className="h-6 text-[10px]"
            >
              Full Aging Report
              <ArrowRight className="h-2.5 w-2.5 ml-1" />
            </Button>
          </div>

          <div className="space-y-2.5 pt-1">
            {agingSummary.map((b) => (
              <div key={b.bucket} className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-[11px] font-mono">
                  <span className="font-bold text-foreground">{b.bucket} Days</span>
                  <div className="flex items-center gap-3">
                    <span className="text-blue-600">AR: {csvRupees(b.receivableAmount)}</span>
                    <span className="text-rose-600">AP: {csvRupees(b.payableAmount)}</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded bg-muted/40 overflow-hidden flex gap-1">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (b.receivableAmount / (kpis?.accountsReceivable || 1)) * 100,
                      )}%`,
                    }}
                    className="h-full bg-blue-500 rounded-sm"
                  />
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (b.payableAmount / (kpis?.accountsPayable || 1)) * 100,
                      )}%`,
                    }}
                    className="h-full bg-rose-500 rounded-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Branch-wise Profitability Overview */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              Branch Profitability Performance
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab?.('branches')}
              className="h-6 text-[10px]"
            >
              Manage Branches
              <ArrowRight className="h-2.5 w-2.5 ml-1" />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border text-[11px]">
                  <TableHead className="font-bold">Branch</TableHead>
                  <TableHead className="text-right font-bold text-emerald-600">Revenue</TableHead>
                  <TableHead className="text-right font-bold text-rose-600">Expenses</TableHead>
                  <TableHead className="text-right font-bold text-primary">Net Profit</TableHead>
                  <TableHead className="text-right font-bold">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchProfitability.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                      No branch financial records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  branchProfitability.map((bp) => (
                    <TableRow key={bp.branchId} className="border-border text-xs">
                      <TableCell className="font-medium">
                        <span className="font-mono text-primary mr-1">{bp.branchCode}</span>
                        {bp.branchName}
                      </TableCell>
                      <TableCell className="text-right font-mono">{csvRupees(bp.income)}</TableCell>
                      <TableCell className="text-right font-mono">{csvRupees(bp.expenses)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        {csvRupees(bp.netProfit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{bp.margin}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. DEALER & RIDER OUTSTANDING DISTRIBUTIONS                          */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Outstanding Dealers */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-600" />
              Top Outstanding Dealer Payables
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={onDealerSettlement}
              className="h-6 text-[10px]"
            >
              Batch Settle
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            {dealerDistribution.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">No unsettled dealer payables.</p>
            ) : (
              dealerDistribution.map((d) => (
                <div key={d.dealerId} className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <div>
                    <span className="font-semibold text-foreground">{d.dealerName}</span>
                    <span className="block text-[10px] font-mono text-muted-foreground">{d.dealerCode}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-amber-600 block">{csvRupees(d.outstandingPayable)}</span>
                    <button
                      onClick={() => onNavigateTab?.('dealer-ledger')}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      View Ledger
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Rider Cash & Commission Distribution */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              Rider Undeposited COD Cash & Payables
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={onCashHandover}
              className="h-6 text-[10px]"
            >
              Handover Cash
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            {riderDistribution.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">All rider COD cash reconciled.</p>
            ) : (
              riderDistribution.map((r) => (
                <div key={r.riderId} className="flex justify-between items-center py-1.5 border-b border-border/40">
                  <div>
                    <span className="font-semibold text-foreground">{r.riderName}</span>
                    <span className="block text-[10px] font-mono text-muted-foreground">
                      Comm Payable: {csvRupees(r.commissionPayable)}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-emerald-600 block">
                      COD: {csvRupees(r.undepositedCod)}
                    </span>
                    <button
                      onClick={() => onNavigateTab?.('rider-ledger')}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      View Ledger
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. ERP QUICK ACTION HUB                                              */}
      {/* ==================================================================== */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Accounting Operations Quick Actions
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Post vouchers, collect rider cash, batch settle dealers, disburse expenses, or launch financial statements.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab?.('vouchers')}
            className="h-7 gap-1 text-xs"
          >
            <Receipt className="h-3 w-3" />
            Voucher Register
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={onPostVoucher}
          >
            <span className="flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-primary" />
              Post Journal Voucher
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={onCashHandover}
          >
            <span className="flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-amber-500" />
              Record Cash Handover
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={onDealerSettlement}
          >
            <span className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-blue-500" />
              Dealer Batch Settlement
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={onRiderPayroll}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-emerald-500" />
              Run Rider Payroll
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('bank-cash')}
          >
            <span className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-blue-500" />
              Bank & Cash Accounts
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('expenses')}
          >
            <span className="flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-rose-500" />
              Expense Claims & TDS
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('financial-reports')}
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5 text-purple-500" />
              Financial Statements (TB/PL/BS)
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('export-center')}
          >
            <span className="flex items-center gap-2">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Export Center (CSV / Reports)
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 7. RECENT TRANSACTIONS REGISTER                                      */}
      {/* ==================================================================== */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Recent Posted Journal Entries
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab?.('transactions')}
            className="h-7 gap-1 text-xs"
          >
            View all transactions
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredRecent}
          searchValue={recentSearch}
          onSearchChange={setRecentSearch}
          searchPlaceholder="Search recent voucher, narration or reference…"
          actionSlot={
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportRecent}
              disabled={filteredRecent.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          }
          emptyMessage="No recent journal entries match the current search."
          dense
          onRowClick={(entry) => openVoucher(entry.id)}
          initialSorting={[{ id: 'postingDate', desc: true }]}
          footerSlot={
            filteredRecent.length > 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={3} className="px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Showing {filteredRecent.length} recent journal entries
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={recentDebit}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <MoneyText
                    paisa={recentCredit}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400"
                  />
                </TableCell>
                <TableCell />
              </TableRow>
            ) : null
          }
        />
      </div>

      {voucherDialog}
    </div>
  )
}
