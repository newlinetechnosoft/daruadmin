import { useState, useMemo } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { formatNPR } from '#/lib/money'
import { formatDualDate } from '#/lib/nepal-date'
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
  AlertCircle,
  Scale,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AccountWithBalance } from '#/server/finance/finance.queries'

export interface FinancialReportsTabProps {
  chartOfAccounts?: AccountWithBalance[]
  onDrillDown: (accountIdOrCode: string) => void
  settings?: {
    legalName?: string
    address?: string
    pan?: string
  }
  fiscalYearName?: string
}

export function FinancialReportsTab({
  onDrillDown,
  settings = {
    legalName: 'Daru Gang Pvt Ltd',
    address: 'Kathmandu, Nepal',
    pan: '601234567',
  },
  fiscalYearName = '2083/84',
}: FinancialReportsTabProps) {
  // Sub-report tab state
  const [reportSubTab, setReportSubTab] = useState<
    | 'trial-balance'
    | 'profit-and-loss'
    | 'balance-sheet'
    | 'cash-flow'
    | 'day-book'
    | 'aging'
    | 'tax-summary'
    | 'integrity'
  >('trial-balance')

  // Global Filter States
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const defaultFyStart = useMemo(() => `${new Date().getFullYear()}-01-01`, [])

  const [fromDate, setFromDate] = useState(defaultFyStart)
  const [toDate, setToDate] = useState(todayStr)
  const [selectedBranchId, setSelectedBranchId] = useState('all')
  const [selectedCostCenter, setSelectedCostCenter] = useState('all')
  const [includeZeroAccounts, setIncludeZeroAccounts] = useState(false)

  // Report-specific filters
  const [tbSearch, setTbSearch] = useState('')
  const [tbRootFilter, setTbRootFilter] = useState('all')
  const [dayBookDate, setDayBookDate] = useState(todayStr)
  const [dayBookVoucherType, setDayBookVoucherType] = useState('all')
  const [agingType, setAgingType] = useState<'payable' | 'receivable'>('payable')

  // Company Branches Query
  const { data: branches = [] } = useSuspenseQuery(adminQueries.branches())

  // ==========================================================================
  // SERVER QUERIES FOR REPORTS
  // ==========================================================================

  // 1. Trial Balance Query
  const {
    data: tbData,
    isLoading: isTbLoading,
    refetch: refetchTb,
  } = useQuery(
    adminQueries.trialBalanceReport({
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
      costCenterId: selectedCostCenter !== 'all' ? selectedCostCenter : undefined,
      includeZero: includeZeroAccounts,
    }),
  )

  // 2. Profit & Loss Query
  const {
    data: pnlData,
    isLoading: isPnlLoading,
    refetch: refetchPnl,
  } = useQuery(
    adminQueries.profitLossReport({
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
    }),
  )

  // 3. Balance Sheet Query
  const {
    data: bsData,
    isLoading: isBsLoading,
    refetch: refetchBs,
  } = useQuery(
    adminQueries.balanceSheetReport({
      asOfDate: toDate ? new Date(toDate).toISOString() : undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
    }),
  )

  // 4. Cash Flow Statement Query
  const {
    data: cfData,
    isLoading: isCfLoading,
    refetch: refetchCf,
  } = useQuery(
    adminQueries.cashFlowReport({
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
    }),
  )

  // 5. Day Book Query
  const {
    data: dayBookData,
    isLoading: isDayBookLoading,
    refetch: refetchDayBook,
  } = useQuery(
    adminQueries.dayBookReport({
      date: dayBookDate ? new Date(dayBookDate).toISOString() : undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
      voucherType: dayBookVoucherType !== 'all' ? dayBookVoucherType : undefined,
    }),
  )

  // 6. Aging Report Query
  const {
    data: agingData,
    isLoading: isAgingLoading,
    refetch: refetchAging,
  } = useQuery(
    adminQueries.agingReport({
      type: agingType,
      asOfDate: toDate ? new Date(toDate).toISOString() : undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
    }),
  )

  // 7. Tax Summary Query
  const {
    data: taxData,
    isLoading: isTaxLoading,
    refetch: refetchTax,
  } = useQuery(
    adminQueries.taxSummaryReport({
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
    }),
  )

  // 8. Sub-Ledger Integrity Audit Query
  const {
    data: integrityData,
    isLoading: isIntegrityLoading,
    refetch: refetchIntegrity,
  } = useQuery(adminQueries.subledgerIntegrity())

  // Refetch active report
  const handleRefresh = async () => {
    toast.info('Recalculating report from posted General Ledger entries…')
    if (reportSubTab === 'trial-balance') await refetchTb()
    else if (reportSubTab === 'profit-and-loss') await refetchPnl()
    else if (reportSubTab === 'balance-sheet') await refetchBs()
    else if (reportSubTab === 'cash-flow') await refetchCf()
    else if (reportSubTab === 'day-book') await refetchDayBook()
    else if (reportSubTab === 'aging') await refetchAging()
    else if (reportSubTab === 'tax-summary') await refetchTax()
    else if (reportSubTab === 'integrity') await refetchIntegrity()
    toast.success('Report updated')
  }

  // Filtered Trial Balance Accounts
  const filteredTbAccounts = useMemo(() => {
    if (!tbData?.accounts) return []
    return tbData.accounts.filter((acc) => {
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
  }, [tbData?.accounts, tbRootFilter, tbSearch])

  // Margin percentages for P&L
  const grossProfitMargin = useMemo(() => {
    if (!pnlData?.totalIncome || pnlData.totalIncome <= 0) return '0.0%'
    return `${((pnlData.grossProfit / pnlData.totalIncome) * 100).toFixed(1)}%`
  }, [pnlData])

  const netProfitMargin = useMemo(() => {
    if (!pnlData?.totalIncome || pnlData.totalIncome <= 0) return '0.0%'
    return `${((pnlData.netProfit / pnlData.totalIncome) * 100).toFixed(1)}%`
  }, [pnlData])

  // ==========================================================================
  // EXPORT UTILITIES (CSV & PRINT)
  // ==========================================================================
  const handleExportCSV = () => {
    let headers = ''
    let rows = ''
    let filename = `report-${reportSubTab}-${todayStr}.csv`

    if (reportSubTab === 'trial-balance' && tbData) {
      headers = 'Account Code,Account Title,Root Type,Opening Dr (NPR),Opening Cr (NPR),Period Dr (NPR),Period Cr (NPR),Closing Dr (NPR),Closing Cr (NPR)\n'
      rows = filteredTbAccounts
        .map(
          (a) =>
            `"${a.code}","${a.name.replace(/"/g, '""')}","${a.rootType}",${(a.openingDebit / 100).toFixed(2)},${(a.openingCredit / 100).toFixed(2)},${(a.periodDebit / 100).toFixed(2)},${(a.periodCredit / 100).toFixed(2)},${(a.closingDebit / 100).toFixed(2)},${(a.closingCredit / 100).toFixed(2)}`,
        )
        .join('\n')
      filename = `trial-balance-${todayStr}.csv`
    } else if (reportSubTab === 'profit-and-loss' && pnlData) {
      headers = 'Category,Account Code,Account Title,Current Period (NPR),Previous Period (NPR)\n'
      const inc = pnlData.incomeRows.map(
        (r) => `"Income","${r.code}","${r.name.replace(/"/g, '""')}",${(r.currentPeriod / 100).toFixed(2)},${(r.previousPeriod / 100).toFixed(2)}`,
      )
      const cogs = pnlData.cogsRows.map(
        (r) => `"COGS","${r.code}","${r.name.replace(/"/g, '""')}",${(r.currentPeriod / 100).toFixed(2)},${(r.previousPeriod / 100).toFixed(2)}`,
      )
      const exp = pnlData.operatingExpenseRows.map(
        (r) => `"Operating Expense","${r.code}","${r.name.replace(/"/g, '""')}",${(r.currentPeriod / 100).toFixed(2)},${(r.previousPeriod / 100).toFixed(2)}`,
      )
      rows = [...inc, ...cogs, ...exp].join('\n')
      filename = `profit-and-loss-${todayStr}.csv`
    } else if (reportSubTab === 'balance-sheet' && bsData) {
      headers = 'Section,Account Code,Account Title,Balance (NPR)\n'
      const assets = bsData.assetRows.map(
        (r) => `"Asset","${r.code}","${r.name.replace(/"/g, '""')}",${(r.balance / 100).toFixed(2)}`,
      )
      const liab = bsData.liabilityRows.map(
        (r) => `"Liability","${r.code}","${r.name.replace(/"/g, '""')}",${(r.balance / 100).toFixed(2)}`,
      )
      const eq = bsData.equityRows.map(
        (r) => `"Equity","${r.code}","${r.name.replace(/"/g, '""')}",${(r.balance / 100).toFixed(2)}`,
      )
      rows = [...assets, ...liab, ...eq].join('\n')
      filename = `balance-sheet-${todayStr}.csv`
    } else if (reportSubTab === 'day-book' && dayBookData) {
      headers = 'Date,Voucher No,Voucher Type,Account Code,Account Title,Narration,Debit (NPR),Credit (NPR)\n'
      rows = dayBookData.lines
        .map(
          (l) =>
            `"${l.postingDate.slice(0, 10)}","${l.voucherNo}","${l.voucherType}","${l.accountCode}","${l.accountName.replace(/"/g, '""')}","${(l.narration || '').replace(/"/g, '""')}",${(l.debit / 100).toFixed(2)},${(l.credit / 100).toFixed(2)}`,
        )
        .join('\n')
      filename = `day-book-${dayBookDate}.csv`
    } else if (reportSubTab === 'aging' && agingData) {
      headers = 'Party Name,Party Type,0-30 Days (NPR),31-60 Days (NPR),61-90 Days (NPR),91+ Days (NPR),Total Outstanding (NPR)\n'
      rows = agingData.parties
        .map(
          (p) =>
            `"${p.partyName.replace(/"/g, '""')}","${p.partyType}",${(p.currentBalance / 100).toFixed(2)},${(p.days31to60 / 100).toFixed(2)},${(p.days61to90 / 100).toFixed(2)},${(p.daysOver90 / 100).toFixed(2)},${(p.totalOutstanding / 100).toFixed(2)}`,
        )
        .join('\n')
      filename = `aging-${agingType}-${todayStr}.csv`
    }

    if (!rows) {
      toast.error('No data available to export for this report')
      return
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    toast.success(`Exported ${filename}`)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* ==================================================================== */}
      {/* COMPANY LEGAL ENTITY HEADER / PRINT BANNER                           */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">{settings.legalName || 'Daru Gang Pvt Ltd'}</h2>
          <p className="text-xs text-muted-foreground">
            {settings.address || 'Kathmandu, Nepal'} • PAN: <span className="font-mono font-medium text-foreground">{settings.pan || '601234567'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono text-primary">
            FY {fiscalYearName}
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono">
            Period: {formatDualDate(fromDate)} – {formatDualDate(toDate)}
          </Badge>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. REPORT NAVIGATION & ACTION BAR                                    */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <Tabs
          value={reportSubTab}
          onValueChange={(val) => setReportSubTab(val as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9 flex flex-wrap max-w-full overflow-x-auto">
            <TabsTrigger value="trial-balance" className="flex items-center gap-1.5 text-xs">
              <Scale className="h-3.5 w-3.5 text-primary" />
              Trial Balance
            </TabsTrigger>

            <TabsTrigger value="profit-and-loss" className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Profit & Loss
            </TabsTrigger>

            <TabsTrigger value="balance-sheet" className="flex items-center gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              Balance Sheet
            </TabsTrigger>

            <TabsTrigger value="cash-flow" className="flex items-center gap-1.5 text-xs">
              <Wallet className="h-3.5 w-3.5 text-amber-600" />
              Cash Flow
            </TabsTrigger>

            <TabsTrigger value="day-book" className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-purple-600" />
              Day Book
            </TabsTrigger>

            <TabsTrigger value="aging" className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-rose-600" />
              Aging Analysis
            </TabsTrigger>

            <TabsTrigger value="tax-summary" className="flex items-center gap-1.5 text-xs">
              <Coins className="h-3.5 w-3.5 text-teal-600" />
              Tax & VAT
            </TabsTrigger>

            <TabsTrigger value="integrity" className="flex items-center gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              Audit Integrity
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-8 gap-1.5 text-xs"
            title="Refresh and recalculate report"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

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

      {/* ==================================================================== */}
      {/* 2. GLOBAL CONTROLS & FILTER BAR                                     */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted-foreground">Branch:</span>
            <NativeSelect
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-8 text-xs font-mono w-44"
            >
              <NativeSelectOption value="all">All Branches (Consolidated)</NativeSelectOption>
              {branches.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {/* Cost Center Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted-foreground">Cost Center:</span>
            <NativeSelect
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              className="h-8 text-xs font-mono w-36"
            >
              <NativeSelectOption value="all">All Centers</NativeSelectOption>
              <NativeSelectOption value="cc_operations">Operations</NativeSelectOption>
              <NativeSelectOption value="cc_logistics">Logistics</NativeSelectOption>
              <NativeSelectOption value="cc_sales">Sales</NativeSelectOption>
              <NativeSelectOption value="cc_admin">Administration</NativeSelectOption>
            </NativeSelect>
          </div>

          {/* Date Range: From / To */}
          {reportSubTab !== 'day-book' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">From:</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-32 text-xs font-mono"
              />
              <span className="font-semibold text-muted-foreground">To:</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-32 text-xs font-mono"
              />
            </div>
          )}

          {/* Day Book Date Picker */}
          {reportSubTab === 'day-book' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Day:</span>
              <Input
                type="date"
                value={dayBookDate}
                onChange={(e) => setDayBookDate(e.target.value)}
                className="h-8 w-36 text-xs font-mono"
              />
              <NativeSelect
                value={dayBookVoucherType}
                onChange={(e) => setDayBookVoucherType(e.target.value)}
                className="h-8 text-xs font-mono w-32"
              >
                <NativeSelectOption value="all">All Vouchers</NativeSelectOption>
                <NativeSelectOption value="JV">JV - Journal</NativeSelectOption>
                <NativeSelectOption value="PV">PV - Payment</NativeSelectOption>
                <NativeSelectOption value="RV">RV - Receipt</NativeSelectOption>
                <NativeSelectOption value="CV">CV - Contra</NativeSelectOption>
                <NativeSelectOption value="SV">SV - Sales</NativeSelectOption>
              </NativeSelect>
            </div>
          )}

          {/* Aging Type Selector */}
          {reportSubTab === 'aging' && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Aging Type:</span>
              <NativeSelect
                value={agingType}
                onChange={(e) => setAgingType(e.target.value as any)}
                className="h-8 text-xs font-mono w-44"
              >
                <NativeSelectOption value="payable">Accounts Payable (Dealers/Suppliers)</NativeSelectOption>
                <NativeSelectOption value="receivable">Accounts Receivable (Customers/Advances)</NativeSelectOption>
              </NativeSelect>
            </div>
          )}

          {/* Include Zero-Balance Accounts for Trial Balance */}
          {reportSubTab === 'trial-balance' && (
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground select-none text-xs">
              <input
                type="checkbox"
                checked={includeZeroAccounts}
                onChange={(e) => setIncludeZeroAccounts(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span>Include Zero</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-mono text-primary">
            FY {fiscalYearName}
          </Badge>
          <span className="text-[11px] text-muted-foreground font-mono">
            {formatDualDate(toDate)}
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. REPORT CONTENTS                                                   */}
      {/* ==================================================================== */}

      {/* --- A. TRIAL BALANCE --- */}
      {reportSubTab === 'trial-balance' && (
        <div className="space-y-3">
          {/* Health status banner */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-lg border ${
              tbData?.isBalanced
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-rose-500/30 bg-rose-500/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-md ${
                  tbData?.isBalanced
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-destructive'
                }`}
              >
                {tbData?.isBalanced ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold">
                  {tbData?.isBalanced
                    ? 'Double-Entry Trial Balance is Perfectly Balanced'
                    : 'Variance Detected in Trial Balance!'}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {tbData?.isBalanced
                    ? `Total closing debits exactly equal total closing credits across all active ledger accounts.`
                    : `Debits differ from credits by ${formatNPR(tbData?.variance || 0)}.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block font-sans">
                  Total Debit (Dr)
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNPR(tbData?.totalClosingDebit || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block font-sans">
                  Total Credit (Cr)
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {formatNPR(tbData?.totalClosingCredit || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block font-sans">
                  Variance
                </span>
                <span
                  className={`font-bold ${
                    tbData?.isBalanced ? 'text-foreground' : 'text-destructive'
                  }`}
                >
                  {formatNPR(tbData?.variance || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Search and root type filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search account code or name…"
                value={tbSearch}
                onChange={(e) => setTbSearch(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeZeroAccounts}
                  onChange={(e) => setIncludeZeroAccounts(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Show Zero-Balance Accounts
              </label>

              <NativeSelect
                value={tbRootFilter}
                onChange={(e) => setTbRootFilter(e.target.value)}
                className="h-8 text-xs font-mono w-36"
              >
                <NativeSelectOption value="all">All Root Types</NativeSelectOption>
                <NativeSelectOption value="asset">Assets (1000s)</NativeSelectOption>
                <NativeSelectOption value="liability">Liabilities (2000s)</NativeSelectOption>
                <NativeSelectOption value="equity">Equity (3000s)</NativeSelectOption>
                <NativeSelectOption value="income">Income (4000s)</NativeSelectOption>
                <NativeSelectOption value="expense">Expenses (5000s)</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 text-[11px]">
                  <TableHead className="w-24 font-bold">Code</TableHead>
                  <TableHead className="font-bold">Account Name</TableHead>
                  <TableHead className="w-24 font-bold">Type</TableHead>
                  <TableHead className="w-28 text-right font-bold text-muted-foreground">Opening Dr</TableHead>
                  <TableHead className="w-28 text-right font-bold text-muted-foreground">Opening Cr</TableHead>
                  <TableHead className="w-28 text-right font-bold text-emerald-600">Period Dr</TableHead>
                  <TableHead className="w-28 text-right font-bold text-blue-600">Period Cr</TableHead>
                  <TableHead className="w-32 text-right font-bold text-foreground">Closing Dr</TableHead>
                  <TableHead className="w-32 text-right font-bold text-foreground">Closing Cr</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isTbLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      Calculating Trial Balance from General Ledger…
                    </TableCell>
                  </TableRow>
                ) : filteredTbAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      No accounts found for selected filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTbAccounts.map((acc) => (
                    <TableRow key={acc.id} className="border-border text-xs hover:bg-muted/30">
                      <TableCell className="font-mono font-bold text-primary">
                        <button
                          onClick={() => onDrillDown(acc.id)}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {acc.code}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => onDrillDown(acc.id)}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {acc.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {acc.rootType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {acc.openingDebit > 0 ? formatNPR(acc.openingDebit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {acc.openingCredit > 0 ? formatNPR(acc.openingCredit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {acc.periodDebit > 0 ? formatNPR(acc.periodDebit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        {acc.periodCredit > 0 ? formatNPR(acc.periodCredit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {acc.closingDebit > 0 ? formatNPR(acc.closingDebit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {acc.closingCredit > 0 ? formatNPR(acc.closingCredit) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {tbData && (
                  <TableRow className="border-t-2 border-border bg-muted/50 font-bold text-xs">
                    <TableCell colSpan={3}>Grand Totals</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatNPR(tbData.totalOpeningDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatNPR(tbData.totalOpeningCredit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">
                      {formatNPR(tbData.totalPeriodDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-blue-600">
                      {formatNPR(tbData.totalPeriodCredit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {formatNPR(tbData.totalClosingDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-blue-700 dark:text-blue-400 font-bold">
                      {formatNPR(tbData.totalClosingCredit)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* --- B. PROFIT & LOSS STATEMENT --- */}
      {reportSubTab === 'profit-and-loss' &&
        (isPnlLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            Calculating Profit & Loss Statement from General Ledger…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Executive KPI Summary */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Total Revenue</span>
                <div className="mt-1 text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatNPR(pnlData?.totalIncome || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Cost of Goods Sold</span>
                <div className="mt-1 text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                  {formatNPR(pnlData?.totalCogs || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Gross Profit</span>
                  <span className="text-[10px] font-mono text-muted-foreground">Margin: {grossProfitMargin}</span>
                </div>
                <div className="mt-1 text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                  {formatNPR(pnlData?.grossProfit || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Net Profit</span>
                  <span className="text-[10px] font-mono text-muted-foreground">Margin: {netProfitMargin}</span>
                </div>
                <div className="mt-1 text-lg font-bold font-mono text-primary">
                  {formatNPR(pnlData?.netProfit || 0)}
                </div>
              </div>
            </div>

            {/* Breakdown Tables */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Revenue & COGS Card */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Revenue / Operating Income (4000s)
                  </h4>
                  <span className="font-mono text-xs font-bold text-emerald-600">
                    {formatNPR(pnlData?.totalIncome || 0)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {pnlData?.incomeRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-semibold">{formatNPR(r.currentPeriod)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-b border-border pt-4 pb-2">
                  <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
                    <Store className="h-4 w-4 text-amber-600" />
                    Cost of Goods Sold (5010s)
                  </h4>
                  <span className="font-mono text-xs font-bold text-amber-600">
                    {formatNPR(pnlData?.totalCogs || 0)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {pnlData?.cogsRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-semibold">{formatNPR(r.currentPeriod)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between border-t-2 border-border font-bold text-xs">
                  <span>Gross Trading Profit</span>
                  <span className="font-mono text-blue-600">{formatNPR(pnlData?.grossProfit || 0)}</span>
                </div>
              </div>

              {/* Operating Expenses Card */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-rose-600" />
                    Operating Expenses (5100s)
                  </h4>
                  <span className="font-mono text-xs font-bold text-rose-600">
                    {formatNPR(pnlData?.totalOperatingExpenses || 0)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {pnlData?.operatingExpenseRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-semibold">{formatNPR(r.currentPeriod)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-between border-t-2 border-border font-bold text-xs text-primary">
                  <span>Net Operational Profit (EBITDA)</span>
                  <span className="font-mono text-sm">{formatNPR(pnlData?.netProfit || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* --- C. BALANCE SHEET --- */}
      {reportSubTab === 'balance-sheet' &&
        (isBsLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            Generating Balance Sheet as of {toDate}…
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`flex items-center justify-between p-3.5 rounded-lg border ${
                bsData?.isBalanced
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-rose-500/30 bg-rose-500/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {bsData?.isBalanced ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-xs font-semibold">
                  {bsData?.isBalanced
                    ? 'Balance Sheet Equation Balanced: Assets = Liabilities + Equity'
                    : `Balance Sheet Variance: ${formatNPR(bsData?.variance || 0)}`}
                </span>
              </div>
              <span className="text-xs font-mono font-bold">
                {formatNPR(bsData?.totalAssets || 0)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Assets */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Assets (1000s)
                  </h4>
                  <span className="font-mono text-xs font-bold text-blue-600">
                    {formatNPR(bsData?.totalAssets || 0)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {bsData?.assetRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-semibold">{formatNPR(r.balance)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between border-t-2 border-border font-bold text-xs">
                  <span>Total Assets</span>
                  <span className="font-mono text-blue-600">{formatNPR(bsData?.totalAssets || 0)}</span>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
                    <Store className="h-4 w-4 text-amber-600" />
                    Liabilities (2000s)
                  </h4>
                  <span className="font-mono text-xs font-bold text-amber-600">
                    {formatNPR(bsData?.totalLiabilities || 0)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {bsData?.liabilityRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-semibold">{formatNPR(r.balance)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-b border-border pt-4 pb-2">
                  <h4 className="text-xs font-bold uppercase text-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-indigo-600" />
                    Equity & Retained Earnings (3000s)
                  </h4>
                  <span className="font-mono text-xs font-bold text-indigo-600">
                    {formatNPR((bsData?.totalEquity || 0) + (bsData?.currentYearProfit || 0))}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {bsData?.equityRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono">
                        {r.code} - {r.name}
                      </span>
                      <span className="font-mono font-semibold">{formatNPR(r.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 border-b border-border/30 bg-muted/30 px-2 rounded font-semibold">
                    <span>Current Period Retained Profit (from P&L)</span>
                    <span className="font-mono">{formatNPR(bsData?.currentYearProfit || 0)}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between border-t-2 border-border font-bold text-xs">
                  <span>Total Liabilities & Equity</span>
                  <span className="font-mono text-foreground">{formatNPR(bsData?.totalLiabilitiesAndEquity || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* --- D. CASH FLOW STATEMENT --- */}
      {reportSubTab === 'cash-flow' &&
        (isCfLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            Calculating Cash Flow Statement (Direct Method)…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Opening Cash & Bank</span>
                <div className="mt-1 text-lg font-bold font-mono">
                  {formatNPR(cfData?.openingCashAndBank || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Operating Inflows</span>
                <div className="mt-1 text-lg font-bold font-mono text-emerald-600">
                  +{formatNPR(cfData?.totalOperatingInflows || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Operating Outflows</span>
                <div className="mt-1 text-lg font-bold font-mono text-rose-600">
                  -{formatNPR(cfData?.totalOperatingOutflows || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Closing Cash & Bank</span>
                <div className="mt-1 text-lg font-bold font-mono text-primary">
                  {formatNPR(cfData?.closingCashAndBank || 0)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Inflows */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-2">
                <h4 className="text-xs font-bold uppercase text-emerald-600">
                  Cash Inflows from Operations
                </h4>
                <div className="space-y-1.5 text-xs">
                  {cfData?.operatingInflows.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">No cash inflows for this period.</p>
                  ) : (
                    cfData?.operatingInflows.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground truncate max-w-xs">{item.narration || item.name}</span>
                        <span className="font-mono font-semibold text-emerald-600">{formatNPR(item.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Outflows */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-2">
                <h4 className="text-xs font-bold uppercase text-rose-600">
                  Cash Outflows from Operations
                </h4>
                <div className="space-y-1.5 text-xs">
                  {cfData?.operatingOutflows.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">No cash disbursements for this period.</p>
                  ) : (
                    cfData?.operatingOutflows.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground truncate max-w-xs">{item.narration || item.name}</span>
                        <span className="font-mono font-semibold text-rose-600">{formatNPR(item.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* --- E. DAY BOOK --- */}
      {reportSubTab === 'day-book' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono rounded-lg border border-border bg-card p-3 shadow-sm">
            <span>
              Transactions on <strong>{dayBookDate}</strong>: {dayBookData?.voucherCount || 0} Vouchers
            </span>
            <div className="flex items-center gap-4">
              <span>Total Debit: <strong className="text-emerald-600">{formatNPR(dayBookData?.totalDebit || 0)}</strong></span>
              <span>Total Credit: <strong className="text-blue-600">{formatNPR(dayBookData?.totalCredit || 0)}</strong></span>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 text-[11px]">
                  <TableHead className="w-28 font-bold">Voucher No</TableHead>
                  <TableHead className="w-20 font-bold">Type</TableHead>
                  <TableHead className="w-28 font-bold">Account</TableHead>
                  <TableHead className="font-bold">Account Title</TableHead>
                  <TableHead className="font-bold">Narration</TableHead>
                  <TableHead className="w-28 text-right font-bold text-emerald-600">Debit (NPR)</TableHead>
                  <TableHead className="w-28 text-right font-bold text-blue-600">Credit (NPR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDayBookLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      Loading Day Book transactions…
                    </TableCell>
                  </TableRow>
                ) : dayBookData?.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No posted accounting transactions on {dayBookDate}.
                    </TableCell>
                  </TableRow>
                ) : (
                  dayBookData?.lines.map((l) => (
                    <TableRow key={l.id} className="border-border text-xs hover:bg-muted/30">
                      <TableCell className="font-mono font-bold text-primary">{l.voucherNo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">{l.voucherType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{l.accountCode}</TableCell>
                      <TableCell className="font-medium truncate max-w-xs">{l.accountName}</TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-sm">{l.narration || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {l.debit > 0 ? formatNPR(l.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {l.credit > 0 ? formatNPR(l.credit) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* --- F. AGING REPORT --- */}
      {reportSubTab === 'aging' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">0-30 Days (Current)</span>
              <div className="mt-1 text-base font-bold font-mono text-emerald-600">
                {formatNPR(agingData?.total0to30 || 0)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">31-60 Days</span>
              <div className="mt-1 text-base font-bold font-mono text-blue-600">
                {formatNPR(agingData?.total31to60 || 0)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">61-90 Days</span>
              <div className="mt-1 text-base font-bold font-mono text-amber-600">
                {formatNPR(agingData?.total61to90 || 0)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">Over 90 Days</span>
              <div className="mt-1 text-base font-bold font-mono text-rose-600">
                {formatNPR(agingData?.totalOver90 || 0)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">Total Outstanding</span>
              <div className="mt-1 text-base font-bold font-mono text-foreground">
                {formatNPR(agingData?.grandTotal || 0)}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 text-[11px]">
                  <TableHead className="font-bold">Party Name</TableHead>
                  <TableHead className="w-24 font-bold">Party Type</TableHead>
                  <TableHead className="w-28 text-right font-bold text-emerald-600">0-30 Days</TableHead>
                  <TableHead className="w-28 text-right font-bold text-blue-600">31-60 Days</TableHead>
                  <TableHead className="w-28 text-right font-bold text-amber-600">61-90 Days</TableHead>
                  <TableHead className="w-28 text-right font-bold text-rose-600">91+ Days</TableHead>
                  <TableHead className="w-32 text-right font-bold text-foreground">Total Dues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAgingLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      Calculating party aging buckets…
                    </TableCell>
                  </TableRow>
                ) : agingData?.parties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No outstanding {agingType} balances found.
                    </TableCell>
                  </TableRow>
                ) : (
                  agingData?.parties.map((p) => (
                    <TableRow key={p.partyId} className="border-border text-xs hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground">{p.partyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px]">{p.partyType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{p.currentBalance > 0 ? formatNPR(p.currentBalance) : '—'}</TableCell>
                      <TableCell className="text-right font-mono">{p.days31to60 > 0 ? formatNPR(p.days31to60) : '—'}</TableCell>
                      <TableCell className="text-right font-mono">{p.days61to90 > 0 ? formatNPR(p.days61to90) : '—'}</TableCell>
                      <TableCell className="text-right font-mono text-rose-600 font-semibold">{p.daysOver90 > 0 ? formatNPR(p.daysOver90) : '—'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatNPR(p.totalOutstanding)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* --- G. TAX & VAT RETURN --- */}
      {reportSubTab === 'tax-summary' &&
        (isTaxLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            Computing 13% VAT & TDS Tax Return summary…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">13% Output VAT Collected</span>
                <div className="mt-1 text-lg font-bold font-mono text-emerald-600">
                  {formatNPR(taxData?.vatOutputCollected || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">13% Input VAT Credit</span>
                <div className="mt-1 text-lg font-bold font-mono text-blue-600">
                  {formatNPR(taxData?.vatInputCredit || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Net VAT Payable to IRD</span>
                <div className="mt-1 text-lg font-bold font-mono text-primary">
                  {formatNPR(taxData?.netVatPayable || 0)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">TDS Withholding Tax Owed</span>
                <div className="mt-1 text-lg font-bold font-mono text-amber-600">
                  {formatNPR(taxData?.tdsPayableOwed || 0)}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-2 text-xs">
              <h4 className="font-bold text-foreground">Inland Revenue Department (IRD) Compliance Summary</h4>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Taxable Sales (Gross Base):</span>
                  <span className="font-mono font-semibold">{formatNPR(taxData?.taxableSales || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Output VAT Liability (13% on Sales):</span>
                  <span className="font-mono font-semibold text-emerald-600">{formatNPR(taxData?.vatOutputCollected || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Input VAT Credit (13% on Tax Invoices):</span>
                  <span className="font-mono font-semibold text-blue-600">-{formatNPR(taxData?.vatInputCredit || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30 font-bold text-foreground">
                  <span>Net VAT Dues Payable:</span>
                  <span className="font-mono">{formatNPR(taxData?.netVatPayable || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30 font-bold text-amber-600">
                  <span>TDS Withholding Payable (Income Tax Act §87/§88):</span>
                  <span className="font-mono">{formatNPR(taxData?.tdsPayableOwed || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* --- H. SUB-LEDGER INTEGRITY AUDIT --- */}
      {reportSubTab === 'integrity' &&
        (isIntegrityLoading ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            Running Double-Entry & Sub-Ledger Verification Audit…
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={`flex items-center justify-between p-3.5 rounded-lg border ${
                integrityData?.auditPassed
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-rose-500/30 bg-rose-500/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {integrityData?.auditPassed ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <h4 className="text-xs font-semibold">
                    {integrityData?.auditPassed
                      ? 'Sub-Ledger & Double-Entry Integrity Audit Passed'
                      : 'Integrity Discrepancy Found in Accounting Ledgers'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Global Debits ({formatNPR(integrityData?.totalGlobalDebit || 0)}) === Global Credits ({formatNPR(integrityData?.totalGlobalCredit || 0)}).
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 text-[11px]">
                    <TableHead className="font-bold">Control Account</TableHead>
                    <TableHead className="w-28 text-right font-bold">Control GL Balance</TableHead>
                    <TableHead className="w-28 text-right font-bold">Sum of Sub-Ledgers</TableHead>
                    <TableHead className="w-24 text-right font-bold">Difference</TableHead>
                    <TableHead className="w-24 text-center font-bold">Parties</TableHead>
                    <TableHead className="w-28 text-center font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrityData?.subLedgers.map((s) => (
                    <TableRow key={s.controlAccountCode} className="border-border text-xs">
                      <TableCell className="font-semibold">
                        <span className="font-mono text-primary mr-1.5">{s.controlAccountCode}</span>
                        {s.controlAccountName}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatNPR(s.controlAccountBalance)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNPR(s.sumOfPartyBalances)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNPR(s.difference)}</TableCell>
                      <TableCell className="text-center font-mono">{s.partyCount}</TableCell>
                      <TableCell className="text-center">
                        {s.isReconciled ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
                            Reconciled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-500/40 text-destructive text-[10px]">
                            Discrepancy
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
    </div>
  )
}
