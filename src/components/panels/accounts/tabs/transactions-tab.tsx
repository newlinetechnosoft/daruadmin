import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import {
  DateRangeFilter,
  useDateFilter,
} from '#/components/shared/date-range-filter'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import { accountsRouteApi, VOUCHER_TYPE_OPTIONS } from '../accounts-route'
import { useVoucherDialog } from '../use-voucher-dialog'
import { csvDate, csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileText,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import type { DetailedJournalEntry } from '#/server/finance/finance.queries'

const REF_TYPE_OPTIONS = [
  { value: 'all', label: 'All Reference Types' },
  { value: 'order', label: 'Order' },
  { value: 'rider_cash_handover', label: 'Cash Handover' },
  { value: 'dealer_settlement', label: 'Dealer Settlement' },
  { value: 'manual', label: 'Manual Entry' },
  { value: 'payroll', label: 'Payroll' },
]

const VOUCHER_TYPE_CLASS: Record<string, string> = {
  JV: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PV: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  RV: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  CV: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  SV: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export function TransactionsTab() {
  const routeApi = accountsRouteApi
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const { dateFilter, setDateFilter, bounds } = useDateFilter('today')

  const voucherTypeFilter = search.voucherType ?? 'all'
  const [refTypeFilter, setRefTypeFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const updateVoucherType = (value: string) => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({
        ...prev,
        voucherType: value === 'all' ? undefined : value,
      }),
      replace: true,
    })
  }

  const {
    data: entries = [],
    isFetching,
    refetch,
  } = useQuery({
    ...adminQueries.journalTransactions({
      voucherType: voucherTypeFilter !== 'all' ? voucherTypeFilter : undefined,
      refType: refTypeFilter !== 'all' ? refTypeFilter : undefined,
      fromDate: bounds.start?.toISOString(),
      toDate: bounds.end?.toISOString(),
      search: debouncedSearch.trim() || undefined,
      limit: 500,
    }),
    placeholderData: (previous) => previous,
  })

  const { openVoucher, voucherDialog } = useVoucherDialog()

  const totalDebit = entries.reduce((sum, entry) => sum + entry.totalDebit, 0)
  const totalCredit = entries.reduce((sum, entry) => sum + entry.totalCredit, 0)
  const reversedCount = entries.filter(
    (entry) => entry.isReversed || entry.reversalOf,
  ).length
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1

  const columns = useMemo<ColumnDef<DetailedJournalEntry>[]>(
    () => [
      {
        accessorKey: 'voucherNo',
        header: 'Voucher',
        cell: ({ row }) => (
          <div className="leading-tight">
            <button
              type="button"
              onClick={() => openVoucher(row.original.id)}
              className="font-mono text-xs font-semibold text-primary hover:underline"
            >
              {row.original.voucherNo}
            </button>
            <span className="block text-[10px] text-muted-foreground">
              {row.original.event || 'journal entry'}
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
        accessorKey: 'voucherType',
        header: 'Type',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`font-mono text-[10px] ${
              VOUCHER_TYPE_CLASS[row.original.voucherType] ?? ''
            }`}
          >
            {row.original.voucherType}
          </Badge>
        ),
      },
      {
        accessorKey: 'narration',
        header: 'Narration / Reference',
        cell: ({ row }) => (
          <div className="max-w-[280px] leading-tight">
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
                      ? ` · ${row.original.refId.slice(0, 14)}`
                      : ''
                  }`
                : 'manual'}
            </span>
          </div>
        ),
      },
      {
        id: 'lines',
        header: 'Accounts',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            {row.original.lines.slice(0, 3).map((line) => (
              <div
                key={line.id}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                {line.debit > 0 ? (
                  <ArrowUpRight className="h-3 w-3 shrink-0 text-emerald-500" />
                ) : (
                  <ArrowDownLeft className="h-3 w-3 shrink-0 text-rose-500" />
                )}
                <span
                  className="max-w-[160px] truncate"
                  title={line.accountName}
                >
                  <span className="font-mono">{line.accountCode}</span>{' '}
                  {line.accountName}
                </span>
              </div>
            ))}
            {row.original.lines.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{row.original.lines.length - 3} more line(s)
              </span>
            )}
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
          <div className="space-y-1">
            <Badge variant="outline" className="text-[10px] capitalize">
              {row.original.postingStatus}
            </Badge>
            {row.original.isReversed && (
              <span className="block text-[10px] text-destructive">
                reversed
              </span>
            )}
            {row.original.reversalOf && (
              <span className="block text-[10px] text-warning">reversal</span>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              openVoucher(row.original.id)
            }}
            className="h-7 gap-1 px-2 text-xs"
          >
            <FileText className="h-3 w-3" />
            View
          </Button>
        ),
      },
    ],
    [openVoucher],
  )

  const handleExport = () => {
    exportCsv(
      `journal-transactions-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Voucher No', value: (entry) => entry.voucherNo },
        { header: 'Voucher Type', value: (entry) => entry.voucherType },
        { header: 'Date (BS)', value: (entry) => entry.bsDate },
        {
          header: 'Date (AD)',
          value: (entry) => csvDate(entry.postingDate),
        },
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
        { header: 'Created By', value: (entry) => entry.createdBy },
      ],
      entries,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Vouchers</span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {entries.length}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Total Debit</span>
          <MoneyText
            paisa={totalDebit}
            className="mt-1 block text-lg font-bold text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">Total Credit</span>
          <MoneyText
            paisa={totalCredit}
            className="mt-1 block text-lg font-bold text-rose-600 dark:text-rose-400"
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">
            Reversed / Reversals
          </span>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {reversedCount}
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search voucher number, narration, reference…"
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              size="sm"
              value={voucherTypeFilter}
              onChange={(event) => updateVoucherType(event.target.value)}
              className="h-8 text-xs"
            >
              {VOUCHER_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              size="sm"
              value={refTypeFilter}
              onChange={(event) => setRefTypeFilter(event.target.value)}
              className="h-8 text-xs"
            >
              {REF_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              size="sm"
              showSteppers
              showDualDate={false}
            />
          </div>
        }
        actionSlot={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchInput('')
                setRefTypeFilter('all')
                updateVoucherType('all')
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={entries.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </>
        }
        isLoading={isFetching && entries.length === 0}
        emptyMessage="No journal entries found for the selected filters."
        dense
        onRowClick={(entry) => openVoucher(entry.id)}
        initialSorting={[{ id: 'postingDate', desc: true }]}
        footerSlot={
          entries.length > 0 ? (
            <TableRow className="border-border hover:bg-transparent">
              <TableCell colSpan={5} className="px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {entries.length} voucher{entries.length === 1 ? '' : 's'}
                </span>
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalDebit}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                />
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={totalCredit}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </TableCell>
              <TableCell colSpan={2} className="px-3 py-2 text-right">
                <span
                  className={`text-xs font-semibold ${
                    isBalanced ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {isBalanced ? '✓ Balanced' : '⚠ Out of balance'}
                </span>
              </TableCell>
            </TableRow>
          ) : null
        }
      />

      {voucherDialog}
    </div>
  )
}
