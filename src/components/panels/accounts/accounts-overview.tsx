import { useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { TableCell, TableRow } from '#/components/ui/table'
import { useVoucherDialog } from './use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from './export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  FileSpreadsheet,
  Receipt,
  Store,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import type { AccountsTab } from './accounts-route'
import type { DetailedJournalEntry } from '#/server/finance/finance.queries'

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
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const { openVoucher, voucherDialog } = useVoucherDialog()

  const [recentSearch, setRecentSearch] = useState('')
  const debouncedRecentSearch = useDebouncedValue(recentSearch, 200)

  const journalEntries = ledgerData.ops.journalEntries
  const dealerPayables = ledgerData.ops.dealerPayables
  const riderAccounts = ledgerData.ops.riderAccounts
  const payments = ledgerData.ops.payments
  const orders = ledgerData.ops.orders
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const leafAccounts = chartOfAccounts.filter((account) => !account.isGroup)
  const totalPostedDebit = leafAccounts.reduce(
    (sum, account) => sum + account.totalDebit,
    0,
  )
  const totalPostedCredit = leafAccounts.reduce(
    (sum, account) => sum + account.totalCredit,
    0,
  )
  const trialBalanceVariance = totalPostedDebit - totalPostedCredit

  const totalOutstandingDealer = dealerPayables.reduce(
    (sum, dealer) => sum + dealer.outstandingPayable,
    0,
  )
  const totalCommissionPayable = riderAccounts.reduce(
    (sum, rider) => sum + rider.commissionPayable,
    0,
  )
  const totalUndepositedCod = riderAccounts.reduce(
    (sum, rider) => sum + rider.undepositedCodCash,
    0,
  )
  const totalCashOnHand = riderAccounts.reduce(
    (sum, rider) => sum + rider.cashOnHand,
    0,
  )
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0)
  const totalPaymentVolume = payments
    .filter(
      (payment) =>
        payment.status === 'success' || payment.status === 'reconciled',
    )
    .reduce((sum, payment) => sum + payment.amount, 0)

  const recentEntries = useMemo(() => {
    const query = debouncedRecentSearch.trim().toLowerCase()
    return journalEntries
      .filter((entry) => {
        if (!query) return true
        return (
          entry.voucherNo.toLowerCase().includes(query) ||
          entry.narration.toLowerCase().includes(query) ||
          (entry.refType ?? '').toLowerCase().includes(query) ||
          (entry.refId ?? '').toLowerCase().includes(query)
        )
      })
      .slice(0, 10)
  }, [journalEntries, debouncedRecentSearch])

  const recentDebit = recentEntries.reduce(
    (sum, entry) => sum + entry.totalDebit,
    0,
  )
  const recentCredit = recentEntries.reduce(
    (sum, entry) => sum + entry.totalCredit,
    0,
  )

  const columns = useMemo<ColumnDef<DetailedJournalEntry>[]>(
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
              className="font-mono text-xs font-semibold text-primary hover:underline"
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
            <span className="block text-xs">{row.original.bsDate}</span>
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
            <span
              className="block truncate text-xs"
              title={row.original.narration}
            >
              {row.original.narration}
            </span>
            <span className="block text-[10px] font-mono text-muted-foreground">
              {row.original.refType
                ? `${row.original.refType}${
                    row.original.refId
                      ? ` · ${row.original.refId.slice(0, 16)}`
                      : ''
                  }`
                : 'manual'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'totalDebit',
        header: 'Debit',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.totalDebit}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          />
        ),
      },
      {
        accessorKey: 'totalCredit',
        header: 'Credit',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.totalCredit}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400"
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
              row.original.postingStatus === 'submitted'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : ''
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
        {
          header: 'Debit (NPR)',
          value: (entry) => csvRupees(entry.totalDebit),
        },
        {
          header: 'Credit (NPR)',
          value: (entry) => csvRupees(entry.totalCredit),
        },
        { header: 'Status', value: (entry) => entry.postingStatus },
        { header: 'Posted By', value: (entry) => entry.createdBy },
      ],
      recentEntries,
    )
  }

  const isBalanced = trialBalanceVariance === 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Accounting Overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Double-entry ledger summary. Every figure is derived from posted
            journal entries — the single source of truth.
          </p>
        </div>
        <Badge
          variant={isBalanced ? 'success' : 'destructive'}
          className="text-xs font-normal"
        >
          {isBalanced ? (
            <CheckCircle2 className="mr-1 h-3 w-3" />
          ) : (
            <AlertCircle className="mr-1 h-3 w-3" />
          )}
          {isBalanced
            ? 'Trial Balance Balanced'
            : `Trial Balance Variance ${csvRupees(trialBalanceVariance)}`}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Chart of Accounts</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {leafAccounts.length} leaf accounts
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {chartOfAccounts.length}
              </span>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Trial Balance</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {isBalanced ? 'Debit equals credit' : 'Requires review'}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <MoneyText
                paisa={trialBalanceVariance}
                className={`text-2xl font-bold font-mono tabular-nums ${
                  isBalanced ? 'text-success' : 'text-destructive'
                }`}
              />
              {isBalanced ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Dealer Payables</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {
                dealerPayables.filter((dealer) => dealer.outstandingPayable > 0)
                  .length
              }{' '}
              dealers outstanding
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <MoneyText
                paisa={totalOutstandingDealer}
                className={`text-2xl font-bold font-mono tabular-nums ${
                  totalOutstandingDealer > 0 ? 'text-warning' : 'text-success'
                }`}
              />
              <Store className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Rider Commission</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Payable to riders
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <MoneyText
                paisa={totalCommissionPayable}
                className={`text-2xl font-bold font-mono tabular-nums ${
                  totalCommissionPayable > 0 ? 'text-warning' : 'text-success'
                }`}
              />
              <Coins className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Undeposited COD</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Cash in hand {csvRupees(totalCashOnHand)} NPR
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <MoneyText
                paisa={totalUndepositedCod}
                className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400"
              />
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">Payment Volume</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Sales {csvRupees(totalSales)} NPR
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <MoneyText
                paisa={totalPaymentVolume}
                className="text-2xl font-bold font-mono tabular-nums text-success"
              />
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Quick Actions
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Post vouchers, receive rider cash, settle dealers, or open a
              report.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab?.('transactions')}
            className="h-7 gap-1 text-xs"
          >
            <Receipt className="h-3 w-3" />
            All transactions
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
              Post journal voucher
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
              Record cash handover
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
              Dealer batch settlement
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
              Run rider payroll
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('dealer-ledger')}
          >
            <span className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5" />
              Dealer report
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('rider-ledger')}
          >
            <span className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5" />
              Rider report
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 text-xs"
            onClick={() => onNavigateTab?.('ledger')}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              General ledger
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
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Financial reports
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Recent Journal Entries
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab?.('transactions')}
            className="h-7 gap-1 text-xs"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={recentEntries}
          searchValue={recentSearch}
          onSearchChange={setRecentSearch}
          searchPlaceholder="Search recent voucher, narration or reference…"
          actionSlot={
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportRecent}
              disabled={recentEntries.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          }
          emptyMessage="No journal entries match the current search."
          dense
          onRowClick={(entry) => openVoucher(entry.id)}
          initialSorting={[{ id: 'postingDate', desc: true }]}
          footerSlot={
            recentEntries.length > 0 ? (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={3} className="px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Showing {recentEntries.length} of {journalEntries.length}{' '}
                    loaded vouchers
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
                    className="text-xs font-bold text-rose-600 dark:text-rose-400"
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
