import { useState, useMemo } from 'react'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { EmptyState } from '#/components/shared/empty-state'
import {
  Building2,
  CheckCircle2,
  Download,
  Printer,
  Search,
  TrendingUp,
  Wallet,
  Store,
  Coins,
  ArrowRight,
  AlertCircle,
  Scale,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AccountWithBalance } from '#/server/finance/finance.queries'

export interface FinancialReportsTabProps {
  chartOfAccounts: AccountWithBalance[]
  onDrillDown: (accountIdOrCode: string) => void
  settings: {
    legalName?: string
    address?: string
    pan?: string
  }
  fiscalYearName?: string
}

export function FinancialReportsTab({
  chartOfAccounts,
  onDrillDown,
  settings,
  fiscalYearName = '2083/84',
}: FinancialReportsTabProps) {
  const [reportSubTab, setReportSubTab] = useState<
    'trial-balance' | 'profit-and-loss' | 'balance-sheet'
  >('trial-balance')

  // Trial Balance search & filter
  const [tbSearch, setTbSearch] = useState('')
  const [tbRootFilter, setTbRootFilter] = useState('all')

  // ----------------------------------------------------
  // 1. TRIAL BALANCE CALCULATIONS
  // ----------------------------------------------------
  const nonGroupAccounts = useMemo(() => {
    return chartOfAccounts.filter((a) => !a.isGroup)
  }, [chartOfAccounts])

  const totalTbDebit = useMemo(() => {
    return nonGroupAccounts.reduce((sum, a) => sum + (a.totalDebit || 0), 0)
  }, [nonGroupAccounts])

  const totalTbCredit = useMemo(() => {
    return nonGroupAccounts.reduce((sum, a) => sum + (a.totalCredit || 0), 0)
  }, [nonGroupAccounts])

  const tbVariance = Math.abs(totalTbDebit - totalTbCredit)
  const isTbBalanced = tbVariance === 0

  const filteredTbAccounts = useMemo(() => {
    return nonGroupAccounts.filter((acc) => {
      if (tbRootFilter !== 'all' && acc.rootType !== tbRootFilter) return false
      if (tbSearch.trim()) {
        const q = tbSearch.toLowerCase()
        return (
          acc.code.toLowerCase().includes(q) ||
          acc.name.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [nonGroupAccounts, tbRootFilter, tbSearch])

  // ----------------------------------------------------
  // 2. PROFIT & LOSS CALCULATIONS
  // ----------------------------------------------------
  // Income accounts (rootType === 'income')
  const incomeAccounts = useMemo(() => {
    return nonGroupAccounts.filter((a) => a.rootType === 'income')
  }, [nonGroupAccounts])

  const totalIncome = useMemo(() => {
    // Normal balance for income is Credit - Debit
    return incomeAccounts.reduce(
      (sum, a) => sum + Math.max(0, a.totalCredit - a.totalDebit),
      0,
    )
  }, [incomeAccounts])

  // Expense accounts (rootType === 'expense')
  const expenseAccounts = useMemo(() => {
    return nonGroupAccounts.filter((a) => a.rootType === 'expense')
  }, [nonGroupAccounts])

  // Split into COGS (501x) vs Operating Expenses (502x, 503x, 504x, etc.)
  const cogsAccounts = useMemo(() => {
    return expenseAccounts.filter((a) => a.code.startsWith('501'))
  }, [expenseAccounts])

  const totalCogs = useMemo(() => {
    return cogsAccounts.reduce(
      (sum, a) => sum + Math.max(0, a.totalDebit - a.totalCredit),
      0,
    )
  }, [cogsAccounts])

  const grossProfit = totalIncome - totalCogs
  const grossMarginPct =
    totalIncome > 0 ? ((grossProfit / totalIncome) * 100).toFixed(1) : '0.0'

  const operatingExpenseAccounts = useMemo(() => {
    return expenseAccounts.filter((a) => !a.code.startsWith('501'))
  }, [expenseAccounts])

  const totalOperatingExpenses = useMemo(() => {
    return operatingExpenseAccounts.reduce(
      (sum, a) => sum + Math.max(0, a.totalDebit - a.totalCredit),
      0,
    )
  }, [operatingExpenseAccounts])

  const netOperatingProfit = grossProfit - totalOperatingExpenses
  const netMarginPct =
    totalIncome > 0
      ? ((netOperatingProfit / totalIncome) * 100).toFixed(1)
      : '0.0'

  // ----------------------------------------------------
  // 3. BALANCE SHEET CALCULATIONS
  // ----------------------------------------------------
  const assetAccounts = useMemo(() => {
    return nonGroupAccounts.filter((a) => a.rootType === 'asset')
  }, [nonGroupAccounts])

  const totalAssets = useMemo(() => {
    return assetAccounts.reduce(
      (sum, a) => sum + (a.totalDebit - a.totalCredit),
      0,
    )
  }, [assetAccounts])

  const liabilityAccounts = useMemo(() => {
    return nonGroupAccounts.filter((a) => a.rootType === 'liability')
  }, [nonGroupAccounts])

  const totalLiabilities = useMemo(() => {
    return liabilityAccounts.reduce(
      (sum, a) => sum + (a.totalCredit - a.totalDebit),
      0,
    )
  }, [liabilityAccounts])

  const equityAccounts = useMemo(() => {
    return nonGroupAccounts.filter((a) => a.rootType === 'equity')
  }, [nonGroupAccounts])

  const baseEquity = useMemo(() => {
    return equityAccounts.reduce(
      (sum, a) => sum + (a.totalCredit - a.totalDebit),
      0,
    )
  }, [equityAccounts])

  // In ERPNext double-entry, Equity includes Retained/Current Net Profit
  const totalEquity = baseEquity + netOperatingProfit
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
  const balanceSheetVariance = Math.abs(totalAssets - totalLiabilitiesAndEquity)
  const isBalanceSheetBalanced = balanceSheetVariance === 0

  // ----------------------------------------------------
  // EXPORTS & ACTIONS
  // ----------------------------------------------------
  const handleExportTrialBalanceCSV = () => {
    const headers =
      'Account Code,Account Name,Root Type,Debit Total (NPR),Credit Total (NPR),Net Balance (NPR)\n'
    const rows = filteredTbAccounts
      .map(
        (a) =>
          `"${a.code}","${a.name.replace(/"/g, '""')}","${a.rootType}",${(a.totalDebit / 100).toFixed(2)},${(a.totalCredit / 100).toFixed(2)},${(a.netBalance / 100).toFixed(2)}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `trial-balance-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    toast.success('Trial Balance exported to CSV')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Sub-report selector tabs & Actions toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={reportSubTab}
          onValueChange={(val) => setReportSubTab(val as any)}
        >
          <TabsList className="h-9">
            <TabsTrigger
              value="trial-balance"
              className="flex items-center gap-2 text-xs font-medium"
            >
              <Scale className="h-3.5 w-3.5 text-primary" />
              <span>Trial Balance</span>
              {isTbBalanced ? (
                <span className="ml-1 inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Balanced
                </span>
              ) : (
                <span className="ml-1 inline-flex items-center rounded-full bg-rose-500/10 px-1.5 py-0.2 text-xs font-semibold text-destructive">
                  Variance
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="profit-and-loss"
              className="flex items-center gap-2 text-xs font-medium"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Profit & Loss</span>
              <span className="ml-1 text-xs text-muted-foreground font-mono">
                {formatNPR(netOperatingProfit)}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="balance-sheet"
              className="flex items-center gap-2 text-xs font-medium"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Balance Sheet</span>
              <span className="ml-1 text-xs text-muted-foreground font-mono">
                {formatNPR(totalAssets)}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
          >
            FY {fiscalYearName}
          </Badge>
          {reportSubTab === 'trial-balance' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTrialBalanceCSV}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Statement
          </Button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. TRIAL BALANCE VIEW                                */}
      {/* ==================================================== */}
      {reportSubTab === 'trial-balance' && (
        <div className="space-y-4">
          {/* Trial Balance Health & Validation Bar */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border ${
              isTbBalanced
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-rose-500/30 bg-rose-500/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isTbBalanced
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-destructive'
                }`}
              >
                {isTbBalanced ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  {isTbBalanced
                    ? 'Double-Entry Trial Balance is Perfectly Balanced'
                    : 'Variance Detected in Trial Balance!'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isTbBalanced
                    ? `Total debits exactly equal total credits across all ${nonGroupAccounts.length} active ledger accounts.`
                    : `Debits differ from credits by ${formatNPR(tbVariance)}. Review posted manual vouchers.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="rounded-lg bg-card border border-border px-3 py-1.5">
                <span className="text-xs uppercase text-muted-foreground block font-sans">
                  Total Debits (Dr)
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNPR(totalTbDebit)}
                </span>
              </div>
              <div className="rounded-lg bg-card border border-border px-3 py-1.5">
                <span className="text-xs uppercase text-muted-foreground block font-sans">
                  Total Credits (Cr)
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {formatNPR(totalTbCredit)}
                </span>
              </div>
              <div className="rounded-lg bg-card border border-border px-3 py-1.5">
                <span className="text-xs uppercase text-muted-foreground block font-sans">
                  Variance
                </span>
                <span
                  className={`font-bold ${
                    isTbBalanced ? 'text-foreground' : 'text-destructive'
                  }`}
                >
                  {formatNPR(tbVariance)}
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search account code (e.g. 1011) or name..."
                value={tbSearch}
                onChange={(e) => setTbSearch(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <NativeSelect
                value={tbRootFilter}
                onChange={(e) => setTbRootFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs font-mono"
              >
                <NativeSelectOption value="all">
                  All Root Types ({nonGroupAccounts.length})
                </NativeSelectOption>
                <NativeSelectOption value="asset">
                  Assets (1000s)
                </NativeSelectOption>
                <NativeSelectOption value="liability">
                  Liabilities (2000s)
                </NativeSelectOption>
                <NativeSelectOption value="equity">
                  Equity (3000s)
                </NativeSelectOption>
                <NativeSelectOption value="income">
                  Income (4000s)
                </NativeSelectOption>
                <NativeSelectOption value="expense">
                  Expense (5000s)
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs w-[110px]">
                    Account Code
                  </TableHead>
                  <TableHead className="text-xs">
                    Account Title & Ledger
                  </TableHead>
                  <TableHead className="text-xs">Root Type</TableHead>
                  <TableHead className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                    Debit Total (Dr)
                  </TableHead>
                  <TableHead className="text-right text-xs text-blue-600 dark:text-blue-400">
                    Credit Total (Cr)
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Closing Balance
                  </TableHead>
                  <TableHead className="text-right text-xs w-[100px]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTbAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        title="No accounts match filter"
                        description="Try adjusting your search or category filter."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTbAccounts.map((acc) => {
                    const isDebitNormal =
                      acc.rootType === 'asset' || acc.rootType === 'expense'
                    return (
                      <TableRow key={acc.id} className="hover:bg-muted/20">
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-foreground">
                            {acc.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-foreground font-medium">
                            {acc.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs capitalize ${
                              acc.rootType === 'asset'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : acc.rootType === 'liability'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : acc.rootType === 'income'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : acc.rootType === 'expense'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {acc.rootType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {acc.totalDebit > 0 ? formatNPR(acc.totalDebit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                          {acc.totalCredit > 0
                            ? formatNPR(acc.totalCredit)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          <span
                            className={
                              acc.netBalance > 0
                                ? isDebitNormal
                                  ? 'text-primary'
                                  : 'text-emerald-600 dark:text-emerald-400'
                                : acc.netBalance < 0
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                            }
                          >
                            {formatNPR(acc.netBalance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDrillDown(acc.id)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            title="Drill down into General Ledger"
                          >
                            <span>Ledger</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}

                {/* Total Summary Footer */}
                <TableRow className="bg-muted/40 font-bold border-t-2 border-border">
                  <TableCell
                    colSpan={3}
                    className="text-xs uppercase text-foreground"
                  >
                    Total Trial Balance (Sum Dr & Sum Cr)
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {formatNPR(totalTbDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                    {formatNPR(totalTbCredit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                    {isTbBalanced ? 'Balanced (0.00)' : formatNPR(tbVariance)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. PROFIT & LOSS VIEW                                */}
      {/* ==================================================== */}
      {reportSubTab === 'profit-and-loss' && (
        <div className="space-y-5">
          {/* Company & Period Header */}
          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  {settings.legalName || 'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {settings.address ||
                    'Butwal-Tilottama Corridor, Lumbini Province, Nepal'}
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  PAN/VAT: {settings.pan || '609823415'}
                </p>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-xs font-semibold text-foreground uppercase block">
                  Income Statement (Profit & Loss)
                </span>
                <span className="text-xs text-muted-foreground">
                  Fiscal Year: {fiscalYearName} · As of Today
                </span>
              </div>
            </div>

            {/* P&L Statement Structure */}
            <div className="mt-4 space-y-6 text-xs">
              {/* Section 1: Operating Income */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-bold text-foreground text-xs uppercase tracking-wider">
                  <span>1. Operating Revenue & Income</span>
                  <span>Amount (NPR)</span>
                </div>
                {incomeAccounts.length === 0 ? (
                  <p className="py-2 text-muted-foreground italic">
                    No income postings recorded in this period.
                  </p>
                ) : (
                  incomeAccounts.map((acc) => {
                    const balance = Math.max(
                      0,
                      acc.totalCredit - acc.totalDebit,
                    )
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between py-1 text-muted-foreground hover:text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{acc.code}</span>
                          <span>{acc.name}</span>
                        </div>
                        <span className="font-mono text-foreground font-medium">
                          {formatNPR(balance)}
                        </span>
                      </div>
                    )
                  })
                )}
                <div className="flex items-center justify-between py-2 border-t border-border font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2 rounded">
                  <span>Total Operating Revenue:</span>
                  <span className="font-mono text-sm font-bold">
                    {formatNPR(totalIncome)}
                  </span>
                </div>
              </div>

              {/* Section 2: Cost of Goods Sold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-bold text-foreground text-xs uppercase tracking-wider">
                  <span>2. Cost of Goods Sold (Dealer Restock / COGS)</span>
                  <span>Amount (NPR)</span>
                </div>
                {cogsAccounts.length === 0 ? (
                  <p className="py-2 text-muted-foreground italic">
                    No dealer cost postings recorded.
                  </p>
                ) : (
                  cogsAccounts.map((acc) => {
                    const balance = Math.max(
                      0,
                      acc.totalDebit - acc.totalCredit,
                    )
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between py-1 text-muted-foreground hover:text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{acc.code}</span>
                          <span>{acc.name}</span>
                        </div>
                        <span className="font-mono text-destructive">
                          -{formatNPR(balance)}
                        </span>
                      </div>
                    )
                  })
                )}
                <div className="flex items-center justify-between py-2 border-t border-border font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/5 px-2 rounded">
                  <span>Total Cost of Goods Sold:</span>
                  <span className="font-mono text-sm font-bold">
                    -{formatNPR(totalCogs)}
                  </span>
                </div>
              </div>

              {/* Gross Margin Milestone */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 font-bold text-foreground">
                <div>
                  <span className="text-xs uppercase tracking-wider block">
                    Gross Operating Margin
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Gross Margin Rate: {grossMarginPct}% of Revenue
                  </span>
                </div>
                <span className="font-mono text-base text-primary">
                  {formatNPR(grossProfit)}
                </span>
              </div>

              {/* Section 3: Operating Expenses */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-bold text-foreground text-xs uppercase tracking-wider">
                  <span>3. Operating Overhead, Logistics & Admin Expenses</span>
                  <span>Amount (NPR)</span>
                </div>
                {operatingExpenseAccounts.length === 0 ? (
                  <p className="py-2 text-muted-foreground italic">
                    No operating expense accounts found.
                  </p>
                ) : (
                  operatingExpenseAccounts.map((acc) => {
                    const balance = Math.max(
                      0,
                      acc.totalDebit - acc.totalCredit,
                    )
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between py-1 text-muted-foreground hover:text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{acc.code}</span>
                          <span>{acc.name}</span>
                        </div>
                        <span className="font-mono text-destructive">
                          -{formatNPR(balance)}
                        </span>
                      </div>
                    )
                  })
                )}
                <div className="flex items-center justify-between py-2 border-t border-border font-semibold text-destructive bg-rose-500/5 px-2 rounded">
                  <span>Total Operating Expenses:</span>
                  <span className="font-mono text-sm font-bold">
                    -{formatNPR(totalOperatingExpenses)}
                  </span>
                </div>
              </div>

              {/* Net Operating Profit Bottomline */}
              <div
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  netOperatingProfit >= 0
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                <div>
                  <span className="text-xs uppercase font-bold text-foreground block">
                    Net Realized Operating Profit / (Loss)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Net Margin: {netMarginPct}% after all supplier costs &
                    overhead
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono text-lg font-bold ${
                      netOperatingProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive'
                    }`}
                  >
                    {formatNPR(netOperatingProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. BALANCE SHEET VIEW                                */}
      {/* ==================================================== */}
      {reportSubTab === 'balance-sheet' && (
        <div className="space-y-5">
          {/* Balance Sheet Verification Banner */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border ${
              isBalanceSheetBalanced
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-rose-500/30 bg-rose-500/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isBalanceSheetBalanced
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-destructive'
                }`}
              >
                {isBalanceSheetBalanced ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  {isBalanceSheetBalanced
                    ? 'Accounting Equation Balanced: Assets = Liabilities + Equity'
                    : 'Balance Sheet Out of Balance!'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isBalanceSheetBalanced
                    ? 'Fundamental double-entry balance satisfied with zero variance.'
                    : `Discrepancy of ${formatNPR(balanceSheetVariance)}. Verify period journal entries.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="rounded-lg bg-card border border-border px-3 py-1.5">
                <span className="text-xs uppercase text-muted-foreground block font-sans">
                  Total Assets
                </span>
                <span className="font-bold text-primary">
                  {formatNPR(totalAssets)}
                </span>
              </div>
              <div className="rounded-lg bg-card border border-border px-3 py-1.5">
                <span className="text-xs uppercase text-muted-foreground block font-sans">
                  Liabilities + Equity
                </span>
                <span className="font-bold text-foreground">
                  {formatNPR(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Columns: Assets vs Liabilities & Equity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ASSETS COLUMN */}
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase text-foreground">
                    Assets (1000s)
                  </h4>
                </div>
                <span className="font-mono text-xs font-bold text-primary">
                  {formatNPR(totalAssets)}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {assetAccounts.map((acc) => {
                  const balance = acc.totalDebit - acc.totalCredit
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between py-1.5 border-b border-border/30 text-muted-foreground hover:text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {acc.code}
                        </span>
                        <span>{acc.name}</span>
                      </div>
                      <span className="font-mono font-medium text-foreground">
                        {formatNPR(balance)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="pt-2 flex items-center justify-between border-t-2 border-border font-bold text-foreground">
                <span className="text-xs uppercase">Total Assets</span>
                <span className="font-mono text-sm text-primary">
                  {formatNPR(totalAssets)}
                </span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY COLUMN */}
            <div className="space-y-5 rounded-xl border border-border bg-card p-4">
              {/* Liabilities */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-amber-500" />
                    <h4 className="text-xs font-bold uppercase text-foreground">
                      Liabilities (2000s)
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    {formatNPR(totalLiabilities)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {liabilityAccounts.map((acc) => {
                    const balance = acc.totalCredit - acc.totalDebit
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between py-1.5 border-b border-border/30 text-muted-foreground hover:text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {acc.code}
                          </span>
                          <span>{acc.name}</span>
                        </div>
                        <span className="font-mono font-medium text-foreground">
                          {formatNPR(balance)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Equity */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-xs font-bold uppercase text-foreground">
                      Equity (3000s)
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {formatNPR(totalEquity)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {equityAccounts.map((acc) => {
                    const balance = acc.totalCredit - acc.totalDebit
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between py-1.5 border-b border-border/30 text-muted-foreground hover:text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-foreground">
                            {acc.code}
                          </span>
                          <span>{acc.name}</span>
                        </div>
                        <span className="font-mono font-medium text-foreground">
                          {formatNPR(balance)}
                        </span>
                      </div>
                    )
                  })}

                  {/* Current Period Retained Profit from P&L */}
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-muted-foreground bg-muted/30 px-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-primary">
                        P&L
                      </span>
                      <span className="font-semibold text-foreground">
                        Current Period Realized Profit
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        netOperatingProfit >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      }`}
                    >
                      {formatNPR(netOperatingProfit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t-2 border-border font-bold text-foreground">
                <span className="text-xs uppercase">
                  Total Liabilities & Equity
                </span>
                <span className="font-mono text-sm text-foreground">
                  {formatNPR(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
